# etagger

hapi Etag helper plugin

[![npm](https://img.shields.io/npm/v/etagger.svg?style=flat-square)](https://www.npmjs.com/package/etagger)
[![Build Status](https://img.shields.io/travis/seangenabe/etagger/master.svg?style=flat-square)](https://travis-ci.org/seangenabe/etagger)
[![Coverage Status](https://img.shields.io/coveralls/seangenabe/etagger/master.svg?style=flat-square)](https://coveralls.io/github/seangenabe/etagger?branch=master)
[![Dependency Status](https://img.shields.io/david/seangenabe/etagger.svg?style=flat-square)](https://david-dm.org/seangenabe/etagger)
[![devDependency Status](https://img.shields.io/david/dev/seangenabe/etagger.svg?style=flat-square)](https://david-dm.org/seangenabe/etagger#info=devDependencies)
[![node](https://img.shields.io/node/v/etagger.svg?style=flat-square)](https://nodejs.org/en/download/)

## Usage

```javascript
// server.connection(...)

server.register(
  {
    register: require('etagger'),
    options: pluginOptions
  },
  options,
  callback
)
```

### Options

* `enabled: Boolean` - Enable processing for the connection/the current route. (Default: `undefined`  - **not enabled by default**.)
* `nonSuccess: Boolean` - Enable processing for non-success (_not_ 2xx) status codes. (Default: `undefined`)

For string and buffer response sources, the ETag will simply be attached.

Stream and error response sources are ignored.

These options can either be set in the plugin options (see above) or per-route:

```javascript
{
  "config": {
    "plugins": {
      "etagger": {
        /* ... */
      }
    }
  }
}
```

When set in the route, these options will override the plugin options.

### server.plugins.etagger.etag(response, opts)

Manually attach an ETag to a response. This is useful i.e. to etag manually in your own extension handlers.

* `response` - The response object.
* `opts` - Same as the options.
  * `enabled` - Ignored. This function will always attach an ETag to the response.

### No stream support

If you want to attach an ETag to a resource, just give up on streaming it. ETag is based on the value of the _whole_ resource, so there's no point to attaching an ETag to it if we might not have all of it.

Alternatively, precalculate the ETag that you want to attach to a resource. That way you can just call `response.etag()` when you stream it. 👍

You can also try buffering the whole resource, in which case, you can just submit the resulting buffer to `reply` and be able to use this plugin.

Streaming _is_ awesome, but there are situations where it is right or it is wrong to use with.

## License

MIT
