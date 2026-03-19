import { Injectable, OnDestroy } from "@angular/core";
import { BehaviorSubject, Observable, Subject } from "rxjs";
import {
  WizardArgs,
  WizardDefinition,
  WizardEngine,
  WizardEngineEvent,
  WizardSnapshot
} from "@pathwrite/core";

@Injectable()
export class WizardFacade implements OnDestroy {
  private readonly engine = new WizardEngine();
  private readonly _state$ = new BehaviorSubject<WizardSnapshot | null>(null);
  private readonly _events$ = new Subject<WizardEngineEvent>();
  private readonly unsubscribeFromEngine: () => void;

  public readonly state$: Observable<WizardSnapshot | null> = this._state$.asObservable();
  public readonly events$: Observable<WizardEngineEvent> = this._events$.asObservable();

  public constructor() {
    this.unsubscribeFromEngine = this.engine.subscribe((event) => {
      this._events$.next(event);
      if (event.type === "stateChanged" || event.type === "resumed") {
        this._state$.next(event.snapshot);
      } else if (event.type === "completed" || event.type === "cancelled") {
        this._state$.next(null);
      }
    });
  }

  public ngOnDestroy(): void {
    this.unsubscribeFromEngine();
    this._events$.complete();
    this._state$.complete();
  }

  public start(wizard: WizardDefinition, initialArgs: WizardArgs = {}): void {
    this.engine.start(wizard, initialArgs);
  }

  public startSubWizard(wizard: WizardDefinition, initialArgs: WizardArgs = {}): void {
    this.engine.startSubWizard(wizard, initialArgs);
  }

  public next(): void {
    this.engine.moveNext();
  }

  public previous(): void {
    this.engine.movePrevious();
  }

  public cancel(): void {
    this.engine.cancel();
  }

  public setArg(key: string, value: unknown): void {
    this.engine.setArg(key, value);
  }

  public snapshot(): WizardSnapshot | null {
    return this._state$.getValue();
  }
}
