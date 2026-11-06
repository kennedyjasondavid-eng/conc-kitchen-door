// Minimal single-context Web Locks platform fixture for extracted browser code.
// It serializes exclusive requests and releases on callback resolution/rejection.
// Actual cross-tab/platform semantics remain covered by native-browser gates.
export function createSingleContextLockManager() {
  const states = new Map();
  function drain(name, state) {
    if (state.held || !state.queue.length) return;
    const request = state.queue.shift();
    state.held = true;
    function release() {
      state.held = false;
      drain(name, state);
      if (!state.held && !state.queue.length) states.delete(name);
    }
    Promise.resolve().then(() => request.callback({ name, mode: 'exclusive' }))
      .then(value => { release(); request.resolve(value); }, error => { release(); request.reject(error); });
  }
  return {
    request(name, options, callback) {
      if (typeof options === 'function') { callback = options; options = {}; }
      options ||= {};
      if (typeof callback !== 'function') return Promise.reject(new TypeError('A lock callback is required'));
      if (options.mode && options.mode !== 'exclusive') return Promise.reject(new TypeError('Fixture supports exclusive locks only'));
      name = String(name);
      const state = states.get(name) || { held: false, queue: [] };
      if (options.ifAvailable && (state.held || state.queue.length)) return Promise.resolve().then(() => callback(null));
      states.set(name, state);
      return new Promise((resolve, reject) => {
        state.queue.push({ callback, resolve, reject });
        drain(name, state);
      });
    },
  };
}
