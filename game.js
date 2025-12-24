// Game elements
const startBtn = document.getElementById("start-btn");
const startScreen = document.getElementById("start-screen");
const gameScreen = document.getElementById("game-screen");
const gameOverScreen = document.getElementById("game-over");
const restartBtn = document.getElementById("restart-btn");
const finalScoreElement = document.getElementById("final-score");
const gameMessageElement = document.getElementById("game-message");
const mouseDetectionArea = document.getElementById("mouse-detection-area");

// Game variables
let score = 0;
let timeLeft = 30;
let level = 1;
let gameActive = false;
let gameInterval;
// Torch base and scaling
let baseTorchRadius = 120; // base radius (adjusted per level)
let torchScale = 1.0;      // multiplier applied to base radius
let powerUpActive = false;
let powerUpType = "";
let powerUpEndTime = 0;

// Torch upgrade state
let torchUpgraded = false;
// Progressive torch scale thresholds (score -> multiplier)
let torchScaleThresholds = [
  { score: 400, scale: 1.1 },
  { score: 1200, scale: 1.2 },
  { score: 3000, scale: 1.3 },
  { score: 5000, scale: 1.4 },
  { score: 7000, scale: 1.5 },
  { score: 9200, scale: 1.6 },
  { score: 11000, scale: 1.7 },
  { score: 20000, scale: 2.0 }
];

// Smooth animation state for torch scaling
let torchScaleCurrent = 1.0;
let torchScaleTarget = 1.0;
let torchScaleAnimSpeed = 0.12; // lerp factor per frame

// Audio context for upgrade chime (lazy init)
let audioContext = null;

// Mouse tracking variables
let isMouseInWindow = false;
let mouseX = 0;
let mouseY = 0;

// No-collect timeout: end game if player doesn't collect any coin in this many ms
let lastCoinCollectTime = Date.now();
let noCollectTimeout = 5000; // 5 seconds

// Cursor behavior
let baseCursorDistance = 60; // default sprite offset from real mouse
let centerMode = false; // when true, sprite sits directly under mouse (press 'C' to toggle)

// Arrays to store game objects
let coins = [];
let bombs = [];
let powerups = [];
let keys = []; // keys that let you advance levels
let stars = [];
let trees = [];

// Level key state
let hasLevelKey = false;

// DOM elements
let customCursor;
let torch;
let scoreboard;
let timerEl;
let levelEl;
let exitBtn;
let torchStatus; // UI badge showing torch state
let powerupStatus; // UI showing active power-up

// Start game
startBtn.addEventListener("click", startGame);
restartBtn.addEventListener("click", restartGame);

function startGame() {
  startScreen.style.display = "none";
  gameScreen.style.display = "block";
  gameOverScreen.style.display = "none";

  // Reset mouse state
  isMouseInWindow = false;
  mouseX = window.innerWidth / 2;
  mouseY = window.innerHeight / 2;

  initGame();
}

function initGame() {
  // Reset game state
  score = 0;
  timeLeft = 30;
  level = 1;
  gameActive = true;
  baseTorchRadius = 180;
  torchScaleCurrent = 1.0;
  torchScaleTarget = 1.0;
  powerUpActive = false;
  torchUpgraded = false; // reset upgrade state on new game

  // Reset coin collection timeout
  lastCoinCollectTime = Date.now();

  // Clear any existing game objects
  clearGameObjects();

  // Get DOM elements
  customCursor = document.querySelector(".custom-cursor");
  torch = document.querySelector(".torch");
  scoreboard = document.getElementById("scoreboard");
  timerEl = document.getElementById("timer");
  levelEl = document.getElementById("level");
  torchStatus = document.getElementById('torch-status');
  powerupStatus = document.getElementById('powerup-status');
  exitBtn = document.getElementById("exit-btn");
  if (exitBtn) {
    exitBtn.removeEventListener("click", exitGame);
    exitBtn.addEventListener("click", exitGame);
  }

  // Initially hide Pikachu cursor
  customCursor.classList.remove("visible");

  // Update UI
  updateUI();

  // Create background elements
  createStars(50);
  createTrees(8);

  // Create initial game objects
  createCoins(8);
  createBombs(4);
  createPowerUps(2);
  createKeys(1); // spawn the key required to advance the level

  // Set up mouse event listeners
  setupMouseEvents();

  // Start game loop
  gameInterval = setInterval(gameLoop, 1000 / 60); // 60 FPS

  // Start timer
  startTimer();
}

