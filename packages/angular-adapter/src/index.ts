import { Injectable, OnDestroy } from "@angular/core";
import { BehaviorSubject, Observable, Subject } from "rxjs";
import {
  PathData,
  PathDefinition,
  PathEngine,
  PathEvent,
  PathSnapshot
} from "@pathwrite/core";

@Injectable()
export class PathFacade implements OnDestroy {
  private readonly engine = new PathEngine();
  private readonly _state$ = new BehaviorSubject<PathSnapshot | null>(null);
  private readonly _events$ = new Subject<PathEvent>();
  private readonly unsubscribeFromEngine: () => void;

  public readonly state$: Observable<PathSnapshot | null> = this._state$.asObservable();
  public readonly events$: Observable<PathEvent> = this._events$.asObservable();

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

  public start(path: PathDefinition, initialData: PathData = {}): Promise<void> {
    return this.engine.start(path, initialData);
  }

  public startSubPath(path: PathDefinition, initialData: PathData = {}): Promise<void> {
    return this.engine.startSubPath(path, initialData);
  }

  public next(): Promise<void> {
    return this.engine.next();
  }

  public previous(): Promise<void> {
    return this.engine.previous();
  }

  public cancel(): Promise<void> {
    return this.engine.cancel();
  }

  public setData(key: string, value: unknown): Promise<void> {
    return this.engine.setData(key, value);
  }

  public goToStep(stepId: string): Promise<void> {
    return this.engine.goToStep(stepId);
  }

  public snapshot(): PathSnapshot | null {
    return this._state$.getValue();
  }
}
