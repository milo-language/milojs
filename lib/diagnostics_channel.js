// diagnostics_channel: named publish/subscribe with no transport underneath.
// Pure bookkeeping, which is why it can live here rather than in a binding.
//
// The one subtlety is that channels are INTERNED by name: two calls to
// channel("x") must return the same object, or a subscriber registered through
// one would never see a message published through the other. Node holds them
// weakly; this runtime has no WeakRef-keyed registry, so they are held strongly
// and a channel outlives its last subscriber. That costs a little memory and
// changes nothing observable.

const channels = new Map();

class Channel {
  constructor(name) {
    this.name = name;
    this._subscribers = [];
    this._stores = new Map();
  }

  get hasSubscribers() {
    return this._subscribers.length > 0;
  }

  subscribe(onMessage) {
    if (typeof onMessage !== "function") {
      throw new TypeError('The "onMessage" argument must be of type function');
    }
    this._subscribers.push(onMessage);
  }

  unsubscribe(onMessage) {
    const i = this._subscribers.indexOf(onMessage);
    if (i < 0) return false;
    this._subscribers.splice(i, 1);
    return true;
  }

  publish(message) {
    // A subscriber that throws must not stop the ones after it, and must not
    // propagate into the publisher: node reports it as an uncaught exception on
    // the next tick instead.
    const subs = this._subscribers.slice(0);
    for (let i = 0; i < subs.length; i++) {
      try {
        subs[i](message, this.name);
      } catch (err) {
        queueMicrotask(() => { throw err; });
      }
    }
  }

  bindStore(store, transform) {
    this._stores.set(store, transform);
  }

  unbindStore(store) {
    return this._stores.delete(store);
  }

  runStores(message, fn, thisArg, ...args) {
    // No AsyncLocalStorage in this runtime, so the stores are recorded and the
    // function simply runs. Publishing still happens, which is what a subscriber
    // is watching for.
    this.publish(message);
    return Reflect.apply(fn, thisArg, args);
  }
}

function channel(name) {
  let c = channels.get(name);
  if (c === undefined) {
    c = new Channel(name);
    channels.set(name, c);
  }
  return c;
}

function hasSubscribers(name) {
  const c = channels.get(name);
  return c !== undefined && c.hasSubscribers;
}

function subscribe(name, onMessage) {
  channel(name).subscribe(onMessage);
}

function unsubscribe(name, onMessage) {
  return channel(name).unsubscribe(onMessage);
}

// The five sub-channels a traced operation publishes to. Node derives their
// names from the base name with these suffixes, and a caller may also pass an
// object naming each channel directly.
const TRACE_EVENTS = ["start", "end", "asyncStart", "asyncEnd", "error"];

class TracingChannel {
  constructor(nameOrChannels) {
    if (typeof nameOrChannels === "string") {
      for (const ev of TRACE_EVENTS) {
        this[ev] = channel(`tracing:${nameOrChannels}:${ev}`);
      }
    } else if (nameOrChannels !== null && typeof nameOrChannels === "object") {
      for (const ev of TRACE_EVENTS) {
        const c = nameOrChannels[ev];
        this[ev] = typeof c === "string" ? channel(c) : c;
      }
    } else {
      throw new TypeError('The "channels" argument must be of type string or object');
    }
  }

  get hasSubscribers() {
    return TRACE_EVENTS.some((ev) => this[ev] && this[ev].hasSubscribers);
  }

  subscribe(handlers) {
    for (const ev of TRACE_EVENTS) {
      if (handlers[ev]) this[ev].subscribe(handlers[ev]);
    }
  }

  unsubscribe(handlers) {
    let ok = true;
    for (const ev of TRACE_EVENTS) {
      if (handlers[ev] && !this[ev].unsubscribe(handlers[ev])) ok = false;
    }
    return ok;
  }

  traceSync(fn, ctx = {}, thisArg, ...args) {
    this.start.publish(ctx);
    try {
      const result = Reflect.apply(fn, thisArg, args);
      ctx.result = result;
      return result;
    } catch (err) {
      ctx.error = err;
      this.error.publish(ctx);
      throw err;
    } finally {
      this.end.publish(ctx);
    }
  }

  tracePromise(fn, ctx = {}, thisArg, ...args) {
    this.start.publish(ctx);
    let promise;
    try {
      promise = Reflect.apply(fn, thisArg, args);
    } catch (err) {
      ctx.error = err;
      this.error.publish(ctx);
      this.end.publish(ctx);
      throw err;
    }
    this.end.publish(ctx);
    this.asyncStart.publish(ctx);
    return Promise.resolve(promise).then(
      (result) => {
        ctx.result = result;
        this.asyncEnd.publish(ctx);
        return result;
      },
      (err) => {
        ctx.error = err;
        this.error.publish(ctx);
        this.asyncEnd.publish(ctx);
        throw err;
      },
    );
  }

  traceCallback(fn, position = -1, ctx = {}, thisArg, ...args) {
    this.start.publish(ctx);
    const self = this;
    const given = position >= 0 ? args[position] : args[args.length - 1];
    function wrapped(err, res) {
      if (err) {
        ctx.error = err;
        self.error.publish(ctx);
      } else {
        ctx.result = res;
      }
      self.asyncStart.publish(ctx);
      try {
        if (typeof given === "function") {
          return Reflect.apply(given, this, arguments);
        }
      } finally {
        self.asyncEnd.publish(ctx);
      }
    }
    if (position >= 0) args[position] = wrapped;
    else args[args.length - 1] = wrapped;
    try {
      return Reflect.apply(fn, thisArg, args);
    } catch (err) {
      ctx.error = err;
      this.error.publish(ctx);
      throw err;
    } finally {
      this.end.publish(ctx);
    }
  }
}

function tracingChannel(nameOrChannels) {
  return new TracingChannel(nameOrChannels);
}

module.exports = {
  Channel, channel, hasSubscribers, subscribe, unsubscribe, tracingChannel,
};
