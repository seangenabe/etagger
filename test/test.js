const t = require('ava')
const pkgname = require('../package').name
const Domain = require('domain')

let serverNoOptions
let server

t.before(async () => {
  serverNoOptions = await createServer()
  server = await createServer({ enabled: true })
})

t("basic negative", async t => {
  let response = await serverNoOptions.inject('/disabled')
  let { etag } = response.headers
  t.falsy(etag, "must be unset: disabled by default")
})

t("basic positive", async t => {
  let response = await serverNoOptions.inject('/enabled')
  let { etag } = response.headers
  t.truthy(etag, "must be set: route override")

  let response2 = await serverNoOptions.inject({
    url: '/enabled',
    headers: { 'if-none-match': etag }
  })
  t.is(response2.statusCode, 304, "must be 304 Not Modified")
  t.is(response2.rawPayload.length, 0, "must have zero-length payload")
  t.is(response.headers['x-foo'], 'bar',
    "must be same response object")
})

t("stable etag", async t => {
  let response = await server.inject('/enabled')
  let { etag } = response.headers
  let response2 = await server.inject({
    url: '/alternative',
    headers: { 'if-none-match': etag }
  })
  t.is(response2.statusCode, 304, "must be 304 Not Modified")
  t.is(response2.rawPayload.length, 0, "must have zero-length payload")
})

t("promises", async t => {
  let response = await server.inject('/enabled')
  let { etag } = response.headers
  let response2 = await server.inject({
    url: '/promise',
    headers: { 'if-none-match': etag }
  })
  t.is(response2.statusCode, 304)
})

t("buffer", async t => {
  let response = await server.inject('/buffer')
  t.truthy(response.headers.etag)
})

t("manual etag", async t => {
  let response = await serverNoOptions.inject('/manual')
  t.is(response.result, 'ab')
  t.truthy(response.headers.etag)
})

t("non-success status code", async t => {
  const myServer = await createServer({ nonSuccess: true, enabled: true })
  let response = await server.inject('/nonsuccess')
  t.is(response.result, 'a')
  t.truthy(response.headers.etag)

  let response2 = await myServer.inject('/nonsuccess')
  t.is(response2.result, 'a')
  t.falsy(response2.headers.etag)
})

t('error', async t => {
  let response = await server.inject('/error')
  t.falsy(response.headers.etag)
})

t('boom', async t => {
  let response = await server.inject('/boom')
  t.is(response.statusCode, 418)
  t.is(response.result.message, 'xyz')
})

t('empty reply', async t => {
  let response = await server.inject('/empty-reply')
  t.is(response.payload, '')
  let response2 = await server.inject({
    url: '/empty-reply',
    headers: { 'if-none-match': response.headers.etag }
  })
  t.is(response2.statusCode, 304, "must be 304 Not Modified")
  t.is(response2.rawPayload.length, 0, "must have zero-length payload")
})

t("plugin error", async t => {
  await t.throws(createServer({ unknownPluginOption: NaN }))
})

t("route error", async t => {
  const server = await createServer({ enabled: true }, { debug: false })

  let p = new Promise((resolve, reject) => {
    server.on('request-error', (_, e) => {
      if (e.name === 'ValidationError') {
        reject(e)
      }
    })
  })

  server.route({
    path: '/test',
    method: 'GET',
    handler(request, reply) { reply(1) },
    config: {
      plugins: {
        [pkgname]: {
          unknownRouteOption: NaN
        }
      }
    }
  })

  server.inject('/test')

  await t.throws(p)
})

const Plugin = require('..')
const { Server } = require('hapi')
const Boom = require('boom')

async function createServer(pluginOpts, hapiOpts) {
  const server = new Server(hapiOpts)
  await server.register({
    plugin: Plugin,
    options: pluginOpts
  })

  server.route([
    {
      path: '/disabled',
      method: 'GET',
      handler(request, h) {
        return h.response({ a: 1, b: 2 }).header('x-foo', 'bar')
      }
    },
    {
      path: '/enabled',
      method: 'GET',
      handler(request, h) {
        return h.response({ a: 1, b: 2 }).header('x-foo', 'bar')
      },
      config: {
        plugins: {
          [pkgname]: {
            enabled: true
          }
        }
      }
    },
    {
      path: '/alternative',
      method: 'GET',
      handler() {
        return { b: 2, a: 1 }
      }
    },
    {
      path: '/promise',
      method: 'GET',
      handler() {
        return Promise.resolve({ a: 1, b: 2 })
      }
    },
    {
      path: '/buffer',
      method: 'GET',
      handler() {
        return createBuffer(1, 2, 3)
      }
    },
    {
      path: '/manual',
      method: 'GET',
      handler() {
        return 'a'
      }
    },
    {
      path: '/nonsuccess',
      method: 'GET',
      handler(request, h) {
        return h.response('a').code(400)
      }
    },
    {
      path: '/error',
      method: 'GET',
      handler() {
        throw new Error('xyz')
      }
    },
    {
      path: '/boom',
      method: 'GET',
      handler() {
        throw new Boom('xyz', {
          statusCode: 418,
          data: { a: 1, b: 2 }
        })
        throw Boom.create(418, 'xyz', { a: 1, b: 2 })
      }
    },
    {
      path: '/empty-reply',
      method: 'GET',
      handler() {
        return ''
      }
    }
  ])

  server.ext('onPostHandler', (request, h) => {
    try {
      if (request.path === '/manual') {
        const response = h.response(`${request.response.source}b`)
        server.plugins[pkgname].etag(response)
        return response
      }
      return h.continue
    }
    catch (err) {
      console.error(err.stack)
    }
  })

  return server
}

function createBuffer(...array) {
  return Number(/v([^\.]*)/.exec(process.version)[1]) < 6
    ? new Buffer(array)
    : Buffer.from(array)
}
