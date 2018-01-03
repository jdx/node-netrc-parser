import lex from './lex'
import {machinesProxy, Element, Prop, Machine, DefaultMachine, Machines} from './machine'

export interface Options {
  pre?: string
  post?: string
  machines?: (Machine | DefaultMachine)[]
}

export class File extends Element {
  machines: Machines
  default?: DefaultMachine

  constructor ({machines = [], ...opts}: Options) {
    super(opts)
    this.machines = machinesProxy(machines)
    this.default = machines.find(m => m.type === 'default') as DefaultMachine
  }
}

export default function parse (body: string): File {
  const machines: (Machine | DefaultMachine)[] = []
  const tokens = lex(body)

  let pre = ''
  let token
  let cur: DefaultMachine | Machine | Prop | undefined
  while (token = tokens.shift()) {
    switch (token.type) {
      case 'default':
        cur = new DefaultMachine()
        machines.push(cur)
        break
      case 'machine':
        cur = new Machine({host: token.host})
        machines.push(cur)
        break
      case 'prop':
        if (!cur || cur.type === 'prop') throw new Error(`cannot add prop ${token} to ${cur}`)
        ;(cur as Machine | DefaultMachine).addProp(token)
      default: // whitespace
        if (cur) cur.post += token.content
        else pre += token.content
    }
  }
  return new File({machines})
}
