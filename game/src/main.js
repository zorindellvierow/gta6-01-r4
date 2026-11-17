// Solmar Bay — a 2D top-down open-world game.
// Written fresh for round 4. Player on foot or in a car, cops, missions.
import { WORLD, PALETTE, PLAYER, CAR, TRAFFIC_COUNT, PED_COUNT, POLICE_MAX, WANTED, MISSIONS, SAVE_KEY, START_CASH, CARJACK_CASH } from './config.js';
import { mulberry32, makeRng, clamp, lerp, dist2, angleTo, angleDiff } from './random.js';
import { Input } from './input.js';
import { roadCenters, isOnRoad, buildCity, buildingAt, resolveBuildingCollision, inWater, onPier } from './world.js';
import { drawCity, drawCarShape, drawPedShape, drawPlayerShape, drawBullets, drawMarker, drawMinimap, drawHud, drawMenu, drawPaused, drawBusted, drawComplete } from './render.js';
import { stageScene, SHOT_SCENES } from './shots.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');

function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.floor(window.innerWidth * dpr);
  canvas.height = Math.floor(window.innerHeight * dpr);
  canvas.style.width = window.innerWidth + 'px';
  canvas.style.height = window.innerHeight + 'px';
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
window.addEventListener('resize', resize);
resize();

const params = new URLSearchParams(window.location.search);
const seed = Number(params.get('seed') || 1) || 1;
const shot = params.get('shot') || '';

function makeCar(x, y, angle, color, rng) {
  return { x, y, angle, color, speed: 0, vx: 0, vy: 0, driver: null, stolen: false, honk: 0, wobble: rng() * Math.PI * 2 };
}

function makePed(x, y, rng) {
  const skins = ['#e8b98a', '#c98d5f', '#8a5a3b', '#f0c8a0'];
  const shirts = ['#e05252', '#4a7dd6', '#4caf6d', '#e0a83c', '#8a5fc0', '#e0e0e0', '#37474f'];
  return {
    x, y, angle: rng() * Math.PI * 2, color: shirts[Math.floor(rng() * shirts.length)],
    skin: skins[Math.floor(rng() * skins.length)], fleeing: false, h: 30, w: 12,
    walkPhase: rng() * Math.PI * 2, speed: 28 + rng() * 22, targetX: x, targetY: y,
    wait: 0, scared: 0, dead: false, vx: 0, vy: 0,
  };
}

function makePolice(x, y, angle) {
  return { x, y, angle, color: '#1c2733', speed: 0, vx: 0, vy: 0, bustTimer: 0, siren: 0, stuck: 0 };
}

const game = {
  state: 'menu',
  time: 0,
  seed,
  rng: makeRng(seed),
  city: null,
  player: { x: WORLD.size / 2, y: WORLD.size / 2, angle: -Math.PI / 2, health: PLAYER.health, moving: false, vx: 0, vy: 0 },
  playerCar: null,
  traffic: [],
  peds: [],
  police: [],
  bullets: [],
  wanted: 0,
  wantedTimer: 0,
  cash: START_CASH,
  score: 0,
  missionIndex: 0,
  mission: null,
  missionTarget: null,
  missionTimer: 0,
  missionsDone: 0,
  toast: '',
  toastTime: 0,
  cam: { x: WORLD.size / 2, y: WORLD.size / 2 },
  shootTimer: 0,
  bustedTimer: 0,
  complete: false,
  save: null,
  startedAt: 0,
};

function setStatus(text) {
  if (statusEl) statusEl.textContent = text;
}

game.setToast = function (text) {
  game.toast = text;
  game.toastTime = 3.2;
  setStatus(text);
};

game.setWanted = function (level) {
  game.wanted = clamp(level, 0, WANTED.max);
  game.wantedTimer = 0;
};

function addWanted(n, reason) {
  const before = game.wanted;
  game.setWanted(game.wanted + n);
  if (game.wanted > before) game.setToast(reason + ' — Wanted +' + n);
}

