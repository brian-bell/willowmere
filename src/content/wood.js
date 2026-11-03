// The old wood's words: its resident, what each woodland flower says as it is
// pressed, and Rowan's tips for the flowers still to find.
import { WOOD } from "../regions/wood-layout.js";

// Rowan forages the wood from her stump table by the clearing. She streams in
// with the wood (life.addResident), so she carries her own looks and lines.
export const WOOD_RESIDENTS = [
  {
    id: "rowan",
    name: "Rowan",
    ...WOOD.residents.rowan,
    // Facing the clearing, south-west.
    facing: -2.2,
    coat: 0x7a5a3a,
    hair: 0x3b2a1e,
    skin: 0xc99273,
    hat: true,
    size: 0.92,
    dialogue: [
      "Mind the fairy ring, now. Step inside it and you might not come out until next Tuesday.",
      "I press a flower from every corner of the wood. My book’s fatter than a pheasant by summer’s end.",
      "That great oak was old when the mill was new. I always say good afternoon to it.",
    ],
  },
];

// The prompt at each patch, by flower id.
export const FLOWER_PROMPTS = {
  primrose: "Press a primrose",
  bluebell: "Press a bluebell",
  campion: "Press a red campion",
  foxglove: "Press a foxglove",
  sorrel: "Press some wood sorrel",
  anemone: "Press a wood anemone",
  honeysuckle: "Press a honeysuckle flower",
};

// The first pressing of each flower.
export const FLOWER_LINES = {
  primrose:
    "You pick a single pale primrose from the bank and lay it flat between two pages. It smells faintly of honey.",
  bluebell:
    "The dell is a blue haze. You take one nodding stem and press it, bells and all, into the journal.",
  campion:
    "A bright pink campion, its petals notched like little hearts. It flattens beautifully.",
  foxglove:
    "You choose one small foxglove bell from the bottom of the spike. A bumblebee grumbles and moves along.",
  sorrel:
    "Three tiny clover-shaped leaves and a white flower veined with lilac, from the moss on the old log.",
  anemone:
    "A wood anemone, white as a star, its face turned to the light. You press it before the sun moves on.",
  honeysuckle:
    "In the blue dusk the honeysuckle has opened and the air is sweet with it. You press one creamy trumpet.",
};
// A flower already in the journal, and a flower shut at this hour.
export const FLOWER_AGAIN = [
  "You already have one pressed. Leave the rest for the bees.",
  "One’s enough for the journal. The rest can keep growing.",
];
export const FLOWER_CLOSED = {
  anemone: "The wood anemones have folded their petals for the evening. Come back by daylight.",
  honeysuckle: "The honeysuckle’s buds are shut tight. They open at blue hour, when the moths come out.",
};

// Rowan's tip for a flower still to press, and her line once all are pressed.
export const ROWAN_TIPS = {
  primrose: "Primroses like the bank where the trail comes in from the meadow. You walked right past them.",
  bluebell: "Follow the trail south from the clearing. The bluebell dell’s down that way, in a hollow.",
  campion: "Red campion grows out by the south-east edge, where the light gets in.",
  foxglove: "Foxgloves stand tall in the sunny gap at the top of the north trail.",
  sorrel: "Wood sorrel’s growing on the hollow log. Look where the moss is thickest.",
  anemone: "The anemones carpet the ground under the great oak, but only while the sun’s up.",
  honeysuckle: "There’s honeysuckle on the old stump past the clearing. Wait for blue hour, then follow your nose.",
};
export const ROWAN_DONE = [
  "Every flower in the wood, pressed! You’ll be writing a field guide next.",
  "You’ve the whole wood in your journal now. It’ll smell of summer when you open it in winter.",
];
