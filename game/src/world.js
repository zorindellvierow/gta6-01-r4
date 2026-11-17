// City generation and collision. One job: build Solmar Bay from a seed — a road
// grid, building blocks, a beach, a harbour pier, parks — and answer "is this
// spot road / building / water" for movement and rendering.
import { WORLD, PALETTE } from './config.js';
import { makeRng, clamp } from './random.js';

export function roadCenters() {
  const centers = [];
  for (let c = WORLD.firstRoad; c < WORLD.size; c += WORLD.roadGap) {
    centers.push(c);
  }
  return centers;
}

export function isOnRoad(x, y) {
  const half = WORLD.roadWidth / 2;
  for (const c of roadCenters()) {
    if (Math.abs(x - c) < half || Math.abs(y - c) < half) return true;
  }
  return false;
}

export function buildCity(seed) {
  const rng = makeRng(seed);
  const centers = roadCenters();
  const buildings = [];
  const parks = [];
  const trees = [];
  // The south edge is the beach and the harbour water; the pier juts into it.
  const waterLine = WORLD.size - 180;
  const pier = { x: 1000, y: waterLine, w: 120, h: 190 };
  for (let ix = 0; ix < centers.length - 1; ix += 1) {
    for (let iy = 0; iy < centers.length - 1; iy += 1) {
      const x0 = centers[ix] + WORLD.roadWidth / 2 + WORLD.blockPad;
      const y0 = centers[iy] + WORLD.roadWidth / 2 + WORLD.blockPad;
      const x1 = centers[ix + 1] - WORLD.roadWidth / 2 - WORLD.blockPad;
      const y1 = centers[iy + 1] - WORLD.roadWidth / 2 - WORLD.blockPad;
      if (y0 > waterLine - 60) continue; // beach blocks stay open sand
      if (rng.chance(0.16)) {
        parks.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0 });
        const treeCount = rng.int(4, 9);
        for (let t = 0; t < treeCount; t += 1) {
          trees.push({
            x: rng.range(x0 + 14, x1 - 14),
            y: rng.range(y0 + 14, y1 - 14),
            r: rng.range(7, 12),
          });
        }
        continue;
      }
      // One or two buildings per block, with a gap between them.
      const splitVertical = rng.chance(0.5);
      const lots = [];
      if (splitVertical) {
        const mid = (x0 + x1) / 2;
        lots.push({ x: x0, y: y0, w: mid - x0 - 12, h: y1 - y0 });
        lots.push({ x: mid + 12, y: y0, w: x1 - mid - 12, h: y1 - y0 });
      } else {
        lots.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0 });
      }
      for (const lot of lots) {
        if (lot.w < 60 || lot.h < 60) continue;
        const inset = rng.range(4, 14);
        buildings.push({
          x: lot.x + inset,
          y: lot.y + inset,
          w: lot.w - inset * 2,
          h: lot.h - inset * 2,
          color: rng.pick(PALETTE.buildingRoof),
          height: rng.int(1, 3),
          label: rng.pick(['HOTEL', 'MALL', 'APT', 'OFFICE', 'DINER', 'GARAGE', 'CLUB', 'MARKET']),
        });
      }
    }
  }
  const carSpawns = [];
  for (let i = 0; i < 40; i += 1) {
    const horizontal = rng.chance(0.5);
    const road = rng.pick(centers);
    const along = rng.range(80, WORLD.size - 80);
    const lane = rng.pick([-22, 22]);
    carSpawns.push({
      x: horizontal ? along : road + lane,
      y: horizontal ? road + lane : along,
      angle: horizontal ? (lane < 0 ? 0 : Math.PI) : (lane < 0 ? Math.PI / 2 : -Math.PI / 2),
    });
  }
  const pedSpawns = [];
  for (let i = 0; i < 60; i += 1) {
    const x = rng.range(120, WORLD.size - 120);
    const y = rng.range(120, waterLine - 40);
    if (!isOnRoad(x, y)) pedSpawns.push({ x, y });
  }
  return {
    seed,
    centers,
    buildings,
    parks,
    trees,
    waterLine,
    pier,
    carSpawns,
    pedSpawns,
    beach: { y: waterLine },
  };
}

export function buildingAt(city, x, y) {
  for (const b of city.buildings) {
    if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return b;
  }
  return null;
}

// Push a circle out of every building it overlaps. Returns true on any hit.
export function resolveBuildingCollision(city, body) {
  let hit = false;
  for (const b of city.buildings) {
    const nearestX = clamp(body.x, b.x, b.x + b.w);
    const nearestY = clamp(body.y, b.y, b.y + b.h);
    const dx = body.x - nearestX;
    const dy = body.y - nearestY;
    const d2 = dx * dx + dy * dy;
    if (d2 < body.radius * body.radius) {
      hit = true;
      if (d2 > 0.0001) {
        const d = Math.sqrt(d2);
        body.x = nearestX + (dx / d) * body.radius;
        body.y = nearestY + (dy / d) * body.radius;
      } else {
        body.x += body.radius;
      }
    }
  }
  return hit;
}

export function inWater(city, x, y) {
  return y > city.waterLine + 6 && !(x >= city.pier.x && x <= city.pier.x + city.pier.w && y <= city.pier.y + city.pier.h);
}

export function onPier(city, x, y) {
  return x >= city.pier.x && x <= city.pier.x + city.pier.w && y >= city.pier.y - 10 && y <= city.pier.y + city.pier.h;
}
