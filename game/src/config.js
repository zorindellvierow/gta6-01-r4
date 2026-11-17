// Solmar Bay — tuning and palette. One job: every number the game balances on.
// The city is a sun-soaked harbour town of our own invention: no real place, no
// borrowed names. All values below were picked for a top-down 2D open world.
export const WORLD = {
  size: 2400,
  roadGap: 400,
  roadWidth: 96,
  firstRoad: 200,
  blockPad: 26,
};

export const PALETTE = {
  grass: '#7fae5a',
  grassDark: '#6f9c4e',
  sand: '#e3c98f',
  water: '#2f7fb8',
  waterDeep: '#256a9e',
  road: '#3a3f4a',
  roadLine: '#e8d44d',
  sidewalk: '#b9b3a4',
  buildingRoof: ['#c96f4a', '#4a7ec9', '#c9a44a', '#7a4ac9', '#4ac9a0', '#c94a6b'],
  buildingEdge: '#2b2b33',
  park: '#5d9b4a',
  player: '#ffd23f',
  police: '#2f6fd0',
  traffic: ['#d84a4a', '#4ad8d8', '#e8e8e8', '#8a5ad8', '#5ad88a', '#d88a2f'],
  ped: ['#e8b88a', '#8a6a4a', '#4a4a6a', '#c9c9c9', '#6a8a4a'],
};

export const PLAYER = {
  radius: 13,
  walkSpeed: 210,
  runSpeed: 320,
  health: 100,
  punchRange: 34,
  shootCooldown: 0.28,
  bulletSpeed: 640,
  bulletRange: 520,
};

export const CAR = {
  length: 54,
  width: 26,
  accel: 420,
  brake: 620,
  reverseAccel: 220,
  maxSpeed: 520,
  maxReverse: 160,
  steer: 2.6,
  grip: 0.94,
  enterRange: 70,
};

export const TRAFFIC_COUNT = 14;
export const PED_COUNT = 26;
export const POLICE_MAX = 5;

export const WANTED = {
  decayDelay: 6,
  decayInterval: 4,
  bustTime: 2.2,
  starForSteal: 1,
  starForHitPed: 1,
  starForShoot: 1,
  max: 5,
};

export const MISSIONS = [
  {
    id: 'hot-wheels',
    title: 'Hot Wheels',
    brief: 'Borrow a car. Any car. Press E near one.',
    reward: 200,
  },
  {
    id: 'bay-run',
    title: 'Bay Run',
    brief: 'Drive to the pier marker before the timer runs out.',
    reward: 500,
    timeLimit: 90,
  },
  {
    id: 'heat-wave',
    title: 'Heat Wave',
    brief: 'The heat is on. Lose the cops — get wanted back to zero.',
    reward: 800,
  },
];

export const SAVE_KEY = 'solmarbay-save-v1';
export const START_CASH = 50;
export const CARJACK_CASH = 25;
