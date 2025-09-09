// scenes/level3.js
const Phaser = window.Phaser;
const L3_VERSION = "L3-openworld-2025-09-09";

export default class Level3 extends Phaser.Scene {
  constructor(){ super("Level3"); }

  preload(){
    // Taucher-Spritesheet (480x480 Frames aus deiner PNG)
    this.load.spritesheet("diver", "assets/sprites/diver_v4_1920x1920.png", {
      frameWidth: 480, frameHeight: 480, endFrame: 15
    });
  }

  create(){
    console.log("[Level3] geladen:", L3_VERSION);

    // --- Welt & Kamera ---
    this.WORLD_W = 5000;
    this.WORLD_H = 3800;
    this.physics.world.setBounds(0, 0, this.WORLD_W, this.WORLD_H);

    // Hintergrund: ruhiges Blau (kein TileSprite ohne Texture!)
    this.add.rectangle(this.WORLD_W/2, this.WORLD_H/2, this.WORLD_W, this.WORLD_H, 0x07263a).setDepth(-50);

    // --- Platzhalter-Texturen für Punkte (Haie) generieren ---
    this.ensureDotTexture("dot_white", 0xffffff);
    // Farben / "Arten" – später ersetzen wir das durch echte Haie
    this.SPECIES = [
      { id:"great_white", name:"Weißer Hai",    color:0xcfd6d6 },
      { id:"hammerhead",  name:"Hammerhai",     color:0xbdd7ff },
      { id:"tiger",       name:"Tigerhai",      color:0xc8a26d },
      { id:"bull",        name:"Bullenhai",     color:0xb4b4b4 },
      { id:"thresher",    name:"Fuchshai",      color:0x9ac7ff },
      { id:"whale",       name:"Walhai",        color:0x6fb2ff },
      { id:"blacktip",    name:"Schwarzspitzen",color:0x9fd1bf },
      { id:"mako",        name:"Makohai",       color:0x8fb8ff },
      { id:"blue",        name:"Blauhai",       color:0x6aa6ff },
      { id:"zebra",       name:"Zebrahai",      color:0xe6d18f }
    ];

    // Für jede Art eine eigene Punkt-Textur (Kreis)
    for (const s of this.SPECIES) this.ensureDotTexture("dot_"+s.id, s.color);

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
    this.input.keyboard.on("keydown-ESC", ()=> this.scene.start("MenuScene"));

    // --- Haie als farbige Punkte spawnen ---
    this.sharks = this.physics.add.group();
    const perSpecies = 10; // wie viele Punkte pro Art
    for (const s of this.SPECIES){
      for (let i=0;i<perSpecies;i++){
        const x = 200 + Math.random()*(this.WORLD_W-400);
        const y = 200 + Math.random()*(this.WORLD_H-400);
        const spr = this.sharks.create(x, y, "dot_"+s.id);
        spr.setCircle(6); // kleine Kollisionsfläche
        spr.setData("id", s.id);
        spr.setData("name", s.name);
        spr.setData("color", s.color);
        // gemütliches "Schwimmen"
        this.assignRandomVelocity(spr, Phaser.Math.Between(40, 90));
        this.scheduleWander(spr, 1200, 2600);
      }
    }

    // Spieler vs. Punkte: leicht abprallen
    this.physics.add.collider(this.player, this.sharks);

    // --- Kamera-Frame (Foto-Rahmen) ---
    this.frameW = 480;   // Breite/ Höhe des Rahmens in Pixeln (Bildschirmkoords)
    this.frameH = 300;
    this.photoFrame = this.add.rectangle(this.scale.width/2, this.scale.height/2, this.frameW, this.frameH)
      .setStrokeStyle(3, 0xaad4ff, 0.9)
      .setAlpha(0.9)
      .setDepth(1000)
      .setScrollFactor(0);

    // kleiner Fadenkreuzpunkt in der Mitte (optional)
    this.add.circle(this.scale.width/2, this.scale.height/2, 2, 0xaad4ff, 0.9)
      .setDepth(1001).setScrollFactor(0);

    // Blitz-Overlay bei Foto
    this.flash = this.add.rectangle(this.scale.width/2, this.scale.height/2, this.scale.width, this.scale.height, 0xffffff, 0)
      .setScrollFactor(0).setDepth(1200);

    // Foto-Input
    this.lastShotAt = 0;
    const shoot = ()=> this.takePhoto();
    this.input.keyboard.on("keydown-SPACE", shoot);
    this.input.keyboard.on("keydown-P", shoot);

    // --- HUD oben links ---
    this.hud = this.add.text(16, 16, "", {
      fontFamily:"system-ui, sans-serif", fontSize:"20px", color:"#e6f0ff", stroke:"#000", strokeThickness:3
    }).setScrollFactor(0).setDepth(1100);
    this.updateHud();

    // --- Logbuch-Button unten rechts ---
    this.bookBtn = this.makeBookButton();

    // Buch-Overlay (anfangs unsichtbar)
    this.bookOpen = false;
    this.bookLayer = this.makeBookLayer();
    this.bookLayer.setVisible(false);
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
    const ix = (k.left.isDown || k.a.isDown ? -1 : 0) + (k.right.isDown || k.d.isDown ? 1 : 0);
    const iy = (k.up.isDown   || k.w.isDown ? -1 : 0) + (k.down.isDown || k.s.isDown ? 1 : 0);

    this.player.setAcceleration(ix*speed*2, iy*speed*2);

    if (ix!==0 || iy!==0){
      if (this.anims.exists("diver_swim")) this.player.play("diver_swim", true);
      const ang = Math.atan2(iy, ix);
      if (!isNaN(ang)) this.player.setRotation(ang);
    } else {
      this.player.setAcceleration(0,0);
      if (this.anims.exists("diver_idle")) this.player.play("diver_idle", true);
    }
  }

