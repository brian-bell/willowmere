// @ts-check
// Inside the post office: the room's words. Each point's prompt and note, the
// lines that take turns, and what is painted on the walls. Where each fitting
// stands is in src/post-office/layout.js.
import { FIXTURES as F, MY_BOX } from "../post-office/layout.js";

export const POST_OFFICE_ROOM = {
  title: "The Post Office",
  ariaLabel: "Inside the post office",
  touchLabel: "Walk around the post office",
  pauseLabel: "Pause your visit to the post office",
  nightLabels: ["Lamps lit", "Golden afternoon"],
};

// The bell on its spring, as the door shuts behind you.
export const SHOP_BELL = {
  title: "A BELL ON A SPRING",
  lines: [
    "The bell over the door jangles and goes on jangling. Nobody comes. Out on the lane, Bram is telling someone which way a parcel is headed.",
    "The door bell says you’re here, at length. The room smells of string, sealing wax and warm dust.",
    "A jangle overhead, a coo from somewhere behind the counter. The post office has noticed you.",
  ],
};

export const POST_OFFICE_POINTS = [
  { id: "door", ...F.door, range: 1.9, label: "Step out onto the market lane" },
  { id: "bell", ...F.bell, range: 1.75, label: "Ring the counter bell" },
  { id: "card", ...F.card, range: 1.75, label: "Read the card on the counter" },
  { id: "scale", ...F.scale, range: 1.95, label: "Weigh a parcel" },
  { id: "letter-slot", ...F.letterSlot, range: 1.7, label: "Peer into the letter flap" },
  { id: "jars", ...F.jars, range: 2.05, label: "Look over the sweet jars" },
  { id: "stamp", ...F.stamp, range: 1.7, label: "Postmark a letter" },
  { id: "pigeonholes", ...F.pigeonholes, range: 2.1, label: "Read the pigeonholes" },
  { id: "pigeon", ...F.pigeon, range: 1.85, label: "Say hello to Second Class" },
  { id: "sorting", ...F.sorting, range: 1.95, label: "Look over the sorting table" },
  { id: "telegraph", ...F.telegraph, range: 1.8, label: "Tap the telegraph key" },
  { id: "clock", ...F.clock, range: 3.1, label: "Check the clock" },
  { id: "dresser", ...F.dresser, range: 1.9, label: "Browse the stationery" },
  { id: "boxes", ...F.boxes, range: 2.1, label: `Try box ${MY_BOX}` },
  { id: "notices", ...F.notices, range: 2.1, label: "Read the notice board" },
  { id: "telephone", ...F.telephone, range: 1.75, label: "Lift the telephone" },
  { id: "penny-scale", ...F.pennyScale, range: 1.55, label: "Step on the penny scale" },
  { id: "window", ...F.window, range: 1.95, label: "Look out at the lane" },
  { id: "spinner", ...F.spinner, range: 1.75, label: "Turn the postcard rack" },
  { id: "writing", ...F.writing, range: 1.8, label: "Write a line home" },
  { id: "map", ...F.map, range: 2.5, label: "Find yourself on the map" },
  { id: "stove", ...F.stove, range: 1.95, label: "Warm your hands" },
  { id: "wireless", ...F.wireless, range: 2.05, label: "Turn up the wireless" },
  { id: "loaf", ...F.loaf, range: 1.7, label: "Look at Bram’s supper" },
  { id: "switchboard", ...F.switchboard, range: 1.75, label: "Listen in at the exchange" },
  { id: "parcels", ...F.parcels, range: 2.2, label: "Read the parcel labels" },
  { id: "sacks", ...F.sacks, range: 2, label: "Peek into a mail sack" },
  { id: "bicycle", ...F.bicycle, range: 1.85, label: "Ring the bicycle’s bell" },
  { id: "workbench", ...F.workbench, range: 1.8, label: "Tie up a parcel" },
];

