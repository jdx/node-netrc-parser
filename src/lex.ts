import { inspect } from 'util'

import * as Token from './token'

const addTrailingNewline = (s: string) => (s.endsWith('\n') ? s : `${s}\n`)

const Lexer = require('lex')

enum SC {
  Init = 0,
  Machine = 1,
}

export default function lex(body: string): Token.Token[] {
  body = addTrailingNewline(body)
  let tokens: Token.Token[] = []
  let lexer = new Lexer((char: string) => {
    throw new Error(`Unexpected character during netrc parsing. char: ${inspect(char)}:
${body}`)
  })
  lexer.addRule(
    /\s*\n/,
    function(this: any, content: string) {
      this.state = SC.Init
      tokens.push({ type: 'newline', content })
    },
    [SC.Init, SC.Machine],
  )
  lexer.addRule(
    /\s*(#.*)\n/,
    function(this: any, content: string) {
      tokens.push({ type: 'comment', content })
    },
    [SC.Init, SC.Machine],
  )
  lexer.addRule(
    /([ \t]*)macdef.*\n(.*\S.+(\n|$))*/,
    function(this: any, content: string) {
      tokens.push({ type: 'macdef', content })
    },
    [SC.Init, SC.Machine],
  )
  lexer.addRule(
    /([ \t]*)machine +(\S+)([ \t]*\n)?/,
    function(this: any, _: string, pre: string, host: string, post: string) {
      this.state = SC.Machine
      tokens.push(new Token.Machine({ host, pre, post }))
    },
    [SC.Init, SC.Machine],
  )
  lexer.addRule(
    /([ \t]*)default([ \t]*\n)?/,
    function(this: any, _: string, pre: string, post: string) {
      this.state = SC.Machine
      tokens.push(new Token.DefaultMachine({ pre, post }))
    },
    [SC.Init, SC.Machine],
  )
  lexer.addRule(
    /([ \t]*)([a-zA-Z]+) +(\S+)([ \t]*\n)?/,
    (_: string, pre: string, name: string, value: string, post: string) => {
      tokens.push(new Token.Prop({ pre, post, name: name as any, value }))
    },
    [SC.Machine],
  )
  let bodyLines = body.match(/(.+)\n/g) || [body]
  for (let line of bodyLines) {
    lexer.setInput(line).lex()
  }
  return tokens
}
