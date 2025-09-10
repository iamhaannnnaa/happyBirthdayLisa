// scenes/level2_v2.js
const Phaser = window.Phaser;

export default class Level2 extends Phaser.Scene {
  constructor() {
    super("Level2"); // fester Scene-Key
  }

  preload() {
    // Nutze die Assets, die du bereits im Projekt hast.
    // Falls einzelne Pfade fehlen, kommentiere sie einfach aus.
    this.load.image("diver", "assets/sprites/diver_v4.png");
    this.load.image("key", "assets/objects/key.png");
    this.load.image("door", "assets/objects/door.png");
    // Optionaler BG:
    // this.load.image("level2_bg", "assets/backgrounds/level2_bg.png");
  }

  create() {
    console.log("[Level2] create()");

    // ----- Welt / Kamera -----
    const W = this.scale.width, H = this.scale.height;
    this.cameras.main.setBackgroundColor("#06121f");
    this.physics.world.setBounds(0, 0, 3200, 2000);
    this.cameras.main.setBounds(0, 0, 3200, 2000);

    // Falls du einen Hintergrund hast:
    // if (this.textures.exists("level2_bg")) {
    //   this.add.image(1600, 1000, "level2_bg").setDisplaySize(3200, 2000).setDepth(-10);
    // }

    // ----- Spieler (etwas kleiner als vorher) -----
    // Wenn dein altes Scale ~1 war: wir nehmen 0.85 (≈ 15% kleiner)
    this.player = this.physics.add.image(300, 300, "diver").setScale(0.85);
    this.player.setCollideWorldBounds(true);

    // Steuerung
    this.cursors = this.input.keyboard.createCursorKeys();
    this.eKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.E);

    // ESC → zurück ins Menü
    this.input.keyboard.on("keydown-ESC", () => {
      this.scene.start("MenuScene");
    });

    // Kamera folgt
    this.cameras.main.startFollow(this.player, true, 0.12, 0.12);

    // ----- Sauerstoff-System + Schlüssel-Info in einem festen Frame (oben rechts) -----
    this.maxOxygen = 100;
    this.oxygen = this.maxOxygen;
    this.keysCollected = 0;
    this.totalKeys = 2;

    this.ui = this.makeUIFrame();          // Container oben rechts
    this.updateUI();                       // erste Anzeige
    this.scale.on("resize", () => this.repositionUIFrame()); // bei Größenänderung

    // O2-Countdown
    this.time.addEvent({
      delay: 1000,
      loop: true,
      callback: () => {
        this.oxygen = Math.max(0, this.oxygen - 1);
        this.updateUI();
        if (this.oxygen <= 0) this.handleDrown();
      },
    });

    // ----- Schlüssel & Tür -----
    this.key1 = this.physics.add.image(900, 600, "key");
    this.key2 = this.physics.add.image(1400, 1100, "key");
    this.door = this.physics.add.staticImage(2800, 900, "door");

    this.physics.add.overlap(this.player, this.key1, () => this.tryPickKey(this.key1));
    this.physics.add.overlap(this.player, this.key2, () => this.tryPickKey(this.key2));

    this.physics.add.overlap(this.player, this.door, () => {
      if (this.keysCollected >= this.totalKeys) this.handleWin();
    });

    // ----- „Mutter“-Punkt (M) -----
    // Ein einfacher Marker in der Welt; bei Berührung kommt eine Meldung im HUD.
    this.mother = this.add.circle(1800, 700, 22, 0xffc0cb).setDepth(5);
    this.mLabel = this.add.text(this.mother.x, this.mother.y - 36, "M", {
      fontFamily: "system-ui, sans-serif",
      fontSize: "28px",
      color: "#ffffff",
      stroke: "#000",
      strokeThickness: 4,
    }).setOrigin(0.5).setDepth(5);

    this.physics.add.existing(this.mother, true); // static body
    this.physics.add.overlap(this.player, this.mother, () => this.reachedMother());

