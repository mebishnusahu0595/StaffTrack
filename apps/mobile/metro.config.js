/* eslint-env node */
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

// Find the project and workspace root
const projectRoot = __dirname;
// This can be replaced with `find-up` or a similar library
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// 1. Watch all files within the monorepo
config.watchFolders = [workspaceRoot];

// 2. Let Metro know where to resolve workspace packages first.
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

// 3. Block volatile and irrelevant directories from being watched
config.resolver.blockList = [
  /.*[\\\/]apps[\\\/]admin[\\\/]\.next[\\\/].*/,
  /.*[\\\/]backend[\\\/].*/,
];

// 4. pnpm keeps package dependencies inside symlinked package folders.
config.resolver.disableHierarchicalLookup = false;
config.resolver.unstable_enableSymlinks = true;

module.exports = config;
