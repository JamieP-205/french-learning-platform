// Small stroke icons for navigation. They inherit currentColor so they
// follow text colour through both themes.

type IconProps = { size?: number };

function base(size: number) {
  return {
    "aria-hidden": true as const,
    fill: "none",
    height: size,
    stroke: "currentColor",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    strokeWidth: 2,
    viewBox: "0 0 24 24",
    width: size,
  };
}

export function SunIcon({ size = 20 }: IconProps) {
  return (
    <svg {...base(size)}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  );
}

export function BookIcon({ size = 20 }: IconProps) {
  return (
    <svg {...base(size)}>
      <path d="M12 6c-1.5-1.6-3.7-2-6.5-2-.8 0-1.5.7-1.5 1.5v11c0 .8.7 1.5 1.5 1.5 2.8 0 5 .4 6.5 2 1.5-1.6 3.7-2 6.5-2 .8 0 1.5-.7 1.5-1.5v-11c0-.8-.7-1.5-1.5-1.5-2.8 0-5 .4-6.5 2z" />
      <path d="M12 6v14" />
    </svg>
  );
}

export function ReviewIcon({ size = 20 }: IconProps) {
  return (
    <svg {...base(size)}>
      <path d="M3 12a9 9 0 0 1 15.5-6.2L21 8" />
      <path d="M21 3v5h-5" />
      <path d="M21 12a9 9 0 0 1-15.5 6.2L3 16" />
      <path d="M3 21v-5h5" />
    </svg>
  );
}

export function SproutIcon({ size = 20 }: IconProps) {
  return (
    <svg {...base(size)}>
      <path d="M12 21v-8" />
      <path d="M12 13c0-3.5 2.5-6 6.5-6 0 3.5-2.5 6-6.5 6z" />
      <path d="M12 10C12 7.2 10 5 6.8 5 6.8 7.8 8.8 10 12 10z" />
    </svg>
  );
}

export function MoreIcon({ size = 20 }: IconProps) {
  return (
    <svg {...base(size)}>
      <circle cx="5" cy="12" r="1.2" />
      <circle cx="12" cy="12" r="1.2" />
      <circle cx="19" cy="12" r="1.2" />
    </svg>
  );
}
