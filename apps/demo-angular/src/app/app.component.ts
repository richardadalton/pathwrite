import { CommonModule } from "@angular/common";
import { Component, inject } from "@angular/core";
import { takeUntilDestroyed, toSignal } from "@angular/core/rxjs-interop";
import {
  WizardDefinition,
  WizardEngineEvent
} from "@pathwrite/core";
import { WizardFacade } from "@pathwrite/angular-adapter";

@Component({
  selector: "app-root",
  standalone: true,
  imports: [CommonModule],
  templateUrl: "./app.component.html",
  styleUrl: "./app.component.css",
  providers: [WizardFacade]
})
export class AppComponent {
  public readonly title = "Pathwrite Angular Demo";
  public readonly eventLog: string[] = [];

  protected readonly facade = inject(WizardFacade);
  public readonly snapshot = toSignal(this.facade.state$, { initialValue: null });

  private readonly mainWizard: WizardDefinition = {
    id: "create-course",
    steps: [
      { id: "course-details", title: "Course Details" },
      {
        id: "lesson-details",
        title: "Lesson Details",
        onResumeFromSubWizard: (subWizardId, args) => {
          if (subWizardId === "new-lesson") {
            this.eventLog.unshift(`sub result copied: lesson=${String(args.lesson)}`);
            return { lesson: args.lesson };
          }
        }
      },
      { id: "review", title: "Review" }
    ]
  };

  private readonly subWizard: WizardDefinition = {
    id: "new-lesson",
    steps: [
      {
        id: "lesson-name",
        title: "Lesson Name",
        onVisit: () => ({ lesson: "Intro" })
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
    this.facade.start(this.mainWizard, { owner: "angular-demo" });
  }

  public startSub(): void {
    this.facade.startSubWizard(this.subWizard);
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

  private formatEvent(event: WizardEngineEvent): string {
    if (event.type === "stateChanged") {
      return `stateChanged -> ${event.snapshot.wizardId}/${event.snapshot.stepId}`;
    }
    if (event.type === "resumed") {
      return `resumed -> ${event.resumedWizardId} from ${event.fromSubWizardId}`;
    }
    if (event.type === "completed") {
      return `completed -> ${event.wizardId} ${JSON.stringify(event.args)}`;
    }
    return `cancelled -> ${event.wizardId} ${JSON.stringify(event.args)}`;
  }
}
