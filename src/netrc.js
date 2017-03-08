// @flow

const fs = require('fs')
const os = require('os')
const path = require('path')
const Lexer = require('lex')

type MachineToken = {
  type: 'machine',
  content: string,
  value: string
}

type PropToken = {
  type: 'prop',
  name: string,
  value: string
}

type DefaultToken = {
  type: 'default',
  content: string
}

type MacdefToken = {
  type: 'macdef',
  content: string
}

type CommentToken = {
  type: 'comment',
  content: string
}

type WhitespaceToken = {
  type: 'whitespace',
  content: string
}

type Token = | MachineToken | PropToken | DefaultToken | MacdefToken | WhitespaceToken | CommentToken

type Machine = {
  type: 'machine' | 'default',
  machine?: string,
  login?: string,
  account?: string,
  password?: string,
  _tokens: Token[]
}

type Machines = {
  [host: string]: Machine
}

function findIndex (arr, fn): number {
  for (let i = 0; i < arr.length; i++) {
    if (fn(arr[i])) return i
  }
  return -1
}

function readFile (file: string): string {
  function decryptFile (file: string): string {
    const {spawnSync} = require('child_process')
    const {stdout, status} = spawnSync('gpg', ['--batch', '--quiet', '--decrypt', file], {stdio: [0, null, 2], encoding: 'utf8'})
    if (status !== 0) throw new Error(`gpg exited with code ${status}`)
    return (stdout: any)
  }

  if (path.extname(file) === '.gpg') return decryptFile(file)
  else {
    try {
      return fs.readFileSync(file, 'utf8')
    } catch (err) {
      if (err.code !== 'ENOENT') throw err
      return ''
    }
  }
}

function lex (body: string): Token[] {
  let tokens: Token[] = []
  let lexer = new Lexer(char => {
    throw new Error(`Unexpected character during netrc parsing at character ${char}:
${body}`)
  })
  lexer.addRule(/\s+/, content => {
    tokens.push({type: 'whitespace', content})
  }, [0, 1])
  lexer.addRule(/#.*/, (content) => {
    tokens.push({type: 'comment', content})
  }, [0, 1])

  lexer.addRule(/macdef/g, function (content) {
    this.state = 3
    tokens.push({type: 'macdef', content})
  }, [0, 1, 3])
  lexer.addRule(/machine +(\S+)/, function (content, value) {
    this.state = 1
    tokens.push({type: 'machine', content, value})
  }, [0, 1, 3])
  lexer.addRule(/[\s\S\n]/, function (content) {
    (tokens[tokens.length - 1]: any).content += content
  }, [3])

  lexer.addRule(/([a-zA-Z]+) +(\S+)/, (content, name, value) => {
    tokens.push({type: 'prop', name, value})
  }, [1])
  lexer.addRule(/default/, function (content) {
    this.state = 1
    tokens.push({type: 'default', content})
  }, [0])

  lexer.setInput(body).lex()
  return tokens
}

function machineProxy (machine: Machine) {
  const props = (): PropToken[] => (machine._tokens.filter(t => t.type === 'prop'): any)
  const loadProps = () => props().forEach(prop => { machine[prop.name] = prop.value })
  loadProps()
  return new Proxy(machine, {
    set: (machine, name, value) => {
      if (name === '_tokens') {
        machine._tokens = value
        loadProps()
        return true
      }
      machine[name] = value
      let prop = props().find(p => p.name === name)
      if (prop) prop.value = value
      else {
        let lastPropIdx = findIndex(machine._tokens, t => t.type === 'prop')
        let whitespace = lastPropIdx === -1 ? {type: 'whitespace', content: '\n  '} : machine._tokens[lastPropIdx - 1]
        machine._tokens.splice(lastPropIdx, 0, whitespace) // insert whitespace
        machine._tokens.splice(lastPropIdx, 0, {type: 'prop', name, value})
      }
      return true
    }
  })
}

function machinesProxy (content: (Machine | Token)[]) {
  function addNewMachine (host) {
    let machine = machineProxy({
      type: 'machine',
      value: host,
      _tokens: [
        {type: 'machine', value: host, content: `machine ${host}`},
        {type: 'whitespace', content: '\n'}
      ]
    })
    content.push(machine)
    return machine
  }
  return new Proxy({}, {
    get: (machines, host) => {
      if (typeof host !== 'string') return machines[host]
      if (!machines[host]) machines[host] = addNewMachine(host)
      return machines[host]
    },
    set: (machines, host, value) => {
      if (!machines[host]) machines[host] = addNewMachine(host)
      machines[host] = machineProxy(value)
      return true
    },
    deleteProperty: (machines, host) => {
      if (!machines[host]) return false
      delete machines[host]
      for (let i = 0; i < content.length; i++) {
        if (content[i].type === 'machine' && content[i].value === host) {
          content.splice(i, 1)
        }
      }
      return true
    }
  })
}

/**
 * parses a netrc file
 */
class Netrc {
  /**
   * generates or parses a netrc file
   * @example
   * const Netrc = require('netrc-parser')
   * const netrc = new Netrc()
   * netrc.machines['api.heroku.com'].password // get auth token from ~/.netrc
   */
  constructor (file?: string) {
    if (!file) {
      file = path.join(os.homedir(), os.platform() === 'win32' ? '_netrc' : '.netrc')
      if (fs.existsSync(file + '.gpg')) file += '.gpg'
    }
    this._tokens = []
    this.file = file
    this.machines = machinesProxy(this._tokens)
    this._parse()
  }

  file: string
  machines: Machines
  default: ?Machine
  _tokens: (Token | Machine)[]

  /**
   * save the current home netrc with any changes
   * @example
   * const Netrc = require('netrc-parser')
   * const netrc = new Netrc()
   * netrc.machines['api.heroku.com'].password = 'newpassword'
   * netrc.save()
   */
  save () {
    let body = this._tokens.map(t => {
      switch (t.type) {
        case 'default':
        case 'machine':
          let tokens: Token[] = (t: any)._tokens || []
          return tokens.map(t => {
            switch (t.type) {
              case 'prop':
                return `${t.name} ${t.value}`
              case 'machine':
              case 'default':
              case 'comment':
              case 'whitespace':
                return t.content
            }
          }).join('')
        case 'macdef':
        case 'comment':
        case 'whitespace':
          return t.content
      }
    }).join('')
    fs.writeFileSync(this.file, body, {mode: 0o600})
  }

  _parse () {
    let tokens = lex(readFile(this.file))
    for (let i = 0; i < tokens.length; i++) {
      let getMachineTokens = () => {
        let machineTokens = []
        while (1) {
          machineTokens.push(tokens[i])
          let next = tokens[i + 1]
          if (!next ||
            (['machine', 'default', 'macdef'].includes(next.type)) ||
            next.type === 'default') break
          i++
        }
        return machineTokens
      }

      switch (tokens[i].type) {
        case 'macdef':
          this._tokens.push(...getMachineTokens())
          break
        case 'default':
          this.default = machineProxy({type: 'default', _tokens: getMachineTokens()})
          this._tokens.push(this.default)
          break
        case 'machine':
          let host = tokens[i].value
          this.machines[host]._tokens = getMachineTokens()
          break
        default:
          this._tokens.push(tokens[i])
      }
    }
  }
}

module.exports = Netrc
