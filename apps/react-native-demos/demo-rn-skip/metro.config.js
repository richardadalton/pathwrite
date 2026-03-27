const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../../..");

const config = getDefaultConfig(projectRoot);

// Watch workspace packages so Metro picks up live source changes
config.watchFolders = [workspaceRoot];

// Resolve workspace packages via source directly
config.resolver.extraNodeModules = {
  "@daltonr/pathwrite-core": path.resolve(workspaceRoot, "packages/core"),
  "@daltonr/pathwrite-react-native": path.resolve(workspaceRoot, "packages/react-native-adapter"),
};

// Only look in the app's own node_modules — not the monorepo root.
// The root has react@18 and react-native@0.76 left over from a previous
// workspace install; including them in nodeModulesPaths causes Metro to
// bundle the wrong (React-18-era) renderer, which crashes with
// "ReactCurrentDispatcher of undefined" under React 19.
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
];

// Belt-and-suspenders: for react, react-native, and scheduler (plus any
// subpath imports like react/jsx-runtime) always resolve to the app's copy,
// never to whatever is sitting in the monorepo root node_modules.
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (
    moduleName === "react"         || moduleName.startsWith("react/") ||
    moduleName === "react-native"  || moduleName.startsWith("react-native/") ||
    moduleName === "scheduler"     || moduleName.startsWith("scheduler/")
  ) {
    try {
      return {
        filePath: require.resolve(moduleName, { paths: [projectRoot] }),
        type: "sourceFile",
      };
    } catch {
      // Module not found in app — fall through to normal resolution
    }
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
