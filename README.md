# react-firebase-messenger

> Messenger tool based on firebase realtime database

[![NPM](https://img.shields.io/npm/v/react-firebase-messenger.svg)](https://www.npmjs.com/package/react-firebase-messenger) [![JavaScript Style Guide](https://img.shields.io/badge/code_style-standard-brightgreen.svg)](https://standardjs.com)

## Contributing
You can find all the info in [CONTRIBUTING.md](/CONTRIBUTING.md)

## Install

```bash
# If you plan to use this in web / modular firebase API
npm install --save @webscopeio/react-firebase-messenger @webscopeio/react-firebase-messenger-web rambda

# In case you plan on using react-native / compat firebase API
npm install --save @webscopeio/react-firebase-messenger @webscopeio/react-firebase-messenger-native rambda
```

## Usage

```jsx
import React, { Component } from 'react'

import Messenger from 'react-firebase-messenger'

class Example extends Component {
  render () {
    return (
      <Messenger />
    )
  }
}
```


## License

MIT © [Webscope.io](https://github.com/Webscope.io)
