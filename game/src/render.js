// All canvas drawing. One job: paint the city, the cars, the people, the HUD
// with its minimap, and the menu / pause / busted screens — nothing else.
import { WORLD, PALETTE, CAR } from './config.js';
import { clamp } from './random.js';

function drawBuilding(ctx, b, cam) {
  const sx = b.x - cam.x;
  const sy = b.y - cam.y;
  if (sx > cam.w || sy > cam.h || sx + b.w < 0 || sy + b.h < 0) return;
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fillRect(sx + 6, sy + 6, b.w, b.h);
  ctx.fillStyle = b.color;
  ctx.fillRect(sx, sy, b.w, b.h);
  ctx.strokeStyle = PALETTE.buildingEdge;
  ctx.lineWidth = 2;
  ctx.strokeRect(sx + 1, sy + 1, b.w - 2, b.h - 2);
  // Roof detail: a lighter inner slab and a tiny AC box, scaled by "height".
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.fillRect(sx + 8, sy + 8, b.w - 16, Math.max(10, (b.h - 16) * 0.35));
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.fillRect(sx + b.w / 2 - 8, sy + b.h / 2 - 8, 16, 16);
  if (b.height >= 2) {
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(b.label, sx + b.w / 2, sy + b.h - 10);
  }
}

function drawTree(ctx, t, cam) {
  const sx = t.x - cam.x;
  const sy = t.y - cam.y;
  if (sx < -20 || sy < -20 || sx > cam.w + 20 || sy > cam.h + 20) return;
  ctx.fillStyle = '#3d7a2e';
  ctx.beginPath();
  ctx.arc(sx, sy, t.r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#5da244';
  ctx.beginPath();
  ctx.arc(sx - 2, sy - 2, t.r * 0.6, 0, Math.PI * 2);
  ctx.fill();
}

function drawRoads(ctx, city, cam) {
  const half = WORLD.roadWidth / 2;
  ctx.fillStyle = PALETTE.road;
  for (const c of city.centers) {
    ctx.fillRect(c - half - cam.x, -cam.y, WORLD.roadWidth, WORLD.size);
    ctx.fillRect(-cam.x, c - half - cam.y, WORLD.size, WORLD.roadWidth);
  }
  // Dashed centre lines.
  ctx.strokeStyle = PALETTE.roadLine;
  ctx.lineWidth = 3;
  ctx.setLineDash([26, 22]);
  ctx.beginPath();
  for (const c of city.centers) {
    ctx.moveTo(c - cam.x, -cam.y);
    ctx.lineTo(c - cam.x, WORLD.size - cam.y);
    ctx.moveTo(-cam.x, c - cam.y);
    ctx.lineTo(WORLD.size - cam.x, c - cam.y);
  }
  ctx.stroke();
  ctx.setLineDash([]);
}

export function drawCity(ctx, city, cam) {
  // Ground: grass, then beach sand and harbour water along the south edge.
  ctx.fillStyle = PALETTE.grass;
  ctx.fillRect(-cam.x, -cam.y, WORLD.size, WORLD.size);
  ctx.fillStyle = PALETTE.waterDeep;
  ctx.fillRect(-cam.x, city.waterLine - cam.y, WORLD.size, WORLD.size - city.waterLine);
  ctx.fillStyle = PALETTE.water;
  ctx.fillRect(-cam.x, city.waterLine + 4 - cam.y, WORLD.size, WORLD.size - city.waterLine - 4);
  ctx.fillStyle = PALETTE.sand;
  ctx.fillRect(-cam.x, city.waterLine - 26 - cam.y, WORLD.size, 30);
  // Sidewalks: pale strips hugging every road.
  ctx.fillStyle = PALETTE.sidewalk;
  const half = WORLD.roadWidth / 2 + 8;
  for (const c of city.centers) {
    ctx.fillRect(c - half - cam.x, -cam.y, 8, WORLD.size);
    ctx.fillRect(c + half - 8 - cam.x, -cam.y, 8, WORLD.size);
    ctx.fillRect(-cam.x, c - half - cam.y, WORLD.size, 8);
    ctx.fillRect(-cam.x, c + half - 8 - cam.y, WORLD.size, 8);
  }
  drawRoads(ctx, city, cam);
  // Parks and trees.
  for (const p of city.parks) {
    ctx.fillStyle = PALETTE.park;
    ctx.fillRect(p.x - cam.x, p.y - cam.y, p.w, p.h);
  }
  for (const t of city.trees) drawTree(ctx, t, cam);
  // Pier: wooden boards into the harbour, with a lighthouse dot at the end.
  ctx.fillStyle = '#8a6a3f';
  ctx.fillRect(city.pier.x - cam.x, city.pier.y - cam.y, city.pier.w, city.pier.h);
  ctx.strokeStyle = '#6a4a2f';
  ctx.lineWidth = 2;
  for (let y = city.pier.y + 14; y < city.pier.y + city.pier.h; y += 18) {
    ctx.beginPath();
    ctx.moveTo(city.pier.x - cam.x, y - cam.y);
    ctx.lineTo(city.pier.x + city.pier.w - cam.x, y - cam.y);
    ctx.stroke();
  }
  ctx.fillStyle = '#e8e8e8';
  ctx.beginPath();
  ctx.arc(city.pier.x + city.pier.w / 2 - cam.x, city.pier.y + city.pier.h - 16 - cam.y, 10, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#d84a4a';
  ctx.beginPath();
  ctx.arc(city.pier.x + city.pier.w / 2 - cam.x, city.pier.y + city.pier.h - 16 - cam.y, 5, 0, Math.PI * 2);
  ctx.fill();
  for (const b of city.buildings) drawBuilding(ctx, b, cam);
}

export function drawCarShape(ctx, x, y, angle, color, cam, opts) {
  const sx = x - cam.x;
  const sy = y - cam.y;
  if (sx < -80 || sy < -80 || sx > cam.w + 80 || sy > cam.h + 80) return;
  const o = opts || {};
  ctx.save();
  ctx.translate(sx, sy);
  ctx.rotate(angle);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.fillRect(-CAR.length / 2 + 3, -CAR.width / 2 + 4, CAR.length, CAR.width);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(-CAR.length / 2, -CAR.width / 2, CAR.length, CAR.width, 7);
  ctx.fill();
  ctx.fillStyle = 'rgba(20,30,50,0.85)';
  ctx.beginPath();
  ctx.roundRect(-8, -CAR.width / 2 + 4, 18, CAR.width - 8, 4);
  ctx.fill();
  ctx.fillStyle = '#ffe9a8';
  ctx.fillRect(CAR.length / 2 - 4, -CAR.width / 2 + 3, 3, 6);
  ctx.fillRect(CAR.length / 2 - 4, CAR.width / 2 - 9, 3, 6);
  ctx.fillStyle = '#d84a4a';
  ctx.fillRect(-CAR.length / 2, -CAR.width / 2 + 3, 3, 6);
  ctx.fillRect(-CAR.length / 2, CAR.width / 2 - 9, 3, 6);
  if (o.police) {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(-CAR.length / 2 + 8, -CAR.width / 2 + 2, 10, CAR.width - 4);
    ctx.fillStyle = '#111111';
    ctx.font = 'bold 9px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('PD', 0, 3);
    if (o.sirenOn) {
      ctx.fillStyle = o.sirenRed ? '#ff2f2f' : '#2f7fff';
      ctx.beginPath();
      ctx.arc(0, -CAR.width / 2 - 2, 5, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

export function drawPedShape(ctx, p, cam) {
  const sx = p.x - cam.x;
  const sy = p.y - cam.y;
  if (sx < -20 || sy < -20 || sx > cam.w + 20 || sy > cam.h + 20) return;
  const wobble = Math.sin(p.walkPhase || 0) * 2;
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(sx + 2, sy + 3, 9, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = p.color;
  ctx.beginPath();
  ctx.arc(sx, sy, 10, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = p.skin || '#e8b88a';
  ctx.beginPath();
  ctx.arc(sx + Math.cos(p.angle) * 4, sy + Math.sin(p.angle) * 4, 5, 0, Math.PI * 2);
  ctx.fill();
  if (p.fleeing) {
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(sx - 8, sy - 14 + wobble);
    ctx.lineTo(sx + 8, sy - 14 - wobble);
    ctx.stroke();
  }
}

export function drawPlayerShape(ctx, player, cam, time) {
  const sx = player.x - cam.x;
  const sy = player.y - cam.y;
  const bob = player.moving ? Math.sin(time * 14) * 1.5 : 0;
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath();
  ctx.ellipse(sx + 2, sy + 4, 12, 8, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.save();
  ctx.translate(sx, sy + bob);
  ctx.rotate(player.angle);
  ctx.fillStyle = '#2f6fd0';
  ctx.beginPath();
  ctx.roundRect(-9, -7, 18, 14, 6);
  ctx.fill();
  ctx.fillStyle = '#e8b88a';
  ctx.beginPath();
  ctx.arc(11, 0, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#222';
  ctx.fillRect(14, -4, 6, 3);
  ctx.fillRect(14, 1, 6, 3);
  ctx.restore();
}

export function drawBullets(ctx, bullets, cam) {
  ctx.fillStyle = '#ffe14d';
  for (const b of bullets) {
    ctx.beginPath();
    ctx.arc(b.x - cam.x, b.y - cam.y, 3.5, 0, Math.PI * 2);
    ctx.fill();
  }
}

export function drawMarker(ctx, x, y, cam, time, color) {
  const sx = x - cam.x;
  const sy = y - cam.y;
  const pulse = 1 + Math.sin(time * 5) * 0.12;
  ctx.save();
  ctx.translate(sx, sy);
  ctx.scale(pulse, pulse);
  ctx.strokeStyle = color || '#ffd23f';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(0, -26);
  ctx.lineTo(0, 26);
  ctx.moveTo(-26, 0);
  ctx.lineTo(26, 0);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, 0, 20, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

export function drawMinimap(ctx, city, game, viewW, viewH) {
  const size = 168;
  const mx = viewW - size - 14;
  const my = viewH - size - 14;
  const scale = size / WORLD.size;
  ctx.fillStyle = 'rgba(10,14,20,0.78)';
  ctx.beginPath();
  ctx.roundRect(mx - 6, my - 6, size + 12, size + 12, 10);
  ctx.fill();
  ctx.save();
  ctx.beginPath();
  ctx.rect(mx, my, size, size);
  ctx.clip();
  ctx.fillStyle = PALETTE.grassDark;
  ctx.fillRect(mx, my, size, size);
  ctx.fillStyle = PALETTE.water;
  ctx.fillRect(mx, my + city.waterLine * scale, size, size);
  ctx.fillStyle = PALETTE.road;
  for (const c of city.centers) {
    ctx.fillRect(mx + c * scale - 2, my, 4, size);
    ctx.fillRect(mx, my + c * scale - 2, size, 4);
  }
  ctx.fillStyle = '#ffd23f';
  ctx.fillRect(mx + city.pier.x * scale - 2, my + city.pier.y * scale - 2, 8, 8);
  if (game.missionTarget) {
    const pulse = 3 + Math.sin(game.time * 6) * 1.5;
    ctx.strokeStyle = '#ffd23f';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(mx + game.missionTarget.x * scale, my + game.missionTarget.y * scale, 5 + pulse, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.fillStyle = '#ff5a5a';
  for (const cop of game.police) {
    ctx.beginPath();
    ctx.arc(mx + cop.x * scale, my + cop.y * scale, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = '#ffffff';
  const px = game.playerCar ? game.playerCar.x : game.player.x;
  const py = game.playerCar ? game.playerCar.y : game.player.y;
  ctx.beginPath();
  ctx.arc(mx + px * scale, my + py * scale, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#ffd23f';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(mx + px * scale, my + py * scale, 6, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 11px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('SOLMAR BAY', mx, my - 10);
}

export function drawHud(ctx, game, viewW, viewH) {
  ctx.textAlign = 'left';
  // Top-left: cash, health, missions done.
  ctx.fillStyle = 'rgba(10,14,20,0.72)';
  ctx.beginPath();
  ctx.roundRect(12, 12, 250, 84, 10);
  ctx.fill();
  ctx.fillStyle = '#7dff8a';
  ctx.font = 'bold 22px sans-serif';
  ctx.fillText(`$${game.cash}`, 24, 40);
  ctx.fillStyle = '#ffffff';
  ctx.font = '13px sans-serif';
  ctx.fillText(`Missions ${game.missionsDone}/3   •   Score ${game.score}`, 24, 62);
  ctx.fillStyle = '#333';
  ctx.fillRect(24, 70, 200, 10);
  ctx.fillStyle = game.player.health > 30 ? '#7dff8a' : '#ff5a5a';
  ctx.fillRect(24, 70, 200 * clamp(game.player.health / 100, 0, 1), 10);
  ctx.fillStyle = '#ffffff';
  ctx.font = '11px sans-serif';
  ctx.fillText('HEALTH', 24, 92);
  // Top-right: wanted stars.
  ctx.fillStyle = 'rgba(10,14,20,0.72)';
  ctx.beginPath();
  ctx.roundRect(viewW - 212, 12, 200, 46, 10);
  ctx.fill();
  ctx.font = '22px sans-serif';
  for (let i = 0; i < 5; i += 1) {
    ctx.fillStyle = i < game.wanted ? '#ffd23f' : 'rgba(255,255,255,0.25)';
    ctx.fillText('★', viewW - 196 + i * 34, 42);
  }
  if (game.wanted > 0) {
    ctx.fillStyle = '#ff8a8a';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('WANTED — LOSE THE COPS', viewW - 20, 52);
    ctx.textAlign = 'left';
  }
  // Bottom-centre: current mission objective + timer + toast.
  if (game.mission) {
    ctx.fillStyle = 'rgba(10,14,20,0.72)';
    const text = `${game.mission.title}: ${game.mission.brief}`;
    ctx.font = 'bold 15px sans-serif';
    const w = ctx.measureText(text).width + 28;
    ctx.beginPath();
    ctx.roundRect((viewW - w) / 2, viewH - 92, w, 34, 10);
    ctx.fill();
    ctx.fillStyle = '#ffd23f';
    ctx.textAlign = 'center';
    ctx.fillText(text, viewW / 2, viewH - 70);
    ctx.textAlign = 'left';
    if (game.missionTimer > 0) {
      ctx.fillStyle = game.missionTimer < 15 ? '#ff5a5a' : '#ffffff';
      ctx.font = 'bold 20px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${Math.ceil(game.missionTimer)}s`, viewW / 2, viewH - 104);
      ctx.textAlign = 'left';
    }
  }
  if (game.toast && game.toastTime > 0) {
    ctx.fillStyle = 'rgba(10,14,20,0.8)';
    ctx.font = 'bold 17px sans-serif';
    const w = ctx.measureText(game.toast).width + 30;
    ctx.beginPath();
    ctx.roundRect((viewW - w) / 2, 74, w, 36, 10);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.fillText(game.toast, viewW / 2, 98);
    ctx.textAlign = 'left';
  }
  if (game.playerCar) {
    ctx.fillStyle = 'rgba(10,14,20,0.72)';
    ctx.beginPath();
    ctx.roundRect(12, viewH - 52, 210, 38, 10);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = '13px sans-serif';
    ctx.fillText(`Speed ${Math.round(Math.abs(game.playerCar.speed) * 0.36 * 10) / 10} km/h  •  E exit`, 22, viewH - 28);
  } else {
    ctx.fillStyle = 'rgba(10,14,20,0.72)';
    ctx.beginPath();
    ctx.roundRect(12, viewH - 52, 330, 38, 10);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = '13px sans-serif';
    ctx.fillText('WASD move  •  Shift run  •  E steal car  •  Click shoot', 22, viewH - 28);
  }
}

function drawOverlay(ctx, viewW, viewH, lines, accent) {
  ctx.fillStyle = 'rgba(8,12,22,0.82)';
  ctx.fillRect(0, 0, viewW, viewH);
  ctx.textAlign = 'center';
  let y = viewH / 2 - lines.length * 22;
  for (const line of lines) {
    ctx.fillStyle = line.color || '#ffffff';
    ctx.font = line.font || '16px sans-serif';
    ctx.fillText(line.text, viewW / 2, y);
    y += line.gap || 34;
  }
  ctx.textAlign = 'left';
  if (accent) {
    ctx.fillStyle = accent;
    ctx.fillRect(viewW / 2 - 120, viewH / 2 - lines.length * 22 - 46, 240, 4);
  }
}

export function drawMenu(ctx, viewW, viewH, save) {
  drawOverlay(ctx, viewW, viewH, [
    { text: 'SOLMAR BAY', font: 'bold 64px sans-serif', color: '#ffd23f', gap: 76 },
    { text: 'An open-world crime story — yours, not theirs.', font: 'italic 18px sans-serif', color: '#cfe8ff' },
    { text: 'Steal cars. Outrun the law. Run three jobs and own the bay.', font: '16px sans-serif' },
    { text: 'WASD / arrows — move & drive      E — steal / exit car', font: '15px sans-serif', color: '#9fd0ff' },
    { text: 'Mouse click — shoot      Shift — run      P — pause      M — mute', font: '15px sans-serif', color: '#9fd0ff' },
    { text: 'Press ENTER to start', font: 'bold 22px sans-serif', color: '#7dff8a', gap: 44 },
    { text: save ? `Welcome back — $${save.cash} banked, ${save.missionsDone}/3 jobs done.` : 'New in town. $50 in your pocket. Make it count.', font: '14px sans-serif', color: '#c9c9c9' },
  ], '#ffd23f');
}

export function drawPaused(ctx, viewW, viewH) {
  drawOverlay(ctx, viewW, viewH, [
    { text: 'PAUSED', font: 'bold 44px sans-serif', color: '#ffd23f', gap: 56 },
    { text: 'Press P to keep playing. Progress saves automatically.', font: '16px sans-serif' },
  ], '#ffd23f');
}

export function drawBusted(ctx, viewW, viewH, game) {
  drawOverlay(ctx, viewW, viewH, [
    { text: 'BUSTED', font: 'bold 56px sans-serif', color: '#ff5a5a', gap: 68 },
    { text: 'The Solmar Bay PD caught up with you.', font: '18px sans-serif' },
    { text: `You kept $${game.cash} and ${game.missionsDone}/3 jobs done.`, font: '16px sans-serif' },
    { text: 'Press R to get back on the streets', font: 'bold 20px sans-serif', color: '#7dff8a' },
  ], '#ff5a5a');
}

export function drawComplete(ctx, viewW, viewH, game) {
  drawOverlay(ctx, viewW, viewH, [
    { text: 'KING OF THE BAY', font: 'bold 52px sans-serif', color: '#ffd23f', gap: 64 },
    { text: 'All three jobs done. Solmar Bay is yours.', font: '18px sans-serif' },
    { text: `Final take: $${game.cash}   •   Score ${game.score}`, font: '16px sans-serif' },
    { text: 'Press R to free-roam, or keep driving — the city stays open.', font: '16px sans-serif', color: '#9fd0ff' },
  ], '#ffd23f');
}
