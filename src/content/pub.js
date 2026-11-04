// @ts-check
// The Drowsy Heron study's words: each view's name and what to look for there.

/**
 * @typedef {{ id: string, label: string, group: "Outside" | "Inside" | "Upstairs",
 *   position: [number, number, number], target: [number, number, number], note: string }} PubView
 */

/** @type {PubView[]} */
export const PUB_VIEWS = [
  {
    id: "street",
    label: "From the street",
    group: "Outside",
    position: [3.4, 2.1, 22.5],
    target: [0, 4.7, 2],
    note: "An E in plan: two gabled wings stand forward with the gallery between them, brick below and jettied timber above.",
  },
  {
    id: "corner",
    label: "The hearth side",
    group: "Outside",
    position: [-19, 3.6, 16],
    target: [-1.5, 5.2, 1],
    note: "The west stack steps in twice as it climbs, then breaks into three twisted brick shafts, the house's signature on the skyline.",
  },
  {
    id: "gallery",
    label: "The gallery",
    group: "Outside",
    position: [3.4, 1.7, 10.2],
    target: [-0.1, 3.5, 4.4],
    note: "The front balcony: turned balusters over an arcade of four-centred oak arches, roofed by a pentice that springs off the main slope.",
  },
  {
    id: "brick",
    label: "Brick and timber",
    group: "Outside",
    position: [-7.4, 2.4, 9.4],
    target: [-4.8, 3.45, 5.2],
    note: "English bond with a diaper of burnt headers below; herringbone nogging between oak studs above, sailing out on carved jetty brackets.",
  },
  {
    id: "rear",
    label: "The rear yard",
    group: "Outside",
    position: [11, 3.6, -18],
    target: [0.8, 4.2, -2],
    note: "The kitchen's catslide and its own small stack, the cellar flap for the draymen, and the rear wall's run of loft windows.",
  },
  {
    id: "room",
    label: "The great room",
    group: "Inside",
    position: [3.4, 1.62, -0.28],
    target: [-6, 1.42, 0.02],
    note: "Flags underfoot, oak overhead and a well open to the rafters above the long table, so the hearth's light and warmth rise to the beds.",
  },
  {
    id: "hearth",
    label: "The hearth",
    group: "Inside",
    position: [-2.7, 1.3, -0.72],
    target: [-6.4, 1.08, 0.12],
    note: "An inglenook nearly three metres across under one oak bressummer: firedogs, a swinging crane with the stew pot, and settles to hold the warmth.",
  },
  {
    id: "bar",
    label: "The bar",
    group: "Inside",
    position: [-1.05, 1.5, 1.25],
    target: [2.45, 1.25, -2.65],
    note: "A linenfold oak counter with three hand pulls and a brass rail, tankards on the beam, casks on their stillage and the kitchen door behind.",
  },
  {
    id: "table",
    label: "The long table",
    group: "Inside",
    position: [1.25, 1.35, -0.72],
    target: [-3.1, 0.82, 0.25],
    note: "Four metres of plank on two trestles, laid for supper under the two iron wheels of candles that hang through the well.",
  },
  {
    id: "well",
    label: "Down the well",
    group: "Upstairs",
    position: [0.1, 5.32, 1.72],
    target: [-2.4, 0.7, -0.25],
    note: "Railed all round: from the loft you can look straight down onto the long table and across to the fire.",
  },
  {
    id: "loft",
    label: "The sleeping loft",
    group: "Upstairs",
    position: [-6.25, 5.05, -2.35],
    target: [3.8, 4.5, -1.1],
    note: "Ten cots along the walls under arch-braced trusses and two four-posters in the gables: beds for fourteen, with a few sleepers already turned in.",
  },
  {
    id: "fourposter",
    label: "A four-poster",
    group: "Upstairs",
    position: [-2.7, 4.75, 2.7],
    target: [-5.35, 4.1, 4.9],
    note: "Each wing's gable holds a curtained bed behind the great street window, for travellers who can spare more than fourpence.",
  },
  {
    id: "balcony",
    label: "On the balcony",
    group: "Upstairs",
    position: [2.55, 4.92, 4.28],
    target: [-1.6, 3.9, 7.8],
    note: "Through the loft's door and out over the street, with a table for the morning's first ale and a quilt airing on the rail.",
  },
];

export const PUB_CUTAWAYS = [
  { id: "whole", label: "Whole building" },
  { id: "roof", label: "Roof lifted: the loft" },
  { id: "loft", label: "Loft lifted: the great room" },
];

export const PUB_SUMMARY = {
  title: "The Drowsy Heron",
  tagline: "A galleried Tudor pub and inn, brick below and timber above, with beds under the rafters.",
  placement:
    "It stands on the north side of the market square, set a little back between the tea room and the post office, with the largest roof in Willowmere: about 15 by 12 metres on the ground, here at full size.",
};

// The innkeeper, who joins the yard with the building (life.addResident).
export const HERON_KEEPER = {
  id: "tamsin",
  name: "Tamsin",
  facing: 3.3,
  coat: 0x7d4a3e,
  hair: 0x6b4a33,
  skin: 0xe2b28f,
  apron: true,
  hat: false,
  size: 1,
  dialogue: [
    "Welcome to the Heron, love. The fire’s lit and the door’s on the latch.",
    "Fourpence for a cot under the rafters. The four-posters are by arrangement.",
    "We’re named for the old bird on the marsh. Sleeps standing up, and still snores less than my guests.",
    "Barley stew tonight. Go on in, there’s a bench with your name on it.",
  ],
};

