// @ts-check
// The allotments' words: Basil, who keeps them, what each plot says as it is
// rented, sown, watered and harvested, and Basil's word on how the plots are
// doing.
import { ALLOTMENTS } from "../regions/allotments-layout.js";

// Basil keeps the allotments from his potting shed. He streams in with them
// (life.addResident), so he carries his own looks and lines.
export const ALLOTMENT_RESIDENTS = [
  {
    id: "basil",
    name: "Basil",
    ...ALLOTMENTS.residents.basil,
    // Facing the main path, west.
    facing: -1.75,
    coat: 0x5e6b45,
    hair: 0xc9c2b4,
    skin: 0xd8a888,
    garment: "waistcoat",
    sleeve: 0xe6dcc4,
    rolled: true,
    trousers: 0x6a5a46,
    patches: 0x8a7a5a,
    boots: 0x3f5a40,
    soles: 0x2a3a2c,
    bootStyle: "wellies",
    hat: "flat",
    hairStyle: "balding",
    beard: "full",
    beardColor: 0xdcd6c8,
    lined: true,
    nose: 1.15,
    carry: { left: "fork" },
    armPose: [
      [0, -0.12],
      [-0.12, -0.35],
    ],
    size: 0.96,
    dialogue: [
      "Slugs, pigeons and Mabel’s cat. That’s the three great enemies of the allotment.",
      "I’ve grown the same runner beans for forty years. Saved the seed every autumn.",
      "There’s no such thing as too much compost. Only not enough barrows.",
    ],
  },
];

// The prompt at each rented plot, by stage, for its crop (from CROPS).
export const PLOT_PROMPTS = {
  free: (price) => `Rent this plot · ${price} petals`,
  empty: (crop) => `Sow ${crop.many}`,
  sown: (crop) => `Water the ${crop.many}`,
  growing: (crop) => `${crop.name} · growing`,
  ripe: (crop) => `Harvest the ${crop.many}`,
};

// What each step answers with.
export const PLOT_LINES = {
  rented: (price) =>
    `Basil writes your name on the plot’s little slate. It’s yours to grow in. −${price} petals`,
  short: (price) => `A plot here is ${price} petals for the season. Come back with a few more.`,
  noSeeds: "Your seed pouch is empty. Basil or Finn will spare you a few.",
  sown: {
    carrot: "You draw three shallow drills with a finger and sprinkle the carrot seed along them.",
    lettuce: "You set the little lettuce seeds a hand apart and firm the soil over them.",
    bean: "You push a fat runner bean into the soil at the foot of each cane.",
    pumpkin: "You sow pumpkin seeds on three little mounds of compost, two to a mound.",
  },
  needsWater: "They’ll want a good drink before they’ll do anything.",
  watered: "You water the rows until the soil goes dark. Now it’s up to the sun.",
  growing: (growth) =>
    growth < 0.35
      ? "The first green shoots are just showing. Give them time."
      : growth < 0.75
        ? "They’re coming along nicely. Not long now."
        : "Nearly there. Another minute and they’ll be ready.",
  harvested: {
    carrot: "You ease the carrots out of the soil, orange and crooked and smelling of earth.",
    lettuce: "You cut the lettuces at the stalk, cool and crisp and full of dew.",
    bean: "You pick the beans from top to bottom of the canes, long and green and snapping fresh.",
    pumpkin: "You cut the pumpkins free and roll them to the path. They’re heavier than they look.",
  },
};

// Basil's word on the plots, by topic (basilTopic in src/game/allotments.js).
export const BASIL_TIPS = {
  rent: (price) =>
    `The four beds on the east side are going spare. ${price} petals a season, and the water’s free.`,
  empty: (crop) => `Your ${crop.one} bed’s dug and waiting. Choose it and press E to sow it from your pouch.`,
  sown: (crop) => `Those ${crop.many} won’t come up dry. Give them a watering.`,
  growing: (crop) => `Your ${crop.many} are coming on. Have a wander, and come back to them.`,
  ripe: (crop) => `Your ${crop.many} are ready! Get them in, and Finn will buy them for the bakery.`,
};