function setupMouseEvents() {
  // Remove any existing listeners first
  document.removeEventListener("mousemove", handleMouseMove);
  document.removeEventListener("mouseenter", handleMouseEnter);
  document.removeEventListener("mouseleave", handleMouseLeave);

  // Add new listeners
  document.addEventListener("mousemove", handleMouseMove);
  document.addEventListener("mouseenter", handleMouseEnter);
  document.addEventListener("mouseleave", handleMouseLeave);
}

// Toggle center mode with 'C' key so Pikachu sits directly under the mouse for testing
// Also allow 'U' to toggle torch upgrade for quick testing
document.addEventListener("keydown", (e) => {
  if (e.key.toLowerCase() === "c") {
    centerMode = !centerMode;
    showMessage(centerMode ? "CENTER MODE ON" : "CENTER MODE OFF", "#00BFFF");
  }

  if (e.key.toLowerCase() === "u") {
    if (!torchUpgraded) {
      applyTorchUpgrade();
      showMessage('Torch upgrade applied (debug)', '#FFD700');
    } else {
      // revert upgrade for testing
      torchUpgraded = false;
      torchRadius = Math.max(100, 180 - level * 10);
      if (torch) torch.classList.remove('upgraded');
      updateUI();
      showMessage('Torch upgrade reverted (debug)', '#FFB6C1');
    }
  }
});

function handleMouseEnter(e) {
  isMouseInWindow = true;
  if (customCursor && gameActive) {
    customCursor.classList.add("visible");
  }
}

function handleMouseLeave(e) {
  isMouseInWindow = false;
  if (customCursor) {
    customCursor.classList.remove("visible");
  }
}

function handleMouseMove(e) {
  if (!gameActive) return;

  mouseX = e.clientX;
  mouseY = e.clientY;

  // Only update if mouse is in window
  if (isMouseInWindow) {
    // Show Pikachu cursor if it's hidden
    if (!customCursor.classList.contains("visible")) {
      customCursor.classList.add("visible");
    }

    updateTorchAndCursor(mouseX, mouseY);
  }
}

function updateTorchAndCursor(x, y) {
  // Smooth torch flicker + progressive scaling
  // Compute effective base radius from level-adjusted base and animated scale
  const effectiveBase = Math.max(100, Math.floor(baseTorchRadius)) * torchScaleCurrent;
  const radius = Math.floor(effectiveBase + (Math.random() * 20 - 10));

  // Update torch effect (brighter / wider when scaled)
  const innerAlpha = powerUpActive && powerUpType === "shield" ? 0.45 : (torchUpgraded ? 0.45 : 0.15);
  const outerAlpha = torchUpgraded ? 0.55 : 0.9;
  if (torchUpgraded) {
    const bigRadius = Math.floor(radius * 2.6);
    torch.style.background = `radial-gradient(circle ${radius}px at ${x}px ${y}px, 
                  rgba(255, 255, 255, ${innerAlpha}) 0%, 
                  rgba(0, 0, 0, ${outerAlpha}) 60%, 
                  black 100%), 
                radial-gradient(circle ${bigRadius}px at ${x}px ${y}px, rgba(255,255,255,0.06) 0%, transparent 40%)`;
  } else {
    const bigRadius = Math.floor(radius * 1.4);
    torch.style.background = `radial-gradient(circle ${radius}px at ${x}px ${y}px, 
                  rgba(255, 255, 255, ${innerAlpha}) 0%, 
                  rgba(0, 0, 0, ${outerAlpha}) 60%, 
                  black 100%), radial-gradient(circle ${bigRadius}px at ${x}px ${y}px, rgba(255,255,255,0.02) 0%, transparent 40%)`;
  }

  // Position Pikachu cursor with offset (centerMode = true places Pikachu directly under mouse)
  const angle = 45 * (Math.PI / 180);
  const cursorDistance =
    powerUpActive && powerUpType === "magnet"
      ? 100
      : centerMode
      ? 0
      : baseCursorDistance;
  const px = x + Math.cos(angle) * cursorDistance;
  const py = y + Math.sin(angle) * cursorDistance;

  customCursor.style.left = px + "px";
  customCursor.style.top = py + "px";



  // If magnet power-up is active, attract coins
  if (powerUpActive && powerUpType === "magnet") {
    attractCoins(px, py);
  }

  // Check collisions
  checkCoinCollision(px, py);
  checkBombCollision(px, py);
  checkPowerUpCollision(px, py);
  checkKeyCollision(px, py);
}

