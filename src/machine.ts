import * as Token from './token'

export interface IMachine {
  host?: string
  login?: string
  password?: string
  account?: string
}

export interface Options {
  pre?: string
  post?: string
  elements?: Element[]
}

export abstract class Element {
  public pre: string
  public post: string
  protected elements: Element[]

  constructor ({pre = ' ', post = '\n', elements = []}: Options = {}) {
    this.pre = pre
    this.post = post
    this.elements = elements
  }

  get content(): string { return [this.pre, this._content, ...this.elements.map(e => e.content), this.post].join('') }
  protected get _content() { return '' }
}

export class Prop extends Element {
  type = 'prop'
  name: Token.MachineProps
  value: string

  constructor (opts: Options & {name: Token.MachineProps, value: string}) {
    super(opts)
    this.name = opts.name
    this.value = opts.value
  }

  protected get _content() { return `${this.name} ${this.value}` }
}

export interface MachineOptions extends Options {
  login?: string
  password?: string
  account?: string
}

export abstract class MachineBase extends Element {
  protected elements: Prop[]

  constructor ({login, password, account, ...opts}: MachineOptions = {}) {
    super(opts)
    if (login) this.login = login
    if (password) this.password = password
    if (account) this.account = account
  }

  get login () { return this.getProp('login') }
  get password () { return this.getProp('password') }
  get account () { return this.getProp('account') }

  set login (v) { this.setProp('login', v) }
  set password (v) { this.setProp('password', v) }
  set account (v) { this.setProp('account', v) }

  addProp (prop: Prop) {
    this.elements.push(prop)
  }

  private getProp (name: Token.MachineProps): string | undefined {
    const p = this.elements.find(p => p.name === name)
    return p && p.value
  }

  private setProp (name: Token.MachineProps, value: string | undefined) {
    if (!value) {
      this.elements = this.elements.filter(p => p.name === name)
      return
    }
    let p = this.elements.find(p => p.name === name)
    if (p) {
      p.value = value
    } else {
      p = new Prop({name, value})
      this.elements.push(p)
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

  protected get _content () { return `machine ${this.host}` }
}

export class DefaultMachine extends MachineBase implements Token.Default {
  type: 'default' = 'default'
  protected get _content () { return 'default' }
}

export interface Machines { [host: string]: Machine }

export function machinesProxy(elements: (Machine | DefaultMachine)[] = []): Machines {
  return new Proxy({} as Machines, {
    get: (_, host: string) => {
      if (typeof host !== 'string') return elements[host]
      return elements.find(m => m.type === 'machine' && m.host === host)
    },
    set: (_, host: string, value: IMachine) => {
      elements.push(new Machine({...value, host}))
      return true
    },
    has: (_, host: string) => {
      if (typeof host !== 'string') return !!elements[host]
      return !!elements.find(m => m.type === 'machine' && m.host === host)
    },
    deleteProperty: (_, host: string) => {
      const idx = elements.findIndex(m => m.type === 'machine' && m.host === host)
      if (idx === -1) return false
      elements.splice(idx, 1)
      return true
    },
  })
}
