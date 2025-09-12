// scenes/level2.js
const Phaser = window.Phaser;
const DEBUG = false;

/* === DEBUG: Level2 Version Marker (Safari-/Legacy-safe) === */
(function () {
  var VERSION = "L2-2025-09-10-ui-topright";
  var now = new Date().toISOString();
  var url = "(unknown)";
  try {
    if (typeof document !== "undefined") {
      if (document.currentScript && document.currentScript.src) {
        url = document.currentScript.src;
      } else {
        var scripts = document.getElementsByTagName("script");
        if (scripts && scripts.length) {
          var last = scripts[scripts.length - 1];
          if (last && last.src) url = last.src;
        }
      }
    }
    if (url === "(unknown)" && typeof location !== "undefined" && location.href) {
      url = location.href;
    }
  } catch (e) {}
  try {
    console.log("%c[Level2] geladen:", "color:#4cf;font-weight:700;", VERSION, "@", now);
    console.log("Quelle:", url);
    if (typeof window !== "undefined") {
      try {
        Object.defineProperty(window, "__LEVEL2_VERSION__", { value: VERSION, writable: false, configurable: true });
      } catch (_) { window.__LEVEL2_VERSION__ = VERSION; }
      window.level2Info = function () { return { version: VERSION, url: url, loadedAt: now }; };
    }
  } catch (e) {}
})();

export default class Level2 extends Phaser.Scene {
  constructor(){ super("Level2"); }

  preload(){
    // Diver: 1920x1920 (4x4), Frames 480x480 – NUR als Spieler, NICHT als Hintergrund.
    if (!this.textures.exists("diver")){
      this.load.spritesheet("diver", "assets/sprites/diver_v4_1920x1920.png", {
        frameWidth: 480, frameHeight: 480, endFrame: 15
      });
    }
  }

