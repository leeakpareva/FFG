/**
 * Makes async route handlers safe on Express 4.
 *
 * Express 4 calls a handler and ignores what it returns. An async handler
 * returns a promise, so a throw inside it becomes an unhandled rejection:
 * Node logs it and, since v15, kills the process. One malformed room join did
 * exactly that here and took the whole API offline.
 *
 * Wrapping at the router level keeps the route functions plain — no `try` in
 * every handler, and no chance of someone adding a route later and forgetting.
 */
export function catchAsync(router) {
  for (const layer of router.stack || []) {
    const handlers = layer.route ? layer.route.stack : [layer];
    for (const h of handlers) {
      const fn = h.handle;
      // Arity 4 means (err, req, res, next): an error handler, leave it alone.
      if (typeof fn !== 'function' || fn.length === 4 || fn.__wrapped) continue;

      const wrapped = function (req, res, next) {
        let out;
        try {
          out = fn.call(this, req, res, next);
        } catch (e) {
          return next(e);
        }
        if (out && typeof out.catch === 'function') out.catch(next);
        return out;
      };
      wrapped.__wrapped = true;
      h.handle = wrapped;
    }
  }
  return router;
}
