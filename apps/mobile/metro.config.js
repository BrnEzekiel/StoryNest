const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];

config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

config.resolver.disableHierarchicalLookup = true;

// Force ALL Firebase-related packages to use the LOCAL node_modules.
// This prevents multiple internal registries from co-existing and conflicting.
const firebasePackages = [
  'firebase',
  '@firebase/app',
  '@firebase/auth',
  '@firebase/component',
  '@firebase/util',
];

firebasePackages.forEach(pkg => {
  config.resolver.extraNodeModules[pkg] = path.resolve(projectRoot, 'node_modules', pkg);
});

config.resolver.extraNodeModules['buffer'] = require.resolve('buffer');

config.resolver.sourceExts.push('cjs');

module.exports = config;
