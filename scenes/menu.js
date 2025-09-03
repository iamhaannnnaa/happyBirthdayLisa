const Phaser = window.Phaser;

export default class MenuScene extends Phaser.Scene {
  constructor(){ super("MenuScene"); }

  create(){
  const W = this.scale.width, H = this.scale.height;
  this.cameras.main.setBackgroundColor("#06121f");

  this.add.text(W/2, H*0.18, "Level auswählen",
    { fontFamily:"system-ui, sans-serif", fontSize:"64px", color:"#e6f0ff" }
  ).setOrigin(0.5);

  // kleine Hilfsfunktion: nur Sound spielen, wenn er existiert
  const safeClick = () => {
    if (this.cache.audio && this.cache.audio.exists("click")) {
      this.sound.play("click");
    }
  };

  const makeButton = (y, label, onClick, enabled=true) => {
    const bw = 520, bh = 86;
    const p = this.add.rectangle(W/2, y, bw, bh, enabled ? 0x0b2b3b : 0x333333, 0.9)
      .setStrokeStyle(2, 0x79d0ff).setOrigin(0.5).setInteractive({ useHandCursor: enabled });
    const t = this.add.text(W/2, y, label,
      { fontFamily:"system-ui, sans-serif", fontSize:"34px", color:"#e6f0ff" }).setOrigin(0.5);

    if (enabled) {
      p.on("pointerover", ()=> p.setFillStyle(0x114455, 0.95));
      p.on("pointerout",  ()=> p.setFillStyle(0x0b2b3b, 0.9));
      p.on("pointerdown", ()=> { safeClick(); onClick(); });
    } else {
      this.add.text(W/2 + bw/2 - 90, y, "bald",
        { fontFamily:"system-ui, sans-serif", fontSize:"24px", color:"#a0c8ff" })
        .setOrigin(0.5);
    }
  };

  makeButton(H*0.38, "Level 1 – Limes-Ruine", () => this.scene.start("Level1"));
  makeButton(H*0.50, "Level 2 – Thermen-Oase", () => this.showToast("Level 2 kommt gleich 👀"), false);
  makeButton(H*0.62, "Level 3 – Reichstädter Fest", () => this.showToast("Level 3 kommt gleich 👀"), false);
  makeButton(H*0.74, "Level 4 – Aalener Spion", () => this.showToast("Level 4 kommt gleich 👀"), false);

  this.input.keyboard.on("keydown-ONE",   ()=> this.scene.start("Level1"));
  this.input.keyboard.on("keydown-TWO",   ()=> this.showToast("Level 2 kommt gleich 👀"));
  this.input.keyboard.on("keydown-THREE", ()=> this.showToast("Level 3 kommt gleich 👀"));
  this.input.keyboard.on("keydown-FOUR",  ()=> this.showToast("Level 4 kommt gleich 👀"));

  this.add.text(28, H-32, "⟵ Zurück (ESC)", { fontFamily:"system-ui, sans-serif", fontSize:"24px", color:"#a0c8ff" })
    .setOrigin(0,1).setAlpha(0.9);
  this.input.keyboard.on("keydown-ESC", ()=> this.scene.start("SplashScene"));
}


  showToast(msg){
    const W=this.scale.width, H=this.scale.height;
    const panel=this.add.rectangle(W/2, H*0.88, 620, 72, 0x000000, 0.55).setScrollFactor(0);
    const t=this.add.text(W/2, H*0.88, msg,
      { fontFamily:"system-ui, sans-serif", fontSize:"26px", color:"#e6f0ff" }).setOrigin(0.5);
    this.tweens.add({ targets:[panel,t], alpha:0, delay:900, duration:300, onComplete:()=>{panel.destroy(); t.destroy();} });
  }
}
