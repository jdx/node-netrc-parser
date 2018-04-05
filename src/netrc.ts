import * as Execa from 'execa'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'

import {Machines, MachineToken, parse, Token} from './parse'

const debug = require('debug')('netrc-parser')

export class Netrc {
  file: string
  machines!: Machines

  constructor(file?: string) {
    this.file = file || this.defaultFile
  }

  async load() {
    debug('load', this.file)
    const decryptFile = async (): Promise<string> => {
      const execa: typeof Execa = require('execa')
      const {code, stdout} = await execa('gpg', this.gpgDecryptArgs, {stdio: [0, null, 2]})
      if (code !== 0) throw new Error(`gpg exited with code ${code}`)
      return stdout
    }

    let body = ''
    if (path.extname(this.file) === '.gpg') {
      body = await decryptFile()
    } else {
      body = await new Promise<string>((resolve, reject) => {
        fs.readFile(this.file, {encoding: 'utf8'}, (err, data) => {
          if (err && err.code !== 'ENOENT') reject(err)
          resolve(data || '')
        })
      })
    }
    this.machines = parse(body)
  }

  loadSync() {
    debug('loadSync', this.file)
    const decryptFile = (): string => {
      const execa: typeof Execa = require('execa')
      const {stdout, status} = execa.sync('gpg', this.gpgDecryptArgs, {stdio: [0, null, 2]}) as any
      if (status) throw new Error(`gpg exited with code ${status}`)
      return stdout
    }

    let body = ''
    if (path.extname(this.file) === '.gpg') {
      body = decryptFile()
    } else {
      try {
        body = fs.readFileSync(this.file, 'utf8')
      } catch (err) {
        if (err.code !== 'ENOENT') throw err
      }
    }

    this.machines = parse(body)
  }

  async save() {
    debug('save', this.file)
    let body = this.output
    if (this.file.endsWith('.gpg')) {
      const execa: typeof Execa = require('execa')
      const {stdout, code} = await execa('gpg', this.gpgEncryptArgs, {input: body, stdio: [null, null, 2]})
      if (code) throw new Error(`gpg exited with code ${code}`)
      body = stdout
    }
    return new Promise((resolve, reject) => {
      fs.writeFile(this.file, body, {mode: 0o600}, err => (err ? reject(err) : resolve()))
    })
  }

  saveSync() {
    debug('saveSync', this.file)
    let body = this.output
    if (this.file.endsWith('.gpg')) {
      const execa: typeof Execa = require('execa')
      const {stdout, code} = execa.sync('gpg', this.gpgEncryptArgs, {input: body, stdio: [null, null, 2]}) as any
      if (code) throw new Error(`gpg exited with code ${status}`)
      body = stdout
    }
    fs.writeFileSync(this.file, body, {mode: 0o600})
  }

  private get output(): string {
    let output: string[] = []
    for (let t of this.machines._tokens as any as Token[]) {
      if (t.type === 'other') {
        output.push(t.content)
        continue
      }
      if (t.pre) output.push(t.pre + '\n')
      output.push(`machine ${t.host}`)
      const addProps = (t: MachineToken) => {
        const addProp = (k: string) => output.push(`${t.internalWhitespace}${k} ${t.props[k].value}${t.props[k].comment || ''}`)
        // do login/password first
        if (t.props.login) addProp('login')
        if (t.props.password) addProp('password')
        for (let k of Object.keys(t.props).filter(k => !['login', 'password'].includes(k))) {
          addProp(k)
        }
      }
      const addComment = (t: MachineToken) => t.comment && output.push(' ' + t.comment)
      if (t.internalWhitespace.includes('\n')) {
        addComment(t)
        addProps(t)
        output.push('\n')
      } else {
        addProps(t)
        addComment(t)
        output.push('\n')
      }
    }
    return output.join('')
  }

  private get defaultFile(): string {
    const home = (os.platform() === 'win32' &&
        (process.env.HOME ||
          (process.env.HOMEDRIVE && process.env.HOMEPATH && path.join(process.env.HOMEDRIVE!, process.env.HOMEPATH!)) ||
          process.env.USERPROFILE)) ||
      os.homedir() ||
      os.tmpdir()
    let file = path.join(home, os.platform() === 'win32' ? '_netrc' : '.netrc')
    return fs.existsSync(file + '.gpg') ? (file += '.gpg') : file
  }

  private get gpgDecryptArgs() {
    const args = ['--batch', '--quiet', '--decrypt', this.file]
    debug('running gpg with args %o', args)
    return args
  }

  private get gpgEncryptArgs() {
    const args = ['-a', '--batch', '--default-recipient-self', '-e']
    debug('running gpg with args %o', args)
    return args
  }
}

export default Netrc
