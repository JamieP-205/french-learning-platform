// The garden's growth pieces, drawn to sit inside the watercolour
// background: sampled colours, gradient washes, and irregular silhouettes.
// Turbulence is applied per small shape only; large-area filters are too
// expensive to rasterise on low-end devices.

export type GardenPieceId =
  | "sun"
  | "sprout"
  | "flowers"
  | "path"
  | "bench"
  | "cafe"
  | "lanterns"
  | "tree"
  | "canopy";

function Lantern({ x, baseY, scale = 1 }: { x: number; baseY: number; scale?: number }) {
  const armY = baseY - 64 * scale;
  const headX = x + 10 * scale;
  return (
    <g>
      <path
        d={`M${x} ${baseY}v-${58 * scale}c0-6 4-9 ${10 * scale}-9`}
        fill="none"
        stroke="#3c4a5c"
        strokeLinecap="round"
        strokeWidth={2.3 * scale}
      />
      <path d={`M${headX} ${armY + 3}v5`} stroke="#3c4a5c" strokeWidth={1.5 * scale} />
      <circle cx={headX} cy={armY + 15} fill="url(#gardenLanternGlow)" r={12.5 * scale} />
      <path
        d={`M${headX - 3.5 * scale} ${armY + 8}h${7 * scale}l${1.5 * scale} 3v8l-${1.5 * scale} 3h-${7 * scale}l-${1.5 * scale}-3v-8z`}
        fill="#f1bd52"
      />
      <path d={`M${headX - 3.5 * scale} ${armY + 8}h${7 * scale}`} stroke="#3c4a5c" strokeWidth={1.3 * scale} />
    </g>
  );
}

// One petal blob, drawn once in local coordinates and placed per flower.
const PETAL_PATH =
  "M0 0c4-7 12-8 16-3 4 4 1 10-4 14 7 1 11 6 8 12-2 5-10 5-16 1-1 6-6 9-11 7-5-3-5-9-1-14-7 1-11-3-9-9 1-5 8-6 13-3-3-6-1-10 4-5z";

function Wildflower({
  x,
  baseY,
  height,
  tone,
  size = 1,
}: {
  x: number;
  baseY: number;
  height: number;
  tone: "a" | "b";
  size?: number;
}) {
  const top = baseY - height;
  return (
    <g>
      <path
        d={`M${x + 3} ${baseY}c-1-${Math.round(height * 0.4)} 0-${Math.round(height * 0.7)} 2-${height}`}
        fill="none"
        stroke="url(#gardenStem)"
        strokeLinecap="round"
        strokeWidth={3 * size}
      />
      <g transform={`translate(${x} ${top}) scale(${size})`}>
        <path d={PETAL_PATH} fill={tone === "a" ? "url(#gardenPetalA)" : "url(#gardenPetalB)"} filter="url(#gardenSoften)" />
        <circle cx="4" cy="10" fill="#e9c46a" opacity="0.95" r="3.4" />
      </g>
    </g>
  );
}

