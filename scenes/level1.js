// scenes/level1.js
const Phaser = window.Phaser;
const DEBUG = true;

export default class Level1 extends Phaser.Scene {
  constructor(){ super("Level1"); }

  preload(){
    // BG
    this.load.image("l1_back",  "assets/backgrounds/level1_back.png");
    this.load.image("l1_mid",   "assets/backgrounds/level1_mid.png");
    this.load.image("l1_fore",  "assets/backgrounds/level1_fore.png");
    this.load.image("caustics", "assets/backgrounds/caustics_overlay.png");

    // Taucher (5 Frames à 384x384 → 1920x384)
    this.load.spritesheet("diver", "assets/sprites/diver.png", {
      frameWidth: 384, frameHeight: 384, endFrame: 4
    });

    // Münze + Drückerfisch
    this.load.image("coin", "assets/objects/coin.png");
    this.load.image("triggerfish", "assets/objects/triggerfish.png");

    if (DEBUG){
      this.load.on("loaderror", (f)=>console.warn("[LOAD ERROR]", f?.key, f?.src));
    }
  }

  create(){
    const W=1920,H=1080;
    this.cameras.main.setBackgroundColor("#06121f");
    this.cameras.main.setBounds(0,0,W,H);

    // Parallax
    this.back = this.safeCoverImage(0,0,"l1_back",0.25,W,H);
    this.mid  = this.safeCoverImage(0,0,"l1_mid", 0.55,W,H);
    this.fore = this.safeCoverImage(0,0,"l1_fore",0.90,W,H);
    this.ca   = this.textures.exists("caustics")
      ? this.add.tileSprite(0,0,W,H,"caustics").setOrigin(0,0).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.25).setScrollFactor(0.7)
      : null;

    // Spieler
    this.player = this.textures.exists("diver")
      ? this.physics.add.sprite(W*0.25,H*0.55,"diver",0).setScale(0.55)
      : this.physics.add.image(W*0.25,H*0.55, this.makeFallbackTex());
    this.player.setCollideWorldBounds(true);
    this.player.body.setMaxSpeed(480);
    this.updateBodySize();

    // Animationen
    if (this.textures.exists("diver")) {
      this.anims.create({ key:"diver_swim", frames:this.anims.generateFrameNumbers("diver",{start:0,end:4}), frameRate:12, repeat:-1 });
      this.anims.create({ key:"diver_idle", frames:this.anims.generateFrameNumbers("diver",{start:0,end:1}), frameRate:2, repeat:-1 });
      this.player.play("diver_idle");
    }

    // Kamera & Steuerung
    this.cursors = this.input.keyboard.addKeys({ left:"LEFT", right:"RIGHT", up:"UP", down:"DOWN", a:"A", d:"D", w:"W", s:"S", esc:"ESC" });
    this.cameras.main.startFollow(this.player, true, 0.08, 0.08);

    // Bubbles (Deko)
    this.bubbles = this.add.container(0,0).setScrollFactor(0.6);
    for (let i=0;i<32;i++) this.bubbles.add(this.makeBubble(W,H));

    // --- SPIELZUSTAND ---
    this.totalCoins = 8;
    this.collected  = 0;
    this.oxygenMax  = 30; // Sekunden
    this.oxygen     = this.oxygenMax;
    this.gameOver   = false;

    // HUD
    this.uiCoins = this.add.text(24,24,`Münzen: 0 / ${this.totalCoins}`,{
      fontFamily:"system-ui, sans-serif", fontSize:"32px", color:"#e6f0ff"
    }).setScrollFactor(0).setDepth(20);

    this.oxyBar = this.makeOxygenBar();
    this.time.addEvent({ delay: 1000, loop: true, callback: ()=> {
      if (this.gameOver) return;
      this.oxygen = Math.max(0, this.oxygen-1);
      this.updateOxygenBar();
      if (this.oxygen<=0) this.fail("Keine Luft mehr!");
    }});

    // Münzen platzieren (jetzt kleiner)
    this.spawnCoins();

    // Gefährliche Begegnungen: Drückerfische
    this.spawnTriggerfish();

