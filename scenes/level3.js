// scenes/level3.js
const Phaser = window.Phaser;
import { readAxis, startTouch, touchEnabled } from "./touch.js";
import { markLevelDone } from "../progress.js";
import { makeNote, showNote } from "./ui.js";

const L3_VERSION = "L3-openworld-2025-09-12-f"; // + Foto-Overlay & robustes Shooting

export default class Level3 extends Phaser.Scene {
  constructor(){ super("Level3"); }

  preload(){
    // Taucher-Spritesheet (480x480 Frames)
    this.load.spritesheet("diver", "assets/sprites/diver_v4_1920x1920.png", {
      frameWidth: 480, frameHeight: 480, endFrame: 15
    });

    // ---- Realistische Hai-PNGs laden ----
    const base = "assets/objects/haie/"; // dein Ordner aus dem Screenshot
    // Dateinamen exakt übernehmen (Groß/Klein/Umlaute)
    this.load.image("shark_great_white", base + "Weißerhai.png");
    this.load.image("shark_hammerhead",  base + "hammerhai.png");
    this.load.image("shark_tiger",       base + "Tiegerhai.png");       // so steht's im Screenshot
    this.load.image("shark_bull",        base + "bullenhai.png");
    this.load.image("shark_thresher",    base + "Fuchshai.png");
    this.load.image("shark_whale",       base + "Walhai.png");
    this.load.image("shark_blacktip",    base + "Schwarzspitzen.png");  // prüf ggf. exakten Namen
    this.load.image("shark_mako",        base + "makohai.png");
    this.load.image("shark_blue",        base + "blauhai.png");
    this.load.image("shark_zebra",       base + "zebrahai.png");
    // >>> NEU: Katzenhaie
    this.load.image("shark_nala", base + "Nala.png"); // Achtung: N groß
    this.load.image("shark_luna", base + "Luna.png"); // Achtung: L groß

    // Logbuch-Optik
    this.load.image("book_icon",       "assets/objects/level3/book_icon.png");
    this.load.image("parchment_wide",  "assets/objects/level3/parchment_wide.png");
    this.load.image("parchment",       "assets/objects/level2/parchment.png");

    // >>> NEU: Geschenk-Assets (deine Pfade & Namen)
    this.load.image("gift_icon",   "assets/objects/Gift.png");
    this.load.image("gift_reward", "assets/objects/Opfer.jpg");   // der Gag
    this.load.image("gift_lamp",   "assets/objects/level3/lampe.png");  // das echte Geschenk
  }

