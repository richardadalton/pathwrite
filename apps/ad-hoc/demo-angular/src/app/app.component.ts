import { Component } from "@angular/core";
import { PathDefinition, PathData, PathEvent } from "@daltonr/pathwrite-core";
import { PathShellComponent, PathStepDirective } from "@daltonr/pathwrite-angular/shell";

@Component({
  selector: "app-root",
  standalone: true,
  imports: [PathShellComponent, PathStepDirective],
  templateUrl: "./app.component.html",
  styleUrl: "./app.component.css"
})
export class AppComponent {
  public readonly title = "Pathwrite Angular Demo";

  // Local form state — two-way synced with the wizard engine via setData()
  public title_ = "";
  public description = "";
  public notify = true;
  public lessonName = "";

  protected isCompleted = false;
  protected completedData: PathData | null = null;
  protected readonly eventLog: string[] = [];

  // ── Sub-path: Add a lesson ──────────────────────────────────────────────
  protected readonly addLessonPath: PathDefinition = {
    id: "new-lesson",
    title: "Add Lesson",
    steps: [
      {
        id: "lesson-name",
        title: "Lesson Name",
        onEnter: ({ isFirstEntry }) =>
          isFirstEntry ? { lessonName: "" } : undefined,
        canMoveNext: ({ data }) =>
          !!(data["lessonName"] as string)?.trim(),
        validationMessages: ({ data }) =>
          (data["lessonName"] as string)?.trim()
            ? []
            : ["Lesson name is required."]
      }
    ]
  };

  // ── Main path: Create a Course ──────────────────────────────────────────
  protected readonly coursePath: PathDefinition = {
    id: "create-course",
    title: "Create a Course",
    steps: [
      {
        id: "course-details",
        title: "Course Details",
        onEnter: ({ isFirstEntry }) =>
          isFirstEntry
            ? { title: "", description: "", notify: true, lessons: [] }
            : undefined,
        canMoveNext: ({ data }) =>
          !!(data["title"] as string)?.trim() &&
          !!(data["description"] as string)?.trim(),
        validationMessages: ({ data }) => {
          const msgs: string[] = [];
          if (!(data["title"] as string)?.trim())
            msgs.push("Course title is required.");
          if (!(data["description"] as string)?.trim())
            msgs.push("Course description is required.");
          return msgs;
        }
      },
      {
        id: "lesson-details",
        title: "Lessons",
        onSubPathComplete: (subPathId, subData, ctx) => {
          if (subPathId === "new-lesson" && subData["lessonName"]) {
            const existing = [...((ctx.data["lessons"] as string[]) ?? [])];
            return { lessons: [...existing, subData["lessonName"] as string] };
          }
        }
      },
      {
        id: "review",
        title: "Review & Publish"
      }
    ]
  };

  // ── Output handlers ─────────────────────────────────────────────────────
  protected onComplete(data: PathData): void {
    this.completedData = data;
    this.isCompleted = true;
  }

  protected onPathEvent(event: PathEvent): void {
    this.eventLog.unshift(this.formatEvent(event));
    if (this.eventLog.length > 20) this.eventLog.length = 20;
  }

  protected restart(): void {
    this.isCompleted = false;
    this.completedData = null;
    this.title_ = "";
    this.description = "";
    this.notify = true;
    this.lessonName = "";
    this.eventLog.length = 0;
  }

  private formatEvent(event: PathEvent): string {
    if (event.type === "stateChanged") {
      // StateChangeCause tells us what triggered the change (new in v0.5.0)
      return `stateChanged(${event.cause}) → ${event.snapshot.pathId}/${event.snapshot.stepId}`;
    }
    if (event.type === "resumed") {
      return `resumed → ${event.resumedPathId} (from ${event.fromSubPathId})`;
    }
    if (event.type === "completed") {
      return `completed → ${event.pathId}`;
    }
    return `cancelled → ${event.pathId}`;
  }
}
