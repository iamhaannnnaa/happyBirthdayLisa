// scenes/level1.js
const Phaser = window.Phaser;
import { readAxis, startTouch, touchEnabled } from "./touch.js";
import { markLevelDone, levelTitle, nextLevel } from "../progress.js";
import { makeLetter, makeNote, showNote, makeEndPanel } from "./ui.js";

const DEBUG = false;

// Bühnenmaße. Werden in create() auf die echte Größe gesetzt – die hängt
// beim Handy vom Bildschirmverhältnis ab (siehe main.js).
let W = 1920, H = 1080;

export default class Level1 extends Phaser.Scene {
  constructor(){ super("Level1"); }

  preload(){
    // BG
    this.load.image("l1_back",  "assets/backgrounds/level1_back.jpg"); // war 2,1 MB als PNG
    this.load.image("l1_mid",   "assets/backgrounds/level1_mid.png");
    this.load.image("l1_fore",  "assets/backgrounds/level1_fore.png");
    this.load.image("caustics", "assets/backgrounds/caustics_overlay.png");

    // Taucherin (6x1), Cache-Buster hochdrehen
// ✅ Korrekt laden (ohne Tippfehler) – 480x480 Frames
this.load.spritesheet("diver", "assets/sprites/diver_v4_1920x1920.png", {
  frameWidth: 480,
  frameHeight: 480,
  endFrame: 15
});



    // Münze + Drückerfisch
    this.load.image("coin", "assets/objects/coin2.png");
    this.load.image("triggerfish", "assets/objects/triggerfish.png?v=2");

    // Pergament für den Brief am Anfang
    if (!this.textures.exists("parchment")){
      this.load.image("parchment", "assets/objects/level2/parchment.png");
    }

    if (DEBUG){
      this.load.on("loaderror", (f)=>console.warn("[LOAD ERROR]", f?.key, f?.src));
    }
  }

  create(){
    W = this.scale.width; H = this.scale.height;
    this.cameras.main.setBackgroundColor("#06121f");
    this.cameras.main.setBounds(0,0,W,H);
    this.cameras.main.setRoundPixels(true);


    // Parallax
    this.back = this.safeCoverImage(0,0,"l1_back",0.25,W,H);
    this.mid  = this.safeCoverImage(0,0,"l1_mid", 0.55,W,H);
    this.fore = this.safeCoverImage(0,0,"l1_fore",0.90,W,H);
    this.ca   = this.textures.exists("caustics")
      ? this.add.tileSprite(0,0,W,H,"caustics").setOrigin(0,0).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.18).setScrollFactor(0.7)
      : null;

    // Spielerin
    this.player = this.textures.exists("diver")
      ? this.physics.add.sprite(W*0.25,H*0.55,"diver",0).setScale(0.65)   // Taucherin kleiner machen
      : this.physics.add.image(W*0.25,H*0.55, this.makeFallbackTex());

    this.player.setCollideWorldBounds(true);
    this.player.body.setDrag(600, 600);
    this.player.body.setMaxVelocity(320, 320);
    this.updateBodySize();

    // Animationen
    if (this.textures.exists("diver")) {
      this.anims.create({
        key:"diver_swim",
        frames:this.anims.generateFrameNumbers("diver",{start:0,end:15}), // 6 Frames
        frameRate:10,
        repeat:-1
      });
      this.anims.create({
        key:"diver_idle",
        frames:this.anims.generateFrameNumbers("diver",{start:0,end:1}),
        frameRate:2,
        repeat:-1
      });
      this.player.play("diver_idle");
    }

    // Kamera & Steuerung
    this.cursors = this.input.keyboard.addKeys({ left:"LEFT", right:"RIGHT", up:"UP", down:"DOWN", a:"A", d:"D", w:"W", s:"S", esc:"ESC" });
    this.cameras.main.startFollow(this.player, true, 0.12, 0.12);

