export type MachineProps = 'login' | 'account' | 'password'

export interface Machine {
  type: 'machine'
  content: string
  host: string
}

export interface Default {
  type: 'default'
  content: string
}

export interface Prop {
  type: 'prop'
  content: string
  name: MachineProps
  value: string
}

export interface Macdef {
  type: 'macdef'
  content: string
}

export interface Comment {
  type: 'comment'
  content: string
}

export interface Whitespace {
  type: 'whitespace'
  content: string
}

export type Token = Machine | Prop | Default | Macdef | Whitespace | Comment