  create(){
    console.log("[Level3] geladen:", L3_VERSION);

    this.introKey = "l3_intro_seen_v1";
    this.giftKey  = "l3_gift_shown_v1"; // Einmal-Pro-Gerät für Geschenk-Overlay

    // --- Welt & Kamera ---
    this.WORLD_W = 5000;
    this.WORLD_H = 3800;
    this.physics.world.setBounds(0, 0, this.WORLD_W, this.WORLD_H);

    // === Prozeduraler Wasser-Background (TileSprites) ===
    this.makeSeamlessDotsTexture("water_tile_1", 256, {
      bg: 0x07263a, dotColor: 0x0e4163, dotAlpha: 0.10, dotCount: 240, dotMin: 1, dotMax: 2
    });
    this.makeSeamlessBlobsTexture("water_caustics", 256, {
      blobColor: 0xaad4ff, blobAlpha: 0.06, blobCount: 90, minR: 22, maxR: 72
    });

    this.bgBase = this.add.tileSprite(this.WORLD_W/2, this.WORLD_H/2, this.WORLD_W, this.WORLD_H, "water_tile_1").setDepth(-60);
    this.bgCaustics = this.add.tileSprite(this.WORLD_W/2, this.WORLD_H/2, this.WORLD_W, this.WORLD_H, "water_caustics").setDepth(-59).setAlpha(0.8);
    this.bgDust = this.add.tileSprite(this.WORLD_W/2, this.WORLD_H/2, this.WORLD_W, this.WORLD_H, "water_tile_1").setDepth(-58).setAlpha(0.25);

    // --- Artenliste (mit Texture-Key) + Fallback-Kreise erzeugen ---
    this.SPECIES = [
      { id:"great_white", name:"Weißer Hai",     color:0xcfd6d6, tex:"shark_great_white" },
      { id:"hammerhead",  name:"Hammerhai",      color:0xbdd7ff, tex:"shark_hammerhead"  },
      { id:"tiger",       name:"Tigerhai",       color:0xc8a26d, tex:"shark_tiger"       },
      { id:"bull",        name:"Bullenhai",      color:0xb4b4b4, tex:"shark_bull"        },
      { id:"thresher",    name:"Fuchshai",       color:0x9ac7ff, tex:"shark_thresher"    },
      { id:"whale",       name:"Walhai",         color:0x6fb2ff, tex:"shark_whale"       },
      { id:"blacktip",    name:"Schwarzspitzen", color:0x9fd1bf, tex:"shark_blacktip"    },
      { id:"mako",        name:"Makohai",        color:0x8fb8ff, tex:"shark_mako"        },
      { id:"blue",        name:"Blauhai",        color:0x6aa6ff, tex:"shark_blue"        },
      { id:"zebra",       name:"Zebrahai",       color:0xe6d18f, tex:"shark_zebra"       },
      { id:"nala", name:"Nala", color:0xb7c9ff, tex:"shark_nala" }, // Farbe nur Fallback
      { id:"luna", name:"Luna", color:0xffc4f5, tex:"shark_luna" },
    ];
    for (const s of this.SPECIES) this.ensureBigDotTexture("dot_big_"+s.id, s.color, 120);

    // --- Lokaler Fortschritt (Logbuch) ---
    this.dexKey = "l3_sharkdex_v1";
    this.dex = this.loadDex(); // { caught: {id:true,...} }

    // --- Spieler (Taucher) ---
    const startX = this.WORLD_W*0.5, startY = this.WORLD_H*0.5;
    this.player = this.physics.add.sprite(startX, startY, "diver", 0).setScale(0.24);
    this.player.setCollideWorldBounds(true);
    this.player.setDrag(600,600);
    this.player.setMaxVelocity(360,360);
    this.makeDiverAnimations();
    this.player.play("diver_idle");

    this.cameras.main.setBounds(0,0,this.WORLD_W,this.WORLD_H);
    this.cameras.main.setZoom(1.25);
    this.cameras.main.startFollow(this.player, true, 0.12, 0.12);
    this.cameras.main.setRoundPixels(true);

    // --- Steuerung ---
    this.keys = this.input.keyboard.addKeys({
      left:"LEFT", right:"RIGHT", up:"UP", down:"DOWN",
      a:"A", d:"D", w:"W", s:"S",
      space:"SPACE", p:"P", b:"B", esc:"ESC"
    });
    const toMenu = ()=> this.scene.start("MenuScene");
    this.input.keyboard.on("keydown-ESC", toMenu);
    this.input.keyboard.addCapture(['SPACE', 'P']); // <-- wichtig

    // --- Bedienung: Joystick, Foto-Knopf und Logbuch ---
    const onTouchAction = ()=> this.takePhoto();
    const onTouchBook   = ()=> this.toggleBook();
    this.game.events.on("touch-menu", toMenu);
    this.game.events.on("touch-action", onTouchAction);
    this.game.events.on("touch-book", onTouchBook);
    this.events.once("shutdown", ()=>{
      this.game.events.off("touch-menu", toMenu);
      this.game.events.off("touch-action", onTouchAction);
      this.game.events.off("touch-book", onTouchBook);
      // falls das Geschenk noch offen war: Knöpfe wieder sichtbar machen
      const ts = this.scene.get("TouchScene");
      if (ts) ts.scene.setVisible(true);
    });
    startTouch(this, { action:true, label:"📷", book:true });

    // --- Haie spawnen: weniger, aber mind. 1 pro Art ---
    this.sharks = this.physics.add.group();

    // Anzahl: 1–2 pro Art (mindestens einer)
    for (const s of this.SPECIES){
      const count = Phaser.Math.Between(1, 2); // min=1, max=2
      for (let i = 0; i < count; i++) {
        // Größere Suchfläche (keine 200px Ränder mehr, nur kleine Polster)
        const x = 80 + Math.random()*(this.WORLD_W - 160);
        const y = 80 + Math.random()*(this.WORLD_H - 160);

        const texKey = this.textures.exists(s.tex) ? s.tex : ("dot_big_" + s.id);
        const spr = this.createSharkSprite(x, y, texKey);

        this.sharks.add(spr);

        spr.setData("id", s.id);
        spr.setData("name", s.name);
        spr.setData("color", s.color);

        this.assignRandomVelocity(spr, Phaser.Math.Between(50, 100));
        this.scheduleWander(spr, 1800, 3200); // größere Pausen, weniger wuselig
      }
    }

    this.physics.add.collider(this.player, this.sharks);

    // --- Foto-Frame an Spieler koppeln ---
    this.frameW = 320;
    this.frameH = 200;
    this.frameOffset = 160;
    this.dir = new Phaser.Math.Vector2(-1, 0); // Start: Blick nach links

    this.photoFrame = this.add.rectangle(this.player.x, this.player.y, this.frameW, this.frameH)
      .setStrokeStyle(3, 0xaad4ff, 0.9)
      .setAlpha(0.9)
      .setDepth(1000); // Weltobjekt

    this.photoDot = this.add.circle(this.player.x, this.player.y, 2, 0xaad4ff, 0.9)
      .setDepth(1001);

    // Blitz-Overlay (HUD)
    this.flash = this.add.rectangle(this.scale.width/2, this.scale.height/2, this.scale.width*2, this.scale.height*2, 0xffffff, 0)
      .setScrollFactor(0).setDepth(1200);

    // Foto-Input (Event; Fallback via update())
    this.lastShotAt = 0;
    const shoot = ()=> this.takePhoto();
    this.input.keyboard.on("keydown-SPACE", shoot);
    this.input.keyboard.on("keydown-P", shoot);

    // --- Anzeige (zoomfest) ---
    // Die Kamera zoomt hier 1.25x. Ein Element mit scrollFactor 0 wandert
    // dadurch aus dem Bild – genau deshalb waren Zähler und Logbuch vorher
    // unsichtbar. Alles Feste sitzt jetzt in einem Container, der den Zoom
    // herausrechnet; Kinder werden relativ zur Bildmitte platziert.
    const Wd = this.scale.width, Hd = this.scale.height;
    this.uiRoot = this.add.container(Wd/2, Hd/2)
      .setScrollFactor(0)
      .setScale(1 / (this.cameras.main.zoom || 1))
      .setDepth(9000);
    this.ui = (x, y) => ({ x: x - Wd/2, y: y - Hd/2 });   // Bildschirm → Container

    // Für anklickbare Elemente: die bleiben direkte Szenen-Kinder (in einem
    // skalierten Container greift die Klickfläche nicht zuverlässig) und
    // werden stattdessen umgerechnet platziert.
    this.fixedPos = (sx, sy) => {
      const z = this.cameras.main.zoom || 1;
      return { x: Wd/2 + (sx - Wd/2)/z, y: Hd/2 + (sy - Hd/2)/z };
    };

    const hudPos = this.ui(28, 26);
    this.hud = this.add.text(hudPos.x, hudPos.y, "", {
      fontFamily:"system-ui, sans-serif", fontSize:"22px", color:"#e6f0ff", stroke:"#000", strokeThickness:4
    });
    this.uiRoot.add(this.hud);
    this.updateHud();

    // --- Meldungen als Pergament-Notiz (gleiche Optik wie Brief & Logbuch) ---
    this.note = makeNote(this, { width: 700 });

    // Das Logbuch-Symbol liegt in der Bedien-Ebene (TouchScene) –
    // dort stimmen Klickfläche und Symbol überein.

    this.bookOpen = false;
    this.bookLayer = this.makeBookLayer();
    this.bookLayer.setVisible(false);
    this.bookLayer.setDepth(9500);

    // Resize
    this.scale.on("resize", () => this.repositionUI());


    const introAlreadySeen = localStorage.getItem(this.introKey) === "1";
    if (!introAlreadySeen) {
      this.introOverlay = this.makeIntroOverlay();
      this.introOverlay.setVisible(true).setAlpha(1);

      // Steuerung blockieren solange das Intro offen ist
      this.bookOpen = true;
      this.physics.world.pause();
      this.player.setVelocity(0,0);

      // Schließen mit [SPACE] oder Tippen
      const closeIntro = () => {
        if (!this.introOverlay || !this.introOverlay.visible) return;
        this.introOverlay.setVisible(false);
        this.bookOpen = false;
        this.physics.world.resume();

        // >>> Flag dauerhaft setzen
        try { localStorage.setItem(this.introKey, "1"); } catch(e) {}
      };
      this.input.keyboard.once("keydown-SPACE", closeIntro);
      // Tippen schließt ebenfalls. Kurze Sperrzeit, damit das Loslassen
      // des Fingers vom Menü-Button den Text nicht sofort wegklickt.
      this.introOverlay.setInteractive(
        new Phaser.Geom.Rectangle(-9999,-9999,19999,19999), Phaser.Geom.Rectangle.Contains
      );
      const armedAt = performance.now() + 400;
      const tapClose = ()=> { if (performance.now() >= armedAt) closeIntro(); };
      this.introOverlay.on("pointerdown", tapClose);
      this.introOverlay.on("pointerup",   tapClose);
    }

    // >>> NEU: Geschenk-Overlay vorbereiten
    this.giftOverlay = this.makeGiftOverlay(); // unsichtbar init
    this.rewardLayer = null; // wird beim ersten Öffnen gebaut

    // Falls Save schon komplett ist und Geschenk noch nicht gezeigt wurde
    this.checkCompletionOnce();
  }