function clearGameObjects() {
  // Remove all coins, bombs, powerups, and keys
  document
    .querySelectorAll(".coin, .bomb, .powerup, .key, .star, .tree, .particle")
    .forEach((el) => {
      if (el.parentNode) el.parentNode.removeChild(el);
    });

  coins = [];
  bombs = [];
  powerups = [];
  keys = [];
  stars = [];
  trees = [];
}

function createStars(count) {
  for (let i = 0; i < count; i++) {
    const star = document.createElement("div");
    star.classList.add("star");

    // Random position
    const size = Math.random() * 4 + 1;
    star.style.width = `${size}px`;
    star.style.height = `${size}px`;
    star.style.left = `${Math.random() * 100}%`;
    star.style.top = `${Math.random() * 100}%`;

    // Random animation delay
    star.style.animationDelay = `${Math.random() * 3}s`;

    gameScreen.appendChild(star);
    stars.push(star);
  }
}

function createTrees(count) {
  for (let i = 0; i < count; i++) {
    const tree = document.createElement("div");
    tree.classList.add("tree");

    // Random position along the bottom
    tree.style.left = `${Math.random() * 90}%`;
    tree.style.bottom = "0";

    // Random size
    const width = Math.random() * 40 + 60;
    const height = width * 1.5;
    tree.style.width = `${width}px`;
    tree.style.height = `${height}px`;

    // Darker shade for variety
    const shade = Math.floor(Math.random() * 40 + 20);
    tree.style.backgroundColor = `rgb(0, ${shade}, 0)`;

    gameScreen.appendChild(tree);
    trees.push(tree);
  }
}

function createCoins(count) {
  for (let i = 0; i < count; i++) {
    const coin = document.createElement("div");
    coin.classList.add("coin");

    // Random position that's not too close to edges
    coin.style.left = `${Math.random() * (window.innerWidth - 60) + 30}px`;
    coin.style.top = `${Math.random() * (window.innerHeight - 60) + 30}px`;

    // Coin base value based on level, scaled by 10 (10, 20, ...)
    const base = Math.floor(Math.random() * level) + 1;
    const value = base * 10; // 10, 20, 30, ...
    coin.textContent = value;
    coin.dataset.value = value;

    // Random animation delay
    coin.style.animationDelay = `${Math.random() * 3}s`;

    gameScreen.appendChild(coin);
    coins.push({
      element: coin,
      x: parseInt(coin.style.left),
      y: parseInt(coin.style.top),
      value: value,
    });
  }
}

function createBombs(count) {
  for (let i = 0; i < count; i++) {
    const bomb = document.createElement("div");
    bomb.classList.add("bomb");

    // Random position
    bomb.style.left = `${Math.random() * (window.innerWidth - 60) + 30}px`;
    bomb.style.top = `${Math.random() * (window.innerHeight - 60) + 30}px`;

    gameScreen.appendChild(bomb);
    bombs.push({
      element: bomb,
      x: parseInt(bomb.style.left),
      y: parseInt(bomb.style.top),
    });
  }
}

function createPowerUps(count) {
  const powerUpTypes = [
    { color: "#00FFFF", icon: "⏱️", type: "time", duration: 10 },
    { color: "#FF00FF", icon: "💰", type: "double", duration: 15 },
    { color: "#FFFF00", icon: "🌀", type: "magnet", duration: 20 },
    { color: "#00FF00", icon: "🛡️", type: "shield", duration: 10 },
  ];

  for (let i = 0; i < count; i++) {
    const powerup = document.createElement("div");
    powerup.classList.add("powerup");

    // Random position
    powerup.style.left = `${Math.random() * (window.innerWidth - 60) + 30}px`;
    powerup.style.top = `${Math.random() * (window.innerHeight - 60) + 30}px`;

    // Random power-up type
    const typeIndex = Math.floor(Math.random() * powerUpTypes.length);
    const powerUpType = powerUpTypes[typeIndex];

    powerup.style.backgroundColor = powerUpType.color;
    powerup.textContent = powerUpType.icon;
    powerup.dataset.type = powerUpType.type;
    powerup.dataset.duration = powerUpType.duration;

    gameScreen.appendChild(powerup);
    powerups.push({
      element: powerup,
      x: parseInt(powerup.style.left),
      y: parseInt(powerup.style.top),
      type: powerUpType.type,
      duration: powerUpType.duration,
    });
  }
}

