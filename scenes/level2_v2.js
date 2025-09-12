// scenes/level2.js
const Phaser = window.Phaser;
const DEBUG = false;

/* === DEBUG: Level2 Version Marker (Safari-/Legacy-safe) === */
(function () {
  var VERSION = "L2-2025-09-12-topcenter-hud-solid-npcs-no-extra-cams+floatO2";
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
    if (url === "(unknown)" && typeof location !== "undefined" && location.href) url = location.href;
  } catch(e){}
  try {
    console.log("%c[Level2] geladen:", "color:#4cf;font-weight:700;", VERSION, "@", now);
    console.log("Quelle:", url);
    if (typeof window !== "undefined") {
      try { Object.defineProperty(window, "__LEVEL2_VERSION__", { value: VERSION, writable:false, configurable:true }); }
      catch(_) { window.__LEVEL2_VERSION__ = VERSION; }
      window.level2Info = function(){ return { version:VERSION, url, loadedAt:now }; };
    }
  } catch(e){}
})();

export default class Level2 extends Phaser.Scene {
  constructor(){ super("Level2"); }

  preload(){
    // Spieler-Sprite
    if (!this.textures.exists("diver")){
      this.load.spritesheet("diver", "assets/sprites/diver_v4_1920x1920.png", {
        frameWidth:480, frameHeight:480, endFrame:15
      });
    }
    // Wände/Boden (optional). Falls fehlen, baut makeSimpleTextures Fallbacks.
    if (!this.textures.exists("wall")){
      this.load.image("wall", "assets/objects/mauer.png");
    }
    if (!this.textures.exists("floor")){
      this.load.image("floor", "assets/floors/sand_88.png");
    }
  }