  create(){
    // ------- Einstellungen -------
    const TILE         = 88;    // Größe der Kacheln
    const CAM_ZOOM     = 1.5;   // Kamera-Zoom
    const PLAYER_SCALE = 0.18;  // Sprite-Skalierung
    this.TILE = TILE;

    // ------- Labyrinth (15 Zeilen × 28 Spalten) -------
    const MAP = [
      "############################",
      "#S.....#......####.........#",
      "###.##...####......#######.#",
      "#...#..#.....#.###.......#.#",
      "#.######.#.#.#.####.#.######",
      "#....M#..#.#.#....#D###...##",
      "############.######.....#..#",
      "#...#F#....###.##...###.####",
      "#.#.#...##........#...#....#",
      "#.#.######.######.#.#.######",
      "#.#.............#.#.#......#",
      "#......#.#.##.#.#.#...##.#E#",
      "######.#...##.#.#.####.#.#.#",
      "#......#.#....#.#......###X#",
      "############################"
    ];

    this.mapW = MAP[0].length * TILE;
    this.mapH = MAP.length     * TILE;

    // ------- Welt & Kamera -------
    this.cameras.main.setBackgroundColor("#041016");
    this.physics.world.setBounds(0,0,this.mapW,this.mapH);
    this.cameras.main.setBounds(0,0,this.mapW,this.mapH);
    this.cameras.main.setRoundPixels(true);
    this.cameras.main.setZoom(CAM_ZOOM);

    // Platzhalter-Texturen (Boden/Wände/Türen/Icons)
    this.makeSimpleTextures();

    // Gruppen
    this.walls = this.physics.add.staticGroup();
    this.doors = this.physics.add.staticGroup();
    this.npcs  = this.physics.add.staticGroup();
    this.exit  = this.physics.add.staticGroup();

    // Welt aus MAP bauen
    let startX = TILE*2, startY = TILE*2;
    for (let y=0; y<MAP.length; y++){
      for (let x=0; x<MAP[0].length; x++){
        const ch = MAP[y][x];
        const px = x*TILE + TILE/2;
        const py = y*TILE + TILE/2;

        // Boden (damit Gänge sichtbar sind) – KEIN Diver-Hintergrund!
        this.add.image(px, py, "floor").setDepth(-5);

        if (ch === "#"){
          const w = this.walls.create(px, py, "wall");
          if (w.body) {
            w.body.setSize(TILE, TILE);
            w.body.setOffset(-TILE/2 + w.displayOriginX, -TILE/2 + w.displayOriginY);
          }
          w.refreshBody();
        } else if (ch === "S"){
          startX = px; startY = py;
        } else if (ch === "M"){
          const n = this.npcs.create(px, py, "mom").setData("id","mom");
          n.setData("line", "Mama: \"Hier ist dein Schlüssel für die grüne Tür!\"");
        } else if (ch === "F"){
          const n = this.npcs.create(px, py, "dad").setData("id","dad");
          n.setData("line", "Papa: \"Und ich öffne die rote Tür für dich!\"");
        } else if (ch === "D"){
          const d = this.doors.create(px, py, "door1").setData("id","door1").setData("locked", true);
          d.refreshBody();
        } else if (ch === "E"){
          const d = this.doors.create(px, py, "door2").setData("id","door2").setData("locked", true);
          d.refreshBody();
        } else if (ch === "X"){
          const ex = this.exit.create(px, py, "exit");
          ex.refreshBody();
        }
      }
    }

    // alle Wände voll kollidierbar
    this.walls.children.iterate(function(w){
      if (!w || !w.body) return;
      w.body.setSize(TILE, TILE);
      w.body.setOffset(-TILE/2 + w.displayOriginX, -TILE/2 + w.displayOriginY);
      if (w.body.checkCollision){
        w.body.checkCollision.none  = false;
        w.body.checkCollision.up    = true;
        w.body.checkCollision.down  = true;
        w.body.checkCollision.left  = true;
        w.body.checkCollision.right = true;
      }
      w.refreshBody();
    });

    // ------- Spieler -------
    this.player = this.textures.exists("diver")
      ? this.physics.add.sprite(startX, startY, "diver", 0).setScale(PLAYER_SCALE)
      : this.physics.add.image(startX, startY, "player");

    this.player.setCollideWorldBounds(true);
    this.player.body.setDrag(600,600);
    this.player.body.setMaxVelocity(320,320);
    this.updateBodySize();
    this.player.setFlipX(true); // Blickrichtung: rechts

    // Animationen
    if (this.textures.exists("diver")){
      if (!this.anims.exists("diver_swim")){
        this.anims.create({ key:"diver_swim",
          frames:this.anims.generateFrameNumbers("diver",{start:0,end:15}),
          frameRate:10, repeat:-1 });
        this.anims.create({ key:"diver_idle",
          frames:this.anims.generateFrameNumbers("diver",{start:0,end:1}),
          frameRate:2, repeat:-1 });
      }
      this.player.play("diver_idle");
    }

    // Kamera folgt
    this.cameras.main.startFollow(this.player, true, 0.12, 0.12);

    // ------- HUD im Frame oben rechts -------
    this.haveMomKey = false; // Tür D (grün)
    this.haveDadKey = false; // Tür E (rot)
    this.gameOver   = false;

    this.oxygenMax  = 40;
    this.oxygen     = this.oxygenMax;

    this.ui = this.makeUIFrame();     // Frame oben rechts
    this.updateUI();                  // erste Anzeige
    this.scale.on("resize", () => this.repositionUIFrame()); // sicher neu platzieren

    // O₂-Timer
    this.time.addEvent({
      delay:1000, loop:true, callback: ()=>{
        if (this.gameOver) return;
        this.oxygen = Math.max(0, this.oxygen-1);
        this.updateUI();
        if (this.oxygen <= 0) this.fail("Keine Luft mehr!");
      }
    });

    // Kollisionen/Overlaps
    this.physics.add.collider(this.player, this.walls);
    this.physics.add.collider(this.player, this.doors, (_pl, door)=>{
      if (door.getData("locked")){
        this.showInfo("Verschlossen. Hole dir die Schlüssel bei Mama & Papa.");
      }
    });
    this.physics.add.overlap(this.player, this.npcs, (_pl, npc)=> this.talkTo(npc));
    this.physics.add.overlap(this.player, this.exit, ()=> this.tryFinish());

    // Steuerung
    this.keys = this.input.keyboard.addKeys({
      left:"LEFT", right:"RIGHT", up:"UP", down:"DOWN",
      a:"A", d:"D", w:"W", s:"S", e:"E", esc:"ESC"
    });

    // ESC → Menü
    this.add.text(16, this.scale.height-10, "⟵ Menü (ESC)",
      { fontFamily:"system-ui, sans-serif", fontSize:"22px", color:"#a0c8ff",
        stroke:"#000", strokeThickness:3 })
      .setScrollFactor(0).setOrigin(0,1).setDepth(2000);
    this.input.keyboard.on("keydown-ESC", ()=> this.scene.start("MenuScene"));

    if (DEBUG){
      this.add.text(16, 100, "DEBUG ON", {color:"#0f0"}).setScrollFactor(0);
    }
  }

