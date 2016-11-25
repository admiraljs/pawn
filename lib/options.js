'use strict';

/* -----------------------------------------------------------------------------
 * options
 * ---------------------------------------------------------------------------*/

module.exports = {

  help: {
    type: 'boolean',
    description: 'Show this help.'
  },
  version: {
    type: 'boolean',
    description: 'Print the global and local versions.'
  },
  cwd: {
    type: 'string',
    description: 'Change the current working directory.'
  },
  configPath: {
    type: 'string',
    description: 'Path to config file.'
  },
  plugins: {
    type: 'array',
    description: 'Additional plugins to include.'
  }

};
