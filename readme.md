# hapi-etag

hapi Etag helper plugin

## Usage

```javascript
// server.connection(...)

server.register(
  {
    register: require('hapi-etag'),
    options: pluginOptions
  },
  options,
  callback
)
```

### Options

* `enabled: Boolean` - Enable processing for the server/the current route. (Default: `undefined`  - **not enabled by default**.)
* `nonSuccess: Boolean` - Enable processing for non-success (_not_ 2xx) status codes. (Default: `undefined`)

For string and buffer response sources, the ETag will simply be attached.

Stream response sources are ignored.

These options can either be set in the plugin options (see above) or per-route:

```javascript
{
  "config": {
    "plugins": {
      "hapi-etag": {
        /* ... */
      }
    }
  }
}
```

When set in the route, these options will override the plugin options.

### Events

Events are emitted by an `EventEmitter` accessible from `server.plugins['hapi-etag'].events`.

#### `newResponse(request, reply)`

If `stable === true`, the response will be replaced with a new response. Listen to this event if you wish to modify the new response further.

### No stream support

If you want to attach an ETag to a resource, just give up on streaming it. ETag is based on the value of the _whole_ resource, so there's no point to attaching an ETag to it if we might not have all of it.

Alternatively, precalculate the ETag that you want to attach to a resource. That way you can just call `response.etag()` when you stream it. 👍

You can also try buffering the whole resource, in which case, you can just submit the resulting buffer to `reply` and be able to use this plugin.

Streaming _is_ awesome, but there are situations where it is right or it is wrong to use with.

## License

MIT