  // ================= Update =================
  update(){
    if (this.bookOpen) {
      this.player.setAcceleration(0,0);
      if (this.anims.exists("diver_idle")) this.player.play("diver_idle", true);
      return;
    }

    const speed = 300;
    const k = this.keys;
    const kx = (k.left.isDown || k.a.isDown ? -1 : 0) + (k.right.isDown || k.d.isDown ? 1 : 0);
    const ky = (k.up.isDown   || k.w.isDown ? -1 : 0) + (k.down.isDown || k.s.isDown ? 1 : 0);
    const { x: ix, y: iy } = readAxis(kx, ky);
    const moving = (ix !== 0 || iy !== 0);

    if (moving){
      this.player.setAcceleration(ix*speed*2, iy*speed*2);
      if (this.anims.exists("diver_swim")) this.player.play("diver_swim", true);

      // Orientierung für die Spielerfigur
      if (Math.abs(ix) >= Math.abs(iy)) {
        this.player.setRotation(0);
        this.player.setFlipX(ix > 0);
      } else {
        this.player.setFlipX(false);
        this.player.setRotation(iy < 0 ? Math.PI/2 : -Math.PI/2);
      }
    } else {
      this.player.setAcceleration(0,0);
      if (this.anims.exists("diver_idle")) this.player.play("diver_idle", true);
    }

    // Parallax / Drift
    if (this.bgBase && this.bgCaustics && this.bgDust){
      const cam = this.cameras.main;
      this.bgBase.tilePositionX = cam.scrollX * 0.08;
      this.bgBase.tilePositionY = cam.scrollY * 0.06;
      this.bgCaustics.tilePositionX += 0.12;
      this.bgCaustics.tilePositionY += 0.07;
      const t = this.time.now || performance.now();
      this.bgDust.tilePositionX = cam.scrollX * 0.10 + t * 0.0006;
      this.bgDust.tilePositionY = cam.scrollY * 0.09 + t * 0.0004;
    }

    // Richtung für den Frame (4 Hauptachsen)
    if (moving){
      if (Math.abs(ix) >= Math.abs(iy)) {
        this.dir.set(Math.sign(ix) || this.dir.x, 0);
      } else {
        this.dir.set(0, Math.sign(iy) || this.dir.y);
      }
    }
    // Zielposition: ein Stück vor der Taucherin
    const tx = this.player.x + this.dir.x * this.frameOffset;
    const ty = this.player.y + this.dir.y * this.frameOffset;
    // weich nachführen
    this.photoFrame.x += (tx - this.photoFrame.x) * 0.25;
    this.photoFrame.y += (ty - this.photoFrame.y) * 0.25;
    if (this.photoDot) this.photoDot.setPosition(this.photoFrame.x, this.photoFrame.y);

    // Fallback: Foto über Polling + Cooldown (falls Keydown-Event nicht triggert)
    const now = this.time.now || performance.now();
    if ((this.keys.space.isDown || this.keys.p.isDown) && (now - this.lastShotAt > 500)) {
      this.takePhoto();
    }
  }

  getPhotoRect(){
    // Weltkoordinaten des Fotofensters
    return new Phaser.Geom.Rectangle(
      this.photoFrame.x - this.frameW/2,
      this.photoFrame.y - this.frameH/2,
      this.frameW,
      this.frameH
    );
  }

