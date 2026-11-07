// @ts-check
// Inside the Copper Kettle: the room's words. Each point's prompt and note, the
// lines that take turns, and what is chalked and lettered about the place.
// Where each fitting stands is in src/copper-kettle/layout.js.
import { FIXTURES as F } from "../copper-kettle/layout.js";

export const KETTLE_ROOM = {
  title: "The Copper Kettle",
  ariaLabel: "Inside the Copper Kettle tea room",
  touchLabel: "Walk around the Copper Kettle",
  pauseLabel: "Pause your visit to the Copper Kettle",
  nightLabels: ["Lamps lit", "Golden afternoon"],
};

// The bell over the door, and Hazel calling in from the terrace.
export const DOOR_BELL = {
  title: "A BELL OVER THE DOOR",
  lines: [
    "The bell tinkles. From the terrace, Hazel: “Sit anywhere you like, love. I’ll be in in two ticks.”",
    "In from the lane, out of the sun. The room smells of toast, warm jam and woodsmoke.",
    "The bell over the door, the clink of a cup somewhere, the fire talking to itself. You’re in.",
  ],
};

// The day's teas, in the order the pot pours them.
export const TEAS = ["Rosehip & ginger", "Smoky lapsang", "Willowmere breakfast", "Garden mint", "Earl Grey"];

export const KETTLE_POINTS = [
  { id: "door", ...F.door, range: 1.9, label: "Step out onto the market lane" },
  { id: "bell", ...F.bell, range: 1.75, label: "Ring for service" },
  { id: "till", ...F.till, range: 1.85, label: "Ring up the till" },
  { id: "cake", ...F.cake, range: 1.85, label: "Cut a slice of sponge" },
  { id: "loaf", ...F.loaf, range: 1.75, label: "Look at Finn’s loaf" },
  { id: "urn", ...F.urn, range: 1.8, from: ["counter"], label: "Draw water from the urn" },
  { id: "caddies", ...F.caddies, range: 2.2, label: "Read the tea caddies" },
  { id: "menu", ...F.menu, range: 2.8, label: "Read today’s menu" },
  { id: "fire", ...F.fire, range: 1.95, label: "Warm your hands" },
  { id: "kettle", ...F.kettle, range: 2, label: "Look at the copper kettle" },
  { id: "sit", ...F.sit, range: 1.6, label: "Sit a while by the fire" },
  { id: "cat", ...F.cat, range: 1.7, label: "Stroke Crumpet" },
  { id: "bay", ...F.bay, range: 2.35, label: "Look out at the market" },
  { id: "pour", ...F.pour, range: 1.7, label: "Pour yourself a cup" },
  { id: "east-window", ...F.eastWindow, range: 2, label: "Look out at the lane" },
  { id: "book", ...F.book, range: 1.65, label: "Sign the visitors’ book" },
  { id: "gramophone", ...F.gramophone, range: 1.75, label: "Wind the gramophone" },
  { id: "photos", ...F.photos, range: 2.1, label: "Look at the photographs" },
  { id: "dresser", ...F.dresser, range: 2, label: "Count the odd cups" },
  { id: "oven", ...F.oven, range: 1.75, label: "Peek into the oven" },
  { id: "scones", ...F.scones, range: 1.7, label: "Cut out a scone" },
  { id: "sink", ...F.sink, range: 1.6, label: "Wash up a cup" },
  { id: "garden", ...F.garden, range: 2.2, label: "Look out at the herb garden" },
  { id: "pantry", ...F.pantry, range: 1.9, label: "Read the jam labels" },
  { id: "rack", ...F.rack, range: 1.75, label: "Smell the cooling scones" },
  { id: "recipes", ...F.recipes, range: 1.7, label: "Read Hazel’s recipe book" },
  { id: "pans", ...F.pans, range: 2.4, label: "Look up at the copper pans" },
  { id: "clock", ...F.clock, range: 2.6, label: "Check the kitchen clock" },
];