  // ====== Interaktionen ======
  talkTo(npc){
    if (!this.keys.e.isDown) return;
    const id = npc.getData("id");

    if (id === "mom" && !this.haveMomKey){
      this.haveMomKey = true;
      this.showInfo("Mama: Schlüssel erhalten! → Tür D ist nun offen.");
      this.openDoor("door1");                  // D auf
    } else if (id === "dad" && !this.haveDadKey){
      this.haveDadKey = true;
      this.showInfo("Papa: Schlüssel erhalten! → Tür E ist nun offen.");
      this.openDoor("door2");                  // E auf
    } else {
      this.showInfo(npc.getData("line"));
    }
    this.updateUI();
  }

  openDoor(id){
    this.doors.children.iterate(d=>{
      if (d.getData("id")===id && d.getData("locked")){
        d.setTexture("door_open");
        d.setData("locked", false);
        d.disableBody(true, true);                 // keine Kollision mehr
        // Deko an gleicher Stelle (optische “offene Tür”)
        this.add.image(d.x, d.y, "door_open").setDepth(-4);
      }
    });
  }

  tryFinish(){
    if (this.haveMomKey && this.haveDadKey){
      this.win();
    } else {
      this.showInfo("Die Ausgangstür öffnet sich erst mit beiden Schlüsseln.");
    }
  }

  // ====== Update / Bewegung ======
  update(){
    if (!this.player) return;

    const speed = 300;
    const ix = (this.keys.left.isDown || this.keys.a.isDown ? -1 : 0) +
               (this.keys.right.isDown|| this.keys.d.isDown ?  1 : 0);
    const iy = (this.keys.up.isDown   || this.keys.w.isDown ? -1 : 0) +
               (this.keys.down.isDown || this.keys.s.isDown ?  1 : 0);

    this.player.body.setAcceleration(ix*speed*2, iy*speed*2);

    if (ix!==0 || iy!==0){
      if (this.textures.exists("diver")) this.player.play("diver_swim", true);
      if (ix < 0)      this.player.setFlipX(false);
      else if (ix > 0) this.player.setFlipX(true);

      // falls eine Info eingeblendet ist: schneller ausblenden beim Los-Schwimmen
      if (this.ui && this.ui._info && this.ui._info.alpha > 0){
        this.tweens.killTweensOf(this.ui._info);
        this.tweens.add({ targets: this.ui._info, alpha: 0, duration: 160 });
      }
    } else {
      this.player.body.setAcceleration(0,0);
      if (this.textures.exists("diver")) this.player.play("diver_idle", true);
    }
  }

