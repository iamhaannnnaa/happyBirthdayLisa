const Phaser = window.Phaser;

export default class SplashScene extends Phaser.Scene {
  constructor(){ super("SplashScene"); }
  // .jpg statt .png: gleiches Bild, aber 160 KB statt 2,3 MB
  preload(){ this.load.image("splash","assets/splash/start.jpg"); }

  create(){
    this.cameras.main.setBackgroundColor("#06121f");

    const img = this.add.image(0,0,"splash").setOrigin(0,0);
    const W = this.scale.width, H = this.scale.height;
    const sc = Math.max(W / img.width, H / img.height);
    img.setScale(sc);

    this.add.text(W/2, H*0.88, "Tippen/Klicken oder [Leertaste] zum Start",
      { fontFamily:"system-ui, sans-serif", fontSize:"28px", color:"#e6f0ff" }
    ).setOrigin(0.5).setAlpha(0.9);

    // 🔹 Nur ins Menü wechseln
    this.input.once("pointerdown", () => this.scene.start("MenuScene"));
    this.input.keyboard.once("keydown-SPACE", () => this.scene.start("MenuScene"));
  }
}

