// Two-tier card stack options (from the mockups), shared by the viewer.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';
// The soft stacks as real single solids (soft_stack.py). When loaded, they replace the mockup pieces.
const SOFT_STL = {};
const PAIR_STAGGER = 39.3;   // must match soft_stack.py
export async function loadSoftStacks(base = './soft/') {
  const L = new STLLoader();
  await Promise.all(['soft-stack-pair', 'card-slots'].map(async f => {
    const k = f.replace('soft-stack-', '');
    try { const g = await L.loadAsync(`${base}${f}.stl`); g.computeVertexNormals(); SOFT_STL[k] = g; } catch (e) { /* mockup fallback */ }
  }));
}
const M = c => new THREE.MeshStandardMaterial({ color: c, roughness: .75 });
const PLA = M(0xd8cdb4), PLA2 = M(0xb9a98a), HOLE = M(0x2b2b26), CARD = M(0xf4f1e8);
const BACK = { hb: M(0x6fa98f), bonus: M(0x86a873), bird: M(0x9fb3c8) };
const T = 0.3, WALL = 2.0, FL = 2.0, CLR = 1.5;
const STACKS = [['hb', [67, 44], 35, 35], ['bonus', [87, 57], 58, 20], ['bird', [87, 57], 130, 110]];

// SOFT: the "no right angles" styling. Every block gets rounded edges, trays are one swooping shell with rounded
// corners, rails and the A-frame get filleted profiles. Set per option while it builds.
let SOFT = false;
const boxGeo = (a, b, c) => SOFT ? new RoundedBoxGeometry(a, b, c, 3, Math.max(0.01, Math.min(1.2, a / 2, b / 2, c / 2) - 0.01)) : new THREE.BoxGeometry(a, b, c);
// A polygon with every corner filleted (radius r, clamped to half of the shorter neighbouring edge)
function roundPoly(pts, r) {      // r: one radius for all corners, or omit it and give each point its own [x, y, r]
  const P = pts.map(([x, y]) => new THREE.Vector2(x, y)), n = P.length, s = new THREE.Shape();
  P.forEach((v, i) => {
    const a = P[(i + n - 1) % n], b = P[(i + 1) % n];
    const rr = Math.min(r ?? pts[i][2] ?? 0, v.distanceTo(a) / 2, v.distanceTo(b) / 2);
    if (!(rr > 0)) { i ? s.lineTo(v.x, v.y) : s.moveTo(v.x, v.y); return; }
    const p0 = v.clone().addScaledVector(a.clone().sub(v).normalize(), rr), p1 = v.clone().addScaledVector(b.clone().sub(v).normalize(), rr);
    i ? s.lineTo(p0.x, p0.y) : s.moveTo(p0.x, p0.y); s.quadraticCurveTo(v.x, v.y, p1.x, p1.y);
  });
  s.closePath(); return s;
}
// Points around a rounded rectangle, the same count and spacing for any size, so two of them pair up point for point
function rrPoints(x0, y0, x1, y1, r) {
  const out = [], k = 12, m = 10;          // k samples per straight side, m per corner arc
  const C = [[x1 - r, y0 + r, -Math.PI / 2], [x1 - r, y1 - r, 0], [x0 + r, y1 - r, Math.PI / 2], [x0 + r, y0 + r, Math.PI]];
  C.forEach(([cx, cy, a0], i) => {
    for (let j = 0; j < m; j++) { const a = a0 + j / m * Math.PI / 2; out.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); }
    const [nx, ny, na] = C[(i + 1) % 4], ex = nx + r * Math.cos(na), ey = ny + r * Math.sin(na);
    const sx = cx + r * Math.cos(a0 + Math.PI / 2), sy = cy + r * Math.sin(a0 + Math.PI / 2);
    for (let j = 0; j < k; j++) out.push([sx + (ex - sx) * j / k, sy + (ey - sy) * j / k]);
  });
  return out;
}
// The soft tray: a rounded floor plus a single shell wall that swoops from a low front lip up to full height at the
// back, with a rounded crest all the way round (local frame as tray(): x across, y depth, front at y = 0)
function softTray(parent, w, d, wallH, lip, m, tilt) {
  const t = new THREE.Group(), R = 6, WT = 1.6;
  const fl = new THREE.ExtrudeGeometry(roundPoly([[0.6, 0.6], [w - 0.6, 0.6], [w - 0.6, d - 0.6], [0.6, d - 0.6]], R), { depth: FL - 1.2, bevelEnabled: true, bevelThickness: 0.6, bevelSize: 0.6, bevelSegments: 3 });
  const floor = new THREE.Mesh(fl, m); floor.position.z = 0.6; t.add(floor);
  const O = rrPoints(0, 0, w, d, R), I = rrPoints(WT, WT, w - WT, d - WT, R - WT), N = O.length;
  const hAt = y => { const u = Math.min(1, Math.max(0, (y - d * 0.05) / (d * 0.5))); return lip + (wallH - lip) * (0.5 - 0.5 * Math.cos(Math.PI * u)); };
  const pos = [], idx = [];
  for (let i = 0; i < N; i++) {
    const [ox, oy] = O[i], [ix, iy] = I[i], h = hAt((oy + iy) / 2), rt = WT / 2, mx = (ox + ix) / 2, my = (oy + iy) / 2;
    const ring = [[ox, oy, 0.6], [ox, oy, h - rt], [ox + (mx - ox) * 0.3, oy + (my - oy) * 0.3, h - rt * 0.3], [mx, my, h],
      [ix + (mx - ix) * 0.3, iy + (my - iy) * 0.3, h - rt * 0.3], [ix, iy, h - rt], [ix, iy, FL]];
    ring.forEach(p => pos.push(...p));
  }
  const S = 7;
  for (let i = 0; i < N; i++) { const j = (i + 1) % N;
    for (let k = 0; k < S - 1; k++) { const a = i * S + k, b = j * S + k; idx.push(a, b, b + 1, a, b + 1, a + 1); } }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx);
  g.computeVertexNormals(); t.add(new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: m.color, roughness: m.roughness, side: THREE.DoubleSide })));
  t.rotation.x = tilt * Math.PI / 180; if (tilt < 0) t.position.z = -d * Math.sin(tilt * Math.PI / 180); parent.add(t); return t;
}