  // ================= Foto-Logik =================
  takePhoto(){
    // Kein Foto, solange Logbuch/Intro/Geschenk offen ist
    if (this.bookOpen || this.gameOver) return;

    const now = this.time.now || performance.now();
    if (now - this.lastShotAt < 500) return; // kurzer Cooldown
    this.lastShotAt = now;

    // Blitz (HUD)
    this.flash.setAlpha(0.8);
    this.tweens.add({ targets:this.flash, alpha:0, duration:160, ease:"Quad.easeOut" });

    // Rechteck des Foto-Frames
    const photoRect = this.getPhotoRect();

    // Alle Haie, deren sichtbare Bounds das Foto-Rechteck schneiden
    const inFrame = [];
    const sharks = this.sharks.getChildren(); // zuverlässiger als children.iterate
    for (let i=0;i<sharks.length;i++){
      const s = sharks[i];
      if (!s || !s.active || !s.visible) continue;
      // getBounds berücksichtigt Scale/Flip und benutzt Weltkoordinaten
      const sb = s.getBounds();
      if (Phaser.Geom.Rectangle.Overlaps(photoRect, sb)) {
        inFrame.push(s);
      }
    }

    if (inFrame.length === 0){
      this.showPhotoOverlay(["Kein Hai im Bild."]);
      return;
    }

    // Pro Art nur einmal zählen (falls mehrere gleiche im Frame sind)
    const seen = new Set();
    const newCaught = [];
    const already   = [];
    let iconKey = null;                 // Bild für die Meldung
    for (const s of inFrame){
      const id = s.getData("id");
      if (seen.has(id)) continue;
      seen.add(id);
      const name = s.getData("name");
      const tex  = s.texture && s.texture.key;
      if (!this.dex.caught[id]) {
        this.dex.caught[id] = true;
        newCaught.push(name);
        if (!iconKey || newCaught.length === 1) iconKey = tex;
      } else {
        already.push(name);
        if (!iconKey) iconKey = tex;
      }
    }

    // Fortschritt speichern/anzeigen
    if (newCaught.length > 0){
      this.saveDex();
      this.updateHud();
      this.pulseBookButton();          // Buch oben rechts kurz hüpfen lassen
      if (this.bookOpen) this.refreshBook();
    }

    // Meldung als Pergament-Notiz
    const msgs = [];
    for (const n of newCaught) msgs.push(`Neu im Logbuch: ${n}`);
    if (newCaught.length === 0){
      for (const n of already) msgs.push(`${n} — den hast du schon.`);
      if (already.length === 0){ msgs.push("Kein Hai im Bild."); iconKey = null; }
    }
    this.showPhotoOverlay(msgs, iconKey);

    // >>> NEU: prüfen, ob jetzt alles komplett ist
    this.checkCompletionOnce();
  }

  // ================= UI / HUD =================
  updateHud(){
    const total = this.SPECIES.length;
    let have = 0; for (const s of this.SPECIES) if (this.dex.caught[s.id]) have++;
    const hint = touchEnabled() ? "" : "   [SPACE] Foto   [B] Logbuch   [ESC] Menü";
    this.hud.setText(`Haie: ${have} / ${total}${hint}`);
  }





  // Hinweis am Logbuch-Symbol, wenn eine neue Art dazukommt
  pulseBookButton(){
    const t = this.scene.get("TouchScene");
    if (t && t.scene.isActive() && t.pulseBook) t.pulseBook();
  }

  makeBookLayer(){
    const W = this.scale.width, H = this.scale.height;
    const layer = this.add.container(W/2, H/2)
      .setScrollFactor(0)
      .setScale(1 / (this.cameras.main.zoom || 1));   // Kamera-Zoom herausrechnen

    const dim = this.add.rectangle(0, 0, W*2, H*2, 0x04141c, 0.72).setInteractive();

    const panelW = 980, panelH = 660;
    const paper = this.textures.exists("parchment_wide")
      ? this.add.image(0, 0, "parchment_wide").setOrigin(0.5).setDisplaySize(panelW, panelH)
      : this.add.rectangle(0, 0, panelW, panelH, 0xe9dcbf, 1).setOrigin(0.5);

    const SERIF = "Georgia, 'Iowan Old Style', 'Times New Roman', serif";
    const title = this.add.text(0, -panelH/2 + 34, "Hai-Logbuch", {
      fontFamily: SERIF, fontSize: "36px", color: "#3f2d1c", fontStyle: "italic"
    }).setOrigin(0.5, 0);

    // Trennlinie unter dem Titel
    const rule = this.add.rectangle(0, -panelH/2 + 92, panelW - 150, 2, 0x8a7350, 0.6).setOrigin(0.5);

    // Schließen-Knopf oben rechts auf dem Papier
    const closeBtn = this.add.circle(panelW/2 - 46, -panelH/2 + 46, 22, 0x8e2f2c, 1)
      .setInteractive({ useHandCursor: true });
    const closeTxt = this.add.text(closeBtn.x, closeBtn.y, "✕", {
      fontFamily: SERIF, fontSize: "22px", color: "#f4ddd6"
    }).setOrigin(0.5);
    closeBtn.on("pointerdown", ()=> this.toggleBook());

    const list = this.add.container(-panelW/2, -panelH/2);

    layer.add([dim, paper, title, rule, closeBtn, closeTxt, list]);

    // Tippen schließt – große Fläche, damit der Kamera-Zoom keine Rolle spielt
    layer.setInteractive(new Phaser.Geom.Rectangle(-9999,-9999,19999,19999),
                         Phaser.Geom.Rectangle.Contains);
    layer.on("pointerdown", ()=> { if (this.bookOpen) this.toggleBook(); });
    layer._panelW = panelW;
    layer._panelH = panelH;
    layer._list = list;

    this.buildBookList(layer);
    return layer;
  }

