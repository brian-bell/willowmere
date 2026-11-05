// @ts-check
// Inside Thistledown, the village's bed & breakfast: the words, and where each
// thing the visitor can press E at stands (metres, see src/thistledown/layout.js).
// Dot Pennyfeather runs the house. She is always just out of sight.

export const THISTLEDOWN_ROOM = {
  title: "Thistledown",
  ariaLabel: "Inside Thistledown, the village bed and breakfast",
  touchLabel: "Walk around Thistledown",
  pauseLabel: "Pause your stay",
  nightLabels: ["Evening", "Golden afternoon"],
};

/**
 * @typedef {{ id: string, level: "ground" | "upper", x: number, z: number, y: number, range: number,
 *   label: string, title?: string, text?: string, lines?: string[], sound?: string }} ThistledownPoint
 *   `y` is measured from that floor's boards. A point with `lines` reads the
 *   next one each press; the room answers `door`, the breakfast and the beds.
 */

/** @type {ThistledownPoint[]} */
export const THISTLEDOWN_POINTS = [
  // ------------------------------------------------------------------ the hall
  { id: "door", level: "ground", x: 0, z: 4.75, y: 1.2, range: 1.7, label: "Step out into Willowmere" },
  {
    id: "guestbook", level: "ground", x: -1.14, z: 1.32, y: 0.95, range: 1.7, label: "Read the guest book",
    title: "THE GUEST BOOK",
    lines: [
      "“The bed was so soft we missed breakfast. We did not miss it twice.” Mr & Mrs Pell, Goldfinch.",
      "“Came for one night in 1988. Still coming.” A. Whitlock, Linnet.",
      "“The cat sat on my map, my hat and, briefly, my face. Five stars.” Joan, walking the coast road.",
      "“We have stayed at finer hotels and could not tell you a thing about them.” The Marchants.",
      "“Tell Dot the marmalade should be illegal.” Finn, who lives four minutes away and stayed anyway.",
      "“Very good. Heron-free, which I appreciated.” T., of The Drowsy Heron, on her night off.",
    ],
  },
  {
    id: "bell", level: "ground", x: -1.08, z: 0.68, y: 0.95, range: 1.6, label: "Ring the desk bell",
    title: "THE DESK BELL", sound: "bell",
    lines: [
      "Ting! “Coming, dear!” calls a voice from somewhere behind the kitchen. It does not come. A smell of bacon does.",
      "Ting! “Keys are on the hooks, towels are on the beds, and mind Thimble on the rug!”",
      "Ting! “I heard you the first time, dear. I’ve got my hands in a chicken.”",
    ],
  },
  {
    id: "keys", level: "ground", x: -1.42, z: 1.05, y: 1.65, range: 1.7, label: "Look at the room keys",
    title: "THE KEY RACK",
    text: "Two brass keys on enormous oak fobs: GOLDFINCH and LINNET. Dot says the fobs are big so nobody walks off with them. Somebody once walked off with the hook.",
  },
  {
    id: "clock", level: "ground", x: -1.24, z: -1.15, y: 1.5, range: 1.7, label: "Listen to the hall clock",
    title: "THE LONGCASE CLOCK", sound: "tock",
    text: "Tock. Tock. It strikes thirteen at noon, and nobody has had the heart to tell it.",
  },
  {
    id: "barometer", level: "ground", x: 1.42, z: 1.72, y: 1.55, range: 1.6, label: "Tap the barometer",
    title: "THE BAROMETER",
    text: "The needle shivers and settles on SET FAIR, where it has been since anyone can remember. Outside it may be doing anything at all.",
  },
  {
    id: "boots", level: "ground", x: -1.2, z: 4.12, y: 0.8, range: 1.6, label: "Look at the boots",
    title: "THE BOOT BENCH",
    text: "Two pairs of walking boots on yesterday’s newspaper, a small pair of wellingtons, and a card: “Mud stays here, please. Dot.”",
  },
  {
    id: "mints", level: "ground", x: 1.27, z: 3.9, y: 0.95, range: 1.5, label: "Take a peppermint",
    title: "THE PEPPERMINTS",
    text: "A glass dish of humbugs and striped mints, slightly fused together by the sun. You leave with three, as is traditional.",
  },
  {
    id: "leaflets", level: "ground", x: 1.42, z: 4.0, y: 1.42, range: 1.6, label: "Take a leaflet",
    title: "THINGS TO DO IN WILLOWMERE",
    lines: [
      "THE OLD WOOD. Bluebells in May, honeysuckle at dusk. Rowan knows the paths, and will tell you, at length.",
      "THE MILLPOND. Fishing from the jetty, no licence required. The carp have seen it all before.",
      "THE WILLOW MARSH. Bring boots and binoculars. Wren keeps a list in the bird hide.",
      "THE MARKET LANE. Honesty boxes, paper lanterns and strong opinions about jam.",
      "THE ORCHARD HILL. A bench at the top, and every chimney in the village at your feet.",
      "THE DROWSY HERON. Supper, if Dot’s pie has run out. Ask Tamsin for the snug.",
    ],
  },
  {
    id: "cupboard", level: "ground", x: 0.42, z: -0.85, y: 1, range: 1.5, label: "Try the cupboard door",
    title: "UNDER THE STAIRS",
    text: "A hoover older than the village hall, half a croquet set, and a lost-property box holding one glove, a wooden leg and somebody’s teeth.",
  },
  {
    id: "private", level: "ground", x: 1.46, z: -3.45, y: 1.3, range: 1.6, label: "Knock at the private door",
    title: "PRIVATE",
    text: "A hand-painted sign: DOT’S ROOMS. PLEASE KNOCK. You knock. A radio is turned down, considers the matter, and is turned back up.",
  },
  {
    id: "backdoor", level: "ground", x: 0, z: -4.78, y: 1.4, range: 1.6, label: "Look out at the garden",
    title: "THE BACK DOOR",
    text: "Through the glass: a washing line of very white sheets, a row of beans and three hens who have strong views about the beans. Guests’ boots may not pass this point.",
  },
  // -------------------------------------------------------- the breakfast room
  { id: "hatch", level: "ground", x: -3.55, z: 0.28, y: 1.25, range: 1.75, label: "Ring for breakfast" },
  { id: "table", level: "ground", x: -3.5, z: 3.92, y: 0.8, range: 1.75, label: "Sit down to breakfast" },
  {
    id: "sideboard", level: "ground", x: -4.82, z: 0.5, y: 1, range: 1.7, label: "Help yourself at the sideboard",
    title: "THE SIDEBOARD",
    text: "Cornflakes in a glass jar, prunes nobody has ever been seen to take, a jug of orange juice with a beaded cover, and a card: “Eggs any way you like, as long as you like them fried.”",
  },
  {
    id: "menu", level: "ground", x: -1.56, z: 1.2, y: 1.5, range: 1.8, label: "Read the chalkboard",
    title: "THIS MORNING",
    text: "Bacon, Marigold’s eggs, tomatoes from Basil, and mushrooms Rowan swears are the safe ones. Toast until you say stop. Served until nine, or until Dot sits down.",
  },
  {
    id: "dresser", level: "ground", x: -1.82, z: 4.15, y: 1.3, range: 1.7, label: "Admire the dresser",
    title: "THE WELSH DRESSER",
    text: "Forty-one blue-and-white plates, no two quite the same. Dot rescued them one at a time from the market lane, and knows who broke each of the chipped ones.",
  },
  {
    id: "tea", level: "ground", x: -3, z: 1.62, y: 0.95, range: 1.8, label: "Pour a cup of tea",
    title: "THE ROUND TABLE", sound: "kettle",
    text: "The pot is under a knitted cosy in the shape of a hen. It pours the colour of a good fence. There is always another cup in it.",
  },
  {
    id: "canary", level: "ground", x: -5.15, z: 4.42, y: 1.45, range: 1.8, label: "Say good morning to Caruso",
    title: "CARUSO · RESIDENT TENOR", sound: "tweet",
    lines: [
      "Caruso hops along his perch, looks you up and down, and gives you eight bars of something operatic.",
      "He holds your eye and a high note for far longer than seems likely from a bird of that size.",
      "Caruso turns his back. He does not sing before his cuttlefish.",
    ],
  },
  // ------------------------------------------------------------ the sitting room
  {
    id: "fire", level: "ground", x: 3.5, z: -1.3, y: 0.7, range: 1.9, label: "Warm your hands at the fire",
    title: "THE FIRESIDE",
    text: "Apple logs from the orchard hill, settling with a sleepy crackle. The brass fender has been polished by a great many socks.",
  },
  {
    id: "thimble", level: "ground", x: 3.2, z: -0.45, y: 0.2, range: 1.6, label: "Stroke Thimble",
    title: "THIMBLE · HOUSE CAT, RETIRED", sound: "purr",
    lines: [
      "Thimble is the shape of a loaf and about the weight of a small anvil. A purr starts up somewhere deep in the rug.",
      "One ear turns toward you. The rest of Thimble declines to be involved.",
      "She stretches out one white paw, spreads her toes at the fire, and goes back to whatever she was dreaming about. Probably you, leaving.",
    ],
  },
  {
    id: "piano", level: "ground", x: 1.9, z: 0.72, y: 1.05, range: 1.6, label: "Try the piano",
    title: "THE UPRIGHT PIANO", sound: "piano",
    text: "You pick out the first bars of something. The top C is flat, the pedal squeaks, and the hymn book has been open at the same page since the Coronation.",
  },
  {
    id: "wireless", level: "ground", x: 5.02, z: -1.76, y: 1.12, range: 1.75, label: "Turn on the wireless",
    title: "THE WIRELESS",
  },
  {
    id: "books", level: "ground", x: 2.02, z: -1.76, y: 1.2, range: 1.75, label: "Browse the bookshelves",
    title: "LEFT BY PREVIOUS GUESTS",
    lines: [
      "A shelf of thrillers, each with its last page turned down, and a bird guide annotated in three different hands. They disagree.",
      "“The Vicar Vanishes.” Someone has pencilled the murderer’s name on page 12, and someone else has written “NO IT ISN’T” beneath it.",
      "A 1954 atlas in which Willowmere is marked, wrongly, and a pressed four-leaf clover at the page for Peru.",
    ],
  },
  {
    id: "jigsaw", level: "ground", x: 3.5, z: 3.8, y: 0.85, range: 1.8, label: "Try the jigsaw",
    title: "THE GUESTS’ JIGSAW",
    text: "Two thousand pieces of a Swiss lake, begun by a couple from Leeds in the spring and carried on by everyone since. You find one bit of sky and feel very pleased.",
  },
  {
    id: "games", level: "ground", x: 5.33, z: 3.6, y: 1.1, range: 1.7, label: "Look along the bookcase",
    title: "THE GAMES SHELF",
    text: "Ludo, cribbage, a chess set with a cotton reel for a bishop, and a Scrabble box with a note taped inside: “QI is not a word, Gerald.”",
  },
  // ------------------------------------------------------------------ the kitchen
  {
    id: "range", level: "ground", x: -5, z: -0.7, y: 1, range: 1.8, label: "Look in the frying pan",
    title: "THE RANGE",
    text: "A great cream range, always warm, with a pan on it the size of a cartwheel. Everything that has ever happened in this house has been discussed in front of it.",
  },
  {
    id: "jam", level: "ground", x: -1.8, z: -1.35, y: 1.45, range: 1.75, label: "Read the jam labels",
    title: "DOT’S SHELVES",
    text: "“Damson ’62.” “Bramble, Hazel’s.” “Quince, do not open.” “Marmalade, DO open.” “Not sure, smelled fine.” Every jar is dated, in pencil, with confidence.",
  },
  {
    id: "eggs", level: "ground", x: -3.55, z: -2.52, y: 0.95, range: 1.7, label: "Count the eggs",
    title: "THE EGG BASKET",
    text: "Nine brown, one blue, still warm. A pencil note on the bowl: “Marigold 4, Duchess 3, Edna 3. Edna is trying.”",
  },
  {
    id: "orders", level: "ground", x: -3.58, z: 0.1, y: 1.3, range: 1.6, label: "Check the order spike",
    title: "THE ORDER SPIKE",
    text: "Goldfinch: two full, one without black pudding, one with extra to make up for it. Linnet: porridge, and “whatever is making that smell.”",
  },
  {
    id: "sink", level: "ground", x: -3.55, z: -4.5, y: 1.1, range: 1.75, label: "Look out over the sink",
    title: "THE KITCHEN SINK",
    text: "A deep stone sink with a view of the hens. A row of cracked teacups on the sill hold thyme, chives and a single defiant geranium.",
  },
  // ------------------------------------------------------------------ the landing
  {
    id: "landing-window", level: "upper", x: 0, z: -4.6, y: 1.05, range: 1.9, label: "Sit on the window seat",
    title: "THE LANDING WINDOW",
    text: "Over the washing line and the bean rows, the hill rises in stripes of green and gold. Someone has left a pair of binoculars and a very old tin of toffees on the cushion.",
  },
  {
    id: "airing", level: "upper", x: -1.48, z: 0.15, y: 1.2, range: 1.65, label: "Open the airing cupboard",
    title: "THE AIRING CUPBOARD",
    text: "The warmest place in the house. Towels in stacks, sheets in lavender bags and, tucked behind the tank, a note from Dot: “Thimble is not allowed in here. Thimble knows.”",
  },
  // --------------------------------------------------------------------- Goldfinch
  {
    id: "goldfinch-bed", level: "upper", x: -2.95, z: 2.45, y: 0.65, range: 1.9, label: "Have a lie down",
    title: "GOLDFINCH",
  },
  {
    id: "goldfinch-tray", level: "upper", x: 0.92, z: 1.66, y: 0.95, range: 1.7, label: "Boil the little kettle",
    title: "THE TEA TRAY", sound: "kettle",
    text: "Two cups, a tin of shortbread, and exactly the wrong number of teabags. The kettle takes as long as it takes. There is a card: “If you need more milk, shout.”",
  },
  {
    id: "goldfinch-wash", level: "upper", x: -2.95, z: 4.52, y: 1, range: 1.7, label: "Look at the washstand",
    title: "THE WASHSTAND",
    text: "A jug and basin painted with goldfinches on a thistle. Goldfinches eat thistledown, Dot will tell you, which is how the house got its name and the room got its wallpaper.",
  },
  {
    id: "goldfinch-wardrobe", level: "upper", x: 3.05, z: 4.46, y: 1.3, range: 1.7, label: "Peek in the wardrobe",
    title: "THE WARDROBE",
    text: "Six wire hangers, a spare eiderdown and a smell of cedar. On the top shelf somebody has left a tuba, and a card from Dot: “Not yours? Not mine either.”",
  },
  {
    id: "goldfinch-desk", level: "upper", x: 0, z: 4.5, y: 0.9, range: 1.7, label: "Write a postcard",
    title: "THE WRITING DESK",
    text: "A rack of views of the mill, and a pen that works if you lick it. “Weather lovely. Food enormous. Do not expect us back.”",
  },
  {
    id: "goldfinch-fire", level: "upper", x: 3.5, z: -1.34, y: 0.5, range: 1.8, label: "Warm your toes",
    title: "THE BEDROOM GRATE",
    text: "A little cast-iron grate with tulips on its tiles, and a fire laid ready. It shares a chimney with the sitting room, and on a still night you can hear the wireless through it.",
  },
  // ------------------------------------------------------------------------ Linnet
  {
    id: "linnet-bed", level: "upper", x: -2.3, z: -2.4, y: 0.65, range: 1.9, label: "Have a lie down",
    title: "LINNET",
  },
  {
    id: "suitcase", level: "upper", x: -4.3, z: -3.5, y: 0.65, range: 1.7, label: "Look at the old suitcase",
    title: "A SUITCASE ON THE STAND",
    text: "Stickers from Lisbon, Bournemouth and somewhere called Prestatyn. The label reads “A. Whitlock. Back next year.” Dot says it has been there since the year before last.",
  },
  {
    id: "linnet-chest", level: "upper", x: -3.1, z: -4.54, y: 0.95, range: 1.7, label: "Look at the view",
    title: "LINNET’S WINDOW",
    text: "On the chest beneath the sill: a jug of sweet peas and a bird book, open at the linnet. “A small brown finch of no great distinction,” it says, which Dot has crossed out.",
  },
  // ---------------------------------------------------------------------- the bath
  {
    id: "bath", level: "upper", x: 3.42, z: -2.5, y: 0.8, range: 1.75, label: "Run the bath",
    title: "THE BATH",
  },
  {
    id: "chain", level: "upper", x: 3.82, z: -4.62, y: 1.5, range: 1.7, label: "Pull the chain",
    title: "THE HIGH CISTERN", sound: "flush",
    text: "A long pause. A distant clank. Then a sound like a small river changing its mind, and the whole house knows what you have been doing.",
  },
  {
    id: "basin", level: "upper", x: 2.2, z: -4.56, y: 1, range: 1.6, label: "Wash your hands",
    title: "THE BASIN", sound: "water",
    text: "Two taps: scalding and arctic. The soap is shaped like a shell, the flannel is folded into a swan, and the hot does not arrive until you have given up.",
  },
];

