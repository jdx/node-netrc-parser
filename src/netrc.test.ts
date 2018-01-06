import * as fs from 'fs-extra'
import { Netrc } from './netrc'

fs.mkdirpSync('tmp')

process.env.NETRC_PARSER_DEBUG = '1'

test('can read system netrc', () => {
  let netrc = new Netrc()
  netrc.loadSync()
  expect(netrc.machines).toBeTruthy()
})

test('can read system netrc async', async () => {
  let netrc = new Netrc()
  await netrc.load()
  expect(netrc.machines).toBeTruthy()
})

test('bad default order', async () => {
  const f = `tmp/netrc`
  fs.writeFileSync(
    f,
    `# I am a comment
    machine mail.google.com
      login joe@gmail.com
      account gmail
      password somethingSecret
    # I am another comment

    default
      login anonymous
      password joe@example.com

    machine ray login demo password mypassword
`,
  )
  const netrc = new Netrc(f)
  await netrc.load()

  expect(netrc.machines['mail.google.com'].login).toEqual('joe@gmail.com')
  expect(netrc.machines['mail.google.com'].account).toEqual('gmail')
  expect(netrc.machines['mail.google.com'].password).toEqual('somethingSecret')

  expect(netrc.machines['ray'].login).toEqual('demo')
  expect(netrc.machines['ray'].password).toEqual('mypassword')
})

test('it loads the netrc file with comments', () => {
  const f = `tmp/netrc`
  fs.writeFileSync(
    f,
    `machine api.dickeyxxx.com # foo
  login jeff@foo.com
  password myapikey`,
  )
  const netrc = new Netrc(f)
  netrc.loadSync()

  expect(netrc.machines['api.dickeyxxx.com'].login).toEqual('jeff@foo.com')
  expect(netrc.machines['api.dickeyxxx.com'].password).toEqual('myapikey')
})

test('default only', () => {
  const f = `tmp/netrc`
  fs.writeFileSync(
    f,
    `# this is my netrc with only a default
default
  login ld # this is my default username
  password pdcom
  password myapikey`,
  )
  const netrc = new Netrc(f)
  netrc.loadSync()

  expect(netrc.default!.login).toEqual('ld')
  expect(netrc.default!.password).toEqual('pdcom')
})

test('good', () => {
  const f = `tmp/netrc`
  fs.writeFileSync(
    f,
    `# I am a comment
machine mail.google.com
\tlogin joe@gmail.com
  account justagmail #end of line comment with trailing space
  password somethingSecret
 # I am another comment

macdef allput
put src/*

macdef allput2
  put src/*
put src2/*

machine ray login demo password mypassword

machine weirdlogin login uname password pass#pass

default
  login anonymous
  password joe@example.com
`,
  )
  const netrc = new Netrc(f)
  netrc.loadSync()

  expect(netrc.machines['mail.google.com'].login).toEqual('joe@gmail.com')
  expect(netrc.machines['mail.google.com'].account).toEqual('justagmail')
  expect(netrc.machines['mail.google.com'].password).toEqual('somethingSecret')
})

const gpgEncrypted = `-----BEGIN PGP MESSAGE-----
Version: GnuPG v2

hIwD1rghrTHCzmIBA/9JIhd9NaY64C7QMIOa8KV/e97Hs9he6EAHdhDUMeb6/5HU
KaxHX77rHjF0TxNUumQrMTfp+EjKzjuDqTxrv0TnpqB8JYhwLqVCGPM+OvjNlILy
/EdDpkqEaKqM4KArRQjE4n8ifAi5CbldI/mO+oBvHTq5StJDNEhE+xMjRzGJ29LA
VQEWWdR291Z8Y0cbZwX2DmGsPuo6tX0JeWQlG9ms8966wVk2LKFuUyynHBVjcsjv
REKnai8ZixhaKRBE/NOiLo/Eqp6nI7/i8YU+mYV0rFljpLSnQ7LJcgw3ItyKXQ9F
ws16ShzCIGM11JFySwb0NoV6H9VSakfu2LN1RpKFD2lvc6i75N0NWf0Jh/mKHFz+
ugLe8sik/Zu8grrxtOVxfgtjFEQvjT3u02D4pDQP1lNp7SjVfqUC+XnxWQC+SQVC
kKvydwB3oZqwHp6jpgLVTxjTfhm1vNTB7gAbgNOF63yQ/Wmrn3Pe38huh+TIKJCy
pQgBLBordnqQajWt1ao+8AZiAsOooF0wJqm/mH1Og5/ADuhvZEQ=
=PGaL
-----END PGP MESSAGE-----`

