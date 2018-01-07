# netrc-parser

[![Greenkeeper badge](https://badges.greenkeeper.io/jdxcode/node-netrc-parser.svg)](https://greenkeeper.io/)
[![CircleCI](https://circleci.com/gh/jdxcode/node-netrc-parser/tree/master.svg?style=svg)](https://circleci.com/gh/jdxcode/node-netrc-parser/tree/master)
[![codecov](https://codecov.io/gh/jdxcode/node-netrc-parser/branch/master/graph/badge.svg)](https://codecov.io/gh/jdxcode/node-netrc-parser)

# API

## Netrc

parses a netrc file

**Examples**

```javascript
const netrc = require('netrc-parser').default
netrc.loadSync() // or netrc.load() for async
netrc.machines['api.heroku.com'].password // get auth token from ~/.netrc
netrc.saveSync() // or netrc.save() for async
```
