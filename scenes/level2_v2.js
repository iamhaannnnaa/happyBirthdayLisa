// scenes/level2.js
const Phaser = window.Phaser;
import { readAxis, startTouch, touchEnabled } from "./touch.js";
import { markLevelDone, levelTitle, nextLevel } from "../progress.js";
import { makeNote, showNote } from "./ui.js";

const DEBUG = false;

/* === DEBUG: Level2 Version Marker (Safari-/Legacy-safe) === */
(function () {
  var VERSION = "L2-2025-09-12-topcenter-hud-solid-npcs-no-extra-cams+floatO2+keyOverlay+introOnce";
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
    // Grafiken für die Thermen. Fehlt etwas, springt makeSimpleTextures ein.
    const L2 = "assets/objects/level2/";
    this.load.image("wall",       L2 + "wall_tile.png");
    this.load.image("floor",      L2 + "floor_tile.png");
    this.load.image("door1",      L2 + "door_gold.png");
    this.load.image("door2",      L2 + "door_red.png");
    this.load.image("door_open",  L2 + "door_open.png");
    this.load.image("exit",       L2 + "exit_well.png");
    this.load.image("mom",        L2 + "npc_mom.png");
    this.load.image("dad",        L2 + "npc_dad.png");
    this.load.image("key_gold",   L2 + "key_gold.png");
    this.load.image("key_silver", L2 + "key_silver.png");
    this.load.image("parchment",  L2 + "parchment.png");
    this.load.image("deco_mosaic", L2 + "deco_mosaic.png");
    this.load.image("deco_crack",  L2 + "deco_crack.png");
    this.load.image("deco_algae",  L2 + "deco_algae.png");
    this.load.image("deco_shell",  L2 + "deco_shell.png");
    if (!this.textures.exists("caustics")){
      this.load.image("caustics", "assets/backgrounds/caustics_overlay.png");
    }
  }

  create(){
    // ------- Einstellungen -------
    const TILE         = 88;
    const CAM_ZOOM     = 2;
    const PLAYER_SCALE = 0.18;
    this.TILE = TILE;

    // ------- Labyrinth -------
    const MAP = [
      "############################",
      "#S.....#......####.........#",
      "###.##...####......#######.#",
      "#...#..#.....#.###.......#.#",
      "#.######.#.#.#.####.#.######",
      "#.....#..#.#.#....#D###...##",
      "#####.######.######.....#..#",
      "#M....#....###.##...###.####",
      "#####..##.........#...#....#",
      "#...######.######.#.#.######",
      "#.##............#.#.#......#",
      "#......#.#.##.#.#.#...##.#E#",
      "######.#...##.#.#.####.#.#.#",
      "#......#.#....#F#......###X#",   // Papa: unten in der Sackgasse versteckt
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

        // Boden (hinter alles) – zufällig gedreht, damit kein Kachelmuster entsteht
        const f = this.add.image(px, py, "floor").setDepth(-5);
        f.setDisplaySize(this.TILE, this.TILE);
        f.setAngle(Phaser.Math.RND.pick([0, 90, 180, 270]));
        if (Phaser.Math.RND.frac() < 0.5) f.setFlipX(true);

        // Deko nur auf begehbaren Feldern, damit die Gänge lebendig wirken
        if (ch !== "#" && Phaser.Math.RND.frac() < 0.3){
          const key = Phaser.Math.RND.weightedPick([
            "deco_crack", "deco_algae", "deco_crack", "deco_shell",
            "deco_mosaic", "deco_algae", "deco_crack", "deco_algae"
          ]);
          const deco = this.add.image(
            px + Phaser.Math.Between(-18, 18),
            py + Phaser.Math.Between(-18, 18), key
          ).setDepth(-4);
          const size = (key === "deco_mosaic")
            ? this.TILE * 0.9
            : this.TILE * Phaser.Math.FloatBetween(0.6, 0.95);
          deco.setDisplaySize(size, size);
          deco.setAlpha(key === "deco_crack" ? 0.75 : 0.9);
          deco.setAngle(Phaser.Math.Between(0, 359));
        }

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
        } else if (ch === "D" || ch === "E"){
          const id  = (ch === "D") ? "door1" : "door2";
          const dr = this.doors.create(px, py, id).setData("id", id).setData("locked", true);
          dr.setDisplaySize(this.TILE, this.TILE);   // Textur ist größer als eine Kachel
          dr.setDepth(1);
          dr.refreshBody();
        } else if (ch === "X"){
          const ex = this.exit.create(px, py, "exit");
          ex.setDisplaySize(this.TILE, this.TILE);
          ex.setDepth(0);
          ex.refreshBody();
          this.decorateExit(px, py);
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
    // Im Labyrinth ruhiger als im offenen Wasser: mehr Wasserwiderstand,
    // weniger Höchsttempo – dadurch lässt sie sich feiner steuern.
    this.player.body.setDrag(1000, 1000);
    this.player.body.setMaxVelocity(215, 215);
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

    this.oxygenMax  = 95;   // Weg zu Mama, Papa und Ausgang dauert ~45 s – Rest zum Suchen
    this.oxygen     = this.oxygenMax;

    // --- Stimmung: Lichtschleier + Schwebeteilchen ---
    this.addAtmosphere();

    // --- schwebende O2-Leiste + Schlüssel über dem Spieler ---
    this.createFloatingO2Bar();

    // ------- HUD oben mittig -------
    // Die Kamera zoomt in diesem Level 2x; ein Element mit scrollFactor 0
    // landet dadurch außerhalb des Bildes. Alles Wichtige (Sauerstoff,
    // Schlüssel) schwebt deshalb direkt über der Taucherin.
    this.ui = this.makeUIFrameTopCenter()
      .setDepth(10000)
      .setScrollFactor(0)
      .setVisible(false);
    this.updateUI();

    // ESC-Label (auch fix)
    const escTxt = this.add.text(16, this.scale.height-10, "⟵ Menü (ESC)", {
      fontFamily:"system-ui, sans-serif", fontSize:"22px", color:"#a0c8ff",
      stroke:"#000", strokeThickness:3
    }).setOrigin(0,1).setScrollFactor(0).setDepth(10000).setVisible(!touchEnabled());

    // === Meldungen als kleine Pergament-Notiz (gleiche Optik wie der Brief) ===
    this.note = makeNote(this, { width: 660 });

    // === NEU: Intro-Overlay (einmalig) ===
    this.introOverlay = this.makeIntroOverlay();
    this.showIntroIfFirstTime(); // zeigt & pausiert ggf.

    // Auf Resize HUD korrekt neu positionieren
    this.scale.on("resize", ()=>{
      this.repositionUIFrame();
      escTxt.setPosition(16, this.scale.height-10);

      // Brief-Overlay anpassen (fester Aufbau, nur Position + Abdunklung)
      if (this.introOverlay){
        this.introOverlay.setPosition(this.scale.width/2, this.scale.height/2);
        if (this.introOverlay._dim){
          this.introOverlay._dim.width  = this.scale.width*2;
          this.introOverlay._dim.height = this.scale.height*2;
        }
      }
    });

    // ------- O₂-Timer -------
    this.time.addEvent({
      delay:1000, loop:true, callback: ()=>{
        if (this.gameOver || this.introOpen) return; // Intro pausiert O2-Verbrauch
        this.oxygen = Math.max(0, this.oxygen-1);
        this.updateUI();
        this.updateO2Visual(); // schwebende Leiste sofort mitziehen
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
      a:"A", d:"D", w:"W", s:"S", e:"E", esc:"ESC", space:"SPACE"
    });

    const toMenu = ()=> this.scene.start("MenuScene");
    this.input.keyboard.on("keydown-ESC", toMenu);
    this.game.events.on("touch-menu", toMenu);
    this.events.once("shutdown", ()=> this.game.events.off("touch-menu", toMenu));

    // Touch-Steuerung (nur auf Handy/Tablet sichtbar)
    startTouch(this);

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

      // kleine HUD-Info + Overlay im L3-Stil
      this.showKeyOverlay(["Mama gibt Dir den Schlüssel für die erste Tür.",
                           "Die erste Tür ist offen!"], "key_gold");
      this.lightUpKey("keyMom");

      this.updateUI();
      return;
    }

    if (id === "dad" && !this.haveDadKey && !gave){
      this.haveDadKey = true;
      npc.setData("gaveKey", true);
      this.openDoor("door2"); // Tür E

      this.showKeyOverlay(["Papa gibt Dir den Schlüssel für die zweite Tür.",
                           "Die zweite Tür ist offen!"], "key_silver");
      this.lightUpKey("keyDad");

      this.updateUI();
      return;
    }
  }

  openDoor(id){
    this.doors.children.iterate(d=>{
      if (d && d.getData("id")===id && d.getData("locked")){
        const x = d.x, y = d.y;
        d.setData("locked", false);
        d.disableBody(true, true);
        const open = this.add.image(x, y, "door_open").setDepth(-4);
        open.setDisplaySize(this.TILE, this.TILE);
        open.setAlpha(0);
        this.tweens.add({ targets: open, alpha: 1, duration: 320, ease: "Quad.easeOut" });
      }
    });
  }

  tryFinish(){
    if (this.haveMomKey && this.haveDadKey){
      this.win();
    } else {
      this.showInfo("Der Ausgang geht erst auf, wenn Du beide Schlüssel hast.");
    }
  }

  // ====== Update / Bewegung ======
  update(time, delta){
    if (!this.player) return;
    this.updateAtmosphere(delta || 16);

    // Intro offen? -> komplett pausieren (außer Animation Idle)
    if (this.introOpen){
      this.player.setAcceleration(0,0);
      if (this.textures.exists("diver")) this.player.play("diver_idle", true);
      return;
    }

    const speed = 300;
    const kx = (this.keys.left.isDown || this.keys.a.isDown ? -1 : 0) +
               (this.keys.right.isDown|| this.keys.d.isDown ?  1 : 0);
    const ky = (this.keys.up.isDown   || this.keys.w.isDown ? -1 : 0) +
               (this.keys.down.isDown || this.keys.s.isDown ?  1 : 0);
    const { x: ix, y: iy } = readAxis(kx, ky);

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

    // O2-Leiste an Spielerposition binden
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
    showNote(this, this.note, msg, { ms: holdMs });
  }


  // ====== Enden / Panels ======
  win(){
    if (this.gameOver) return;
    this.gameOver = true;
    this.physics.world.pause();
    this.player.body.setVelocity(0,0);
    if (this.textures.exists("diver")) this.player.play("diver_idle");
    markLevelDone("Level2");                     // schaltet das nächste Level frei
    const nx = nextLevel("Level2");
    this.showEndPanel("Level geschafft! 🎉",
      nx ? `${levelTitle(nx)} ist jetzt freigeschaltet.` : "");
  }

  fail(msg){
    if (this.gameOver) return;
    this.gameOver = true;
    this.physics.world.pause();
    this.player.body.setVelocity(0,0);
    this.showEndPanel(msg || "Game Over");
  }

  showEndPanel(title, subtitle){
    const W=this.scale.width, H=this.scale.height;
    const dim   = this.add.rectangle(W/2,H/2,W,H,0x000000,0.55).setScrollFactor(0).setDepth(10000);
    const panel = this.add.rectangle(W/2,H/2,680,320,0x071a2b,0.95).setScrollFactor(0).setDepth(10001);
    this.add.text(W/2,H/2-100,title,{ fontFamily:"system-ui", fontSize:"36px", color:"#e6f0ff",
      stroke:"#000", strokeThickness:4 }).setOrigin(0.5).setScrollFactor(0).setDepth(10002);
    if (subtitle){
      this.add.text(W/2,H/2-56,subtitle,{ fontFamily:"system-ui", fontSize:"22px", color:"#a0c8ff",
        stroke:"#000", strokeThickness:3 }).setOrigin(0.5).setScrollFactor(0).setDepth(10002);
    }

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
    // Arcade rechnet Radius und Offset in TEXTUR-Pixeln und multipliziert
    // sie danach mit der Sprite-Skalierung. Vorher wurden Display-Pixel
    // übergeben – dadurch war die Trefferfläche winzig und versetzt, und
    // die Taucherin ist optisch in die Wände geschwommen.
    const p = this.player;
    if (!p.body) return;

    const frameW = (p.frame && p.frame.width)  || p.width;   // 480
    const frameH = (p.frame && p.frame.height) || p.height;
    const scale  = Math.abs(p.scaleX) || 1;

    const R_WORLD = 26;                    // Radius in Weltpixeln (Gang = 88 px)
    const rTex = R_WORLD / scale;

    p.body.setCircle(rTex, frameW/2 - rTex, frameH/2 - rTex);
  }

  // ====== Ausgang: Lichtschacht nach oben statt nur ein Feld ======
  decorateExit(px, py){
    // pulsierender Lichtring
    const ring = this.add.circle(px, py, this.TILE*0.42, 0xaaf0e6, 0)
      .setStrokeStyle(3, 0xd6fbf4, 0.85).setDepth(1);
    this.tweens.add({
      targets: ring, scale: 1.5, alpha: 0, duration: 1900,
      repeat: -1, ease: "sine.out",
      onRepeat: ()=> { ring.setScale(1); ring.setAlpha(1); }
    });

    // zweiter Ring versetzt, damit es wie Wellen wirkt
    const ring2 = this.add.circle(px, py, this.TILE*0.42, 0xaaf0e6, 0)
      .setStrokeStyle(2, 0xd6fbf4, 0.6).setDepth(1);
    this.tweens.add({
      targets: ring2, scale: 1.5, alpha: 0, duration: 1900, delay: 950,
      repeat: -1, ease: "sine.out",
      onRepeat: ()=> { ring2.setScale(1); ring2.setAlpha(0.6); }
    });

    // aufsteigende Blasen
    for (let i = 0; i < 7; i++){
      const bub = this.add.circle(
        px + Phaser.Math.Between(-26, 26), py,
        Phaser.Math.FloatBetween(2, 4.5), 0xffffff, 0.55
      ).setDepth(2);
      this.tweens.add({
        targets: bub,
        y: py - this.TILE*1.5,
        x: bub.x + Phaser.Math.Between(-10, 10),
        alpha: 0,
        duration: Phaser.Math.Between(1800, 3000),
        delay: i * 260,
        repeat: -1,
        onRepeat: ()=> { bub.y = py; bub.setAlpha(0.55); }
      });
    }

    // Schild über dem Ausgang
    const label = this.add.text(px, py - this.TILE*0.78, "↑ Ausgang", {
      fontFamily: "Georgia, serif", fontSize: "17px", color: "#eafffb",
      stroke: "#0a2028", strokeThickness: 4
    }).setOrigin(0.5).setDepth(3);
    this.tweens.add({ targets: label, y: label.y - 5, duration: 1500, yoyo: true, repeat: -1, ease: "sine.inOut" });
  }

  // ====== Stimmung: Lichtschleier + Schwebeteilchen ======
  addAtmosphere(){
    // Lichtflimmern über dem Boden
    if (this.textures.exists("caustics")){
      this.caustics = this.add.tileSprite(0, 0, this.mapW, this.mapH, "caustics")
        .setOrigin(0, 0)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setAlpha(0.10)
        .setDepth(-3);
      this.caustics.setTileScale(0.6, 0.6);
    }

    // langsam aufsteigende Partikel
    this.motes = [];
    for (let i = 0; i < 70; i++){
      const m = this.add.circle(
        Phaser.Math.Between(0, this.mapW),
        Phaser.Math.Between(0, this.mapH),
        Phaser.Math.FloatBetween(1.2, 3.2),
        0xdff3ff,
        Phaser.Math.FloatBetween(0.10, 0.30)
      ).setDepth(2);
      m.speed = Phaser.Math.FloatBetween(5, 16);
      m.drift = Phaser.Math.FloatBetween(-4, 4);
      this.motes.push(m);
    }
  }

  updateAtmosphere(dt){
    if (this.caustics){
      this.caustics.tilePositionX += 0.010 * dt;
      this.caustics.tilePositionY += 0.006 * dt;
    }
    if (!this.motes) return;
    const s = dt / 1000;
    for (const m of this.motes){
      m.y -= m.speed * s;
      m.x += m.drift * s;
      if (m.y < -8){ m.y = this.mapH + 8; m.x = Phaser.Math.Between(0, this.mapW); }
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

    // Schlüssel-Anzeige direkt daneben – unabhängig vom Kamera-Zoom
    const keyMom = this.add.image(barWidth/2 - 12, -16, "key_gold").setOrigin(0.5);
    const keyDad = this.add.image(barWidth/2 + 8,  -16, "key_silver").setOrigin(0.5);
    for (const k of [keyMom, keyDad]){
      k.setDisplaySize(20, 20);
      k.setAlpha(0.22);          // blass, solange nicht eingesammelt
    }

    c.add([bg, border, fill, dot, keyMom, keyDad]);

    // Referenzen merken
    this._o2Float = {
      container: c,
      fill,
      keyMom,
      keyDad,
      barWidth,
      barHeight,
      pad,
      offY
    };

    // initiale Breite/Farbe
    this.updateO2Visual();
  }

  // Schlüssel-Symbol über der Taucherin aufleuchten lassen
  lightUpKey(which){
    const icon = this._o2Float && this._o2Float[which];
    if (!icon) return;
    icon.setAlpha(1);
    this.tweens.add({
      targets: icon, scale: icon.scale * 1.9, duration: 200, yoyo: true, ease: "Back.easeOut"
    });
  }

  updateFloatingO2Bar(){
    if (!this._o2Float || !this.player) return;
    const { container, offY } = this._o2Float;
    container.x = this.player.x;
    container.y = this.player.y + offY;
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

  // ====== Key-Overlay (vom L3-Foto-Overlay abgeleitet) ======


  showKeyOverlay(lines, icon){
    showNote(this, this.note, lines, { icon: icon || null, ms: 1600 });
  }


  // ====== Intro: ein alter Brief (einmalig beim 1. Start) ======
  makeIntroOverlay(){
    const W = this.scale.width, H = this.scale.height;

    const cont = this.add.container(W/2, H/2)
      .setScrollFactor(0)
      .setDepth(25000)
      .setVisible(false)
      .setAlpha(0);

    // Die Kamera zoomt 2x. Der Container rechnet das heraus, damit der
    // Brief genauso groß erscheint wie in einem Level ohne Zoom.
    cont.setScale(1 / (this.cameras.main.zoom || 1));

    const dim = this.add.rectangle(0, 0, W*2, H*2, 0x04141c, 0.72).setOrigin(0.5);

    const panelW = 760, panelH = 520;
    const paper = this.textures.exists("parchment")
      ? this.add.image(0, 0, "parchment").setOrigin(0.5).setDisplaySize(panelW, panelH)
      : this.add.rectangle(0, 0, panelW, panelH, 0xe9dcbf, 1).setOrigin(0.5);
    paper.setAngle(-1.1);                       // leicht schief = handgemacht

    const SERIF = "Georgia, 'Iowan Old Style', 'Times New Roman', serif";
    const INK   = "#3f2d1c";

    const head = this.add.text(-panelW/2 + 64, -panelH/2 + 46, "Liebe Lisa,", {
      fontFamily: SERIF, fontSize: "34px", color: INK, fontStyle: "italic"
    }).setOrigin(0, 0).setAngle(-1.1);

    const brief =
`Du bist tief unten in den alten Limes-Thermen.
Hier steht, was Du wissen musst:

Mama wartet vorne an der Kasse. Sie hat den
Schlüssel für die erste Tür.
Papa sitzt hinten in der Sauna. Bei ihm liegt
der Schlüssel für die zweite Tür.

Der Ausgang geht erst auf, wenn Du beide hast.
Sauerstoff und Schlüssel schweben über Dir.`;

    const txt = this.add.text(-panelW/2 + 64, -panelH/2 + 108, brief, {
      fontFamily: SERIF, fontSize: "21px", color: INK, align: "left",
      lineSpacing: 7, wordWrap: { width: panelW - 150 }
    }).setOrigin(0, 0).setAngle(-1.1);

    const steuerung = touchEnabled()
      ? "Joystick rechts bewegt Dich · „☰ Menü“ unten führt zurück"
      : "Pfeiltasten oder [WASD] bewegen · [ESC] Menü";
    const foot = this.add.text(-panelW/2 + 64, panelH/2 - 96, steuerung, {
      fontFamily: SERIF, fontSize: "17px", color: "#6b5334", fontStyle: "italic"
    }).setOrigin(0, 0).setAngle(-1.1);

    // Siegel unten rechts
    const sealX = panelW/2 - 86, sealY = panelH/2 - 74;
    const seal  = this.add.circle(sealX, sealY, 30, 0x8e2f2c, 1);
    const sealR = this.add.circle(sealX, sealY, 24, 0x000000, 0).setStrokeStyle(2, 0xb75a52, 0.9);
    const sealT = this.add.text(sealX, sealY, "H", {
      fontFamily: SERIF, fontSize: "26px", color: "#f0cfc4"
    }).setOrigin(0.5);

    const hint = this.add.text(0, panelH/2 + 44,
      touchEnabled() ? "Tippe auf den Bildschirm, um zu starten" : "[Leertaste] zum Starten", {
      fontFamily: "system-ui, sans-serif", fontSize: "20px", color: "#cfe9ff"
    }).setOrigin(0.5).setAlpha(0.85);
    this.tweens.add({ targets: hint, alpha: 0.35, duration: 900, yoyo: true, repeat: -1 });

    cont.add([dim, paper, head, txt, foot, seal, sealR, sealT, hint]);
    cont._dim = dim;
    cont._panel = paper;
    cont._text = txt;

    return cont;
  }

  showIntroIfFirstTime(){
    const KEY = "l2_intro_seen_v1";
    let seen = false;
    try { seen = localStorage.getItem(KEY) === "1"; } catch(e){}

    if (seen) { this.introOpen = false; return; }

    // anzeigen + pausieren
    this.introOpen = true;
    this.physics.world.pause();
    if (this.textures.exists("diver")) this.player.play("diver_idle", true);

    const cont = this.introOverlay;
    cont.setVisible(true);
    cont.setAlpha(0);
    cont.setPosition(this.scale.width/2, this.scale.height/2);
    if (cont._dim){ cont._dim.width = this.scale.width*2; cont._dim.height = this.scale.height*2; }

    // Fade in
    this.tweens.add({ targets: cont, alpha: 1, duration: 160, ease: "Quad.easeOut" });

    // Schließen per Leertaste oder Tippen
    this.input.keyboard.once("keydown-SPACE", ()=> this.closeIntro(KEY));
    cont.setInteractive(new Phaser.Geom.Rectangle(-9999,-9999,19999,19999), Phaser.Geom.Rectangle.Contains);

    // Erst nach kurzer Sperrzeit reagieren: Das Loslassen des Fingers vom
    // Menü-Button landet sonst sofort hier und schließt den Brief, bevor
    // man ihn gelesen hat.
    const armedAt = performance.now() + 400;
    const close = ()=> { if (performance.now() >= armedAt) this.closeIntro(KEY); };
    cont.on("pointerdown", close);
    cont.on("pointerup",   close);
  }

  closeIntro(KEY){
    if (this._introClosing || !this.introOpen) return;   // nur einmal
    this._introClosing = true;

    // Sofort weiterspielen – das Ausblenden ist reine Optik und darf
    // auf langsamen Geräten nicht die Steuerung blockieren.
    this.introOpen = false;
    try { localStorage.setItem(KEY, "1"); } catch(e){}
    this.physics.world.resume();

    const cont = this.introOverlay;
    this.tweens.add({
      targets: cont, alpha: 0, duration: 180, ease: "Quad.easeIn",
      onComplete: ()=>{
        cont.setVisible(false);
        this._introClosing = false;
      }
    });
  }
}
