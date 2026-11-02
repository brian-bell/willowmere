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
  home: [
    "Your little cottage. The kettle is warm, and the afternoon can wait.",
    "There’s nowhere you need to be. You’re home.",
  ],
  mill: [
    "The old wheel turns with the river, as it has for a hundred quiet summers.",
  ],
  garden: [
    "Good things grow slowly. Choose your seeds, find a little space, and begin.",
  ],
  windmill: [
    "The sails creak round, slow and patient. Somewhere inside, a millstone hums.",
    "A chalk mark by the door counts the summers: more than anyone can read.",
    "From the doorstep you can see every chimney in the village, and the millpond shining.",
    "The stones are warm from the afternoon. Bees drift past on their way to the clover.",
  ],
  "hilltop-bench": [
    "You sit a while. The village looks like a quilt from here, stitched together by paths.",
    "Smoke curls from the bakery’s chimney. Finn must be baking again.",
    "Someone has carved two initials into the armrest, and a small heart between them.",
    "The wind brings the smell of apples and warm grass. There is nowhere else to be.",
  ],
};

// Any landmark without lines of its own.
export const QUIET_PLACE_LINES = ["Some places ask you to slow down. This is one of them."];
