// scenes/level3.js
const Phaser = window.Phaser;
const L3_VERSION = "L3-2025-09-08-a";

export default class Level3 extends Phaser.Scene {
  constructor(){ super("Level3"); }

  preload(){
    // Falls du echte Assets hast, lade sie hier (Keys müssen in SHARKS[] unten passen).
    // Ansonsten generiere ich Platzhalter-Texturen im create().
    if (!this.textures.exists("diver")){
      this.load.spritesheet("diver", "assets/sprites/diver_v4_1920x1920.png", {
        frameWidth: 480, frameHeight: 480, endFrame: 15
      });
    }
    // (Optional) Sounds, wenn vorhanden:
    // this.load.audio("shutter", "assets/sfx/shutter.mp3");
  }

  create(){
    console.log("[Level3] geladen:", L3_VERSION);

    // --- Weltgrößen / Parameter ---
    const WORLD_W = 4200;
    const WORLD_H = 3200;
    const CAM_ZOOM = 1.3;
    const PLAYER_SPEED = 300;
    const PHOTO_RADIUS = 220;     // Reichweite der „Kamera“
    const PHOTO_COOLDOWN = 600;   // ms
    const WANDER_INTERVAL_MIN = 1200;
    const WANDER_INTERVAL_MAX = 2600;

    // --- lokale Progress-Speicherung ---
    this.dexKey = "sharkdex_v1";
    this.dex = this.loadDex();   // { caught: {id:true,...} }

    // --- Hintergrund (einfaches Wasser + leichte Struktur) ---
    this.cameras.main.setBackgroundColor("#06202c");
    this.add.tileSprite(WORLD_W/2, WORLD_H/2, WORLD_W, WORLD_H, null)
        .setFillStyle?.(0x073444, 1);
    // dezente „Sandbänke“
    const bg = this.add.graphics().setDepth(-10);
    bg.fillStyle(0x083247, 1).fillRect(0,0,WORLD_W,WORLD_H);
    bg.fillStyle(0x0b3a4e, 1);
    for (let i=0;i<28;i++){
      const x = Math.random()*WORLD_W, y = Math.random()*WORLD_H;
      const w = 260+Math.random()*360, h = 80+Math.random()*160;
      bg.fillEllipse(x,y,w,h);
    }

    // --- Physik-Welt / Kamera ---
    this.physics.world.setBounds(0,0,WORLD_W,WORLD_H);
    this.cameras.main.setBounds(0,0,WORLD_W,WORLD_H);
    this.cameras.main.setZoom(CAM_ZOOM);
    this.cameras.main.setRoundPixels(true);

    // --- Platzhalter-Texturen bauen (nur wenn nötig) ---
    this.makeSimpleTextures();

    // --- Spieler ---
    const startX = WORLD_W*0.5, startY = WORLD_H*0.5;
    this.player = this.textures.exists("diver")
      ? this.physics.add.sprite(startX, startY, "diver", 0).setScale(0.24)
      : this.physics.add.image(startX, startY, "player");
    this.player.setCollideWorldBounds(true);
    this.player.body.setDrag(600,600);
    this.player.body.setMaxVelocity(360,360);
    this.updatePlayerHitbox();

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

    // --- HUD (links oben) ---
    this.hud = this.add.text(16,16,"",{
      fontFamily:"system-ui, sans-serif", fontSize:"22px", color:"#e6f0ff", stroke:"#000", strokeThickness:3
    }).setScrollFactor(0).setDepth(2000);
    this.updateHud();

    // Zielkreis/Reticle fürs Foto (Mitte der Kamera)
    this.photoCircle = this.add.circle(0,0, PHOTO_RADIUS, 0xffffff, 0.06)
      .setStrokeStyle(2, 0xaad4ff, 0.7)
      .setDepth(1000).setScrollFactor(0);
    this.positionReticle();

    // Flash-Overlay fürs Foto
    this.flash = this.add.rectangle(this.scale.width/2, this.scale.height/2, this.scale.width, this.scale.height, 0xffffff, 0)
      .setScrollFactor(0).setDepth(3000);

    // --- Haie definieren und spawnen ---
    /** id: eindeutiger Schlüssel (wird gespeichert)
        name: Anzeige im Buch
        color: für Platzhalter-Textur
        speed: Bewegungsgeschwindigkeit
    **/
    this.SHARKS = [
      {id:"great_white", name:"Weißer Hai",         color:0xcfd6d6, speed:120},
      {id:"hammerhead",  name:"Hammerhai",          color:0xbdd7ff, speed:140},
      {id:"tiger",       name:"Tigerhai",           color:0xc8a26d, speed:135},
      {id:"bull",        name:"Bullenhai",          color:0xb4b4b4, speed:125},
      {id:"thresher",    name:"Fuchshai",           color:0x9ac7ff, speed:160},
      {id:"whale",       name:"Walhai",             color:0x6fb2ff, speed:90},
      {id:"blacktip",    name:"Schwarzspitzen",     color:0x9fd1bf, speed:150},
      {id:"mako",        name:"Makohai",            color:0x8fb8ff, speed:180},
      {id:"blue",        name:"Blauhai",            color:0x6aa6ff, speed:160},
      {id:"zebra",       name:"Zebrahai",           color:0xe6d18f, speed:110}
    ];
    this.sharks = this.physics.add.group();

    // pro Art 1–2 Individuen spawnen
    for (const s of this.SHARKS){
      const count = 1 + Math.round(Math.random()); // 1 oder 2
      for (let i=0;i<count;i++){
        const x = 200 + Math.random()*(WORLD_W-400);
        const y = 200 + Math.random()*(WORLD_H-400);
        const key = this.ensureSharkTexture(s);
        const spr = this.sharks.create(x,y,key);
        spr.setData("id", s.id);
        spr.setData("name", s.name);
        spr.setData("speed", s.speed);
        spr.setData("caught", !!this.dex.caught[s.id]);
        spr.setDepth(5);
        spr.setCollideWorldBounds(true);
        spr.setBounce(1,1);
        this.assignRandomVelocity(spr);
        this.scheduleWander(spr, WANDER_INTERVAL_MIN, WANDER_INTERVAL_MAX);
      }
    }

    // Spieler vs. Haie — keine harte Kollision, aber weiches Abprallen ok:
    this.physics.add.collider(this.player, this.sharks, null, null, this);

    // --- Eingaben ---
    this.keys = this.input.keyboard.addKeys({
      left:"LEFT", right:"RIGHT", up:"UP", down:"DOWN",
      a:"A", d:"D", w:"W", s:"S",
      space:"SPACE", p:"P", b:"B", esc:"ESC"
    });

    // Buch öffnen/schließen
    this.input.keyboard.on("keydown-B", ()=> this.toggleBook());
    // Foto
    this.lastShotAt = 0;
    this.input.keyboard.on("keydown-SPACE", ()=> this.takePhoto());
    this.input.keyboard.on("keydown-P", ()=> this.takePhoto()); // Alternative Taste

    // ESC → Menü (falls vorhanden)
    this.input.keyboard.on("keydown-ESC", ()=> this.scene.start("MenuScene"));

    // Buch-Overlay initial nicht sichtbar
    this.bookOpen = false;
    this.bookLayer = this.makeBookLayer();
    this.bookLayer.setVisible(false);
  }

