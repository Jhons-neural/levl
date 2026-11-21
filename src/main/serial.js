// Calls made while a run is in flight join that run instead of starting another.
export function serial(fn) {
  let running = null;
  return () => {
    if (!running) running = (async () => fn())().finally(() => { running = null; });
    return running;
  };
}