    // Status-Flags
    this._motherMsgShown = false;
    this._lastVelMag = 0;
  }

  // ================= UI / Frame =================
  makeUIFrame() {
    const pad = 16;
    const frameW = 260;
    const frameH = 110;

    // Container fix am Bildschirm (scrollFactor 0) + hohe Depth
    const ui = this.add.container(0, 0).setScrollFactor(0).setDepth(1000);

    // Hintergrund + Rahmen
    const bg = this.add.rectangle(0, 0, frameW, frameH, 0x0d2e46, 0.92).setOrigin(1, 0);
    const border = this.add.rectangle(0, 0, frameW, frameH).setOrigin(1, 0)
      .setStrokeStyle(2, 0x134062, 1);

    // Titelzeile (optional)
    const title = this.add.text(-frameW + 12, 8, "Level 2", {
      fontFamily: "system-ui, sans-serif",
      fontSize: "16px",
      color: "#cfe9ff",
      stroke: "#000",
      strokeThickness: 2,
    });

    // O2-Balken
    const barX = -frameW + 12, barY = 34;
    const barW = frameW - 24, barH = 16;
    const o2bg = this.add.rectangle(barX, barY, barW, barH, 0x003654).setOrigin(0, 0);
    const o2fg = this.add.rectangle(barX + 2, barY + 2, barW - 4, barH - 4, 0x00aaff).setOrigin(0, 0);

    // O2-Text + Keys
    const o2text = this.add.text(barX, barY + 22, "O₂: 100", {
      fontFamily: "monospace",
      fontSize: "16px",
      color: "#cfe9ff",
    });
    const keysText = this.add.text(barX, barY + 42, "Keys: 0/2", {
      fontFamily: "monospace",
      fontSize: "16px",
      color: "#ffe66d",
    });

    // Info/Mutter-Meldung (erscheint im selben Frame, oben rechts)
    const info = this.add.text(-12, 8, "", {
      fontFamily: "system-ui, sans-serif",
      fontSize: "16px",
      color: "#a7f5a1",
      align: "right",
      wordWrap: { width: frameW - 24 },
      stroke: "#000",
      strokeThickness: 2,
    }).setOrigin(1, 0).setAlpha(0);

    ui.add([bg, border, title, o2bg, o2fg, o2text, keysText, info]);

    // Speichern für später
    ui._pad = pad;
    ui._frameW = frameW;
    ui._frameH = frameH;
    ui._o2fg = o2fg;
    ui._o2bgW = barW - 4;
    ui._o2text = o2text;
    ui._keys = keysText;
    ui._info = info;

    // Positionieren (oben rechts)
    this.repositionUIFrame(ui);

    return ui;
  }

  repositionUIFrame(ui = this.ui) {
    if (!ui) return;
    const pad = ui._pad ?? 16;
    ui.x = this.scale.width - pad;
    ui.y = pad;
  }

  updateUI() {
    if (!this.ui) return;
    // O2-Balkenbreite
    const ratio = Phaser.Math.Clamp(this.oxygen / this.maxOxygen, 0, 1);
    this.ui._o2fg.width = 2 + this.ui._o2bgW * ratio;
    // Texte
    this.ui._o2text.setText(`O₂: ${this.oxygen}`);
    this.ui._keys.setText(`Keys: ${this.keysCollected}/${this.totalKeys}`);
  }

  showInfo(msg, fadeDelay = 1600) {
    if (!this.ui) return;
    const t = this.ui._info;
    t.setText(msg);
    this.tweens.killTweensOf(t);
    t.setAlpha(0);
    this.tweens.add({
      targets: t,
      alpha: 1,
      duration: 120,
      ease: "Quad.easeOut",
      onComplete: () => {
        this.tweens.add({
          targets: t,
          alpha: 0,
          delay: fadeDelay,
          duration: 220,
          ease: "Quad.easeIn",
        });
      },
    });
  }

  // ================= Schlüssel / Mutter =================
  tryPickKey(sprite) {
    if (!sprite.active) return;
    if (Phaser.Input.Keyboard.JustDown(this.eKey)) {
      sprite.disableBody(true, true);
      this.keysCollected++;
      this.updateUI();
      this.showInfo("Schlüssel eingesammelt! (E)");
    } else {
      this.showInfo("Drücke E zum Aufheben", 900);
    }
  }

  reachedMother() {
    if (this._motherMsgShown) return;
    this._motherMsgShown = true;

    // Meldung im HUD-Frame (oben rechts)
    this.showInfo("Du hast Mama gefunden! 💬");

    // Beobachte Bewegung und blende die Meldung schneller aus, wenn man weiter schwimmt
    const check = this.time.addEvent({
      delay: 150,
      loop: true,
      callback: () => {
        const v = this.player.body ? this.player.body.velocity : { x: 0, y: 0 };
        const mag = Math.hypot(v.x, v.y);
        if (mag > 40) {
          // Sofort ausblenden
          if (this.ui && this.ui._info) {
            this.tweens.killTweensOf(this.ui._info);
            this.tweens.add({ targets: this.ui._info, alpha: 0, duration: 160 });
          }
          check.remove(false);
        }
      },
    });
  }

  // ================= Ablauf / Ende =================
  update() {
    const speed = 220; // etwas moderater Speed
    this.player.setVelocity(0);

    if (this.cursors.left.isDown) this.player.setVelocityX(-speed);
    else if (this.cursors.right.isDown) this.player.setVelocityX(speed);

    if (this.cursors.up.isDown) this.player.setVelocityY(-speed);
    else if (this.cursors.down.isDown) this.player.setVelocityY(speed);
  }

  handleDrown() {
    if (this._ended) return;
    this._ended = true;
    this.physics.pause();
    this.add
      .text(this.scale.width / 2, this.scale.height / 2, "Game Over\n(ESC → Menü)", {
        fontFamily: "sans-serif",
        fontSize: "48px",
        color: "#ff6b6b",
        align: "center",
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(2000);
  }

  handleWin() {
    if (this._ended) return;
    this._ended = true;
    this.physics.pause();
    this.add
      .text(this.scale.width / 2, this.scale.height / 2, "Geschafft!\n(ESC → Menü)", {
        fontFamily: "sans-serif",
        fontSize: "48px",
        color: "#51cf66",
        align: "center",
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(2000);
  }
}