// Create key(s) needed to advance levels
function createKeys(count) {
  for (let i = 0; i < count; i++) {
    const key = document.createElement("div");
    key.classList.add("key");
    key.textContent = "🔑";

    // Random position
    key.style.left = `${Math.random() * (window.innerWidth - 60) + 30}px`;
    key.style.top = `${Math.random() * (window.innerHeight - 60) + 30}px`;

    gameScreen.appendChild(key);
    keys.push({
      element: key,
      x: parseInt(key.style.left),
      y: parseInt(key.style.top),
    });
  }
}

function applyTorchUpgrade(scale = 1.1) {
  // Convenience for debug key 'U' - set a specific scale target and trigger effects
  torchScale = Math.max(torchScale, scale); // persistent target value
  torchScaleTarget = Math.max(torchScaleTarget, scale);
  torchUpgraded = torchScale > 1.0;
  if (torch) torch.classList.toggle('upgraded', torchUpgraded);
  showMessage(`Torch expanded: ${torchScale}x`, '#FFD700');
  updateUI();
  console.log('Torch upgrade applied — scale:', torchScale);
  // Trigger celebratory effects at cursor position
  triggerUpgradeEffects(mouseX || window.innerWidth / 2, mouseY || window.innerHeight / 2, torchScale);
}

// Check thresholds and apply progressive scaling when crossing them
function checkTorchScaleProgress() {
  for (const t of torchScaleThresholds) {
    if (score >= t.score && torchScale < t.scale) {
      // Set animation target and persistent scale value
      torchScaleTarget = Math.max(torchScaleTarget, t.scale);
      torchScale = t.scale;
      torchUpgraded = true;
      if (torch) torch.classList.add('upgraded');
      showMessage(`Torch expanded: ${t.scale}x at ${t.score} points!`, '#FFD700');
      updateUI();
      console.log(`Applied torch scale ${t.scale} at score ${score}`);
      // Visual + audio feedback at cursor
      triggerUpgradeEffects(mouseX || window.innerWidth / 2, mouseY || window.innerHeight / 2, t.scale);
    }
  }
}

function attractCoins(px, py) {
  coins.forEach((coin, index) => {
    const coinX = coin.x;
    const coinY = coin.y;

    // Calculate distance
    const dx = px - coinX;
    const dy = py - coinY;
    const distance = Math.sqrt(dx * dx + dy * dy);

    // If coin is within attraction range
    if (distance < 300) {
      // Move coin towards cursor
      const speed = 5;
      coin.x += (dx / distance) * speed;
      coin.y += (dy / distance) * speed;

      coin.element.style.left = coin.x + "px";
      coin.element.style.top = coin.y + "px";
    }
  });
}

function checkCoinCollision(px, py) {
  coins.forEach((coin, index) => {
    const rect = coin.element.getBoundingClientRect();
    const coinCenterX = rect.left + rect.width / 2;
    const coinCenterY = rect.top + rect.height / 2;

    // Calculate distance between cursor and coin center
    const dx = px - coinCenterX;
    const dy = py - coinCenterY;
    const distance = Math.sqrt(dx * dx + dy * dy);

    // Collision detection
    const collisionThreshold = rect.width / 2 + 6; // half width + small padding
    if (distance < collisionThreshold) {
      // Get coin value (coin is an object with .value and .element)
      const value =
        typeof coin.value !== "undefined"
          ? coin.value
          : parseInt(coin.element.dataset.value) || 0;

      // Apply double points if power-up is active
      const points =
        powerUpActive && powerUpType === "double" ? value * 2 : value;

      // Add to score
      score += points;

      // Reset last-coin timestamp so the no-collect timeout doesn't trigger
      lastCoinCollectTime = Date.now();

      // Check progressive torch scale thresholds after score update
      checkTorchScaleProgress();

      // Create particle effect (show points gained)
      createParticles(coinCenterX, coinCenterY, points, '#FFD700');

      // Remove coin
      coin.element.remove();
      coins.splice(index, 1);

      // Create a new coin
      setTimeout(() => {
        if (gameActive) createCoins(1);
      }, 500);

      // Update UI
      updateUI();
    }
  });
}