game.spawnPolice = function (count) {
  const n = count || 1;
  for (let i = 0; i < n; i++) {
    if (game.police.length >= POLICE_MAX) return;
    const a = game.rng() * Math.PI * 2;
    const d = 320 + game.rng() * 180;
    const x = clamp(game.player.x + Math.cos(a) * d, 40, WORLD.size - 40);
    const y = clamp(game.player.y + Math.sin(a) * d, 40, WORLD.size - 40);
    game.police.push(makePolice(x, y, angleTo(x, y, game.player.x, game.player.y)));
  }
};

function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) { return null; }
}

function writeSave() {
  try {
    const data = { cash: game.cash, score: game.score, missionsDone: game.missionsDone, missionIndex: game.missionIndex, wanted: game.wanted, savedAt: Date.now() };
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    game.save = data;
  } catch (e) { /* storage unavailable */ }
}

function spawnTraffic() {
  const colors = ['#d64545', '#3f7fd6', '#e8b13c', '#5cb85c', '#e0e0e0', '#8a5fc0', '#f07830', '#2bb3a3'];
  game.traffic = [];
  const roads = roadCenters();
  for (let i = 0; i < TRAFFIC_COUNT; i++) {
    const pos = roads[Math.floor(game.rng() * roads.length)];
    const along = game.rng() * WORLD.size;
    const horiz = game.rng() < 0.5;
    const x = horiz ? along : pos + (game.rng() < 0.5 ? -24 : 24);
    const y = horiz ? pos + (game.rng() < 0.5 ? -24 : 24) : along;
    const angle = horiz ? (game.rng() < 0.5 ? 0 : Math.PI) : (game.rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2);
    const car = makeCar(x, y, angle, colors[Math.floor(game.rng() * colors.length)], game.rng);
    car.speed = 90 + game.rng() * 90;
    car.driver = 'traffic';
    game.traffic.push(car);
  }
}

function spawnPeds() {
  game.peds = [];
  for (let i = 0; i < PED_COUNT; i++) {
    let x = 0, y = 0, tries = 0;
    do {
      x = 60 + game.rng() * (WORLD.size - 120);
      y = 60 + game.rng() * (WORLD.size - 120);
      tries++;
    } while (tries < 20 && (isOnRoad(x, y) || buildingAt(game.city, x, y) || inWater(game.city, x, y)));
    game.peds.push(makePed(x, y, game.rng));
  }
}

function resetWorld() {
  game.rng = makeRng(seed);
  game.city = buildCity(seed);
  game.player.x = WORLD.size / 2;
  game.player.y = WORLD.size / 2 + 120;
  game.player.angle = -Math.PI / 2;
  game.player.health = PLAYER.health;
  game.player.moving = false;
  game.playerCar = null;
  game.bullets = [];
  game.police = [];
  game.wanted = 0;
  game.wantedTimer = 0;
  game.cash = START_CASH;
  game.score = 0;
  game.missionIndex = 0;
  game.mission = null;
  game.missionTarget = null;
  game.missionTimer = 0;
  game.missionsDone = 0;
  game.bustedTimer = 0;
  game.complete = false;
  game.time = 0;
  spawnTraffic();
  spawnPeds();
  const saved = loadSave();
  game.save = saved;
  if (saved) {
    game.cash = saved.cash || START_CASH;
    game.score = saved.score || 0;
    game.missionsDone = saved.missionsDone || 0;
    game.missionIndex = saved.missionIndex || 0;
  }
}

game.startMission = function (index) {
  const m = MISSIONS[index];
  if (!m) { game.mission = null; game.missionTarget = null; game.complete = true; game.state = 'complete'; writeSave(); return; }
  game.missionIndex = index;
  game.mission = m;
  game.missionTimer = m.timeLimit || 0;
  if (m.id === 'bay-run') {
    game.missionTarget = { x: game.city.pier.x, y: game.city.pier.y };
  } else if (m.id === 'heat-wave') {
    game.missionTarget = null;
    game.setWanted(Math.max(game.wanted, 2));
  } else {
    game.missionTarget = null;
  }
  game.setToast(m.title + ': ' + m.brief);
};

game.startPlay = function () {
  resetWorld();
  game.state = 'playing';
  game.startedAt = performance.now();
  game.startMission(0);
  setStatus('Playing Solmar Bay');
};

