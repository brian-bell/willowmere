# Willowmere

A cozy village to wander, built with Three.js. Explore from the overhead village view or switch to first person to walk among cottages, gardens, neighbours and the countryside around them. Every model, texture and sound is generated in code.

## Play

Play the deployed game at **[willowmere.bellbm.workers.dev](https://willowmere.bellbm.workers.dev)**.

To run it locally, use Node.js 22.12+ and a browser with WebGL 2:

```sh
git clone https://github.com/brian-bell/willowmere.git
cd willowmere
npm ci
npm run dev
```

Open the address Vite prints. Three study pages sit beside the game: `/water-study.html` shows the river, millrace and fountain up close (orbit, switch lighting and quality, or tap the water to make ripples), `/tree-study.html` shows the village's tree models, and `/pub-study.html` is The Drowsy Heron, the galleried Tudor inn on the north side of the market square, which you can orbit, cut away, read in plan and walk through. All three are linked from the game's settings, alongside a shortcut into the bakery.

## Controls

| Action | Control |
| --- | --- |
| Walk / run | WASD or arrow keys; Shift to run |
| Walk to a spot | Click a clear path or lawn |
| Interact / continue a conversation | E or Space |
| Explore / gather / plant / water | 1 / 2 / 3 / 4 |
| Journal | J |
| Photo mode | P; Escape to return |
| Switch village / first-person view | V or the camera view button |
| Zoom, tilt, rotate and pan the map | Mouse wheel and the view buttons |
| Look around in first person | Drag; **Free look** captures the mouse and Escape releases it |
| First-person keys | WASD walk and strafe; ↑ / ↓ walk; ← / → turn; Page Up / Down look up and down |
| Touch | Tap a neighbour or flower to walk over and interact; tap the prompt to interact; a direction pad appears in first person |

## Your first afternoon

Meet Mabel beside the fountain. Gather three of the wildflower bouquets marked by pale rings, then select seeds, plant them in an open grassy patch, and water them. Finn can replenish your seed pouch when it runs low. On the lane east of the fountain, Lily walks her puppy Pip; wander over and say hello. The journal keeps track of what you have done.

Settings switch between the golden afternoon and blue hour, set the ambient volume and visual quality, turn decorative motion off, and return you to the village green. Ambient wind and birds start only when sound is enabled.

## Beyond the village

The countryside streams in around the village once you start:

- **The millpond**, north past the mill: cast from the jetty and press when the float dips. Each kind of fish you meet goes in the journal.
- **The orchard hill**, north-west: shake the apple and pear trees and open the hives to fill your basket. Finn buys fruit and honey.
- **The market lane**, east over the brook: carry Finn's loaves to Hazel at the Copper Kettle and Bram at the post office, and shop the stalls for seeds and keepsakes in the golden afternoon. The post office's green door and the Copper Kettle's both open onto rooms of their own.
- **The willow marsh**, south along the brook: walk the boardwalk, meet Wren, and watch from the bird hide. Some birds only come out at blue hour.
- **The old wood**, west past the wildflower meadow: follow the trails under the oaks and beeches, meet Rowan by the clearing's fairy ring, and press a woodland flower from each patch into your journal. The anemones close at blue hour, and the honeysuckle opens only then.

## Inside The Daily Loaf

Walk up to the bakery on cottage lane and press **E**, or use **The bakery** button, to step inside Finn's bakery in first person (or open `/?interior=bakery` directly). Walk with the same keys as first person outdoors. Look toward something and press **E** to greet Crumb the flour spirit, pet Cinnamon, warm your hands by the oven, admire the pastries, pause for tea or ring the counter bell. To leave, face the door at the entrance and press **E**.

Walk up the orchard hill to the windmill's door and press **E** to step inside its tower (or open `/?interior=windmill`). Platforms wind up the wall with the mill's great wheels turning in the open well between them. Walk into a ladder and keep going to climb it, and turn round to come down. At the top you can lean on the brake and watch the sails sweep past the window.

**Escape** opens the pause menu when the mouse is free, with **After hours** lighting, **Photo** and a return to the village. Your village position and progress are kept while you are inside.

## Inside the post office

Press **E** at the green door on the market lane (or open `/?interior=post-office`). A bell on a spring announces you to nobody: Bram is out on the lane, and the card on the counter says he'll be back in five minutes. In the public hall, try box 21, spin the postcard rack, find yourself on the district map and read the notice board. Then go through the raised flap, where the date stamp lands a real postmark on an envelope and Second Class, the pigeon, has pigeonholed himself. The door marked Private leads to the parcel shelves, the village's telephone exchange, the wireless, the red bicycle, and Bram's armchair by the stove, where the loaf you delivered is waiting on the side table. **Lamps lit** in the pause menu brings on the evening.


## Inside the Copper Kettle

Press **E** at the tea room's door on the market lane (or open `/?interior=copper-kettle`). The bell over the door rings you in, and Hazel calls from the terrace to sit anywhere you like. Cut a slice of the Victoria sponge under its dome, pour yourself a cup at the bay table, stroke Crumpet asleep on the window seat, wind the gramophone, sign the visitors' book and read the chalked menu. Behind the counter, the copper urn sighs out steam; through the curtained doorway, Hazel's kitchen has scones to cut, an oven to peek into, a pantry of jam and her recipe book. Sit a while by the fire to let the evening come in. Once Hazel has had one of Finn's loaves, it waits on the counter's bread board.
## Staying at Thistledown

The cottage west of Rosewood is Thistledown, the village's bed & breakfast. Press **E** at its door (or open `/?interior=thistledown`) to walk through the hall, breakfast room, kitchen and sitting room, and up the stairs to Goldfinch, Linnet and the bathroom under the eaves. Ring at the hatch for breakfast and eat it at the window table, read the guest book, say good morning to Caruso, stroke Thimble, run the bath, or lie down on either bed to let the day go by.

## Saved progress

Progress, flowers, seeds, petals, your basket and your camera preference save to this browser on this device. Clearing browser data removes the save, different origins keep separate saves, and private browsing may not save at all.

## Scope

Willowmere is a small playable prototype: a welcome quest, free exploration of the village and the regions around it, and seven walkable interiors: the bakery, Rosewood, The Drowsy Heron, the old windmill, the post office, Thistledown and the Copper Kettle. Other buildings have no interiors, and there is no long campaign or multiplayer.

## Development

- [Code map](docs/architecture.md): where the code lives, how regions plug in, and the tests.
- [Rendering performance](docs/performance.md): how a frame is built, how to measure, and the regression budgets.
- [Water](docs/water.md): the shallow-water simulation and its rendering.
- [AGENTS.md](AGENTS.md): branch, verification and shipping rules.

`npm test` runs the Playwright suite (it uses installed Chrome on macOS, `CHROME_PATH` when set, or Playwright's Chromium from `npx playwright install chromium`), and `npm run build` writes the production site to `dist/`.

### Deploy

The `willowmere` Cloudflare Worker serves the production build as static assets (`wrangler.jsonc`). Pushing to `main` triggers Cloudflare's automatic build and deployment, so merging to `main` is the release. When the automatic deployment is unavailable, authenticate to the Cloudflare account that owns the Worker and publish by hand:

```sh
npx wrangler login
npm run deploy
```

Credentials and local Wrangler state are excluded from Git.

Three.js and the other dependencies keep their own licenses (see `THREE-LICENSE.txt`). Interface typography uses DM Sans and Lora when available, with system fallbacks.