  buildBookList(layer){
    const list = layer._list;
    list.removeAll(true);

    const SERIF = "Georgia, 'Iowan Old Style', 'Times New Roman', serif";
    const INK   = "#3f2d1c";
    const FADED = "#8d7a5c";

    const total = this.SPECIES.length;
    let have = 0; for (const s of this.SPECIES) if (this.dex.caught[s.id]) have++;

    const panelW = layer._panelW, panelH = layer._panelH;

    // Fortschritt unter der Trennlinie
    const prog = this.add.text(panelW/2, 108,
      have >= total ? `Alle ${total} Arten gefunden!` : `${have} von ${total} Arten fotografiert`, {
        fontFamily: SERIF, fontSize: "22px", color: have >= total ? "#7a5a1c" : FADED, fontStyle: "italic"
      }).setOrigin(0.5, 0);
    list.add(prog);

    // Zwei Spalten, sechs Zeilen
    const cols = 2, rows = Math.ceil(total / cols);
    const marginX = 70, topY = 156;
    const colW = (panelW - marginX*2) / cols;
    const rowH = 76;
    const thumbH = 54;

    let idx = 0;
    for (const s of this.SPECIES){
      const caught = !!this.dex.caught[s.id];
      const col = idx % cols, row = Math.floor(idx / cols);
      const x0 = marginX + col*colW;
      const y0 = topY + row*rowH;

      // dezente Linie wie in einem echten Logbuch
      list.add(this.add.rectangle(x0, y0 + thumbH*0.72, colW - 34, 1, 0x8a7350, 0.35).setOrigin(0, 0.5));

      if (this.textures.exists(s.tex)){
        const img = this.add.image(x0 + 6, y0 + 18, s.tex).setOrigin(0, 0.5);
        const src = this.textures.get(s.tex).getSourceImage();
        const sc = (src && src.height) ? (thumbH / src.height) : 1;
        img.setScale(sc);
        if (!caught){ img.setTint(0x2b2418); img.setAlpha(0.28); }   // noch unbekannt
        list.add(img);
      }

      const name = this.add.text(x0 + 110, y0 + 2, caught ? s.name : "? ? ?", {
        fontFamily: SERIF, fontSize: "24px", color: caught ? INK : FADED
      });
      list.add(name);

      const status = this.add.text(x0 + colW - 52, y0 + 2, caught ? "✓" : "–", {
        fontFamily: SERIF, fontSize: "24px", color: caught ? "#2f6b3a" : FADED
      });
      list.add(status);

      idx++;
    }

    // Hinweis unten
    const foot = this.add.text(panelW/2, panelH - 46,
      "Tippe irgendwo, um das Logbuch zu schließen.", {
        fontFamily: SERIF, fontSize: "18px", color: FADED, fontStyle: "italic"
      }).setOrigin(0.5);
    list.add(foot);
  }

  toggleBook(){
    const willOpen = !this.bookOpen;
    this.bookOpen = willOpen;

    // Sichtbarkeit umschalten
    this.bookLayer.setVisible(willOpen);

    // >>> NEU: Beim Öffnen Liste neu aufbauen
    if (willOpen) this.refreshBook();

    // Physik pausieren/fortsetzen & Spieler stoppen
    this.physics.world[willOpen ? "pause" : "resume"]();
    this.player.setVelocity(0,0);
  }

  refreshBook(){
    if (this.bookLayer) this.buildBookList(this.bookLayer);
  }

  repositionUI(){
    // Die feste Anzeige sitzt in uiRoot und richtet sich nach der
    // Design-Größe – die ändert sich bei Scale.FIT nicht. Hier müssen
    // nur die mittigen Overlays nachgeführt werden.
    if (this.uiRoot) this.uiRoot.setPosition(this.scale.width/2, this.scale.height/2);
    if (this.bookLayer) this.bookLayer.setPosition(this.scale.width/2, this.scale.height/2);

    // Intro-Overlay (falls offen)
    if (this.introOverlay){
      this.introOverlay.setPosition(this.scale.width/2, this.scale.height/2);
      if (this.introOverlay._dim){
        this.introOverlay._dim.width  = this.scale.width*2;
        this.introOverlay._dim.height = this.scale.height*2;
      }
    }

    // >>> NEU: Geschenk-Overlay
    if (this.giftOverlay){
      this.giftOverlay.setPosition(this.scale.width/2, this.scale.height/2);
      if (this.giftOverlay._dim){
        this.giftOverlay._dim.width  = this.scale.width*2;
        this.giftOverlay._dim.height = this.scale.height*2;
      }
    }

    // >>> NEU: Reward-Layer (Vollbild)
    if (this.rewardLayer){
      this.rewardLayer.setPosition(this.scale.width/2, this.scale.height/2);
      if (this.rewardLayer._dim){
        this.rewardLayer._dim.width  = this.scale.width*2;
        this.rewardLayer._dim.height = this.scale.height*2;
      }
    }
  }

  // ================= Utils =================
  makeDiverAnimations(){
    if (!this.anims.exists("diver_swim")){
      this.anims.create({ key:"diver_swim", frames:this.anims.generateFrameNumbers("diver",{start:0,end:15}), frameRate:10, repeat:-1 });
      this.anims.create({ key:"diver_idle", frames:this.anims.generateFrameNumbers("diver",{start:0,end:1}), frameRate:2, repeat:-1 });
    }
  }

  ensureBigDotTexture(key, color, size){
    if (this.textures.exists(key)) return;
    const r = Math.floor(size/2);
    const g = this.add.graphics();
    g.fillStyle(color, 1);
    g.fillCircle(r, r, r);
    g.lineStyle(4, 0x000000, 0.25).strokeCircle(r, r, r);
    g.generateTexture(key, size, size);
    g.destroy();
  }

  // === WICHTIG: PNG-Shark-Sprite erzeugen (Skalierung + Hitbox) ===
  createSharkSprite(x, y, key){
    const spr = this.physics.add.sprite(x, y, key);
    const tex = this.textures.get(key);
    const img = tex && tex.getSourceImage ? tex.getSourceImage() : null; // <-- typo? keep user's pattern
    const targetH = 115;
    const scale = (img && img.height) ? (targetH / img.height) : 1;
    spr.setScale(scale);

    if (key.startsWith("shark_") && img){
      spr.body.setSize(img.width * 0.55 * scale, img.height * 0.45 * scale, true);
    } else {
      spr.body.setCircle(50 * scale, 10 * scale, 10 * scale);
    }
    return spr;
  }

  assignRandomVelocity(spr, speed){
    const ang = Math.random()*Math.PI*2;
    spr.setVelocity(Math.cos(ang)*speed, Math.sin(ang)*speed);
  }

  scheduleWander(spr, minMs, maxMs){
    const t = Phaser.Math.Between(minMs, maxMs);
    this.time.delayedCall(t, ()=>{
      if (!spr.body) return;
      this.assignRandomVelocity(spr, Phaser.Math.Between(40, 90));
      this.scheduleWander(spr, minMs, maxMs);
    });
  }

