import { PathDefinition, PathEngine } from "@daltonr/pathwrite-core";

const engine = new PathEngine();

engine.subscribe((event) => {
  if (event.type === "stateChanged") {
    console.log(`stateChanged -> ${event.snapshot.pathId}/${event.snapshot.stepId}`);
  }
  if (event.type === "resumed") {
    console.log(`resumed -> ${event.resumedPathId} from ${event.fromSubPathId}`);
  }
  if (event.type === "completed") {
    console.log(`completed -> ${event.pathId}`, event.data);
  }
  if (event.type === "cancelled") {
    console.log(`cancelled -> ${event.pathId}`, event.data);
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

async function main() {
  await engine.start(mainPath, { owner: "demo" });
  await engine.next();                // course-details → lesson-details
  await engine.startSubPath(subPath); // push sub-path
  await engine.next();                // sub-path completes → resume parent at lesson-details
  await engine.next();                // lesson-details → review
  await engine.next();                // review → path completes
}

main();