  // ------------------ Helpers & Gameplay ------------------

  update(time, delta){
    if (this.bookOpen) { // im Buch: Spieler halten
      if (this.textures.exists("diver")) this.player.play("diver_idle", true);
      this.player.setAcceleration(0,0);
      return;
    }

    const speed = 300;
    const k = this.keys;
    const ix = (k.left.isDown || k.a.isDown ? -1 : 0) + (k.right.isDown || k.d.isDown ? 1 : 0);
    const iy = (k.up.isDown   || k.w.isDown ? -1 : 0) + (k.down.isDown || k.s.isDown ? 1 : 0);

    this.player.body.setAcceleration(ix*speed*2, iy*speed*2);
    if (ix!==0 || iy!==0){
      if (this.textures.exists("diver")) this.player.play("diver_swim", true);
      // Orientierung
      const ang = Math.atan2(iy, ix);
      if (!isNaN(ang) && (ix!==0 || iy!==0)) this.player.setRotation(ang);
    } else {
      this.player.body.setAcceleration(0,0);
      if (this.textures.exists("diver")) this.player.play("diver_idle", true);
    }

    // Reticle mittig halten
    this.positionReticle();
  }

  positionReticle(){
    // mitten auf dem Bildschirm
    this.photoCircle.x = this.scale.width/2;
    this.photoCircle.y = this.scale.height/2;
  }