// Each point's note: a title and the lines that take turns, one for each press.
export const POST_OFFICE_NOTES = {
  bell: {
    title: "A LITTLE DING",
    sound: "ding",
    lines: [
      "Ding. From out on the lane, faintly: “With you in five minutes!”",
      "Ding. The pigeon answers. It is not the answer you were hoping for.",
      "Ding. The card on the counter does not change its mind.",
    ],
  },
  card: {
    title: "BACK IN FIVE MINUTES",
    lines: [
      "“Back in five minutes. Stamps in the drawer, money in the saucer, and please don’t feed the pigeon. He’ll only want a receipt. Bram.”",
      "On the reverse, in older ink: “Back in ten minutes.” Someone has been gaining on it.",
    ],
  },
  scale: {
    title: "THE BRASS SCALES",
    sound: "clink",
    lines: [
      "The pan dips and settles. One pound, three ounces. The tariff card says that’s a penny, or a good story.",
      "You add the little brass weights one by one until the beam floats level. It is more satisfying than it has any right to be.",
      "Four ounces: a letter with something pressed inside it. Everyone in Willowmere posts flowers sooner or later.",
    ],
  },
  "letter-slot": {
    title: "LETTERS",
    lines: [
      "The brass flap is worn gold at one corner, where a hundred years of thumbs have pushed it open. Something rustles down inside, settling.",
      "You lift the flap and listen. A smell of paper, and very far off, the sea. That can’t be right. You lift it again.",
    ],
  },
  jars: {
    title: "A QUARTER OF HUMBUGS",
    lines: [
      "Humbugs, pear drops, sherbet lemons, aniseed balls. A saucer of petals says the honour system is doing nicely.",
      "The sherbet lemons have fused into one enormous sherbet lemon. Bram says it has become a local landmark.",
      "You take a pear drop and the whole of being eight years old comes back at once.",
    ],
  },
  stamp: {
    title: "WILLOWMERE · MARKET LANE",
    sound: "thump",
    lines: [
      "Thump. A crisp black ring lands on the envelope, with today’s date in it, more or less.",
      "Thump. There is nothing in the world quite like a good postmark, and you’ve just made one.",
      "Thump. Dead centre. Bram would nod slowly at that, and say nothing, and mean a great deal by it.",
      "Thump. A little crooked. You decide that this is its character.",
      "Thump. The letter is now extremely posted.",
    ],
  },
  pigeonholes: {
    title: "THE SORTING FRAME",
    lines: [
      "Mabel’s hole is stuffed with seed catalogues. Tamsin’s is all bills, tied in a ribbon, with a note that says “later”.",
      "Rowan gets one letter a year, always from the same address, always with a leaf inside.",
      "Finn’s letters smell of cinnamon by the second day. Bram sorts them last, so the others don’t pick it up.",
      "There’s a hole marked ROSEWOOD. Somebody has been dusting it, ready for you.",
      "One hole, top left, is marked SOMEDAY. It is quite full.",
    ],
  },
  pigeon: {
    title: "SECOND CLASS · HEAD OF AIR MAIL",
    sound: "coo",
    lines: [
      "He has pigeonholed himself, and looks at you as if that were perfectly normal. It is, here.",
      "Second Class tilts his head, considers your hand, and files you under “later”.",
      "He once took a letter to the coast. It took him eleven days, and he came back with a chip.",
      "A low, contented coo. You feel, for a moment, that your enquiry has been received.",
    ],
  },
  sorting: {
    title: "TODAY’S ROUND",
    lines: [
      "Bundles for the lane, the green and the hill, each tied with a neat bow of string. A ledger lies open at a page of very patient handwriting.",
      "A tea gone cold, a magnifying glass, and one envelope set apart with “Try the mill?” pencilled on it.",
      "An address that just says “Wren, the reeds”. It has a tick beside it. It got there.",
    ],
  },
  telegraph: {
    title: "DOT DOT DASH",
    sound: "morse",
    lines: [
      "You tap out your name, badly. The sounder clacks it back, and somewhere down the line someone is very confused.",
      "Clack-clack, clack. The line runs to the coast, nine miles off, and nobody there has ever been in a hurry either.",
      "A slip of tape, in Bram’s hand: “Sent: ALL WELL STOP. Received: GOOD STOP. It was a slow year.”",
    ],
  },
  clock: {
    title: "TIME, MORE OR LESS",
    lines: [
      "The clock says twenty to four. It said so yesterday too, but with more conviction.",
      "A slow tick, a long pause, another slow tick. Last post is Thursday, which is whenever the cart gets here.",
    ],
  },
  dresser: {
    title: "STAMPS, STRING AND CONVERSATION",
    lines: [
      "Ink in three blues, nibs by the box, sealing wax, luggage labels, and a jar of pencil stubs that have been sharpened beyond reason.",
      "Brown paper in rolls, string by the ball. A hand-lettered card: “Conversation free. Please bring your own.”",
      "A shelf of ledgers goes back eighty years. The oldest has a pressed daisy in it, gone the colour of tea.",
    ],
  },
  boxes: {
    title: `BOX ${MY_BOX} · ROSEWOOD`,
    sound: "clink",
    lines: [
      "Your key turns. Inside: a seed catalogue, addressed to the last person who lived at Rosewood, and a note from Mabel saying welcome, again.",
      "A postcard from Finn, who lives five minutes away. It shows the bakery. On the back: “Wish you were here. You were here this morning.”",
      "A flat parcel from Rowan: one oak leaf, pressed, and a pencilled “for your window”.",
      "A bill for one straw hat, marked PAID in paw print. Lily’s work, you suspect, and Pip’s.",
      "Empty, but the little door swings so nicely you open it twice.",
    ],
  },
  notices: {
    title: "THE NOTICE BOARD",
    lines: [
      "“LAST POST THURSDAY. Stamps, string and conversation within.” Beneath it, in pencil: “Which Thursday?”",
      "“ALLOTMENTS TO LET. Apply to Basil at the shed. Spare marrows free to a good home. PLEASE.”",
      "“THE DROWSY HERON. Quiz night Friday. Tamsin asks that the pigeon be kept from the answers.”",
      "“FOUND at the fountain: one wish. Owner may claim on describing it.”",
      "“HIDE NOTICE. Would whoever is doing the bittern impression please stop. Wren.”",
    ],
  },
  telephone: {
    title: "YOU MAY TELEPHONE FROM HERE",
    sound: "ring",
    lines: [
      "You lift the receiver. It rings, and rings, in the back room. The exchange is a board by the armchair, and the exchange has gone out to the lane.",
      "A crackle, and two voices very far down the line: “…so I said to him, that’s not a marrow…” You put the receiver back gently.",
    ],
  },
  "penny-scale": {
    title: "YOUR WEIGHT AND FORTUNE",
    sound: "clink",
    lines: [
      "The needle swings up and sets. A card drops: “You weigh exactly as much as a person who has had a nice day.”",
      "The needle considers you. The card says: “A letter is on its way. It may be from you.”",
      "Clunk. The card says: “Beware of geese.” There’s a small grubby thumbprint on it, and you do beware.",
    ],
  },
  window: {
    title: "THE LANE",
    lines: [
      "From in here the gold letters read backwards, and the market goes about its business on the far side of them.",
      "Bunting, a striped awning, somebody’s hat going by on its own. On the sill, a geranium leans toward the afternoon.",
      "You can just see Bram by the lane, hands in his pockets, in no hurry to be back in five minutes.",
    ],
  },
  spinner: {
    title: "GREETINGS FROM WILLOWMERE",
    sound: "whirr",
    lines: [
      "The rack squeaks round. The millpond at evening, hand-tinted, with rather more swans than the millpond has.",
      "The orchard hill in blossom. On the back, in pencil: “Bees very busy. So am I, ha ha.”",
      "The old wood at bluebell time. Whoever coloured it got carried away, and it’s better for it.",
      "The market square, from the bridge. You can almost make out the hat.",
      "“The Mere at Dawn”, and it’s mostly mist, which is the honest way to paint the mere.",
    ],
  },
  writing: {
    title: "DEAR ALL",
    sound: "scratch",
    lines: [
      "The pen’s on a chain, the nib is crossed, and the ink is mostly a memory. You write: “Arrived safely. Staying a while.”",
      "Someone has left a blotter full of mirror writing. You hold it up to the glass: “…and the bread here, you wouldn’t believe…”",
      "You start a line to someone you’ve been meaning to write to. It takes three tries, and then it’s easy.",
    ],
  },
  map: {
    title: "WILLOWMERE AND DISTRICT",
    lines: [
      "A red pin says YOU ARE HERE, and for once it seems to be the whole of what you wanted to know.",
      "The brook runs down the middle like a seam: the pond at the top, the mere at the bottom, and everybody stitched in between.",
      "At the east edge the lane runs off the paper. In faded ink: “To the coast, 9 miles.” And below it, smaller: “No hurry.”",
    ],
  },
  stove: {
    title: "THE POT-BELLIED STOVE",
    lines: [
      "Heat rolls off the iron belly. The kettle mutters to itself on top, and a pair of grey socks above it are nearly done.",
      "You warm your hands, and then, because no one is looking, your back as well.",
      "The stove ticks as it settles. It has dried a great many postmen, in its time.",
    ],
  },
  wireless: {
    title: "THE WIRELESS",
    sound: "static",
    lines: [
      "A warm hum, a crackle: “…Millpond. Light airs, becoming lighter. Fair. Good. Orchard Hill, bees, moderate…”",
      "“…Market Lane. Variable, one hat. Marsh. Mist, thickening later to a bittern. Good…”",
      "“…The Old Wood. Mainly quiet, occasional owl. Rosewood. Dog, rising. Good.” The announcer sounds very calm about it all.",
    ],
  },
  switchboard: {
    title: "THE EXCHANGE",
    sound: "buzz",
    lines: [
      "Nine lines, eleven cords, and a lamp winking on number four. Mabel is ringing Hazel. It’ll be about you, and kindly.",
      "A flap drops with a click: THE MILL. You plug in, as you’ve seen it done. “…no, I’ll hold,” says a very small voice, and you unplug it quickly.",
      "A card pinned above the board: “Exchange closes for supper, for the wireless, and whenever Bram is out on the lane.”",
    ],
  },
  parcels: {
    title: "PARCELS TO BE CALLED FOR",
    lines: [
      "Neat brown-paper rows, each tied with string. “Hazel: Cake Tins (Fragile). Hazel: Cake Tins (More).”",
      "“To the Occupier, The Windmill.” It has been here so long there’s a dent in the shelf the same shape as the parcel.",
      "“Basil: Do Not Open Near Marrows.” Bram has moved this one to the far end, without comment.",
      "“Wren: One Pair Binoculars, Quiet.” You read it twice. You look forward to seeing them.",
    ],
  },
  sacks: {
    title: "MAIL SACKS",
    lines: [
      "Canvas and rope, smelling of rain and the back of a cart. Down in the bottom, one postcard is still on its way to somewhere.",
      "The nearest sack is stencilled WILLOWMERE, and the one beside it COAST. Between them they have seen more of the country than anyone in the village.",
    ],
  },
  bicycle: {
    title: "THE RED BICYCLE",
    sound: "bicycle",
    lines: [
      "Ting-ting! It’s the loudest thing in the building. Out on the lane, a dog you can’t see agrees.",
      "A heavy old thing with a basket on the front. The saddle has taken the exact shape of Bram, and doesn’t mind who knows it.",
    ],
  },
  workbench: {
    title: "BROWN PAPER AND STRING",
    sound: "scratch",
    lines: [
      "Paper, fold, fold, string around twice, finger on the knot. You tie a bow that would make a parcel proud.",
      "A dab of red wax, a press of the seal. It’s tied up in a way nothing in your life has ever been, and you feel better for it.",
    ],
  },
};

