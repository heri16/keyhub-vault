'use strict'

const loader = require('../js/nrs.node.bridge')

loader.config = require('../conf/secrets.json')

const { config } = loader

loader.init({
  url: config.url,
  secretPhrase: config.secretPhrase,
  isTestNet: config.isTestNet,
  adminPassword: config.adminPassword,
})

module.exports = loader
