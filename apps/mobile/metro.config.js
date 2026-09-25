const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// Monorepo Support: Watch the entire workspace and resolve modules correctly
config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

// Force Firebase core packages to resolve to the workspace root
// This prevents multiple internal registries from conflicting
const rootNodeModules = path.resolve(workspaceRoot, 'node_modules');
config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,
  'firebase': path.resolve(rootNodeModules, 'firebase'),
  '@firebase/app': path.resolve(rootNodeModules, '@firebase/app'),
  '@firebase/auth': path.resolve(rootNodeModules, '@firebase/auth'),
};

config.resolver.sourceExts.push('cjs');
config.resolver.unstable_enablePackageExports = false;

module.exports = config;