function checkBombCollision(px, py) {
  // If shield power-up is active, ignore bombs
  if (powerUpActive && powerUpType === "shield") return;

  bombs.forEach((bomb, index) => {
    const rect = bomb.element.getBoundingClientRect();
    const bombCenterX = rect.left + rect.width / 2;
    const bombCenterY = rect.top + rect.height / 2;

    // Calculate distance between cursor and bomb center
    const dx = px - bombCenterX;
    const dy = py - bombCenterY;
    const distance = Math.sqrt(dx * dx + dy * dy);

    // Collision detection
    const collisionThreshold = rect.width / 2 + 6;
    if (distance < collisionThreshold) {
      // Create explosion effect
      createExplosion(bombCenterX, bombCenterY);

      // End game
      endGame(false, 'bomb');
    }
  });
}

function checkPowerUpCollision(px, py) {
  powerups.forEach((powerup, index) => {
    const rect = powerup.element.getBoundingClientRect();
    const powerupCenterX = rect.left + rect.width / 2;
    const powerupCenterY = rect.top + rect.height / 2;

    // Calculate distance between cursor and powerup center
    const dx = px - powerupCenterX;
    const dy = py - powerupCenterY;
    const distance = Math.sqrt(dx * dx + dy * dy);

    // Collision detection
    const collisionThreshold = rect.width / 2 + 6;
    if (distance < collisionThreshold) {
      // Activate power-up
      activatePowerUp(powerup.type, powerup.duration);

      // Create particle effect
      createParticles(
        powerupCenterX,
        powerupCenterY,
        0,
        powerup.element.style.backgroundColor
      );

      // Remove power-up
      powerup.element.remove();
      powerups.splice(index, 1);

      // Create a new power-up after delay
      setTimeout(() => {
        if (gameActive) createPowerUps(1);
      }, 2000);
    }
  });
}

// Check for key pickup (advances level)
function checkKeyCollision(px, py) {
  keys.forEach((keyObj, index) => {
    const rect = keyObj.element.getBoundingClientRect();
    const keyCenterX = rect.left + rect.width / 2;
    const keyCenterY = rect.top + rect.height / 2;

    const dx = px - keyCenterX;
    const dy = py - keyCenterY;
    const distance = Math.sqrt(dx * dx + dy * dy);

    const collisionThreshold = rect.width / 2 + 6;
    if (distance < collisionThreshold) {
      hasLevelKey = true;
      createParticles(keyCenterX, keyCenterY, 0, "#FFFF00");
      keyObj.element.remove();
      keys.splice(index, 1);

      showMessage("Key collected! Advancing level...", "#00FF00");
      // Immediately advance the level when key is collected
      setTimeout(() => {
        if (gameActive) completeLevel();
      }, 500);
    }
  });
}

function activatePowerUp(type, duration) {
  powerUpActive = true;
  powerUpType = type;
  powerUpEndTime = Date.now() + duration * 1000;

  // Visual feedback for power-up activation
  let message = "";
  let color = "";

  switch (type) {
    case "time":
      timeLeft += 10;
      message = "+10 SECONDS!";
      color = "#00FFFF";
      break;
    case "double":
      message = "2x POINTS!";
      color = "#FF00FF";
      break;
    case "magnet":
      message = "COIN MAGNET!";
      color = "#FFFF00";
      break;
    case "shield":
      message = "BOMB SHIELD!";
      color = "#00FF00";
      break;
  }

  // Show power-up message
  showMessage(message, color);

  // Update timer display
  timerEl.textContent = `Time: ${timeLeft}`;

  // Update UI so the Power-up badge reflects the new active power-up
  updateUI();
}

function showMessage(text, color) {
  const messageEl = document.createElement("div");
  messageEl.textContent = text;
  messageEl.style.position = "fixed";
  messageEl.style.top = "50%";
  messageEl.style.left = "50%";
  messageEl.style.transform = "translate(-50%, -50%)";
  messageEl.style.fontFamily = "'Press Start 2P', cursive";
  messageEl.style.fontSize = "2rem";
  messageEl.style.color = color;
  messageEl.style.textShadow = `0 0 10px ${color}`;
  messageEl.style.zIndex = "10001";
  messageEl.style.pointerEvents = "none";
  messageEl.style.animation = "pulse 0.5s 3";

  gameScreen.appendChild(messageEl);

  // Remove message after animation
  setTimeout(() => {
    if (messageEl.parentNode) {
      messageEl.parentNode.removeChild(messageEl);
    }
  }, 1500);
}

