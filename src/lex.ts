import * as Token from './token'

const Lexer = require('lex')

export default function lex(body: string): Token.Token[] {
  let tokens: Token.Token[] = []
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
    function(this: any, content: string, host: string) {
      this.state = 1
      tokens.push({ type: 'machine', content, host })
    },
    [0, 1, 3],
  )
  lexer.addRule(
    /[\s\S\n]/,
    function(content: string) {
      ;(tokens[tokens.length - 1] as Token.Whitespace).content += content
    },
    [3],
  )

  lexer.addRule(
    /([a-zA-Z]+) +(\S+)/,
    (content: string, name: string, value: string) => {
      tokens.push({ type: 'prop', content, name: name as any, value })
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
