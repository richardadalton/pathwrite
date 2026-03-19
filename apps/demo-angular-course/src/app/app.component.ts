import { CommonModule } from "@angular/common";
import { Component, computed, inject } from "@angular/core";
import { takeUntilDestroyed, toSignal } from "@angular/core/rxjs-interop";
import { FormsModule } from "@angular/forms";
import {
  WizardDefinition,
  WizardEngineEvent,
  WizardStepContext
} from "@pathwrite/core";
import { WizardFacade } from "@pathwrite/angular-adapter";

interface SubjectEntry {
  name: string;
  teacher: string;
}

@Component({
  selector: "app-root",
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: "./app.component.html",
  styleUrl: "./app.component.css",
  providers: [WizardFacade]
})
export class AppComponent {
  public readonly title = "Course Wizard";
  public readonly eventLog: string[] = [];

  public courseName = "";
  public subjectName = "";
  public subjectTeacher = "";

  protected readonly facade = inject(WizardFacade);
  public readonly snapshot = toSignal(this.facade.state$, { initialValue: null });
  public readonly subjects = computed((): SubjectEntry[] =>
    this.extractSubjects(this.snapshot()?.args.subjects)
  );

  private readonly mainWizard: WizardDefinition = {
    id: "course-wizard",
    steps: [
      {
        id: "course-details",
        title: "Course Details",
        okToMoveNext: (ctx) => this.nonEmptyString(ctx.args.courseName)
      },
      {
        id: "subjects-list",
        title: "Subjects List",
        okToMoveNext: (ctx) => this.getSubjects(ctx).length > 0,
        onResumeFromSubWizard: (subWizardId, subArgs, ctx) => {
          if (subWizardId !== "subject-subwizard") return;

          const name = this.safeString(subArgs.subjectName);
          const teacher = this.safeString(subArgs.subjectTeacher);
          if (!name || !teacher) return;

          this.subjectName = "";
          this.subjectTeacher = "";
          return { subjects: [...this.getSubjects(ctx), { name, teacher }] };
        }
      },
      {
        id: "review",
        title: "Review"
      }
    ]
  };

  private readonly subjectSubWizard: WizardDefinition = {
    id: "subject-subwizard",
    steps: [
      {
        id: "subject-entry",
        title: "Add Subject",
        okToMoveNext: (ctx) =>
          this.nonEmptyString(ctx.args.subjectName) && this.nonEmptyString(ctx.args.subjectTeacher)
      }
    ]
  };

  public constructor() {
    this.facade.events$.pipe(takeUntilDestroyed()).subscribe((event) => {
      this.eventLog.unshift(this.formatEvent(event));
      this.eventLog.splice(20);
    });
  }

  public startWizard(): void {
    this.courseName = "";
    this.subjectName = "";
    this.subjectTeacher = "";
    this.facade.start(this.mainWizard, { courseName: "", subjects: [] as SubjectEntry[] });
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

  public addSubjectViaSubWizard(): void {
    this.subjectName = "";
    this.subjectTeacher = "";
    this.facade.startSubWizard(this.subjectSubWizard, { subjectName: "", subjectTeacher: "" });
  }

  public updateCourseName(value: string): void {
    this.courseName = value;
    this.facade.setArg("courseName", value.trim());
  }

  public updateSubjectName(value: string): void {
    this.subjectName = value;
    this.facade.setArg("subjectName", value.trim());
  }

  public updateSubjectTeacher(value: string): void {
    this.subjectTeacher = value;
    this.facade.setArg("subjectTeacher", value.trim());
  }

  private extractSubjects(raw: unknown): SubjectEntry[] {
    if (!Array.isArray(raw)) return [];
    return raw
      .map((item) => {
        const maybe = item as { name?: unknown; teacher?: unknown };
        return { name: this.safeString(maybe.name), teacher: this.safeString(maybe.teacher) };
      })
      .filter((item) => item.name && item.teacher);
  }

  private getSubjects(ctx: WizardStepContext): SubjectEntry[] {
    return this.extractSubjects(ctx.args.subjects);
  }

  private formatEvent(event: WizardEngineEvent): string {
    if (event.type === "stateChanged") {
      return `stateChanged -> ${event.snapshot.wizardId}/${event.snapshot.stepId}`;
    }
    if (event.type === "resumed") {
      return `resumed -> ${event.resumedWizardId} from ${event.fromSubWizardId}`;
    }
    if (event.type === "completed") {
      return `completed -> ${event.wizardId}`;
    }
    return `cancelled -> ${event.wizardId}`;
  }

  private safeString(value: unknown): string {
    return typeof value === "string" ? value.trim() : "";
  }

  private nonEmptyString(value: unknown): boolean {
    return this.safeString(value).length > 0;
  }
}