  // ====== HUD / UI (Frame oben rechts) ======
  makeUIFrame(){
    const pad = 16;
    const frameW = 260;
    const frameH = 120;

    const ui = this.add.container(0,0).setScrollFactor(0).setDepth(3000);

    const bg = this.add.rectangle(0,0, frameW, frameH, 0x0d2e46, 0.92).setOrigin(1,0);
    const border = this.add.rectangle(0,0, frameW, frameH).setOrigin(1,0)
      .setStrokeStyle(2, 0x134062, 1);

    const title = this.add.text(-frameW + 12, 8, "Level 2", {
      fontFamily:"system-ui, sans-serif", fontSize:"16px", color:"#cfe9ff",
      stroke:"#000", strokeThickness:2
    });

    // O2-Balken
    const barX = -frameW + 12, barY = 36;
    const barW = frameW - 24, barH = 16;
    const o2bg = this.add.rectangle(barX, barY, barW, barH, 0x003654).setOrigin(0,0);
    const o2fg = this.add.rectangle(barX+2, barY+2, barW-4, barH-4, 0x00aaff).setOrigin(0,0);

    const o2text  = this.add.text(barX, barY + 22, "O₂: --", { fontFamily:"monospace", fontSize:"16px", color:"#cfe9ff" });
    const keysTxt = this.add.text(barX, barY + 42, "Keys: –/–", { fontFamily:"monospace", fontSize:"16px", color:"#ffe66d" });

    // Info (Meldungen)
    const info = this.add.text(-12, 8, "", {
      fontFamily:"system-ui, sans-serif", fontSize:"16px", color:"#a7f5a1",
      align:"right", wordWrap:{ width: frameW-24 }, stroke:"#000", strokeThickness:2
    }).setOrigin(1,0).setAlpha(0);

    ui.add([bg, border, title, o2bg, o2fg, o2text, keysTxt, info]);

    ui._pad = pad;
    ui._frameW = frameW;
    ui._o2fg = o2fg;
    ui._o2bgW = barW - 4;
    ui._o2text = o2text;
    ui._keys = keysTxt;
    ui._info = info;

    this.repositionUIFrame(ui);
    return ui;
  }

  repositionUIFrame(ui = this.ui){
    if (!ui) return;
    const pad = ui._pad ?? 16;
    ui.x = this.scale.width - pad;
    ui.y = pad;
  }

  updateUI(){
    if (!this.ui) return;
    // O2
    const ratio = Phaser.Math.Clamp(this.oxygen / this.oxygenMax, 0, 1);
    this.ui._o2fg.width = 2 + this.ui._o2bgW * ratio;
    this.ui._o2text.setText(`O₂: ${this.oxygen}`);

    // Keys
    const a = this.haveMomKey ? "✓" : "–";
    const b = this.haveDadKey ? "✓" : "–";
    this.ui._keys.setText(`Keys: ${a} / ${b}`);
  }

  showInfo(msg, holdMs = 1500){
    if (!this.ui) return;
    const t = this.ui._info;
    t.setText(msg);
    this.tweens.killTweensOf(t);
    t.setAlpha(0);
    this.tweens.add({
      targets: t, alpha: 1, duration: 120, ease: "Quad.easeOut",
      onComplete: () => {
        this.tweens.add({ targets: t, alpha: 0, delay: holdMs, duration: 220, ease: "Quad.easeIn" });
      }
    });
  }

  // ====== Enden / Panels ======
  win(){
    if (this.gameOver) return;
    this.gameOver = true;
    this.physics.world.pause();
    this.player.body.setVelocity(0,0);
    if (this.textures.exists("diver")) this.player.play("diver_idle");
    this.showEndPanel("Level geschafft! 🎉");
  }

  fail(msg){
    if (this.gameOver) return;
    this.gameOver = true;
    this.physics.world.pause();
    this.player.body.setVelocity(0,0);
    this.showEndPanel(msg || "Game Over");
  }