  loadDex(){
    try {
      const raw = localStorage.getItem(this.dexKey);
      if (raw){ const obj = JSON.parse(raw); if (obj && obj.caught) return { caught: obj.caught }; }
    } catch(e){ console.warn("Dex laden fehlgeschlagen:", e); }
    return { caught:{} };
  }

  saveDex(){
    try { localStorage.setItem(this.dexKey, JSON.stringify({ caught: this.dex.caught })); }
    catch(e){ console.warn("Dex speichern fehlgeschlagen:", e); }
  }

  // ===== Tile-Generatoren: nahtlose Wasser-Texturen =====
  makeSeamlessDotsTexture(key, size, opts = {}){
    if (this.textures.exists(key)) return;

    const {
      bg = 0x07263a,
      dotColor = 0x0e4163,
      dotAlpha = 0.10,
      dotCount = 220,
      dotMin = 1,
      dotMax = 2
    } = opts;

    const tex = this.textures.createCanvas(key, size, size);
    const ctx = tex.getContext();

    ctx.fillStyle = `#${bg.toString(16).padStart(6,"0")}`;
    ctx.fillRect(0,0,size,size);

    const rgba = (hex, a=1)=> `rgba(${(hex>>16)&255},${(hex>>8)&255},${hex&255},${a})`;

    ctx.fillStyle = rgba(dotColor, dotAlpha);
    for (let i=0;i<dotCount;i++){
      const x = Math.random()*size, y = Math.random()*size;
      const r = dotMin + Math.random()*(dotMax-dotMin);
      for (const dx of [-size,0,size]) for (const dy of [-size,0,size]){
        ctx.beginPath(); ctx.arc(x+dx, y+dy, r, 0, Math.PI*2); ctx.fill();
      }
    }

    ctx.globalAlpha = 0.35;
    ctx.drawImage(tex.getSourceImage(), -1, 0);
    ctx.drawImage(tex.getSourceImage(),  1, 0);
    ctx.drawImage(tex.getSourceImage(),  0,-1);
    ctx.drawImage(tex.getSourceImage(),  0, 1);
    ctx.globalAlpha = 1;

    tex.refresh();
  }

  makeSeamlessBlobsTexture(key, size, opts = {}){
    if (this.textures.exists(key)) return;

    const {
      blobColor = 0x1a5b86,
      blobAlpha = 0.08,
      blobCount = 70,
      minR = 16,
      maxR = 60
    } = opts;

    const tex = this.textures.createCanvas(key, size, size);
    const ctx = tex.getContext();
    const rgba = (hex, a=1)=> `rgba(${(hex>>16)&255},${(hex>>8)&255},${hex&255},${a})`;

    ctx.clearRect(0,0,size,size);

    for (let i=0;i<blobCount;i++){
      const x = Math.random()*size, y = Math.random()*size;
      const r = minR + Math.random()*(maxR-minR);

      const drawBlob = (bx,by)=>{
        const grad = ctx.createRadialGradient(bx,by, r*0.2, bx,by, r);
        grad.addColorStop(0, rgba(blobColor, blobAlpha));
        grad.addColorStop(1, rgba(blobColor, 0));
        ctx.fillStyle = grad;
        ctx.beginPath(); ctx.arc(bx, by, r, 0, Math.PI*2); ctx.fill();
      };

      for (const dx of [-size,0,size]) for (const dy of [-size,0,size]) drawBlob(x+dx,y+dy);
    }

    ctx.globalAlpha = 0.06; ctx.fillStyle = rgba(0xffffff, 1);
    for (let i=0;i<40;i++){
      const x = Math.random()*size, y = Math.random()*size;
      const w = 20+Math.random()*60, h = 2+Math.random()*3;
      for (const dx of [-size,0,size]) for (const dy of [-size,0,size]) ctx.fillRect(x+dx, y+dy, w, h);
    }
    ctx.globalAlpha = 1;

    tex.refresh();
  }

  // ===== Zentrales Foto-Overlay (dim + Panel) =====


  makeIntroOverlay(){
    const W = this.scale.width, H = this.scale.height;

    const cont = this.add.container(W/2, H/2)
      .setScrollFactor(0)
      .setDepth(25000)
      .setVisible(false)
      .setAlpha(0)
      .setScale(1 / (this.cameras.main.zoom || 1));   // Kamera-Zoom herausrechnen

    const dim = this.add.rectangle(0, 0, W*2, H*2, 0x04141c, 0.72).setOrigin(0.5);

    // Gleiche Optik wie der Brief in Level 2
    const panelW = 760, panelH = 520;
    const paper = this.textures.exists("parchment")
      ? this.add.image(0, 0, "parchment").setOrigin(0.5).setDisplaySize(panelW, panelH)
      : this.add.rectangle(0, 0, panelW, panelH, 0xe9dcbf, 1).setOrigin(0.5);
    paper.setAngle(-1.1);

    const SERIF = "Georgia, 'Iowan Old Style', 'Times New Roman', serif";
    const INK   = "#3f2d1c";

    const head = this.add.text(-panelW/2 + 64, -panelH/2 + 46, "Liebe Lisa,", {
      fontFamily: SERIF, fontSize: "34px", color: INK, fontStyle: "italic"
    }).setOrigin(0, 0).setAngle(-1.1);

    const brief =
`hier draußen brauchst Du keinen Käfig – Deine Kamera reicht.

Finde alle zwölf Haiarten und fotografiere sie. Zwei davon
kennst Du längst: Nala und Luna.

${touchEnabled()
  ? "Schwimm mit dem Joystick rechts, halte die Kamera auf einen\nHai und drück den 📷-Knopf links."
  : "Steuere mit [WASD] oder den Pfeiltasten und drück\ndie [Leertaste], um ein Foto zu machen."}

Oben rechts liegt Dein Logbuch. Dort siehst Du, wer Dir fehlt –
und wenn es voll ist, wartet Deine Überraschung.`;

    const txt = this.add.text(-panelW/2 + 64, -panelH/2 + 112, brief, {
      fontFamily: SERIF, fontSize: "21px", color: INK, align: "left",
      lineSpacing: 7, wordWrap: { width: panelW - 150 }
    }).setOrigin(0, 0).setAngle(-1.1);

    // Siegel unten rechts
    const sealX = panelW/2 - 86, sealY = panelH/2 - 74;
    const seal  = this.add.circle(sealX, sealY, 30, 0x8e2f2c, 1);
    const sealR = this.add.circle(sealX, sealY, 24, 0x000000, 0).setStrokeStyle(2, 0xb75a52, 0.9);
    const sealT = this.add.text(sealX, sealY, "H", {
      fontFamily: SERIF, fontSize: "26px", color: "#f0cfc4"
    }).setOrigin(0.5);

    const hint = this.add.text(0, panelH/2 + 44,
      touchEnabled() ? "Tippe auf den Bildschirm, um loszutauchen" : "[Leertaste] zum Starten", {
      fontFamily: "system-ui, sans-serif", fontSize: "20px", color: "#cfe9ff"
    }).setOrigin(0.5).setAlpha(0.85);
    this.tweens.add({ targets: hint, alpha: 0.35, duration: 900, yoyo: true, repeat: -1 });

    cont.add([dim, paper, head, txt, seal, sealR, sealT, hint]);
    cont.setAlpha(1);
    cont._dim = dim;      // für Resize
    cont._panel = paper;
    return cont;
  }

