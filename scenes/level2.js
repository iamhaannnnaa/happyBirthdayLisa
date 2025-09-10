// scenes/level2.js
const Phaser = window.Phaser;
const DEBUG = false;

/* === DEBUG: Level2 Version Marker (Safari-/Legacy-safe) === */
(function () {
  var VERSION = "L2-2025-09-08-final+patch1";
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
    // Diver: 1920x1920 (4x4), Frames 480x480
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
    const PLAYER_SCALE = 0.20;  // Sprite-Skalierung (kleiner gemacht)

    this.TILE = TILE;

    // ------- Labyrinth (15 Zeilen × 28 Spalten) -------
    // #=Wand .=Boden  S=Start  M/F=NPC  D/E=Türen  X=Ausgang
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

    // Platzhalter-Texturen
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

        // Boden (damit Gänge sichtbar sind)
        this.add.image(px, py, "floor").setDepth(-5);

        if (ch === "#"){
          const w = this.walls.create(px, py, "wall");
          // volle Kachel-Kollision & zentrierte Bodies
          if (w.body) {
            w.body.setSize(TILE, TILE);
            w.body.setOffset(-TILE/2 + w.displayOriginX, -TILE/2 + w.displayOriginY);
          }
          w.refreshBody();
        } else if (ch === "S"){
          startX = px; startY = py;
        } else if (ch === "M"){
          const n = this.npcs.create(px, py, "mom").setData("id","mom");
          n.setData("line", "Mama (Kasse): 'Erst zahlen, dann saunieren!'");
          n.setData("gaveKey", false);
        } else if (ch === "F"){
          const n = this.npcs.create(px, py, "dad").setData("id","dad");
          n.setData("line", "Papa (Sauna): 'Handtuch unterlegen!'");
          n.setData("gaveKey", false);
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

    // Sicherheit: alle Wände nachträglich vollflächig kollidierbar machen
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
    this.player.setFlipX(true); // Start-Blickrichtung: rechts

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

    // ------- HUD / Schlüssel -------
    this.haveMomKey = false; // Schlüssel für D (door1)
    this.haveDadKey = false; // Schlüssel für E (door2)
    this.hud = this.add.text(16,16,"Schlüssel: 0 / 2\n[E] reden / benutzen",
      { fontFamily:"system-ui, sans-serif", fontSize:"24px", color:"#e6f0ff",
        stroke:"#000", strokeThickness:3 })
      .setScrollFactor(0).setDepth(2000);

    // HUD direkt korrekt anzeigen
    this.updateHud();

    // ------- O₂-Anzeige (links bündig) -------
    this.gameOver   = false;
    this.oxygenMax  = 40;
    this.oxygen     = this.oxygenMax;
    this.oxyBar     = this.makeOxygenBarLeft(); // linksbündig
    this.updateOxygenBar();

    // HUD/O₂ nach vorn holen
    this.children.bringToTop(this.hud);
    if (this.oxyBar && this.oxyBar.bg)      this.children.bringToTop(this.oxyBar.bg);
    if (this.oxyBar && this.oxyBar.fg)      this.children.bringToTop(this.oxyBar.fg);
    if (this.oxyBar && this.oxyBar.outline) this.children.bringToTop(this.oxyBar.outline);

    // O₂-Timer
    this.time.addEvent({
      delay:1000, loop:true, callback: ()=>{
        if (this.gameOver) return;
        this.oxygen = Math.max(0, this.oxygen-1);
        this.updateOxygenBar();
        if (this.oxygen <= 0) this.fail("Keine Luft mehr!");
      }
    });

    // Kollisionen/Overlaps
    this.physics.add.collider(this.player, this.walls);
    this.physics.add.collider(this.player, this.doors, (_pl, door)=>{
      if (door.getData("locked")){
        this.showToast("Verschlossene Tür. Sprich mit Mama/Papa für Schlüssel!");
      }
    });
    // -> Auto-Belohnung & Dialoge beim Berühren der NPCs
    this.physics.add.overlap(this.player, this.npcs, (_pl, npc)=> this.onNpcTouch(npc));
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

    // Einfacher Bildschirmrahmen (Overlay)
    {
      const W = this.scale.width, H = this.scale.height, d = 6;
      const g = this.add.graphics().setScrollFactor(0).setDepth(2400);
      g.lineStyle(d, 0x0d2e46, 0.9);
      g.strokeRect(d, d, W - 2*d, H - 2*d);
      this.uiFrame = g;
      this.scale.on("resize", (gameSize)=>{
        const w = gameSize.width, h = gameSize.height;
        g.clear(); g.lineStyle(d, 0x0d2e46, 0.9);
        g.strokeRect(d, d, w - 2*d, h - 2*d);
      });
    }

    // Taste E schließt auch aktiv ein Dialogfenster
    this._speechKeyBound = true;
    this.input.keyboard.on("keydown-E", ()=> this.hideSpeech());
  }

  // ------- Interaktionen -------
  // Beim Berühren eines NPC: Schlüssel vergeben + Sprechfenster
  onNpcTouch(npc){
    if (!npc || this.gameOver) return;

    const id = npc.getData("id");
    const alreadyGave = npc.getData("gaveKey") === true;
    const line = npc.getData("line") || "";

    if (id === "mom"){
      // Mama gibt Schlüssel für D (door1)
      if (!this.haveMomKey && !alreadyGave){
        this.haveMomKey = true;
        npc.setData("gaveKey", true);
        this.openDoor("door1");
        this.showSpeech(line + "\n→ Kassen-Schlüssel erhalten! (D)");
        this.updateHud();
        return;
      }
    } else if (id === "dad"){
      // Papa gibt Schlüssel für E (door2)
      if (!this.haveDadKey && !alreadyGave){
        this.haveDadKey = true;
        npc.setData("gaveKey", true);
        this.openDoor("door2");
        this.showSpeech(line + "\n→ Sauna-Schlüssel erhalten! (E)");
        this.updateHud();
        return;
      }
    }

    // Wenn bereits Schlüssel vergeben wurde: nur noch sprechen
    this.showSpeech(line);
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
      this.showToast("Die Ausgangstür öffnet sich erst mit beiden Schlüsseln.");
    }
  }

  // ------- Update / Bewegung -------
  update(){
    if (!this.player) return;

    const speed = 300;
    const ix = (this.keys.left.isDown || this.keys.a.isDown ? -1 : 0) +
               (this.keys.right.isDown|| this.keys.d.isDown ?  1 : 0);
    const iy = (this.keys.up.isDown   || this.keys.w.isDown ? -1 : 0) +
               (this.keys.down.isDown || this.keys.s.isDown ?  1 : 0);

    // Sprechfenster schließen, sobald sich die Spielerin bewegt
    if (this.speechUi && this.speechUi.alive && (ix !== 0 || iy !== 0)){
      this.hideSpeech();
    }

    this.player.body.setAcceleration(ix*speed*2, iy*speed*2);

    if (ix!==0 || iy!==0){
      if (this.textures.exists("diver")) this.player.play("diver_swim", true);
      if (ix < 0)      this.player.setFlipX(false);
      else if (ix > 0) this.player.setFlipX(true);
    } else {
      this.player.body.setAcceleration(0,0);
      if (this.textures.exists("diver")) this.player.play("diver_idle", true);
    }
  }

  // ------- UI / Helpers -------
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

  // O₂ linksbündig
  makeOxygenBarLeft(){
    const x = 16, y = 60, w = 220, h = 20;

    const bg = this.add.rectangle(x, y, w, h, 0xffffff, 0.12)
      .setOrigin(0,0.5).setScrollFactor(0).setDepth(1998);

    const fg = this.add.rectangle(x, y, w, h, 0x67b7ff, 0.95)
      .setOrigin(0,0.5).setScrollFactor(0).setDepth(1999);

    const outline = this.add.rectangle(x, y, w, h)
      .setOrigin(0,0.5).setStrokeStyle(2, 0xaad4ff, 1)
      .setScrollFactor(0).setDepth(2000).setFillStyle(0,0);

    this.add.text(x, y + 18, "Sauerstoff", {
      fontFamily:"system-ui", fontSize:"14px", color:"#a0c8ff",
      stroke:"#000", strokeThickness:2
    }).setOrigin(0,0).setScrollFactor(0).setDepth(2000);

    return { bg, fg, outline, w };
  }

  updateOxygenBar(){
    const p = Phaser.Math.Clamp(this.oxygen/this.oxygenMax, 0, 1);
    // von links füllen (Origin x=0)
    if (this.oxyBar && this.oxyBar.fg) {
      this.oxyBar.fg.scaleX = Math.max(0.0001, p);
    }
  }

  updateHud(){
    const count = (this.haveMomKey?1:0) + (this.haveDadKey?1:0);
    this.hud.setText("Schlüssel: " + count + " / 2\n[E] reden / benutzen");
  }

  updateBodySize(){
    // schmalere Hitbox, damit man besser durch enge Gänge passt
    const bw=this.player.displayWidth*0.38, bh=this.player.displayHeight*0.52;
    this.player.body.setSize(bw,bh);
    this.player.body.setOffset(
      (this.player.displayWidth  - bw)/2,
      (this.player.displayHeight - bh)/2
    );
  }

  showToast(msg){
    const W=this.scale.width, H=this.scale.height;
    const panel=this.add.rectangle(W/2, H*0.92, Math.min(1100, W-40), 64, 0x000000, 0.55)
      .setScrollFactor(0).setDepth(1500);
    const t=this.add.text(W/2, H*0.92, msg,
      { fontFamily:"system-ui, sans-serif", fontSize:"24px", color:"#e6f0ff", wordWrap:{width:Math.min(1000, W-100)},
        stroke:"#000", strokeThickness:3, align:"center" })
      .setOrigin(0.5).setScrollFactor(0).setDepth(1501);
    this.time.delayedCall(1400, ()=>{ panel.destroy(); t.destroy(); });
  }

  // ——— Dialogfenster („Frame“) das bei Bewegung/E verschwindet ———
  showSpeech(msg){
    // Wenn bereits ein Speech offen ist: erst schließen
    this.hideSpeech();

    const W = this.scale.width, H = this.scale.height;

    const panel = this.add.rectangle(W/2, H*0.82, Math.min(1100, W-40), 100, 0x001522, 0.80)
      .setOrigin(0.5).setScrollFactor(0).setDepth(2500);
    const text = this.add.text(W/2, panel.y, msg, {
        fontFamily:"system-ui, sans-serif", fontSize:"22px", color:"#e6f0ff",
        wordWrap:{ width: Math.min(1000, W-100) }, align:"center",
        stroke:"#000", strokeThickness:3
      })
      .setOrigin(0.5).setScrollFactor(0).setDepth(2501);

    // Merker
    this.speechUi = { panel, text, alive:true };
  }

  hideSpeech(){
    if (this.speechUi && this.speechUi.alive){
      this.speechUi.alive = false;
      if (this.speechUi.panel && !this.speechUi.panel.destroyed) this.speechUi.panel.destroy();
      if (this.speechUi.text  && !this.speechUi.text.destroyed ) this.speechUi.text.destroy();
      this.speechUi = null;
    }
  }

  // ------- Endbildschirme wie Level1 -------
  win(){
    if (this.gameOver) return;
    this.gameOver = true;
    this.physics.world.pause();
    this.player.body.setVelocity(0,0);
    if (this.textures.exists("diver")) this.player.play("diver_idle");
    this.hideSpeech();
    this.showEndPanel("Level geschafft! 🎉");
  }

  fail(msg){
    if (this.gameOver) return;
    this.gameOver = true;
    this.physics.world.pause();
    this.player.body.setVelocity(0,0);
    this.hideSpeech();
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
}
