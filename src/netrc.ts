import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import * as Execa from 'execa'

import Lex from './lex'
import * as Token from './token'

let _debug: any
function debug(...args: any[]) {
  try {
    if (process.env.NETRC_PARSER_DEBUG !== '1') return
    if (!_debug) _debug = require('debug')('netrc-parser')
    _debug(...args)
  } catch (err) {}
}

const stdio = [0, null, 2]

/**
 * parses a netrc file
 */
export class Netrc extends Token.Base {
  /**
   * generates or parses a netrc file
   * @example
   * const {Netrc} = require('netrc-parser')
   * const netrc = new Netrc()
   * netrc.machines['api.heroku.com'].password // get auth token from ~/.netrc
   */
  constructor(file?: string) {
    super()
    this._file = file
  }

  private _file: string | undefined
  protected _tokens!: Token.Token[]
  public get file() {
    return this._file!
  }
  public get machines() {
    return this._machines!
  }
  private _machines!: Token.Machines

  get default(): Token.IMachine | undefined {
    return this._tokens.find(t => t.type === 'default') as Token.DefaultMachine
  }
  set default(v: Token.IMachine | undefined) {
    let idx = this._tokens.findIndex(t => t.type === 'default')
    if (idx !== -1 && !v) this._tokens.splice(idx, 1)
    else {
      let newMachine = new Token.DefaultMachine({ ...v, post: '\n' })
      if (idx !== -1 && v) this._tokens[idx] = newMachine
      else if (v) this._tokens.push(newMachine)
    }
  }

  async load() {
    if (!this._file) this._file = await this.defaultFile()
    this.parse(await this.readFile())
  }

  loadSync() {
    if (!this._file) this._file = this.defaultFile()
    this.parse(this.readFileSync())
  }

  /**
   * save the current home netrc with any changes
   * @example
   * const Netrc = require('netrc-parser')
   * const netrc = new Netrc()
   * await netrc.load()
   * netrc.machines['api.heroku.com'].password = 'newpassword'
   * netrc.save()
   */
  save() {
    return this.write(this.content)
  }

  /**
   * save the current home netrc with any changes
   * @example
   * const Netrc = require('netrc-parser')
   * const netrc = new Netrc()
   * netrc.loadSync()
   * netrc.machines['api.heroku.com'].password = 'newpassword'
   * netrc.saveSync()
   */
  saveSync() {
    this.writeSync(this.content)
  }

  private get gpgEncryptArgs() {
    const args = ['-a', '--batch', '--default-recipient-self', '-e']
    debug('running gpg with args %o', args)
    return args
  }

  private async write(body: string) {
    if (this.file.endsWith('.gpg')) {
      const execa: typeof Execa = require('execa')
      const { stdout, code } = await execa('gpg', this.gpgEncryptArgs, { input: body, stdio: [null, null, 2] })
      if (code) throw new Error(`gpg exited with code ${code}`)
      body = stdout
    }
    return new Promise((resolve, reject) => {
      fs.writeFile(this.file, body, { mode: 0o600 }, err => (err ? reject(err) : resolve()))
    })
  }

  private writeSync(body: string) {
    if (this.file.endsWith('.gpg')) {
      const execa: typeof Execa = require('execa')
      const { stdout, code } = execa.sync('gpg', this.gpgEncryptArgs, { input: body, stdio: [null, null, 2] }) as any
      if (code) throw new Error(`gpg exited with code ${status}`)
      body = stdout
    }
    fs.writeFileSync(this.file, body, { mode: 0o600 })
  }

  private parse(body: string) {
    if (body.trim() === '') body = ''
    let lex: typeof Lex = require('./lex').default
    const tokens = lex(body)

    let cur: Token.DefaultMachine | Token.Machine | this = this
    for (let token of tokens) {
      switch (token.type) {
        case 'default':
          cur = new Token.DefaultMachine(token)
          this.addToken(cur)
          break
        case 'machine':
          cur = new Token.Machine(token)
          this.addToken(cur)
          break
        case 'newline':
          cur = this
          cur.addToken(token)
          break
        default:
          cur.addToken(token)
      }
    }
    this._machines = Token.machinesProxy(this._tokens)
  }

  private get gpgDecryptArgs() {
    const args = ['--batch', '--quiet', '--decrypt', this.file]
    debug('running gpg with args %o', args)
    return args
  }

  private async readFile(): Promise<string> {
    const decryptFile = async (): Promise<string> => {
      const execa: typeof Execa = require('execa')
      const { code, stdout } = await execa('gpg', this.gpgDecryptArgs, { stdio })
      if (code !== 0) throw new Error(`gpg exited with code ${code}`)
      return stdout
    }

    if (path.extname(this.file) === '.gpg') return await decryptFile()
    else {
      return new Promise<string>((resolve, reject) => {
        fs.readFile(this.file, { encoding: 'utf8' }, (err, data) => {
          if (err && err.code !== 'ENOENT') reject(err)
          resolve(data || '')
        })
      })
    }
  }

  private readFileSync(): string {
    const decryptFile = (): string => {
      const execa: typeof Execa = require('execa')
      const { stdout, status } = execa.sync('gpg', this.gpgDecryptArgs, { stdio }) as any
      if (status) throw new Error(`gpg exited with code ${status}`)
      return stdout
    }

    if (path.extname(this.file) === '.gpg') return decryptFile()
    else {
      try {
        return fs.readFileSync(this.file, 'utf8')
      } catch (err) {
        if (err.code !== 'ENOENT') throw err
        return ''
      }
    }
  }

  private get homedir() {
    return (
      (os.platform() === 'win32' &&
        (process.env.HOME ||
          (process.env.HOMEDRIVE && process.env.HOMEPATH && path.join(process.env.HOMEDRIVE!, process.env.HOMEPATH!)) ||
          process.env.USERPROFILE)) ||
      os.homedir() ||
      os.tmpdir()
    )
  }

  private defaultFile() {
    let file = path.join(this.homedir, os.platform() === 'win32' ? '_netrc' : '.netrc')
    return fs.existsSync(file + '.gpg') ? (file += '.gpg') : file
  }
}

export default new Netrc()
