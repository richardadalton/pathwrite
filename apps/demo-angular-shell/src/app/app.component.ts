import { Component } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { CommonModule } from "@angular/common";
import { PathDefinition, PathData, PathEvent } from "@pathwrite/core";
import { PathShellComponent, PathStepDirective } from "@pathwrite/angular-adapter/shell";

@Component({
  selector: "app-root",
  standalone: true,
  imports: [CommonModule, FormsModule, PathShellComponent, PathStepDirective],
  templateUrl: "./app.component.html"
})
export class AppComponent {
  public readonly eventLog: string[] = [];
  public completedData: PathData | null = null;

  // Local form state bound to inputs
  public name = "";
  public email = "";
  public bio = "";

  public readonly signupPath: PathDefinition = {
    id: "signup",
    title: "Sign Up",
    steps: [
      {
        id: "basics",
        title: "Your Details",
        canMoveNext: (ctx) =>
          this.nonEmpty(ctx.data.name) && this.nonEmpty(ctx.data.email)
      },
      {
        id: "bio",
        title: "About You",
        canMoveNext: (ctx) => this.nonEmpty(ctx.data.bio)
      },
      {
        id: "review",
        title: "Review"
      }
    ]
  };

  public onComplete(data: PathData): void {
    this.completedData = data;
  }

  public onPathEvent(event: PathEvent): void {
    this.eventLog.unshift(this.formatEvent(event));
    this.eventLog.splice(20);
  }

  public restart(): void {
    this.completedData = null;
    this.name = "";
    this.email = "";
    this.bio = "";
  }

  private formatEvent(event: PathEvent): string {
    if (event.type === "stateChanged") {
      return `stateChanged → ${event.snapshot.stepId}`;
    }
    if (event.type === "completed") {
      return `completed → ${JSON.stringify(event.data)}`;
    }
    if (event.type === "cancelled") {
      return `cancelled → ${event.pathId}`;
    }
    return `resumed → ${(event as any).resumedPathId}`;
  }

  private nonEmpty(value: unknown): boolean {
    return typeof value === "string" && value.trim().length > 0;
  }
}