// Each point's note: a title and the lines that take turns, one for each press.
export const KETTLE_NOTES = {
  bell: {
    title: "A LITTLE DING",
    sound: "ding",
    lines: [
      "Ding. From the terrace: “Coming, love! Help yourself to the warm side of the pot.”",
      "Ding. Crumpet opens one eye on the window seat and closes it again. Service is not his department.",
      "Ding. Somewhere outside, a cup is set down in a saucer, firmly. Hazel is on her way.",
    ],
  },
  till: {
    title: "THE OLD TILL",
    sound: "ding",
    lines: [
      "Ka-ching. The drawer shoots out: buttons, a raffle ticket, two pressed violets and a great many pennies.",
      "The keys go down with a satisfying clack. NO SALE, says the little flag. Quite right too.",
      "Taped inside the drawer: “Scones are tuppence. Kindness is free. Gossip is extra.”",
    ],
  },
  cake: {
    title: "VICTORIA SPONGE",
    sound: "clink",
    lines: [
      "You lift the dome and cut a slice: jam, cream, and a snow of sugar. It goes on a plate with a rose on it.",
      "Another slice. The sponge is so light it seems to be thinking about floating off the knife.",
      "The cake gets smaller and the afternoon gets better. A fair trade, all things considered.",
    ],
  },
  urn: {
    title: "THE TEA URN",
    sound: "kettle",
    lines: [
      "The tap gives a cough and a great sigh of steam, and the water runs hot and clear into the jug.",
      "The urn is as tall as a child and as warm as a hug. Hazel says it has made forty thousand pots. It looks proud of every one.",
    ],
  },
  caddies: {
    title: "THE TEA CADDIES",
    lines: [
      "Tins in a row, painted and chipped: Assam, Darjeeling, Lapsang, Rosehip, Chamomile, Nettle, and one marked “DO NOT”.",
      "The “DO NOT” tin holds the good biscuits. Everybody knows this. Nobody says.",
      "Each tin has a date on the lid in Hazel’s hand, and a note: “strong”, “stronger”, “for Bram”.",
    ],
  },
  menu: {
    title: "TODAY AT THE COPPER KETTLE",
    lines: [
      "Chalked in a round hand: rosehip & ginger, toasted teacakes, cream tea for two, and a soup that changes its mind.",
      "At the bottom, smaller: “Always, a seat by the window. Never, a hurry.”",
      "Someone has added a little drawing of a cat. Someone else has added a moustache to it.",
    ],
  },
  fire: {
    title: "THE FIRE",
    lines: [
      "Apple logs, and a smell like a whole orchard remembering summer. The warmth finds your fingers first.",
      "A log settles in a fan of sparks. The copper on the mantelpiece takes the glow and holds it.",
    ],
  },
  kettle: {
    title: "THE COPPER KETTLE",
    lines: [
      "The first one, Hazel says: her grandmother’s, carried all the way from the coast. The tea room is named for it.",
      "Polished so often its spout has gone soft at the edges, like a pebble. It has not boiled in years. It doesn’t need to.",
      "Look closely and the whole room is in it, small and gold: the fire, the windows, and you.",
    ],
  },
  sit: {
    title: "BY THE FIRE",
    sound: "creak",
    lines: ["You sink into the armchair. The fire crackles, the clock ticks, and the light through the windows slowly changes."],
  },
  cat: {
    title: "CRUMPET",
    sound: "purr",
    lines: [
      "Crumpet stretches a paw into the sun without opening his eyes. The purr starts somewhere deep and keeps on going.",
      "He rolls over, very slowly, to show you exactly where the stroking should go next.",
      "A ginger cat asleep in a bay window is a kind of weather. Today it is fine and warm.",
    ],
  },
  bay: {
    title: "THE BAY WINDOW",
    lines: [
      "Out past the terrace, the stalls’ awnings stir in the breeze and the bunting nods across the square.",
      "Two people at the terrace tables are sharing a pot and a long story. Hazel tops them up without being asked.",
      "Your own reflection floats over the market, holding a teacup it doesn’t have yet.",
    ],
  },
  pour: {
    title: "A CUP OF TEA",
    sound: "water",
    lines: ["The pot pours in a long amber ribbon. A drop of milk, a turn of the spoon, and the world steadies."],
  },
  "east-window": {
    title: "THE LANE",
    lines: [
      "The gravel lane runs east past the post office towards the coast. Bram is waving a letter at somebody.",
      "A cart creaks by with sacks of flour for Finn. The driver tips his hat to the window, out of habit.",
    ],
  },
  book: {
    title: "THE VISITORS’ BOOK",
    sound: "scratch",
    lines: [
      "You add your name in your best handwriting. Above it: “Best scones this side of the sea. — a walker from the coast.”",
      "An entry from last spring: “Came in for the rain. Stayed for the cake. Rain stopped hours ago. — B.”",
      "A pressed buttercup marks the page, and someone has drawn the kettle in the margin, rather well.",
    ],
  },
  gramophone: {
    title: "THE GRAMOPHONE",
    sound: "piano",
    lines: [
      "You wind the handle and lower the needle. A crackle, then a piano, slightly out of tune and entirely in the right mood.",
      "The record turns, the song wanders, and Crumpet’s ear turns towards it on the window seat.",
    ],
  },
  photos: {
    title: "THE PHOTOGRAPHS",
    lines: [
      "Hazel, much younger, outside the tea room on its opening day, holding the copper kettle like a prize.",
      "The market in snow; the market in bunting; Finn as a boy with flour on his nose and a terrible haircut.",
      "A wedding on the terrace, everyone squinting into the sun. The cake in the picture is, unmistakably, a Victoria sponge.",
    ],
  },
  dresser: {
    title: "THE DRESSER",
    sound: "clink",
    lines: [
      "Not one cup matches another. Roses, forget-me-nots, gold rims, a chip shaped like a heart. Hazel says every cup has a regular.",
      "Twenty-three cups, nineteen saucers, and a teapot shaped like a cottage with a chimney for a spout.",
      "On the top shelf, a cup with a crack held together by gold. The best one, apparently. It has a story.",
    ],
  },
  oven: {
    title: "THE RANGE",
    sound: "creak",
    lines: [
      "The oven door swings down on a breath of heat. Twelve scones are rising, slowly, like an audience standing.",
      "Inside, a pie and a tray of teacakes are getting along famously.",
    ],
  },
  scones: {
    title: "SCONE CUTTING",
    sound: "thump",
    lines: [
      "You press the fluted cutter into the dough and lift it, neat as a coin. Onto the tray it goes.",
      "Twist the cutter and the scone rises crooked, Hazel says. You do not twist the cutter.",
      "Another, and another. The dough gets smaller and the tray gets fuller and your sleeves get floury.",
    ],
  },
  sink: {
    title: "THE BUTLER SINK",
    sound: "water",
    lines: [
      "Warm water, a squeak of a cloth, and a cup with a rose on it comes up shining.",
      "The window over the sink is steamed at the corners. Someone has drawn a heart in it.",
    ],
  },
  garden: {
    title: "THE HERB GARDEN",
    lines: [
      "Pots of mint, a lavender hedge humming with bees, and a row of runner beans climbing towards the sky.",
      "Washing on the line: three tea towels, a lace apron and a very small cardigan that must be Crumpet’s. It isn’t. You hope.",
    ],
  },
  pantry: {
    title: "THE PANTRY SHELVES",
    lines: [
      "Strawberry, damson, gooseberry, bramble, quince. Each jar has a gingham hat and a date.",
      "Lemon curd in three different years. Hazel insists they are all different. They are all wonderful.",
      "At the back, behind the marmalade: one jar labelled simply “Emergencies”. It is fudge.",
    ],
  },
  rack: {
    title: "THE COOLING RACK",
    lines: [
      "The smell reaches you before your eyes do: butter, warm flour, a little vanilla. They aren’t ready. You check anyway.",
      "A scone splits itself along its middle as it cools, as if it knew where the jam goes.",
    ],
  },
  recipes: {
    title: "HAZEL’S RECIPE BOOK",
    lines: [
      "“Scones: flour, butter, milk, a pinch of salt, a light hand. Do not fuss them. Nobody likes being fussed.”",
      "Pages stuck together with jam. A note in the margin: “More ginger. More. MORE.”",
      "“Victoria sponge, the way Mum did it: weigh the eggs, and use the same of everything else.”",
    ],
  },
  pans: {
    title: "THE COPPER PANS",
    sound: "clink",
    lines: [
      "A row of copper pans on the rack, biggest to smallest, like a family lined up for a photograph.",
      "The littlest pan is for warming milk and is, Hazel says, the hardest-working one in the house.",
    ],
  },
  clock: {
    title: "THE KITCHEN CLOCK",
    sound: "tick",
    lines: [
      "Twenty past something. It is always twenty past something in here, and always time for tea.",
      "The clock is ten minutes fast, on purpose. The scones have never once burned.",
    ],
  },
};