game.enterCar = function () {
  if (game.playerCar) {
    const car = game.playerCar;
    game.playerCar = null;
    const a = car.angle + Math.PI / 2;
    game.player.x = car.x + Math.cos(a) * (CAR.width / 2 + 16);
    game.player.y = car.y + Math.sin(a) * (CAR.width / 2 + 16);
    game.player.angle = car.angle;
    game.setToast('On foot');
    return true;
  }
  let best = null, bestD = CAR.enterRange * CAR.enterRange;
  for (const car of game.traffic) {
    const d = dist2(game.player.x, game.player.y, car.x, car.y);
    if (d < bestD) { bestD = d; best = car; }
  }
  if (!best) { game.setToast('No car nearby — get closer and press E'); return false; }
  if (best.driver === 'traffic') {
    best.driver = 'player';
    game.playerCar = best;
    game.cash += CARJACK_CASH;
    game.score += CARJACK_CASH;
    addWanted(WANTED.starForSteal, 'Car stolen!');
    game.setToast('Car jacked! +$' + CARJACK_CASH);
    if (game.mission && game.mission.id === 'hot-wheels') completeMission();
  } else {
    best.driver = 'player';
    game.playerCar = best;
    game.setToast('In the car');
  }
  return true;
};

function completeMission() {
  const m = game.mission;
  if (!m) return;
  game.cash += m.reward;
  game.score += m.reward;
  game.missionsDone++;
  game.setToast(m.title + ' complete! +$' + m.reward);
  writeSave();
  const next = game.missionIndex + 1;
  if (next >= MISSIONS.length) {
    game.mission = null;
    game.missionTarget = null;
    game.complete = true;
    game.state = 'complete';
    writeSave();
  } else {
    game.startMission(next);
  }
}

function failMission(reason) {
  game.setToast('Mission failed: ' + reason);
  if (game.mission) game.startMission(game.missionIndex);
}

function shoot() {
  if (game.shootTimer > 0 || game.playerCar) return;
  game.shootTimer = PLAYER.shootCooldown;
  const a = game.player.angle;
  game.bullets.push({
    x: game.player.x + Math.cos(a) * 22, y: game.player.y + Math.sin(a) * 22,
    vx: Math.cos(a) * PLAYER.bulletSpeed, vy: Math.sin(a) * PLAYER.bulletSpeed,
    dist: 0, range: PLAYER.bulletRange,
  });
  addWanted(0, '');
  game.wantedTimer = 0;
}

function updateBullets(dt) {
  for (const b of game.bullets) {
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.dist += PLAYER.bulletSpeed * dt;
    if (b.dist > b.range) { b.dead = true; continue; }
    if (buildingAt(game.city, b.x, b.y)) { b.dead = true; continue; }
    for (const p of game.peds) {
      if (!p.dead && dist2(b.x, b.y, p.x, p.y) < 18 * 18) {
        p.dead = true; b.dead = true;
        addWanted(WANTED.starForShoot, 'Shot fired!');
        game.score += 10;
        break;
      }
    }
    if (b.dead) continue;
    for (const cop of game.police) {
      if (dist2(b.x, b.y, cop.x, cop.y) < 24 * 24) {
        b.dead = true;
        addWanted(WANTED.starForShoot, 'Shot at police!');
        break;
      }
    }
  }
  game.bullets = game.bullets.filter((b) => !b.dead);
}

function updatePlayerOnFoot(dt, input) {
  const p = game.player;
  const ax = input.axis('KeyA', 'KeyD') + input.axis('ArrowLeft', 'ArrowRight');
  const ay = input.axis('KeyW', 'KeyS') + input.axis('ArrowUp', 'ArrowDown');
  const len = Math.hypot(ax, ay);
  const run = input.down('ShiftLeft') || input.down('ShiftRight');
  const speed = run ? PLAYER.runSpeed : PLAYER.walkSpeed;
  p.moving = len > 0.01;
  if (p.moving) {
    const nx = ax / (len || 1), ny = ay / (len || 1);
    p.angle = Math.atan2(ny, nx);
    p.x += nx * speed * dt;
    p.y += ny * speed * dt;
  }
  p.x = clamp(p.x, 20, WORLD.size - 20);
  p.y = clamp(p.y, 20, WORLD.size - 20);
  resolveBuildingCollision(game.city, p);
  if (inWater(game.city, p.x, p.y) && !onPier(game.city, p.x, p.y)) {
    p.x = clamp(p.x, 20, WORLD.size - 20);
    p.y = Math.min(p.y, game.city.waterLine - 10);
  }
  if (input.pressed('KeyE')) game.enterCar();
  if (input.down('Space')) shoot();
}

