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
  _tokens?: Token[]
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
  else return fs.readFileSync(file, 'utf8')
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
  let tokens = machine._tokens = machine._tokens || []
  const props = (): PropToken[] => (tokens.filter(t => t.type === 'prop'): any)
  for (let prop of props()) machine[prop.name] = prop.value
  return new Proxy(machine, {
    set: (machine, name, value) => {
      machine[name] = value
      let prop = props().find(p => p.name === name)
      if (prop) prop.value = value
      else {
        let lastPropIdx = findIndex(tokens, t => t.type === 'prop')
        tokens.splice(lastPropIdx, 0, tokens[lastPropIdx - 1]) // insert whitespace
        tokens.splice(lastPropIdx, 0, {type: 'prop', name, value})
      }
      return true
    }
  })
}

function machinesProxy () {
  return new Proxy({}, {
    set: (machines, host, value) => {
      machines[host] = machineProxy(value)
      return true
    }
  })
}

/**
 * parses a netrc file
 */
class Netrc {
  /**
   * gets the machines on the home netrc file
   * @example
   * const netrc = require('netrc-parser')
   * netrc.machines['api.heroku.com'].password // get auth token from ~/.netrc
   */
  static get machines (): Machines { return this.home.machines }

  /**
   * save the current home netrc with any changes
   * @example
   * const netrc = require('netrc-parser')
   * netrc.machines['api.heroku.com'].password = 'newpassword'
   * netrc.save()
   */
  static save () { this._home.save() }

  static get home (): Netrc {
    if (this._home) return this._home
    const f = os.platform() === 'win32' ? '_netrc' : '.netrc'
    this._home = new Netrc(path.join(os.homedir(), f))
    return this._home
  }
  static _home: Netrc

  constructor (file: string) {
    this.file = file
    this.machines = machinesProxy()
    this._parse()
  }

  file: string
  machines: Machines
  default: ?Machine
  _tokens: (Token | Machine)[]

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
    this._tokens = []
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
          this.machines[host] = {type: 'machine', _tokens: getMachineTokens()}
          this._tokens.push(this.machines[host])
          break
        default:
          this._tokens.push(tokens[i])
      }
    }
  }
}

module.exports = Netrc
