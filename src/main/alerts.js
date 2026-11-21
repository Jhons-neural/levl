// Decide which notifications fire; memory is persisted per limit id.
const RECENT_MS = 30 * 60_000;

export function alertsToFire(limit, memory = {}, now) {
  const fire = [];
  const mem = { ...memory };
  const { remaining, resetsAt } = limit;

  if (mem.wasLowFor && mem.wasLowFor !== resetsAt) {
    // previous low window has reset; only announce it if that just happened (not after sleep)
    const since = now - Date.parse(mem.wasLowFor);
    if (since >= 0 && since <= RECENT_MS) fire.push('refill');
    delete mem.wasLowFor;
  }
  if (remaining <= 20 && resetsAt && mem.lowFiredFor !== resetsAt) {
    fire.push('low');
    mem.lowFiredFor = resetsAt;
    mem.wasLowFor = resetsAt;
  }
  return { fire, memory: mem };
}
