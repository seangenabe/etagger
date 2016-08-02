const pkgname = require('../package').name
const assert = require('assert')
const Plugin = require('..')
const { Server } = require('hapi')
const Boom = require('boom')

console.log('start')

;(async () => {
  try {
    let serverNoOptions = await createServer()
    let response = await serverNoOptions.inject('/manual')
    assert(response.result, 'ab')
    assert(response.headers.etag)
  }
  catch (err) {
    console.error(err.stack)
  }
  console.log('done')
})()

async function createServer(pluginOpts) {
  const server = new Server()
  server.connection()
  await server.register({
    register: Plugin,
    options: pluginOpts
  })

  server.route([
    {
      path: '/disabled',
      method: 'GET',
      handler(request, reply) {
        reply({ a: 1, b: 2 }).header('x-foo', 'bar')
      }
    },
    {
      path: '/enabled',
      method: 'GET',
      handler(request, reply) {
        reply({ a: 1, b: 2 }).header('x-foo', 'bar')
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
      handler(request, reply) {
        reply({ b: 2, a: 1 })
      }
    },
    {
      path: '/promise',
      method: 'GET',
      handler(request, reply) {
        reply(Promise.resolve({ a: 1, b: 2 }))
      }
    },
    {
      path: '/buffer',
      method: 'GET',
      handler(request, reply) {
        reply(createBuffer(1, 2, 3))
      }
    },
    {
      path: '/manual',
      method: 'GET',
      handler(request, reply) {
        reply('a')
      }
    },
    {
      path: '/nonsuccess',
      method: 'GET',
      handler(request, reply) {
        reply('a').code(400)
      }
    },
    {
      path: '/error',
      method: 'GET',
      handler(request, reply) {
        reply(new Error('xyz'))
      }
    },
    {
      path: '/boom',
      method: 'GET',
      handler(request, reply) {
        let err = Boom.create(418, 'xyz', { a: 1, b: 2 })
        reply(err)
      }
    }
  ])

  server.ext('onPostHandler', (request, reply) => {
    try {
      if (request.path === '/manual') {
        let response = reply(`${request.response.source}b`)
        console.log('calling etagger')
        debugger
        server.plugins[pkgname].etag(response)
        console.log('called etagger')
        return
      }
      reply.continue()
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