function createParticles(x, y, value, color) {
  const particleCount = value > 0 ? value * 3 : 10;

  for (let i = 0; i < particleCount; i++) {
    const particle = document.createElement("div");
    particle.classList.add("particle");
    particle.style.backgroundColor = color;
    particle.style.left = `${x}px`;
    particle.style.top = `${y}px`;

    // Random velocity
    const angle = Math.random() * Math.PI * 2;
    const speed = Math.random() * 5 + 2;
    const vx = Math.cos(angle) * speed;
    const vy = Math.sin(angle) * speed;

    gameScreen.appendChild(particle);

    // Animate particle
    let opacity = 1;
    const particleInterval = setInterval(() => {
      x += vx;
      y += vy;
      opacity -= 0.03;

      particle.style.left = `${x}px`;
      particle.style.top = `${y}px`;
      particle.style.opacity = opacity;

      if (opacity <= 0) {
        clearInterval(particleInterval);
        if (particle.parentNode) {
          particle.parentNode.removeChild(particle);
        }
      }
    }, 30);
  }

  // Show score popup if value > 0
  if (value > 0) {
    const scorePopup = document.createElement("div");
    scorePopup.textContent = `+${value}`;
    scorePopup.style.position = "fixed";
    scorePopup.style.left = `${x}px`;
    scorePopup.style.top = `${y}px`;
    scorePopup.style.color = "#FFD700";
    scorePopup.style.fontFamily = "'Press Start 2P', cursive";
    scorePopup.style.fontSize = "1.2rem";
    scorePopup.style.textShadow = "0 0 5px black";
    scorePopup.style.zIndex = "10001";
    scorePopup.style.pointerEvents = "none";

    gameScreen.appendChild(scorePopup);

    // Animate score popup
    let popupY = y;
    let popupOpacity = 1;
    const popupInterval = setInterval(() => {
      popupY -= 2;
      popupOpacity -= 0.03;

      scorePopup.style.top = `${popupY}px`;
      scorePopup.style.opacity = popupOpacity;

      if (popupOpacity <= 0) {
        clearInterval(popupInterval);
        if (scorePopup.parentNode) {
          scorePopup.parentNode.removeChild(scorePopup);
        }
      }
    }, 30);
  }
}

function createExplosion(x, y) {
  // Create explosion particles
  for (let i = 0; i < 30; i++) {
    const particle = document.createElement("div");
    particle.classList.add("particle");
    particle.style.backgroundColor = i % 2 === 0 ? "#FF4500" : "#FFD700";
    particle.style.left = `${x}px`;
    particle.style.top = `${y}px`;
    particle.style.width = `${Math.random() * 10 + 5}px`;
    particle.style.height = particle.style.width;

    // Random velocity
    const angle = Math.random() * Math.PI * 2;
    const speed = Math.random() * 8 + 4;
    const vx = Math.cos(angle) * speed;
    const vy = Math.sin(angle) * speed;

    gameScreen.appendChild(particle);

    // Animate explosion particle
    let opacity = 1;
    const particleInterval = setInterval(() => {
      x += vx;
      y += vy;
      opacity -= 0.05;

      particle.style.left = `${x}px`;
      particle.style.top = `${y}px`;
      particle.style.opacity = opacity;

      if (opacity <= 0) {
        clearInterval(particleInterval);
        if (particle.parentNode) {
          particle.parentNode.removeChild(particle);
        }
      }
    }, 30);
  }
}

// Trigger celebratory effects when torch upgrades occur
function triggerUpgradeEffects(x, y, scale) {
  createUpgradeParticles(x, y, scale);
  playUpgradeChime();
  // Brief flash on torch element for extra feedback
  if (torch) {
    torch.classList.add('flash');
    setTimeout(() => torch.classList.remove('flash'), 800);
  }
}

function createUpgradeParticles(x, y, scale) {
  const particleCount = 60;
  for (let i = 0; i < particleCount; i++) {
    const p = document.createElement('div');
    p.classList.add('particle', 'upgrade-particle');
    p.style.background = i % 2 === 0 ? '#FFD700' : '#FFB84D';

    const size = Math.random() * 12 + 6 + (scale - 1) * 10;
    p.style.width = `${size}px`;
    p.style.height = `${size}px`;
    p.style.left = `${x}px`;
    p.style.top = `${y}px`;

    gameScreen.appendChild(p);

    const angle = Math.random() * Math.PI * 2;
    const speed = Math.random() * 10 + 3 + (scale - 1) * 10;
    const vx = Math.cos(angle) * speed;
    const vy = Math.sin(angle) * speed - Math.random() * 4;

    let opacity = 1;
    const particleInterval = setInterval(() => {
      x += vx;
      y += vy;
      opacity -= 0.03;

      p.style.left = `${x}px`;
      p.style.top = `${y}px`;
      p.style.opacity = opacity;

      if (opacity <= 0) {
        clearInterval(particleInterval);
        if (p.parentNode) p.parentNode.removeChild(p);
      }
    }, 30);
  }
}

