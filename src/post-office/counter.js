import * as T from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { FIXTURES as F, POST_OFFICE as P } from "./layout.js";

// The counter: two panelled mahogany runs either side of a raised flap, the
// brass grille with its three arched wickets, the things on the public ledge
// (bell, card, scales, tariff), the postmaster's ledge behind (date stamp, ink,
// stamp drawer), and the shop's short run with its sweet jars, till and string.
// Returns the parts that move.
export function buildCounter(parts, surfaces, keep) {
  const { b, rb, rod, cyl, orb, torus, turned, group, random, range, tube, mergeGroup, mesh, root } = parts;
  const { M, A, decal } = surfaces;
  const C = P.counter,
    H = C.height,
    faceZ = C.maxZ;

  // A panelled front, looking out over the public side.
  function panelledFront(x0, x1) {
    const w = x1 - x0,
      mid = (x0 + x1) / 2;
    b(M.mahogany, mid, H / 2, (C.minZ + 0.42 + faceZ) / 2, w, H, faceZ - C.minZ - 0.42);
    // Plinth, mid rail and frieze rail.
    rb(M.mahoganyDark, mid, 0.13, faceZ + 0.015, w, 0.26, 0.05, 0.012);
    rb(M.mahogany, mid, 1.3, faceZ + 0.018, w, 0.13, 0.05, 0.012);
    const bays = Math.max(1, Math.round(w / 0.95)),
      bay = w / bays;
    for (let i = 0; i < bays; i++) {
      const x = x0 + (i + 0.5) * bay;
      // Raised and fielded: recess, field, moulding.
      b(M.mahoganyDark, x, 0.75, faceZ + 0.006, bay - 0.14, 0.86, 0.012);
      rb(M.mahogany, x, 0.75, faceZ + 0.018, bay - 0.26, 0.72, 0.026, 0.008);
      b(M.mahoganyDark, x, 0.75, faceZ + 0.032, bay - 0.4, 0.56, 0.006);
    }
    for (let i = 0; i <= bays; i++) rb(M.mahogany, x0 + i * bay, 0.74, faceZ + 0.02, 0.08, 1.02, 0.05, 0.01);
    // The top, moulded at its front edge.
    rb(M.mahogany, mid, H - 0.045, (C.minZ + faceZ) / 2, w, 0.09, faceZ - C.minZ + 0.12, 0.028);
    rb(M.mahoganyDark, mid, H - 0.115, faceZ + 0.025, w, 0.055, 0.05, 0.012);
  }
  // Open shelves on the postmaster's side, under the top.
  function backShelves(x0, x1) {
    const w = x1 - x0,
      mid = (x0 + x1) / 2,
      z = C.minZ + 0.21;
    b(M.pine, mid, 0.06, z, w, 0.12, 0.42);
    for (const y of [0.56, 1.0]) b(M.pine, mid, y, z, w, 0.035, 0.42);
    for (let x = x0; x <= x1 + 0.01; x += (x1 - x0) / Math.round((x1 - x0) / 1.3)) b(M.pine, x, H / 2, z, 0.04, H - 0.1, 0.42);
    // What collects down there: forms, ledgers, tins and spare string.
    for (const y of [0.1, 0.58, 1.02]) {
      let x = x0 + 0.08;
      while (x < x1 - 0.4) {
        const kind = random(),
          wd = range(0.22, 0.42);
        if (kind < 0.35) {
          const stack = 2 + Math.floor(random() * 5);
          for (let s = 0; s < stack; s++) b([M.paperWhite, M.paperBuff, M.paperBlue][s % 3], x + wd / 2 + range(-0.01, 0.01), y + 0.015 + s * 0.024, z + range(-0.03, 0.03), wd, 0.02, 0.28);
        } else if (kind < 0.62) {
          const count = 2 + Math.floor(random() * 3);
          for (let s = 0; s < count; s++) b([M.oxblood, M.doorGreen, M.beam][s % 3], x + 0.05 + s * 0.075, y + 0.17, z - 0.02, 0.065, 0.32, 0.27);
        } else if (kind < 0.82) {
          cyl(M.pewter, x + 0.1, y + 0.1, z, 0.09, 0.2, 0.09, root, 10);
        } else orb(M.twine, x + 0.1, y + 0.09, z, 0.09, 0.09, 0.09);
        x += wd + range(0.05, 0.22);
      }
    }
  }
  panelledFront(-P.halfW, C.westEnd);
  panelledFront(C.eastStart, P.halfW);
  backShelves(-P.halfW, C.westEnd);
  backShelves(C.eastStart, P.halfW);
  // The ends where the flap's gap opens.
  for (const [x, dir] of [[C.westEnd, 1], [C.eastStart, -1]]) {
    b(M.mahogany, x + dir * 0.012, H / 2, (C.minZ + faceZ) / 2, 0.03, H, faceZ - C.minZ);
    rb(M.mahoganyDark, x + dir * 0.02, 0.13, (C.minZ + faceZ) / 2, 0.03, 0.26, faceZ - C.minZ, 0.008);
  }
  // A brass foot rail on brackets along the public side.
  const rail = faceZ + 0.16;
  rod(M.brass, [-5.6, 0.21, rail], [C.westEnd - 0.2, 0.21, rail], 0.022, 10);
  for (let x = -5.6; x <= C.westEnd - 0.1; x += 1.5) {
    rod(M.brassDull, [x, 0.21, faceZ + 0.03], [x, 0.21, rail], 0.012, 6);
    orb(M.brass, x, 0.21, rail, 0.032, 0.032, 0.032);
  }
  // The flap itself, stood up on its hinges and hooked back.
  const flap = group(C.eastStart + 0.05, H, 0.62);
  flap.rotation.z = -0.1;
  rb(M.mahogany, -0.02, 0.54, 0, 0.07, 1.08, 0.98, 0.018, flap);
  rb(M.mahoganyDark, -0.058, 0.54, 0, 0.012, 0.82, 0.72, 0.004, flap);
  rb(M.mahogany, -0.066, 0.54, 0, 0.012, 0.64, 0.54, 0.004, flap);
  for (const z of [-0.34, 0.34]) rb(M.brass, 0.02, 0.05, z, 0.04, 0.12, 0.2, 0.006, flap);
  rod(M.iron, [C.eastStart + 0.1, H + 1.02, 0.62], [C.eastStart + 0.42, H + 1.02, 0.62], 0.008, 5);
  rod(M.iron, [C.eastStart + 0.42, H + 0.02, 0.62], [C.eastStart + 0.42, H + 1.05, 0.62], 0.015, 6);

  // ---------------------------------------------------------------- the grille
  const gz = C.grilleZ,
    topY = 3.42,
    baseY = H + 0.08;
  b(M.mahogany, (P.grilleBays[0].from + C.westEnd) / 2, H + 0.04, gz, C.westEnd - P.grilleBays[0].from, 0.08, 0.2);
  // West of the bays the screen closes against the wall in plain panel.
  rb(M.mahogany, (-P.halfW + P.grilleBays[0].from) / 2, (H + topY) / 2, gz, P.grilleBays[0].from + P.halfW, topY - H, 0.09, 0.012);
  rb(M.mahoganyDark, (-P.halfW + P.grilleBays[0].from) / 2, (H + topY) / 2, gz + 0.052, P.grilleBays[0].from + P.halfW - 0.14, topY - H - 0.2, 0.015, 0.006);
  for (const x of [...P.grilleBays.map((bay) => bay.from), C.westEnd]) {
    rb(M.mahogany, x, (H + topY) / 2, gz, 0.15, topY - H, 0.17, 0.018);
    // A carved finial at each post's foot and head.
    rb(M.mahoganyDark, x, H + 0.17, gz, 0.19, 0.1, 0.21, 0.016);
    rb(M.mahoganyDark, x, topY - 0.42, gz, 0.19, 0.05, 0.21, 0.01);
  }
  // The fascia across the top, carrying each bay's gold-leaf name.
  rb(M.mahogany, (P.grilleBays[0].from + C.westEnd) / 2, topY - 0.17, gz, C.westEnd - P.grilleBays[0].from + 0.2, 0.34, 0.14, 0.018);
  rb(M.mahoganyDark, (P.grilleBays[0].from + C.westEnd) / 2, topY + 0.02, gz, C.westEnd - P.grilleBays[0].from + 0.34, 0.07, 0.22, 0.016);
  P.grilleBays.forEach((bay, i) => {
    const mid = (bay.from + bay.to) / 2,
      span = bay.to - bay.from,
      barTop = topY - 0.36;
    decal(A.bays[i], mid, topY - 0.18, gz + 0.075, span - 0.34, 0.25);
    const wicket = 0.54,
      spring = 2.1,
      railY = barTop - 0.04;
    for (const y of [baseY + 0.02, railY]) rod(M.brass, [bay.from + 0.08, y, gz], [bay.to - 0.08, y, gz], 0.016, 6);
    for (let x = bay.from + 0.16; x < bay.to - 0.1; x += 0.125) {
      const off = Math.abs(x - mid),
        from = off < wicket ? spring + Math.sqrt(wicket * wicket - off * off) : baseY;
      rod(M.brassDull, [x, from, gz], [x, railY, gz], 0.0095, 5);
    }
    // The wicket's arch and its little polished sill for passing things through.
    const arch = torus(M.brass, mid, spring, gz, wicket, 0.022, root, Math.PI);
    arch.castShadow = true;
    for (const side of [-1, 1]) rod(M.brass, [mid + side * wicket, baseY, gz], [mid + side * wicket, spring, gz], 0.018, 6);
    rb(M.brass, mid, H + 0.01, gz + 0.12, wicket * 1.8, 0.02, 0.4, 0.006);
  });

  // ------------------------------------------------------ on the public ledge
  const ledge = H + 0.002;
  // The desk bell, which jumps when you press it.
  const bell = group(F.bell.x, ledge, F.bell.z);
  cyl(M.mahoganyDark, 0, 0.02, 0, 0.13, 0.04, 0.12, bell, 16);
  turned(M.brass, [[0.1, 0.05], [0.098, 0.08], [0.082, 0.13], [0.05, 0.17], [0.012, 0.185]], 0, 0, 0, 16, bell);
  cyl(M.iron, 0, 0.21, 0, 0.01, 0.06, 0.01, bell, 6);
  orb(M.black, 0, 0.245, 0, 0.022, 0.018, 0.022, bell);
  mergeGroup(bell);
  keep.add(bell);
  // The card that explains everything.
  const cardZ = F.card.z;
  rb(M.mahoganyDark, F.card.x, ledge + 0.015, cardZ, 0.5, 0.03, 0.12, 0.008);
  decal(A.card, F.card.x, ledge + 0.19, cardZ + 0.012, 0.56, 0.37, 0, root, -0.14);
  b(M.paperBuff, F.card.x, ledge + 0.19, cardZ - 0.004, 0.56, 0.37, 0.006).rotation.x = -0.14;

  // The brass letter scales: pillar, beam and pans. Beam and pans rock together.
  const sx = F.scale.x,
    sz = F.scale.z;
  rb(M.mahoganyDark, sx, ledge + 0.03, sz, 0.86, 0.06, 0.36, 0.012);
  turned(M.brass, [[0.07, 0], [0.05, 0.03], [0.018, 0.06], [0.016, 0.42], [0.03, 0.44], [0.03, 0.47]], sx, ledge + 0.06, sz, 12);
  const beamPivot = group(sx, ledge + 0.53, sz);
  rod(M.brass, [-0.36, 0, 0], [0.36, 0, 0], 0.013, 8, beamPivot);
  orb(M.brass, 0, 0, 0, 0.03, 0.03, 0.03, beamPivot);
  rod(M.brass, [0, 0, 0], [0, 0.11, 0], 0.006, 5, beamPivot);
  const pans = [-1, 1].map((side) => {
    const hanger = group(side * 0.36, 0, 0, 0, beamPivot);
    for (const [dx, dz] of [[0.09, 0], [-0.09, 0], [0, 0.09], [0, -0.09]])
      rod(M.brassDull, [0, 0, 0], [dx, -0.25, dz], 0.0035, 4, hanger);
    turned(M.brass, [[0.118, -0.244], [0.115, -0.25], [0.08, -0.275], [0, -0.28]], 0, 0, 0, 16, hanger);
    return hanger;
  });
  rb(M.parcels[0], 0, -0.205, 0, 0.17, 0.09, 0.13, 0.004, pans[0]);
  b(M.string, 0, -0.205, 0, 0.178, 0.098, 0.008, pans[0]);
  b(M.string, 0, -0.205, 0, 0.008, 0.098, 0.138, pans[0]);
  cyl(M.brass, 0, -0.226, 0, 0.038, 0.05, 0.03, pans[1], 12);
  mergeGroup(pans[0]);
  mergeGroup(pans[1]);
  mergeGroup(beamPivot, new Set(pans));
  keep.add(beamPivot);
  // Little brass weights in their block, in order of size.
  rb(M.mahogany, sx + 0.72, ledge + 0.03, sz + 0.02, 0.52, 0.06, 0.2, 0.01);
  [0.05, 0.042, 0.034, 0.026, 0.02, 0.014].forEach((r, i) => {
    const wx = sx + 0.52 + i * 0.08;
    cyl(M.brass, wx, ledge + 0.06 + r * 1.2, sz + 0.02, r, r * 2.4, r * 0.9, root, 10);
    orb(M.brass, wx, ledge + 0.06 + r * 2.6, sz + 0.02, r * 0.4, r * 0.4, r * 0.4);
  });
  // The inkstand and a pen, a stamp sponge, and the tariff on its little easel.
  const inkX = -0.38;
  rb(M.mahoganyDark, inkX, ledge + 0.02, 0.8, 0.5, 0.04, 0.24, 0.01);
  for (const dx of [-0.13, 0.13]) {
    cyl(M.china, inkX + dx, ledge + 0.08, 0.8, 0.05, 0.08, 0.042, root, 12);
    cyl(M.brass, inkX + dx, ledge + 0.126, 0.8, 0.044, 0.018, 0.038, root, 12);
  }
  rod(M.beam, [inkX + 0.13, ledge + 0.1, 0.8], [inkX + 0.28, ledge + 0.42, 0.7], 0.009, 6);
  turned(M.china, [[0, 0], [0.09, 0], [0.1, 0.03], [0.1, 0.04], [0.088, 0.045]], -1.1, ledge, 0.76, 16);
  orb(M.paperBuff, -1.1, ledge + 0.042, 0.76, 0.07, 0.02, 0.07);
  const tariffX = -4.25;
  decal(A.tariff, tariffX, ledge + 0.27, 0.79, 0.4, 0.53, 0, root, -0.2);
  b(M.mahoganyDark, tariffX, ledge + 0.27, 0.77, 0.43, 0.56, 0.012).rotation.x = -0.2;
  b(M.mahoganyDark, tariffX, ledge + 0.018, 0.84, 0.48, 0.036, 0.16);
  // A rack of forms, and a string-tied parcel someone meant to come back for.
  const rack = -3;
  rb(M.mahogany, rack, ledge + 0.2, 0.72, 0.56, 0.4, 0.26, 0.01);
  for (let i = 0; i < 3; i++) {
    const rx = rack - 0.18 + i * 0.18;
    b(M.holeBack, rx, ledge + 0.22, 0.852, 0.16, 0.32, 0.006);
    for (let k = 0; k < 4; k++) b([M.paperWhite, M.paperBuff, M.paperRose][i], rx, ledge + 0.25, 0.81 + k * 0.012, 0.14, 0.29 - k * 0.03, 0.006);
  }
  parcel(parts, M, -5.35, ledge + 0.14, 0.72, 0.46, 0.28, 0.32, 0.2, 0, decal, A.parcelLabels[3]);

  // The letter flap in the counter's face, with LETTERS over it.
  const lx = F.letterSlot.x,
    lz = faceZ + 0.04;
  rb(M.brass, lx, 1.08, lz, 0.5, 0.16, 0.014, 0.006);
  b(M.black, lx, 1.08, lz + 0.004, 0.38, 0.05, 0.012);
  rb(M.brass, lx, 1.1, lz + 0.014, 0.4, 0.05, 0.01, 0.003);
  decal(A.lettersSign, lx, 0.89, lz + 0.002, 0.44, 0.15);

  // ---------------------------------------------------- the postmaster's ledge
  // Behind the grille: the date stamp and the envelope it lands on.
  const stampX = F.stamp.x,
    stampZ = F.stamp.z;
  rb(M.mahoganyDark, stampX, ledge + 0.016, stampZ, 0.62, 0.032, 0.42, 0.01);
  const postmarkCanvas = document.createElement("canvas");
  postmarkCanvas.width = 384;
  postmarkCanvas.height = 240;
  const pc = postmarkCanvas.getContext("2d");
  const resetEnvelope = () => {
    pc.fillStyle = "#efe7d3";
    pc.fillRect(0, 0, 384, 240);
    pc.fillStyle = "rgba(70,50,30,0.05)";
    for (let i = 0; i < 300; i++) pc.fillRect(random() * 384, random() * 240, 2, 2);
    pc.strokeStyle = "rgba(90,70,50,0.35)";
    pc.lineWidth = 2;
    pc.strokeRect(6, 6, 372, 228);
    pc.font = "italic 26px Georgia";
    pc.fillStyle = "#2f3550";
    pc.textAlign = "left";
    pc.fillText("Someone Dear", 30, 138);
    pc.fillText("The Other End", 30, 172);
    pc.fillText("of the Lane", 30, 206);
    pc.fillStyle = "#a4322b";
    pc.fillRect(306, 16, 56, 70);
    pc.fillStyle = "#f4efe0";
    pc.fillRect(314, 24, 40, 54);
    pc.fillStyle = "#a4322b";
    pc.beginPath();
    pc.arc(334, 50, 14, 0, Math.PI * 2);
    pc.fill();
  };
  resetEnvelope();
  const postmarkMap = new T.CanvasTexture(postmarkCanvas);
  postmarkMap.colorSpace = T.SRGBColorSpace;
  const envelopeMat = new T.MeshStandardMaterial({ map: postmarkMap, roughness: 0.9 });
  const envelope = mesh(new T.PlaneGeometry(0.46, 0.29), envelopeMat, stampX, ledge + 0.034, stampZ);
  envelope.rotation.x = -Math.PI / 2;
  envelope.castShadow = false;
  keep.add(envelope);
  // The stamper: turned handle, shaft and brass die, which comes down on E.
  const stamper = group(stampX + 0.1, ledge + 0.34, stampZ - 0.03);
  turned(M.beam, [[0.018, 0.04], [0.018, 0.14], [0.035, 0.18], [0.05, 0.25], [0.03, 0.31], [0, 0.32]], 0, 0, 0, 12, stamper);
  cyl(M.brass, 0, 0.03, 0, 0.022, 0.06, 0.018, stamper, 10);
  cyl(M.iron, 0, -0.03, 0, 0.055, 0.06, 0.05, stamper, 16);
  mergeGroup(stamper);
  keep.add(stamper);
  // Its rack of spare dates and the ink pad in its tin.
  const padX = stampX + 0.52;
  rb(M.pewter, padX, ledge + 0.02, stampZ + 0.02, 0.26, 0.04, 0.18, 0.006);
  b(M.black, padX, ledge + 0.042, stampZ + 0.02, 0.21, 0.004, 0.14);
  const carousel = stampX - 0.55;
  cyl(M.mahoganyDark, carousel, ledge + 0.02, stampZ, 0.14, 0.04, 0.14, root, 14);
  rod(M.iron, [carousel, ledge, stampZ], [carousel, ledge + 0.3, stampZ], 0.008, 5);
  cyl(M.iron, carousel, ledge + 0.2, stampZ, 0.12, 0.012, 0.12, root, 14);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2,
      cx = carousel + Math.cos(a) * 0.09,
      cz = stampZ + Math.sin(a) * 0.09;
    rod(M.beam, [cx, ledge + 0.1, cz], [cx, ledge + 0.27, cz], 0.012, 6);
    orb(M.beam, cx, ledge + 0.28, cz, 0.022, 0.022, 0.022);
    cyl(M.iron, cx, ledge + 0.08, cz, 0.018, 0.04, 0.018, root, 8);
  }
  // A bundle of letters waiting for it.
  bundle(parts, M, stampX + 0.86, ledge, stampZ - 0.02, 0.4, 0.26, 6);
  // The stamp drawer, pulled out, with its strips of the Willowmere series.
  const drawX = 0.45;
  rb(M.mahogany, drawX, ledge + 0.04, 0.0, 0.92, 0.08, 0.44, 0.012);
  b(M.holeBack, drawX, ledge + 0.082, 0, 0.84, 0.004, 0.36);
  for (let i = 0; i < 3; i++) decal(A.stampStrip, drawX, ledge + 0.086 + i * 0.001, -0.11 + i * 0.11, 0.78, 0.09, 0, root, -Math.PI / 2);
  rb(M.brass, drawX, ledge + 0.04, 0.228, 0.18, 0.04, 0.02, 0.006);

  // ------------------------------------------------------------ the shop's run
  const shopZ = 0.62;
  // A stepped stand for the jars, the good ones up front.
  rb(M.mahogany, 4.95, ledge + 0.04, shopZ, 2.25, 0.08, 0.5, 0.012);
  const jars = [
    { x: 4.1, colours: ["#f1ebdc", "#1e1b1a"], label: 0 },
    { x: 4.53, colours: ["#efb6bf", "#f2d27a"], label: 1 },
    { x: 4.96, colours: ["#f2dd5c", "#efd03f"], label: 2 },
    { x: 5.39, colours: ["#6e2a2a", "#3a1a1c"], label: 3 },
    { x: 5.82, colours: ["#d9974e", "#e7b165"], label: 4 },
  ];
  const sweets = new T.IcosahedronGeometry(1, 0),
    glass = [];
  jars.forEach(({ x, colours, label }) => {
    const y = ledge + 0.08,
      r = 0.17,
      h = 0.5;
    for (let i = 0; i < 26; i++) {
      const a = random() * Math.PI * 2,
        d = Math.sqrt(random()) * (r - 0.045),
        size = range(0.028, 0.04),
        s = mesh(sweets, parts.mat(colours[i % 2], 0.28), x + Math.cos(a) * d, y + 0.04 + (i / 26) * (h * 0.66) + range(-0.015, 0.015), shopZ + Math.sin(a) * d);
      s.scale.set(size, size * range(0.7, 1), size);
      s.rotation.set(random() * 3, random() * 3, 0);
      s.castShadow = false;
    }
    glass.push(new T.CylinderGeometry(r, r, h, 18, 1, true).applyMatrix4(new T.Matrix4().makeTranslation(x, y + h / 2, shopZ)));
    cyl(M.china, x, y + 0.004, shopZ, r, 0.012, r, root, 18).castShadow = false;
    cyl(M.brass, x, y + h + 0.03, shopZ, r + 0.012, 0.06, r + 0.012, root, 18);
    orb(M.brass, x, y + h + 0.075, shopZ, 0.03, 0.022, 0.03);
    decal(A.jarLabels[label], x, y + 0.2, shopZ + r + 0.004, 0.22, 0.095);
  });
  const jarShells = mesh(mergeGeometries(glass), M.jarGlass);
  jarShells.castShadow = jarShells.receiveShadow = false;
  glass.forEach((g) => g.dispose());
  // The saucer of petals, the honour system at work.
  turned(M.china, [[0.14, 0.04], [0.13, 0.03], [0.09, 0], [0, 0]], 3.82, ledge, 0.98, 16);
  for (let i = 0; i < 7; i++) orb(M.geranium, 3.82 + range(-0.06, 0.06), ledge + 0.03, 0.98 + range(-0.06, 0.06), 0.022, 0.006, 0.014);
  // The till, all brass and little round keys.
  const till = group(6, ledge, 0.15);
  till.rotation.y = -0.2;
  rb(M.brass, 0, 0.13, 0, 0.52, 0.26, 0.46, 0.012, till);
  rb(M.brassDull, 0, 0.29, -0.05, 0.46, 0.14, 0.32, 0.012, till);
  rb(M.mahoganyDark, 0, 0.02, 0.02, 0.6, 0.04, 0.54, 0.008, till);
  for (let row = 0; row < 3; row++)
    for (let col = 0; col < 5; col++) {
      const key = cyl(M.black, -0.16 + col * 0.08, 0.1 + row * 0.055, 0.24, 0.018, 0.022, 0.018, till, 8);
      key.rotation.x = Math.PI / 2;
    }
  decal(A.scaleSign, 0, 0.34, 0.112, 0.34, 0.1, 0, till);
  // String, from an iron cage on the ceiling down to a loop on the counter.
  const stringX = 3.86,
    stringZ = 0.34;
  rod(M.iron, [stringX, P.ceiling, stringZ], [stringX, 3.7, stringZ], 0.012, 5);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    rod(M.iron, [stringX, 3.7, stringZ], [stringX + Math.cos(a) * 0.13, 3.5, stringZ + Math.sin(a) * 0.13], 0.005, 4);
    rod(M.iron, [stringX + Math.cos(a) * 0.13, 3.5, stringZ + Math.sin(a) * 0.13], [stringX, 3.3, stringZ], 0.005, 4);
  }
  orb(M.twine, stringX, 3.5, stringZ, 0.105, 0.105, 0.105);
  tube(M.string, [[stringX, 3.4, stringZ], [stringX + 0.02, 2.4, stringZ + 0.02], [stringX + 0.08, 1.56, stringZ + 0.04], [stringX + 0.3, ledge + 0.008, stringZ + 0.14], [stringX + 0.06, ledge + 0.008, stringZ + 0.22]], 0.005);
  // Paper bags on a spike, and a brown-paper roll on its iron cutter.
  rod(M.iron, [4.52, ledge, 0.15], [4.52, ledge + 0.26, 0.15], 0.006, 4);
  for (let i = 0; i < 6; i++) b(M.paperBuff, 4.52, ledge + 0.02 + i * 0.012, 0.15, 0.2, 0.008, 0.26).rotation.y = i * 0.09;
  rod(M.iron, [5.1, ledge + 0.03, -0.05], [5.1, ledge + 0.2, -0.05], 0.015, 6);
  rod(M.iron, [5.75, ledge + 0.03, -0.05], [5.75, ledge + 0.2, -0.05], 0.015, 6);
  rod(M.parcels[2], [5.06, ledge + 0.2, -0.05], [5.79, ledge + 0.2, -0.05], 0.075, 14);
  b(M.iron, 5.42, ledge + 0.13, 0.05, 0.72, 0.02, 0.012);

  return { bell, beamPivot, pans, stamper, postmarkCanvas, postmarkMap, resetEnvelope };
}

