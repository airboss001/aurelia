import {
  IServiceLocator,
} from '@aurelia/kernel';
import {
  IScheduler,
  ITask,
  QueueTaskOptions,
} from '@aurelia/scheduler';
import {
  IForOfStatement,
  IsBindingBehavior,
} from '../ast';
import {
  BindingMode,
  ExpressionKind,
  LifecycleFlags,
  State,
} from '../flags';
import { ILifecycle } from '../lifecycle';
import {
  AccessorOrObserver,
  IBindingTargetObserver,
  IScope,
  AccessorType,
} from '../observation';
import { IObserverLocator } from '../observation/observer-locator';
import {
  hasBind,
  hasUnbind,
} from './ast';
import {
  connectable,
  IConnectableBinding,
  IPartialConnectableBinding,
} from './connectable';

// BindingMode is not a const enum (and therefore not inlined), so assigning them to a variable to save a member accessor is a minor perf tweak
const { oneTime, toView, fromView } = BindingMode;

// pre-combining flags for bitwise checks is a minor perf tweak
const toViewOrOneTime = toView | oneTime;

export interface PropertyBinding extends IConnectableBinding {}

const updateTaskOpts: QueueTaskOptions = {
  reusable: false,
};

@connectable()
export class PropertyBinding implements IPartialConnectableBinding {
  public interceptor: this = this;

  public id!: number;
  public $state: State = State.none;
  public $lifecycle: ILifecycle;
  public $scope?: IScope = void 0;
  public part?: string;

  public targetObserver?: AccessorOrObserver = void 0;;

  public persistentFlags: LifecycleFlags = LifecycleFlags.none;

  private task: ITask | null = null;
  private readonly $scheduler: IScheduler;

  public constructor(
    public sourceExpression: IsBindingBehavior | IForOfStatement,
    public target: object,
    public targetProperty: string,
    public mode: BindingMode,
    public observerLocator: IObserverLocator,
    public locator: IServiceLocator,
  ) {
    connectable.assignIdTo(this);
    this.$lifecycle = locator.get(ILifecycle);
    this.$scheduler = locator.get(IScheduler);
  }

  public updateTarget(value: unknown, flags: LifecycleFlags): void {
    flags |= this.persistentFlags;
    this.targetObserver!.setValue(value, flags);
  }

  public updateSource(value: unknown, flags: LifecycleFlags): void {
    flags |= this.persistentFlags;
    this.sourceExpression.assign!(flags, this.$scope!, this.locator, value, this.part);
  }

  public handleChange(newValue: unknown, _previousValue: unknown, flags: LifecycleFlags): void {
    if ((this.$state & State.isBound) === 0) {
      return;
    }

    flags |= this.persistentFlags;

    if ((flags & LifecycleFlags.updateTargetInstance) > 0) {
      const interceptor = this.interceptor;
      const targetObserver = this.targetObserver!;
      const sourceExpression = this.sourceExpression;

      if ((targetObserver.type & AccessorType.Layout) > 0) {
        targetObserver.task?.cancel();
        targetObserver.task = this.task = this.$scheduler.queueRenderTask(() => {
          // timing wise, it's necessary to check if this binding is still bound, before execute everything below
          // but if we always cancel any pending task during `$ubnind` of this binding
          // then it's ok to just execute the logic inside here

          // if the only observable is an AccessScope then we can assume the passed-in newValue is the correct and latest value
          if (sourceExpression.$kind !== ExpressionKind.AccessScope || this.observerSlots > 1) {
            newValue = sourceExpression.evaluate(flags, this.$scope!, this.locator, this.part);
          }
          interceptor.updateTarget(newValue, flags);
          if ((this.mode & oneTime) === 0) {
            this.version++;
            sourceExpression.connect(flags, this.$scope!, this.interceptor, this.part);
            interceptor.unobserve(false);
          }
          this.task = null;
        }, updateTaskOpts);
      } else {
        const previousValue = targetObserver.getValue();
        // if the only observable is an AccessScope then we can assume the passed-in newValue is the correct and latest value
        if (sourceExpression.$kind !== ExpressionKind.AccessScope || this.observerSlots > 1) {
          newValue = sourceExpression.evaluate(flags, this.$scope!, this.locator, this.part);
        }
        if (newValue !== previousValue) {
          interceptor.updateTarget(newValue, flags);
        }
        // todo: merge this with evaluate above
        if ((this.mode & oneTime) === 0) {
          this.version++;
          sourceExpression.connect(flags, this.$scope!, this.interceptor, this.part);
          interceptor.unobserve(false);
        }
      }
      return;
    }

    if ((flags & LifecycleFlags.updateSourceExpression) > 0) {
      if (newValue !== this.sourceExpression.evaluate(flags, this.$scope!, this.locator, this.part)) {
        this.interceptor.updateSource(newValue, flags);
      }
      return;
    }

    throw new Error('Unexpected handleChange context in PropertyBinding');
  }