function updateDriving(dt, input) {
  const car = game.playerCar;
  const fwd = input.axis('KeyS', 'KeyW') + input.axis('ArrowDown', 'ArrowUp');
  const steerIn = input.axis('KeyA', 'KeyD') + input.axis('ArrowLeft', 'ArrowRight');
  const accel = fwd > 0 ? CAR.accel : (fwd < 0 ? CAR.reverseAccel : 0);
  if (fwd > 0) car.speed = Math.min(car.speed + CAR.accel * dt, CAR.maxSpeed);
  else if (fwd < 0) car.speed = Math.max(car.speed - CAR.reverseAccel * dt, -CAR.maxReverse);
  else car.speed *= Math.pow(0.4, dt);
  if (input.down('Space')) car.speed = lerp(car.speed, 0, Math.min(1, CAR.brake * dt / 120));
  const dir = car.speed >= 0 ? 1 : -1;
  car.angle += steerIn * CAR.steer * dt * dir * clamp(Math.abs(car.speed) / 120, 0, 1);
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
  car.x = clamp(car.x, 30, WORLD.size - 30);
  car.y = clamp(car.y, 30, WORLD.size - 30);
  const body = { x: car.x, y: car.y, radius: 24 };
  resolveBuildingCollision(game.city, body);
  car.x = body.x; car.y = body.y;
  game.player.x = car.x;
  game.player.y = car.y;
  game.player.angle = car.angle;
  game.player.moving = Math.abs(car.speed) > 5;
  if (input.pressed('KeyE')) game.enterCar();
  // Hitting peds while driving raises wanted.
  for (const p of game.peds) {
    if (p.dead) continue;
    if (dist2(car.x, car.y, p.x, p.y) < 30 * 30 && Math.abs(car.speed) > 60) {
      p.dead = true;
      addWanted(WANTED.starForHitPed, 'Pedestrian hit!');
      game.setToast('You hit a pedestrian!');
    }
  }
}

function updateTraffic(dt) {
  for (const car of game.traffic) {
    if (car.driver === 'player') continue;
    const horiz = Math.abs(Math.cos(car.angle)) > 0.7;
    car.x += Math.cos(car.angle) * car.speed * dt;
    car.y += Math.sin(car.angle) * car.speed * dt;
    if (car.x < 20 || car.x > WORLD.size - 20 || car.y < 20 || car.y > WORLD.size - 20) {
      car.angle += Math.PI;
      car.x = clamp(car.x, 30, WORLD.size - 30);
      car.y = clamp(car.y, 30, WORLD.size - 30);
    }
    // Keep traffic on roads: nudge back toward nearest road centre.
    // roadCenters() returns plain centre positions; each centre is both a
    // horizontal and a vertical road, so use the nearer axis.
    if (!isOnRoad(car.x, car.y)) {
      const roads = roadCenters();
      let best = roads[0], bd = Infinity, bestHoriz = true;
      for (const r of roads) {
        const dh = Math.abs(car.y - r);
        const dv = Math.abs(car.x - r);
        const d = Math.min(dh, dv);
        if (d < bd) { bd = d; best = r; bestHoriz = dh <= dv; }
      }
      if (bestHoriz) car.y = lerp(car.y, best, Math.min(1, dt * 2));
      else car.x = lerp(car.x, best, Math.min(1, dt * 2));
    }
    const body = { x: car.x, y: car.y, radius: 22 };
    resolveBuildingCollision(game.city, body);
    car.x = body.x; car.y = body.y;
  }
}

