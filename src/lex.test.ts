import * as fs from 'fs-extra'
import lex from './lex'

fs.mkdirpSync('tmp')

test('bad default order', () => {
  const tokens = lex(`# I am a comment
machine mail.google.com
  login joe@gmail.com
  account gmail
  password somethingSecret
# I am another comment

default
  login anonymous
  password joe@example.com

machine ray login demo password mypassword
`)
  expect(tokens).toEqual([
    { content: '# I am a comment', type: 'comment' },
    { content: '\n    ', type: 'whitespace' },
    { content: 'machine mail.google.com', type: 'machine', host: 'mail.google.com' },
    { content: '\n      ', type: 'whitespace' },
    { name: 'login', type: 'prop', value: 'joe@gmail.com' },
    { content: '\n      ', type: 'whitespace' },
    { name: 'account', type: 'prop', value: 'gmail' },
    { content: '\n      ', type: 'whitespace' },
    { name: 'password', type: 'prop', value: 'somethingSecret' },
    { content: '\n    ', type: 'whitespace' },
    { content: '# I am another comment', type: 'comment' },
    { content: '\n\n    ', type: 'whitespace' },
    { content: 'default', type: 'default' },
    { content: '\n      ', type: 'whitespace' },
    { name: 'login', type: 'prop', value: 'anonymous' },
    { content: '\n      ', type: 'whitespace' },
    { name: 'password', type: 'prop', value: 'joe@example.com' },
    { content: '\n\n    ', type: 'whitespace' },
    { content: 'machine ray', type: 'machine', host: 'ray' },
    { content: ' ', type: 'whitespace' },
    { name: 'login', type: 'prop', value: 'demo' },
    { content: ' ', type: 'whitespace' },
    { name: 'password', type: 'prop', value: 'mypassword' },
    { content: '\n', type: 'whitespace' },
  ])
})
