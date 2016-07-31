const pkg = require('../package')
const Crypto = require('crypto')
const stableStringify = require('json-stable-stringify')
const Joi = require('joi')

const optionsSchema = Joi.object().keys({
  enabled: Joi.boolean(),
  nonSuccess: Joi.boolean(),
  stable: Joi.valid([true, false, 'noReplace'])
})

module.exports = function hapiEtag(
  server,
  pluginOpts,
  next) {
  (async () => {
    function etagResponse(response, opts = {}) {
      opts = Object.assign({}, pluginOpts)
      opts = Joi.attempt(opts, optionsSchema)

      if (response == null) {
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
        case 'plain':
          if (typeof source === 'string') {
            response.etag(hash(source))
          }
          else {
            let newSource = stringifyFromSettings(source, response)
            let digest = hash(newSource)
            // Yes, this is a hack, but it makes things much simpler.
            response._setSource(newSource, 'plain')
            response.type('application/json')
            response.etag(digest)
          }
          break
        case 'buffer':
          response.etag(hash(source))
          break
      }
    }

    try {
      server.ext('onPostHandler', (request, reply) => {
        let opts = Object.assign(
          {},
          request.route.settings.plugins[pkg.name],
          pluginOpts
        )

        if (!opts.enabled) {
          return reply.continue()
        }

        etagResponse(request.response, opts)

        reply.continue()
      })

      server.expose('etag', etagResponse)

      next()
    }
    catch (err) {
      next(err)
    }
  })()
}

function hash(data) {
  let h = Crypto.createHash('sha1')
  h.update(data)
  return h.digest('base64')
}

function stringifyFromSettings(data, response) {
  let { replacer, spaces } = response.settings.stringify || {}
  return stableStringify(data, { space: spaces, replacer })
}

module.exports.attributes = {
  name: pkg.name,
  version: pkg.version
}
