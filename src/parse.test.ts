import * as Token from './token'
import lex from './lex'

export interface Options {
  pre?: string
  post?: string
}

export abstract class Element {
  protected pre: string
  protected post: string

  constructor ({pre = '\n', post = ' '}: Options = {}) {
    this.pre = pre
    this.post = post
  }

  get content(): string { return `${this.pre}${this._content}${this.post}` }
  protected abstract get _content(): string
}

export class Prop extends Element {
  name: Token.MachineProps
  value: string

  constructor (opts: Options & {name: Token.MachineProps, value: string}) {
    super(opts)
    this.name = opts.name
    this.value = opts.value
  }

  protected get _content(): string { return `${this.name} ${this.value}` }
}

export interface MachineOptions extends Options {
  props?: Prop[]
}

export abstract class MachineBase extends Element {
  protected props: Prop[]

  constructor ({props = [], ...opts}: MachineOptions) {
    super(opts)
    this.props = props
  }

  get login () { return this.getProp('login') }
  get password () { return this.getProp('password') }
  get account () { return this.getProp('account') }

  set login (v) { this.setProp('login', v) }
  set password (v) { this.setProp('password', v) }
  set account (v) { this.setProp('account', v) }

  get content(): string { return `${this.pre}${this._content}${this.props.map(p => p.content).join('')}${this.post}` }

  private getProp (name: Token.MachineProps): string | undefined {
    const p = this.props.find(p => p.name === name)
    return p && p.value
  }

  private setProp (name: Token.MachineProps, value: string | undefined) {
    if (!value) {
      this.props = this.props.filter(p => p.name === name)
      return
    }
    let p = this.props.find(p => p.name === name)
    if (p) {
      p.value = value
    } else {
      p = new Prop({name, value})
      this.props.push(p)
    }
  }
}

export class Machine extends MachineBase implements Token.Machine {
  type: 'machine' = 'machine'
  host: string

  constructor ({host, ...opts}: MachineOptions & {host: string}) {
    super(opts)
    this.host = host
  }

  protected get _content (): string { return `machine ${this.host}` }
}

export class DefaultMachine extends MachineBase implements Token.Default {
  type: 'default' = 'default'
  protected get _content (): string { return 'default' }
}

export interface Machines {
  [host: string]: Machine
}

export interface File {
  machines: Machines
  default?: DefaultMachine
  _tokens: (Machine | DefaultMachine | PropToken | CommentToken | WhitespaceToken | MacdefToken)[]
}

export default function parse (body: string): File {
  const file: File = {
    machines: {},
    _tokens: [],
  }
  const tokens = lex(body)

  const getMachineTokens = (): (PropToken | CommentToken | WhitespaceToken)[] => {
    let machineTokens: Machine['_tokens'] = []
    while (tokens.length && !['machine', 'default', 'macdef'].includes(tokens[0].type)) {
      machineTokens.push(tokens.shift() as PropToken | CommentToken | WhitespaceToken)
    }
    return machineTokens
  }

  while (tokens.length) {
    const cur = tokens.shift()!
    switch (cur.type) {
      case 'macdef':
        file._tokens.push(cur, ...getMachineTokens())
        break
      case 'default':
        file.default = machineProxy({ type: 'default', _tokens: getMachineTokens() })
        file._tokens.push(file.default!)
        break
      case 'machine':
        let host = cur.host
        file.machines[host]._tokens = getMachineTokens()
        break
      default:
        file._tokens.push(cur)
    }
  }
  return file
}

function machinesProxy(content: (Machine | Token)[]) {
  function addNewMachine(host: string) {
    let machine = machineProxy({
      type: 'machine',
      host,
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

function machineProxy(machine: Machine) {
  const props = () => machine._tokens.filter(t => t.type === 'prop') as PropToken[]
  const loadProps = () =>
    props().forEach(prop => {
      machine[prop.name] = prop.value
    })
  loadProps()
  return new Proxy(machine, {
    set: (machine, name: MachineProps, value: string) => {
      machine[name] = value
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

function findIndex<T>(arr: T[], fn: (i: T) => boolean): number {
  for (let i = 0; i < arr.length; i++) {
    if (fn(arr[i])) return i
  }
  return -1
}
