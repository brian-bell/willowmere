// @ts-check
// The willow marsh's words: its resident, what the bird hide shows a patient
// watcher, and Wren's tips for the birds still to see.
import { MARSH } from "../regions/marsh-layout.js";

// Wren watches birds by the bench on the mere's east bank. She streams in with
// the marsh (life.addResident), so she carries her own looks and lines.
export const MARSH_RESIDENTS = [
  {
    id: "wren",
    name: "Wren",
    ...MARSH.residents.wren,
    // Facing west, over the mere.
    facing: -Math.PI / 2 - 0.2,
    coat: 0x6e7f5a,
    hair: 0xb07b4f,
    skin: 0xe0ae8c,
    chestPockets: true,
    belt: true,
    trousers: 0x8a7a5c,
    boots: 0x5a4030,
    bootStyle: "tall",
    hat: "bucket",
    hairStyle: "bob",
    freckles: true,
    spyglass: true,
    carry: { left: "book", right: "pencil" },
    armOut: 0.02,
    armPose: [
      [-0.42, -1.22],
      [-0.42, -1.22],
    ],
    headPose: [0.16, 0, 0],
    size: 0.9,
    dialogue: [
      "Shh. The heron’s been standing on one leg for an hour. I’m not about to spoil it.",
      "Every bird I’ve ever seen here goes in my little book. Every single one.",
      "The hide’s the best seat in the marsh. Sit still long enough and the reeds forget you’re there.",
    ],
  },
];

// Settling in at the hide, before a bird shows.
export const HIDE_SETTLE = [
  "You ease the shutter open and sit very still. The reeds whisper. Something stirs…",
  "You settle on the hide’s narrow bench and wait. A breeze runs across the water…",
  "Through the viewing slot, the mere lies smooth as glass. Then, a ripple…",
];
// A watch too soon after the last.
export const HIDE_QUIET = [
  "The reeds are still settling after the last visitor. Give them a moment.",
  "Nothing yet. The marsh is holding its breath.",
];
// Each bird's sighting.
export const BIRD_LINES = {
  heron:
    "A grey heron, stock-still in the shallows. It strikes, quick as a thought, and comes up with a silver fish.",
  moorhen:
    "A moorhen picks its way along the reed edge, flicking its white tail with every step.",
  grebe: "A little grebe pops up like a cork, looks about, and vanishes again with a tiny plop.",
  warbler:
    "A reed warbler clings to a swaying stem, chattering away as if it has a great deal to tell you.",
  kingfisher:
    "A flash of blue skims the water: a kingfisher, gone before you can quite believe it.",
  owl: "A barn owl drifts over the reeds, pale as a moth, without a single sound.",
  bittern:
    "From deep in the reeds comes a low boom, like someone blowing across a bottle. A bittern!",
};
// Wren's tip for a bird still to see, and her line once all are seen.
export const WREN_TIPS = {
  heron: "Watch the shallows on the far side. The heron fishes there most afternoons.",
  moorhen: "Moorhens are shy, but they can’t resist poking about the reed edge. Try the hide.",
  grebe: "There’s a little grebe on the mere. Blink and you’ll miss it diving.",
  warbler: "Listen for chattering in the reeds on a bright afternoon. That’s a reed warbler.",
  kingfisher: "If you’re lucky, a kingfisher comes by in the afternoon light. Keep your eyes on the water.",
  owl: "Come back at blue hour. A barn owl hunts over the reeds when the light goes soft.",
  bittern: "At blue hour, listen for a boom from the reeds. The bittern hides better than anyone.",
};
export const WREN_DONE = [
  "Every bird in the marsh! You’ve a better eye than I had at your age.",
  "You’ve seen them all. Now you just come for the quiet, like me.",
];
