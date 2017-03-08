// @flow

const fs = require('fs')
const os = require('os')
const path = require('path')
const Lexer = require('lex')

type MachineToken = {
  type: 'machine',
  value: string
}

type PropToken = {
  type: 'prop',
  name: string,
  value: string
}

type DefaultToken = {
  type: 'default'
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
  machine?: string,
  login?: string,
  password?: string,
  _tokens?: Token[]
}

type Machines = {
  [host: string]: Machine
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
    tokens.push({type: 'machine', value})
  }, [0, 1, 3])
  lexer.addRule(/[\s\S\n]/, function (content) {
    (tokens[tokens.length - 1]: any).content += content
  }, [3])

  lexer.addRule(/([a-zA-Z]+) +(\S+)/, (content, name, value) => {
    tokens.push({type: 'prop', name, value})
  }, [1])
  lexer.addRule(/default/, function () {
    this.state = 1
    tokens.push({type: 'default'})
  }, [0])

  lexer.setInput(body).lex()
  return tokens
}

function machineProxy (machine: Machine) {
  const props = (): PropToken[] => ((machine._tokens || []).filter(t => t.type === 'prop'): any)
  for (let prop of props()) machine[prop.name] = prop.value
  return new Proxy(machine, {
    set: (machine, name, value) => {
      return false
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
   * gets the machines on the default netrc file
   * @example
   * const netrc = require('netrc-parser')
   * netrc.machines['api.heroku.com'].password // get auth token from ~/.netrc
   */
  static get machines (): Machines {
    return this.default.machines
  }

  static get default (): Netrc {
    const f = os.platform() === 'win32' ? '_netrc' : '.netrc'
    return new Netrc(path.join(os.homedir(), f))
  }

  constructor (file: string) {
    this.machines = machinesProxy()
    this._parse(file)
  }

  machines: Machines
  default: ?Machine
  _tokens: (Token | Machine)[]

  _parse (file: string) {
    this._tokens = []
    let tokens = lex(readFile(file))
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
