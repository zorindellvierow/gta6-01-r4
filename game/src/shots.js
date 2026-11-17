// Screenshot staging. One job: jump the live game into a photogenic state so
// screenshots show the city, a chase and a mission at their best. Used by the
// maker only — the game never calls this on its own.
export function stageScene(game, scene) {
  if (!game || typeof game.startPlay !== 'function') return false;
  game.startPlay();
  const city = game.city;
  if (scene === 'drive') {
    // Put the player in a car mid-avenue with traffic around.
    const car = game.traffic[0];
    if (car) {
      game.enterCar(car, true);
      car.speed = 300;
      car.x = 1000;
      car.y = 600;
      car.angle = 0;
    }
    game.setToast('Solmar Bay — cruise the avenues');
    return true;
  }
  if (scene === 'chase') {
    // Wanted 3 stars, two police cars closing in, mission marker up.
    const car = game.traffic[1] || game.traffic[0];
    if (car) {
      game.enterCar(car, true);
      car.speed = 340;
      car.x = 1000;
      car.y = 1000;
      car.angle = Math.PI / 2;
    }
    game.setWanted(3);
    game.spawnPolice(true);
    game.spawnPolice(true);
    game.setToast('WANTED ★★★ — lose the cops!');
    return true;
  }
  if (scene === 'mission') {
    // On foot at the pier with the Bay Run marker lit.
    game.player.x = city.pier.x + 60;
    game.player.y = city.pier.y - 60;
    game.player.angle = Math.PI / 2;
    game.startMission(1);
    game.setToast('Bay Run — reach the pier marker!');
    return true;
  }
  if (scene === 'foot') {
    game.player.x = 620;
    game.player.y = 620;
    game.player.angle = 0;
    game.setToast('On foot in Solmar Bay');
    return true;
  }
  return false;
}

export const SHOT_SCENES = ['drive', 'chase', 'mission', 'foot'];