function playUpgradeChime() {
  try {
    if (!audioContext) audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const ctx = audioContext;
    const now = ctx.currentTime;

    const master = ctx.createGain();
    master.connect(ctx.destination);
    master.gain.setValueAtTime(0.0001, now);
    master.gain.exponentialRampToValueAtTime(0.6, now + 0.02);
    master.gain.exponentialRampToValueAtTime(0.0001, now + 0.8);

    const freqs = [880, 1320, 1760];
    freqs.forEach((f, i) => {
      const osc = ctx.createOscillator();
      osc.type = i === 0 ? 'sine' : 'triangle';
      osc.frequency.setValueAtTime(f, now);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.12 / (i + 1), now);
      osc.connect(g);
      g.connect(master);
      osc.start(now);
      osc.stop(now + 0.6 + i * 0.05);
    });
  } catch (e) {
    console.log('Chime failed', e);
  }
}

function gameLoop() {
  // End game if no coin collected within the timeout
  if (gameActive && Date.now() - lastCoinCollectTime > noCollectTimeout) {
    // If player has the level key or any active power-up, prevent the game over and reset the timer
    if (hasLevelKey || powerUpActive) {
      const saver = hasLevelKey ? "key" : "active power-up";
      showMessage(`No coin for 5s, but your ${saver} saved you!`, "#FFD700");
      lastCoinCollectTime = Date.now();
    } else {
      showMessage("No coin collected for 5s! Game Over!", "#FF4500");
      endGame(false, 'no-coin');
    }
    return;
  }

  // Only update if game is active and mouse is in window
  if (!gameActive || !isMouseInWindow) return;

  // Move bombs slightly for added challenge
  if (level > 2) {
    bombs.forEach((bomb) => {
      // Slight random movement
      bomb.x += (Math.random() - 0.5) * 2;
      bomb.y += (Math.random() - 0.5) * 2;

      // Keep within bounds
      bomb.x = Math.max(30, Math.min(window.innerWidth - 30, bomb.x));
      bomb.y = Math.max(30, Math.min(window.innerHeight - 30, bomb.y));

      bomb.element.style.left = bomb.x + "px";
      bomb.element.style.top = bomb.y + "px";
    });
  }

  // Check if power-up has expired
  if (powerUpActive && Date.now() > powerUpEndTime) {
    powerUpActive = false;
    powerUpType = '';
    showMessage("POWER-UP ENDED", "#888");
    updateUI();
  }

  // Animate torch scale toward the target for smooth upgrades
  if (Math.abs(torchScaleCurrent - torchScaleTarget) > 0.0005) {
    torchScaleCurrent += (torchScaleTarget - torchScaleCurrent) * torchScaleAnimSpeed;
    if (Math.abs(torchScaleCurrent - torchScaleTarget) < 0.0005) torchScaleCurrent = torchScaleTarget;
  }
}

function startTimer() {
  const timerInterval = setInterval(() => {
    if (!gameActive) {
      clearInterval(timerInterval);
      return;
    }

    timeLeft--;
    timerEl.textContent = `Time: ${timeLeft}`;

    // Time's up - game over if key wasn't obtained
    if (timeLeft <= 0) {
      clearInterval(timerInterval);
      showMessage("Time's up! You failed to find a key.", "#FF4500");
      endGame(false, 'time');
    }
  }, 1000);
}

function completeLevel() {
  // Calculate level completion bonus
  const timeBonus = Math.max(0, timeLeft) * 10;
  const coinBonus = coins.length * 5;
  const levelBonus = level * 100;

  const totalBonus = timeBonus + coinBonus + levelBonus;
  score += totalBonus;

  // Re-check torch scaling after the level completion bonus
  checkTorchScaleProgress();

  // Show level complete message
  gameMessageElement.textContent = `Level ${level} Complete! Bonus: ${totalBonus}`;

  // Next level
  level++;

  // Increase difficulty
  timeLeft = 25 + level * 5;
  torchRadius = Math.max(100, 180 - level * 10);

  // Preserve upgraded torch scale across levels
  if (torchUpgraded) {
    if (torch) torch.classList.add('upgraded');
  } else {
    if (torch) torch.classList.remove('upgraded');
  }

  // Remove remaining objects
  clearGameObjects();

  // Create new objects for next level
  createStars(50 + level * 5);
  createTrees(8 + level);
  createCoins(8 + level);
  createBombs(4 + Math.floor(level / 2));
  createPowerUps(2 + Math.floor(level / 3));
  createKeys(1); // spawn required key for next level

  // Update UI
  updateUI();

  // Show level up message
  showMessage(`LEVEL ${level}`, "#00BFFF");

  // Start timer for next level
  setTimeout(() => {
    if (gameActive) startTimer();
  }, 2000);
}