/** A brown-paper parcel with its string and maybe a label. */
export function parcel(parts, M, x, y, z, w, h, d, turn = 0, tone = 0, decal, label) {
  const { b, group, root } = parts,
    g = group(x, y, z, turn, root);
  b(M.parcels[tone], 0, 0, 0, w, h, d, g);
  b(M.string, 0, 0, 0, w + 0.008, h + 0.008, 0.012, g);
  b(M.string, 0, 0, 0, 0.012, h + 0.008, d + 0.008, g);
  b(M.string, 0, h / 2 + 0.008, 0, 0.05, 0.016, 0.05, g);
  if (label) decal(label, -w * 0.22, h * 0.02, d / 2 + 0.003, Math.min(0.26, w * 0.42), Math.min(0.16, w * 0.26), 0, g, 0, 0.05);
  return g;
}

/** Letters stacked square and tied with a bow. */
export function bundle(parts, M, x, y, z, w, d, count, turn = 0) {
  const { b, group, random, range, root } = parts,
    g = group(x, y, z, turn, root),
    tones = [M.paperWhite, M.paperBuff, M.paperBlue, M.paperRose];
  for (let i = 0; i < count; i++) {
    const letter = b(tones[Math.floor(random() * 4)], range(-0.008, 0.008), 0.009 + i * 0.016, range(-0.008, 0.008), w, 0.014, d, g);
    letter.rotation.y = range(-0.03, 0.03);
  }
  const top = count * 0.016 + 0.006;
  b(M.string, 0, top / 2, 0, 0.012, top, d + 0.014, g);
  b(M.string, 0, top / 2, 0, w + 0.014, top, 0.012, g);
  return g;
}