function box(g, x0, x1, y0, y1, z0, z1, m) {
  const b = new THREE.Mesh(boxGeo(x1 - x0, y1 - y0, z1 - z0), m);
  b.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2); g.add(b); return b;
}
// A tray in its own frame: x across, y depth (front y = 0), floor at z = 0; tilted `tilt` degrees about its front edge
// (back raised). Scoops: 'notch' U gap in the front lip, 'wide' front cut down to a 3 mm lip, 'side' gaps in both side
// walls at the front, 'floor' finger slot through the floor at the front.
function tray(parent, w, d, wallH, scoop, m = PLA, tilt = 0) {
  const t = new THREE.Group();
  box(t, 0, w, 0, d, 0, FL, m);
  if (scoop === 'floor') box(t, w * .35, w * .65, WALL, WALL + 14, -0.1, FL + 0.1, HOLE);
  const sideFrom = scoop === 'side' ? d * .45 : 0;
  if (scoop === 'cutout') {                       // full side walls with a 22 mm finger cutout down to 6 mm, mid-depth
    for (const x of [0, w - WALL]) { box(t, x, x + WALL, 0, d * .5 - 11, 0, wallH, m); box(t, x, x + WALL, d * .5 + 11, d, 0, wallH, m);
      box(t, x, x + WALL, d * .5 - 11, d * .5 + 11, 0, 6, m); }
  } else {
  box(t, 0, WALL, sideFrom, d, 0, wallH, m); box(t, w - WALL, w, sideFrom, d, 0, wallH, m); }
  if (scoop === 'side') { box(t, 0, WALL, 0, sideFrom, 0, 4, m); box(t, w - WALL, w, 0, sideFrom, 0, 4, m); }
  box(t, 0, w, d - WALL, d, 0, wallH, m);
  const lip = Math.min(8, wallH);
  if (scoop === 'thumb') {
    box(t, 0, w / 2 - 12.5, 0, WALL, 0, wallH, m); box(t, w / 2 + 12.5, w, 0, WALL, 0, wallH, m);   // U notch to the floor
  }
  else if (scoop === 'low') {                     // 4 mm front lip, 1.4 mm thick with a fully rounded top
    const lt = 1.4; box(t, 0, w, WALL - lt, WALL, 0, 4 - lt / 2, m);
    const cyl = new THREE.Mesh(new THREE.CylinderGeometry(lt / 2, lt / 2, w, 24), m);
    cyl.rotation.z = Math.PI / 2; cyl.position.set(w / 2, WALL - lt / 2, 4 - lt / 2); t.add(cyl);
  }
  else if (scoop === 'ramp' || scoop === 'cutout') {
    // curved ramp: concave quarter round from the floor up to a 10 mm lip, so a dragged card rides up and off
    const rr = 10, sh = new THREE.Shape([new THREE.Vector2(0, 0), new THREE.Vector2(rr, 0)]);
    for (let i = 0; i <= 12; i++) { const q = i / 12 * Math.PI / 2; sh.lineTo(rr - rr * Math.sin(q), rr - rr * Math.cos(q)); }
    // shape x -> tray y (depth), shape y -> z, extrude -> tray x
    const ramp = new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth: w - 2 * WALL, bevelEnabled: false }), m);
    ramp.geometry.applyMatrix4(new THREE.Matrix4().set(0, 0, 1, 0,  1, 0, 0, 0,  0, 1, 0, 0,  0, 0, 0, 1));
    ramp.position.set(WALL, WALL, FL); t.add(ramp);
    box(t, 0, w, 0, WALL, 0, FL + rr, m);
  }
  else if (scoop === 'notch') { box(t, 0, w * .32, 0, WALL, 0, lip, m); box(t, w * .68, w, 0, WALL, 0, lip, m); }
  else if (scoop === 'wide') box(t, 0, w, 0, WALL, 0, 3, m);
  else box(t, 0, w, 0, WALL, 0, lip, m);
  t.rotation.x = tilt * Math.PI / 180; if (tilt < 0) t.position.z = -d * Math.sin(tilt * Math.PI / 180); parent.add(t); return t;
}
function pile(t, w, d, n, mat, y0 = WALL + CLR) {     // y0: where the pile's front edge sits (behind a ramp)
  if (!n) return;
  const y1 = d - WALL - CLR;
  box(t, WALL + CLR, w - WALL - CLR, y0, y1, FL, FL + n * T, CARD);
  box(t, WALL + CLR, w - WALL - CLR, y0, y1, FL + n * T, FL + n * T + 0.2, mat);
}
const dims = c => [c[0] + 2 * (WALL + CLR), c[1] + 2 * (WALL + CLR)];
const orient = (c, o) => o === 'portrait' ? [c[1], c[0]] : c;
const lift = (d, tilt) => d * Math.abs(Math.sin(tilt * Math.PI / 180));

