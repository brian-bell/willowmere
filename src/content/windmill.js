// @ts-check
// The old windmill's words: what the walkable room is called, what E answers to
// at each floor, and what each thing says. A point's place is a bearing and a
// radius about the tower's axis (see src/windmill/layout.js), at `y` over its floor.

export const WINDMILL_ROOM = {
  title: "The Old Windmill",
  ariaLabel: "Inside the old windmill",
  touchLabel: "Walk and climb inside the old windmill",
  pauseLabel: "Pause your climb",
  nightLabels: ["Lamplight", "Afternoon sun"],
};

export const WINDMILL_POINTS = [
  // The meal floor, where the flour comes down.
  { id: "door", level: "meal", theta: 0, r: 3.8, y: 1.5, range: 1.9, label: "Step back out to the orchard" },
  { id: "tally", level: "meal", theta: -0.34, r: 3.75, y: 1.6, range: 1.6, label: "Read the chalk marks" },
  { id: "sacks", level: "meal", theta: -0.66, r: 3.05, y: 0.7, range: 1.9, label: "Look over the flour sacks" },
  { id: "ledger", level: "meal", theta: -1.28, r: 3.3, y: 1, range: 1.6, label: "Turn the miller’s ledger" },
  { id: "spout", level: "meal", theta: 4.618, r: 1.32, y: 1, range: 1.6, label: "Catch the flour in your hand" },
  { id: "scale", level: "meal", theta: 2.1, r: 3.2, y: 1.1, range: 1.5, label: "Try the sack scale" },
  { id: "spur", level: "meal", theta: 2.6, r: 0.9, y: 2.3, range: 2.1, label: "Look up at the spur wheel" },
  // The stone floor, on its crescent and its deck in the middle of the well.
  { id: "stones", level: "stone", theta: 4.618, r: 1, y: 1, range: 1.9, label: "Listen to the stones" },
  { id: "runner", level: "stone", theta: 0.618, r: 1, y: 0.7, range: 1.9, label: "Watch the runner stone turn" },
  { id: "crane", level: "stone", theta: 3.3, r: 3.15, y: 1.2, range: 1.5, label: "Look over the stone crane" },
  { id: "spare", level: "stone", theta: 1.72, r: 3.25, y: 0.7, range: 1.5, label: "Run a thumb along the furrows" },
  { id: "stoneWindow", level: "stone", theta: 2.72, r: 3.5, y: 1.55, range: 1.4, label: "Look out of the window" },
  // The bin floor, level with the crown wheel.
  { id: "bins", level: "bin", theta: 4.68, r: 3, y: 0.9, range: 1.7, label: "Run your hand through the wheat" },
  { id: "binsFar", level: "bin", theta: 5.92, r: 3, y: 0.9, range: 1.7, label: "Run your hand through the wheat" },
  { id: "crown", level: "bin", theta: 5.3, r: 1.6, y: 1.3, range: 1.6, label: "Watch the crown wheel turn" },
  { id: "binWindow", level: "bin", theta: 5.32, r: 3.2, y: 1.55, range: 1.4, label: "Look out of the window" },
  // The landing with the window seat, and the owl.
  { id: "seat", level: "seat", theta: 1.15, r: 2.9, y: 1, range: 1.5, rest: true, label: "Sit in the window" },
  { id: "owl", level: "seat", theta: 2.2, r: 2.72, y: 1.85, range: 1.9, label: "Say hello to the owl" },
  // The dust floor, under the cap.
  { id: "brake", level: "dust", theta: 4.65, r: 2.5, y: 1, range: 1.5, label: "Lean on the brake lever" },
  { id: "brakeWheel", level: "dust", theta: 6.03, r: 1.2, y: 2.4, range: 1.5, label: "Look up at the brake wheel" },
  { id: "wallower", level: "dust", theta: 2.6, r: 1, y: 1.6, range: 1.5, label: "Watch the wallower" },
  { id: "sails", level: "dust", theta: 6.025, r: 2.72, y: 1.2, range: 1.5, label: "Watch the sails go by" },
  { id: "hills", level: "dust", theta: 3.75, r: 2.72, y: 1.2, range: 1.4, label: "Look out over the hills" },
];

