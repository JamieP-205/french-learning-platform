// WCAG 2.x relative-luminance contrast checker for the design-direction note.
function lum(hex) {
  const c = hex.replace("#", "");
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(c.slice(i, i + 2), 16) / 255);
  const f = (v) => (v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}
function ratio(a, b) {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const light = {
  paper: "#f8f2e4",
  surface: "#fffdf6",
  ink: "#1f2c40",
  inkSoft: "#4c576b",
  terracotta: "#a84a30",
  slate: "#44638d",
  garden: "#48693c",
  amber: "#8a6116",
  danger: "#a83226",
  dangerSurface: "#f7e3dc",
  successSurface: "#e7edd9",
  coachingSurface: "#f5e7c8",
};

const dark = {
  paper: "#151d2b",
  surface: "#1d2737",
  raised: "#26324a",
  text: "#ece5d3",
  textSoft: "#b4af9f",
  terracotta: "#e59274",
  slate: "#96b5d9",
  garden: "#a3c491",
  amber: "#dcb05c",
  danger: "#f0917f",
};

const checks = [
  // Light theme text pairs (need 4.5)
  ["L body text", light.ink, light.paper, 4.5],
  ["L body text on card", light.ink, light.surface, 4.5],
  ["L soft text", light.inkSoft, light.paper, 4.5],
  ["L soft text on card", light.inkSoft, light.surface, 4.5],
  ["L accent text (eyebrow)", light.terracotta, light.paper, 4.5],
  ["L accent text on card", light.terracotta, light.surface, 4.5],
  ["L slate text", light.slate, light.paper, 4.5],
  ["L garden text", light.garden, light.surface, 4.5],
  ["L amber text", light.amber, light.surface, 4.5],
  ["L danger text", light.danger, light.dangerSurface, 4.5],
  ["L button label (paper on ink)", light.paper, light.ink, 4.5],
  ["L button label (white on terracotta)", "#ffffff", light.terracotta, 4.5],
  // Light UI pairs (need 3)
  ["L focus ring vs paper", light.amber, light.paper, 3],
  ["L primary button vs paper", light.ink, light.paper, 3],
  ["L accent button vs paper", light.terracotta, light.paper, 3],
  ["L slate UI vs paper", light.slate, light.paper, 3],
  ["L garden UI vs surface", light.garden, light.surface, 3],
  // Dark theme text pairs
  ["D body text", dark.text, dark.paper, 4.5],
  ["D body text on card", dark.text, dark.surface, 4.5],
  ["D body text on raised", dark.text, dark.raised, 4.5],
  ["D soft text", dark.textSoft, dark.paper, 4.5],
  ["D soft text on card", dark.textSoft, dark.surface, 4.5],
  ["D accent text", dark.terracotta, dark.paper, 4.5],
  ["D accent text on card", dark.terracotta, dark.surface, 4.5],
  ["D slate text", dark.slate, dark.surface, 4.5],
  ["D garden text", dark.garden, dark.surface, 4.5],
  ["D amber text", dark.amber, dark.surface, 4.5],
  ["D danger text", dark.danger, dark.surface, 4.5],
  ["D button label (paper on terracotta?)", dark.paper, dark.terracotta, 4.5],
  // Dark UI pairs
  ["D focus ring vs paper", dark.amber, dark.paper, 3],
  ["D accent UI vs paper", dark.terracotta, dark.paper, 3],
  ["D slate UI vs paper", dark.slate, dark.paper, 3],
  ["D card edge vs paper", dark.raised, dark.paper, 1.2],
];

let failures = 0;
for (const [name, fg, bg, min] of checks) {
  const r = ratio(fg, bg);
  const ok = r >= min;
  if (!ok) failures += 1;
  console.log(`${ok ? "PASS" : "FAIL"}  ${r.toFixed(2)}  (need ${min})  ${name}  ${fg} on ${bg}`);
}
console.log(failures === 0 ? "ALL PASS" : `${failures} FAILURES`);
