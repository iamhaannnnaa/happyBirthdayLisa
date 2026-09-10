const Phaser = window.Phaser;
import { touchEnabled } from "./touch.js";
import { isUnlocked, isLevelDone, doneCount, ORDER, resetProgress } from "../progress.js";

export default class MenuScene extends Phaser.Scene {
  constructor(){ super("MenuScene"); }

  create(){
    const W = this.scale.width, H = this.scale.height;
    this.cameras.main.setBackgroundColor("#06121f");

    this.add.text(W/2, H*0.14, "Level auswählen",
      { fontFamily:"system-ui, sans-serif", fontSize:"64px", color:"#e6f0ff" }
    ).setOrigin(0.5);

    // Fortschritt
    const done = doneCount();
    this.add.text(W/2, H*0.22, `${done} von ${ORDER.length} Leveln geschafft`,
      { fontFamily:"system-ui, sans-serif", fontSize:"26px", color:"#a0c8ff" }
    ).setOrigin(0.5).setAlpha(0.9);

    const safeClick = () => {
      if (this.cache.audio && this.cache.audio.exists("click")) this.sound.play("click");
    };

    // ---- Level-Button: gesperrt, offen oder geschafft ----
    const makeLevelButton = (y, id, label, needsLabel) => {
      const bw = 620, bh = 86;
      const open = isUnlocked(id);
      const finished = isLevelDone(id);

      const p = this.add.rectangle(W/2, y, bw, bh, open ? 0x0b2b3b : 0x1a2228, open ? 0.9 : 0.85)
        .setStrokeStyle(2, open ? 0x79d0ff : 0x3c4a53)
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true });

      const text = (open ? "" : "🔒  ") + label + (finished ? "   ✓" : "");
      this.add.text(W/2, y, text, {
        fontFamily:"system-ui, sans-serif", fontSize:"34px",
        color: open ? "#e6f0ff" : "#7d8f9b"
      }).setOrigin(0.5);

