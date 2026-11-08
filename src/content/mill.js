// @ts-check
// Inside Willow Mill: the room's words. Each point's prompt and note, the lines
// that take turns, and what is chalked and lettered about the place. Where each
// fitting stands is in src/mill/layout.js.
import { FIXTURES as F } from "../mill/layout.js";

export const MILL_ROOM = {
  title: "Willow Mill",
  ariaLabel: "Inside Willow Mill",
  touchLabel: "Walk around Willow Mill",
  pauseLabel: "Pause your visit to the mill",
  nightLabels: ["Lanterns lit", "Afternoon sun"],
};

// Stepping in from the green. Amos the miller is out with the cart.
export const MILL_GREETING = {
  title: "WILLOW MILL",
  lines: [
    "The door swings in on the rumble of the stones and the slap of the wheel. The air is warm, and tastes faintly of bread.",
    "In out of the sun. Everything is dusted pale with flour, and all of it is turning, slowly, to the sound of the brook.",
    "A note pinned inside the door: “Gone up to the Daily Loaf with the cart. Mind the pit. Back for tea. — Amos.”",
  ],
};

export const MILL_POINTS = [
  { id: "door", ...F.door, range: 1.9, label: "Step back out to the green" },
  { id: "pegs", ...F.pegs, range: 1.9, label: "Look at Amos’s coat and hat" },
  { id: "board", ...F.board, range: 2.2, label: "Read the chalkboard" },
  { id: "green", ...F.green, range: 2.2, label: "Look out at the green" },
  { id: "hoist", ...F.hoist, range: 1.9, label: "Hook a sack to the hoist" },
  { id: "pitWheel", ...F.pitWheel, range: 2.3, label: "Look down at the pit wheel" },
  { id: "spur", ...F.spur, range: 2.6, label: "Look up at the great spur wheel" },
  { id: "stones", ...F.stones, range: 1.9, label: "Listen to the stones" },
  { id: "hopper", ...F.hopper, range: 1.9, label: "Tip a scoop of wheat in the hopper" },
  { id: "meal", ...F.meal, range: 1.7, label: "Feel the meal in the sack" },
  { id: "sluice", ...F.sluice, range: 1.8, label: "Shut the sluice" },
  { id: "wheel", ...F.wheel, range: 2.2, label: "Watch the wheel turn" },
  { id: "bins", ...F.bins, range: 1.8, label: "Scoop a handful of grain" },
  { id: "mouse", ...F.mouse, range: 2.2, label: "Say hello to the mouse" },
  { id: "garden", ...F.garden, range: 2.2, label: "Look out of the back window" },
  { id: "backDoor", ...F.backDoor, range: 1.9, label: "Try the back door" },
  { id: "sacks", ...F.sacks, range: 1.8, label: "Read the sacks" },
  { id: "spare", ...F.spare, range: 1.8, label: "Look over the spare stone" },
  { id: "stove", ...F.stove, range: 1.9, label: "Warm your hands at the stove" },
  { id: "chair", ...F.chair, range: 1.6, label: "Sit in the rocking chair" },
  { id: "lane", ...F.lane, range: 2.2, label: "Look out at the mill bridge" },
  { id: "desk", ...F.desk, range: 1.8, label: "Read Amos’s daybook" },
  { id: "bolter", ...F.bolter, range: 1.8, label: "Turn the bolter’s handle" },
];

