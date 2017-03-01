// @flow
/* globals
   test
   expect
*/

const fs = require('fs-extra')
const Netrc = require('./netrc')

fs.mkdirpSync('tmp')

test('it load the netrc file', () => {
  const f = `tmp/netrc`
  fs.writeFileSync(f, `machine api.dickeyxxx.com
  login jeff@foo.com
  password myapikey`)
  const netrc = new Netrc(f)

  expect(netrc.machines['api.dickeyxxx.com'].password).toEqual('myapikey')
})
