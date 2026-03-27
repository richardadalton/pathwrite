const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../../..");

const config = getDefaultConfig(projectRoot);

// Watch workspace packages so Metro picks up live source changes
config.watchFolders = [workspaceRoot];

// Resolve workspace packages to their built dist (or source via tsconfig paths)
config.resolver.extraNodeModules = {
  "@daltonr/pathwrite-core": path.resolve(workspaceRoot, "packages/core"),
  "@daltonr/pathwrite-react-native": path.resolve(workspaceRoot, "packages/react-native-adapter"),
};

module.exports = config;