function updateUI() {
  scoreboard.textContent = `Score: ${score}`;
  timerEl.textContent = `Time: ${timeLeft}`;
  levelEl.textContent = `Level: ${level}`;
  if (torchStatus) {
    torchStatus.textContent = torchScale > 1 ? `Torch: ${torchScale}x` : 'Torch: Normal';
    torchStatus.classList.toggle('upgraded', torchUpgraded);
  }
  if (powerupStatus) {
    if (powerUpActive && powerUpType) {
      powerupStatus.textContent = `Power-up: ${powerUpType.toUpperCase()}`;
      powerupStatus.classList.add('active');
    } else {
      powerupStatus.textContent = 'Power-up: None';
      powerupStatus.classList.remove('active');
    }
  }
}

function endGame(win, reason = 'bomb') {
  gameActive = false;

  // Clear intervals
  clearInterval(gameInterval);

  // Remove mouse event listeners
  document.removeEventListener("mousemove", handleMouseMove);
  document.removeEventListener("mouseenter", handleMouseEnter);
  document.removeEventListener("mouseleave", handleMouseLeave);

  // Hide Pikachu cursor
  if (customCursor) {
    customCursor.classList.remove("visible");
  }

  // Set final score and message
  finalScoreElement.textContent = score;

  if (win) {
    gameMessageElement.textContent = `Congratulations! You completed all levels!`;
    gameOverScreen.style.background =
      "radial-gradient(circle, rgba(0,100,0,0.9) 0%, rgba(0,0,0,0.95) 100%)";
  } else {
    // Use a reason-specific message for clearer feedback
    if (reason === 'time') {
      gameMessageElement.textContent = `Time's up! You failed to find a key.`;
    } else if (reason === 'no-coin') {
      gameMessageElement.textContent = `No coin collected for 5s! Game Over!`;
    } else if (reason === 'bomb') {
      gameMessageElement.textContent = `You hit a bomb! Game Over!`;
    } else {
      gameMessageElement.textContent = `Game Over!`;
    }

    gameOverScreen.style.background =
      "radial-gradient(circle, rgba(100,0,0,0.9) 0%, rgba(0,0,0,0.95) 100%)";
  }

  // Reset torch visuals & status immediately on game end
  torchScale = 1.0;
  torchScaleTarget = 1.0;
  torchScaleCurrent = 1.0;
  torchUpgraded = false;
  if (torch) {
    torch.classList.remove('upgraded', 'flash');
    // Clear inline background so CSS default applies
    torch.style.background = '';
  }
  if (torchStatus) {
    torchStatus.textContent = 'Torch: Normal';
    torchStatus.classList.remove('upgraded');
  }
  updateUI();

  // Show game over screen
  gameOverScreen.style.display = "flex";
}

function restartGame() {
  startGame();
}

// Exit to main menu (start screen)
function exitGame() {
  if (!confirm("Exit game and return to main menu?")) return;
  // Stop the game and cleanup
  gameActive = false;
  clearInterval(gameInterval);
  document.removeEventListener("mousemove", handleMouseMove);
  document.removeEventListener("mouseenter", handleMouseEnter);
  document.removeEventListener("mouseleave", handleMouseLeave);
  if (customCursor) customCursor.classList.remove("visible");
  clearGameObjects();
  // If Game Over screen is open, close it
  if (typeof gameOverScreen !== 'undefined' && gameOverScreen) {
    gameOverScreen.style.display = 'none';
  }
  // Hide game screen and show start screen
  gameScreen.style.display = "none";
  startScreen.style.display = "flex";
  showMessage("Exited to main menu", "#FFD700");
}

// Initialize the game on load (for testing)
window.addEventListener("load", () => {
  // Check if on mobile
  if (/Mobi|Android/i.test(navigator.userAgent)) {
    document.getElementById("mobile-warning").style.display = "flex";
  }
});
