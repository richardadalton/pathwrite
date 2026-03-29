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
  "@daltonr/pathwrite-demo-workflow-job-application": path.resolve(workspaceRoot, "apps/shared-workflows/demo-workflow-job-application"),
};

// Only look in the app's own node_modules — not the monorepo root.
// The root has react@18 and react-native@0.76 left over from a previous
// workspace install; including them in nodeModulesPaths causes Metro to
// bundle the wrong (React-18-era) renderer, which crashes with
// "ReactCurrentDispatcher of undefined" under React 19.
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
];

// Belt-and-suspenders: for react, react-dom, react-native, and scheduler
// (plus any subpath imports) always resolve to the app's copy, never to
// whatever is sitting in the monorepo root node_modules.
// react-dom must be pinned alongside react — the root has react-dom@18
// which is incompatible with this app's react@19 and causes a
// "ReactCurrentBatchConfig undefined" crash at runtime.
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (
    moduleName === "react"         || moduleName.startsWith("react/") ||
    moduleName === "react-dom"     || moduleName.startsWith("react-dom/") ||
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
