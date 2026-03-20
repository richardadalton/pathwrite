import { CommonModule } from "@angular/common";
import { Component, inject } from "@angular/core";
import { takeUntilDestroyed, toSignal } from "@angular/core/rxjs-interop";
import {
  PathDefinition,
  PathEvent
} from "@daltonr/pathwrite-core";
import { PathFacade } from "@daltonr/pathwrite-angular";

@Component({
  selector: "app-root",
  standalone: true,
  imports: [CommonModule],
  templateUrl: "./app.component.html",
  styleUrl: "./app.component.css",
  providers: [PathFacade]
})
export class AppComponent {
  public readonly title = "Pathwrite Angular Demo";
  public readonly eventLog: string[] = [];

  protected readonly facade = inject(PathFacade);
  public readonly snapshot = toSignal(this.facade.state$, { initialValue: null });

  private readonly mainPath: PathDefinition = {
    id: "create-course",
    steps: [
      { id: "course-details", title: "Course Details" },
      {
        id: "lesson-details",
        title: "Lesson Details",
        onSubPathComplete: (subPathId, data) => {
          if (subPathId === "new-lesson") {
            this.eventLog.unshift(`sub result copied: lesson=${String(data.lesson)}`);
            return { lesson: data.lesson };
          }
        }
      },
      { id: "review", title: "Review" }
    ]
  };

  private readonly subPath: PathDefinition = {
    id: "new-lesson",
    steps: [
      {
        id: "lesson-name",
        title: "Lesson Name",
        onEnter: () => ({ lesson: "Intro" })
      }
    ]
  };

  public constructor() {
    this.facade.events$.pipe(takeUntilDestroyed()).subscribe((event) => {
      this.eventLog.unshift(this.formatEvent(event));
      this.eventLog.splice(20);
    });
  }

  public startMain(): void {
    this.facade.start(this.mainPath, { owner: "angular-demo" });
  }

  public startSub(): void {
    this.facade.startSubPath(this.subPath);
  }

  public next(): void {
    this.facade.next();
  }

  public previous(): void {
    this.facade.previous();
  }

  public cancel(): void {
    this.facade.cancel();
  }

  private formatEvent(event: PathEvent): string {
    if (event.type === "stateChanged") {
      return `stateChanged -> ${event.snapshot.pathId}/${event.snapshot.stepId}`;
    }
    if (event.type === "resumed") {
      return `resumed -> ${event.resumedPathId} from ${event.fromSubPathId}`;
    }
    if (event.type === "completed") {
      return `completed -> ${event.pathId} ${JSON.stringify(event.data)}`;
    }
    return `cancelled -> ${event.pathId} ${JSON.stringify(event.data)}`;
  }
}
