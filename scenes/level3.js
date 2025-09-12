// scenes/level3.js
const Phaser = window.Phaser;
const L3_VERSION = "L3-openworld-2025-09-12-e"; // + PNG-Haie, Frame folgt Spieler

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
    this.load.image("shark_blacktip",    base + "Schwarzspitzenhai.png");// prüf ggf. exakten Namen
    this.load.image("shark_mako",        base + "makohai.png");
    this.load.image("shark_blue",        base + "blauhai.png");
    this.load.image("shark_zebra",       base + "zebrahai.png");
  }

  create(){
    console.log("[Level3] geladen:", L3_VERSION);

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
      { id:"zebra",       name:"Zebrahai",       color:0xe6d18f, tex:"shark_zebra"       }
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
    this.input.keyboard.on("keydown-ESC", ()=> this.scene.start("MenuScene"));

    // --- Haie spawnen: PNG falls vorhanden, sonst Fallback-Kreis ---
    this.sharks = this.physics.add.group();
    const perSpecies = 6;
    for (const s of this.SPECIES){
      for (let i=0;i<perSpecies;i++){
        const x = 200 + Math.random()*(this.WORLD_W-400);
        const y = 200 + Math.random()*(this.WORLD_H-400);

        const texKey = this.textures.exists(s.tex) ? s.tex : ("dot_big_"+s.id);
        const spr = this.createSharkSprite(x, y, texKey);

        spr.setData("id", s.id);
        spr.setData("name", s.name);
        spr.setData("color", s.color);

        this.assignRandomVelocity(spr, Phaser.Math.Between(40, 90));
        this.scheduleWander(spr, 1200, 2600);
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
    }).setScrollFactor(0).setDepth(9000);
    this.updateHud();

    // --- Capture-Meldung oben rechts ---
    this.capturePanel = this.makeCapturePanel();

    // --- Logbuch ---
    this.bookBtn = this.makeBookButton();
    this.bookBtn.setDepth(10000);
    this.bookBtn._label.setDepth(10001);

    this.bookOpen = false;
    this.bookLayer = this.makeBookLayer();
    this.bookLayer.setVisible(false);
    this.bookLayer.setDepth(9500);

    // Resize
    this.scale.on("resize", () => this.repositionUI());
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
    this.photoDot?.setPosition(this.photoFrame.x, this.photoFrame.y);
  }

  // ================= Foto-Logik =================
  takePhoto(){
    const now = this.time.now || performance.now();
    if (now - this.lastShotAt < 500) return; // kurzer cooldown
    this.lastShotAt = now;

    // Blitz
    this.flash.setAlpha(0.8);
    this.tweens.add({ targets:this.flash, alpha:0, duration:160, ease:"Quad.easeOut" });

    // Frame-Grenzen in Weltkoordinaten (Frame hängt an der Taucherin)
    const left   = this.photoFrame.x - this.frameW/2;
    const right  = this.photoFrame.x + this.frameW/2;
    const top    = this.photoFrame.y - this.frameH/2;
    const bottom = this.photoFrame.y + this.frameH/2;

    // Hai im Frame?
    let target = null;
    this.sharks.children.iterate(s=>{
      if (!s) return;
      if (s.x >= left && s.x <= right && s.y >= top && s.y <= bottom) { target = s; return false; }
    });
    if (!target) return;

    const id = target.getData("id");
    const name = target.getData("name");
    if (this.dex.caught[id]) return;

    this.dex.caught[id] = true;
    this.saveDex();
    this.updateHud();
    if (this.bookOpen) this.refreshBook();
    this.showCapture(name);
  }

  // ================= UI / HUD =================
  updateHud(){
    const total = this.SPECIES.length;
    let have = 0; for (const s of this.SPECIES) if (this.dex.caught[s.id]) have++;
    this.hud.setText(`Fotografiert: ${have} / ${total}   [SPACE] Foto   [B] Logbuch   [ESC] Menü`);
  }

  makeCapturePanel(){
    const pad = 16;
    const W = this.scale.width;
    const panel = this.add.container(W - (320 + pad), pad).setScrollFactor(0).setDepth(9800);
    const bg = this.add.rectangle(0, 0, 320, 52, 0x0d2e46, 0.95).setOrigin(0,0);
    const text = this.add.text(12, 8, "", {
      fontFamily:"system-ui, sans-serif", fontSize:"18px", color:"#cfe9ff", stroke:"#000", strokeThickness:3,
      wordWrap: { width: 296 }
    });
    panel.add([bg, text]);
    panel.setAlpha(0);
    panel._text = text;
    return panel;
  }

  showCapture(name){
    const p = this.capturePanel;
    p._text.setText(`Neu fotografiert:\n${name}`);
    this.tweens.killTweensOf(p);
    p.setAlpha(0).y = 16;
    this.tweens.add({
      targets: p, alpha: 1, y: 16, duration: 120, ease: "Quad.easeOut",
      onComplete: () => {
        this.tweens.add({ targets: p, alpha: 0, y: 0, delay: 1400, duration: 220, ease: "Quad.easeIn" });
      }
    });
  }

  makeBookButton(){
    const pad = 16;
    const x = this.scale.width - (110 + pad);
    const y = this.scale.height - (40 + pad);
    const btn = this.add.rectangle(x, y, 110, 40, 0x0d2e46, 1).setScrollFactor(0).setInteractive({ useHandCursor:true });
    const txt = this.add.text(x, y, "Logbuch [B]", {
      fontFamily:"system-ui, sans-serif", fontSize:"16px", color:"#cfe9ff", stroke:"#000", strokeThickness:2
    }).setOrigin(0.5).setScrollFactor(0);
    btn.on("pointerover", ()=> btn.setFillStyle(0x134062,1));
    btn.on("pointerout",  ()=> btn.setFillStyle(0x0d2e46,1));
    btn.on("pointerup",   ()=> this.toggleBook());
    this.input.keyboard.on("keydown-B", ()=> this.toggleBook());
    btn._label = txt;
    return btn;
  }

  makeBookLayer(){
    const W = this.scale.width, H = this.scale.height;
    const layer = this.add.container(0,0).setScrollFactor(0);
    const dim = this.add.rectangle(W/2, H/2, W, H, 0x000000, 0.55);
    const panelW = Math.min(920, W*0.9), panelH = Math.min(620, H*0.85);
    const panel = this.add.rectangle(W/2, H/2, panelW, panelH, 0x071a2b, 0.98);
    const title = this.add.text(W/2, panel.getTopCenter().y + 16, "Logbuch  —  [B] schließen", {
      fontFamily:"system-ui", fontSize:"28px", color:"#cfe9ff", stroke:"#000", strokeThickness:4
    }).setOrigin(0.5,0);
    const list = this.add.container(panel.getTopLeft().x + 28, panel.getTopLeft().y + 68);

    layer.add([dim, panel, title, list]);
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

  // Fortschritt (wie bisher)
  const prog = this.add.text(layer._panel.getCenter().x, layer._panel.getTopCenter().y + 52,
    `Fortschritt: ${have} / ${total}`, {
      fontFamily:"system-ui", fontSize:"18px", color:"#a0c8ff", stroke:"#000", strokeThickness:3
    }).setOrigin(0.5,0);
  list.add(prog);

  // Einträge (2 Spalten) – mit Thumbnails
  const colW  = (layer._panel.width - 56) / 2;
  const rowH  = 58;   // höher wegen Bildchen
  const padL  = 10;   // linker Innenabstand je Zelle
  const thumbH = 36;  // Zielhöhe der Thumbnails
  const gap   = 10;   // Abstand Bild -> Name
  const nameW = 220;  // Breite bis zum Status

  let idx = 0;
  for (const s of this.SPECIES){
    const caught = !!this.dex.caught[s.id];
    const col = idx % 2;
    const row = Math.floor(idx / 2);
    const baseX = col * colW;
    const baseY = 40 + row * rowH;

    let nameX;

    if (this.textures.exists(s.tex)){
      // PNG-Thumbnail
      const img = this.add.image(baseX + padL, baseY + 16, s.tex).setOrigin(0,0.5);
      const src = this.textures.get(s.tex).getSourceImage?.();
      const scale = (src && src.height) ? (thumbH / src.height) : 1;
      img.setScale(scale);
      list.add(img);
      nameX = baseX + padL + (src ? src.width * scale : thumbH) + gap;
    } else {
      // Fallback: farbiger Punkt
      const dot = this.add.circle(baseX + padL + 18, baseY + 16, 12, s.color);
      list.add(dot);
      nameX = baseX + padL + 18 + 12 + gap;
    }

    // Name
    const name = this.add.text(nameX, baseY, s.name, {
      fontFamily:"system-ui", fontSize:"18px", color:"#e6f0ff", stroke:"#000", strokeThickness:3
    });
    list.add(name);

    // Status (✓ / –)
    const status = this.add.text(nameX + nameW, baseY, caught ? "✓" : "–", {
      fontFamily:"system-ui", fontSize:"18px",
      color: caught ? "#a7f5a1" : "#ffc0c0", stroke:"#000", strokeThickness:3
    });
    list.add(status);

    idx++;
  }

  // Reset-Button (wie bisher)
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

  repositionUI(){
    const pad = 16;
    this.capturePanel?.setPosition(this.scale.width - (320 + pad), pad);
    if (this.bookBtn && this.bookBtn._label){
      const x = this.scale.width - (110 + pad);
      const y = this.scale.height - (40 + pad);
      this.bookBtn.setPosition(x, y);
      this.bookBtn._label.setPosition(x, y);
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

    // Zielhöhe ~ Taucherin (≈115 px)
    const img = this.textures.get(key)?.getSourceImage?.();
    const targetH = 115;
    const scale = (img && img.height) ? (targetH / img.height) : 1;
    spr.setScale(scale);

    // Kollision: schmalere Box für PNGs, Kreis für Fallback
    if (key.startsWith("shark_") && img){
      spr.body.setSize(img.width * 0.55 * scale, img.height * 0.45 * scale, true);
    } else {
      spr.body.setCircle(50 * scale, 10 * scale, 10 * scale);
    }

    // Hinweis: PNGs am besten nach LINKS abspeichern. Falls ein Bild nach rechts schaut:
    // spr.setFlipX(true);

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
  makeSeamlessDotsTexture(key, size, { bg=0x07263a, dotColor=0x0e4163, dotAlpha=0.10, dotCount=220, dotMin=1, dotMax=2 } = {}){
    if (this.textures.exists(key)) return;
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
    ctx.drawImage(tex.getSourceImage(), 1, 0);
    ctx.drawImage(tex.getSourceImage(), 0, -1);
    ctx.drawImage(tex.getSourceImage(), 0, 1);
    ctx.globalAlpha = 1;
    tex.refresh();
  }

  makeSeamlessBlobsTexture(key, size, { blobColor=0x1a5b86, blobAlpha=0.08, blobCount=70, minR=16, maxR=60 } = {}){
    if (this.textures.exists(key)) return;
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
    ctx.globalAlpha = 1; tex.refresh();
  }
}




