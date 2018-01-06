export type MachineProps = 'login' | 'account' | 'password'

export interface Macdef {
  type: 'macdef'
  content: string
}

export interface Newline {
  type: 'newline'
  content: string
}

export interface Comment {
  type: 'comment'
  content: string
}

export type Token = Machine | Prop | DefaultMachine | Macdef | Newline | Comment

export interface IMachine {
  login?: string
  password?: string
  account?: string
}

export interface Options {
  pre?: string
  post?: string
  elements?: Element[]
}

export abstract class Base {
  public pre: string
  public post: string
  protected _tokens?: Token[]

  constructor({ pre, post }: Options = {}) {
    this.pre = pre || ''
    this.post = post || ''
  }

  addToken(token: Token) {
    this._tokens = this._tokens || []
    this._tokens.push(token)
  }

  get content(): string {
    return [this.pre, this._content, this.post, ...(this._tokens || []).map(e => e.content)].join('')
  }
  protected get _content() {
    return ''
  }
}

export class Prop extends Base {
  type: 'prop' = 'prop'
  name: MachineProps
  value: string

  constructor(opts: Options & { name: MachineProps; value: string }) {
    super(opts)
    this.name = opts.name
    this.value = opts.value
  }

  protected get _content() {
    return `${this.name} ${this.value}`
  }
}

export interface MachineOptions extends Options {
  login?: string
  password?: string
  account?: string
}

export abstract class MachineBase extends Base {
  protected _tokens: Token[] = []

  constructor({ login, password, account, ...opts }: MachineOptions = {}) {
    super(opts)
    if (password) this.password = password
    if (account) this.account = account
    if (login) this.login = login
  }

  get login() {
    return this.getProp('login')
  }
  get password() {
    return this.getProp('password')
  }
  get account() {
    return this.getProp('account')
  }

  set login(v) {
    this.setProp('login', v)
  }
  set password(v) {
    this.setProp('password', v)
  }
  set account(v) {
    this.setProp('account', v)
  }

  private getProp(name: MachineProps): string | undefined {
    const p = this._tokens.find(p => p.type === 'prop' && p.name === name) as Prop
    return p && p.value
  }

  private setProp(name: MachineProps, value: string | undefined) {
    if (!value) {
      this._tokens = this._tokens.filter(p => p.type === 'prop' && p.name !== name)
      return
    }
    let p = this._tokens.find(p => p.type === 'prop' && p.name === name) as Prop
    if (p) {
      p.value = value
    } else {
      this._tokens.unshift(new Prop({ name, value, pre: this.newPropPre(), post: this.newPropPost() }))
    }
  }

  private get _props(): Prop[] {
    return this._tokens.filter(p => p.type === 'prop') as Prop[]
  }

  private newPropPre(): string {
    return this._props[0] ? this._props[0].pre : this.isMultiline() ? '  ' : ' '
  }

  private newPropPost(): string {
    return this.isMultiline() ? '\n' : ''
  }

  private isMultiline(): boolean {
    if (!this._tokens.length) return true
    return this._tokens.reduce((c, p) => c + p.content.split('\n').length - 1, this.post.split('\n').length - 1) > 1
  }
}

export class Machine extends MachineBase {
  type: 'machine' = 'machine'
  host: string

  constructor({ host, ...opts }: MachineOptions & { host: string }) {
    super(opts)
    this.host = host
  }

  protected get _content() {
    return `machine ${this.host}`
  }
}

export class DefaultMachine extends MachineBase {
  type: 'default' = 'default'
  protected get _content() {
    return 'default'
  }
}

export interface Machines {
  [host: string]: IMachine
}

export function machinesProxy(tokens: Token[] = []): Machines {
  return new Proxy({} as Machines, {
    get: (_, host: string) => {
      if (typeof host !== 'string') return tokens[host]
      return tokens.find(m => m.type === 'machine' && m.host === host)
    },
    set: (_, host: string, v: IMachine | undefined) => {
      let idx = tokens.findIndex(m => m.type === 'machine' && m.host === host)
      if (v) {
        let newMachine = new Machine({ ...v, host, post: '\n' })
        if (idx === -1) {
          if (tokens.length === 1 && tokens[0].type === 'newline') tokens.splice(0, 1)
          else tokens.push({ type: 'newline', content: '\n' })
          tokens.push(newMachine)
        } else tokens[idx] = newMachine
      } else if (idx !== -1) {
        tokens.splice(idx, 1)
      }
      return true
    },
    has: (_, host: string) => {
      if (typeof host !== 'string') return !!tokens[host]
      return !!tokens.find(m => m.type === 'machine' && m.host === host)
    },
    deleteProperty: (_, host: string) => {
      const idx = tokens.findIndex(m => m.type === 'machine' && m.host === host)
      if (idx === -1) return true
      tokens.splice(idx, 1)
      return true
    },
  })
}