export const WINDMILL_NOTES = {
  tally: {
    title: "THE CHALK MARKS",
    text: "A stroke for every summer the sails have turned, in a dozen different hands. There are more than anyone can read, and nobody has ever rubbed one out.",
  },
  sacks: {
    title: "FOR THE DAILY LOAF",
    text: "Stoneground and still faintly warm, each sack chalked in Finn’s hopeful capitals: GOOD FLOUR ONLY. Somebody has drawn a cat on the bottom one.",
  },
  ledger: {
    title: "THE MILLER’S LEDGER",
    text: "Wheat in, flour out, one sack in sixteen for the toll. In the margin, in pencil: “Grease the wallower. Feed the owl. Mind your head.”",
  },
  spout: {
    title: "THE MEAL SPOUT",
    text: "Flour sifts down the chute into your palm, soft as ash and warm from the stones. It has been doing this since long before you came in.",
  },
  scale: {
    title: "THE SACK SCALE",
    text: "You stand on the plate and the iron arm rises, considers you, and settles. About three and a half sacks, it reckons, and rather better milled.",
  },
  spur: {
    title: "THE SPUR WHEEL",
    text: "Just over your head, hornbeam cogs roll into the little stone nuts and out again, slow and courteous as a country dance.",
  },
  stones: {
    title: "THE STONES",
    text: "The boards hum through your boots. Grain rattles down from the hopper while the damsel chatters at it to hurry along, and the air tastes warm and sweet.",
  },
  runner: {
    title: "THE RUNNER STONE",
    text: "With its cover off you can watch the top stone turn, its furrows sweeping round on a breath of flour. The bottom stone has not moved in a hundred years.",
  },
  crane: {
    title: "THE STONE CRANE",
    text: "For swinging the runner off to dress it. The mill bills hang alongside, worn to the shape of somebody’s grip.",
  },
  spare: {
    title: "A SPARE STONE",
    text: "French burr, bound in iron and leaning against the wall, its furrows cut sharp and waiting. There is steel in the mason’s knuckles, they say, for life.",
  },
  stoneWindow: {
    title: "THE NORTH WINDOW",
    text: "Blue hills, a long way off, and the wind coming from them across the fields. It smells of rain somewhere else.",
  },
  bins: {
    title: "THE GRAIN BINS",
    text: "Cool wheat, up to the wrist. It pours round your fingers and settles again, and somewhere behind the boards a mouse pretends it wasn’t there.",
  },
  binsFar: {
    title: "THE GRAIN BINS",
    text: "This bin is the barley. It has a different dry whisper to it, and a hand-lettered card: “Not for bread. Ask Tamsin.”",
  },
  crown: {
    title: "THE CROWN WHEEL",
    text: "Two and a half metres of oak and cog, going round at the pace of a slow thought. It drives nothing at all today, and looks very pleased about it.",
  },
  binWindow: {
    title: "OVER THE ORCHARD",
    text: "The apple rows run away down the hill below you. A bee has come in on the draught, thought better of it, and gone.",
  },
  seat: {
    title: "THE WINDOW SEAT",
    text: "Someone wore this sill smooth, and left a cushion. Out past the pears the millpond lies shining. You lose some time here, and don’t mind.",
  },
  owl: {
    title: "THE OWL",
    text: "It turns its whole head to watch you come up, and you feel you ought to have knocked. A small heap of pellets suggests the mice are losing.",
  },
  brakeOn: {
    title: "THE BRAKE",
    text: "You lean on the lever. The band bites with one long wooden groan, and the whole mill shudders down to stillness. It is very quiet, suddenly.",
  },
  brakeOff: {
    title: "THE BRAKE",
    text: "You ease the lever up. For a breath nothing happens, then the wind takes the sails and the great wheel begins to roll again.",
  },
  brakeWheel: {
    title: "THE BRAKE WHEEL",
    text: "The biggest wheel in the mill, on the same shaft as the sails. All of Willowmere’s bread starts up here, with the wind.",
  },
  wallower: {
    title: "THE WALLOWER",
    text: "It turns the sails’ slow push into the long shaft’s quick one, and smells of tallow. All the way down the well, everything turns because this does.",
  },
  sails: {
    title: "THE SAILS",
    text: "A sail sweeps past the glass close enough to count the laths. Then every chimney in the village, and then another sail.",
  },
  hills: {
    title: "THE BACK OF THE HILL",
    text: "The way nobody walks. Rough grass, the wood’s dark edge, and three rooks arguing over who saw it first.",
  },
};

// Said the first time you set foot on a ladder.
export const LADDER_NOTE = {
  title: "UP THE LADDERS",
  text: "Keep walking to climb. Turn round to come down, or step back the way you came. Have a good look about on the way, you’re safe enough.",
};
