(function (factory) {
    if (typeof module === "object" && typeof module.exports === "object") {
        var v = factory(require, exports);
        if (v !== undefined) module.exports = v;
    }
    else if (typeof define === "function" && define.amd) {
        define(["require", "exports", "tslib", "@aurelia/kernel", "@aurelia/runtime", "./rule-provider", "./validation-controller"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    const tslib_1 = require("tslib");
    const kernel_1 = require("@aurelia/kernel");
    const runtime_1 = require("@aurelia/runtime");
    const rule_provider_1 = require("./rule-provider");
    const validation_controller_1 = require("./validation-controller");
    /**
     * Validation triggers.
     */
    var ValidationTrigger;
    (function (ValidationTrigger) {
        /**
         * Manual validation.  Use the controller's `validate()` and  `reset()` methods to validate all bindings.
         */
        ValidationTrigger["manual"] = "manual";
        /**
         * Validate the binding when the binding's target element fires a DOM "blur" event.
         */
        ValidationTrigger["blur"] = "blur";
        /**
         * Validate the binding when it updates the model due to a change in the source property (usually triggered by some change in view)
         */
        ValidationTrigger["change"] = "change";
        /**
         * Validate the binding when the binding's target element fires a DOM "blur" event and when it updates the model due to a change in the view.
         */
        ValidationTrigger["changeOrBlur"] = "changeOrBlur";
    })(ValidationTrigger = exports.ValidationTrigger || (exports.ValidationTrigger = {}));
    /* @internal */
    exports.IDefaultTrigger = kernel_1.DI.createInterface('IDefaultTrigger').noDefault();
    /**
     * Binding behavior. Indicates the bound property should be validated.
     */
    let ValidateBindingBehavior = class ValidateBindingBehavior extends runtime_1.BindingInterceptor {
        constructor(binding, expr) {
            super(binding, expr);
            this.binding = binding;
            this.propertyBinding = (void 0);
            this.target = (void 0);
            this.isChangeTrigger = false;
            this.connectedExpressions = [];
            this.triggerMediator = new runtime_1.BindingMediator('handleTriggerChange', this, this.observerLocator, this.locator);
            this.controllerMediator = new runtime_1.BindingMediator('handleControllerChange', this, this.observerLocator, this.locator);
            this.rulesMediator = new runtime_1.BindingMediator('handleRulesChange', this, this.observerLocator, this.locator);
            this.scheduler = this.locator.get(runtime_1.IScheduler);
            this.defaultTrigger = this.locator.get(exports.IDefaultTrigger);
            this.setPropertyBinding();
        }
        updateSource(value, flags) {
            // TODO: need better approach. If done incorrectly may cause infinite loop, stack overflow 💣
            if (this.interceptor !== this) {
                this.interceptor.updateSource(value, flags);
            }
            else {
                // let binding = this as BindingInterceptor;
                // while (binding.binding !== void 0) {
                //   binding = binding.binding as unknown as BindingInterceptor;
                // }
                // binding.updateSource(value, flags);
                // this is a shortcut of the above code
                this.propertyBinding.updateSource(value, flags);
            }
            if (this.isChangeTrigger) {
                this.validateBinding();
            }
        }
        handleEvent(_event) {
            this.validateBinding();
        }
        $bind(flags, scope, part) {
            this.scope = scope;
            this.binding.$bind(flags, scope, part);
            this.setTarget();
            const delta = this.processBindingExpressionArgs(flags);
            this.processDelta(delta);
        }
        $unbind(flags) {
            var _a, _b, _c;
            (_a = this.target) === null || _a === void 0 ? void 0 : _a.removeEventListener('blur', this);
            (_b = this.controller) === null || _b === void 0 ? void 0 : _b.unregisterBinding(this.propertyBinding);
            this.binding.$unbind(flags);
            for (const expr of this.connectedExpressions) {
                (_c = expr.unbind) === null || _c === void 0 ? void 0 : _c.call(expr, flags, this.scope, this);
            }
        }
        handleTriggerChange(newValue, _previousValue, _flags) {
            this.processDelta(new ValidateArgumentsDelta(void 0, this.ensureTrigger(newValue), void 0));
        }
        handleControllerChange(newValue, _previousValue, _flags) {
            this.processDelta(new ValidateArgumentsDelta(this.ensureController(newValue), void 0, void 0));
        }
        handleRulesChange(newValue, _previousValue, _flags) {
            this.processDelta(new ValidateArgumentsDelta(void 0, void 0, this.ensureRules(newValue)));
        }
        processBindingExpressionArgs(flags) {
            const scope = this.scope;
            const locator = this.locator;
            let rules;
            let trigger;
            let controller;
            let expression = this.propertyBinding.sourceExpression;
            while (expression.name !== 'validate' && expression !== void 0) {
                expression = expression.expression;
            }
            const args = expression.args;
            for (let i = 0, ii = args.length; i < ii; i++) {
                const arg = args[i];
                const temp = arg.evaluate(flags, scope, locator);
                switch (i) {
                    case 0:
                        trigger = this.ensureTrigger(temp);
                        arg.connect(flags, scope, this.triggerMediator);
                        break;
                    case 1:
                        controller = this.ensureController(temp);
                        arg.connect(flags, scope, this.controllerMediator);
                        break;
                    case 2:
                        rules = this.ensureRules(temp);
                        arg.connect(flags, scope, this.rulesMediator);
                        break;
                    default:
                        throw new Error(`Unconsumed argument#${i + 1} for validate binding behavior: ${temp}`); // TODO: use reporter
                }
                this.connectedExpressions.push(arg);
            }
            return new ValidateArgumentsDelta(this.ensureController(controller), this.ensureTrigger(trigger), rules);
        }
        validateBinding() {
            this.scheduler.getPostRenderTaskQueue().queueTask(async () => {
                await this.controller.validateBinding(this.propertyBinding);
            });
        }
        processDelta(delta) {
            var _a, _b, _c;
            const trigger = (_a = delta.trigger) !== null && _a !== void 0 ? _a : this.trigger;
            const controller = (_b = delta.controller) !== null && _b !== void 0 ? _b : this.controller;
            const rules = delta.rules;
            if (this.trigger !== trigger) {
                if (this.trigger === ValidationTrigger.blur || this.trigger === ValidationTrigger.changeOrBlur) {
                    this.target.removeEventListener('blur', this);
                }
                this.trigger = trigger;
                this.isChangeTrigger = trigger === ValidationTrigger.change || trigger === ValidationTrigger.changeOrBlur;
                if (trigger === ValidationTrigger.blur || trigger === ValidationTrigger.changeOrBlur) {
                    this.target.addEventListener('blur', this);
                }
            }
            if (this.controller !== controller || rules !== void 0) {
                (_c = this.controller) === null || _c === void 0 ? void 0 : _c.unregisterBinding(this.propertyBinding);
                this.controller = controller;
                controller.registerBinding(this.propertyBinding, new validation_controller_1.BindingInfo(this.target, this.scope, rules));
            }
        }
        ensureTrigger(trigger) {
            if (trigger === (void 0) || trigger === null) {
                trigger = this.defaultTrigger;
            }
            else if (!Object.values(ValidationTrigger).includes(trigger)) {
                throw new Error(`${trigger} is not a supported validation trigger`); // TODO: use reporter
            }
            return trigger;
        }
        ensureController(controller) {
            if (controller === (void 0) || controller === null) {
                controller = this.locator.get(validation_controller_1.IValidationController);
            }
            else if (!(controller instanceof validation_controller_1.ValidationController)) {
                throw new Error(`${controller} is not of type ValidationController`); // TODO: use reporter
            }
            return controller;
        }
        ensureRules(rules) {
            if (Array.isArray(rules) && rules.every((item) => item instanceof rule_provider_1.PropertyRule)) {
                return rules;
            }
        }
        setPropertyBinding() {
            let binding = this.binding;
            while (!(binding instanceof runtime_1.PropertyBinding) && binding !== void 0) {
                binding = binding.binding;
            }
            if (binding === void 0) {
                throw new Error('Unable to set property binding');
            }
            this.propertyBinding = binding;
        }
        setTarget() {
            var _a;
            const target = this.propertyBinding.target;
            if (runtime_1.DOM.isNodeInstance(target)) {
                this.target = target;
            }
            else {
                const controller = (_a = target) === null || _a === void 0 ? void 0 : _a.$controller;
                if (controller === void 0) {
                    throw new Error('Invalid binding target'); // TODO: use reporter
                }
                this.target = controller.host;
            }
        }
    };
    ValidateBindingBehavior = tslib_1.__decorate([
        runtime_1.bindingBehavior('validate'),
        tslib_1.__metadata("design:paramtypes", [Object, Object])
    ], ValidateBindingBehavior);
    exports.ValidateBindingBehavior = ValidateBindingBehavior;
    class ValidateArgumentsDelta {
        constructor(controller, trigger, rules) {
            this.controller = controller;
            this.trigger = trigger;
            this.rules = rules;
        }
    }
});
//# sourceMappingURL=validate-binding-behavior.js.map