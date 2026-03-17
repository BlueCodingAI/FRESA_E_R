/** Small flag icons (SVG) — reliable on Windows where emoji flags often fail */

export function FlagUS({ className = "w-7 h-[1.05rem] shrink-0" }: { className?: string }) {
  const h = 32;
  const w = 60;
  const stripes = 13;
  const sh = h / stripes;
  return (
    <svg
      className={`rounded-[3px] shadow-sm ring-1 ring-white/10 ${className}`}
      viewBox={`0 0 ${w} ${h}`}
      aria-hidden
    >
      {Array.from({ length: stripes }, (_, i) => (
        <rect
          key={i}
          fill={i % 2 === 0 ? "#B22234" : "#fff"}
          x={0}
          y={i * sh}
          width={w}
          height={sh}
        />
      ))}
      <rect fill="#3C3B6E" width="24" height={7 * sh} />
      {[
        [3, 2.3],
        [7, 2.3],
        [11, 2.3],
        [15, 2.3],
        [19, 2.3],
        [5, 5.4],
        [9, 5.4],
        [13, 5.4],
        [17, 5.4],
        [3, 8.5],
        [7, 8.5],
        [11, 8.5],
        [15, 8.5],
        [19, 8.5],
        [5, 11.6],
        [9, 11.6],
        [13, 11.6],
        [17, 11.6],
      ].map(([cx, cy], i) => (
        <circle key={i} cx={cx} cy={cy} r="0.75" fill="#fff" />
      ))}
    </svg>
  );
}

export function FlagRussia({ className = "w-7 h-[1.05rem] shrink-0" }: { className?: string }) {
  return (
    <svg
      className={`rounded-[3px] shadow-sm ring-1 ring-white/10 ${className}`}
      viewBox="0 0 60 32"
      aria-hidden
    >
      <rect fill="#fff" width="60" height="10.67" />
      <rect fill="#0039A6" y="10.67" width="60" height="10.67" />
      <rect fill="#D52B1E" y="21.33" width="60" height="10.67" />
    </svg>
  );
}
