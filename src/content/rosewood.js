// @ts-check
// Inside Rosewood, your cottage: the room's words. Bark's lines, the notes
// each fixture shows, and what the treasures and the jigsaw say. Where the
// fixtures stand is in src/rosewood.js; the rules are in src/game/rosewood.js.
export const ROSEWOOD_ROOM = {
  title: "Rosewood",
  ariaLabel: "Inside Rosewood",
  touchLabel: "Walk around Rosewood",
  pauseLabel: "Pause your visit home",
  nightLabels: ["Evening", "Golden afternoon"],
};

export const BARK_TITLE = "BARK · CHIEF OF THE WELCOME COMMITTEE";

export const BARK_GREETINGS = [
  "Bark skids down the hall to meet you, ears inside out with joy. You have been gone for at least a hundred years.",
  "A thump, a scrabble, a woof. Bark arrives at full speed and sits on your feet so you can’t leave again.",
  "Bark was definitely not asleep on the sofa. He greets you at the door with a very innocent face.",
];

export const BARK_PETS = [
  "Bark leans his whole weight into your hand and sighs the sigh of a very good dog.",
  "You find the exact spot behind his ear. His back leg thumps the floor in thanks.",
  "Bark rolls over for a tummy rub, then forgets he was rolling and just lies there, upside down and delighted.",
  "He gives your hand one careful lick, as if signing his name.",
  "Bark’s tail sweeps the floor so hard a sock you lost in spring slides out from under the sofa.",
];

export const BARK_TREATS = [
  "Bark sits. Bark lies down. Bark does both at once, just to be sure. The biscuit vanishes.",
  "He sits up on his back legs, paws folded like a little gentleman, and takes the biscuit ever so gently.",
  "Crunch. Crumbs. A hopeful look at the jar. A second, smaller biscuit.",
];

export const BARK_FETCHES = [
  "Bark tears across the lawn, skids, scoops up the ball, and trots back as if it was his idea.",
  "He drops the ball at your feet and backs away, quivering. Again. Again. Again!",
  "A perfect catch on the bounce. Bark looks round to check the robin saw.",
];

export const BALL_PICKUP =
  "The ball is a little soggy and a lot loved. Bark’s eyes lock onto it. Press E again out on the lawn to throw it.";

export const BALL_INDOORS = "Not in the house! Bark knows the rules. He is pretending he doesn’t.";

// What a dig turns up, by treasure id, after Bark's scrabbling.
export const TREASURE_LINES = {
  button: "Bark sneezes, digs, and proudly drops a brass button at your feet. It goes on his treasure shelf in the hall.",
  marble: "Out comes a blue glass marble, clouded like a little sky. Bark looks very pleased with himself.",
  key: "A tiny old key, too small for any door in Willowmere. Bark thinks it opens the biscuit jar.",
  shell: "A seashell, miles and miles from the sea. Bark has no idea how it got there either.",
  spoon: "A silver teaspoon! So that’s where it went. Bark accepts the reward of a scratch behind the ears.",
  soldier: "A tin soldier with one arm, standing to attention in the mud. Bark salutes, in his way.",
};

export const BONE_LINE =
  "Bark digs up his own bone, looks shocked to find it there, and buries it again two feet to the left. The shelf is full of his treasures.";

export const DIG_BUSY = "Bark is busy. Very busy. Extremely important dog business.";

export const PUZZLE_LINES = {
  placed: (left) =>
    `Click. A corner of sky fits beside a chimney. ${left} piece${left === 1 ? "" : "s"} to go.`,
  done: "The last piece clicks in: the village green, the fountain and every chimney in Willowmere. Bark is in it too, if you squint.",
  restart: "You tip the finished jigsaw gently back into its box. It will be just as nice to make all over again.",
};

export const FISH_TITLE = "THE AQUARIUM · POPULATION FIVE";

export const FISH_FEEDS = [
  "A pinch of flakes. Pebble, Marigold, Captain Bubbles, Duchess and little Ziggy race to the top. Ziggy wins, as usual.",
  "The fish gather at the surface like neighbours at a garden fence. Captain Bubbles takes the biggest flake and pretends he didn’t.",
  "Duchess glides up last, as befits a duchess. The treasure chest burps a bubble in applause.",
];

export const NOTES = {
  record: {
    title: "THE GRAMOPHONE",
    on: "The needle settles into the groove. A crackly little waltz fills the cottage, and Bark’s ears lift.",
    off: "You lift the needle. The room keeps humming the tune a moment longer.",
  },
  cuckoo: {
    title: "THE CUCKOO CLOCK",
    text: "You wind the little key. The doors fly open: cuckoo, cuckoo, cuckoo! Bark tilts his head at it, as he has every day for a year.",
  },
  kettle: {
    title: "THE KETTLE",
    text: "The kettle rumbles, hums, and sings. Tea for one, and a splash of milk for anyone with a waggy tail.",
  },
  star: {
    title: "THE STAR LAMP",
    on: "The lamp turns, and the ceiling fills with slow, wandering stars.",
    off: "The stars fold themselves away until bedtime.",
  },
  nap: {
    title: "FORTY WINKS",
    evening: "You curl up under the patchwork quilt for a moment. When you wake, the evening has drawn in and the lamps are glowing.",
    morning: "A long, lovely doze. You wake to golden afternoon light and Bark’s chin on the quilt.",
  },
  fire: {
    title: "THE FIRESIDE",
    text: "The logs settle with a sleepy crackle. Your toes, and Bark, would like to stay right here.",
  },
  wardrobe: {
    title: "THE WARDROBE",
    text: "Three scarves, two pairs of wellies, and one tiny knitted jumper with BARK across the front.",
  },
  window: {
    title: "THE WINDOW SEAT",
    text: "You tuck your feet up with a book of village stories. Somebody has pressed a daisy at the page about the fountain.",
  },
  shelf: {
    title: "BARK’S TREASURES",
    empty: "An empty shelf with a hand-painted sign: BARK’S TREASURES. Bark looks at it, then at the garden, meaningfully.",
    some: (count, total) =>
      `${count} of ${total} treasures, each dug up by Bark and polished on the hall rug. There is room for more.`,
    full: "Every spot is filled: button, marble, key, shell, spoon and soldier. Bark stands guard beneath them.",
  },
  kennel: {
    title: "BARK’S KENNEL",
    text: "A painted sign: BARK. Inside, a blanket, a chewed slipper and a pinecone he is saving for later.",
  },
  birdbath: {
    title: "THE BIRD BATH",
    text: "A robin hops onto the rim, takes a sip, and gives Bark a very stern look.",
  },
  bowls: {
    title: "BARK’S BOWLS",
    text: "You top up the water bowl. Bark drinks noisily, then shares most of it with the floor.",
  },
  dresser: {
    title: "THE DRESSER",
    text: "Blue willow plates, a mug for every neighbour, and a calendar with WALKIES! written on every single day.",
  },
};
