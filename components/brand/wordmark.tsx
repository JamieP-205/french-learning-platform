// The fox mark next to the app name. Plain markup with no client state, so
// server and client components can both render it.

export function FoxMark({ size = 22 }: { size?: number }) {
  return (
    <svg aria-hidden="true" height={size} viewBox="0 0 64 64" width={size}>
      <path d="M21 24l-4-13c5 1 9 5 11 9z" fill="#c2683c" />
      <path d="M22 22l-2-8c3 1 5 3 7 6z" fill="#3c2a20" />
      <path d="M43 24l4-13c-5 1-9 5-11 9z" fill="#c2683c" />
      <path d="M42 22l2-8c-3 1-5 3-7 6z" fill="#3c2a20" />
      <path
        d="M32 52c-9 0-16-5-18-13-2-6 1-13 6-17 4-3 8-5 12-5s8 2 12 5c5 4 8 11 6 17-2 8-9 13-18 13z"
        fill="#c2683c"
      />
      <path d="M32 52c-4 0-8-1-11-4 1-6 5-11 11-13 6 2 10 7 11 13-3 3-7 4-11 4z" fill="#f4ead6" />
      <ellipse cx="24.5" cy="31" fill="#2a2018" rx="2.6" ry="3" />
      <ellipse cx="39.5" cy="31" fill="#2a2018" rx="2.6" ry="3" />
      <path d="M32 42c-1.6 0-2.6-0.9-2.6-2.2 1-0.9 4.2-0.9 5.2 0 0 1.3-1 2.2-2.6 2.2z" fill="#2a2018" />
      <path
        d="M18 47c4 3 9 5 14 5s10-2 14-5c1 2 1 4 0 5-4 3-9 5-14 5s-10-2-14-5c-1-1-1-3 0-5z"
        fill="#44638d"
      />
    </svg>
  );
}

export function Wordmark() {
  return (
    <span className="inline-flex items-center gap-2">
      <FoxMark />
      <span className="font-black tracking-tight text-ink">French for Life</span>
    </span>
  );
}
