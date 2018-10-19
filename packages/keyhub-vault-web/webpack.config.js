'use strict'

const path = require('path')

const { fork } = require('child_process')

// eslint-disable-next-line import/no-extraneous-dependencies
const webpack = require('webpack')
const CopyWebpackPlugin = require('copy-webpack-plugin')
// eslint-disable-next-line import/no-extraneous-dependencies
const babelPluginObjectRestSpread = require('@babel/plugin-proposal-object-rest-spread')

module.exports = env => ({
  mode: 'production',
  devtool: 'nosources-source-map',
  optimization: {
    minimize: true,
  },
  entry: {
    'whatwg-fetch': 'whatwg-fetch',
    'abortcontroller-polyfill': 'abortcontroller-polyfill/dist/polyfill-patch-fetch',
    main: './src/main.js',
  },
  output: {
    filename: '[name].bundle.js',
    path: path.resolve(__dirname, 'dist', 'js'),
    publicPath: '/js/',
  },
  plugins: [
    // new webpack.SourceMapDevToolPlugin({
    //   filename: '[file].map',
    //   publicPath: 'https://localhost:5500/js/',
    //   fileContext: '',
    // }),
    new webpack.DefinePlugin({
      'process.env': {
        NODE_ENV: JSON.stringify('production'),
        APP_ENV: JSON.stringify('browser'),
        STAGE: JSON.stringify('sandbox'),
      },
    }),
    {
      // Run a script after compilation
      apply: compiler =>
        compiler.hooks.afterEmit.tap('AfterEmitPlugin', compilation => {
          process.stdout.write(`FullHash: ${compilation.fullHash}\n`)
          const opts = {
            env: { CODESIGN_PASSPHRASE: env.CODESIGN_PASSPHRASE },
            silent: true,
          }
          const child = fork('src/openpgp.sign.js', ['./dist/js/main.bundle.js'], opts)
          // const child = spawn('node', ['src/openpgp.sign.js', './dist/js/main.bundle.js'])
          child.stdout.on('data', data => process.stdout.write(data))
          child.stderr.on('data', data => process.stderr.write(data))
        }),
    },
    new CopyWebpackPlugin(
      [
        {
          from: path.resolve(__dirname, 'public/'),
          to: path.resolve(__dirname, 'dist/'),
          force: true,
        },
      ],
      {
        ignore: ['*.bak', '*.bak.html'],
      }
    ),
  ],
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /(node_modules|bower_components)/,
        use: {
          // See: https://medium.com/@zural143/basic-webpack-4-and-es5-to-es6-transpiler-using-babel-dc66e72c86c6
          loader: 'babel-loader',
          options: {
            presets: ['@babel/preset-env'],
            // eslint-disable-next-line global-require
            plugins: [babelPluginObjectRestSpread],
          },
        },
      },
      {
        test: /\.worker\.js$/,
        use: {
          loader: 'worker-loader',
          options: { inline: true, fallback: false },
        },
      },
    ],
  },
  // externals: {
  //   jquery: 'jQuery',
  //   jsdom: 'jsdom',
  //   'node-fetch': {
  //     commonjs: 'node-fetch',
  //     amd: 'node-fetch',
  //     root: 'fetch',
  //   },
  // },
  // node: {
  //   global: true,
  //   // Buffer: true,
  //   // setImmediate: true,
  //   // process: false,
  //   // net: 'mock',
  //   // tls: 'mock',
  //   // fs: 'empty',
  //   // child_process: 'empty',
  // },
})