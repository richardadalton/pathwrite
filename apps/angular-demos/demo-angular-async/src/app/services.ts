import { Injectable } from "@angular/core";
import { MockApplicationServices as Base } from "@daltonr/pathwrite-demo-workflow-job-application";

// Re-export types so step components can import them from here.
export type { ApplicationServices, Role, EligibilityResult } from "@daltonr/pathwrite-demo-workflow-job-application";

// Wrap the shared mock in Angular's DI system.
// The shared class has zero framework dependencies; the only Angular-specific
// thing is this @Injectable decorator that registers it in the root injector.
@Injectable({ providedIn: "root" })
export class MockApplicationServices extends Base {}