    // Bubbles (Deko)
    this.bubbles = this.add.container(0,0).setScrollFactor(0.6);
    for (let i=0;i<20;i++) this.bubbles.add(this.makeBubble(W,H));

    // --- SPIELZUSTAND ---
    this.totalCoins = 8;
    this.collected  = 0;
    this.oxygenMax  = 25; // Sekunden
    this.oxygen     = this.oxygenMax;
    this.gameOver   = false;

    // HUD
    this.uiCoins = this.add.text(48,44,`Münzen: 0 / ${this.totalCoins}`,{
      fontFamily:"system-ui, sans-serif", fontSize:"32px", color:"#e6f0ff"
    }).setScrollFactor(0).setDepth(20);

    // Pergament-Notiz für die Sprüche beim Drückerfisch
    this.note = makeNote(this, { width: 760, y: 0.22 });
    this.fischTreffer = 0;

    this.oxyBar = this.makeOxygenBar();
    this.time.addEvent({ delay: 1000, loop: true, callback: ()=> {
      if (this.gameOver || this.introOpen) return;   // Brief pausiert die Uhr
      this.oxygen = Math.max(0, this.oxygen-1);
      this.updateOxygenBar();
      if (this.oxygen<=0) this.fail("Keine Luft mehr!");
    }});

    // Münzen & Fische
    this.spawnCoins();
    this.spawnTriggerfish();

    // ESC / Menü-Button → Menü
    const toMenu = ()=> this.scene.start("MenuScene");
    this.input.keyboard.on("keydown-ESC", toMenu);
    this.game.events.on("touch-menu", toMenu);
    this.events.once("shutdown", ()=> this.game.events.off("touch-menu", toMenu));

    // Touch-Steuerung (nur auf Handy/Tablet sichtbar)
    startTouch(this);

    // Brief am Anfang (einmalig pro Gerät)
    this.showIntroLetter();

