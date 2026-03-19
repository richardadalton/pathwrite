import { WizardFacade } from "@pathwrite/angular-adapter";
import { WizardDefinition } from "@pathwrite/core";

const facade = new WizardFacade();

facade.events$.subscribe((event) => {
  if (event.type === "stateChanged") {
    console.log(`stateChanged -> ${event.snapshot.wizardId}/${event.snapshot.stepId}`);
  }
  if (event.type === "resumed") {
    console.log(`resumed -> ${event.resumedWizardId} from ${event.fromSubWizardId}`);
  }
  if (event.type === "completed") {
    console.log(`completed -> ${event.wizardId}`, event.args);
  }
  if (event.type === "cancelled") {
    console.log(`cancelled -> ${event.wizardId}`, event.args);
  }
});

const mainWizard: WizardDefinition = {
  id: "create-course",
  steps: [
    { id: "course-details" },
    {
      id: "lesson-details",
      onResumeFromSubWizard: (subWizardId, args) => {
        if (subWizardId === "new-lesson") {
          return { lesson: args.lesson };
        }
      }
    },
    { id: "review" }
  ]
};

const subWizard: WizardDefinition = {
  id: "new-lesson",
  steps: [
    {
      id: "lesson-name",
      onVisit: () => ({ lesson: "Intro" })
    }
  ]
};

facade.start(mainWizard, { owner: "demo" });
facade.next();
facade.startSubWizard(subWizard);
facade.next();
facade.next();
facade.next();