// What the walkable room is called, and what E answers to inside it.
export const PUB_ROOM = {
  title: "The Drowsy Heron",
  ariaLabel: "Inside The Drowsy Heron",
  touchLabel: "Walk around The Drowsy Heron",
  pauseLabel: "Pause your stay at the inn",
  nightLabels: ["Blue hour", "Golden afternoon"],
};

export const PUB_POINTS = [
  { id: "door", level: "ground", x: 0, z: 3.7, y: 1.5, range: 1.7, label: "Step back out to the market" },
  { id: "hearth", level: "ground", x: -5.3, z: 0, range: 2.5, label: "Warm your hands" },
  { id: "table", level: "ground", x: -1.4, z: 0.3, y: 0.9, range: 1.9, label: "Pull up a bench" },
  { id: "pumps", level: "ground", x: 1.95, z: -1.65, y: 1.2, range: 1.8, label: "Ask for a pint" },
  { id: "ledger", level: "ground", x: 3.75, z: -1.75, y: 1.1, range: 1.5, label: "Sign the guest book" },
  { id: "slate", level: "ground", x: 5.47, z: -0.86, y: 1.5, range: 2.2, label: "Read tonight’s slate" },
  { id: "casks", level: "ground", x: 5.65, z: -2.5, y: 0.9, range: 1.7, label: "Read the cask labels" },
  { id: "dresser", level: "ground", x: -3.3, z: -3.15, y: 1.5, range: 1.7, label: "Look over the dresser" },
  { id: "cat", level: "ground", x: -4.72, z: -0.72, y: 0.3, range: 1.5, label: "Scratch the cat’s ears" },
  { id: "map", level: "ground", x: -3.4, z: 4.25, y: 1.7, range: 1.5, label: "Read the old map" },
  { id: "kitchen", level: "ground", x: 3.4, z: -5, y: 1.1, range: 1.9, label: "Peek in the kitchen" },
  { id: "well", level: "loft", x: -1.3, z: -1.55, y: 1, range: 1.5, label: "Lean over the rail" },
  { id: "wellFront", level: "loft", x: -1.3, z: 1.55, y: 1, range: 1.5, label: "Lean over the rail" },
  { id: "cot", level: "loft", x: -0.8, z: -3.3, y: 0.5, range: 1.5, rest: true, label: "Lie down a while" },
  { id: "cotEast", level: "loft", x: 4.55, z: 0.92, y: 0.5, range: 1.5, rest: true, label: "Lie down a while" },
  { id: "sleeper", level: "loft", x: 1.45, z: -3.3, y: 0.5, range: 1.5, label: "Listen to the sleeper" },
  { id: "bed", level: "loft", x: -5, z: 4.7, y: 0.6, range: 1.9, rest: true, label: "Try the four-poster" },
  { id: "bedEast", level: "loft", x: 5, z: 4.7, y: 0.6, range: 1.9, rest: true, label: "Try the four-poster" },
  { id: "balcony", level: "loft", x: 0.8, z: 5.3, y: 1, range: 1.5, label: "Look out from the balcony" },
];

const REST = {
  title: "A LITTLE REST",
  text: "The straw rustles, the fire ticks far below, and the light has moved on by the time you open your eyes.",
};
const RAIL = {
  title: "OVER THE RAIL",
  text: "Warm air rises up the well with the smell of stew. Someone below is losing at dice, cheerfully.",
};
export const PUB_NOTES = {
  hearth: { title: "THE HEARTH", text: "The heat reaches you three paces out. The crane creaks, and the stew pot breathes a slow, peppery sigh." },
  table: { title: "THE LONG TABLE", text: "Four metres of plank, worn pale by a hundred years of elbows. There is always room for one more." },
  pumps: { title: "AT THE BAR", text: "Tamsin’s lad draws a pint of Best with one long pull, and slides it over with the froth just shy of the rim." },
  ledger: { title: "THE GUEST BOOK", text: "Drovers, a travelling fiddler, two sisters bound for the coast. You add your name beneath theirs, and the ink is still wet when you turn away." },
  slate: { title: "TONIGHT", text: "Mutton pie, threepence. Barley stew and bread, twopence. A bed in the loft, fourpence, and the snoring comes free." },
  casks: { title: "ON THE STILLAGE", text: "Best, Mild and Cider, each chalked in the same round hand. The Cider’s tap is polished brightest." },
  dresser: { title: "THE DRESSER", text: "Blue-ringed plates on edge and pewter that has outlasted three landlords. One jug has been mended with more love than skill." },
  cat: { title: "THE CAT", text: "One eye opens, considers you, and closes. You have been judged adequate. A rumble begins somewhere deep inside." },
  map: { title: "THE OLD MAP", text: "The green, the mill, the wood, the marsh and the market lane, drawn by someone who plainly walked them all, and ended here." },
  kitchen: { title: "THE KITCHEN", text: "Flour on the table, a loaf proving under a cloth, and the bread oven ticking as it cools." },
  well: RAIL,
  wellFront: RAIL,
  cot: REST,
  cotEast: REST,
  sleeper: { title: "TURNED IN EARLY", text: "A long, contented snore, a pause just long enough to worry about, and then another." },
  bed: { title: "THE GOOD BED", text: "Feathers, not straw. The curtains hush the whole inn to a murmur, and you nearly don’t get up again." },
  bedEast: { title: "THE GOOD BED", text: "Feathers, not straw. The curtains hush the whole inn to a murmur, and you nearly don’t get up again." },
  balcony: { title: "THE GALLERY", text: "The whole market lane lies below you. A quilt airs on the rail, and the sign creaks gently in the yard." },
};
