// @ts-check
// The market lane's words: its two residents, what Finn and they say about
// the bread deliveries, and what the stalls say to a shopper.
import { MARKET } from "../regions/market-layout.js";

// Hazel keeps the Copper Kettle; Bram keeps the post office. They stream in
// with the lane (life.addResident), so they carry their own looks and lines.
export const MARKET_RESIDENTS = [
  {
    id: "hazel",
    name: "Hazel",
    ...MARKET.residents.hazel,
    facing: 0.4,
    coat: 0x9b6f8c,
    hair: 0x9a948c,
    skin: 0xe6b796,
    garment: "dress",
    apron: "lace",
    cape: 0xb7a0b4,
    hairStyle: "bun",
    glasses: true,
    lined: true,
    stout: 1.05,
    carry: { left: "kettle" },
    armPose: [
      [-0.06, -1.15],
      [-0.02, -0.22],
    ],
    size: 0.95,
    dialogue: [
      "Sit a while, love. The kettle’s never far from the boil here.",
      "Rosehip today, and a pot of something smoky for anyone who’s come a long way.",
      "The market folk come for my scones. They stay for the gossip.",
    ],
  },
  {
    id: "bram",
    name: "Bram",
    ...MARKET.residents.bram,
    facing: -0.3,
    coat: 0x46617a,
    hair: 0x3b2e26,
    skin: 0xc38c69,
    collar: "stand",
    trim: 0xa8443a,
    buttons: 0xd9b866,
    trousers: 0x344658,
    stripe: 0xa8443a,
    hat: "peaked",
    hairStyle: "tucked",
    capColor: 0x3d5468,
    beard: "moustache",
    nose: 1.12,
    satchel: true,
    carry: { right: "letter" },
    armPose: [
      [-0.38, -1.05],
      [0, -0.12],
    ],
    size: 1.02,
    dialogue: [
      "Letters come up the lane on the cart, twice a week, rain or shine.",
      "Every parcel has a story. I just like to know which way it’s headed.",
      "The coast is nine miles that way. Some days I can smell the salt.",
    ],
  },
];

// Finn, handing over a round of loaves.
export const FINN_DELIVERY_GIVE = [
  "Would you run these over to the market lane? A loaf for Hazel at the tea room, one for Bram at the post office. Over the bridge by the mill, then east.",
  "Fresh out of the oven, and two folk on the market lane waiting. Hazel at the Copper Kettle, Bram at the post office. They’ll see you right.",
];
// Finn, while loaves are still in the bag.
export const FINN_DELIVERY_WAITING = [
  "Those loaves won’t stay warm forever! Hazel’s tea room and Bram’s post office, along the market lane.",
];
// Each recipient, taking their loaf.
export const DELIVERY_THANKS = {
  hazel: [
    "Finn’s bread! Still warm, too. That’ll go beautifully with the jam. Thank you, dear.",
    "Oh, lovely. Tell Finn the scones send their regards.",
  ],
  bram: [
    "Delivered by hand. Couldn’t have done it better myself. Much obliged.",
    "A loaf for the postmaster! I’ll stamp it received.",
  ],
};

// A stall's lines, by what happened at it (src/game/market.js buyFromStall).
export const STALL_LINES = {
  closed: "The stall is covered for the night. The market trades again in the golden afternoon.",
  short: (price) => `You count your petals. Not quite ${price} yet.`,
  bought: {
    seeds: "You drop six petals in the honesty box and take a packet of three seeds.",
    lanterns:
      "You drop the petals in the honesty box and take a paper lantern. It will hang by your cottage gate, and glow at blue hour.",
    hats: "You choose a little straw boater with a red band. Pip is going to look very dashing.",
  },
  owned: {
    lanterns: "Your lantern already hangs by the cottage gate. These ones are waiting for someone else.",
    hats: "Pip already has the finest hat in the village. Maybe the finest anywhere.",
  },
  browse: [
    "Crates of crisp apples, carrots with their tops on, and a marrow the size of a cat.",
    "A chalked sign: “Grown just up the lane. Take what you need, leave what you can.”",
    "The cabbages are so round and proud they might win a prize.",
  ],
};

// The painted boards over each stall's awning.
export const STALL_BOARDS = {
  seeds: "SEEDS & BULBS",
  lanterns: "PAPER LANTERNS",
  hats: "THE MILLINER",
  produce: "FRESH PRODUCE",
};

// The prompt at each stall while it trades.
export const STALL_PROMPTS = {
  seeds: (price) => `Buy 3 seeds · ${price} petals`,
  lanterns: (price) => `Buy a lantern · ${price} petals`,
  hats: (price) => `Buy a hat for Pip · ${price} petals`,
  produce: () => "Browse the greengrocer’s",
};
