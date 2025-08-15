function interpolate(start: number, end: number, amount: number): number {
  const clampedAmount = Math.max(0, Math.min(1, amount));
  return start * (1 - clampedAmount) + end * clampedAmount;
}

export function colorForPct(p: number): string {
  let h: number, s: number, l: number;

  if (p >= 25) {
    // > 25%: Bright cyan, getting more "toxic"
    const amount = (p - 25) / 25;
    h = interpolate(180, 175, amount);
    s = interpolate(85, 100, amount);
    l = interpolate(55, 50, amount);
  } else if (p >= 20) {
    // 20-25%: Darker blue to bright cyan
    const amount = (p - 20) / 5;
    h = interpolate(210, 180, amount);
    s = interpolate(70, 85, amount);
    l = interpolate(50, 55, amount);
  } else if (p >= 15) {
    // 15-20%: Dark purple to darker blue
    const amount = (p - 15) / 5;
    h = interpolate(270, 210, amount);
    s = interpolate(60, 70, amount);
    l = interpolate(45, 50, amount);
  } else {
    // 0-15%: Washed-out light blue to dark purple
    const amount = p / 15;
    h = interpolate(220, 270, amount);
    s = interpolate(50, 60, amount);
    l = interpolate(80, 45, amount);
  }

  return `hsl(${Math.round(h)}, ${Math.round(s)}%, ${Math.round(l)}%)`;
}