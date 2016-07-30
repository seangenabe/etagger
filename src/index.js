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
    try {
      server.ext('onPostHandler', (request, reply) => {
        let settings = Object.assign(
          {},
          request.route.settings.plugins[pkg.name],
          pluginOpts
        )
        settings = Joi.attempt(settings, optionsSchema)

        if (!settings.enabled) {
          return reply.continue()
        }
        let { response } = request
        if (response == null) {
          return reply.continue()
        }
        let { statusCode, source, variety } = response
        if (source instanceof Error) {
          return reply.continue()
        }
        if (settings.nonSuccess && !(statusCode >= 200 && statusCode < 300)) {
          return reply.continue()
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
        reply.continue()
      })

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