function updatePeds(dt) {
  for (const p of game.peds) {
    if (p.dead) continue;
    p.walkPhase += dt * 6;
    const playerNear = dist2(p.x, p.y, game.player.x, game.player.y) < 120 * 120;
    if (game.wanted > 0 && playerNear) p.fleeing = true;
    if (p.fleeing) {
      const a = angleTo(game.player.x, game.player.y, p.x, p.y);
      p.angle = a;
      p.x += Math.cos(a) * p.speed * 1.8 * dt;
      p.y += Math.sin(a) * p.speed * 1.8 * dt;
      p.scared += dt;
      if (p.scared > 6) { p.fleeing = false; p.scared = 0; }
    } else {
      p.wait -= dt;
      if (p.wait <= 0) {
        p.targetX = clamp(p.x + (game.rng() - 0.5) * 300, 40, WORLD.size - 40);
        p.targetY = clamp(p.y + (game.rng() - 0.5) * 300, 40, WORLD.size - 40);
        p.wait = 2 + game.rng() * 4;
      }
      const d = Math.hypot(p.targetX - p.x, p.targetY - p.y);
      if (d > 6) {
        p.angle = angleTo(p.x, p.y, p.targetX, p.targetY);
        p.x += Math.cos(p.angle) * p.speed * dt;
        p.y += Math.sin(p.angle) * p.speed * dt;
      }
    }
    p.x = clamp(p.x, 20, WORLD.size - 20);
    p.y = clamp(p.y, 20, WORLD.size - 20);
    const body = { x: p.x, y: p.y, radius: 8 };
    resolveBuildingCollision(game.city, body);
    p.x = body.x; p.y = body.y;
  }
}

function updatePolice(dt) {
  const want = game.wanted;
  const target = Math.min(want, POLICE_MAX);
  while (game.police.length < target) game.spawnPolice(1);
  while (game.police.length > target) game.police.pop();
  for (const cop of game.police) {
    cop.siren += dt;
    const tx = game.playerCar ? game.playerCar.x : game.player.x;
    const ty = game.playerCar ? game.playerCar.y : game.player.y;
    const d = Math.hypot(tx - cop.x, ty - cop.y);
    const wantAngle = angleTo(cop.x, cop.y, tx, ty);
    cop.angle += clamp(angleDiff(wantAngle, cop.angle), -2.4 * dt, 2.4 * dt);
    const spd = 300 + want * 22;
    cop.speed = lerp(cop.speed, spd, Math.min(1, dt * 1.5));
    cop.x += Math.cos(cop.angle) * cop.speed * dt;
    cop.y += Math.sin(cop.angle) * cop.speed * dt;
    cop.x = clamp(cop.x, 30, WORLD.size - 30);
    cop.y = clamp(cop.y, 30, WORLD.size - 30);
    const body = { x: cop.x, y: cop.y, radius: 22 };
    resolveBuildingCollision(game.city, body);
    cop.x = body.x; cop.y = body.y;
    if (d < 46) {
      cop.bustTimer += dt;
      if (cop.bustTimer >= WANTED.bustTime) {
        game.state = 'busted';
        game.bustedTimer = 0;
        game.setToast('Busted! The cops got you.');
        writeSave();
      }
    } else {
      cop.bustTimer = Math.max(0, cop.bustTimer - dt * 2);
    }
  }
}

function updateWanted(dt) {
  if (game.wanted <= 0) return;
  game.wantedTimer += dt;
  if (game.wantedTimer >= WANTED.decayDelay) {
    game.wantedTimer = WANTED.decayDelay;
  }
  // Decay one star every decayInterval after the delay has passed.
  if (game.wantedTimer >= WANTED.decayDelay) {
    game._decayAcc = (game._decayAcc || 0) + dt;
    if (game._decayAcc >= WANTED.decayInterval) {
      game._decayAcc = 0;
      game.wanted = Math.max(0, game.wanted - 1);
      if (game.wanted === 0) {
        game.setToast('You lost the cops.');
        if (game.mission && game.mission.id === 'heat-wave') completeMission();
      }
    }
  }
}

function updateMissions(dt) {
  if (!game.mission) return;
  if (game.mission.id === 'bay-run') {
    game.missionTimer -= dt;
    if (game.missionTarget && dist2(game.player.x, game.player.y, game.missionTarget.x, game.missionTarget.y) < 70 * 70) {
      completeMission();
      return;
    }
    if (game.missionTimer <= 0) failMission('Out of time on Bay Run');
  }
  if (game.mission.id === 'hot-wheels' && game.playerCar) {
    // completed in enterCar
  }
}

