/* eslint-disable global-require, no-console */

const { JSDOM } = require('jsdom')
const jquery = require('jquery')

const options = {
  url: 'http://localhost:6876', // URL of NXT remote node
  accountRS: '', // Secret phrase of the current account
  isTestNet: false, // Select testnet or mainnet
  adminPassword: '', // Node admin password
}

const setCurrentAccount = (accountRS, client = global.client) => {
  // eslint-disable-next-line no-param-reassign
  client.account = client.convertRSToNumericAccountFormat(accountRS)
  // eslint-disable-next-line no-param-reassign
  client.accountRS = client.convertNumericToRSAccountFormat(client.account)
  // eslint-disable-next-line no-param-reassign
  client.accountInfo = {} // Do not cache the public key
  client.resetEncryptionState()
}

exports.setCurrentAccount = setCurrentAccount

exports.init = (params) => {
  if (!params) {
    return this
  }
  Object.assign(options, params)
  return this
}

exports.load = (callback) => {
  try {
    // jsdom is necessary to define the window object on which jquery relies
    const { window } = new JSDOM()

    // console.log('Initializing NRS-bridge...')

    // Load the necessary node modules and assign them to the global scope
    // the NXT client wasn't designed with modularity in mind therefore we need
    // to include every 3rd party library function in the global scope
    const jQuery = jquery(window)
    jQuery.growl = (msg) => { console.log(`growl: ${msg}`) } // disable growl messages
    jQuery.t = text => text // Disable the translation functionality
    global.jQuery = jQuery

    // global.$ = jQuery // No longer needed by extensions.js
    global.CryptoJS = require('crypto-js')
    global.async = require('async')
    global.pako = require('pako')
    const jsbn = require('jsbn')
    global.BigInteger = jsbn.BigInteger

    // Support for Webworkers
    if (typeof global.window !== 'undefined') {
      // Browser Renderer Process
      if (!global.window.crypto && !global.window.msCrypto) {
        global.crypto = require('crypto')
      }
    } else if (typeof self !== 'undefined') { // eslint-disable-line no-restricted-globals
      // WebWorker
      global.window = self // eslint-disable-line no-restricted-globals, no-undef
      if (!global.window.crypto && !global.window.msCrypto) {
        global.crypto = require('crypto')
      }
    } else {
      // Nodejs
      global.window = window
      global.window.console = console
    }

    // Mock other objects on which the client depends
    if (typeof global.window.document === 'undefined') global.window.document = {}
    if (typeof global.window.navigator === 'undefined') global.window.navigator = { userAgent: '' }
    global.isNode = true // for code which has to execute differently by node compared to browser

    // Now load some NXT specific libraries into the global scope
    global.NxtAddress = require('./util/nxtaddress')
    global.curve25519 = require('./crypto/curve25519')
    global.curve25519_ = require('./crypto/curve25519_') // eslint-disable-line no-underscore-dangle
    require('./util/extensions') // Add extensions to String.prototype and Number.prototype
    global.converters = require('./util/converters')

    // Now start loading the client itself
    // The main challenge is that in node every JavaScript file is a module with it's own scope
    // however the NXT client relies on a global browser scope which defines the NRS object
    // The idea here is to gradually compose the NRS object by adding functions from each
    // JavaScript file into the existing global.client scope
    global.client = {}
    Object.assign(global.client, require('./nrs.encryption'))
    Object.assign(global.client, require('./nrs.feature.detection'))
    Object.assign(global.client, require('./nrs.transactions.types'))
    Object.assign(global.client, require('./nrs.constants'))
    Object.assign(global.client, require('./nrs.console'))
    Object.assign(global.client, require('./nrs.util'))
    Object.assign(global.client, require('./nrs'))
    Object.assign(global.client, require('./nrs.server'))

    global.client.isTestNet = options.isTestNet
    global.client.getModuleConfig = () => options
    setCurrentAccount(options.accountRS, global.client)

    // Now load the constants locally since we cannot trust the remote node to
    // return the correct constants.
    global.client.processConstants(require('../conf/constants'))
    callback(global.client)
  } catch (err) {
    console.log(err.message || err)
    console.log(err.stack)
    throw err
  }
}
