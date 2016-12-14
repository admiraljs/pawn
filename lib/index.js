'use strict';

/* -----------------------------------------------------------------------------
 * dependencies
 * ---------------------------------------------------------------------------*/

// core
const path = require('path');

// 3rd party
const _ = require('lodash');
const Liftoff = require('liftoff');
const chalk = require('chalk');
const loadPlugins = require('load-plugins');
const Yargs = require('yargs/yargs');
const dargs = require('dargs');

// lib
const pkg = require('../package');
const pawnOptions = require('./options');


/* -----------------------------------------------------------------------------
 * Pawn
 * ---------------------------------------------------------------------------*/

module.exports = class Pawn {

  constructor(name, program) {
    this.name = name;
    this.program = program;

    this.envName = name.toUpperCase(); 
    this.session = {};

    // Hack to ensure `_executeFromCli` is not called when requiring
    // local module version.
    const hasRequiredSelf = module.children.length === 9;
    if (require.main === module.parent && !hasRequiredSelf) {
      this._executeFromCli();
    }
  }

  get usage() {
    let usage = `  ${this.name} [options]`;

    if (!_.isUndefined(this._usage)) {
      usage = this._usage;
    } else if (!_.isUndefined(this.program.usage)) {
      usage =  _.result(this.program, 'usage');
    }

    return this._formatSection('\nUsage', usage);
  }

  set usage(usage) {
    return this._usage = usage;
  }

  get version() {
    if (!_.isUndefined(this._version)) {
      return this._formatSection(this._usage)
    }

    if (_.isUndefined(this.localVersion)) {
      return this._formatVersion(pkg.version);
    }

    return [
      this._formatVersion(pkg.version, 'CLI'),
      this._formatVersion(this.localVersion, 'Local')
    ].join('\n');
  }

  set version(version) {
    return this._version = version;
  }

  get config() {
    const defaultPath = path.join(process.cwd(), `${this.name}file.js`);

    try {
      return require(this.configPath || defaultPath);
    } catch (e) {
      return {};
    }
  }


  /* ---------------------------------------------------------------------------
   * api
   * -------------------------------------------------------------------------*/

  execute(args=[]) {
    return Promise.resolve().then(() => {
      if (!_.isArray(args)) {
        args = dargs(args, { allowCamelCase: true })
      }

      const parsed = this.parse(args)
      const internalKeys = ['_', '$0', 'help', 'version', 'cwd',
        'configPath', 'plugins'];

      this.session.args = parsed._;
      this.session.options = _.omit(parsed, internalKeys);

      return this.program.execute(this.session);
    });
  }

  parse(args) {
    const yargs = Yargs(process.argv.slice(2));
    let result;

    // define usage and base options so next parse contains configPath/cwd
    const programOptions = _.assign({}, pawnOptions, this.program.options);
    yargs.usage(this.usage)
      .group(Object.keys(programOptions), this._formatHeading('Options'))
      .options(programOptions);

    // initial parse required to setup env
    result = yargs.parse(args);
    if (result.cwd) {
      process.chdir(result.cwd);
    }
    if (result.configPath) {
      this.configPath = path.resolve(process.cwd(), result.configPath);
    }

    // define config/env so next parse contains resolved plugins
    yargs
      .config(this.config)
      .env(this.envName);

    // ensure we register plugins prior to instantiating version/help
    result = yargs.parse(args);
    this.session.plugins = this.loadPlugins(result.plugins);

    _.each(this.session.plugins, (plugin, pluginName) => {
      if (!plugin.options) { return; }
      yargs.group(Object.keys(plugin.options || {}), this._formatPluginHeading(pluginName))
        .options(plugin.options);
    });

    // now that all options have been registered we can initialize help
    // and return our configure yargs instance
    return yargs
      .version(this.version)
      .help()
      .parse(args);
  }

  loadPlugins(paths=[]) {
    return _.extend(loadPlugins(`${this.name}-*`, { strip: this.name }) || {},
      loadPlugins(paths));
  }


  /* ---------------------------------------------------------------------------
   * cli
   * -------------------------------------------------------------------------*/

  _executeFromCli() {
    const yargs = Yargs(process.argv.slice(2));
    const parsed = yargs.options(pawnOptions).argv;

    new Liftoff({ name: this.name }).launch(parsed, (env) => {
      const isSelf = env.modulePath === require.main.filename;
      const pawn = !env.modulePath || isSelf ? this : require(env.modulePath);

      // localVersion only needs/can be set from within `executeFromCli`.
      pawn.localVersion = env.modulePackage.version;

      // reintroduce the resolved env args
      const parsedArgs = _.omit(parsed, ['_', '$0']);
      const envArgs = _.pick(env, 'cwd', 'configPath');
      const args = _.extend({}, parsedArgs, envArgs);

      pawn.execute(dargs(args, { allowCamelCase: true }));
    });
  }


  /* ---------------------------------------------------------------------------
   * formatting
   * -------------------------------------------------------------------------*/

  _formatVersion(version, type) {
    return type
      ? `${type} Version: ${version}`
      : version;
  }

  _formatSection(heading) {
    const contents = _.reject(_.tail(arguments), _.isUndefined);

    return [this._formatHeading(heading)]
      .concat(contents)
      .join('\n');
  }

  _formatHeading(heading) {
    return chalk.bold(`${heading.toUpperCase()}:\n`);
  }

  _formatPluginHeading(heading) {
    return this._formatHeading(`  [+] ${_.kebabCase(heading)} Options`)
  }

};
