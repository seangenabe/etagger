import stableStringify from "json-stable-stringify"
import Joi from "@hapi/joi"
import { createHash, BinaryLike } from "crypto"
import { Plugin, ResponseObject } from "@hapi/hapi"
import { Boom } from "@hapi/boom"
const pkg = require("./package")

const optionsSchema = Joi.object().keys({
  enabled: Joi.boolean(),
  nonSuccess: Joi.boolean(),
})

const Etagger: Plugin<Etagger.Options> = {
  name: pkg.name,
  version: pkg.version,
  async register(server, options) {
    let pluginOpts: Etagger.Options

    pluginOpts = Joi.attempt(options, optionsSchema)

    function etagResponse(
      response: ResponseObject | Boom,
      opts: Etagger.Options = {},
      alwaysEnabled?: boolean
    ) {
      opts = Object.assign({}, pluginOpts, opts)
      opts = Joi.attempt(opts, optionsSchema)

      if (!(alwaysEnabled || opts.enabled)) {
        return
      }

      if (response instanceof Error) {
        return
      }
      let { source, variety, statusCode } = response
      if (opts.nonSuccess && !(statusCode >= 200 && statusCode < 300)) {
        return
      }
      switch (variety) {
        case "plain":
          if (typeof source === "string") {
            response.etag(hash(source))
          } else {
            let newSourceStr = stringifyFromSettings(source, response)
            let newSource: string | null = newSourceStr
            let digest = hash(newSourceStr)
            if (source === null) {
              newSource = null // Special value when `null` is passed.
            }
            // Yes, this is a hack, but it makes things much simpler.
            // @ts-ignore
            response._setSource(newSource, "plain")
            response.type("application/json")
            response.etag(digest)
          }
          break
        case "buffer":
          response.etag(hash(source as Buffer))
          break
      }
    }

    function etagResponseAlwaysEnabled(
      response: ResponseObject | Boom,
      opts: Etagger.Options
    ) {
      return etagResponse(response, opts, true)
    }

    server.ext("onPostHandler", (request, h) => {
      const routeOptions =
        (request.route.settings.plugins &&
          request.route.settings.plugins[pkg.name]) ||
        {}
      etagResponse(request.response, routeOptions)

      return h.continue
    })

    server.expose("etag", etagResponseAlwaysEnabled)
  },
}

namespace Etagger {
  export interface Options {
    enabled?: boolean
    nonSuccess?: boolean
  }
}

export = Etagger

function hash(data: BinaryLike): string {
  let h = createHash("sha256")
  h.update(data)
  return h.digest("base64")
}

function stringifyFromSettings(data: any, response: ResponseObject): string {
  let { replacer = undefined, space = undefined } =
    response.settings.stringify || {}
  // replacer: ((key: string, value: any) => any) | Array<(string | number)> | undefined
  // space: number | string
  if (Array.isArray(replacer)) {
    if (typeof data !== "object") {
      return stableStringify(data, { space })
    }
    const newData: any = {}
    for (let key of replacer) {
      newData[key] = data[key]
    }
    return stableStringify(data, { space })
  }
  return stableStringify(data, { space, replacer })
}