  // ================= Foto-Logik =================
  takePhoto(){
    const now = this.time.now || performance.now();
    if (now - this.lastShotAt < 500) return; // kurzer cooldown
    this.lastShotAt = now;

    // Blitz
    this.flash.setAlpha(0.8);
    this.tweens.add({ targets:this.flash, alpha:0, duration:160, ease:"Quad.easeOut" });

    // Frame in Weltkoordinaten berechnen (zentriert auf Kamera)
    const cam = this.cameras.main;
    const cx = cam.midPoint.x;
    const cy = cam.midPoint.y;
    const halfW = (this.frameW / cam.zoom) / 2;
    const halfH = (this.frameH / cam.zoom) / 2;
    const left = cx - halfW, right = cx + halfW, top = cy - halfH, bottom = cy + halfH;

    // irgendeinen Hai im Frame?
    let target = null;
    this.sharks.children.iterate(s=>{
      if (!s) return;
      if (s.x >= left && s.x <= right && s.y >= top && s.y <= bottom) {
        target = s;
        return false; // break
      }
    });

    if (!target) {
      this.toast("Kein Hai im Kamera-Rahmen.");
      return;
    }

    const id = target.getData("id");
    const name = target.getData("name");
    if (this.dex.caught[id]) {
      this.toast("Schon im Logbuch: " + name);
      return;
    }

    this.dex.caught[id] = true;
    this.saveDex();
    this.updateHud();
    if (this.bookOpen) this.refreshBook();
    this.toast("Foto gelungen! → " + name + " eingetragen");
  }

  // ================= UI / HUD =================
  updateHud(){
    const total = this.SPECIES.length;
    let have = 0; for (const s of this.SPECIES) if (this.dex.caught[s.id]) have++;
    this.hud.setText(`Fotografiert: ${have} / ${total}   [SPACE] Foto   [B] Logbuch   [ESC] Menü`);
  }

  makeBookButton(){
    const pad = 16;
    const x = this.scale.width - (110 + pad);
    const y = this.scale.height - (40 + pad);
    const btn = this.add.rectangle(x, y, 110, 40, 0x0d2e46, 1)
      .setScrollFactor(0).setDepth(1100).setInteractive({ useHandCursor:true });
    const txt = this.add.text(x, y, "Logbuch [B]", {
      fontFamily:"system-ui, sans-serif", fontSize:"16px", color:"#cfe9ff", stroke:"#000", strokeThickness:2
    }).setOrigin(0.5).setScrollFactor(0).setDepth(1101);
    btn.on("pointerover", ()=> btn.setFillStyle(0x134062,1));
    btn.on("pointerout",  ()=> btn.setFillStyle(0x0d2e46,1));
    btn.on("pointerup",   ()=> this.toggleBook());
    this.input.keyboard.on("keydown-B", ()=> this.toggleBook());
    // Pack beides in ein Container-loses Paar zurück (wir steuern Sichtbarkeit über Book-Layer)
    btn._label = txt;
    return btn;
  }

  makeBookLayer(){
    const W = this.scale.width, H = this.scale.height;
    const layer = this.add.container(0,0).setDepth(2000).setScrollFactor(0);
    const dim = this.add.rectangle(W/2, H/2, W, H, 0x000000, 0.55);
    const panelW = Math.min(920, W*0.9), panelH = Math.min(620, H*0.85);
    const panel = this.add.rectangle(W/2, H/2, panelW, panelH, 0x071a2b, 0.98);
    const title = this.add.text(W/2, panel.getTopCenter().y + 18, "Logbuch", {
      fontFamily:"system-ui", fontSize:"32px", color:"#cfe9ff", stroke:"#000", strokeThickness:4
    }).setOrigin(0.5,0);

    // Zurück-Pfeil (rechts oben)
    const back = this.add.text(panel.getRightCenter().x - 16, panel.getTopCenter().y + 16, "↩︎", {
      fontFamily:"system-ui", fontSize:"26px", color:"#cfe9ff", stroke:"#000", strokeThickness:3
    }).setOrigin(1,0).setInteractive({useHandCursor:true});
    back.on("pointerup", ()=> this.toggleBook());

    // Liste
    const list = this.add.container(panel.getTopLeft().x + 28, panel.getTopLeft().y + 68);

    layer.add([dim, panel, title, back, list]);
    layer._panel = panel;
    layer._list = list;

    this.buildBookList(layer);
    return layer;
  }

