/* eslint-disable prefer-template */
import { HttpServerOptions } from '@aurelia/http-server';
const space = ' ';
export class AuConfigurationOptions {
    constructor(server = new HttpServerOptions()) {
        this.server = server;
    }
    /** @internal */
    applyConfig(config) {
        const server = config.server;
        if (server !== void 0 && server !== null) {
            this.server.applyConfig(server);
        }
    }
    /** @internal */
    toString() {
        const indent = space.repeat(2);
        // eslint-disable-next-line @typescript-eslint/restrict-plus-operands
        return 'au server'
            + `${indent}Starts the dev server`
            + this.server.toString(indent.repeat(2));
    }
}
//# sourceMappingURL=au-configuration-options.js.map