      if (open){
        p.on("pointerover", ()=> p.setFillStyle(0x114455, 0.95));
        p.on("pointerout",  ()=> p.setFillStyle(0x0b2b3b, 0.9));
        p.on("pointerdown", ()=> { safeClick(); this.scene.start(id); });
      } else {
        p.on("pointerdown", ()=> this.showToast(`Schaff erst ${needsLabel}.`));
      }
      return open;
    };

    makeLevelButton(H*0.38, "Level1", "Level 1 – Limes-Ruine", "Level 1");
    makeLevelButton(H*0.50, "Level2", "Level 2 – Limes-Thermen-Oase", "Level 1");
    makeLevelButton(H*0.62, "Level3", "Level 3 – Reichstädter Tage", "Level 2");

    // Tastatur-Kürzel (respektieren die Sperre)
    const startIfOpen = (id, needs) => {
      if (isUnlocked(id)) this.scene.start(id);
      else this.showToast(`Schaff erst ${needs}.`);
    };
    this.input.keyboard.on("keydown-ONE",   ()=> startIfOpen("Level1", "Level 1"));
    this.input.keyboard.on("keydown-TWO",   ()=> startIfOpen("Level2", "Level 1"));
    this.input.keyboard.on("keydown-THREE", ()=> startIfOpen("Level3", "Level 2"));

    // Hinweis auf das Geschenk
    if (done >= ORDER.length){
      this.add.text(W/2, H*0.72, "🎁 Alle Level geschafft – dein Geschenk wartet!", {
        fontFamily:"system-ui, sans-serif", fontSize:"28px", color:"#ffe062"
      }).setOrigin(0.5);
    } else {
      this.add.text(W/2, H*0.72, "Spiel alle drei Level durch, um dein Geschenk zu sehen.", {
        fontFamily:"system-ui, sans-serif", fontSize:"24px", color:"#7fa8c8"
      }).setOrigin(0.5).setAlpha(0.9);
    }

    // Zurück
    if (!touchEnabled()){
      this.add.text(28, H-32, "⟵ Zurück (ESC)", {
        fontFamily:"system-ui, sans-serif", fontSize:"24px", color:"#a0c8ff"
      }).setOrigin(0,1).setAlpha(0.9);
    } else {
      const back = this.add.rectangle(150, H-56, 220, 62, 0x0b2b3b, 0.8)
        .setStrokeStyle(2, 0x79d0ff, 0.8).setInteractive({ useHandCursor:true });
      this.add.text(150, H-56, "⟵ Zurück", {
        fontFamily:"system-ui, sans-serif", fontSize:"26px", color:"#cfe9ff"
      }).setOrigin(0.5);
      back.on("pointerdown", ()=> this.scene.start("SplashScene"));
    }
    this.input.keyboard.on("keydown-ESC", ()=> this.scene.start("SplashScene"));

    // Spielstand zurücksetzen (eigenes Fenster statt Browser-Dialog)
    const reset = this.add.text(W - 24, H - 24, "Spielstand zurücksetzen", {
      fontFamily:"system-ui, sans-serif", fontSize:"22px", color:"#8fa6b4"
    }).setOrigin(1, 1).setInteractive({ useHandCursor: true });
    reset.on("pointerover", ()=> reset.setColor("#e6f0ff"));
    reset.on("pointerout",  ()=> reset.setColor("#8fa6b4"));
    reset.on("pointerdown", ()=> this.askReset());
  }

  // ---- Eigenes Bestätigungsfenster ----
  askReset(){
    const W = this.scale.width, H = this.scale.height;
    const layer = this.add.container(0,0).setDepth(30000);

    const dim = this.add.rectangle(W/2, H/2, W, H, 0x000000, 0.6)
      .setInteractive(); // schluckt Klicks dahinter
    const panel = this.add.rectangle(W/2, H/2, 700, 300, 0x071a2b, 0.98)
      .setStrokeStyle(3, 0xaad4ff, 0.9);
    const title = this.add.text(W/2, H/2 - 80, "Spielstand wirklich zurücksetzen?", {
      fontFamily:"system-ui, sans-serif", fontSize:"32px", color:"#e6f0ff"
    }).setOrigin(0.5);
    const sub = this.add.text(W/2, H/2 - 30, "Alle Level werden wieder gesperrt.", {
      fontFamily:"system-ui, sans-serif", fontSize:"22px", color:"#a0c8ff"
    }).setOrigin(0.5);

    const mkBtn = (x, label, color, onClick) => {
      const r = this.add.rectangle(x, H/2 + 70, 280, 66, color, 1)
        .setInteractive({ useHandCursor:true });
      const t = this.add.text(x, H/2 + 70, label, {
        fontFamily:"system-ui, sans-serif", fontSize:"24px", color:"#e6f0ff"
      }).setOrigin(0.5);
      r.on("pointerdown", onClick);
      layer.add([r, t]);
    };

    layer.add([dim, panel, title, sub]);
    mkBtn(W/2 - 160, "Abbrechen", 0x0d2e46, ()=> layer.destroy());
    mkBtn(W/2 + 160, "Zurücksetzen", 0x7a2230, ()=> {
      resetProgress();
      layer.destroy();
      this.scene.restart();
    });
  }

  showToast(msg){
    const W=this.scale.width, H=this.scale.height;
    const panel=this.add.rectangle(W/2, H*0.88, 680, 72, 0x000000, 0.6).setDepth(20000);
    const t=this.add.text(W/2, H*0.88, msg,
      { fontFamily:"system-ui, sans-serif", fontSize:"26px", color:"#e6f0ff" })
      .setOrigin(0.5).setDepth(20001);
    this.tweens.add({ targets:[panel,t], alpha:0, delay:1100, duration:300,
      onComplete:()=>{ panel.destroy(); t.destroy(); } });
  }
}
