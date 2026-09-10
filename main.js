const Phaser = window.Phaser;
import SplashScene from "./scenes/splash.js";
import MenuScene   from "./scenes/menu.js";
import Level1      from "./scenes/level1.js";
import LevelCats   from "./scenes/levelcats.js";    // Die zwei Katzen
import LevelMemory from "./scenes/levelmemory.js";  // Erinnerungs-Tauchgang
import Level2      from "./scenes/level2_v2.js"; // wir benutzen die v2
import Level3      from "./scenes/level3.js";
import TouchScene  from "./scenes/touch.js";   // ⬅️ Touch-Steuerung fürs Handy


// Handys sind im Querformat viel breiter als 16:9 (iPhone ≈ 19,5:9).
// Mit einer festen 1920x1080-Bühne blieben deshalb links und rechts dicke
// schwarze Balken – das Spiel wirkte winzig. Die Bühne richtet sich jetzt
// nach dem Bildschirm: Höhe bleibt 1080, die Breite wächst mit.
// Es wird immer mit der langen Seite gerechnet, damit es auch stimmt, wenn
// die Seite hochkant geladen und erst danach gedreht wird.
const DESIGN_HEIGHT = 1080;
const DESIGN_WIDTH = (function(){
  const w = window.innerWidth  || 1920;
  const h = window.innerHeight || 1080;
  const lang = Math.max(w, h), kurz = Math.max(1, Math.min(w, h));
  const verhaeltnis = Math.min(Math.max(lang / kurz, 16/9), 21/9);
  return Math.round(DESIGN_HEIGHT * verhaeltnis);
})();

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

