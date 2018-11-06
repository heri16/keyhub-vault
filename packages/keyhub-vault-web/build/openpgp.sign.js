'use strict'

const fs = require('fs')

const openpgp = require('openpgp') // use as CommonJS, AMD, ES6 module or via window.openpgp

const hkp = new openpgp.HKP('https://pgp.mit.edu')

openpgp.initWorker({ path: 'openpgp.worker.js' }) // set the relative web worker path

const FILEPATH_TO_KEYPAIR = '../../keyhub-vault-codesign-pgp'
const FILEPATH_TO_SIGN = process.argv[2] || './dist/js/main.bundle.js'

const options = {
  userIds: [{ name: 'KeyHub Vault Codesign', email: 'codesign@vault.keyhub.app' }], // support multiple user IDs
  curve: 'ed25519',
  passphrase: process.env.CODESIGN_PASSPHRASE,
}

if (!options.passphrase) {
  console.warn('Skip code-signing as env.CODESIGN_PASSPHRASE not provided') // eslint-disable-line no-console
} else {
  // Generate new keyPair
  openpgp
    .generateKey(options)
    .then(key => {
      if (
        fs.existsSync(`${FILEPATH_TO_KEYPAIR}.key.asc`) ||
        fs.existsSync(`${FILEPATH_TO_KEYPAIR}.pub.asc`)
      )
        return null
      console.info('Keypair generated!') // eslint-disable-line no-console
      return hkp.upload(key.publicKeyArmored).then(() => key)
    })
    .then(key => {
      if (key) {
        console.info('PublicKey uploaded!') // eslint-disable-line no-console
        fs.writeFileSync(`${FILEPATH_TO_KEYPAIR}.key.asc`, key.privateKeyArmored)
        fs.writeFileSync(`${FILEPATH_TO_KEYPAIR}.pub.asc`, key.publicKeyArmored)
        if (key.revocationCertificate)
          fs.writeFileSync(`${FILEPATH_TO_KEYPAIR}.revoke.asc`, key.revocationCertificate)
      }

      return fs.readFileSync(`${FILEPATH_TO_KEYPAIR}.key.asc`, 'utf8')
    })
    .then(privkey => {
      const privKeyObj = openpgp.key.readArmored(privkey).keys[0]
      return privKeyObj.decrypt(options.passphrase).then(() => privKeyObj)
    })
    .then(privKeyObj => {
      const opts = {
        data: fs.readFileSync(FILEPATH_TO_SIGN, 'utf8'),
        privateKeys: [privKeyObj],
        detached: true,
      }

      console.info('Code-signing...') // eslint-disable-line no-console
      return openpgp.sign(opts)
    })
    .then(signed => {
      console.info('signed:', FILEPATH_TO_SIGN) // eslint-disable-line no-console
      fs.writeFileSync(`${FILEPATH_TO_SIGN}.sig.asc`, signed.signature)
      return true
    })
    .catch(err => {
      console.error('cannot sign:', err) // eslint-disable-line no-console
    })
}

// eslint-disable-next-line import/no-extraneous-dependencies
const ssri = require('ssri')

const fileListToSRI = [
  'dist/js/openpgp.worker.bundle.js',
  'public/index.js',
  'public/css/styles.css',
  'public/css/main.css',
]

Promise.all(
  fileListToSRI.map(filepath =>
    ssri.fromStream(fs.createReadStream(filepath), { algorithms: ['sha384'] }).then(sri => {
      console.info(`SRI of ${filepath}:`, sri.toString()) // eslint-disable-line no-console
    })
  )
).catch(err => {
  console.error('cannot hash:', err) // eslint-disable-line no-console
})