    // Debug Toggle (nur wenn DEBUG an ist – "D" ist sonst eine Bewegungstaste!)
    this._dbgGfx=null;
    if (DEBUG) this.input.keyboard.on("keydown-D", ()=> this.drawDebug());
  }

  // ---- Brief zum Einstieg ----
  showIntroLetter(){
    const KEY = "l1_intro_seen_v1";
    this.introOpen = false;

    let seen = false;
    try { seen = localStorage.getItem(KEY) === "1"; } catch(e){}
    if (seen) return;

    const brief =
`Dein erster Tauchgang! Unter Dir liegen die alten Limes-Ruinen,
und zwischen den Säulen glitzern acht Goldmünzen.

Sammle alle acht ein, bevor Dir die Luft ausgeht. Oben rechts
siehst Du, wie viel Sauerstoff Du noch hast.

Und den Drückerfischen gehst Du besser aus dem Weg. Ich weiß,
Du hörst da nicht drauf – aber wer einen rammt, verliert Luft.`;

    this.intro = makeLetter(this, {
      body: brief,
      footer: touchEnabled()
        ? "Joystick rechts bewegt Dich · „☰ Menü“ unten führt zurück"
        : "Pfeiltasten oder [WASD] bewegen · [ESC] Menü",
      hint: touchEnabled() ? "Tippe auf den Bildschirm, um loszutauchen" : "[Leertaste] zum Starten"
    });

    this.introOpen = true;
    this.physics.world.pause();
    (this.idleTweens || []).forEach(t => t.pause());
    this.intro.setVisible(true);
    this.tweens.add({ targets: this.intro, alpha: 1, duration: 160, ease: "Quad.easeOut" });

    const close = ()=>{
      if (!this.introOpen) return;
      this.introOpen = false;
      this.physics.world.resume();
      (this.idleTweens || []).forEach(t => t.resume());
      try { localStorage.setItem(KEY, "1"); } catch(e){}
      this.tweens.add({
        targets: this.intro, alpha: 0, duration: 180, ease: "Quad.easeIn",
        onComplete: ()=> this.intro.setVisible(false)
      });
    };

    // Sperrzeit: Das Loslassen des Fingers vom Menü-Knopf soll den Brief
    // nicht sofort wieder schließen.
    const armedAt = performance.now() + 400;
    const tapClose = ()=> { if (performance.now() >= armedAt) close(); };
    this.intro.setInteractive(
      new Phaser.Geom.Rectangle(-9999,-9999,19999,19999), Phaser.Geom.Rectangle.Contains
    );
    this.intro.on("pointerdown", tapClose);
    this.intro.on("pointerup",   tapClose);
    this.input.keyboard.once("keydown-SPACE", close);
  }

  update(t, dt){
    if (this.gameOver) return;

    // Brief offen? Dann steht wirklich alles still.
    if (this.introOpen){
      this.player.body.setVelocity(0,0);
      return;
    }

    this.updateFish(dt || 16);

    this.bubbles.iterate(c => c.update && c.update());
    if (this.ca){ this.ca.tilePositionX += 0.06 * dt; this.ca.tilePositionY += 0.03 * dt; }

    // Eingaben (Tastatur + Joystick)
    const speed = 300;
    const kx = (this.cursors.left.isDown||this.cursors.a.isDown ? -1 : 0)
             + (this.cursors.right.isDown||this.cursors.d.isDown ? 1 : 0);
    const ky = (this.cursors.up.isDown||this.cursors.w.isDown ? -1 : 0)
             + (this.cursors.down.isDown||this.cursors.s.isDown ? 1 : 0);
    const { x: ix, y: iy } = readAxis(kx, ky);

    if (ix || iy) {
      const len = Math.hypot(ix, iy) || 1;
      this.player.body.setVelocity((ix/len)*speed, (iy/len)*speed);
    } else {
      if (Math.abs(this.player.body.velocity.x) < 6) this.player.body.setVelocityX(0);
      if (Math.abs(this.player.body.velocity.y) < 6) this.player.body.setVelocityY(0);
    }

    // Animationen
    if (this.textures.exists("diver")) {
      // Animation
        if (ix!==0 || iy!==0) {
          if (this.player.anims.currentAnim?.key!=="diver_swim") this.player.play("diver_swim");
          if (ix < 0)      this.player.setFlipX(false); // links
          else if (ix > 0) this.player.setFlipX(true);  // rechts
        } else {
          if (this.player.anims.currentAnim?.key!=="diver_idle") this.player.play("diver_idle");
        }
    }
  }

  // ---- Coins ----
  spawnCoins(){
    this.coins = this.physics.add.group({ allowGravity:false, immovable:true });

    const margin = 60;
    const bounds = { x: margin, y: margin, w: W - margin*2, h: H - margin*2 };
    // Flächen, auf denen keine Münze liegen soll: Startpunkt, Münzzähler,
    // Sauerstoffleiste, Joystick und Menü-Knopf.
    const avoids = [
      { x: W*0.12,  y: H*0.45,  w: 420, h: 300 },
      { x: 0,       y: 0,       w: 380, h: 130 },
      { x: W - 460, y: 0,       w: 460, h: 210 },
      { x: W - 470, y: H - 470, w: 470, h: 470 },
      { x: W/2-230, y: H - 150, w: 460, h: 150 }
    ];

    const positions = this.distributePoints({
      count: this.totalCoins, minDist: 220, bounds, avoids
    });

    // Zielgröße in Pixeln statt fester Skalierung – so bleibt die Münze
    // gleich groß, egal wie groß die Bilddatei ist.
    const COIN_PX = 104;
    const tex = this.textures.get("coin").getSourceImage();
    const coinScale = (tex && tex.width) ? COIN_PX / tex.width : 0.09;

    this.idleTweens = this.idleTweens || [];
    positions.forEach(([x,y], i)=>{
      const c = this.coins.create(x,y,"coin").setScale(coinScale);
      c.setAlpha(0.95);
      // Schweben
      this.idleTweens.push(this.tweens.add({
        targets:c, y:y-14, duration:1200, yoyo:true, repeat:-1,
        ease:"sine.inOut", delay: i*120
      }));
      // Drehen: die Münze wird schmal und wieder breit
      this.idleTweens.push(this.tweens.add({
        targets:c, scaleX: coinScale*0.22, duration:1300, yoyo:true, repeat:-1,
        ease:"sine.inOut", delay: 300 + i*160
      }));
    });

    this.physics.add.overlap(this.player, this.coins, (_p, coin)=> this.collectCoin(coin));
  }

  collectCoin(coin){
    if (!coin.active) return;
    coin.disableBody(true,true);
    this.collected++;
    this.uiCoins.setText(`Münzen: ${this.collected} / ${this.totalCoins}`);
    const s = this.add.circle(coin.x, coin.y, 3, 0xffe062).setAlpha(0.9);
    this.tweens.add({ targets:s, scale:6, alpha:0, duration:350, onComplete:()=>s.destroy() });
    if (this.collected>=this.totalCoins) this.win();
  }

  // ---- Triggerfische ----
  spawnTriggerfish(){
    this.fishGroup = this.physics.add.group({ allowGravity:false });

    const margin = 60;
    const bounds = { x: margin, y: margin, w: W - margin*2, h: H - margin*2 };
    const avoids = [
      { x: W*0.10, y: H*0.40, w: 520, h: 360 },
      { x: 0,      y: 0,      w: 360, h: 140 }
    ];

    const fishCount = 6;
    const fishPos = this.distributePoints({
      count: fishCount, minDist: 320, bounds, avoids
    });

    this.fishList = [];

    fishPos.forEach(([x,y],i)=>{
      const f = this.fishGroup.create(x,y,"triggerfish").setAlpha(0.95);

      const targetW = 250;   // Breite in px → kleine Fische
      const baseW   = f.width;
      f.setScale(targetW / baseW);

      const bw = f.displayWidth*0.78, bh = f.displayHeight*0.70;
      f.body.setSize(bw, bh).setOffset((f.displayWidth-bw)/2,(f.displayHeight-bh)/2);

      // Zustand fürs freie Umherschwimmen (siehe updateFish)
      f.dir       = Phaser.Math.FloatBetween(0, Math.PI*2);
      f.targetDir = f.dir;
      f.speed     = Phaser.Math.FloatBetween(38, 62);
      f.turnTimer = Phaser.Math.FloatBetween(0.4, 2.4);
      f.bobPhase  = Phaser.Math.FloatBetween(0, Math.PI*2);
      f.bobSpeed  = Phaser.Math.FloatBetween(1.6, 2.6);
      f.bobAmp    = Phaser.Math.FloatBetween(10, 22);

      this.fishList.push(f);
    });

    this.physics.add.overlap(this.player, this.fishGroup, ()=> this.hitTriggerfish());
  }

  // Fische schwimmen frei umher: sanfte Kurven, leichtes Auf und Ab,
  // Wenden am Rand. Vorher liefen sie stur auf einer Linie hin und her.
  updateFish(dt){
    if (!this.fishList) return;
    const margin = 130;
    const s = Math.min(dt, 50) / 1000;

    for (const f of this.fishList){
      if (!f.active || !f.body) continue;

      // ab und zu eine neue Wunschrichtung
      f.turnTimer -= s;
      if (f.turnTimer <= 0){
        f.targetDir = f.dir + Phaser.Math.FloatBetween(-1.1, 1.1);
        f.turnTimer = Phaser.Math.FloatBetween(1.6, 3.4);
      }

      // am Rand sanft zur Mitte drehen
      if (f.x < margin || f.x > W - margin || f.y < margin || f.y > H - margin){
        f.targetDir = Math.atan2(H/2 - f.y, W/2 - f.x);
      }

      // weich einlenken statt hart umschalten
      f.dir = Phaser.Math.Angle.RotateTo(f.dir, f.targetDir, 1.4 * s);

      f.bobPhase += f.bobSpeed * s;
      const vx = Math.cos(f.dir) * f.speed;
      const vy = Math.sin(f.dir) * f.speed + Math.sin(f.bobPhase) * f.bobAmp;

      f.body.setVelocity(vx, vy);
      f.setFlipX(vx > 0);                                  // Bild schaut nach links
      f.setAngle(Phaser.Math.RadToDeg(Math.atan2(vy, Math.max(Math.abs(vx), 12))) * 0.4);
    }
  }

  hitTriggerfish(){
    if (this.gameOver || this.introOpen) return;
    this.oxygen = Math.max(0, this.oxygen-8);
    this.updateOxygenBar();
    const knock = new Phaser.Math.Vector2(this.player.body.velocity).normalize().scale(-260);
    this.player.body.velocity.add(knock);
    this.cameras.main.flash(120, 255, 120, 80, false);

    // Kleiner Familienwitz: gesagt hatte ich es ja.
    this.fischTreffer = (this.fischTreffer || 0) + 1;
    const sprueche = [
      "„Du sagst mir jetzt gar nichts mehr!“",
      "Ich hatte gesagt: aus dem Weg.",
      "Der Fisch hatte Vorfahrt.",
      "Immer noch: aus dem Weg gehen.",
      "Drückerfisch 1 : 0 Lisa."
    ];
    const i = Math.min(this.fischTreffer - 1, sprueche.length - 1);
    if (this.note) showNote(this, this.note, sprueche[i], { ms: 1500 });

    if (this.oxygen<=0) this.fail("Gefährliche Begegnung…");
  }

  // ---- Oxygen UI ----