export function GardenScene({
  earned,
  fresh,
  away,
}: {
  earned: Set<string>;
  fresh?: Set<string>;
  away: boolean;
}) {
  const treeCrowned = earned.has("canopy");
  const newly = fresh ?? new Set<string>();
  const freshOrder = [...newly];
  // Only freshly earned pieces animate in; settled pieces stand still so the
  // growth reads as an event rather than page noise.
  const entrance = (id: GardenPieceId, kind: "grow" | "rise") =>
    newly.has(id)
      ? {
          className: `garden-${kind}`,
          style: { animationDelay: `${300 + freshOrder.indexOf(id) * 460}ms` },
        }
      : {};
  return (
    <div className={`garden-scene ${away ? "garden-away" : ""}`}>
      <svg
        aria-hidden="true"
        className="garden-growth"
        preserveAspectRatio="xMidYMid slice"
        viewBox="0 0 640 300"
      >
        <defs>
          <radialGradient id="gardenPetalA" cx="50%" cy="38%" r="72%">
            <stop offset="0%" stopColor="#e8a48e" stopOpacity="0.95" />
            <stop offset="62%" stopColor="#c76e5c" stopOpacity="0.88" />
            <stop offset="100%" stopColor="#a84a30" stopOpacity="0.75" />
          </radialGradient>
          <radialGradient id="gardenPetalB" cx="50%" cy="38%" r="72%">
            <stop offset="0%" stopColor="#efc0b4" stopOpacity="0.95" />
            <stop offset="65%" stopColor="#d99a8a" stopOpacity="0.85" />
            <stop offset="100%" stopColor="#b5705f" stopOpacity="0.7" />
          </radialGradient>
          <linearGradient id="gardenStem" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#6d7f4e" />
            <stop offset="100%" stopColor="#48693c" />
          </linearGradient>
          <linearGradient id="gardenLeaf" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#8ba06a" />
            <stop offset="100%" stopColor="#5d7050" />
          </linearGradient>
          <linearGradient id="gardenWood" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#9a7250" />
            <stop offset="100%" stopColor="#6e4c33" />
          </linearGradient>
          <linearGradient id="gardenStone" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#e3d3ac" />
            <stop offset="100%" stopColor="#c2ab7f" />
          </linearGradient>
          <radialGradient id="gardenSunGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#f6d98a" stopOpacity="0.95" />
            <stop offset="55%" stopColor="#eec269" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#eec269" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="gardenLanternGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#f4d792" stopOpacity="0.9" />
            <stop offset="60%" stopColor="#eec269" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#eec269" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="gardenFoliageA" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#7a8f5e" />
            <stop offset="100%" stopColor="#4e6647" />
          </linearGradient>
          <linearGradient id="gardenFoliageB" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#8ba06a" />
            <stop offset="100%" stopColor="#5d7050" />
          </linearGradient>
          <linearGradient id="gardenAwning" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#c76e5c" />
            <stop offset="100%" stopColor="#a84a30" />
          </linearGradient>
          <filter id="gardenSoften" x="-25%" y="-25%" width="150%" height="150%">
            <feTurbulence baseFrequency="0.9" numOctaves="1" result="n" type="fractalNoise" />
            <feDisplacementMap in="SourceGraphic" in2="n" scale="2.4" />
          </filter>
        </defs>

        {earned.has("sun") && (
          <g {...entrance("sun", "rise")} data-piece="sun">
            <g className="garden-sun">
              <circle cx="554" cy="48" fill="url(#gardenSunGlow)" r="40" />
              <circle cx="554" cy="48" fill="#f3d68a" opacity="0.9" r="15" />
            </g>
          </g>
        )}

        {earned.has("sprout") && (
          <g {...entrance("sprout", "grow")} data-piece="sprout">
            <path d="M111 240c-1-14 1-24 6-36" fill="none" stroke="url(#gardenStem)" strokeLinecap="round" strokeWidth="4" />
            <path filter="url(#gardenSoften)" d="M114 214c-9-1-15-7-16-15 8-1 14 3 17 9z" fill="url(#gardenLeaf)" />
            <path filter="url(#gardenSoften)" d="M116 202c2-8 9-13 17-13 0 8-5 14-12 16z" fill="url(#gardenFoliageB)" />
          </g>
        )}

        {earned.has("flowers") && (
          <g {...entrance("flowers", "grow")} data-piece="flowers">
            <Wildflower baseY={241} height={32} tone="a" x={152} />
            <Wildflower baseY={242} height={27} size={0.85} tone="b" x={177} />
            <Wildflower baseY={240} height={33} tone="b" x={200} />
            <Wildflower baseY={242} height={28} size={0.85} tone="a" x={224} />
          </g>
        )}

        {earned.has("path") && (
          <g {...entrance("path", "rise")} data-piece="path">
            <path d="M262 254c8-4 22-4 30 0 3 2 3 6-1 8-9 3-20 3-28 0-4-2-4-6-1-8z" fill="url(#gardenStone)" opacity="0.95" />
            <path d="M310 233c7-3 18-3 25 0 3 2 3 5-1 7-7 2-16 2-23 0-3-2-4-5-1-7z" fill="url(#gardenStone)" opacity="0.9" />
            <path d="M352 215c6-3 15-3 21 0 3 1 2 5-1 6-6 2-13 2-19 0-3-1-3-4-1-6z" fill="url(#gardenStone)" opacity="0.85" />
          </g>
        )}

        {earned.has("bench") && (
          <g {...entrance("bench", "rise")} data-piece="bench">
            <ellipse cx="336" cy="250" fill="#1f2c40" opacity="0.1" rx="42" ry="5" />
            <path d="M300 224c24-3 50-3 72 0 3 0 4 8 0 8-24 3-48 3-72 0-4 0-3-8 0-8z" fill="url(#gardenWood)" />
            <path d="M304 204c22-2 44-2 64 0 3 0 3 7 0 7-21 2-42 2-64 0-3 0-3-7 0-7z" fill="url(#gardenWood)" opacity="0.92" />
            <path d="M306 232l4 16M362 232l4 16M306 211l-1 14M366 211l1 14" fill="none" stroke="#5f4530" strokeLinecap="round" strokeWidth="4" />
          </g>
        )}

        {earned.has("cafe") && (
          <g {...entrance("cafe", "rise")} data-piece="cafe">
            <ellipse cx="452" cy="254" fill="#1f2c40" opacity="0.1" rx="38" ry="4.5" />
            <path d="M424 246l-8 8M480 246l8 8" stroke="#5f4530" strokeLinecap="round" strokeWidth="3" />
            <path d="M422 220c20-2 40-2 60 0 2 0 3 2 3 4l-2 20c-20 2-42 2-62 0l-2-20c0-2 1-4 3-4z" fill="url(#gardenWood)" />
            <path d="M424 231c18-1.6 38-1.6 56 0" fill="none" opacity="0.5" stroke="#5f4530" strokeWidth="1.4" />
            <circle cx="436" cy="250" fill="none" r="8.5" stroke="#5f4530" strokeWidth="2.6" />
            <circle cx="436" cy="250" fill="#5f4530" r="1.8" />
            <path d="M436 242v16M428 250h16M430.5 244.5l11 11M441.5 244.5l-11 11" opacity="0.8" stroke="#5f4530" strokeWidth="1.2" />
            <circle cx="468" cy="250" fill="none" r="8.5" stroke="#5f4530" strokeWidth="2.6" />
            <circle cx="468" cy="250" fill="#5f4530" r="1.8" />
            <path d="M468 242v16M460 250h16M462.5 244.5l11 11M473.5 244.5l-11 11" opacity="0.8" stroke="#5f4530" strokeWidth="1.2" />
            <path d="M420 220v-24M484 220v-24" stroke="#6e4c33" strokeLinecap="round" strokeWidth="2.2" />
            <path
              filter="url(#gardenSoften)"
              d="M412 196c26-5 54-5 80 0 2 0 3 3 1 4-3 2-4 6-8 6-22-2-44-2-66 0-4 0-5-4-8-6-2-1-1-4 1-4z"
              fill="url(#gardenAwning)"
              opacity="0.92"
            />
            <path d="M430 194c3-.4 6-.7 9-.9l1 10c-3 .2-6 .4-9 .8zM464 193.4l9 .5-1 10c-3-.3-6-.4-9-.5z" fill="#f2e7cf" opacity="0.8" />
            <path d="M440 216c2-3 5-3 6 0 .5 2-1 4-3 4s-3.5-2-3-4z" fill="#f2e7cf" />
            <path d="M452 214h7v5c0 1.5-1.5 2.5-3.5 2.5S452 220.5 452 219zM459 215.5c1.8 0 2.6 2 1.2 3l-1.5 1" fill="none" stroke="#f2e7cf" strokeWidth="1.2" />
          </g>
        )}

        {earned.has("lanterns") && (
          <g {...entrance("lanterns", "rise")} data-piece="lanterns">
            <g className="garden-lanterns">
              <Lantern baseY={246} x={66} />
              <Lantern baseY={238} scale={0.92} x={250} />
              <Lantern baseY={232} scale={0.85} x={488} />
              <Lantern baseY={250} x={614} />
            </g>
          </g>
        )}

        {earned.has("tree") && (
          <g {...entrance("tree", "grow")} data-piece="tree">
            <ellipse cx="568" cy="242" fill="#1f2c40" opacity="0.1" rx="26" ry="4.5" />
            <path d="M563 240c3-30 1-58 6-88 4 30 5 58 7 88z" fill="url(#gardenWood)" />
            {!treeCrowned && (
              <>
                <path filter="url(#gardenSoften)" d="M567 168c-18 0-30-12-28-28 2-14 15-24 29-24s26 10 28 24c2 16-11 28-29 28z" fill="url(#gardenFoliageA)" />
                <path filter="url(#gardenSoften)" d="M547 158c-10-2-16-10-14-19 2-8 10-13 18-12" fill="url(#gardenFoliageB)" opacity="0.9" />
                <path filter="url(#gardenSoften)" d="M588 158c10-2 16-10 14-19-2-8-10-13-18-12" fill="url(#gardenFoliageB)" opacity="0.9" />
              </>
            )}
          </g>
        )}

        {treeCrowned && (
          <g {...entrance("canopy", "grow")} data-piece="canopy">
            <path filter="url(#gardenSoften)" d="M567 150c-26 0-42-15-40-36 2-19 20-32 40-32s38 13 40 32c2 21-14 36-40 36z" fill="url(#gardenFoliageA)" opacity="0.95" />
            <path filter="url(#gardenSoften)" d="M537 140c-13-3-20-13-17-24 2-10 12-16 22-15" fill="url(#gardenFoliageB)" opacity="0.9" />
            <path filter="url(#gardenSoften)" d="M597 140c13-3 20-13 17-24-2-10-12-16-22-15" fill="url(#gardenFoliageB)" opacity="0.9" />
            <circle cx="552" cy="120" fill="#e9c46a" opacity="0.8" r="2.2" />
            <circle cx="580" cy="112" fill="#e9c46a" opacity="0.7" r="2" />
            <circle cx="568" cy="132" fill="#e9c46a" opacity="0.6" r="1.8" />
          </g>
        )}
      </svg>
    </div>
  );
}
