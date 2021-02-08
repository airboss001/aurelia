/**
 * A subscriber that is used for subcribing to target observer & invoking `updateSource` on a binding
 */
export class BindingTargetSubscriber {
    constructor(b) {
        this.b = b;
    }
    // deepscan-disable-next-line
    handleChange(value, _, flags) {
        const b = this.b;
        if (value !== b.sourceExpression.evaluate(flags, b.$scope, b.$hostScope, b.locator, null)) {
            // TODO: adding the update source flag, to ensure existing `bindable` works in stable manner
            // should be removed
            b.updateSource(value, flags | 16 /* updateSource */);
        }
    }
}
//# sourceMappingURL=binding-utils.js.map