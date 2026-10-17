// Local integration preparation only. The approved transport is injected later;
// this module knows no Cabinet URL, bearer, cookie, profile or wire error schema.
// Never inject this private state into the native public WebView bridge.
export function createProtectedReader({ read, validate, timeoutMs = 15000 }) {
  if (typeof read !== 'function' || typeof validate !== 'function' ||
      !Number.isSafeInteger(timeoutMs) || timeoutMs <= 0 || timeoutMs > 30000) {
    throw new Error('Invalid protected reader configuration');
  }
  let epoch = 0, active = null, disposed = false;
  let state = { status: 'idle', materialId: null, value: null };
  const listeners = new Set();
  const publish = next => { state = next; for (const listener of listeners) listener(); };
  function reset() {
    ++epoch;
    const previous = active; active = null;
    publish({ status: 'idle', materialId: null, value: null });
    previous?.abort();
  }
  async function open(materialId) {
    if (disposed) return;
    reset();
    const own = ++epoch;
    if (typeof materialId !== 'string' || !/^[A-Za-z0-9_-]{1,160}$/.test(materialId)) {
      publish({ status: 'unavailable', materialId: null, value: null });
      return;
    }
    const abort = new AbortController(); active = abort;
    let timer, stopped;
    const interrupted = new Promise((_, reject) => {
      stopped = () => reject(new Error('Protected read interrupted'));
      abort.signal.addEventListener('abort', stopped, { once: true });
      timer = setTimeout(() => abort.abort(), timeoutMs);
    });
    publish({ status: 'loading', materialId, value: null });
    try {
      const result = await Promise.race([Promise.resolve().then(() => {
        if (abort.signal.aborted) throw new Error('Protected read interrupted');
        return read(materialId, abort.signal);
      }), interrupted]);
      if (disposed || own !== epoch) return;
      if (result?.kind === 'allowed') {
        const value = validate(result.value, materialId);
        if (value === null || value === undefined) throw new Error('Invalid protected material');
        publish({ status: 'ready', materialId, value });
      } else {
        const status = { 'invalid-credential': 'sign-in-required', denied: 'denied',
          missing: 'missing', unavailable: 'unavailable' }[result?.kind] || 'unavailable';
        publish({ status, materialId, value: null });
      }
    } catch {
      if (!disposed && own === epoch) publish({ status: 'unavailable', materialId, value: null });
    } finally {
      clearTimeout(timer);
      abort.signal.removeEventListener('abort', stopped);
      if (active === abort) active = null;
    }
  }
  return {
    getState: () => state,
    subscribe(listener) { if (disposed) return () => {}; listeners.add(listener); return () => listeners.delete(listener); },
    open,
    // Logout, account/issuer change, Back/close and backgrounding discard private
    // material immediately. A later open always makes a new authoritative read.
    invalidate: reset,
    dispose() { if (disposed) return; disposed = true; reset(); listeners.clear(); },
  };
}
