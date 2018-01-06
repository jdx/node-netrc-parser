import * as fs from 'fs-extra'
import lex from './lex'

fs.mkdirpSync('tmp')

test('simple', () => {
  const tokens = lex(`machine mail.google.com
  login joe@gmail.com
  password somethingSecret
`)
  expect(tokens).toEqual([
    { type: 'machine', _tokens: [], host: 'mail.google.com', pre: '', post: '\n' },
    { type: 'prop', name: 'login', value: 'joe@gmail.com', pre: '  ', post: '\n' },
    { type: 'prop', name: 'password', value: 'somethingSecret', pre: '  ', post: '\n' },
  ])
})

test('singleline', () => {
  const tokens = lex(`machine mail.google.com login joe@gmail.com password somethingSecret`)
  expect(tokens).toEqual([
    { type: 'machine', _tokens: [], host: 'mail.google.com', pre: '', post: '' },
    { type: 'prop', name: 'login', value: 'joe@gmail.com', pre: ' ', post: '' },
    { type: 'prop', name: 'password', value: 'somethingSecret', pre: ' ', post: '\n' },
  ])
})

test('comment', () => {
  const tokens = lex(`

# foo

machine mail.google.com
  login joe@gmail.com # bar
  password somethingSecret
`)
  expect(tokens).toEqual([
    { type: 'comment', content: '\n\n# foo\n' },
    { type: 'newline', content: '\n' },
    { type: 'machine', _tokens: [], host: 'mail.google.com', pre: '', post: '\n' },
    { type: 'prop', name: 'login', value: 'joe@gmail.com', pre: '  ', post: '' },
    { type: 'comment', content: ' # bar\n' },
    { type: 'prop', name: 'password', value: 'somethingSecret', pre: '  ', post: '\n' },
  ])
})

test('bad default order', () => {
  const tokens = lex(`
# I am a comment
machine mail.google.com
  login joe@gmail.com
  account gmail
  password somethingSecret
# I am another comment

default
\tlogin anonymous
\tpassword joe@example.com

machine ray login demo password mypassword
`)
  expect(tokens).toEqual([
    { type: 'comment', content: '\n# I am a comment\n',},
    { type: 'machine', _tokens: [], host: 'mail.google.com', pre: '', post: '\n' },
    { type: 'prop', name: 'login', value: 'joe@gmail.com', pre: '  ', post: '\n' },
    { type: 'prop', name: 'account', value: 'gmail', pre: '  ', post: '\n' },
    { type: 'prop', name: 'password', value: 'somethingSecret', pre: '  ', post: '\n' },
    { type: 'comment', content: '# I am another comment\n'},
    { type: 'newline', content: '\n'},
    { type: 'default', _tokens: [], pre: '', post: '\n' },
    { type: 'prop', name: 'login', value: 'anonymous', pre: '\t', post: '\n' },
    { type: 'prop', name: 'password', value: 'joe@example.com', pre: '\t', post: '\n' },
    { type: 'newline', content: '\n' },
    { type: 'machine', _tokens: [], host: 'ray', pre: '', post: '' },
    { type: 'prop', name: 'login', value: 'demo', pre: ' ', post: '' },
    { type: 'prop', name: 'password', value: 'mypassword', pre: ' ', post: '\n' },
  ])
})

test('macdef', () => {
  const tokens = lex(`# I am a comment
machine mail.google.com
  login joe@gmail.com
  account gmail
  password somethingSecret
# I am another comment

macdef
foo
barbaaz

machine ray login demo password mypassword
`)
  expect(tokens).toEqual([
    { type: 'comment', content: '# I am a comment\n',},
    { type: 'machine', _tokens: [], host: 'mail.google.com', pre: '', post: '\n' },
    { type: 'prop', name: 'login', value: 'joe@gmail.com', pre: '  ', post: '\n' },
    { type: 'prop', name: 'account', value: 'gmail', pre: '  ', post: '\n' },
    { type: 'prop', name: 'password', value: 'somethingSecret', pre: '  ', post: '\n' },
    { type: 'comment', content: '# I am another comment\n'},
    { type: 'newline', content: '\n'},
    { type: 'macdef', content: 'macdef\nfoo\nbarbaaz\n'},
    { type: 'newline', content: '\n'},
    { type: 'machine', _tokens: [], host: 'ray', pre: '', post: '' },
    { type: 'prop', name: 'login', value: 'demo', pre: ' ', post: '' },
    { type: 'prop', name: 'password', value: 'mypassword', pre: ' ', post: '\n' },
  ])
})
