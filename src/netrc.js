// @flow

const fs = require('fs')
const os = require('os')
const path = require('path')

/**
 * @typedef Machines
 * @type Object
 * @prop {string} host
 * @prop {string} password
 */
type Machine = {
  [prop: string]: string,
  host: string,
  login?: string,
  password?: string
}

/**
 * @typedef Machines
 * @type {Object.<string, Machine}
 */
type Machines = {[name: string]: Machine}

function lex (body: string): {token: string, line: number}[] {
  const tokens = []
  let lineIndex = 0
  for (let line of body.split('\n')) {
    line = line.trim()
    if (line.includes(' ')) {
      let idx = line.indexOf(' ')
      tokens.push({token: line.slice(0, idx).trim(), line: lineIndex})
      tokens.push({token: line.slice(idx).trim(), line: lineIndex})
    } else {
      tokens.push({token: line, line: lineIndex})
    }
    lineIndex++
  }
  return tokens
}

function parse (body: string): Machines {
  const machines: Machines = {}
  const tokens = lex(body)
  let host
  let prop
  while (tokens.length > 0) {
    prop = tokens.shift()
    switch (prop.token) {
      case 'machine':
        host = tokens.shift().token
        machines[host] = {host}
        break
      default:
        if (!host) throw new Error(`Invalid token ${prop.token} on line ${prop.line}`)
        machines[host][prop.token] = tokens.shift().token
    }
  }
  return machines
}

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
    this.machines = parse(fs.readFileSync(file, 'utf8'))
  }

  machines: Machines
}

module.exports = Netrc
