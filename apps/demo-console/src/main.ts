import { PathFacade } from "@pathwrite/angular-adapter";
import { PathDefinition } from "@pathwrite/core";

const facade = new PathFacade();

facade.events$.subscribe((event) => {
  if (event.type === "stateChanged") {
    console.log(`stateChanged -> ${event.snapshot.pathId}/${event.snapshot.stepId}`);
  }
  if (event.type === "resumed") {
    console.log(`resumed -> ${event.resumedPathId} from ${event.fromSubPathId}`);
  }
  if (event.type === "completed") {
    console.log(`completed -> ${event.pathId}`, event.args);
  }
  if (event.type === "cancelled") {
    console.log(`cancelled -> ${event.pathId}`, event.args);
  }
});

const mainPath: PathDefinition = {
  id: "create-course",
  steps: [
    { id: "course-details" },
    {
      id: "lesson-details",
      onSubPathComplete: (subPathId, data) => {
        if (subPathId === "new-lesson") {
          return { lesson: data.lesson };
        }
      }
    },
    { id: "review" }
  ]
};

const subPath: PathDefinition = {
  id: "new-lesson",
  steps: [
    {
      id: "lesson-name",
      onEnter: () => ({ lesson: "Intro" })
    }
  ]
};

facade.start(mainPath, { owner: "demo" });
facade.next();
facade.startSubPath(subPath);
facade.next();
facade.next();
facade.next();
