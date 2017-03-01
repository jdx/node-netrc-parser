// @flow

const fs = require('fs')

type Machine = {
  host: string,
  password: string
}

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
  const machines = {}
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
        machines[host][prop.token] = tokens.shift().token
    }
  }
  console.dir(machines)
  return machines
}

class Netrc {
  constructor (file: string) {
    this.machines = parse(fs.readFileSync(file, 'utf8'))
  }

  machines: Machines
}

module.exports = Netrc
