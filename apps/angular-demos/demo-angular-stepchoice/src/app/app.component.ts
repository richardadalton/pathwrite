import { Component } from "@angular/core";
import { PathData } from "@daltonr/pathwrite-angular";
import { PathShellComponent, PathStepDirective } from "@daltonr/pathwrite-angular/shell";
import { addressPath } from "./address.path";
import { INITIAL_DATA, US_STATES, type AddressData } from "./address.types";
import { CountryStepComponent }    from "./steps/country-step.component";
import { UsAddressStepComponent }  from "./steps/us-address-step.component";
import { IeAddressStepComponent }  from "./steps/ie-address-step.component";
import { ConfirmStepComponent }    from "./steps/confirm-step.component";

@Component({
  selector: "app-root",
  standalone: true,
  imports: [
    PathShellComponent,
    PathStepDirective,
    CountryStepComponent,
    UsAddressStepComponent,
    IeAddressStepComponent,
    ConfirmStepComponent,
  ],
  templateUrl: "./app.component.html",
  styleUrl: "./app.component.css",
})
export class AppComponent {
  protected readonly addressPath  = addressPath;
  protected readonly initialData  = INITIAL_DATA;

  protected isCompleted  = false;
  protected isCancelled  = false;
  protected completedData: AddressData | null = null;

  protected onComplete(data: PathData): void {
    this.completedData = data as AddressData;
    this.isCompleted   = true;
  }

  protected onCancel(): void {
    this.isCancelled = true;
  }

  protected startOver(): void {
    this.isCompleted   = false;
    this.isCancelled   = false;
    this.completedData = null;
  }

  protected stateName(code: string): string {
    return US_STATES.find(s => s.code === code)?.name ?? code;
  }
}