// The soft stack as one printed piece: two side cheeks whose single filleted outline wraps both tiers (deck below,
// discard stepped back above, both tilted `tilt`), joined by the two floors, the two back walls and the rounded front
// lips, all one material. Returns the tiers' tilted frames (as tray() would) for the piles.
function softUnit(s, w, d, back, h1, sn, tilt, loH, hiH, k) {
  const lip = 4, sm = u => 0.5 - 0.5 * Math.cos(Math.PI * Math.min(1, Math.max(0, u)));
  const hAt = (y, H) => lip + (H - lip) * sm((y - d * 0.05) / (d * 0.5));        // wall height above a tier's floor
  const loTop = y => (d - y) * sn + hAt(y, loH), hiTop = y => h1 + (d - (y - back)) * sn + hAt(y - back, hiH);
  // the back face is vertical, but the tilted discard pile leans back into it: push it out by hiH * sin(tilt) and fill
  // [y, z, fillet]: real corners get a fillet, the sampled swoops none (filleting every sample left notches)
  const BK = back + d + hiH * sn, pr = [[0, 0, 3], [BK, 0, 3], [BK, h1 + hiH, 3]];
  for (let i = 0; i <= 48; i++) { const y = back + d - d * i / 48; pr.push([y, hiTop(y), i === 48 ? 0.8 : 0]); }
  pr.push([back - 0.01, h1 + d * sn - 1, 1.5]);
  for (let i = 0; i <= 24; i++) { const y = back - back * i / 24; pr.push([y - 0.02 * (i === 0), Math.min(loTop(y), h1 + d * sn - 2), i === 24 ? 0.8 : 0]); }
  const cheek = new THREE.ExtrudeGeometry(roundPoly(pr), { depth: WALL - 1, bevelEnabled: true, bevelThickness: 0.5, bevelSize: 0.5, bevelSegments: 6, curveSegments: 12 });
  cheek.applyMatrix4(new THREE.Matrix4().set(0, 0, 1, 0,  1, 0, 0, 0,  0, 1, 0, 0,  0, 0, 0, 1));
  if (!SOFT_STL.pair) for (const x of [0.5, w - WALL + 0.5]) { const c = new THREE.Mesh(cheek, PLA); c.position.x = x; s.add(c); }
  const frame = z0 => { const t = new THREE.Group(); t.rotation.x = tilt * Math.PI / 180; t.position.z = d * sn + z0; s.add(t); return t; };
  const lo = frame(0), hiG = new THREE.Group(); hiG.position.set(0, back, 0); s.add(hiG);
  const hi = new THREE.Group(); hi.rotation.x = tilt * Math.PI / 180; hi.position.z = d * sn + h1; hiG.add(hi);
  if (SOFT_STL.pair) return { lo, hi };   // the real printed body is added once for the pair (stepped)
  for (const [t, backH] of [[lo, h1 + back * sn], [hi, hiH]]) {
    box(t, WALL - 0.6, w - WALL + 0.6, 0, d - WALL + 0.5, 0, FL, PLA);                 // floor, run into the cheeks and back
    box(t, WALL - 0.6, w - WALL + 0.6, d - WALL, d, 0, backH, PLA);                   // tier's back wall, square to its floor
    const lp = new THREE.Mesh(new THREE.CapsuleGeometry(0.8, w - 2 * WALL + 1.2, 4, 12), PLA);   // rounded front lip
    lp.rotation.z = Math.PI / 2; lp.position.set(w / 2, 1, lip - 0.8); t.add(lp);
    box(t, WALL - 0.6, w - WALL + 0.6, 0.2, 1.8, 0, lip - 0.8, PLA);
  }
  // one vertical back face, table to the discard tier's top. It spans the cheeks' flat middle exactly and its profile
  // is the cheeks' outline offset by their 0.5 mm bevel (radius 3 -> 3.5), so faces and fillets meet tangent, no seam
  const bp = roundPoly([[back + d - WALL, -0.5], [BK + 0.5, -0.5], [BK + 0.5, h1 + hiH + 0.5], [back + d - WALL + hiH * sn, h1 + hiH + 0.5], [back + d - WALL, h1]], 3.5);   // front edge follows the tilted inner back wall
  const bg = new THREE.ExtrudeGeometry(bp, { depth: w - 1, bevelEnabled: false, curveSegments: 12 });
  bg.applyMatrix4(new THREE.Matrix4().set(0, 0, 1, 0.5,  1, 0, 0, 0,  0, 1, 0, 0,  0, 0, 0, 1));
  s.add(new THREE.Mesh(bg, PLA));
  return { lo, hi };
}
// Stepped: discard tray stepped back `step` of a card depth, on side rails. arrange: 'row' (stacks side by side) or
// 'line' (one behind another, lengthwise)
function stepped(g, o) {
  let off = 0; const info = [];
  for (const [k, c0, nd, nx] of STACKS) {
    const c = orient(c0, o.orient), [w, d0] = dims(c), d = d0 + (o.extra || 0), s = new THREE.Group();
    const gap = nd * T + (o.headroom || 8) + lift(d, o.tilt), back = d * o.step, h1 = FL + gap;
    const loH = o.loWall ? FL + nd * T + 3 : 12, hiH = 8 + nx * T;
    if (o.soft) {
      const sn = o.tilt < 0 ? Math.sin(-o.tilt * Math.PI / 180) : 0;
      const { lo, hi } = softUnit(s, w, d, back, h1, sn, o.tilt, loH, hiH, k);
      pile(lo, w, d, nd, BACK[k], o.pileAt); pile(hi, w, d, nx, CARD, o.hiPileAt);
      if (o.pair && k !== 'hb') {
        // bonus and bird print as one piece (soft_stack.py): bird bay on the bonus bay's -x side sharing the middle
        // cheek, set back PAIR_STAGGER
        let P = g.children.find(c => c.userData.pair);
        if (!P) { P = new THREE.Group(); P.userData.pair = true; g.add(P); if (SOFT_STL.pair) P.add(new THREE.Mesh(SOFT_STL.pair, PLA)); }
        if (k === 'bird') s.position.set(-(w - WALL), PAIR_STAGGER, 0);
        P.add(s); continue;
      }
      if (o.arrange === 'line') s.position.y = off; else s.position.x = off;
      g.add(s); info.push(`${k} ${w.toFixed(0)}x${(d + back).toFixed(0)}x${(h1 + hiH + d * sn).toFixed(0)}`);
      off += (o.arrange === 'line' ? d + back : w) + 6; continue;
    }
    const mk = (par, hh, sc) => tray(par, w, d, hh, sc, PLA, o.tilt);
    const lo = mk(s, loH, o.loScoop || o.scoop); pile(lo, w, d, nd, BACK[k], o.pileAt);
    const hiG = new THREE.Group(); hiG.position.set(0, back, h1); s.add(hiG);
    const hi = mk(hiG, hiH, o.hiScoop || o.scoop); pile(hi, w, d, nx, CARD, o.hiPileAt);
    // side rails: solid from the table up to the underside of both trays (wedge-shaped when the trays tilt), 0.3 mm
    // proud of the tray walls so their faces don't fight
    const sn = o.tilt < 0 ? Math.sin(-o.tilt * Math.PI / 180) : 0, pr = [[0, 0], [back + d, 0], [back + d, h1],
      [back, h1 + d * sn], [back, (d - back) * sn], [0, d * sn]];
    const rail = SOFT ? new THREE.ExtrudeGeometry(roundPoly(pr, 5), { depth: WALL - 0.7, bevelEnabled: true, bevelThickness: 0.5, bevelSize: 0.5, bevelSegments: 3 })
      : new THREE.ExtrudeGeometry(new THREE.Shape(pr.map(([y, z]) => new THREE.Vector2(y, z))), { depth: WALL + 0.3, bevelEnabled: false });
    rail.applyMatrix4(new THREE.Matrix4().set(0, 0, 1, 0,  1, 0, 0, 0,  0, 1, 0, 0,  0, 0, 0, 1));
    for (const x of [-0.3, w - WALL]) { const r = new THREE.Mesh(rail, PLA2); r.position.x = x; s.add(r); }
    box(s, WALL, w - WALL, back + d - WALL, back + d, 0, h1, PLA2);   // back panel between the rails, under the discard tier
    box(lo, 0, w, d - WALL, d, 0, h1 + back * sn, PLA);   // the deck tray's back wall runs up to meet the discard tier's floor
    if (o.arrange === 'line') s.position.y = off; else s.position.x = off;
    g.add(s);
    const H = h1 + 8 + nx * T + lift(d, o.tilt);
    info.push(`${k} ${w.toFixed(0)}x${(d + back).toFixed(0)}x${H.toFixed(0)}`);
    off += (o.arrange === 'line' ? d + back : w) + 6;
  }
  return info;
}
// Lid: discard tray sits right on its deck well, offset back by `step` (0 = flush)
function lid(g, o) {
  let off = 0; const info = [];
  for (const [k, c0, nd, nx] of STACKS) {
    const c = orient(c0, o.orient), [w, d] = dims(c), s = new THREE.Group();
    const wellH = nd * T + 6, back = d * o.step;
    const lo = tray(s, w, d, wellH, o.scoop, PLA, o.tilt); pile(lo, w, d, nd, BACK[k]);
    const hiG = new THREE.Group(); hiG.position.set(0, back, wellH + 0.5 + lift(back, o.tilt)); s.add(hiG);
    const hi = tray(hiG, w, d, 8 + nx * T, o.scoop, PLA2, o.tilt); pile(hi, w, d, nx, CARD);
    if (o.arrange === 'line') s.position.y = off; else s.position.x = off;
    g.add(s);
    info.push(`${k} ${w.toFixed(0)}x${(d + back).toFixed(0)}x${(wellH + 9 + nx * T + lift(d, o.tilt)).toFixed(0)}`);
    off += (o.arrange === 'line' ? d + back : w) + 6;
  }
  return info;
}


