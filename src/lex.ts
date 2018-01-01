const Lexer = require('lex')

export interface MachineToken {
  type: 'machine'
  content: string
  value: string
}

export interface PropToken {
  type: 'prop'
  name: keyof Machine
  value: string
}

export interface DefaultToken {
  type: 'default'
  content: string
}

export interface MacdefToken {
  type: 'macdef'
  content: string
}

export interface CommentToken {
  type: 'comment'
  content: string
}

export interface WhitespaceToken {
  type: 'whitespace'
  content: string
}

export type Token = MachineToken | PropToken | DefaultToken | MacdefToken | WhitespaceToken | CommentToken

export interface Machine {
  type: 'machine'
  machine?: string
  login?: string
  account?: string
  password?: string
  value?: string
  _tokens: Token[]
}

export default function lex(body: string): Token[] {
  let tokens: Token[] = []
  let lexer = new Lexer((char: string) => {
    throw new Error(`Unexpected character during netrc parsing at character ${char}:
${body}`)
  })
  lexer.addRule(
    /\s+/,
    (content: string) => {
      tokens.push({ type: 'whitespace', content })
    },
    [0, 1],
  )
  lexer.addRule(
    /#.*/,
    (content: string) => {
      tokens.push({ type: 'comment', content })
    },
    [0, 1],
  )

  lexer.addRule(
    /macdef/g,
    function(this: any, content: string) {
      this.state = 3
      tokens.push({ type: 'macdef', content })
    },
    [0, 1, 3],
  )
  lexer.addRule(
    /machine +(\S+)/,
    function(this: any, content: string, value: string) {
      this.state = 1
      tokens.push({ type: 'machine', content, value })
    },
    [0, 1, 3],
  )
  lexer.addRule(
    /[\s\S\n]/,
    function(content: string) {
      ;(tokens[tokens.length - 1] as WhitespaceToken).content += content
    },
    [3],
  )

  lexer.addRule(
    /([a-zA-Z]+) +(\S+)/,
    (_: string, name: string, value: string) => {
      tokens.push({ type: 'prop', name: name as any, value })
    },
    [1],
  )
  lexer.addRule(
    /default/,
    function(this: any, content: string) {
      this.state = 1
      tokens.push({ type: 'default', content })
    },
    [0],
  )

  lexer.setInput(body).lex()
  return tokens
}
