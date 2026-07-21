# Design direction: the learning garden, drawn by hand

Open `design-direction.html` next to this file for the visual version with live samples.
This note explains the choices in plain language.

## The one idea

The progress page already owns the app's best visual: a walled French garden painted in
watercolour. The direction is to let that painting set the rules for everything else. Warm
limestone paper instead of plain white, the door's slate blue as a new secondary colour, olive
garden greens for success and growth, dusty terracotta for warmth and action. Light mode is the
garden in daylight. Dark mode is the same garden by lantern light: deep blue night air, parchment
text, accents glowing one step brighter. It is never grey.

## Palette

Daylight: paper #f8f2e4, surface #fffdf6, ink #1f2c40, terracotta #a84a30, slate #44638d,
garden green #48693c, amber #8a6116, danger #a83226.

Lantern light: night paper #151d2b, surface #1d2737, raised #26324a, parchment text #ece5d3,
soft text #b4af9f, terracotta #e59274, slate #96b5d9, garden #a3c491, amber #dcb05c,
danger #f0917f.

The current colours survive as warmer versions of themselves, so the change reads as the app
coming into focus rather than a rebrand. Every text pair clears WCAG 2.2 AA at 4.5 to 1 and every
interface pair clears 3 to 1. The ratios in the HTML were computed with the standard
relative-luminance formula, and the checking script joins the repo so future tweaks stay honest.

## Type

No webfonts. The system sans stack stays for the interface: fast, familiar, nothing to download.
French is always set in the serif stack (Charter, Iowan Old Style, Cambria, Georgia), so the
language being learned looks special on every screen. Weights cap at 700. The tightened radius
scale stays.

## Illustration

One rule: everything drawn must look like it belongs inside the garden painting. Layered
translucent gradient washes, irregular silhouettes, a whisper of turbulence texture at the edges.
No flat circles, no clip art. Applied first to the garden growth pieces (replacing the current
sticker-like primitives) and to Remy, who becomes a hand-built SVG fox in the same palette with a
slate scarf borrowed from the garden door. Decorative art stays out of the accessibility tree, and
every animation has a still version under reduced motion. A practical note from building the
samples: turbulence filters are expensive when applied to large areas, so the real garden art will
scope them to small shapes only.

## Navigation

Desktop navigation keeps its order, restyled. The mobile bar grows to five labelled tabs with
Review promoted, because spaced review is the product's heart. The lesson screen gains a minimal
header with Save and exit. The homepage becomes a real front door in the garden world, and
signed-in visitors skip it entirely.

## What this unlocks, in order

1. Colours become CSS variables with today's values, a pixel-identical refactor.
2. Dark mode infrastructure: device default, header toggle, saved per account, no flash.
3. The refreshed palette and dark sweep across every component.
4. Brand marks: favicon, app icons, social image, a small fox wordmark.
5. The clearer navigation and lesson header.
6. The copy pass, with an em-dash check joining the release gate.
