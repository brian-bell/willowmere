import * as THREE from "three";
import { LANDMARK_LINES, QUIET_PLACE_LINES } from "../content/landmarks.js";
import { FINN_BUYS, LILY_HAT, NEIGHBOR_TITLES, SMALL_TALK } from "../content/neighbors.js";
import { FINN_DELIVERY_GIVE, FINN_DELIVERY_WAITING } from "../content/market.js";
import { STALLS } from "./market.js";
import { regionAt } from "../world-layout.js";

// What E (or a tap) does: finds the nearest neighbor, bouquet or landmark,
// keeps the interaction prompt up to date, and answers the press. A tapped
// target is walked to, then answered on arrival.

const $ = (s) => document.querySelector(s);
const oneOf = (list) => list[Math.floor(Math.random() * list.length)];

/**
 * `session` reads the live tool, view and progress flags; `clickPath` is the
 * player's current route; `isIndoors()` is true while a room (the bakery or
 * Rosewood) is open or opening; `enterInterior(id)` opens one; `begin()`
 * dismisses the intro.
 */
export function createInteractions({
  world,
  life,
  hud,
  activities,
  fishing,
  session,
  clickPath,
  begin,
  isIndoors,
  enterInterior,
}) {
  let nearest = null,
    // A neighbor, flower or landmark the player tapped: walk over, then interact on arrival.
    pending = null;

  function talkTo(n) {
    const phrases = n.dialogue?.length ? n.dialogue : SMALL_TALK;
    const selling = n.id === "finn" && activities.basketCount() > 0;
    // Finn hands out bread for the market lane when he is not buying; the
    // lane's residents take the loaf that is theirs.
    const delivery = n.id === "finn" && !selling ? activities.finnDeliveries() : null,
      receiving = activities.expectsLoaf(n.id);
    const line = selling
      ? oneOf(FINN_BUYS)
      : delivery === "give"
        ? oneOf(FINN_DELIVERY_GIVE)
        : delivery === "carrying"
          ? oneOf(FINN_DELIVERY_WAITING)
          : receiving
            ? oneOf(activities.thanks(n.id))
            : n.id === "lily" && activities.pipHat
              ? oneOf(LILY_HAT)
              : oneOf(phrases);
    // Wren follows her greeting with a tip for a bird still to spot, Rowan
    // with one for a flower still to press, Basil with word of the beds.
    const tip =
        n.id === "wren"
          ? activities.wrenLine(session.dusk)
          : n.id === "rowan"
            ? activities.rowanLine(session.dusk)
            : n.id === "basil"
              ? activities.basilLine()
              : null,
      lines = tip ? [line, tip] : [line];
    hud.openDialogue(NEIGHBOR_TITLES[n.id] || n.name, lines, () => {
      if (selling) activities.sellBasket();
      if (delivery === "give") activities.deliveryGiven();
      if (receiving) activities.deliver(n.id);
      if (n.id === "mabel") activities.complete("mabel");
      if (n.id === "finn" || n.id === "basil") activities.restockSeeds(n.name);
    });
  }

  function interact() {
    if (isIndoors()) return;
    if (hud.inDialogue) {
      hud.nextDialogue();
      return;
    }
    if (hud.modalOpen()) return;
    begin();
    if (fishing.active) {
      activities.fishingResult(fishing.press());
      return;
    }
    const { tool } = session;
    if (tool === "seeds") {
      activities.plant(session.firstPerson ? session.yaw + Math.PI : life.player.rotation.y);
      return;
    }
    if (tool === "water") {
      activities.water();
      return;
    }
    if (!nearest) {
      hud.toast("Wander closer to a neighbor, a flower, or a village landmark.");
      return;
    }
    if (nearest.kind === "flower") {
      activities.gather(nearest.id);
      nearest = null;
      return;
    }
    if (nearest.kind === "npc") {
      talkTo(nearest.data);
      return;
    }
    const id = nearest.data.id || nearest.data.type;
    if (id === "bakery" || id === "home") {
      enterInterior(id === "home" ? "rosewood" : "bakery");
      return;
    }
    if (id === "jetty") {
      activities.castLine();
      return;
    }
    if (nearest.data.type === "fruit-tree") {
      activities.shakeTree(nearest.data);
      return;
    }
    if (nearest.data.type === "hive") {
      activities.collectHoney(nearest.data);
      return;
    }
    if (id === "bird-hide") {
      hud.openDialogue("THE BIRD HIDE", activities.watchBirds(session.dusk));
      return;
    }
    if (nearest.data.type === "wood-flower") {
      const { flower } = nearest.data;
      hud.openDialogue("THE OLD WOOD", [activities.pressFlower(flower, session.dusk)]);
      return;
    }
    if (nearest.data.type === "plot") {
      const line = activities.tendPlot(nearest.data.plot);
      if (line) hud.openDialogue("THE ALLOTMENTS", [line]);
      return;
    }
    if (nearest.data.type === "stall") {
      const { stall } = nearest.data;
      hud.openDialogue(STALLS[stall].name.toUpperCase(), [
        activities.shop(stall, session.dusk),
      ]);
      return;
    }
    // Like a neighbor, a landmark answers each interaction with a single line.
    hud.openDialogue(nearest.data.name.toUpperCase(), [
      oneOf(LANDMARK_LINES[id] || QUIET_PLACE_LINES),
    ]);
  }

  /** Finds what is in reach, answers a tapped target on arrival, and updates the prompt. */
  function scan() {
    if (hud.inDialogue || session.photo || hud.modalOpen()) {
      $("#interaction").hidden = true;
      return;
    }
    const p = life.player.position;
    let candidates = [];
    for (const n of life.npcs) {
      const x = n.group?.position.x ?? n.x,
        z = n.group?.position.z ?? n.z,
        d = Math.hypot(p.x - x, p.z - z);
      if (d < 2.25)
        candidates.push({
          kind: "npc",
          data: n,
          d,
          label: `Say hello to ${n.name.split(" ")[0]}`,
        });
    }
    for (const [id, g] of activities.flowerGroups) {
      const d = Math.hypot(p.x - g.position.x, p.z - g.position.z);
      if (d < 1.65) candidates.push({ kind: "flower", id, d, label: "Gather wildflowers" });
    }
    for (const i of world.interactables || []) {
      const d = Math.hypot(p.x - i.x, p.z - i.z);
      if (d < (i.radius || 2.4))
        candidates.push({
          kind: "world",
          data: i,
          d: d + 0.4,
          label:
            i.id === "bakery"
              ? "Enter The Daily Loaf"
              : i.id === "home"
                ? "Step inside Rosewood"
                : i.type === "stall"
                ? activities.stallLabel(i.stall, session.dusk)
                : i.type === "wood-flower"
                  ? activities.flowerLabel(i.flower, session.dusk)
                  : i.type === "plot"
                    ? activities.plotLabel(i.plot)
                    : i.name,
        });
    }
    candidates.sort((a, b) => a.d - b.d);
    if (pending) {
      const target = pending,
        reached = candidates.find(
          (c) => c.kind === target.kind && (c.kind === "flower" ? c.id : c.data) === target.key,
        );
      if (reached) {
        pending = null;
        clickPath.length = 0;
        nearest = reached;
        interact();
        return;
      }
      if (!clickPath.length) pending = null;
    }
    nearest = candidates[0] || null;
    const { tool } = session;
    const label = fishing.active
      ? fishing.phase === "bite"
        ? "Reel in!"
        : "Wait for a bite…"
      : tool === "seeds"
        ? "Plant a little happiness"
        : tool === "water"
          ? "Water your flowers"
          : nearest?.label === "Fishing jetty"
            ? "Cast a line"
            : nearest?.data?.id === "bird-hide"
              ? "Watch for birds"
              : nearest?.label;
    $("#interaction").hidden = !label || !session.started;
    if (label) $("#interaction span").textContent = label;
    $("#location-name").textContent = regionAt(p.x, p.z).name;
  }

  // Taps are generous on touch screens: anything drawn within reach of the finger counts.
  const pickPoint = new THREE.Vector3();
  /** The neighbor, bouquet or landmark drawn nearest the pixel (x, y) of `rect`, if any is close enough. */
  function pick(x, y, rect, touch, camera) {
    const targets = [];
    for (const n of life.npcs) {
      const at = n.group?.position ?? n;
      targets.push({ kind: "npc", key: n, x: at.x, z: at.z, lift: 0.8, reach: 44 });
    }
    for (const [id, g] of activities.flowerGroups)
      targets.push({ kind: "flower", key: id, x: g.position.x, z: g.position.z, lift: 0.2, reach: 34 });
    for (const i of world.interactables || [])
      targets.push({ kind: "world", key: i, x: i.x, z: i.z, lift: 1, reach: 48 });
    let best = null,
      bestScore = 1;
    for (const t of targets) {
      pickPoint.set(t.x, world.terrainHeight(t.x, t.z) + t.lift, t.z).project(camera);
      if (Math.abs(pickPoint.z) > 1) continue;
      const sx = ((pickPoint.x + 1) / 2) * rect.width,
        sy = ((1 - pickPoint.y) / 2) * rect.height,
        score = Math.hypot(sx - x, sy - y) / (touch ? t.reach : t.reach * 0.55);
      if (score < bestScore) {
        bestScore = score;
        best = t;
      }
    }
    return best;
  }

  return {
    interact,
    scan,
    pick,
    /** The tapped target being walked to, if any. */
    get pending() {
      return pending;
    },
    set pending(target) {
      pending = target;
    },
  };
}
