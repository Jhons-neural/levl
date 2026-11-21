// Snap the meter to the nearest work-area edge; top/bottom → horizontal, sides → vertical.
export function clampToWorkArea(b, wa) {
  return {
    x: Math.min(Math.max(b.x, wa.x), wa.x + wa.width - b.width),
    y: Math.min(Math.max(b.y, wa.y), wa.y + wa.height - b.height),
  };
}

export function dock(b, wa, margin = 8, current = 'h') {
  const cx = b.x + b.width / 2, cy = b.y + b.height / 2;
  const d = {
    top: cy - wa.y,
    bottom: wa.y + wa.height - cy,
    left: cx - wa.x,
    right: wa.x + wa.width - cx,
  };
  let edge = Object.keys(d).reduce((a, k) => (d[k] < d[a] ? k : a));
  const limit = edge === 'top' || edge === 'bottom' ? wa.height * 0.25 : wa.width * 0.25;
  if (d[edge] > limit) edge = null;

  const orientation = edge === null ? current : edge === 'top' || edge === 'bottom' ? 'h' : 'v';
  const long = Math.max(b.width, b.height), short = Math.min(b.width, b.height);
  const width = orientation === 'h' ? long : short;
  const height = orientation === 'h' ? short : long;

  let { x, y } = clampToWorkArea({ x: Math.round(cx - width / 2), y: Math.round(cy - height / 2), width, height }, wa);
  if (edge === 'top') y = wa.y + margin;
  if (edge === 'bottom') y = wa.y + wa.height - height - margin;
  if (edge === 'left') x = wa.x + margin;
  if (edge === 'right') x = wa.x + wa.width - width - margin;
  return { orientation, edge, x, y, width, height };
}