  create(){
    // ------- Einstellungen -------
    const TILE         = 88;
    const CAM_ZOOM     = 1.8;
    const PLAYER_SCALE = 0.18;
    this.TILE = TILE;

    // ------- Labyrinth -------
    const MAP = [
      "############################",
      "#S.....#......####.........#",
      "###.##...####......#######.#",
      "#...#..#.....#.###.......#.#",
      "#.######.#.#.#.####.#.######",
      "#....M#..#.#.#....#D###...##",
      "############.######.....#..#",
      "#.....#....###.##...###.####",
      "####....##........#...#....#",
      "#..F######.######.#.#.######",
      "#.##............#.#.#......#",
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

    // Fallback-Texturen erzeugen, falls Assets fehlen
    this.makeSimpleTextures();

    // Gruppen
    this.walls = this.physics.add.staticGroup();
    this.doors = this.physics.add.staticGroup();
    this.npcs  = this.physics.add.staticGroup(); // statisch = solide
    this.exit  = this.physics.add.staticGroup();

    // Welt aus MAP bauen
    let startX = TILE*2, startY = TILE*2;
    for (let y=0; y<MAP.length; y++){
      for (let x=0; x<MAP[0].length; x++){
        const ch = MAP[y][x];
        const px = x*TILE + TILE/2;
        const py = y*TILE + TILE/2;

        // Boden (hinter alles)
        const f = this.add.image(px, py, "floor").setDepth(-5);
        f.setDisplaySize(this.TILE, this.TILE);

        if (ch === "#"){
          const w = this.walls.create(px, py, "wall");
          w.setDisplaySize(this.TILE, this.TILE);
          w.setOrigin(0.5, 0.5);
          if (w.body){
            w.body.setSize(this.TILE, this.TILE);
            w.body.setOffset(-this.TILE/2 + w.displayOriginX, -this.TILE/2 + w.displayOriginY);
          }
          w.refreshBody();
        } else if (ch === "S"){
          startX = px; startY = py;
        } else if (ch === "M"){
          const n = this.npcs.create(px, py, "mom").setData("id","mom");
          n.setData("gaveKey", false);
          n.setDisplaySize(this.TILE, this.TILE);
          if (n.body){
            n.body.setSize(this.TILE, this.TILE);
            n.body.setOffset(-this.TILE/2 + n.displayOriginX, -this.TILE/2 + n.displayOriginY);
          }
          n.refreshBody();
        } else if (ch === "F"){
          const n = this.npcs.create(px, py, "dad").setData("id","dad");
          n.setData("gaveKey", false);
          n.setDisplaySize(this.TILE, this.TILE);
          if (n.body){
            n.body.setSize(this.TILE, this.TILE);
            n.body.setOffset(-this.TILE/2 + n.displayOriginX, -this.TILE/2 + n.displayOriginY);
          }
          n.refreshBody();
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

    // Wände sicher kollidierbar
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
    this.player.setFlipX(true);

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

    // ------- Status -------
    this.haveMomKey = false; // Tür D
    this.haveDadKey = false; // Tür E
    this.gameOver   = false;

    this.oxygenMax  = 52;
    this.oxygen     = this.oxygenMax;

    // --- NEU: schwebende O2-Leiste über dem Spieler ---
    this.createFloatingO2Bar();

    // ------- HUD oben mittig (fix) -------
    this.ui = this.makeUIFrameTopCenter()
      .setDepth(10000)             // ganz nach oben
      .setScrollFactor(0);         // Kamera-unabhängig
    this.children.bringToTop(this.ui);
    this.updateUI();

    // ESC-Label (auch fix)
    const escTxt = this.add.text(16, this.scale.height-10, "⟵ Menü (ESC)", {
      fontFamily:"system-ui, sans-serif", fontSize:"22px", color:"#a0c8ff",
      stroke:"#000", strokeThickness:3
    }).setOrigin(0,1).setScrollFactor(0).setDepth(10000);

    // Auf Resize HUD korrekt neu positionieren
    this.scale.on("resize", (gameSize)=>{
      this.repositionUIFrame();
      escTxt.setPosition(16, this.scale.height-10);
    });

    // ------- O₂-Timer -------
    this.time.addEvent({
      delay:1000, loop:true, callback: ()=>{
        if (this.gameOver) return;
        this.oxygen = Math.max(0, this.oxygen-1);
        this.updateUI();
        this.updateO2Visual(); // NEU: schwebende Leiste sofort mitziehen
        if (this.oxygen <= 0) this.fail("Keine Luft mehr!");
      }
    });

    // ------- Kollisionen -------
    this.physics.add.collider(this.player, this.walls);

    // Türen: blockieren solange locked; Hinweis beim Anprall
    this.physics.add.collider(this.player, this.doors, (_pl, door)=>{
      if (door.getData("locked")){
        this.showInfo("Verschlossen. Hol dir die Schlüssel bei Mama & Papa.");
      }
    });

    // NPCs: SOLID + Schlüsselvergabe beim Anstoß
    this.physics.add.collider(this.player, this.npcs, (_pl, npc)=> this.onNpcBump(npc));

    // Ausgang
    this.physics.add.overlap(this.player, this.exit, ()=> this.tryFinish());

    // ------- Steuerung -------
    this.keys = this.input.keyboard.addKeys({
      left:"LEFT", right:"RIGHT", up:"UP", down:"DOWN",
      a:"A", d:"D", w:"W", s:"S", e:"E", esc:"ESC"
    });
    this.input.keyboard.on("keydown-ESC", ()=> this.scene.start("MenuScene"));

    if (DEBUG){
      this.add.text(16, 100, "DEBUG ON", {color:"#0f0"}).setScrollFactor(0).setDepth(10000);
    }
  }

  // ====== NPC-Logik: Schlüssel bei Anstoß ======
  onNpcBump(npc){
    if (!npc || this.gameOver) return;

    const id   = npc.getData("id");
    const gave = npc.getData("gaveKey") === true;

    if (id === "mom" && !this.haveMomKey && !gave){
      this.haveMomKey = true;
      npc.setData("gaveKey", true);
      this.openDoor("door1"); // Tür D
      this.showInfo("Mama: Schlüssel erhalten → Tür D öffnet sich!");
      this.updateUI();
      return;
    }

    if (id === "dad" && !this.haveDadKey && !gave){
      this.haveDadKey = true;
      npc.setData("gaveKey", true);
      this.openDoor("door2"); // Tür E
      this.showInfo("Papa: Schlüssel erhalten → Tür E öffnet sich!");
      this.updateUI();
      return;
    }
  }

  openDoor(id){
    this.doors.children.iterate(d=>{
      if (d.getData("id")===id && d.getData("locked")){
        d.setTexture("door_open");
        d.setData("locked", false);
        d.disableBody(true, true);
        this.add.image(d.x, d.y, "door_open").setDepth(-4);
      }
    });
  }

  tryFinish(){
    if (this.haveMomKey && this.haveDadKey){
      this.win();
    } else {
      this.showInfo("Die Ausgangstür öffnet sich erst mit beiden Schlüsseln (D & E).");
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

      // Info schneller weg beim Bewegen
      if (this.ui && this.ui._info && this.ui._info.alpha > 0){
        this.tweens.killTweensOf(this.ui._info);
        this.tweens.add({ targets: this.ui._info, alpha: 0, duration: 160 });
      }
    } else {
      this.player.body.setAcceleration(0,0);
      if (this.textures.exists("diver")) this.player.play("diver_idle", true);
    }

    // --- NEU: O2-Leiste an Spielerposition binden ---
    this.updateFloatingO2Bar();
  }

  // ====== HUD oben mittig ======
  makeUIFrameTopCenter(){
    const pad = 10;
    const frameW = 360;
    const frameH = 80;

    const ui = this.add.container(this.scale.width/2, pad).setScrollFactor(0);

    // Panel
    const bg = this.add.rectangle(0, 0, frameW, frameH, 0x0d2e46, 0.92).setOrigin(0.5,0);
    const border = this.add.rectangle(0, 0, frameW, frameH).setOrigin(0.5,0).setStrokeStyle(2, 0x134062, 1);

    // Titel
    const title = this.add.text(-frameW/2 + 12, 8, "Level 2", {
      fontFamily:"system-ui, sans-serif", fontSize:"16px", color:"#cfe9ff",
      stroke:"#000", strokeThickness:2
    }).setOrigin(0,0);

    // O2-Bar
    const barX = -frameW/2 + 12, barY = 34;
    const barW = 180, barH = 16;
    const o2bg = this.add.rectangle(barX, barY, barW, barH, 0x003654).setOrigin(0,0);
    const o2fg = this.add.rectangle(barX+2, barY+2, barW-4, barH-4, 0x00aaff).setOrigin(0,0);
    const o2text  = this.add.text(barX, barY + 22, "O₂: --", { fontFamily:"monospace", fontSize:"16px", color:"#cfe9ff" }).setOrigin(0,0);

    // Keys-Anzeige (D/E)
    const keysTxt = this.add.text(barX + 210, 36, "Keys: D[–] E[–]", { fontFamily:"monospace", fontSize:"16px", color:"#ffe66d" }).setOrigin(0,0);

    // Meldungen (rechts im Panel)
    const info = this.add.text(frameW/2 - 12, 8, "", {
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

    return ui;
  }

  repositionUIFrame(ui = this.ui){
    if (!ui) return;
    ui.x = this.scale.width / 2;
    ui.y = ui._pad ?? 10;
  }

  updateUI(){
    if (!this.ui) return;
    const ratio = Phaser.Math.Clamp(this.oxygen / this.oxygenMax, 0, 1);
    this.ui._o2fg.width = 2 + this.ui._o2bgW * ratio;
    this.ui._o2text.setText(`O₂: ${this.oxygen}`);

    const d = this.haveMomKey ? "✓" : "–";
    const e = this.haveDadKey ? "✓" : "–";
    this.ui._keys.setText(`Keys: D[${d}] E[${e}]`);
  }

  showInfo(msg, holdMs = 1500){
    if (!this.ui) return;
    const t = this.ui._info;
    t.setText(msg);
    this.tweens.killTweensOf(t);
    t.setAlpha(0);
    this.tweens.add({
      targets:t, alpha:1, duration:120, ease:"Quad.easeOut",
      onComplete: ()=> this.tweens.add({ targets:t, alpha:0, delay:holdMs, duration:220, ease:"Quad.easeIn" })
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
    const dim   = this.add.rectangle(W/2,H/2,W,H,0x000000,0.55).setScrollFactor(0).setDepth(10000);
    const panel = this.add.rectangle(W/2,H/2,680,320,0x071a2b,0.95).setScrollFactor(0).setDepth(10001);
    this.add.text(W/2,H/2-90,title,{ fontFamily:"system-ui", fontSize:"36px", color:"#e6f0ff",
      stroke:"#000", strokeThickness:4 }).setOrigin(0.5).setScrollFactor(0).setDepth(10002);

    const makeBtn = (txt, y, onClick)=>{
      const r=this.add.rectangle(W/2, y, 260, 56, 0x0d2e46, 1).setScrollFactor(0).setDepth(10002).setInteractive({ useHandCursor:true });
      const t=this.add.text(W/2, y, txt, { fontFamily:"system-ui", fontSize:"22px", color:"#cfe9ff", stroke:"#000", strokeThickness:3 })
        .setOrigin(0.5).setScrollFactor(0).setDepth(10003);
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

    if (!this.textures.exists("floor")){
      g.clear(); g.fillStyle(0x083347,1); g.fillRect(0,0,t,t);
      g.generateTexture("floor", t, t);
    }
    if (!this.textures.exists("wall")){
      this._generatePrettyWall(g, t);
    }
    if (!this.textures.exists("door1")){
      g.clear(); g.fillStyle(0x1a5c3a, 1); g.fillRect(0,0,t,t); g.generateTexture("door1", t, t);
    }
    if (!this.textures.exists("door2")){
      g.clear(); g.fillStyle(0x5c1a3a, 1); g.fillRect(0,0,t,t); g.generateTexture("door2", t, t);
    }
    if (!this.textures.exists("door_open")){
      g.clear(); g.fillStyle(0x123a20, 1); g.fillRect(0,0,t,t);
      g.lineStyle(6, 0x1eff7e, 0.9); g.strokeRect(8,8,t-16,t-16); g.generateTexture("door_open", t, t);
    }
    if (!this.textures.exists("exit")){
      g.clear(); g.fillStyle(0x274b63, 1); g.fillRect(0,0,t,t);
      g.lineStyle(6, 0xffffff, 0.9); g.strokeRect(10,10,t-20,t-20); g.generateTexture("exit", t, t);
    }
    if (!this.textures.exists("mom")){
      g.clear(); g.fillStyle(0xffe08a, 1); g.fillCircle(t/2, t/2, t*0.4); g.generateTexture("mom", t, t);
    }
    if (!this.textures.exists("dad")){
      g.clear(); g.fillStyle(0x9ad0ff, 1); g.fillCircle(t/2, t/2, t*0.4); g.generateTexture("dad", t, t);
    }
    g.destroy();
  }

  _generatePrettyWall(g, t){
    g.clear(); g.fillStyle(0x1e2f3f,1); g.fillRect(0,0,t,t);
    g.lineStyle(2,0x2b4760,0.9); g.strokeRect(1,1,t-2,t-2);
    g.generateTexture("wall", t, t);
  }

  updateBodySize(){
    const USE_CIRCLE_HITBOX = true;
    const HITBOX_SCALE_X = 0.68;
    const HITBOX_SCALE_Y = 0.72;
    const bw=this.player.displayWidth*HITBOX_SCALE_X, bh=this.player.displayHeight*HITBOX_SCALE_Y;
    if (USE_CIRCLE_HITBOX){
      const r = Math.min(bw, bh) * 0.5;
      this.player.body.setCircle(r);
      this.player.body.setOffset((this.player.displayWidth*0.5)-r,(this.player.displayHeight*0.5)-r);
    } else {
      this.player.body.setSize(bw,bh,true);
    }
  }

  // ====== Schwebende O2-Leiste über dem Spieler ======
  createFloatingO2Bar(){
    const barWidth  = 64;   // Breite in Pixeln
    const barHeight = 8;    // Höhe in Pixeln
    const pad       = 1;    // Innenabstand für den Rand
    const offY      = -this.player.displayHeight * 0.65; // Offset über dem Kopf

    const c = this.add.container(this.player.x, this.player.y + offY);
    c.setDepth(9999);        // unter HUD (HUD hat 10000)
    c.setScrollFactor(1);    // bewegt sich mit der Welt/Kamera

    // Hintergrund + Border
    const bg = this.add.rectangle(0, 0, barWidth, barHeight, 0x031b28, 0.85).setOrigin(0.5);
    const border = this.add.rectangle(0, 0, barWidth, barHeight).setOrigin(0.5).setStrokeStyle(1, 0x0a3a55, 1);

    // Füllung (wird in der Breite verändert)
    const fill = this.add.rectangle(
      -barWidth/2 + pad, 0,
      barWidth - pad*2, barHeight - pad*2,
      0x00aaff, 1
    ).setOrigin(0, 0.5);

    // kleines O₂-"Icon" links
    const dot = this.add.rectangle(-barWidth/2 - 6, 0, 4, 4, 0xffffff, 0.9).setOrigin(0.5);

    c.add([bg, border, fill, dot]);

    // Referenzen merken
    this._o2Float = {
      container: c,
      fill,
      barWidth,
      barHeight,
      pad,
      offY
    };

    // initiale Breite/Farbe
    this.updateO2Visual();
  }

  updateFloatingO2Bar(){
    if (!this._o2Float || !this.player) return;
    const { container, offY } = this._o2Float;
    container.x = this.player.x;
    container.y = this.player.y + offY;

    // optional "einrasten":
    // container.x = Math.round(container.x);
    // container.y = Math.round(container.y);
  }

  updateO2Visual(){
    if (!this._o2Float) return;
    const { fill, barWidth, pad } = this._o2Float;

    const ratio = Phaser.Math.Clamp(this.oxygen / this.oxygenMax, 0, 1);
    const innerW = barWidth - pad*2;
    fill.width = Math.max(0, innerW * ratio);

    // Farb-Feedback
    let color = 0x00aaff;        // Standard blau
    if (ratio < 0.33)      color = 0xff4d4d;  // rot
    else if (ratio < 0.66) color = 0xffc24d;  // gelb
    fill.fillColor = color;
  }
}