  takePhoto(){
    const now = this.time.now || performance.now();
    if (now - this.lastShotAt < 600) return; // cooldown
    this.lastShotAt = now;

    // Flash
    this.flash.setAlpha(0.7);
    this.tweens.add({ targets:this.flash, alpha:0, duration:180, ease:"Quad.easeOut" });

    // „Sicht“-Kreis in Weltkoordinaten
    const worldPt = this.cameras.main.getWorldPoint(this.scale.width/2, this.scale.height/2);

    // Nächsten Hai innerhalb PHOTO_RADIUS finden
    let best = null, bestDist = Number.MAX_VALUE;
    this.sharks.children.iterate((s)=>{
      if (!s) return;
      const dx = s.x - worldPt.x, dy = s.y - worldPt.y;
      const d2 = dx*dx + dy*dy;
      if (d2 <= (220*220) && d2 < bestDist){
        best = s; bestDist = d2;
      }
    });

    if (!best){
      this.toast("Kein Hai im Suchkreis.");
      return;
    }

    const id = best.getData("id");
    const name = best.getData("name");
    if (this.dex.caught[id]){
      this.toast("Schon im Buch: " + name);
      return;
    }

    // Eintragen & speichern
    this.dex.caught[id] = true;
    this.saveDex();
    this.toast("Foto gelungen! → " + name + " gesammelt");
    this.updateHud();
    if (this.bookOpen) this.refreshBook();
  }

  loadDex(){
    let raw = null;
    try { raw = window.localStorage.getItem(this.dexKey); } catch(e){}
    if (raw){
      try {
        const obj = JSON.parse(raw);
        if (obj && obj.caught) return { caught: obj.caught };
      } catch(e){}
    }
    return { caught: {} };
  }

  saveDex(){
    try {
      window.localStorage.setItem(this.dexKey, JSON.stringify({ caught: this.dex.caught }));
    } catch(e){
      console.warn("Konnte Sharkdex nicht speichern:", e);
    }
  }

  updateHud(){
    const total = this.SHARKS.length;
    let have = 0;
    for (const s of this.SHARKS){ if (this.dex.caught[s.id]) have++; }
    this.hud.setText("Haie fotografiert: " + have + " / " + total + "\n[SPACE] Foto   [B] Buch");
  }

  toast(msg){
    const W=this.scale.width, H=this.scale.height;
    const panel=this.add.rectangle(W/2, H*0.9, 1100, 58, 0x000000, 0.55)
      .setScrollFactor(0).setDepth(2500);
    const t=this.add.text(W/2, H*0.9, msg,
      { fontFamily:"system-ui, sans-serif", fontSize:"22px", color:"#e6f0ff",
        stroke:"#000", strokeThickness:3 })
      .setOrigin(0.5).setScrollFactor(0).setDepth(2501);
    this.time.delayedCall(1400, ()=>{ panel.destroy(); t.destroy(); });
  }

  // --- Hai-Buch (Overlay) ---
  makeBookLayer(){
    const W = this.scale.width, H = this.scale.height;
    const layer = this.add.container(0,0).setDepth(4000).setScrollFactor(0);

    const dim = this.add.rectangle(W/2,H/2,W,H,0x000000,0.55);
    const panel = this.add.rectangle(W/2,H/2, Math.min(920, W*0.9), Math.min(620, H*0.85), 0x071a2b, 0.98);
    const title = this.add.text(W/2, H/2 - (panel.height/2) + 28, "Hai-Buch",
      { fontFamily:"system-ui", fontSize:"32px", color:"#cfe9ff", stroke:"#000", strokeThickness:4 }).setOrigin(0.5,0);

    // Liste vorbereiten
    const list = this.add.container(panel.getTopLeft().x + 28, panel.getTopLeft().y + 74);

    // Schließen-Button
    const close = this.add.text(panel.getBottomRight().x - 14, panel.getTopLeft().y + 14, "✕", {
      fontFamily:"system-ui", fontSize:"26px", color:"#cfe9ff", stroke:"#000", strokeThickness:3
    }).setOrigin(1,0).setInteractive({useHandCursor:true});
    close.on("pointerup", ()=> this.toggleBook());

    layer.add([dim, panel, title, list, close]);
    layer._panel = panel;
    layer._list = list;

    this.buildBookList(layer);

    return layer;
  }