  showPhotoOverlay(lines, icon){
    showNote(this, this.note, lines, { icon: icon || null, ms: 1500 });
  }


  // ======= NEU: Spielabschluss + Geschenk =======
  checkCompletionOnce(){
    const total = this.SPECIES.length;
    let have = 0;
    for (const s of this.SPECIES) if (this.dex.caught[s.id]) have++;

    if (have < total) return;

    // Level gilt als geschafft, sobald das Logbuch voll ist
    markLevelDone("Level3");

    // Geschenk nur einmal automatisch aufpoppen lassen
    if (localStorage.getItem(this.giftKey) === "1") return;
    try { localStorage.setItem(this.giftKey, "1"); } catch(e){}
    this.showGiftOverlay();
  }

  showGiftOverlay(){
    if (!this.giftOverlay) this.giftOverlay = this.makeGiftOverlay();
    this.giftOverlay.setVisible(true).setAlpha(0);
    this.tweens.add({ targets:this.giftOverlay, alpha:1, duration:180, ease:"Quad.easeOut" });

    // Steuerung blockieren
    this.bookOpen = true;
    this.physics.world.pause();
    this.player.setVelocity(0,0);
  }

  makeGiftOverlay(){
    const W = this.scale.width, H = this.scale.height;
    const cont = this.add.container(W/2, H/2)
      .setScrollFactor(0)
      .setDepth(26000)
      .setVisible(false)
      .setAlpha(0)
      .setScale(1 / (this.cameras.main.zoom || 1));

    const dim = this.add.rectangle(0,0, W*2,H*2, 0x04141c, 0.78).setOrigin(0.5);

    const panelW = 720, panelH = 470;
    const paper = this.textures.exists("parchment")
      ? this.add.image(0, 0, "parchment").setOrigin(0.5).setDisplaySize(panelW, panelH)
      : this.add.rectangle(0, 0, panelW, panelH, 0xe9dcbf, 1).setOrigin(0.5);
    paper.setAngle(-1.1);

    const SERIF = "Georgia, 'Iowan Old Style', 'Times New Roman', serif";
    const INK   = "#3f2d1c";

    const head = this.add.text(0, -panelH/2 + 52, "Alle zwölf gefunden!", {
      fontFamily: SERIF, fontSize: "34px", color: INK, fontStyle: "italic"
    }).setOrigin(0.5, 0).setAngle(-1.1);

    const txt = this.add.text(0, -panelH/2 + 108,
      "Dein Logbuch ist voll, Lisa.\nZeit, Dein Geschenk aufzumachen.", {
      fontFamily: SERIF, fontSize: "22px", color: INK, align: "center", lineSpacing: 6
    }).setOrigin(0.5, 0).setAngle(-1.1);

    // Geschenk zum Antippen
    const icon = this.textures.exists("gift_icon")
      ? this.add.image(0, 74, "gift_icon").setOrigin(0.5).setDisplaySize(170, 170)
      : this.add.rectangle(0, 74, 150, 150, 0xff2d55, 1).setStrokeStyle(6, 0xffffff, 1);

    const bounce = this.tweens.add({
      targets: icon, y: icon.y - 8, yoyo: true, repeat: -1, duration: 900, ease: "Sine.inOut"
    });

    const hint = this.add.text(0, panelH/2 - 40, "Tippe auf das Geschenk", {
      fontFamily: SERIF, fontSize: "19px", color: "#6b5334", fontStyle: "italic"
    }).setOrigin(0.5).setAngle(-1.1);

    cont.add([dim, paper, head, txt, icon, hint]);

    // Große Klickfläche über dem Geschenk – unabhängig vom Kamera-Zoom
    // Wichtig: scrollFactor 0, sonst rechnet Phaser die Trefferfläche mit dem
    // Kamera-Scroll um und der Tipper geht ins Leere.
    const zone = this.add.zone(0, 74, 300, 300)
      .setScrollFactor(0)
      .setInteractive({ useHandCursor: true });
    const oeffnen = ()=>{
      if (this.rewardLayer) return;
      bounce.pause();
      this.openRewardImage();
    };
    zone.on("pointerdown", oeffnen);
    cont.add(zone);

    // Sicherheitsnetz: Tippen irgendwo auf das Geschenk-Feld zählt auch dann,
    // wenn die Trefferfläche wegen Kamera-Zoom verrutscht.
    this.input.on("pointerdown", (p)=>{
      if (!cont.visible || this.rewardLayer) return;
      const cx = this.scale.width/2, cy = this.scale.height/2 + 74;
      if (Math.abs(p.x - cx) <= 170 && Math.abs(p.y - cy) <= 170) oeffnen();
    });

    cont._dim = dim;
    return cont;
  }