    // ESC → Menü
    this.input.keyboard.on("keydown-ESC", ()=> this.scene.start("MenuScene"));

    // Debug Toggle
    this._dbgGfx=null;
    this.input.keyboard.on("keydown-D", ()=> this.drawDebug());
  }

  update(_t, dt){
    if (this.gameOver) return;
    this.bubbles.iterate(c => c.update && c.update());
    if (this.ca){ this.ca.tilePositionX += 0.06 * dt; this.ca.tilePositionY += 0.03 * dt; }

    const s=380;
    const vx = (this.cursors.left.isDown||this.cursors.a.isDown ? -1 : 0)
             + (this.cursors.right.isDown||this.cursors.d.isDown ? 1 : 0);
    const vy = (this.cursors.up.isDown||this.cursors.w.isDown ? -1 : 0)
             + (this.cursors.down.isDown||this.cursors.s.isDown ? 1 : 0);
    this.player.body.setVelocity(vx*s, vy*s);

    // leichte Strömung
    const current = Math.sin(_t/1500)*40;
    this.player.body.velocity.x += current;

    if (this.textures.exists("diver")) {
      if (vx!==0 || vy!==0) {
        if (this.player.anims.currentAnim?.key!=="diver_swim") this.player.play("diver_swim");
        this.player.setFlipX(vx<0);
      } else {
        if (this.player.anims.currentAnim?.key!=="diver_idle") this.player.play("diver_idle");
      }
    }
  }

  // ---- Coins ----
 spawnCoins(){
  const W=1920, H=1080;
  this.coins = this.physics.add.group({ allowGravity:false, immovable:true });

  // Punkte halbwegs gleichmäßig verteilen (Poisson-ähnlich)
  const positions = this.distributePoints({
    count: this.totalCoins,
    minDist: 180,                 // Mindestabstand zwischen Coins
    bounds: { x: 120, y: 140, w: W-240, h: H-260 }, // Rand lassen
    avoid:  { x: W*0.20, y: H*0.45, w: 360, h: 260 } // Startbereich des Spielers meiden
  });

  positions.forEach(([x,y])=>{
    const c = this.coins.create(x,y,"coin").setScale(0.5);
    c.setAlpha(0.95);
    this.tweens.add({ targets:c, y:y-10, duration:1300, yoyo:true, repeat:-1, ease:"sine.inOut" });
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

  // ---- Gegner: Drückerfisch ----
spawnTriggerfish(){
  const W=1920, H=1080;
  this.fishGroup = this.physics.add.group({ allowGravity:false });

  // 5 Fische breit streuen
  const fishPos = this.distributePoints({
    count: 5,
    minDist: 260,                                   // weiter auseinander
    bounds: { x: 180, y: 160, w: W-360, h: H-320 }, // großzügiger Rand
    avoid:  { x: W*0.18, y: H*0.42, w: 420, h: 300 } // Spielerstart meiden
  });

  fishPos.forEach(([x,y],i)=>{
    const f = this.fishGroup.create(x,y,"triggerfish").setScale(0.35).setAlpha(0.95);

    // ovale Hitbox
    const bw = f.displayWidth*0.75, bh = f.displayHeight*0.55;
    f.body.setSize(bw, bh).setOffset((f.displayWidth-bw)/2,(f.displayHeight-bh)/2);

    // Zufällige Patrouille: horizontal ODER vertikal
    const horizontal = Math.random() < 0.6;    // 60% horizontal
    const range = Phaser.Math.Between(120, 220);
    const dur   = Phaser.Math.Between(2200, 3200);
    const angle = horizontal ? 6 : 0;

    this.tweens.add({
      targets: f,
      x: horizontal ? x + range : x,
      y: horizontal ? y : y + range,
      angle: (i%2 ? -angle : angle),
      duration: dur,
      yoyo: true,
      repeat: -1,
      ease: "sine.inOut",
      onUpdate: () => { f.setFlipX(f.body.velocity.x < 0); }
    });
  });

  this.physics.add.overlap(this.player, this.fishGroup, ()=> this.hitTriggerfish());
}

  hitTriggerfish(){
    if (this.gameOver) return;
    // Sauerstoff-Penalty & kurzer Rückstoß
    this.oxygen = Math.max(0, this.oxygen-8);
    this.updateOxygenBar();
    const knock = new Phaser.Math.Vector2(this.player.body.velocity).normalize().scale(-260);
    this.player.body.velocity.add(knock);
    this.cameras.main.flash(120, 255, 120, 80, false);
    if (this.oxygen<=0) this.fail("Gefährliche Begegnung…");
  }

  // ---- Oxygen UI ----
  makeOxygenBar(){
    const W=this.scale.width;
    const bg=this.add.rectangle(W-260, 40, 220, 20, 0xffffff, 0.12).setScrollFactor(0).setDepth(20);
    const fg=this.add.rectangle(W-260, 40, 220, 20, 0x67b7ff, 0.95).setOrigin(0,0.5).setScrollFactor(0).setDepth(21);
    const outline=this.add.rectangle(W-260, 40, 220, 20).setStrokeStyle(2,0xaad4ff,1).setScrollFactor(0).setDepth(22).setFillStyle(0,0);
    this.add.text(W-260, 64, "Sauerstoff", { fontFamily:"system-ui", fontSize:"14px", color:"#a0c8ff"}).setScrollFactor(0).setDepth(22);
    return {bg,fg,outline};
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
    const W=this.scale.width,H=this.scale.height;
    const dim = this.add.rectangle(W/2,H/2,W, H, 0x000000, 0.55).setScrollFactor(0).setDepth(100);
    const panel = this.add.rectangle(W/2,H/2, 680, 320, 0x071a2b, 0.95).setScrollFactor(0).setDepth(101);
    this.add.text(W/2, H/2-90, title, { fontFamily:"system-ui", fontSize:"36px", color:"#e6f0ff"}).setOrigin(0.5).setScrollFactor(0).setDepth(102);

    const makeBtn = (txt, y, onClick)=>{
      const r=this.add.rectangle(W/2, y, 260, 56, 0x0d2e46, 1).setScrollFactor(0).setDepth(102).setInteractive({ useHandCursor:true });
      const t=this.add.text(W/2, y, txt, { fontFamily:"system-ui", fontSize:"22px", color:"#cfe9ff"}).setOrigin(0.5).setScrollFactor(0).setDepth(103);
      r.on("pointerover", ()=>r.setFillStyle(0x134062,1));
      r.on("pointerout",  ()=>r.setFillStyle(0x0d2e46,1));
      r.on("pointerdown", ()=>{ onClick(); dim.destroy(); panel.destroy(); r.destroy(); t.destroy(); });
    };
    makeBtn("Nochmal", H/2+10, ()=> this.scene.restart());
    makeBtn("Zum Menü", H/2+80, ()=> this.scene.start("MenuScene"));
  }

  // ---- Helpers ----
  // verteilt 'count' Punkte gleichmäßig in bounds, mit Mindestabstand + Avoid-Rect
distributePoints({ count, minDist, bounds, avoid }){
  const pts = [];
  const maxTries = 2000;

  const within = ()=>[
    Phaser.Math.Between(bounds.x, bounds.x + bounds.w),
    Phaser.Math.Between(bounds.y, bounds.y + bounds.h)
  ];
  const inRect = (x,y,r)=> x>=r.x && x<=r.x+r.w && y>=r.y && y<=r.y+r.h;

  let tries = 0;
  while (pts.length < count && tries < maxTries){
    tries++;
    let [x,y] = within();
    if (avoid && inRect(x,y,avoid)) continue;

    let ok = true;
    for (const [px,py] of pts){
      if (Phaser.Math.Distance.Between(x,y,px,py) < minDist){ ok=false; break; }
    }
    if (ok) pts.push([x,y]);
  }

  // Fallback: wenn es knapp wurde, fülle restlich zufällig (ohne Mindestabstand)
  while (pts.length < count){
    let [x,y] = within();
    if (!avoid || !inRect(x,y,avoid)) pts.push([x,y]);
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
    const bw=this.player.displayWidth*0.45, bh=this.player.displayHeight*0.55;
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