test('good.gpg sync', () => {
  const f = `tmp/netrc.gpg`
  fs.writeFileSync(f, gpgEncrypted)
  const netrc = new Netrc(f)
  netrc.loadSync()

  expect(netrc.machines['mail.google.com'].login).toEqual('joe@gmail.com')
  expect(netrc.machines['mail.google.com'].account).toEqual('justagmail')
  expect(netrc.machines['mail.google.com'].password).toEqual('somethingSecret')

  netrc.saveSync()
  expect(fs.readFileSync(f, { encoding: 'utf8' })).toContain('-----BEGIN PGP MESSAGE-----')
})

test('good.gpg', async () => {
  const f = `tmp/netrc.gpg`
  await fs.writeFile(f, gpgEncrypted)
  const netrc = new Netrc(f)
  await netrc.load()

  expect(netrc.machines['mail.google.com'].login).toEqual('joe@gmail.com')
  expect(netrc.machines['mail.google.com'].account).toEqual('justagmail')
  expect(netrc.machines['mail.google.com'].password).toEqual('somethingSecret')

  await netrc.save()
  expect(fs.readFileSync(f, { encoding: 'utf8' })).toContain('-----BEGIN PGP MESSAGE-----')
})

test('invalid', () => {
  expect.assertions(1)
  const f = `tmp/netrc`
  fs.writeFileSync(f, 'machine')
  try {
    let netrc = new Netrc(f)
    netrc.loadSync()
  } catch (err) {
    expect(err.message).toContain('Unexpected character during netrc parsing')
  }
})

test('invalid async', async () => {
  expect.assertions(1)
  const f = `tmp/netrc`
  fs.writeFileSync(f, 'machine')
  try {
    let netrc = new Netrc(f)
    await netrc.load()
  } catch (err) {
    expect(err.message).toContain('Unexpected character during netrc parsing')
  }
})

test('saving', () => {
  const f = `tmp/netrc`
  fs.writeFileSync(
    f,
    `# I am a comment
machine mail.google.com
\tlogin joe@gmail.com
  password somethingSecret #end of line comment with trailing space
 # I am another comment

macdef allput
put src/*

macdef allput2
  put src/*
put src2/*

machine ray login demo password mypassword

machine weirdlogin login uname password pass#pass

default
  login anonymous
  password joe@example.com
`,
  )
  const netrc = new Netrc(f)
  netrc.loadSync()
  netrc.machines['mail.google.com'].login = 'joe2@gmail.com'
  netrc.machines['mail.google.com'].account = 'justanaccount'
  netrc.machines.ray.login = 'demo2'
  netrc.machines.ray.account = 'newaccount'
  netrc.machines['new'] = { login: 'myuser', password: 'mypass' }
  netrc.saveSync()

  expect(fs.readFileSync(f, 'utf8')).toEqual(`# I am a comment
machine mail.google.com
\taccount justanaccount
\tlogin joe2@gmail.com
  password somethingSecret #end of line comment with trailing space
 # I am another comment

macdef allput
put src/*

macdef allput2
  put src/*
put src2/*

machine ray account newaccount login demo2 password mypassword

machine weirdlogin login uname password pass#pass

default
  login anonymous
  password joe@example.com

machine new
  login myuser
  password mypass
`)
})

test('adding a machine should create a new entry', async () => {
  const f = `tmp/netrc`

  const beforeSave = `machine api.dickeyxxx.com # foo
  login jeff@foo.com
  password myapikey`

  fs.writeFileSync(f, beforeSave)

  const netrc = new Netrc(f)
  await netrc.load()
  netrc.machines['foo.bar.com'] = { login: 'foo@bar.com', password: 'foopassword' }
  await netrc.save()

  const afterSave = `machine api.dickeyxxx.com # foo
  login jeff@foo.com
  password myapikey

machine foo.bar.com
  login foo@bar.com
  password foopassword\n`

  expect(fs.readFileSync(f, 'utf8')).toEqual(afterSave)
})

