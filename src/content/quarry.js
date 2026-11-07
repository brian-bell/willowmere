// @ts-check
// The stone quarry's words: Agnes, the mason, what each fossil says as it is
// found, and her word on where to look.
import { QUARRY } from "../regions/quarry-layout.js";

// Agnes dresses stone at her banker on the quarry floor. She streams in with
// the quarry (life.addResident), so she carries her own looks and lines.
export const QUARRY_RESIDENTS = [
  {
    id: "agnes",
    name: "Agnes",
    ...QUARRY.residents.agnes,
    // Facing her banker, west.
    facing: -1.5,
    coat: 0xcbc2ab,
    sleeve: 0xd8cfb8,
    rolled: true,
    hair: 0x9d958a,
    skin: 0xd9a585,
    garment: "smock",
    apron: "bib",
    apronColor: 0x7a5638,
    trousers: 0x6a675b,
    boots: 0x4f3d2c,
    hat: "flat",
    capColor: 0x6d6a60,
    hairStyle: "bun",
    neck: "kerchief",
    neckColor: 0x8a4b3a,
    freckles: true,
    carry: { right: "mallet" },
    armPose: [
      [-0.32, -0.55],
      [0, -0.12],
    ],
    size: 0.95,
    dialogue: [
      "Forty years I’ve cut this stone. It still surprises me, every block.",
      "Half the village came out of this hill. The bridge, the fountain, the post office step.",
      "Listen to it ring when you tap it. Good stone sings. Bad stone just thuds.",
    ],
  },
];

// What Agnes says when she lends the hammer, and once it is lent.
export const AGNES_HAMMER =
  "Fossils, is it? Here, take my old hammer. Tap along the bedding, gently, and the stone will open like a book.";

// The prompt at each fossil's spot, by id.
export const FOSSIL_PROMPTS = {
  ammonite: "Split a stone from the spoil heap",
  belemnite: "Search the scree under the face",
  gryphaea: "Look over the split block",
  crinoid: "Tap along the bench’s ledge",
  urchin: "Split a nodule on the bench",
  brachiopod: "Search the rabbit scrape",
};

// The first find of each fossil.
export const FOSSIL_LINES = {
  ammonite:
    "Two taps and the stone falls open: an ammonite, coiled tight as a sleeping cat, every rib still sharp.",
  belemnite:
    "Among the scree, a smooth brown bullet of stone. A belemnite. The old quarrymen called them thunderbolts.",
  gryphaea:
    "In the split face, a curled grey shell like a giant’s toenail. A gryphaea, the devil’s toenail.",
  crinoid:
    "Along the ledge, a little stack of stone discs, each with a star at its heart: St Cuthbert’s beads, a sea lily’s stem.",
  urchin:
    "The nodule cracks to show a fossil sea urchin, five-rayed like a star. A shepherd’s crown, for luck.",
  brachiopod:
    "Where the rabbits have scratched, a pair of ribbed shells still closed together. A lamp shell, older than the hill itself.",
};
// A fossil already found, and a spot tried without a hammer.
export const FOSSIL_AGAIN = [
  "You’ve one of those already. Leave the rest for the next curious visitor.",
  "The stone here has given you its best. Try another corner of the quarry.",
];
export const NO_HAMMER =
  "The stone’s too hard for bare hands. Agnes, at her banker on the quarry floor, might lend you a hammer.";

// Agnes's word on a fossil still to find, and her line once all are found.
export const AGNES_TIPS = {
  ammonite: "The spoil heap’s worth a look. The rough stone we throw out is full of ammonites.",
  belemnite: "Thunderbolts wash out of the scree under the west face after rain. Look down at your feet.",
  gryphaea: "That block I split by the stacks was full of devil’s toenails. Have a look before I cart it off.",
  crinoid: "Up on the old bench, along the north side, there’s a bed of crinoids. Walk up the slope at its east end.",
  urchin: "The bench round the west side has round nodules in it. Crack one; there’s often an urchin inside.",
  brachiopod: "The rabbits dig up lamp shells on the ridge top, above the north face. Mind the edge.",
};
export const AGNES_DONE = [
  "Every fossil in the hill, found! You’ve a better eye than my last apprentice.",
  "You’ll want a cabinet for all those. I could cut you some shelves, if you like.",
];
