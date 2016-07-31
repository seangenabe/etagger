const t = require('tap')
const createServer = require('./create-server')

let serverNoOptions
let server
let p

t.beforeEach(async () => {
  p = p || (async () => {
    serverNoOptions = await createServer()
    server = await createServer({ enabled: true })
  })()
  await p
})

t.test("basic negative", async t => {
  let response = await serverNoOptions.inject('/disabled')
  t.notOk(response.headers.etag, "must be unset: disabled by default")
})

t.test("basic positive", async t => {
  let response = await serverNoOptions.inject('/enabled')
  let { etag } = response.headers
  t.ok(etag, "must be set: route override")

  let response2 = await serverNoOptions.inject({
    url: '/enabled',
    headers: { 'if-none-match': etag }
  })
  t.equals(response2.statusCode, 304, "must be 304 Not Modified")
  t.equals(response2.rawPayload.length, 0, "must have zero-length payload")
  t.equals(response.headers['x-foo'], 'bar',
    "must be same response object")
})

t.test("stable etag", async t => {
  let response = await server.inject('/enabled')
  let { etag } = response.headers
  let response2 = await server.inject({
    url: '/alternative',
    headers: { 'if-none-match': etag }
  })
  t.equals(response2.statusCode, 304, "must be 304 Not Modified")
  t.equals(response2.rawPayload.length, 0, "must have zero-length payload")
})

t.test("promises", async t => {
  let response = await server.inject('/enabled')
  let { etag } = response.headers
  let response2 = await server.inject({
    url: '/promise',
    headers: { 'if-none-match': etag }
  })
  t.equals(response2.statusCode, 304)
})

t.test("buffer", async t => {
  let response = await server.inject('/buffer')
  t.ok(response.headers.etag)
})

t.test("manual etag", async t => {
  let response = await serverNoOptions.inject('/manual')
  t.equals(response.result, 'ab')
  t.ok(response.headers.etag)
})

t.test("non-success status code", async t => {
  const myServer = await createServer({ nonSuccess: true, enabled: true })
  let response = await server.inject('/nonsuccess')
  t.equals(response.result, 'a')
  t.ok(response.headers.etag)

  let response2 = await myServer.inject('/nonsuccess')
  t.equals(response2.result, 'a')
  t.notOk(response2.headers.etag)
})

t.test('error', async t => {
  let response = await server.inject('/error')
  t.notOk(response.headers.etag)
})

t.test('boom', async t => {
  let response = await server.inject('/boom')
  t.equals(response.statusCode, 418)
  t.equals(response.result.message, 'xyz')
})
