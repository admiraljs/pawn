'use strict';

/* -----------------------------------------------------------------------------
 * dependencies
 * ---------------------------------------------------------------------------*/

// core
const spawn = require('child_process').spawn;
const path = require('path');

// 3rd party
const _ = require('lodash');
const assert = require('chai').assert;
var fs = require('fs-extra');

// lib
const Pawn = require('../lib/index');


/* -----------------------------------------------------------------------------
 * reusable
 * ---------------------------------------------------------------------------*/

const exampleRoot = path.join(__dirname, 'fixtures', 'example');
const localBin = path.join(__dirname, 'fixtures', 'bin');
const pawnOptions = {
  arg: { type: 'string' }
};


/* -----------------------------------------------------------------------------
 * test
 * ---------------------------------------------------------------------------*/

describe('Pawn', function () {

  /* ---------------------------------------------------------------------------
   * core
   * -------------------------------------------------------------------------*/

  describe('core', function () {

    it('Should pass session object to program execute', function () {
      const execute = function (session) {
        assert.isObject(session.plugins);
        assert.isObject(session.options);
        assert.isArray(session.args);
      };

      new Pawn('pawn', { execute: execute }).execute();
    });

    it('Should change process cwd to passed value.', function () {
      const curCwd = process.cwd();
      const pawn =  new Pawn('pawn', { execute: _.noop })

      return pawn.execute({ cwd: exampleRoot }).then(() => {
        assert.notEqual(process.cwd(), curCwd);
        process.chdir(curCwd);
      });
    });

    it('Should parse program options.', function () {      
      const pawn = new Pawn('pawn', {
        options: pawnOptions,
        execute: _.noop
      })

      return pawn.execute({ arg: 'value' })
        .then(() => assert.equal(pawn.session.options.arg, 'value'));
    });

    it('Should pull in environment variables.', function () {
      process.env['PAWN_ARG'] = 'value';
      const pawn = new Pawn('pawn', {
        options: pawnOptions,
        execute: _.noop
      })

      return pawn.execute().then(() => {
        assert.equal(pawn.session.options.arg, 'value');
        delete process.env['TEST_ARG'];
      });
    });

    it('Should pull in values from default config.', function () {
      const pawn = new Pawn('pawn', {
        options: pawnOptions,
        execute: _.noop
      })

      return pawn.execute({ cwd: exampleRoot })
        .then(() => assert.equal(pawn.session.options.arg, 'value'));
    });

    it('Should pull in values from custom config.', function () {
      const pawn = new Pawn('pawn', {
        options: pawnOptions,
        execute: _.noop
      })

      return pawn.execute({ configPath: path.join(exampleRoot, 'custompawnfile.js') })
        .then(() => assert.equal(pawn.session.options.custom, 'value'));
    });

  });


  /* ---------------------------------------------------------------------------
   * plugins
   * -------------------------------------------------------------------------*/

  describe('plugins', function () {

    before(function () {
      this.ogCwd = process.cwd();
      process.chdir(exampleRoot);
    });

    beforeEach(function () {
      this.pawn = new Pawn('pawn', { execute: _.noop });
    });

    after(function () {
      process.chdir(this.ogCwd);
    });

    it('Should load plugins from node_modules.', function () {
      return this.pawn.execute()
        .then(() => assert.isObject(this.pawn.session.plugins['module']));
    });

    it('Should load plugins in args.', function () {
      return this.pawn.execute({ plugins: ['other-module'] })
        .then(() => assert.isObject(this.pawn.session.plugins['otherModule']));
    });

    it('Should load plugins in config.', function () {
      return this.pawn.execute()
        .then(() => assert.isObject(this.pawn.session.plugins['otherModule']));
    });

    it('Should parse plugin options.', function () {
      return this.pawn.execute({ test: 'value' })
        .then(() => assert.equal(this.pawn.session.options['test'], 'value'));
    });

  });


  /* ---------------------------------------------------------------------------
   * cli
   * -------------------------------------------------------------------------*/

  describe('cli', function () {

    before(function () {
      this.ogCwd = process.cwd();
      this.localBinStr = `:${localBin}`;

      process.chdir(exampleRoot);
      process.env.PATH += this.localBinStr;
    });

    after(function () {
      process.chdir(this.ogCwd);
      process.env.PATH.replace(this.localBinStr, '');
    });

    it('Should execute locally installed program.', function (done) {
      const proc = spawn('pawn');
      let output;

      proc.stdout.on('data', (data) =>  output = data.toString());
      proc.on('exit', () => {
        assert.equal(output, 'local');
        done();
      });
    });

    it('Should execute globally installed program.', function (done) {
      const srcPath = 'node_modules/pawn';
      const tmpPath = 'node_modules/_pawn';
      const proc = spawn('pawn');
      let output;

      fs.copySync(srcPath, tmpPath);
      fs.removeSync(srcPath);

      proc.stdout.on('data', (data) =>  output = data.toString());
      proc.on('exit', () => {
        assert.equal(output, 'global');

        fs.copySync(tmpPath, srcPath);
        fs.removeSync(tmpPath);
        done();
      });
    });

  });

});