// Bram's supper, which is only there once you've brought it.
export const LOAF_NOTE = {
  title: "FINN’S LOAF",
  lines: [
    "The loaf you carried over, on a plate by the armchair, with a heel gone already and a knife left across it. Delivered by hand, stamped received: there’s a neat black postmark on the wrapper.",
  ],
};

// What's painted on the walls, read where it is painted.
export const POST_OFFICE_SIGNS = {
  window: "POST OFFICE",
  subline: "Stamps · String · Conversation",
  windowCard: ["Last post", "Thursday"],
  bays: ["POSTS & TELEGRAMS", "SAVINGS BANK · POSTAL ORDERS", "PARCELS & ENQUIRIES"],
  card: ["BACK IN", "FIVE MINUTES", "Bram"],
  // The sorting frame's labels: rows, then columns.
  pigeonholes: [
    ["SOMEDAY", "The Mill", "Windmill", "Orchard", "The Hives", "Pond Cott.", "Weir House", "Jetty", "Hilltop", "Mabel", "Finn", "Elio", "Lily & Pip", "Green", "Fountain"],
    ["Bakery", "Rosewood", "Cottage La.", "Gardens", "Bridge", "Hazel", "Tamsin", "Heron", "The Kettle", "Square", "Stalls", "Bram", "Cart", "Lane End", "Coast"],
    ["Basil", "The Shed", "Plots N.", "Plots S.", "Scarecrow", "Wren", "The Hide", "Boardwalk", "Mere", "Reeds", "Rowan", "Great Oak", "Clearing", "The Log", "Old Wood"],
    ["Parish", "Doctor", "Vicar", "School", "Choir", "Cricket", "Bees Soc.", "Seeds", "Second Class", "Hats", "Lanterns", "Bread", "Apples", "Honey", "Marrows"],
    ["Inland", "Abroad", "Coastal", "Foreign", "Registered", "Parcels", "Small Pkts", "Printed", "Postcards", "Forms", "Returned", "To Follow", "Unknown", "Try Mill", "Ask Mabel"],
    ["Inks", "Nibs", "Blotters", "Wax", "Labels", "String", "Paper", "Glue", "Seals", "Tape", "Pencils", "Tariffs", "Almanacs", "Socks", "Biscuits"],
  ],
  notices: [
    { heading: "LAST POST", body: ["THURSDAY", "Stamps, string &", "conversation within"], pencil: "Which Thursday?", paper: "#efe5c8" },
    { heading: "ALLOTMENTS", body: ["To let. Apply to", "Basil, at the shed.", "Spare marrows free", "to a good home."], pencil: "PLEASE", paper: "#dfe5c5" },
    { heading: "THE DROWSY HERON", body: ["Quiz night Friday.", "Tamsin asks that the", "pigeon be kept from", "the answers."], paper: "#f0d9c0" },
    { heading: "FOUND", body: ["at the fountain:", "one wish.", "Owner may claim on", "describing it."], paper: "#f3efe0" },
    { heading: "HIDE NOTICE", body: ["Would whoever is", "doing the bittern", "impression please", "stop."], pencil: "Wren", paper: "#d5dfe2" },
    { heading: "POST OFFICE", body: ["Dog licences.", "Wireless licences.", "Hat licences (Pip)."], paper: "#f3e7a9" },
  ],
  postcards: [
    { caption: "The Millpond", sky: "#f2c9a0", ground: "#5d8a7a", kind: "pond" },
    { caption: "The Orchard Hill", sky: "#bcd8e2", ground: "#8db26a", kind: "hill" },
    { caption: "The Old Wood", sky: "#cfd9b0", ground: "#6b6fb0", kind: "wood" },
    { caption: "Market Square", sky: "#c4dbe4", ground: "#d9c49a", kind: "market" },
    { caption: "The Mere at Dawn", sky: "#f1dcd2", ground: "#a9bcc4", kind: "mere" },
    { caption: "Greetings!", sky: "#efd9a0", ground: "#c46a4a", kind: "greeting" },
  ],
  stamps: [
    { name: "HERON", value: "½d", colour: "#35607f", kind: "heron" },
    { name: "APPLE", value: "1d", colour: "#a4322b", kind: "apple" },
    { name: "MILL", value: "1½d", colour: "#3f6a4a", kind: "mill" },
    { name: "LOAF", value: "2d", colour: "#b0702c", kind: "loaf" },
    { name: "BEE", value: "3d", colour: "#6a4a86", kind: "bee" },
    { name: "PIGEON", value: "6d", colour: "#4a4f58", kind: "pigeon" },
  ],
};