function update(dt, input) {
  game.time += dt;
  if (game.shootTimer > 0) game.shootTimer -= dt;
  if (game.toastTime > 0) game.toastTime -= dt;
  if (game.playerCar) updateDriving(dt, input);
  else updatePlayerOnFoot(dt, input);
  updateTraffic(dt);
  updatePeds(dt);
  updatePolice(dt);
  updateBullets(dt);
  updateWanted(dt);
  updateMissions(dt);
  // Camera follows player (or car).
  const tx = game.player.x, ty = game.player.y;
  game.cam.x = lerp(game.cam.x, tx, Math.min(1, dt * 5));
  game.cam.y = lerp(game.cam.y, ty, Math.min(1, dt * 5));
  game.score += dt * 0.5;
}

function render() {
  const viewW = window.innerWidth, viewH = window.innerHeight;
  ctx.clearRect(0, 0, viewW, viewH);
  ctx.fillStyle = PALETTE && PALETTE.background ? PALETTE.background : '#0d1b2a';
  ctx.fillRect(0, 0, viewW, viewH);
  if (game.state === 'menu') {
    drawMenu(ctx, viewW, viewH, game.save);
    return;
  }
  if (game.state === 'complete') {
    drawComplete(ctx, viewW, viewH, game);
    return;
  }
  if (game.state === 'busted') {
    drawCity(ctx, game.city, game.cam);
    drawBusted(ctx, viewW, viewH, game);
    return;
  }
  drawCity(ctx, game.city, game.cam);
  if (game.missionTarget) drawMarker(ctx, game.missionTarget.x, game.missionTarget.y, game.cam, game.time, '#ffd23c');
  for (const car of game.traffic) {
    if (car.driver === 'player') continue;
    drawCarShape(ctx, car.x, car.y, car.angle, car.color, game.cam, {});
  }
  for (const cop of game.police) drawCarShape(ctx, cop.x, cop.y, cop.angle, cop.color, game.cam, { police: true, siren: cop.siren });
  for (const p of game.peds) {
    if (p.dead) continue;
    drawPedShape(ctx, p, game.cam);
  }
  if (game.playerCar) {
    drawCarShape(ctx, game.playerCar.x, game.playerCar.y, game.playerCar.angle, game.playerCar.color, game.cam, { player: true });
  } else {
    drawPlayerShape(ctx, game.player, game.cam, game.time);
  }
  drawBullets(ctx, game.bullets, game.cam);
  drawMinimap(ctx, game.city, game, viewW, viewH);
  drawHud(ctx, game, viewW, viewH);
  if (game.state === 'paused') drawPaused(ctx, viewW, viewH);
}

const input = new Input(canvas);
let last = performance.now();

function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000 || 0.016);
  last = now;
  if (game.state === 'playing') {
    if (input.pressed('Escape') || input.pressed('KeyP')) {
      game.state = 'paused';
      game.setToast('Paused — press P to resume');
    } else {
      update(dt, input);
    }
  } else if (game.state === 'paused') {
    if (input.pressed('Escape') || input.pressed('KeyP')) game.state = 'playing';
  } else if (game.state === 'menu') {
    if (input.anyPressed(['Enter', 'Space'])) game.startPlay();
  } else if (game.state === 'busted') {
    game.bustedTimer += dt;
    if (input.anyPressed(['Enter', 'Space']) && game.bustedTimer > 0.8) {
      game.wanted = 0;
      game.police = [];
      game.player.health = PLAYER.health;
      game.state = 'playing';
      game.setToast('Back on the streets. Stay clean.');
    }
  } else if (game.state === 'complete') {
    if (input.anyPressed(['Enter', 'Space'])) game.startPlay();
  }
  render();
  input.endFrame();
  requestAnimationFrame(frame);
}

// Boot: build the city once so menu / screenshots render.
resetWorld();
game.state = 'menu';

if (shot === 'start') {
  game.state = 'menu';
  render();
} else if (shot === 'play') {
  game.startPlay();
  stageScene(game, 'drive');
  render();
} else if (shot === 'end') {
  resetWorld();
  game.cash = 1250;
  game.score = 3250;
  game.missionsDone = 3;
  game.complete = true;
  game.state = 'complete';
  render();
} else if (shot && SHOT_SCENES.includes(shot)) {
  game.startPlay();
  stageScene(game, shot);
  render();
} else {
  requestAnimationFrame(frame);
}

export { game };
