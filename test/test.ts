import test from "ava"
import { Server, ServerOptions, ResponseObject } from "@hapi/hapi"
import { Boom } from "@hapi/boom"
import Plugin = require("..")
const pkgname = require("../package").name

let serverNoOptions: Server
let server: Server

test.before(async () => {
  serverNoOptions = await createServer()
  server = await createServer({ enabled: true })
})

test("basic negative", async (t) => {
  let response = await serverNoOptions.inject("/disabled")
  let { etag } = response.headers
  t.falsy(etag, "must be unset: disabled by default")
})

test("basic positive", async (t) => {
  let response = await serverNoOptions.inject("/enabled")
  let { etag } = response.headers
  t.truthy(etag, "must be set: route override")

  let response2 = await serverNoOptions.inject({
    url: "/enabled",
    headers: { "if-none-match": etag },
  })
  t.is(response2.statusCode, 304, "must be 304 Not Modified")
  t.is(response2.rawPayload.length, 0, "must have zero-length payload")
  t.is(response.headers["x-foo"], "bar", "must be same response object")
})

test("stable etag", async (t) => {
  let response = await server.inject("/enabled")
  let { etag } = response.headers
  let response2 = await server.inject({
    url: "/alternative",
    headers: { "if-none-match": etag },
  })
  t.is(response2.statusCode, 304, "must be 304 Not Modified")
  t.is(response2.rawPayload.length, 0, "must have zero-length payload")
})

test("promises", async (t) => {
  let response = await server.inject("/enabled")
  let { etag } = response.headers
  let response2 = await server.inject({
    url: "/promise",
    headers: { "if-none-match": etag },
  })
  t.is(response2.statusCode, 304)
})

test("buffer", async (t) => {
  let response = await server.inject("/buffer")
  t.truthy(response.headers.etag)
})

test("manual etag", async (t) => {
  let response = await serverNoOptions.inject("/manual")
  t.is((response.result as any) as string, "ab")
  t.truthy(response.headers.etag)
})

test("non-success status code", async (t) => {
  const myServer = await createServer({ nonSuccess: true, enabled: true })
  let response = await server.inject("/nonsuccess")
  t.is((response.result as any) as string, "a")
  t.truthy(response.headers.etag)

  let response2 = await myServer.inject("/nonsuccess")
  t.is((response2.result as any) as string, "a")
  t.falsy(response2.headers.etag)
})

test("error", async (t) => {
  let response = await server.inject("/error")
  t.falsy(response.headers.etag)
})

test("boom", async (t) => {
  let response = await server.inject("/boom")
  t.is(response.statusCode, 418)
  t.is((response.result! as Boom).message, "xyz")
})

test("empty reply", async (t) => {
  let response = await server.inject("/empty-reply")
  t.is(response.payload, "")
  let response2 = await server.inject({
    url: "/empty-reply",
    headers: { "if-none-match": response.headers.etag },
  })
  t.is(response2.statusCode, 304, "must be 304 Not Modified")
  t.is(response2.rawPayload.length, 0, "must have zero-length payload")
})

test("plugin error", async (t) => {
  await t.throwsAsync(() => createServer({ unknownPluginOption: NaN } as any))
})

test("route error", async (t) => {
  const server = await createServer({ enabled: true }, { debug: false })

  let p = new Promise((_, reject) => {
    server.events.on(
      { name: "request", channels: "error" },
      (_, { error }: { error: any }) => {
        if (error.name === "ValidationError") {
          reject(error)
        }
      }
    )
  })

  server.route({
    path: "/test",
    method: "GET",
    handler() {
      return 1
    },
    options: {
      plugins: {
        [pkgname]: {
          unknownRouteOption: NaN,
        },
      },
    },
  })

  server.inject("/test")

  await t.throwsAsync(() => p)
})

async function createServer(
  pluginOpts?: Plugin.Options,
  hapiOpts?: ServerOptions
) {
  const server = new Server(hapiOpts)
  await server.register({
    plugin: Plugin,
    options: pluginOpts,
  })

  server.route([
    {
      path: "/disabled",
      method: "GET",
      handler(request, h) {
        return h.response({ a: 1, b: 2 }).header("x-foo", "bar")
      },
    },
    {
      path: "/enabled",
      method: "GET",
      handler(request, h) {
        return h.response({ a: 1, b: 2 }).header("x-foo", "bar")
      },
      options: {
        plugins: {
          [pkgname]: {
            enabled: true,
          },
        },
      },
    },
    {
      path: "/alternative",
      method: "GET",
      handler() {
        return { b: 2, a: 1 }
      },
    },
    {
      path: "/promise",
      method: "GET",
      handler() {
        return Promise.resolve({ a: 1, b: 2 })
      },
    },
    {
      path: "/buffer",
      method: "GET",
      handler() {
        return createBuffer(1, 2, 3)
      },
    },
    {
      path: "/manual",
      method: "GET",
      handler() {
        return "a"
      },
    },
    {
      path: "/nonsuccess",
      method: "GET",
      handler(request, h) {
        return h.response("a").code(400)
      },
    },
    {
      path: "/error",
      method: "GET",
      handler() {
        throw new Error("xyz")
      },
    },
    {
      path: "/boom",
      method: "GET",
      handler() {
        throw new Boom("xyz", { statusCode: 418, data: { a: 1, b: 2 } })
      },
    },
    {
      path: "/empty-reply",
      method: "GET",
      handler() {
        return ""
      },
    },
  ])

  server.ext("onPostHandler", (request, h) => {
    try {
      if (request.path === "/manual") {
        const response = h.response(
          `${(request.response as ResponseObject).source as string}b`
        )
        server.plugins[pkgname].etag(response)
        return response
      }
      return h.continue
    } catch (err) {
      console.error(err.stack)
      throw err
    }
  })

  return server
}

function createBuffer(...array: number[]) {
  return Number(/v([^\.]*)/.exec(process.version)![1]) < 6
    ? new Buffer(array)
    : Buffer.from(array)
}
