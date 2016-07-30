const t = require('tap')
const { Server } = require('hapi')
const Plugin = require('..')
const pkgname = require('../package').name

t.test('default', async t => {
  const server = new Server()
  server.connection()
  await server.register(Plugin)
  const routeAb = (request, reply) =>
    reply({ a: 1, b: 2 }).header('x-foo', 'bar')
  server.route([
    {
      path: '/',
      method: 'GET',
      handler: routeAb
    },
    {
      path: '/a',
      method: 'GET',
      handler: routeAb,
      config: {
        plugins: {
          [pkgname]: {
            enabled: true
          }
        }
      }
    }
  ])

  {
    let response = await server.inject('/')
    t.notOk(response.headers.etag, "must be unset: disabled by default")
  }

  {
    let response = await server.inject('/a')
    let etag = response.headers.etag
    t.ok(etag, "must be set: route override")

    let response2 = await server.inject({
      url: '/a',
      headers: { 'If-None-Match': etag }
    })
    t.equals(response2.statusCode, 304, "must be 304 Not Modified")
    t.equals(response2.rawPayload.length, 0, "must have zero-length payload")
    t.equals(response2.headers['x-foo'], 'bar',
      "must be same response object")
  }
})

t.test('stable stringify', async t => {
  const server = new Server()
  server.connection()
  await server.register(Plugin)
  server.route({
    path: '/{p?}',
    method: 'GET',
    handler(request, reply) {
      reply(request.query.p === 1 ? { a: 1, b: 2, c: 3 } : { c: 3, a: 1, b: 2 })
    },
    config: {
      plugins: {
        [pkgname]: {
          enabled: true
        }
      }
    }
  })

  let response = await server.inject('/0')
  let etag = response.headers.etag
  t.ok(etag, "must transmit etag")
  let response2 = await server.inject({
    url: '/1',
    headers: { 'if-none-match': etag }
  })
  t.equals(response2.statusCode, 304, "must be 304 Not Modified")
  t.equals(response2.rawPayload.length, 0, "must have zero-length payload")
})

t.test('plugin options', async t => {
  const server = new Server()
  server.connection()
  await server.register({ register: Plugin, options: { enabled: true }})
  server.route({
    path: '/',
    method: 'GET',
    handler(request, reply) { reply({ a: 1, b: 2 }) }
  })
  let response = await server.inject('/')
  let etag = response.headers.etag
  t.ok(etag, "must transmit etag")
})

t.test('stable with promises', async t => {
  const server = new Server()
  server.connection()
  await server.register(Plugin)
  server.route({
    path: '/{p?}',
    method: 'GET',
    handler(request, reply) {
      reply(Promise.resolve(
        request.query.p === 1 ? { a: 1, b: 2, c: 3 } : { c: 3, a: 1, b: 2 }
      ))
    },
    config: {
      plugins: {
        [pkgname]: {
          enabled: true
        }
      }
    }
  })

  let response = await server.inject('/0')
  let etag = response.headers.etag
  t.ok(etag, "must transmit etag")
  let response2 = await server.inject({
    url: '/1',
    headers: { 'if-none-match': etag }
  })
  t.equals(response2.statusCode, 304, "must be 304 Not Modified")
  t.equals(response2.rawPayload.length, 0, "must have zero-length payload")
})

t.test("buffer", async t => {
  const server = new Server()
  server.connection()
  await server.register(Plugin)
  server.route({
    path: '/',
    method: 'GET',
    handler(request, reply) {
      reply(createBuffer(1, 2, 3))
    },
    config: { plugins: { [pkgname]: { enabled: true } } }
  })

  let response = await server.inject('/')
  let etag = response.headers.etag
  t.ok(etag, "must transmit etag")
  t.ok(createBuffer(1, 2, 3).equals(response.rawPayload))

  let response2 = await server.inject({
    url: '/',
    headers: { 'if-none-match': etag }
  })
  t.equals(response2.statusCode, 304, "must be 304 Not Modified")
  t.equals(response2.rawPayload.length, 0, "must have zero-length payload")
})

function createBuffer(...array) {
  return Buffer.from ? Buffer.from(array) : new Buffer(array)
}