  showEndPanel(title){
    const W=this.scale.width, H=this.scale.height;
    const dim   = this.add.rectangle(W/2,H/2,W,H,0x000000,0.55).setScrollFactor(0).setDepth(3000);
    const panel = this.add.rectangle(W/2,H/2,680,320,0x071a2b,0.95).setScrollFactor(0).setDepth(3001);
    this.add.text(W/2,H/2-90,title,{ fontFamily:"system-ui", fontSize:"36px", color:"#e6f0ff",
      stroke:"#000", strokeThickness:4 })
      .setOrigin(0.5).setScrollFactor(0).setDepth(3002);

    const makeBtn = (txt, y, onClick)=>{
      const r=this.add.rectangle(W/2, y, 260, 56, 0x0d2e46, 1).setScrollFactor(0).setDepth(3002).setInteractive({ useHandCursor:true });
      const t=this.add.text(W/2, y, txt, { fontFamily:"system-ui", fontSize:"22px", color:"#cfe9ff",
        stroke:"#000", strokeThickness:3 }).setOrigin(0.5).setScrollFactor(0).setDepth(3003);
      r.on("pointerover", ()=>r.setFillStyle(0x134062,1));
      r.on("pointerout",  ()=>r.setFillStyle(0x0d2e46,1));
      r.on("pointerdown", ()=>{ onClick(); dim.destroy(); panel.destroy(); r.destroy(); t.destroy(); });
    };
    makeBtn("Nochmal",  H/2+10, ()=> this.scene.restart());
    makeBtn("Zum Menü", H/2+80, ()=> this.scene.start("MenuScene"));
  }

  // ====== Helpers / Assets ======
  makeSimpleTextures(){
    const g = this.add.graphics();
    const t = this.TILE;
    // floor
    g.clear(); g.fillStyle(0x06202c, 1); g.fillRect(0,0,t,t); g.generateTexture("floor", t, t);
    // wall
    g.clear(); g.fillStyle(0x0b3a4e, 1); g.fillRect(0,0,t,t);
    g.lineStyle(4, 0x0f5776, 0.9); g.strokeRect(2,2,t-4,t-4);
    g.generateTexture("wall", t, t);
    // doors
    g.clear(); g.fillStyle(0x1a5c3a, 1); g.fillRect(0,0,t,t); g.generateTexture("door1", t, t);
    g.clear(); g.fillStyle(0x5c1a3a, 1); g.fillRect(0,0,t,t); g.generateTexture("door2", t, t);
    g.clear(); g.fillStyle(0x123a20, 1); g.fillRect(0,0,t,t);
    g.lineStyle(6, 0x1eff7e, 0.9); g.strokeRect(8,8,t-16,t-16); g.generateTexture("door_open", t, t);
    // exit
    g.clear(); g.fillStyle(0x274b63, 1); g.fillRect(0,0,t,t);
    g.lineStyle(6, 0xffffff, 0.9); g.strokeRect(10,10,t-20,t-20); g.generateTexture("exit", t, t);
    // NPC-Icons
    g.clear(); g.fillStyle(0xffe08a, 1); g.fillCircle(t/2, t/2, t*0.4); g.generateTexture("mom", t, t);
    g.clear(); g.fillStyle(0x9ad0ff, 1); g.fillCircle(t/2, t/2, t*0.4); g.generateTexture("dad", t, t);
    // Fallback Player
    g.clear(); g.fillStyle(0xffffff, 1); g.fillRect(0,0,48,32); g.generateTexture("player", 48, 32);
    g.destroy();
  }

  updateBodySize(){
  // etwas größere, aber runde Hitbox – verhindert visuelles „Reinschneiden“
  const USE_CIRCLE_HITBOX = true;

  // Verhältnis zur Sprite-Größe (höher = weniger Reinragen, aber enger in Gängen)
  const HITBOX_SCALE_X = 0.68;  // vorher 0.38
  const HITBOX_SCALE_Y = 0.72;  // vorher 0.52

  const bw = this.player.displayWidth  * HITBOX_SCALE_X;
  const bh = this.player.displayHeight * HITBOX_SCALE_Y;

  if (USE_CIRCLE_HITBOX){
    const r = Math.min(bw, bh) * 0.5;
    this.player.body.setCircle(r);
    // Kreis mittig unter das Sprite legen
    this.player.body.setOffset(
      (this.player.displayWidth  * 0.5) - r,
      (this.player.displayHeight * 0.5) - r
    );
  } else {
    // Rechteckig, aber größer als vorher
    this.player.body.setSize(bw, bh, true); // true = automatisch zentrieren
  }
}

}


