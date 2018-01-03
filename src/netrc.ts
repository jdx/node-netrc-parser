import * as fs from 'graceful-fs'
import * as os from 'os'
import * as path from 'path'
import lex, {Token} from './lex'

let _debug: any
function debug(...args: any[]) {
  try {
    if (process.env.NETRC_PARSER_DEBUG !== '1') return
    if (!_debug) _debug = require('debug')('netrc-parser')
    _debug(...args)
  } catch (err) {}
}

export interface Machine {
  type: 'machine'
  machine?: string
  login?: string
  account?: string
  password?: string
  value?: string
  _tokens: Token[]
}

export interface DefaultMachine {
  type: 'default'
  machine?: string
  login?: string
  account?: string
  password?: string
  value?: string
  _tokens: Token[]
}

export type Machines = {
  [host: string]: Machine
}

function findIndex<T>(arr: T[], fn: (i: T) => boolean): number {
  for (let i = 0; i < arr.length; i++) {
    if (fn(arr[i])) return i
  }
  return -1
}

function readFile(file: string): string {
  function decryptFile(file: string): string {
    const { spawnSync } = require('child_process')
    const args = ['--batch', '--quiet', '--decrypt', file]
    debug('running gpg with args %o', args)
    const { stdout, status } = spawnSync('gpg', args, { stdio: [0, null, 2], encoding: 'utf8' })
    if (status !== 0) throw new Error(`gpg exited with code ${status}`)
    return stdout
  }

  if (path.extname(file) === '.gpg') return addTrailingNewline(decryptFile(file))
  else {
    try {
      return addTrailingNewline(fs.readFileSync(file, 'utf8'))
    } catch (err) {
      if (err.code !== 'ENOENT') throw err
      return ''
    }
  }
}

function machineProxy(machine: Machine) {
  const props = () => machine._tokens.filter(t => t.type === 'prop') as PropToken[]
  const loadProps = () =>
    props().forEach(prop => {
      machine[prop.name] = prop.value
    })
  loadProps()
  return new Proxy(machine, {
    set: (machine, name, value) => {
      if (name === '_tokens') {
        machine._tokens = value
        loadProps()
        return true
      }
      ;(machine as any)[name] = value
      let prop = props().find(p => p.name === name)
      if (prop) prop.value = value
      else {
        let lastPropIdx = findIndex(machine._tokens, t => t.type === 'prop')
        let whitespace =
          lastPropIdx === -1
            ? ({ type: 'whitespace', content: '\n  ' } as WhitespaceToken)
            : machine._tokens[lastPropIdx - 1]
        machine._tokens.splice(lastPropIdx, 0, whitespace) // insert whitespace
        machine._tokens.splice(lastPropIdx, 0, { type: 'prop', name, value } as PropToken)
      }
      return true
    },
  })
}

function machinesProxy(content: (Machine | Token)[]) {
  function addNewMachine(host: string) {
    let machine = machineProxy({
      type: 'machine',
      value: host,
      _tokens: [{ type: 'machine', value: host, content: `machine ${host}` }, { type: 'whitespace', content: '\n' }],
    })
    content.push(machine)
    return machine
  }
  return new Proxy({} as Machines, {
    get: (machines, host) => {
      if (typeof host !== 'string') return machines[host]
      if (!machines[host]) machines[host] = addNewMachine(host)
      return machines[host]
    },
    set: (machines, host: string, value: Machine) => {
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
    },
  })
}

function addTrailingNewline(s: string): string {
  if (s.endsWith('\n')) return s
  return s + '\n'
}

function homedir() {
  return (
    (os.platform() === 'win32' &&
      (process.env.HOME ||
        (process.env.HOMEDRIVE && process.env.HOMEPATH && path.join(process.env.HOMEDRIVE!, process.env.HOMEPATH!)) ||
        process.env.USERPROFILE)) ||
    os.homedir() ||
    os.tmpdir()
  )
}

/**
 * parses a netrc file
 */
export class Netrc {
  /**
   * generates or parses a netrc file
   * @example
   * const {Netrc} = require('netrc-parser')
   * const netrc = new Netrc()
   * netrc.machines['api.heroku.com'].password // get auth token from ~/.netrc
   */
  constructor(file?: string) {
    if (!file) {
      file = path.join(homedir(), os.platform() === 'win32' ? '_netrc' : '.netrc')
      if (fs.existsSync(file + '.gpg')) file += '.gpg'
    }
    this._tokens = []
    this.file = file
    this.machines = machinesProxy(this._tokens)
    this._parse()
  }

  file: string
  machines: Machines
  default: Machine | undefined
  private _tokens: (Token | Machine)[]

  /**
   * save the current home netrc with any changes
   * @example
   * const Netrc = require('netrc-parser')
   * const netrc = new Netrc()
   * netrc.machines['api.heroku.com'].password = 'newpassword'
   * netrc.save()
   */
  save() {
    let body = this._tokens
      .map(t => {
        switch (t.type) {
          case 'default':
          case 'machine':
            let tokens: Token[] = t._tokens || []
            return tokens
              .map(t => {
                switch (t.type) {
                  case 'prop':
                    return `${t.name} ${t.value}`
                  case 'machine':
                  case 'default':
                  case 'comment':
                  case 'whitespace':
                    return t.content
                }
              })
              .join('')
          case 'macdef':
          case 'comment':
          case 'whitespace':
            return t.content
        }
      })
      .join('')
    this._write(body)
  }

  _write(body: string) {
    if (this.file.endsWith('.gpg')) {
      const { spawnSync } = require('child_process')
      const args = ['-a', '--batch', '--default-recipient-self', '-e']
      debug('running gpg with args %o', args)
      const { stdout, status } = spawnSync('gpg', args, {
        input: body,
        stdio: [null, 'pipe', 2],
        encoding: 'utf8',
      })
      if (status !== 0) throw new Error(`gpg exited with code ${status}`)
      body = stdout
    }
    fs.writeFileSync(this.file, body, { mode: 0o600 })
  }

  private _parse() {
    let tokens = lex(readFile(this.file))
    for (let i = 0; i < tokens.length; i++) {
      let getMachineTokens = () => {
        let machineTokens = []
        while (1) {
          machineTokens.push(tokens[i])
          let next = tokens[i + 1]
          if (!next || ['machine', 'default', 'macdef'].includes(next.type) || next.type === 'default') break
          i++
        }
        return machineTokens
      }

      switch (tokens[i].type) {
        case 'macdef':
          this._tokens.push(...getMachineTokens())
          break
        case 'default':
          this.default = machineProxy({ type: 'default', _tokens: getMachineTokens() })
          this._tokens.push(this.default)
          break
        case 'machine':
          let host = (tokens[i] as MachineToken).value
          this.machines[host]._tokens = getMachineTokens()
          break
        default:
          this._tokens.push(tokens[i])
      }
    }
  }
}

export default Netrc