makeOxygenBar(){
  const W = this.scale.width;

  // Layout: rechts 40px Abstand
  const BAR_W = 220;
  const BAR_H = 20;
  const RIGHT_PAD = 200;   // Platz für den Vollbild-Knopf der Seite

  // Linke Kante der Leiste
  const leftX = W - RIGHT_PAD - BAR_W;
  const y     = 58;

  // Hintergrund + Rahmen LINKS-bündig
  const bg = this.add.rectangle(leftX, y, BAR_W, BAR_H, 0xffffff, 0.12)
    .setOrigin(0, 0.5).setScrollFactor(0).setDepth(20);

  const fg = this.add.rectangle(leftX, y, BAR_W, BAR_H, 0x67b7ff, 0.95)
    .setOrigin(0, 0.5).setScrollFactor(0).setDepth(21); // wichtig: Origin (0,0.5) → füllt von links

  const outline = this.add.rectangle(leftX, y, BAR_W, BAR_H)
    .setOrigin(0, 0.5).setStrokeStyle(2, 0xaad4ff, 1)
    .setScrollFactor(0).setDepth(22).setFillStyle(0,0);

  // Label mittig unter der Leiste
  this.add.text(leftX + BAR_W/2, y + 24, "Sauerstoff", {
    fontFamily:"system-ui", fontSize:"14px", color:"#a0c8ff"
  }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(22);

  return { bg, fg, outline, leftX, width: BAR_W };
}

  updateOxygenBar(){
    const p = Phaser.Math.Clamp(this.oxygen/this.oxygenMax,0,1);
    this.oxyBar.fg.scaleX = p;
  }

  // ---- End-Bildschirme ----
  win(){
    if (this.gameOver) return;
    this.gameOver = true;
    this.physics.world.pause();
    this.player.body.setVelocity(0,0);
    if (this.textures.exists("diver")) this.player.play("diver_idle");
    markLevelDone("Level1");                     // schaltet das nächste Level frei
    const nx = nextLevel("Level1");
    this.showEndPanel("Level geschafft!",
      nx ? `${levelTitle(nx)} ist jetzt freigeschaltet.` : "", nx);
  }
  fail(msg){
    if (this.gameOver) return;
    this.gameOver = true;
    this.physics.world.pause();
    this.player.body.setVelocity(0,0);
    this.showEndPanel(msg || "Geschafft ist anders …", "Probier es einfach nochmal.", null, true);
  }
  showEndPanel(title, subtitle, next, retry){
    // HUD und Bedienung aus dem Weg
    if (this.uiCoins) this.uiCoins.setVisible(false);
    if (this.oxyBar){
      Object.values(this.oxyBar).forEach(o => o && o.setVisible && o.setVisible(false));
    }
    makeEndPanel(this, {
      titel: title,
      untertitel: subtitle,
      video: next ? ["assets/video/lisa_ruft.mp4", "assets/video/lisa_ruft.webm"] : null,
      next: next || null,
      nextLabel: next ? levelTitle(next) : "",
      retry: retry === true
    });
  }

  // ---- Helpers ----
  distributePoints({ count, minDist, bounds, avoids = [] }){
    const pts = [], maxTries = 4000;
    const within = ()=>[
      Phaser.Math.Between(bounds.x, bounds.x + bounds.w),
      Phaser.Math.Between(bounds.y, bounds.y + bounds.h)
    ];
    const inRect = (x,y,r)=> x>=r.x && x<=r.x+r.w && y>=r.y && y<=r.y+r.h;

    let tries = 0;
    while (pts.length < count && tries < maxTries){
      tries++;
      let [x,y] = within();
      if (avoids.some(r=>inRect(x,y,r))) continue;
      let ok = true;
      for (const [px,py] of pts){
        if (Phaser.Math.Distance.Between(x,y,px,py) < minDist){ ok=false; break; }
      }
      if (ok) pts.push([x,y]);
    }
    while (pts.length < count){
      let [x,y] = within();
      if (!avoids.some(r=>inRect(x,y,r))) pts.push([x,y]);
    }
    return pts;
  }

  makeBubble(W,H){
    const c = this.add.circle(Phaser.Math.Between(0,W), Phaser.Math.Between(0,H), Phaser.Math.Between(3,6), 0xffffff)
      .setAlpha(Phaser.Math.FloatBetween(0.12,0.35));
    c.speed = Phaser.Math.FloatBetween(10,28);
    c.update = ()=>{ c.y -= c.speed * this.game.loop.delta/1000; if (c.y < -10) { c.y = H+10; c.x = Phaser.Math.Between(0,W);} };
    return c;
  }
  makeFallbackTex(){
    const g=this.add.graphics().fillStyle(0xff4081,1).fillCircle(0,0,30); g.generateTexture("tmpPlayer",64,64); g.destroy();
    return "tmpPlayer";
  }
  fitCover(img,W,H){ if (!img || !img.width) return; img.setScale(Math.max(W/img.width, H/img.height)); }
  safeCoverImage(x,y,key,scroll,W,H){
    if (this.textures.exists(key)) {
      const im=this.add.image(x,y,key).setOrigin(0,0).setScrollFactor(scroll); this.fitCover(im,W,H); return im;
    } else {
      const color = key.includes("back")?0x07314b:key.includes("mid")?0x0b2b3b:0x103e3f;
      return this.add.rectangle(0,0,W,H,color).setOrigin(0,0).setScrollFactor(scroll).setAlpha(0.85);
    }
  }
  updateBodySize(){
    const bw=this.player.displayWidth*0.70, bh=this.player.displayHeight*0.80;
    if (this.player.body?.setSize) this.player.body.setSize(bw,bh,true);
  }
  drawDebug(){
    if (!this._dbgGfx) this._dbgGfx=this.add.graphics().setScrollFactor(1);
    const g=this._dbgGfx; g.clear(); g.lineStyle(2, 0x00ff00, 1);
    const b=this.player.body; g.strokeRect(b.x,b.y,b.width,b.height);
    console.log("Body:",Math.round(b.width),"x",Math.round(b.height),
                "Display:",Math.round(this.player.displayWidth),"x",Math.round(this.player.displayHeight));
  }
}
