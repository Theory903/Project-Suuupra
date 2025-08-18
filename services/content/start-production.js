#!/usr/bin/env node

// Production startup script for Content Service
const moduleAlias = require('module-alias');

// Register module aliases for production
moduleAlias.addAliases({
  '@': __dirname + '/dist'
});

// Load the compiled server
require('./dist/server.js');