// Each point's note: a title and the lines that take turns, one for each press.
export const MILL_NOTES = {
  pegs: {
    title: "AMOS’S COAT",
    lines: [
      "A long canvas coat, floury to the elbows, and a hat with a dent where it meets the hoist chain most mornings.",
      "In the coat’s pocket: a pencil stub, a peppermint, and a feather from a kingfisher, kept for luck.",
    ],
  },
  board: {
    title: "THE CHALKBOARD",
    lines: [
      "TOLLS: one scoop in sixteen. FINN: six sacks, Tuesdays and Fridays. HAZEL: one bag of the fine, for scones.",
      "Under the tolls, in a smaller hand: “Wheel greased. Sluice sticks. Eels: two. Mouse: still winning.”",
    ],
  },
  green: {
    title: "THE GREEN",
    lines: [
      "Across the grass the fountain glitters, and smoke climbs from the bakery’s chimney. Somebody waves.",
      "A cat is crossing the green on important business. It does not look up at the mill. It never does.",
    ],
  },
  hoistUp: {
    title: "THE SACK HOIST",
    sound: "whirr",
    lines: [
      "You hook the sack on and pull the rope. The wheel takes it from you: up it goes, knocking the trapdoors open, and they fall shut behind it.",
    ],
  },
  hoistDown: {
    title: "THE SACK HOIST",
    sound: "thump",
    lines: [
      "You let the chain run. The trapdoors bang, and a sack comes down out of the loft and settles on the flags with a floury sigh.",
    ],
  },
  hoistStill: {
    title: "THE SACK HOIST",
    lines: ["The hoist runs off the wheel. With the sluice down, the chain hangs slack and the sack stays where it is."],
  },
  pitWheel: {
    title: "THE PIT WHEEL",
    sound: "water",
    lines: [
      "Down in the pit, the wheel’s great cogs roll round, dripping. The axle runs out through the wall to the water, as thick as an oak.",
      "Every cog is apple wood, Amos says, so it wears before the iron does. Several are newer than the others. One has a name carved in it.",
    ],
  },
  pitWheelStill: {
    title: "THE PIT WHEEL",
    lines: ["With the water off, the pit wheel stands. Drops fall from its cogs into the dark, one by one, into a little hidden pool."],
  },
  spur: {
    title: "THE GREAT SPUR WHEEL",
    lines: [
      "Up under the beams the great spur wheel rolls its cogs into the stone nut, which spins five times for every once it turns.",
      "Its arms are pale with old flour, and a spider has strung a web from one to the next. She seems to enjoy the ride.",
    ],
  },
  stones: {
    title: "THE STONES",
    sound: "whirr",
    lines: [
      "Inside the tun the runner stone turns on the bed stone, a breath apart. The floor hums through your boots, and the air smells of warm bread.",
      "The damsel on the quant chatters against the shoe, shaking the wheat down into the stone’s eye. It sounds like someone knitting very fast.",
      "French burr, Amos says, quarried a long way off and brought here in pieces, then bound with iron. A hundred years old and still sharp.",
    ],
  },
  stonesStill: {
    title: "THE STONES",
    lines: ["The stones have stopped. The quiet is so big it takes you a moment to hear the brook again, just outside."],
  },
  hopper: {
    title: "THE HOPPER",
    sound: "scratch",
    lines: [
      "A scoop of wheat hisses into the hopper and starts its trickle down the shoe.",
      "Another scoop. The damsel gets to work on it straight away.",
    ],
  },
  hopperFull: {
    title: "THE HOPPER",
    lines: ["The hopper is full to the brim. Any more and Amos will be sweeping wheat off the stones till Sunday."],
  },
  meal: {
    title: "THE MEAL",
    lines: [
      "You push your hand into the sack. The meal is warm from the stones, and soft as ash.",
      "Wholemeal, straight from the stones: bran and all. Finn sifts it at the bakery, and swears by it.",
    ],
  },
  mealFull: {
    title: "A FULL SACK",
    sound: "thump",
    text: "The sack is full. You tie its neck, as you have seen it done, and stand it by the door for the cart. A new one goes on the spout.",
  },
  sluiceShut: {
    title: "THE SLUICE",
    sound: "creak",
    text: "You lean on the lever. Outside, the sluice gate grinds down, and the water turns away into the bypass. The wheel slows, and the whole mill sighs and stops.",
  },
  sluiceOpen: {
    title: "THE SLUICE",
    sound: "water",
    text: "You lift the lever. The race rushes back onto the wheel, the cogs take up, and the stones begin to rumble again.",
  },
  wheel: {
    title: "THE WATER WHEEL",
    sound: "water",
    lines: [
      "Through the little window the wheel’s paddles come round, dip, and lift dripping. Each one throws the sun back for a moment.",
      "A wagtail rides the wheel’s rim for half a turn, gets off, and gets back on again.",
    ],
  },
  wheelStill: {
    title: "THE WATER WHEEL",
    lines: ["The wheel stands still in the race, a paddle in the water. Moss on its rim you never noticed while it turned."],
  },
  bins: {
    title: "THE GRAIN BINS",
    lines: [
      "Wheat, cool and slippery, running through your fingers. It is the colour of the end of August.",
      "Barley in the middle bin, for the Drowsy Heron. Its whiskers tickle.",
      "Oats in the last, for porridge and for the neighbours’ ponies. Someone has written OATS on the lid in very large letters.",
    ],
  },
  mouse: {
    title: "THE MILL MOUSE",
    sound: "scratch",
    lines: [
      "The mouse sits up, washes its whiskers with great care, and goes back to its grain.",
      "It looks at you with two black beads, decides you are no trouble, and carries on.",
      "Off it goes, along the skirting and into its hole by the window, with a grain of wheat for later.",
    ],
  },
  garden: {
    title: "OUT THE BACK",
    lines: [
      "Sacks on a pallet, an old millstone against the wall, and a rose that has climbed halfway to the loft.",
      "Beyond the back step the meadow runs up toward the hills, gold in the afternoon.",
    ],
  },
  backDoor: {
    title: "THE BACK DOOR",
    sound: "creak",
    lines: [
      "Barred, with a sack across the sill to keep the draught out. Amos uses it for the cart. The front will do.",
    ],
  },
  sacks: {
    title: "FOR THE DAILY LOAF",
    lines: [
      "Each sack is stencilled WILLOW MILL and chalked in Finn’s capitals: GOOD FLOUR ONLY, PLEASE.",
      "One sack says FINE, for Hazel’s scones. One says FOR THE DUCKS, and is half empty.",
    ],
  },
  spare: {
    title: "THE SPARE STONE",
    lines: [
      "A runner stone off its spindle, leaning on the wall to be dressed. Its furrows fan out from the eye like the rays of a sun.",
      "The mill bills hang over it, and the stone is pocked with grey: specks of the bills themselves, worked into the miller’s hands.",
    ],
  },
  stove: {
    title: "THE STOVE",
    sound: "kettle",
    lines: [
      "The little iron stove ticks with heat. The kettle on top has been on the edge of the boil since breakfast.",
      "A pan of milk warms on the back plate, for the cocoa Amos has at four, every day, whatever the weather.",
    ],
  },
  chair: {
    title: "THE ROCKING CHAIR",
    sound: "creak",
    lines: ["You sit and rock. The stones rumble, the stove ticks, the wheel slaps the water, and the light in the windows slowly changes."],
  },
  lane: {
    title: "THE MILL BRIDGE",
    lines: [
      "Over the brook the road runs east to the market lane. A loaf-shaped figure on a bicycle might be Finn.",
      "Ducks under the bridge, arguing about nothing. The water turns gold where the sun reaches it.",
    ],
  },
  desk: {
    title: "AMOS’S DAYBOOK",
    sound: "click",
    lines: [
      "Wheat in, flour out, every sack ruled off in pencil. In the margin: “Sluice sticks. Ask Basil about the hinge.”",
      "“Wed. A kingfisher on the tailrace rail at seven. Didn’t mill till eight. Worth it.”",
      "Pressed between two pages, a willow leaf, and a note in a child’s hand: “Thank you for the flour for my birthday cake.”",
    ],
  },
  bolter: {
    title: "THE BOLTER",
    sound: "whirr",
    lines: [
      "You crank the handle. Inside the long box the cloth reel turns, and the meal sifts through it: fine flour one end, bran the other.",
      "Round goes the reel, and a puff of white comes out of every crack in the box, as if it were breathing.",
    ],
  },
};

// What is chalked, lettered and stencilled about the room.
export const MILL_SIGNS = {
  board: [
    ["WILLOW MILL", 62],
    ["Tolls: 1 in 16", 40],
    ["Finn: 6 sacks, Tue & Fri", 36],
    ["Hazel: 1 bag fine", 36],
    ["Eels: 2", 36],
    ["Mouse: still winning", 32],
  ],
  bins: ["WHEAT", "BARLEY", "OATS"],
  sack: "WILLOW MILL",
};
