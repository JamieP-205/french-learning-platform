// Remy, drawn by hand in the garden palette: terracotta coat, cream muzzle,
// and a slate scarf borrowed from the garden door. Poses switch by class;
// idle life (blink, tail sway, breathing) is pure CSS and goes still under
// reduced motion. Decorative only, so the SVG stays out of the a11y tree.

export type RemyPose = "idle" | "wave" | "thinking" | "celebrating";

export function RemyArt({ pose = "idle", size = 96 }: { pose?: RemyPose; size?: number }) {
  return (
    <svg
      aria-hidden="true"
      className={`remy-art remy-pose-${pose}`}
      height={Math.round(size * (190 / 240))}
      viewBox="0 0 240 190"
      width={size}
    >
      <defs>
        <linearGradient id="remyBody" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#d47f4e" />
          <stop offset="100%" stopColor="#b05a32" />
        </linearGradient>
        <linearGradient id="remyHead" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#dd8a58" />
          <stop offset="100%" stopColor="#c2683c" />
        </linearGradient>
        <linearGradient id="remyTail" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#b05a32" />
          <stop offset="70%" stopColor="#c96f42" />
          <stop offset="100%" stopColor="#f4ead6" />
        </linearGradient>
      </defs>

      <g className="remy-tail">
        <path d="M128 150c26 8 56 6 74-10 6-6 10-14 8-22-14 4-20-2-30 2-16 6-30 14-52 18z" fill="url(#remyTail)" />
      </g>

      <g className="remy-breath">
        <path d="M120 158c-22 0-36-12-36-30 0-14 8-26 20-34l32 0c12 8 20 20 20 34 0 18-14 30-36 30z" fill="url(#remyBody)" />
        <path d="M120 158c-10 0-17-5-17-13 0-7 5-12 11-14 2 2 4 3 6 3s4-1 6-3c6 2 11 7 11 14 0 8-7 13-17 13z" fill="#f4ead6" />
      </g>

      <g className="remy-head-group">
        <path d="M95 44l-3-26c10 2 17 9 21 18z" fill="#c2683c" />
        <path d="M96 40l-2-15c6 2 10 6 13 11z" fill="#3c2a20" />
        <path d="M145 44l3-26c-10 2-17 9-21 18z" fill="#c2683c" />
        <path d="M144 40l2-15c-6 2-10 6-13 11z" fill="#3c2a20" />
        <path
          d="M120 100c-16 0-30-8-34-22-3-11 1-24 10-32 7-6 16-9 24-9s17 3 24 9c9 8 13 21 10 32-4 14-18 22-34 22z"
          fill="url(#remyHead)"
        />
        <path d="M120 100c-7 0-13-2-18-6 2-11 8-20 18-24 10 4 16 13 18 24-5 4-11 6-18 6z" fill="#f4ead6" />
        <path d="M120 88c-2.6 0-4.2-1.5-4.2-3.6 1.6-1.4 6.8-1.4 8.4 0 0 2.1-1.6 3.6-4.2 3.6z" fill="#2a2018" />
        <path d="M120 92c0 3-2 4.6-5 5M120 92c0 3 2 4.6 5 5" fill="none" stroke="#2a2018" strokeLinecap="round" strokeWidth="1.6" />
        <g className="remy-eyes">
          <ellipse cx="103" cy="66" fill="#2a2018" rx="4.4" ry="5.2" />
          <ellipse cx="137" cy="66" fill="#2a2018" rx="4.4" ry="5.2" />
          <circle cx="104.6" cy="64" fill="#fff" opacity="0.85" r="1.4" />
          <circle cx="138.6" cy="64" fill="#fff" opacity="0.85" r="1.4" />
        </g>
      </g>

      <path
        d="M97 103c6 6 14 9 23 9s17-3 23-9c2 3 3 6 3 9-7 6-16 9-26 9s-19-3-26-9c0-3 1-6 3-9z"
        fill="#44638d"
      />
      <path d="M130 116l10 22c3 7 13 5 12-2l-4-24c-5 3-12 4-18 4z" fill="#5a7ba6" />

      <path className="remy-paw" d="M92 146c-8 2-14 7-14 12h22c0-5-3-9-8-12z" fill="#8a4f2c" />
      <path className="remy-paw" d="M148 146c8 2 14 7 14 12h-22c0-5 3-9 8-12z" fill="#8a4f2c" />

      <path
        className="remy-paw-raised"
        d="M158 128c10-6 16-14 17-24 6 1 9 6 8 12-2 10-10 17-21 19-3 .5-6-4-4-7z"
        fill="#b05a32"
      />
      <g className="remy-spark">
        <circle cx="52" cy="52" fill="#dcb05c" r="3.4" />
        <circle cx="188" cy="40" fill="#dcb05c" r="2.6" />
        <circle cx="200" cy="78" fill="#e59274" r="2.2" />
        <circle cx="42" cy="90" fill="#e59274" r="2" />
      </g>
    </svg>
  );
}
