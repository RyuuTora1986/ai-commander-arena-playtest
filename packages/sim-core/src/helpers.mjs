export function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

export function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function moveTowards(current, target, maxDistance) {
  const deltaX = target.x - current.x;
  const deltaY = target.y - current.y;
  const remaining = Math.hypot(deltaX, deltaY);

  if (remaining === 0 || remaining <= maxDistance) {
    return { x: target.x, y: target.y };
  }

  const ratio = maxDistance / remaining;
  return {
    x: current.x + deltaX * ratio,
    y: current.y + deltaY * ratio
  };
}

export function teamEnemy(teamId) {
  return teamId === 'blue' ? 'red' : 'blue';
}

export function averagePosition(positions) {
  if (positions.length === 0) {
    return { x: 0, y: 0 };
  }

  const totals = positions.reduce(
    (sum, point) => ({
      x: sum.x + point.x,
      y: sum.y + point.y
    }),
    { x: 0, y: 0 }
  );

  return {
    x: totals.x / positions.length,
    y: totals.y / positions.length
  };
}

export function sum(values) {
  return values.reduce((total, value) => total + value, 0);
}
