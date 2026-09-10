const Phaser = window.Phaser;
import SplashScene from "./scenes/splash.js";
import MenuScene   from "./scenes/menu.js";
import Level1      from "./scenes/level1.js";
import LevelCats   from "./scenes/levelcats.js";    // Die zwei Katzen
import LevelMemory from "./scenes/levelmemory.js";  // Erinnerungs-Tauchgang
import Level2      from "./scenes/level2_v2.js"; // wir benutzen die v2
import Level3      from "./scenes/level3.js";
import TouchScene  from "./scenes/touch.js";   // ⬅️ Touch-Steuerung fürs Handy


const DESIGN_WIDTH = 1920, DESIGN_HEIGHT = 1080;

const config = {
  type: Phaser.AUTO,
  parent: "game-root",
  backgroundColor: "#06121f",
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH, width: DESIGN_WIDTH, height: DESIGN_HEIGHT },
  physics: { default: "arcade", arcade: { gravity: { y:0 }, debug:false } },
  input: { activePointers: 3 },   // Joystick + Button gleichzeitig
  // TouchScene steht bewusst am Ende: sie wird über das laufende Level gelegt
  scene: [SplashScene, MenuScene, Level1, LevelCats, LevelMemory, Level2, Level3, TouchScene]
};

// global verfügbar – praktisch zum Testen in der Browser-Konsole
window.game = new Phaser.Game(config);