  // weicher Lichtschein – der Kater hält ja eine Lampe
  makeGlowTexture(key, size){
    if (this.textures.exists(key)) return;
    const tex = this.textures.createCanvas(key, size, size);
    const ctx = tex.getContext();
    const g = ctx.createRadialGradient(size/2, size/2, 0, size/2, size/2, size/2);
    g.addColorStop(0.00, "rgba(255, 226, 168, 0.95)");
    g.addColorStop(0.25, "rgba(255, 200, 120, 0.55)");
    g.addColorStop(0.55, "rgba(255, 170, 80, 0.22)");
    g.addColorStop(1.00, "rgba(255, 160, 60, 0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
    tex.refresh();
  }

  openRewardImage(){
    const W = this.scale.width, H = this.scale.height;
    const SERIF = "Georgia, 'Iowan Old Style', 'Times New Roman', serif";

    // Jedes Mal frisch aufbauen, damit die Enthüllung von vorne läuft
    if (this.rewardLayer){ this.rewardLayer.destroy(); this.rewardLayer = null; }

    const lay = this.add.container(W/2, H/2)
      .setScrollFactor(0)
      .setDepth(27000)
      .setAlpha(0)
      .setScale(1 / (this.cameras.main.zoom || 1));

    const dim = this.add.rectangle(0, 0, W*2, H*2, 0x03090e, 0.985).setOrigin(0.5);
    lay.add(dim);

    // ---------- Teil 1: der Gag ----------
    const gagGroup = this.add.container(0, 0);
    const gagTitle = this.add.text(0, -H*0.30, "Dein Geschenk ist …", {
      fontFamily: SERIF, fontSize: "40px", color: "#f2e4c8", fontStyle: "italic"
    }).setOrigin(0.5);
    gagGroup.add(gagTitle);

    if (this.textures.exists("gift_reward")){
      const gag = this.add.image(0, 30, "gift_reward").setOrigin(0.5);
      const src = this.textures.get("gift_reward").getSourceImage();
      const sc = Math.min((W*0.62) / src.width, (H*0.52) / src.height, 2.2);
      gag.setScale(sc);
      gagGroup.add(gag);
    }
    lay.add(gagGroup);

    // ---------- Teil 2: die Lampe ----------
    const lampGroup = this.add.container(0, 0).setAlpha(0);
    this.makeGlowTexture("warm_glow", 512);
    const glow = this.add.image(0, 20, "warm_glow")
      .setDisplaySize(900, 900)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setAlpha(0.85);
    lampGroup.add(glow);
    this.tweens.add({ targets: glow, alpha: 0.62, scale: glow.scale*1.06,
                      duration: 2200, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });

    if (this.textures.exists("gift_lamp")){
      const lamp = this.add.image(0, 26, "gift_lamp").setOrigin(0.5);
      const src = this.textures.get("gift_lamp").getSourceImage();
      const sc = Math.min((W*0.52) / src.width, (H*0.74) / src.height);
      lamp.setScale(sc);
      lampGroup.add(lamp);
    }

    const lampTitle = this.add.text(0, -H*0.40, "Alles Gute, Lisa!", {
      fontFamily: SERIF, fontSize: "46px", color: "#ffe9c2", fontStyle: "italic",
      stroke: "#2a1608", strokeThickness: 6
    }).setOrigin(0.5);
    const lampSub = this.add.text(0, H*0.365, "Eine Lampe – von Hand gedruckt, nur für Dich.", {
      fontFamily: SERIF, fontSize: "24px", color: "#f0dcb8",
      stroke: "#2a1608", strokeThickness: 4
    }).setOrigin(0.5);
    lampGroup.add([lampTitle, lampSub]);
    lay.add(lampGroup);

    this.rewardLayer = lay;

    // Steuerung anhalten
    this.bookOpen = true;
    this.physics.world.pause();
    this.player.setVelocity(0,0);

    // Alles andere aus dem Weg – das Geschenk soll allein wirken
    if (this.giftOverlay) this.giftOverlay.setVisible(false);
    if (this.uiRoot) this.uiRoot.setVisible(false);
    const touchScene = this.scene.get("TouchScene");
    if (touchScene && touchScene.scene.isActive()) touchScene.scene.setVisible(false);

    // Einblenden, Gag stehen lassen, dann überblenden
    this.tweens.add({ targets: lay, alpha: 1, duration: 260, ease: "Quad.easeOut" });

    let umgeblendet = false;
    const zumGeschenk = ()=>{
      if (umgeblendet) return;      // nur einmal, egal welcher Timer zuerst kommt
      umgeblendet = true;
      this.tweens.add({ targets: gagGroup, alpha: 0, duration: 500, ease: "Quad.easeIn" });
      this.tweens.add({ targets: lampGroup, alpha: 1, duration: 700, delay: 300, ease: "Quad.easeOut",
        onComplete: ()=> {
          // erst jetzt lässt sich das Bild wegtippen (Szenen-Ebene, damit der
          // Kamera-Zoom die Trefferfläche nicht verschiebt)
          this.input.once("pointerdown", ()=> this.closeReward());
        }
      });
    };

    // 5 Sekunden Gag – unabhängig von Phasers Uhr, damit es sicher weitergeht
    const startedAt = performance.now();
    const warten = () => {
      if (performance.now() - startedAt >= 5000) zumGeschenk();
      else this.time.delayedCall(200, warten);
    };
    this.time.delayedCall(200, warten);
    // Notbremse, falls die Szenen-Uhr klemmt
    setTimeout(zumGeschenk, 5200);
  }

  closeReward(){
    if (!this.rewardLayer) return;
    const lay = this.rewardLayer;
    this.rewardLayer = null;
    this.tweens.add({
      targets: lay, alpha: 0, duration: 300, ease: "Quad.easeIn",
      onComplete: ()=> lay.destroy()
    });
    if (this.giftOverlay) this.giftOverlay.setVisible(false);
    if (this.uiRoot) this.uiRoot.setVisible(true);
    const touchScene = this.scene.get("TouchScene");
    if (touchScene && touchScene.scene.isActive()) touchScene.scene.setVisible(true);
    this.bookOpen = false;
    this.physics.world.resume();
  }


}