const OPTS = [
  ['D4 + 10° tilt: lids, cards lengthwise', lid, { tilt: 10, scoop: 'notch', orient: 'portrait', arrange: 'row', step: 0 },
   [[47.0, -67.2, -55], [101.8, 34.0, 0], [50.4, 97.8, 2.7]], 'Fits the 37 cm tray (the bonus and bird pair needs 163 of 182 mm).'],
  ['B6: stepped, lengthwise, floor slot', stepped, { tilt: 0, scoop: 'floor', orient: 'portrait', arrange: 'row', step: .35, hbLean: 70 }],
  ['B6 + hummingbird A-frame, cards turned 90°', stepped, { tilt: 0, scoop: 'floor', orient: 'portrait', arrange: 'row', step: .35, hbFrame: 70, turned: true }],
  ['B6 + hummingbird A-frame, cards on long edge', stepped, { tilt: 0, scoop: 'floor', orient: 'portrait', arrange: 'row', step: .35, hbFrame: 70, turned: false }],
  ['D3: lids set back a third, side scoops', lid, { tilt: 0, scoop: 'side', orient: 'landscape', arrange: 'row', step: .33 }],
  ['B6-A: walled trays, thumb notch to the floor', stepped, { tilt: 0, scoop: 'thumb', loWall: true, headroom: 12, orient: 'portrait', arrange: 'row', step: .35, hbFrame: 70, turned: true }],
  ['B6-B: tilted 8° back, 4 mm front lip', stepped, { tilt: -8, scoop: 'low', loWall: true, orient: 'portrait', arrange: 'row', step: .35, hbFrame: 70, turned: true }],
  ['B6-C: ramp front on the deck, side cutouts on the discard', stepped, { tilt: 0, loWall: true, loScoop: 'ramp', hiScoop: 'cutout', orient: 'portrait', arrange: 'row', step: .35, extra: 10, pileAt: WALL + 10.5, hiPileAt: WALL + 10.5, hbFrame: 70, turned: true }],
  ['B6-B soft: no right angles anywhere', stepped, { tilt: -8, scoop: 'low', loWall: true, soft: true, pair: true, orient: 'portrait', arrange: 'row', step: .32, hbFrame: 70, turned: true }],
];
for (const k of [1, 2, 3]) OPTS[k].push([[61.1, -53.7, 18.7], [34.8, 108, 89.2], [98.3, 65.9, 89.2]], 'Needs a 38 cm tray: the bonus and bird pair reaches 184 mm, 2 past the rim.');
// A-frames: ridge pointing out toward the rim, one pile either side, centred on the cards quarter middle line, outer
// bird cards' rests (128 mm out); the turned version is 79 mm across the ridge, the long-edge one 63
OPTS[2][3] = [[58.0, -58.0, -45], ...OPTS[2][3].slice(1)];
OPTS[3][3] = [[58.7, -58.7, -45], ...OPTS[3][3].slice(1)];
for (const k of [5, 6, 7, 8]) OPTS[k].push(OPTS[2][3], OPTS[2][4]);
OPTS[8][3] = [OPTS[2][3][0], [63.75, 85.0, 90.0]];   // A-frame, then the bonus+bird piece (searched: reaches 180.7 mm, 44.3 from the centre)
OPTS[8][4] = 'The bonus + bird stack is the real printable piece (soft_stack.py) and clears the rim by 1.3 mm. The card quarters are shown plain, with the display card holders from the build; the hummingbird A-frame is a mockup.';
OPTS[7][4] = 'Needs about a 39 cm tray: the ramps add 10 mm to each card tray, so the bonus and bird pair reaches about 189 mm.';
OPTS[4].push([[53.9, -57.8, -47], [93.8, 47.4, 86.7], [51.6, 135.0, 86.9]], 'Needs a 41 cm tray: the bonus and bird pair reaches 202 mm.');