// The bath answers with the taps' state; the wireless with the music's.
export const BATH_LINES = {
  on: "The taps cough, shudder and run. The room fills with steam and the smell of lavender. A rubber duck stands ready on the rim.",
  off: "You turn off the taps. The pipes knock twice, somewhere in the wall, and the whole house settles.",
};

export const WIRELESS_LINES = {
  on: "The valves warm up with a hum, and a little dance band drifts in from very far away, with a good deal of weather on the line.",
  off: "You click it off. The band plays on for a moment in the valves, then fades.",
};

// A nap on either bed lets the day go by, and brings it back.
export const REST_LINES = {
  evening: "You lie back on an eiderdown the weight of a sleeping sheep, and when you open your eyes the window is blue and the lamps are lit.",
  morning: "A long, lovely sleep. You wake in golden light, to the sound of a spoon in a teacup and bacon coming up the stairs.",
};

// Each step of breakfast, by what orderBreakfast() and the plate have to say.
export const BREAKFAST = {
  title: "BREAKFAST",
  ordered: "Ting! “One full breakfast, is it, dear? Sit yourself by the window!” Something hits a very hot pan on the other side of the hatch.",
  cooking: "“It’s coming, it’s coming! You can’t rush an egg.” The hatch breathes out a cloud of bacon.",
  served: "A plate is already waiting on the window table, under the sound of Dot pretending not to watch whether you start.",
  ready: "“Breakfast’s on the window table, dear, before it gets cold!”",
  eat: "Bacon, a sausage of no fixed recipe, two of Marigold’s eggs, a fried slice and marmalade that should be illegal. You put your knife and fork together. You may never walk again.",
  again: "A second one? “Oh, I do like a guest who eats!” The pan goes back on.",
};

// What the labels say while breakfast is moving along.
export const BREAKFAST_LABELS = {
  none: "Ring for breakfast",
  cooking: "Ask after your breakfast",
  served: "Your breakfast is on the table",
  eaten: "Ring for another breakfast",
};
