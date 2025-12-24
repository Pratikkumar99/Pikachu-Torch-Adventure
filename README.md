# Pikachu Torch Adventure

**Pikachu Torch Adventure** is a small, browser-based arcade game built with plain HTML, CSS and JavaScript. Move Pikachu with your mouse to collect coins, avoid bombs, grab power-ups, find the level key, and upgrade your torch for an enhanced view and bonuses.

---

## 🎮 Features
- Mouse-controlled sprite (Pikachu) with a custom cursor and collision center
- Coins (10/20/30...) that scale with level
- Bombs (instant game over unless shielded)
- Power-ups: double points, magnet, shield, extra time
- One key per level — collecting it advances you to the next level
- No-collect rule: if you don't collect a coin for 5 seconds, the game ends (except when you hold the key or have an active power-up)
- Progressive torch upgrades with particle + sound feedback
- Center Mode (press `C`) to place Pikachu directly under the mouse for easier aiming

---

## 🎯 Controls
- Move the mouse: control Pikachu and the torch
- C: Toggle **Center Mode** (Pikachu sits directly under the mouse)
- Click `EXIT` button during play to return to the main menu

---

## 🚀 Quick start
Open `index.html` in your browser (best experience on desktop):

Option A — open file directly
- Double-click `index.html` in the project folder or drag it into your browser.

Option B — run a simple static server (recommended for consistent behavior)
- Python 3: `python -m http.server 8000` → visit `http://localhost:8000`
- Node: `npx http-server` (if installed)

---

## 🛠 Development notes
- Game logic and UI are in `game.js`, styles are in `style.css`, and main markup is `index.html`.
- To change core parameters:
  - `noCollectTimeout` (in ms) controls the no-collect rule.
  - `torchScaleThresholds` defines score thresholds for torch upgrades.
  - Center Mode behavior is controlled by the `centerMode` variable and toggled with the `C` key.

---

## live link : 

## 🤝 Contributing
Feel free to open issues or PRs. Small enhancements (visual polish, accessibility, small refactors) are welcome.

---

Enjoy — and have fun collecting coins! ⚡️