// The option's three stacks placed in the tray (world frame, on the card quarters' floor at z = 13.4)
// Hummingbird deck and discard side by side, cards on edge leaning back at `lean` degrees from flat, each pile
// against a sloped back rest, with low side walls and a front stop (local: x across, y depth, front at y = 0)
// A-frame: the two piles lean toward each other across the middle (mirrored), each against an outer rest.
// turned: cards stand on their short edge (67 tall); otherwise on their long edge (44 tall).
function aFrame(lean, turned) {
  // A solid A-shaped block: both piles lie on its 70-degree faces, leaning in toward each other, with a lip at each
  // pile's foot so it can't slide off (local: x across the ridge, y along it, front at y = 0)
  const g = new THREE.Group(), n = 35, a = lean * Math.PI / 180, stack = n * T;
  const [cw, ch] = turned ? [44, 67] : [67, 44];                 // cw runs along the ridge, ch up the face
  const len = cw + 2 * CLR + 2 * WALL, H = ch * Math.sin(a) + 3, bx = H / Math.tan(a), lip = 6;
  const foot = bx + stack / Math.sin(a) + 1 + 2.4;                 // the lip's outer face
  box(g, -foot, foot, 0, len, 0, FL, PLA);                                                            // base plate
  const shape = SOFT ? roundPoly([[-bx, 0], [bx, 0], [0, H]], 4) : new THREE.Shape([new THREE.Vector2(-bx, 0), new THREE.Vector2(bx, 0), new THREE.Vector2(0, H)]);
  const block = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, SOFT ? { depth: len - 1.6, bevelEnabled: true, bevelThickness: 0.8, bevelSize: 0.4, bevelSegments: 3 } : { depth: len, bevelEnabled: false }), PLA2);
  if (SOFT) block.geometry.translate(0, 0, 0.8);
  block.rotation.x = Math.PI / 2; block.position.set(0, len, FL); g.add(block);
  // Mid-game: 40 hummingbirds = 25 in the draw deck (back up), 5 in the display, 10 discarded (face up). The frame
  // stays sized for the worst case (35 per side); each pile rests on its face, so a thinner pile just leaves the lip gap.
  [[-1, BACK.hb, 25], [1, CARD, 10]].forEach(([sgn, top, cnt]) => {
    const stack = cnt * T;
    box(g, sgn < 0 ? -foot : foot - 2.4, sgn < 0 ? -foot + 2.4 : foot, 0, len, FL, FL + lip, PLA);   // lip at the pile's foot
    // The pile's foot slides out to the lip and it leans back against the ridge, so a thin pile lies a little flatter
    // than the 70-degree face: solve for the angle b where the pile's inner face runs from its foot to the apex
    const L = foot - 2.4 - 0.2; let b = a, x0 = bx;
    for (let i = 0; i < 20; i++) { x0 = L - stack * Math.sin(b); b = Math.atan2(H, x0); }
    const d = new THREE.Vector2(-sgn * Math.cos(b), Math.sin(b)), nrm = new THREE.Vector2(sgn * Math.sin(b), Math.cos(b));
    const c = new THREE.Mesh(boxGeo(stack, cw, ch), CARD);
    c.rotation.y = -sgn * (Math.PI / 2 - b);
    const ctr = new THREE.Vector2(sgn * x0, 0).addScaledVector(d, ch / 2).addScaledVector(nrm, stack / 2);
    c.position.set(ctr.x, len / 2, FL + ctr.y); g.add(c);
    const f = c.clone(); f.material = top; f.scale.set(0.02 / stack, 1, 1);                              // front card's colour
    const fc = ctr.clone().addScaledVector(nrm, stack / 2 + 0.05); f.position.set(fc.x, len / 2, FL + fc.y); g.add(f);
  });
  return g;
}
function leanPair(lean) {
  const g = new THREE.Group(), [cw, ch] = [44, 67], n = 35, a = lean * Math.PI / 180;
  const stack = n * T, depth = ch * Math.cos(a) + stack * Math.sin(a) + 2 * CLR, w = cw + 2 * CLR;
  [['deck', BACK.hb], ['discard', CARD]].forEach(([_, top], k) => {
    const x0 = k * (w + WALL) ;
    box(g, x0, x0 + w + 2 * WALL, 0, depth + WALL + 4, 0, FL, PLA);                                   // floor
    box(g, x0, x0 + WALL, 0, depth + 4, 0, 14, PLA); box(g, x0 + w + WALL, x0 + w + 2 * WALL, 0, depth + 4, 0, 14, PLA);   // sides
    box(g, x0, x0 + w + 2 * WALL, 0, WALL, 0, 6, PLA);                                                // front stop
    const rest = new THREE.Mesh(new THREE.BoxGeometry(w, 2.4, 28), PLA2);                             // back rest, along the cards
    rest.rotation.x = -(Math.PI / 2 - a); rest.position.set(x0 + WALL + w / 2, depth + 1.2 - 14 * Math.cos(a), FL + 14 * Math.sin(a)); g.add(rest);
    const c = new THREE.Mesh(new THREE.BoxGeometry(cw, stack, ch), CARD);                              // the stack, leaning back
    c.rotation.x = -(Math.PI / 2 - a);
    c.position.set(x0 + WALL + w / 2, WALL + CLR + (ch * Math.cos(a) + stack * Math.sin(a)) / 2, FL + (ch * Math.sin(a) + stack * Math.cos(a)) / 2);
    g.add(c);
    const f = new THREE.Mesh(new THREE.BoxGeometry(cw, 0.2, ch), top); f.rotation.copy(c.rotation);   // front card's colour
    f.position.copy(c.position).add(new THREE.Vector3(0, -(stack / 2 + 0.1) * Math.sin(a), -(stack / 2 + 0.1) * -Math.cos(a) * -1)); g.add(f);
  });
  return g;
}
export function stackOption(i) {
  const [name, fn, o, places, note] = OPTS[i];
  const out = new THREE.Group(), all = new THREE.Group(); SOFT = !!o.soft; fn(all, o);
  if (o.hbFrame) { all.remove(all.children[0]); all.add(aFrame(o.hbFrame, o.turned)); all.children.unshift(all.children.pop()); }
  if (o.hbLean) { all.remove(all.children[0]); const lp = leanPair(o.hbLean); all.add(lp); all.children.unshift(all.children.pop()); }
  [...all.children].forEach((s, k) => {
    const bb = new THREE.Box3().setFromObject(s), c = bb.getCenter(new THREE.Vector3());
    const holder = new THREE.Group(); s.position.x -= c.x; s.position.y -= c.y; holder.add(s);
    const [x, y, f] = places[k]; holder.position.set(x, y, 13.4); holder.rotation.z = (f + 90) * Math.PI / 180; out.add(holder);
  });
  const soft = !!o.soft; SOFT = false; return { group: out, name, note, soft };
}
export const STACK_OPTIONS = OPTS.map(o => o[0]);
// Plain floors and rims for the two card quarters (their printed features depend on the stacks), plus the display
// cards' printed stops and rests from build.py when loaded (soft_stack.py exports them)
export function plainQuarters() {
  const g = new THREE.Group(), R = 185, R_IN = 182;
  const sector = (r0, r1, a0, a1) => { const s = new THREE.Shape(), n = 64;
    for (let i = 0; i <= n; i++) { const a = (a0 + (a1 - a0) * i / n) * Math.PI / 180; i ? s.lineTo(r1 * Math.cos(a), r1 * Math.sin(a)) : s.moveTo(r1 * Math.cos(a), r1 * Math.sin(a)); }
    for (let i = n; i >= 0; i--) { const a = (a0 + (a1 - a0) * i / n) * Math.PI / 180; s.lineTo(r0 * Math.cos(a), r0 * Math.sin(a)); } return s; };
  for (const [a0, a1] of [[0, 90], [270, 360]]) {
    const f = new THREE.Mesh(new THREE.ExtrudeGeometry(sector(42, R, a0 + .03, a1 - .03), { depth: 4, bevelEnabled: false }), M(0xd8cdb4)); f.position.z = 9.4; g.add(f);
    const rim = new THREE.Mesh(new THREE.ExtrudeGeometry(sector(R_IN, R, a0 + .03, a1 - .03), { depth: 24, bevelEnabled: false }), M(0xc9bc9e)); rim.position.z = 9.4; g.add(rim);
  }
  if (SOFT_STL['card-slots']) { const sl = new THREE.Mesh(SOFT_STL['card-slots'], M(0xd8cdb4)); sl.userData.slots = true; g.add(sl); }
  return g;
}
// The option's stacks laid out in a row, unplaced (for side-by-side comparisons)
export function stackSet(i) {
  const [name, fn, o] = OPTS[i], g = new THREE.Group(); SOFT = !!o.soft; fn(g, o);
  if (o.hbFrame) { g.remove(g.children[0]); const a = aFrame(o.hbFrame, o.turned); a.position.x = 0; g.add(a); }
  SOFT = false; return { group: g, name };
}
