# netrc-parser

[![CircleCI](https://circleci.com/gh/dickeyxxx/node-netrc-parser.svg?style=svg)](https://circleci.com/gh/dickeyxxx/node-netrc-parser)
[![codecov](https://codecov.io/gh/dickeyxxx/node-netrc-parser/branch/master/graph/badge.svg)](https://codecov.io/gh/dickeyxxx/node-netrc-parser)

# API

## Netrc

parses a netrc file

**Examples**

```javascript
const {Netrc} = require('netrc-parser')
const netrc = new Netrc()
netrc.loadSync() // or netrc.load() for async
netrc.machines['api.heroku.com'].password // get auth token from ~/.netrc
netrc.saveSync() // or netrc.save() for async
```