test('removing a machine', async () => {
  const f = `tmp/netrc`

  const beforeSave = `machine api.dickeyxxx.com # foo
  login jeff@foo.com
  password myapikey
machine foo.bar.com
  password foopassword
  login foo@bar.com
`

  fs.writeFileSync(f, beforeSave)

  const netrc = new Netrc(f)
  await netrc.load()
  delete netrc.machines['api.dickeyxxx.com']
  await netrc.save()

  const afterSave = `machine foo.bar.com
  password foopassword
  login foo@bar.com\n`

  expect(fs.readFileSync(f, 'utf8')).toEqual(afterSave)
})

test('setting machine to undefined', async () => {
  const f = `tmp/netrc`

  const beforeSave = `machine api.dickeyxxx.com # foo
  login jeff@foo.com
  password myapikey
machine foo.bar.com
  password foopassword
  login foo@bar.com
`

  fs.writeFileSync(f, beforeSave)

  const netrc = new Netrc(f)
  await netrc.load()
  netrc.machines['api.dickeyxxx.com'] = undefined as any
  await netrc.save()

  const afterSave = `machine foo.bar.com
  password foopassword
  login foo@bar.com\n`

  expect(fs.readFileSync(f, 'utf8')).toEqual(afterSave)
})

test('empty netrc', async () => {
  const f = `tmp/netrc`

  const beforeSave = ''

  fs.writeFileSync(f, beforeSave)

  const netrc = new Netrc(f)
  await netrc.load()
  netrc.machines['api.dickeyxxx.com'] = { login: 'foo', password: 'bar' }
  netrc.machines['foo.dickeyxxx.com'] = { login: 'foo2', password: 'bar2' }
  await netrc.save()

  const afterSave = `machine api.dickeyxxx.com
  login foo
  password bar

machine foo.dickeyxxx.com
  login foo2
  password bar2
`

  expect(fs.readFileSync(f, 'utf8')).toEqual(afterSave)
})

test('set existing', async () => {
  const f = `tmp/netrc`

  const beforeSave = 'machine foo password p login u'

  fs.writeFileSync(f, beforeSave)

  const netrc = new Netrc(f)
  await netrc.load()
  netrc.machines['foo'] = { login: 'foo', password: 'bar' }
  await netrc.save()

  const afterSave = `machine foo
  login foo
  password bar
`

  expect(fs.readFileSync(f, 'utf8')).toEqual(afterSave)
})

test('set new prop', async () => {
  const f = `tmp/netrc`

  const beforeSave = 'machine foo password p login u'

  fs.writeFileSync(f, beforeSave)

  const netrc = new Netrc(f)
  await netrc.load()
  netrc.machines['foo'].login = 'uu'
  netrc.machines['foo'].account = 'bar'
  netrc.machines['foo'].password = undefined
  expect('foo' in netrc.machines).toEqual(true)
  expect('bar' in netrc.machines).toEqual(false)
  delete netrc.machines['bar']
  await netrc.save()

  const afterSave = `machine foo account bar login uu
`

  expect(fs.readFileSync(f, 'utf8')).toEqual(afterSave)
})

test('file not found', async () => {
  const f = `tmp/netrc`
  fs.removeSync(f)
  const netrc = new Netrc(f)
  await netrc.load()
  netrc.machines['foo'] = { login: 'u', password: 'p' }
  await netrc.save()
  const afterSave = `machine foo\n  login u\n  password p\n`
  expect(fs.readFileSync(f, 'utf8')).toEqual(afterSave)
})

test('file not found sync', () => {
  const f = `tmp/netrc`
  fs.removeSync(f)
  const netrc = new Netrc(f)
  netrc.loadSync()
  netrc.machines['foo'] = { login: 'u', password: 'p' }
  netrc.saveSync()
  const afterSave = `machine foo\n  login u\n  password p\n`
  expect(fs.readFileSync(f, 'utf8')).toEqual(afterSave)
})

test('default setting', () => {
  const f = `tmp/netrc`
  fs.removeSync(f)
  const netrc = new Netrc(f)
  netrc.loadSync()
  netrc.default = { login: 'u', password: 'p' }
  netrc.saveSync()
  const afterSave = `\ndefault\n  login u\n  password p\n`
  expect(fs.readFileSync(f, 'utf8')).toEqual(afterSave)
  netrc.default = undefined
  netrc.saveSync()
  expect(fs.readFileSync(f, 'utf8')).toEqual(`\n`)
})
