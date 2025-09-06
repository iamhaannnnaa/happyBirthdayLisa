const Phaser = window.Phaser;
import SplashScene from "./scenes/splash.js";
import MenuScene from "./scenes/menu.js";     // ⬅️ NEU
import Level1 from "./scenes/level1.js";
import Level2 from "./scenes/level2.js";

const DESIGN_WIDTH = 1920, DESIGN_HEIGHT = 1080;

const config = {
  type: Phaser.AUTO,
  parent: "game-root",
  backgroundColor: "#06121f",
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH, width: DESIGN_WIDTH, height: DESIGN_HEIGHT },
  physics: { default: "arcade", arcade: { gravity: { y:0 }, debug:false } },
  scene: [SplashScene, MenuScene, Level1, Level2]     // ⬅️ Menü eingehängt
};

new Phaser.Game(config);