// The tea the pot pours, each time a little different.
export const POUR_LINES = [
  "rosehip & ginger, rosy and a little fierce",
  "smoky lapsang, like a campfire in a cup",
  "Willowmere breakfast, strong enough to stand a spoon in",
  "garden mint, picked this morning by the back door",
  "Earl Grey, with a slice of lemon floating like a sun",
];

// When the last slice goes and the last scone is cut.
export const CAKE_GONE = {
  title: "THE LAST SLICE",
  text: "That was the last of it. From the kitchen door, faintly, Hazel: “There’s another in the tin, love!” And there is.",
};
export const TRAY_FULL = {
  title: "A FULL TRAY",
  text: "Twelve scones, all in rows. You slide the tray onto the cooling rack, and Hazel’s bowl of dough is, somehow, full again.",
};

// Once Hazel has had one of Finn's loaves, it waits on the counter's board.
export const LOAF_NOTE = {
  title: "FINN’S LOAF",
  lines: [
    "The loaf you carried up the lane sits on the bread board, already a little shorter. Hazel’s toast is famous for a reason.",
  ],
};

// What is chalked, lettered and labelled about the room.
export const KETTLE_SIGNS = {
  menu: [
    ["TODAY", 64],
    ["Rosehip & ginger", 40],
    ["Toasted teacakes", 40],
    ["Cream tea for two", 40],
    ["Victoria sponge", 40],
    ["Soup of the day (ask)", 40],
    ["Always, a seat by the window", 30],
  ],
  caddies: ["ASSAM", "DARJEELING", "LAPSANG", "ROSEHIP", "CHAMOMILE", "NETTLE", "EARL GREY", "MINT", "DO NOT"],
  jams: ["Strawberry", "Damson", "Gooseberry", "Bramble", "Quince", "Lemon curd", "Marmalade", "Rhubarb", "Plum"],
  window: "The Copper Kettle",
  subline: "TEAS · CAKES · LIGHT LUNCHES",
  door: ["OPEN", "Please come in"],
};
