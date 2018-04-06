export type Token = MachineToken | {type: 'other', content: string}
export type MachineToken = {
  type: 'machine'
  pre?: string
  host: string
  internalWhitespace: string
  props: {[key: string]: {value: string, comment?: string}}
  comment?: string
}

export type Machines = {
  [key: string]: {
    login?: string
    password?: string
    account?: string
    [key: string]: string | undefined
  }
}

// this is somewhat complicated but it takes the array of parsed tokens from parse()
// and it creates ES6 proxy objects to allow them to be easily modified by the consumer of this library
function proxify(tokens: Token[]): Machines {
  const proxifyProps = (t: MachineToken) => new Proxy(t.props as any as {[key: string]: string}, {
    get(_, key: string) {
      if (key === 'host') return t.host
      // tslint:disable-next-line strict-type-predicates
      if (typeof key !== 'string') return t.props[key]
      const prop = t.props[key]
      if (!prop) return
      return prop.value
    },
    set(_, key: string, value: string) {
      if (key === 'host') {
        t.host = value
      } else if (!value) {
        delete t.props[key]
      } else {
        t.props[key] = t.props[key] || (t.props[key] = {value: ''})
        t.props[key].value = value
      }
      return true
    },
  })
  const machineTokens = tokens.filter((m): m is MachineToken => m.type === 'machine')
  const machines = machineTokens.map(proxifyProps)
  const getWhitespace = () => {
    if (!machineTokens.length) return '\n  '
    return machineTokens[machineTokens.length - 1].internalWhitespace
  }
  return new Proxy({} as Machines, {
    get(base, host: string) {
      if (host === '_tokens') return tokens
      // tslint:disable-next-line strict-type-predicates
      if (typeof host !== 'string') return base[host]
      return machines.find(m => m.host === host)
    },
    set(_, host: string, props: {[key: string]: string}) {
      if (!props) {
        const idx = tokens.findIndex(m => m.type === 'machine' && m.host === host)
        if (idx === -1) return true
        tokens.splice(idx, 1)
        return true
      }
      let machine = machines.find(m => m.host === host)
      if (!machine) {
        const token: MachineToken = {type: 'machine', host, internalWhitespace: getWhitespace(), props: {}}
        tokens.push(token)
        machine = proxifyProps(token)
        machines.push(machine)
      }
      for (let [k, v] of Object.entries(props)) {
        machine[k] = v
      }
      return true
    },
    has: (_, host: string) => {
      // tslint:disable-next-line strict-type-predicates
      if (typeof host !== 'string') return !!tokens[host]
      return !!tokens.find(m => m.type === 'machine' && m.host === host)
    },
    deleteProperty(_, host: string) {
      const idx = tokens.findIndex(m => m.type === 'machine' && m.host === host)
      if (idx === -1) return true
      tokens.splice(idx, 1)
      return true
    },
  })
}

export function parse(body: string): Machines {
  const lines = body.split('\n')
  let pre: string[] = []
  let machines: MachineToken[] = []
  while (lines.length) {
    const line = lines.shift()!
    const match = line.match(/machine\s+((?:[^#\s]+[\s]*)+)(#.*)?$/)
    if (!match) {
      pre.push(line)
      continue
    }
    const [, body, comment] = match
    const machine: MachineToken = {
      type: 'machine',
      host: body.split(' ')[0],
      pre: pre.join('\n'),
      internalWhitespace: '\n  ',
      props: {},
      comment,
    }
    pre = []
    // do not read other machines with same host
    if (!machines.find(m => m.type === 'machine' && m.host === machine.host)) machines.push(machine)
    if (body.trim().includes(' ')) { // inline machine
      const [host, ...propStrings] = body.split(' ')
      for (let a = 0; a < propStrings.length; a += 2) {
        machine.props[propStrings[a]] = {value: propStrings[a + 1]}
      }
      machine.host = host
      machine.internalWhitespace = ' '
    } else { // multiline machine
      while (lines.length) {
        const line = lines.shift()!
        const match = line.match(/^\s+([\S]+)\s+([\S]+)(\s+#.*)?$/)
        if (!match) {
          lines.unshift(line)
          break
        }
        const [, key, value, comment] = match
        machine.props[key] = {value, comment}
      }
    }
  }
  return proxify([...machines, {type: 'other', content: pre.join('\n')}])
}