  public $bind(flags: LifecycleFlags, scope: IScope, part?: string): void {
    if (this.$state & State.isBound) {
      if (this.$scope === scope) {
        return;
      }
      this.interceptor.$unbind(flags | LifecycleFlags.fromBind);
    }
    // add isBinding flag
    this.$state |= State.isBinding;
    // Force property binding to always be strict
    flags |= LifecycleFlags.isStrictBindingStrategy;

    // Store flags which we can only receive during $bind and need to pass on
    // to the AST during evaluate/connect/assign
    this.persistentFlags = flags & LifecycleFlags.persistentBindingFlags;

    this.$scope = scope;
    this.part = part;

    let sourceExpression = this.sourceExpression;
    if (hasBind(sourceExpression)) {
      sourceExpression.bind(flags, scope, this.interceptor);
    }

    let $mode = this.mode;
    let targetObserver = this.targetObserver as IBindingTargetObserver;
    if (!targetObserver) {
      const observerLocator = this.observerLocator;
      if ($mode & fromView) {
        targetObserver = observerLocator.getObserver(flags, this.target, this.targetProperty) as IBindingTargetObserver;
      } else {
        targetObserver = observerLocator.getAccessor(flags, this.target, this.targetProperty) as IBindingTargetObserver;
      }
      this.targetObserver = targetObserver;
    }
    if ($mode !== BindingMode.oneTime && targetObserver.bind) {
      targetObserver.bind(flags);
    }

    // deepscan-disable-next-line
    $mode = this.mode;

    // during bind, binding behavior might have changed sourceExpression
    sourceExpression = this.sourceExpression;
    const interceptor = this.interceptor;

    if ($mode & toViewOrOneTime) {
      interceptor.updateTarget(sourceExpression.evaluate(flags, scope, this.locator, part), flags);
    }
    if ($mode & toView) {
      sourceExpression.connect(flags, scope, interceptor, part);
    }
    if ($mode & fromView) {
      targetObserver.subscribe(interceptor);
      if (($mode & toView) === 0) {
        interceptor.updateSource(targetObserver.getValue(), flags);
      }
      targetObserver[this.id] |= LifecycleFlags.updateSourceExpression;
    }

    // add isBound flag and remove isBinding flag
    this.$state |= State.isBound;
    this.$state &= ~State.isBinding;
  }

  public $unbind(flags: LifecycleFlags): void {
    if (!(this.$state & State.isBound)) {
      return;
    }
    // add isUnbinding flag
    this.$state |= State.isUnbinding;

    // clear persistent flags
    this.persistentFlags = LifecycleFlags.none;
    
    if (hasUnbind(this.sourceExpression)) {
      this.sourceExpression.unbind(flags, this.$scope!, this.interceptor);
    }

    this.$scope = void 0;

    const targetObserver = this.targetObserver as IBindingTargetObserver;
    const task = this.task;

    if (targetObserver.unbind) {
      targetObserver.unbind!(flags);
    }
    if (targetObserver.unsubscribe) {
      targetObserver.unsubscribe(this.interceptor);
      targetObserver[this.id] &= ~LifecycleFlags.updateSourceExpression;
    }
    if (task != null) {
      task.cancel();
      if (task === targetObserver.task) {
        targetObserver.task = null;
      }
      this.task = null;
    }
    this.interceptor.unobserve(true);

    // remove isBound and isUnbinding flags
    this.$state &= ~(State.isBound | State.isUnbinding);
  }
}
