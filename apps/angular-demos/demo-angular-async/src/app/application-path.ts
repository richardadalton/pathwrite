// Re-export the shared workflow definition unchanged.
// The path definition has no Angular dependencies — it is a first-class
// framework-agnostic artifact that runs identically in every adapter.
export type { ApplicationData } from "@daltonr/pathwrite-demo-workflow-job-application";
export { INITIAL_DATA, createApplicationPath } from "@daltonr/pathwrite-demo-workflow-job-application";
