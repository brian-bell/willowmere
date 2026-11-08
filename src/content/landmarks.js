// @ts-check
// What each village landmark says when the player stops by: one line, picked
// at random, per interaction. Keyed by the interactable's id or type.
export const LANDMARK_LINES = {
  fountain: [
    "Listen closely. Beneath the splashing water, the whole village seems to hum.",
    "Someone has left a little wish on the rim: “May we always have enough to share.”",
    "A copper coin glints at the bottom, worn smooth by years of hopeful thumbs.",
    "A sparrow perches on the rim, takes a sip, and flies off as if it has somewhere wonderful to be.",
    "The water catches the sky and hands it back a little brighter.",
    "Chalked on the stone in a child’s hand: “I wish for a puppy. Or two.”",
    "You make a small wish. The fountain keeps it, the way good friends keep secrets.",
    "The spray drifts over your hands, cool as the first morning of autumn.",
    "Ripples spread from the falling water and fold back into stillness. Your breathing slows to match.",
    "Mabel says the fountain was here before the village. Everyone else simply gathered round it.",
    "A pressed daisy and a sun-warmed penny sit side by side on the ledge, both left for luck.",
    "If you listen long enough, the splashing starts to sound like distant laughter.",
    "Carved faintly into the basin: “Wish small, wish often.”",
    "A dragonfly skims the surface, writes something on the water, and erases it again.",
    "Moss has grown soft around the basin, as if the stones wanted somewhere comfortable to sit.",
  ],
  bakery: [
    "Warm bread, wild honey, and a hint of cinnamon drift through the open window.",
    "Finn is just outside. He’s always happy to share a story — and a few seeds.",
  ],
  garden: [
    "Good things grow slowly. Choose your seeds, find a little space, and begin.",
  ],
  "hilltop-bench": [
    "You sit a while. The village looks like a quilt from here, stitched together by paths.",
    "Smoke curls from the bakery’s chimney. Finn must be baking again.",
    "Someone has carved two initials into the armrest, and a small heart between them.",
    "The wind brings the smell of apples and warm grass. There is nowhere else to be.",
  ],
  "post-box": [
    "You lift the flap and peer in. Someone has posted a letter with a pressed daisy tucked in the envelope.",
    "The pillar box is warm from the sun, and very red, and very proud of it.",
  ],
  signpost: [
    "West, Willowmere. East, the coast, nine miles. You decide you are happy where you are, for now.",
    "The lane runs on past the sign, between hedges, towards somewhere you haven’t been yet.",
    "Someone has carved a tiny boat into the post, just under the arrow for the coast.",
  ],
  "marsh-bench": [
    "You sit a while. Dragonflies stitch back and forth across the mere.",
    "The willows trail their fingers in the water. Somewhere in the reeds, a warbler is gossiping.",
    "A plaque on the backrest: “For Arthur, who loved this view and never said so.”",
  ],
  "marsh-footbridge": [
    "The brook slips out from under the village and spreads into the marsh, slow and golden.",
    "Downstream, the reeds grow taller than you. Somewhere out there, a heron is waiting.",
  ],
  "fairy-ring": [
    "A perfect circle of pale mushrooms. You walk round it, not through it. Just in case.",
    "The grass inside the ring is shorter and greener, as if something dances here at night.",
    "Someone has left an acorn cup of water at the ring’s edge. For the fairies, presumably.",
  ],
  "great-oak": [
    "You put your palm on the bark. It is warm, and very old, and in no hurry at all.",
    "Its roots heave up through the moss like the backs of sleeping animals.",
    "High above, a woodpecker knocks twice, as if asking to come in.",
  ],
  "hollow-log": [
    "You crouch and peer inside. It smells of moss and rain. Something small has made a bed of leaves.",
    "The old log is soft with moss and studded with tiny brown mushrooms.",
  ],
  "wood-signpost": [
    "A weathered fingerpost: “The Old Wood. Mind the roots, mind the fairies.”",
    "Below the arrow, smaller letters: “Bluebells in May. Rowan at the clearing most days.”",
  ],
  "potting-shed": [
    "Basil’s potting shed smells of tomato leaves, twine and creosote. A radio murmurs the shipping forecast inside.",
    "Seed packets hang from a string along the window, each one labelled in careful pencil.",
  ],
  "water-butt": [
    "The water butt is brimming with rain off the shed roof. Basil swears his beans prefer it.",
  ],
  compost: [
    "Three bays: this year’s heap, last year’s, and the black crumbly stuff that’s ready to dig in.",
  ],
  "cold-frames": [
    "Under the glass, rows of seedlings stretch toward the light. It’s as warm as a greenhouse in there.",
  ],
  scarecrow: [
    "The scarecrow wears an old blue coat with patched elbows. A robin is perched on its hat.",
  ],
  "quarry-derrick": [
    "An old timber derrick, its jib cocked over the corner of the face. A fresh block hangs from the hook, turning slowly.",
    "The winch handles are worn pale where hands have cranked them for a hundred years.",
  ],
  "mason-lean-to": [
    "Mallets, chisels and claw tools hang in a neat row, each in its place. The grindstone’s trough is still wet.",
    "Wooden templates lean in the corner: the curve of a window head, a step’s nosing, a coping stone.",
  ],
  "quarry-board": [
    "“Willowmere Quarry. Building stone, walling and garden ornaments. Mind the edge. Ask for Agnes.”",
    "Below, in chalk: “Fossil hunters welcome. Hammers lent on request.”",
  ],
  "stone-stacks": [
    "Dressed blocks, squared and stacked, each marked with Agnes’s banker mark: a little arrow and a star.",
    "One block is chalked “bridge, spare”. Another, “Hazel’s step, Tuesday”.",
  ],
  "stone-cart": [
    "A flat stone cart with iron-shod wheels, loaded and ready. The shafts rest on the ground, waiting for the horse.",
  ],
  "allotment-board": [
    "WILLOWMERE ALLOTMENTS. Plots to let, apply to Basil. Spare marrows free to a good home.",
  ],
  "long-barrow": [
    "The door stone has been pushed a hand’s width aside. Cool air breathes out of the gap, smelling of chalk and rain.",
    "You call a soft hello into the dark. The echo takes a long time to come back, and comes back quieter, as if something hushed it.",
    "Someone has left a posy of meadowsweet on the threshold. It is fresh. Nobody you ask remembers leaving it.",
    "Mabel says the barrows were old when the mill was new. Nobody in the village knows who built them, or who sleeps inside.",
    "The spirals on the doorposts wind inward. Follow one with your eye and it seems to keep turning after you stop.",
  ],
  "old-mound": [
    "The kerbstones lean in toward the mound, like old friends listening to a story.",
    "You count the stones round the mound: twelve. You count again, slowly: thirteen. You decide not to count a third time.",
    "The turf on the mound is warm, even in the shade, as if something underneath is dreaming of summer.",
    "Two spirals are cut into the stone, one turning out and one turning in. The lines are worn soft, but the cuts are sharp at the bottom.",
    "Basil says the rabbits won’t dig here and the sheep won’t graze. The grass grows exactly as it likes.",
  ],
  "standing-stone": [
    "The stone leans toward the millpond, as if it is trying to hear what the water is saying.",
    "Lichen has written something across the stone in yellow and grey. You can’t read it, but it looks like a name.",
    "You put your palm flat on the stone. It hums, very faintly, the way a bell does long after it has rung.",
    "Faint spirals are worn into its face. At blue hour, people say, they shine like moonlight on water.",
  ],
};

// Any landmark without lines of its own.
export const QUIET_PLACE_LINES = ["Some places ask you to slow down. This is one of them."];
