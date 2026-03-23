import { Component } from "@angular/core";
import { PathData } from "@daltonr/pathwrite-angular";
import { PathShellComponent, PathStepDirective } from "@daltonr/pathwrite-angular/shell";
import { subscriptionPath } from "./subscription.path";
import { INITIAL_DATA, PLAN_LABELS, type SubscriptionData } from "./subscription.types";
import { SelectPlanStepComponent }      from "./steps/select-plan-step.component";
import { ShippingAddressStepComponent } from "./steps/shipping-address-step.component";
import { PaymentStepComponent }         from "./steps/payment-step.component";
import { BillingAddressStepComponent }  from "./steps/billing-address-step.component";
import { ReviewStepComponent }          from "./steps/review-step.component";

@Component({
  selector: "app-root",
  standalone: true,
  imports: [
    PathShellComponent, PathStepDirective,
    SelectPlanStepComponent, ShippingAddressStepComponent,
    PaymentStepComponent, BillingAddressStepComponent, ReviewStepComponent,
  ],
  templateUrl: "./app.component.html",
  styleUrl: "./app.component.css",
})
export class AppComponent {
  protected readonly subscriptionPath = subscriptionPath;
  protected readonly initialData      = INITIAL_DATA;

  protected isCompleted  = false;
  protected isCancelled  = false;
  protected completedData: SubscriptionData | null = null;

  protected onComplete(data: PathData): void {
    this.completedData = data as SubscriptionData;
    this.isCompleted   = true;
  }
  protected onCancel(): void { this.isCancelled = true; }
  protected startOver(): void { this.isCompleted = false; this.isCancelled = false; this.completedData = null; }

  protected planLabel(plan: string): string { return PLAN_LABELS[plan] ?? plan; }
}