  buildBookList(layer){
    const list = layer._list;
    list.removeAll(true);

    const total = this.SHARKS.length;
    let have = 0; for (const s of this.SHARKS){ if (this.dex.caught[s.id]) have++; }

    // Fortschritt
    const prog = this.add.text(layer._panel.getCenter().x, layer._panel.getTopCenter().y + 54,
      "Fortschritt: " + have + " / " + total,
      { fontFamily:"system-ui", fontSize:"20px", color:"#a0c8ff", stroke:"#000", strokeThickness:3 }).setOrigin(0.5,0);
    list.add(prog);

    // Grid (2 Spalten)
    const colW = (layer._panel.width - 56) / 2;
    const rowH = 44;
    let idx = 0;
    for (const s of this.SHARKS){
      const caught = !!this.dex.caught[s.id];
      const col = idx % 2;
      const row = Math.floor(idx / 2);
      const x = col * colW;
      const y = 42 + row * rowH;

      const mark = this.add.text(x, y, caught ? "✓" : "–", {
        fontFamily:"system-ui", fontSize:"22px",
        color: caught ? "#a7f5a1" : "#ffc0c0", stroke:"#000", strokeThickness:3
      });
      const label = this.add.text(x+28, y, s.name, {
        fontFamily:"system-ui", fontSize:"20px", color:"#e6f0ff", stroke:"#000", strokeThickness:3
      });
      list.add(mark); list.add(label);
      idx++;
    }

    // Reset Button
    const btn = this.add.rectangle(layer._panel.getBottomCenter().x, layer._panel.getBottomCenter().y - 28, 200, 40, 0x0d2e46, 1)
      .setInteractive({useHandCursor:true});
    const btnt = this.add.text(btn.x, btn.y, "Fortschritt zurücksetzen", {
      fontFamily:"system-ui", fontSize:"16px", color:"#cfe9ff", stroke:"#000", strokeThickness:2
    }).setOrigin(0.5);
    btn.on("pointerover", ()=> btn.setFillStyle(0x134062,1));
    btn.on("pointerout",  ()=> btn.setFillStyle(0x0d2e46,1));
    btn.on("pointerup", ()=>{
      this.dex.caught = {};
      this.saveDex();
      this.updateHud();
      this.refreshBook();
      this.toast("Hai-Buch zurückgesetzt.");
    });

    list.add(btn); list.add(btnt);
  }

  refreshBook(){
    if (!this.bookLayer) return;
    this.buildBookList(this.bookLayer);
  }

  toggleBook(){
    this.bookOpen = !this.bookOpen;
    if (this.bookOpen){
      this.physics.world.pause();
      this.player.body.setVelocity(0,0);
      this.bookLayer.setVisible(true);
      this.refreshBook();
    } else {
      this.physics.world.resume();
      this.bookLayer.setVisible(false);
    }
  }

  // --- Bewegung / „KI“ ---
  assignRandomVelocity(spr){
    const sp = spr.getData("speed") || 130;
    const ang = Math.random()*Math.PI*2;
    spr.setVelocity(Math.cos(ang)*sp, Math.sin(ang)*sp);
    spr.setRotation(ang);
  }

  scheduleWander(spr, minMs, maxMs){
    const t = Phaser.Math.Between(minMs, maxMs);
    this.time.delayedCall(t, ()=>{
      if (!spr.body) return;
      this.assignRandomVelocity(spr);
      this.scheduleWander(spr, minMs, maxMs);
    });
  }

  // --- Texturen / Platzhalter ---
  makeSimpleTextures(){
    const g = this.add.graphics();

    if (!this.textures.exists("player")){
      g.clear(); g.fillStyle(0xffffff, 1); g.fillRect(0,0,48,32);
      this.textures.addCanvas("player", g.generateTexture("tmpP",48,32).getSourceImage());
    }

    // generische Hai-Base
    if (!this.textures.exists("shark_base")){
      g.clear();
      g.fillStyle(0xffffff,1);
      g.fillEllipse(60,30,120,52);
      g.fillTriangle(24,30, 48,10, 48,50); // Rückenflosse
      g.fillTriangle(100,30, 120,22, 120,38); // Schwanz
      g.lineStyle(2,0x000000,0.25).strokeEllipse(60,30,120,52);
      g.generateTexture("shark_base", 130, 60);
    }
    g.clear();
    g.destroy();
  }

  ensureSharkTexture(s){
    const key = "shark_" + s.id;
    if (this.textures.exists(key)) return key;
    // Färbe die Base ein und schreibe Label drauf
    const rt = this.add.renderTexture(0,0,160,70).setVisible(false);
    rt.draw("shark_base", 15, 5).tint(s.color);
    const txt = this.add.text(80,58, s.name.split(" ")[0], {
      fontFamily:"monospace", fontSize:"10px", color:"#ffffff"
    }).setOrigin(0.5,1);
    rt.draw(txt, 0,0);
    this.textures.addBase64(key, rt.canvas.toDataURL());
    rt.destroy(); txt.destroy();
    return key;
  }

  // --- Sonstiges ---
  updatePlayerHitbox(){
    const bw=this.player.displayWidth*0.38, bh=this.player.displayHeight*0.52;
    this.player.body.setSize(bw,bh);
    this.player.body.setOffset(
      (this.player.displayWidth  - bw)/2,
      (this.player.displayHeight - bh)/2
    );
  }
}
