"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
const json_stable_stringify_1 = __importDefault(require("json-stable-stringify"));
const joi_1 = __importDefault(require("@hapi/joi"));
const crypto_1 = require("crypto");
const pkg = require("./package");
const optionsSchema = joi_1.default.object().keys({
    enabled: joi_1.default.boolean(),
    nonSuccess: joi_1.default.boolean()
});
const Etagger = {
    name: pkg.name,
    version: pkg.version,
    async register(server, options) {
        let pluginOpts;
        pluginOpts = joi_1.default.attempt(options, optionsSchema);
        function etagResponse(response, opts = {}, alwaysEnabled) {
            opts = Object.assign({}, pluginOpts, opts);
            opts = joi_1.default.attempt(opts, optionsSchema);
            if (!(alwaysEnabled || opts.enabled)) {
                return;
            }
            if (response instanceof Error) {
                return;
            }
            let { source, variety, statusCode } = response;
            if (opts.nonSuccess && !(statusCode >= 200 && statusCode < 300)) {
                return;
            }
            switch (variety) {
                case "plain":
                    if (typeof source === "string") {
                        response.etag(hash(source));
                    }
                    else {
                        let newSourceStr = stringifyFromSettings(source, response);
                        let newSource = newSourceStr;
                        let digest = hash(newSourceStr);
                        if (source === null) {
                            newSource = null; // Special value when `null` is passed.
                        }
                        // Yes, this is a hack, but it makes things much simpler.
                        // @ts-ignore
                        response._setSource(newSource, "plain");
                        response.type("application/json");
                        response.etag(digest);
                    }
                    break;
                case "buffer":
                    response.etag(hash(source));
                    break;
            }
        }
        function etagResponseAlwaysEnabled(response, opts) {
            return etagResponse(response, opts, true);
        }
        server.ext("onPostHandler", (request, h) => {
            const routeOptions = (request.route.settings.plugins &&
                request.route.settings.plugins[pkg.name]) ||
                {};
            etagResponse(request.response, routeOptions);
            return h.continue;
        });
        server.expose("etag", etagResponseAlwaysEnabled);
    }
};
function hash(data) {
    let h = crypto_1.createHash("sha256");
    h.update(data);
    return h.digest("base64");
}
function stringifyFromSettings(data, response) {
    let { replacer = undefined, space = undefined } = response.settings.stringify || {};
    // replacer: ((key: string, value: any) => any) | Array<(string | number)> | undefined
    // space: number | string
    if (Array.isArray(replacer)) {
        if (typeof data !== "object") {
            throw new TypeError("not an object");
        }
        const newData = {};
        for (let key of replacer) {
            newData[key] = data[key];
        }
        return json_stable_stringify_1.default(data, { space });
    }
    return json_stable_stringify_1.default(data, { space, replacer });
}
module.exports = Etagger;
//# sourceMappingURL=index.js.map