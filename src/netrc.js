// @flow

const fs = require('fs')
const os = require('os')
const path = require('path')

/**
 * @typedef Machines
 * @type Object
 * @prop {string} login
 * @prop {string} password
 */
type Machine = {
  [prop: string]: string,
  login?: string,
  password?: string
}

/**
 * @typedef Machines
 * @type {Object.<string, Machine}
 */
type Machines = {[name: string]: Machine}

/**
 * parses a netrc file
 */
class Netrc {
  /**
   * gets the machines on the default netrc file
   */
  static machines (): Machines {
    const f = os.platform() === 'win32' ? '_netrc' : '.netrc'
    const netrc = new Netrc(path.join(os.homedir(), f))
    return netrc.machines
  }

  constructor (file: string) {
    this._parse(file)
  }

  machines: Machines
  default: Machine

  _read (file: string): string {
    if (path.extname(file) === '.gpg') return this._decrypt(file)
    else return fs.readFileSync(file, 'utf8')
  }

  _decrypt (file: string): string {
    const {spawnSync} = require('child_process')
    const {stdout, status} = spawnSync('gpg', ['--batch', '--decrypt', file], {stdio: [0, null, 2], encoding: 'utf8'})
    if (status !== 0) throw new Error(`gpg exited with code ${status}`)
    return (stdout: any)
  }

  _lex (body: string): {token: string, line: number}[] {
    const tokens = []
    let lineIndex = 0
    for (let line of body.split('\n')) {
      line = line.split('#')[0].trim()
      for (let token of line.split(' ')) {
        token = token.trim()
        if (!token) continue
        tokens.push({token, line: lineIndex})
      }
      lineIndex++
    }
    return tokens
  }

  _parse (file: string) {
    const body = this._read(file)
    this.machines = {}
    const tokens = this._lex(body)
    let machine
    let prop
    while (tokens.length > 0) {
      prop = tokens.shift()
      switch (prop.token) {
        case 'default':
          this.default = machine = {}
          break
        case 'machine':
          let host = tokens.shift().token
          machine = this.machines[host] = {}
          break
        case 'macdef':
          while (tokens.length > 0 && !['machine', 'default'].includes(tokens[0].token)) {
            prop = tokens.shift()
          }
          break
        default:
          if (!machine) throw new Error(`Invalid token ${prop.token} on line ${prop.line} in ${file}`)
          machine[prop.token] = tokens.shift().token
      }
    }
  }
}

module.exports = Netrc
