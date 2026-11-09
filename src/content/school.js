// @ts-check
// The village school's words and faces: Miss Juniper, the teacher, who
// watches the match from the touchline, the children's looks, and what the
// visitor hears when they score.
import { SCHOOL } from "../regions/school-layout.js";

// Miss Juniper streams in with the school (life.addResident), so she
// carries her own looks and lines.
export const SCHOOL_RESIDENTS = [
  {
    id: "juniper",
    name: "Miss Juniper",
    ...SCHOOL.residents.juniper,
    // Facing the pitch, south.
    facing: 0.15,
    coat: 0x5d7a8c,
    hair: 0x8a5a3c,
    skin: 0xe6b796,
    garment: "dress",
    collar: "round",
    collarColor: 0xf3ead6,
    neck: "scarf",
    neckColor: 0xc98a3d,
    hairStyle: "bun",
    glasses: true,
    boots: 0x5a4030,
    bootStyle: "shoe",
    carry: { right: "book" },
    armPose: [
      [0, -0.12],
      [-0.35, -1.1],
    ],
    size: 0.97,
    dialogue: [
      "Morning break runs until somebody scores, or until I get cold. Whichever comes second.",
      "The reds have the better shooters. The blues have Tilly in goal, and Tilly does not let things past.",
      "If the ball comes your way, give it a good kick. They’ll only shout at you a little.",
      "We start with sums after break. Nobody ever wants break to end. Neither do I, if I’m honest.",
    ],
  },
];

// Every child at the school. The first eight play the match, in the order
// src/game/school.js lists its players (each side's keeper, then its three
// runners); the reds wear red, the blues blue, and the keepers green and
// yellow jerseys. The last three play on the playground: on a swing, with a
// skipping rope and at hopscotch. Every child walks, so their hips, knees
// and elbows move.
const child = (/** @type {Record<string, any>} */ look) => ({
  garment: "shirt",
  rolled: true,
  trousers: 0x3d4552,
  socks: 0xf0e8d8,
  boots: 0x4a3a2e,
  bootStyle: "shoe",
  walks: true,
  size: 0.74,
  ...look,
});
const RED = 0xc4473a,
  BLUE = 0x3e6ea8;
export const SCHOOL_CHILDREN = [
  child({ coat: 0x5f9a4a, hair: 0x3b2a20, skin: 0xc58c66, hat: "peaked", capColor: 0x2f5a2c, size: 0.78 }),
  child({ coat: RED, hair: 0xd9a35c, skin: 0xf0c3a0, freckles: true }),
  child({ coat: RED, hair: 0x2e231c, skin: 0x8d5a3b, hairStyle: "plait", size: 0.72 }),
  child({ coat: RED, hair: 0x6b4430, skin: 0xe8b591, trousers: 0x6b5a46, patches: 0x8a7a5a, size: 0.76 }),
  child({ coat: 0xe2b23f, hair: 0xa8552e, skin: 0xf2c7a6, hairStyle: "pigtails", freckles: true, size: 0.73 }),
  child({ coat: BLUE, hair: 0x1f1a17, skin: 0xb27b55, size: 0.77 }),
  child({ coat: BLUE, hair: 0xc9a46a, skin: 0xf0c6a4, hairStyle: "bob", size: 0.71 }),
  child({ coat: BLUE, hair: 0x5a3a2a, skin: 0xd9a07c, trousers: 0x55606b, size: 0.75 }),
  // On the swing, with the skipping rope, at hopscotch.
  child({ coat: 0xd58aa0, garment: "dress", short: true, collar: "round", collarColor: 0xfbf3e4, hair: 0x7a4a2c, skin: 0xe9b896, hairStyle: "pigtails", size: 0.7 }),
  child({ coat: 0x8fb36a, garment: "dress", short: true, apron: "bib", apronColor: 0xf6eedc, hair: 0x2b201a, skin: 0x9a6444, hairStyle: "plait", size: 0.72 }),
  child({ coat: 0xe5c07a, hair: 0xb5763e, skin: 0xf1c4a2, trousers: 0x5b6a54, freckles: true, size: 0.69 }),
];

// What the visitor hears when the ball they kicked goes in.
export const SCHOOL_GOAL_LINES = [
  "Goal! The children cheer, then argue about whether grown-ups are allowed to score.",
  "It’s in! Miss Juniper claps. Half the pitch cheers, and the other half wants a rematch.",
  "Straight past the keeper. “That doesn’t count,” says someone. Everyone else says it does.",
];