  buildBookList(layer){
    const list = layer._list;
    list.removeAll(true);

    const total = this.SPECIES.length;
    let have = 0; for (const s of this.SPECIES) if (this.dex.caught[s.id]) have++;

    // Fortschritt
    const prog = this.add.text(layer._panel.getCenter().x, layer._panel.getTopCenter().y + 56,
      `Fortschritt: ${have} / ${total}`, {
        fontFamily:"system-ui", fontSize:"18px", color:"#a0c8ff", stroke:"#000", strokeThickness:3
      }).setOrigin(0.5,0);
    list.add(prog);

    // Einträge (2 Spalten)
    const colW = (layer._panel.width - 56) / 2;
    const rowH = 42;
    let idx = 0;
    for (const s of this.SPECIES){
      const caught = !!this.dex.caught[s.id];
      const col = idx % 2;
      const row = Math.floor(idx / 2);
      const x = col * colW;
      const y = 40 + row * rowH;

      // farbiger Punkt + Name + Status
      const dot = this.add.circle(x+10, y+12, 8, s.color);
      const name = this.add.text(x+28, y, s.name, {
        fontFamily:"system-ui", fontSize:"18px", color:"#e6f0ff", stroke:"#000", strokeThickness:3
      });
      const status = this.add.text(x+28+220, y, caught ? "✓" : "–", {
        fontFamily:"system-ui", fontSize:"18px",
        color: caught ? "#a7f5a1" : "#ffc0c0", stroke:"#000", strokeThickness:3
      });

      list.add(dot); list.add(name); list.add(status);
      idx++;
    }

    // Reset
    const btn = this.add.rectangle(layer._panel.getBottomCenter().x, layer._panel.getBottomCenter().y - 28, 200, 40, 0x0d2e46, 1)
      .setInteractive({useHandCursor:true});
    const btnt = this.add.text(btn.x, btn.y, "Fortschritt zurücksetzen", {
      fontFamily:"system-ui", fontSize:"16px", color:"#cfe9ff", stroke:"#000", strokeThickness:2
    }).setOrigin(0.5);
    btn.on("pointerover", ()=> btn.setFillStyle(0x134062,1));
    btn.on("pointerout",  ()=> btn.setFillStyle(0x0d2e46,1));
    btn.on("pointerup", ()=>{
      this.dex.caught = {};
      this.saveDex(); this.updateHud(); this.refreshBook();
      this.toast("Logbuch zurückgesetzt.");
    });

    list.add(btn); list.add(btnt);
  }

  toggleBook(){
    this.bookOpen = !this.bookOpen;
    this.bookLayer.setVisible(this.bookOpen);
    this.physics.world[this.bookOpen ? "pause" : "resume"]();
    this.player.setVelocity(0,0);
  }

  refreshBook(){
    if (this.bookLayer) this.buildBookList(this.bookLayer);
  }

  // ================= Utils =================
  makeDiverAnimations(){
    if (!this.anims.exists("diver_swim")){
      this.anims.create({
        key:"diver_swim",
        frames:this.anims.generateFrameNumbers("diver",{start:0,end:15}),
        frameRate:10, repeat:-1
      });
      this.anims.create({
        key:"diver_idle",
        frames:this.anims.generateFrameNumbers("diver",{start:0,end:1}),
        frameRate:2, repeat:-1
      });
    }
  }

  ensureDotTexture(key, color){
    if (this.textures.exists(key)) return;
    const g = this.add.graphics();
    g.fillStyle(color, 1);
    g.fillCircle(8,8,8);
    g.lineStyle(2, 0x000000, 0.25).strokeCircle(8,8,8);
    g.generateTexture(key, 16, 16);
    g.destroy();
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

  toast(msg){
    const W=this.scale.width, H=this.scale.height;
    const panel=this.add.rectangle(W/2, H*0.92, 1100, 52, 0x000000, 0.55)
      .setScrollFactor(0).setDepth(1500);
    const t=this.add.text(W/2, H*0.92, msg,
      { fontFamily:"system-ui, sans-serif", fontSize:"20px", color:"#e6f0ff",
        stroke:"#000", strokeThickness:3 })
      .setOrigin(0.5).setScrollFactor(0).setDepth(1501);
    this.time.delayedCall(1400, ()=>{ panel.destroy(); t.destroy(); });
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
}
