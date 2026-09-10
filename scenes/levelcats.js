// scenes/levelcats.js
// "Die zwei Katzen" – Wohnung von oben, eine Bildschirmseite, kein Scrollen.
//
// Aufgabe: drei Teile der Tauchausrüstung zurückholen. Eins liegt in einem
// Möbelstück, zwei haben die Katzen im Maul. Direkt hinterherlaufen bringt
// nichts – die Katzen fliehen. Man muss sie mit Futter an den Napf locken.
const Phaser = window.Phaser;
import { readAxis, startTouch, touchEnabled } from "./touch.js";
import { markLevelDone, levelTitle, nextLevel } from "../progress.js";
import { makeLetter, makeNote, showNote, SERIF } from "./ui.js";

const W = 1920, H = 1080;
const WALL = 48;

// Die Teile, die gesucht werden
const GEAR = [
  { id:"mask", tex:"gear_mask", name:"Maske" },
  { id:"fins", tex:"gear_fins", name:"Flossen" },
  { id:"lamp", tex:"gear_lamp", name:"Lampe" }
];

// Möbel: Bild, Position, Größe des blockierenden Bereichs, Spruch beim Suchen.
// durchsuchbar = true → hier kann das versteckte Teil liegen.
// Wichtig: die Ecken unten links (Aktionsknopf), unten rechts (Joystick) und
// unten mittig (Menü) bleiben frei, sonst liegen die Möbel unter den Knöpfen.
const MOEBEL = [
  { id:"sofa",   tex:"sofa",        x: 340, y: 250, w: 360, h: 210, such:true,
    leer:"Unter dem Sofa: drei Haargummis und ein Stück Trockenfutter." },
  { id:"regal",  tex:"shelf",       x: 148, y: 500, w: 180, h: 360, such:true,
    leer:"Nur Bücher. Sehr viele Bücher." },
  { id:"pflanze",tex:"plant",       x: 560, y: 560, w: 120, h: 110, such:false },
  { id:"tisch",  tex:"table",       x: 960, y: 230, w: 260, h: 160, such:true,
    leer:"Auf dem Tisch: kalter Kaffee. Sonst nichts." },
  { id:"kratz",  tex:"scratchpost", x: 880, y: 640, w: 170, h: 200, such:true,
    leer:"Der Kratzbaum ist voller Fell. Aber leer." },
  { id:"bett",   tex:"bed",         x:1620, y: 270, w: 320, h: 280, such:true,
    leer:"Im Bett: nur eine zerwühlte Decke." },
  { id:"kommode",tex:"dresser",     x:1500, y: 640, w: 260, h: 130, such:true,
    leer:"Schublade auf, Schublade zu. Socken." },
  { id:"pflanze2",tex:"plant",      x:1800, y: 600, w: 110, h: 100, such:false }
];

export default class LevelCats extends Phaser.Scene {
  constructor(){ super("LevelCats"); }

  preload(){
    const p = "assets/objects/cats/";
    this.load.image("floor_wood",  p+"floor_wood.png");
    this.load.image("wall_home",   p+"wall_home.png");
    this.load.image("rug",         p+"rug.png");
    this.load.image("bowl",        p+"bowl.png");
    for (const m of ["sofa","shelf","bed","table","dresser","scratchpost","plant"]) {
      this.load.image(m, p+m+".png");
    }
    for (const g of GEAR) this.load.image(g.tex, p+g.tex+".png");
    this.load.image("cat_a", p+"cat_a.png");
    this.load.image("cat_b", p+"cat_b.png");

    if (!this.textures.exists("diver")){
      this.load.spritesheet("diver", "assets/sprites/diver_v4_1920x1920.png",
        { frameWidth:480, frameHeight:480, endFrame:15 });
    }
    if (!this.textures.exists("parchment")){
      this.load.image("parchment", "assets/objects/level2/parchment.png");
    }
  }

  create(){
    this.cameras.main.setBackgroundColor("#1b1410");
    this.cameras.main.setBounds(0,0,W,H);
    this.physics.world.setBounds(WALL, WALL, W-WALL*2, H-WALL*2);

    this.gefunden = {};          // id -> true
    this.futter   = 3;
    this.fertig   = false;
    this.suchVersuche = 0;
    this.hinweisGegeben = false;

    this.buildRoom();
    this.buildFurniture();
    this.buildPlayer();
    this.buildCats();
    this.buildHud();

    this.note = makeNote(this, { width: 700, y: 0.20 });

    // Steuerung
    this.keys = this.input.keyboard.addKeys({
      left:"LEFT", right:"RIGHT", up:"UP", down:"DOWN",
      a:"A", d:"D", w:"W", s:"S", space:"SPACE", e:"E", esc:"ESC"
    });
    const toMenu = ()=> this.scene.start("MenuScene");
    this.input.keyboard.on("keydown-ESC", toMenu);
    this.game.events.on("touch-menu", toMenu);
    const onAction = ()=> this.aktion();
    this.game.events.on("touch-action", onAction);
    this.input.keyboard.on("keydown-SPACE", onAction);
    this.input.keyboard.on("keydown-E", onAction);
    this.events.once("shutdown", ()=>{
      this.game.events.off("touch-menu", toMenu);
      this.game.events.off("touch-action", onAction);
    });
    startTouch(this, { action:true, label:"🐟" });

    this.showIntroLetter();
  }

  // ---------- Wohnung ----------
  buildRoom(){
    this.add.tileSprite(0,0,W,H,"floor_wood").setOrigin(0,0).setDepth(-20);
    // Teppich im Wohnzimmer
    this.add.image(370, 780, "rug").setDepth(-19).setAlpha(0.95).setDisplaySize(520, 350);

    this.walls = this.physics.add.staticGroup();
    const wand = (x,y,w,h)=>{
      const s = this.add.tileSprite(x, y, w, h, "wall_home").setOrigin(0,0).setDepth(5);
      const body = this.add.rectangle(x + w/2, y + h/2, w, h, 0x000000, 0);
      this.physics.add.existing(body, true);
      this.walls.add(body);
      // dunkle Kante, damit die Wand Tiefe bekommt
      this.add.rectangle(x, y, w, h).setOrigin(0,0)
        .setStrokeStyle(3, 0x6d6154, 0.9).setDepth(6);
      return s;
    };
    // Außenwände
    wand(0, 0, W, WALL);
    wand(0, H-WALL, W, WALL);
    wand(0, 0, WALL, H);
    wand(W-WALL, 0, WALL, H);
    // Innenwände mit Durchgängen
    wand(640-24, WALL, 48, 400-WALL);
    wand(640-24, 640, 48, H-WALL-640);
    wand(1280-24, WALL, 48, 700-WALL);
    wand(1280-24, 900, 48, H-WALL-900);
  }

  buildFurniture(){
    this.moebel = this.physics.add.staticGroup();
    this.suchbar = [];

    for (const m of MOEBEL){
      const img = this.add.image(m.x, m.y, m.tex).setDepth(m.y/10);
      // Bilder haben einen Schatten-Rand – Anzeigegröße etwas größer als der Block
      img.setDisplaySize(m.w * 1.22, m.h * 1.30);

      const body = this.add.rectangle(m.x, m.y + 6, m.w, m.h, 0x000000, 0);
      this.physics.add.existing(body, true);
      this.moebel.add(body);
      body.setData("id", m.id);

      if (m.such){
        const eintrag = Object.assign({}, m, { img });
        this.suchbar.push(eintrag);
      }
    }

    // In genau einem Möbelstück liegt ein Teil
    this.versteck = Phaser.Math.RND.pick(this.suchbar);
    this.versteckTeil = GEAR[0];         // die Maske liegt herum
  }

  buildPlayer(){
    this.player = this.textures.exists("diver")
      ? this.physics.add.sprite(860, 470, "diver", 0).setScale(0.34)
      : this.physics.add.image(860, 470, "__DEFAULT");
    this.player.setDepth(500);
    this.player.setCollideWorldBounds(true);
    this.player.body.setDrag(1400, 1400);
    this.player.body.setMaxVelocity(300, 300);

    const fw = (this.player.frame && this.player.frame.width) || this.player.width;
    const fh = (this.player.frame && this.player.frame.height) || this.player.height;
    const sc = Math.abs(this.player.scaleX) || 1;
    const r  = 34 / sc;
    this.player.body.setCircle(r, fw/2 - r, fh/2 - r);

    if (this.textures.exists("diver") && !this.anims.exists("diver_swim")){
      this.anims.create({ key:"diver_swim",
        frames:this.anims.generateFrameNumbers("diver",{start:0,end:15}), frameRate:10, repeat:-1 });
      this.anims.create({ key:"diver_idle",
        frames:this.anims.generateFrameNumbers("diver",{start:0,end:1}), frameRate:2, repeat:-1 });
    }
    if (this.textures.exists("diver")) this.player.play("diver_idle");

    this.physics.add.collider(this.player, this.walls);
    this.physics.add.collider(this.player, this.moebel);
  }

  buildCats(){
    this.cats = this.physics.add.group();
    const mk = (x, y, tex, name, teil)=>{
      const c = this.cats.create(x, y, tex).setDepth(480);
      c.setScale(0.9);
      c.body.setSize(c.width*0.62, c.height*0.62);
      c.body.setOffset(c.width*0.19, c.height*0.30);
      c.setCollideWorldBounds(true);
      c.setData("name", name);
      c.setData("teil", teil);      // GEAR-Eintrag oder null
      c.setData("state", "roam");
      c.setData("timer", 0);
      c.setData("target", null);
      // Symbol über der Katze: das, was sie im Maul hat
      const icon = this.add.image(x, y-70, teil.tex).setDepth(490).setDisplaySize(64, 46);
      c.setData("icon", icon);
      this.tweens.add({ targets: icon, y: "-=8", duration: 780, yoyo:true, repeat:-1, ease:"Sine.easeInOut" });
      return c;
    };
    this.katzeA = mk(1000, 860, "cat_a", "Katze 1", GEAR[1]);
    this.katzeB = mk(1640, 480, "cat_b", "Katze 2", GEAR[2]);

    this.physics.add.collider(this.cats, this.walls);
    this.physics.add.collider(this.cats, this.moebel);
    this.physics.add.collider(this.cats, this.cats);

    this.napf = null;
  }

  buildHud(){
    this.hud = this.add.container(0,0).setDepth(9000).setScrollFactor(0);
    const box = this.add.rectangle(30, 26, 430, 92, 0x120d0a, 0.62)
      .setOrigin(0,0).setStrokeStyle(2, 0xd8c9a8, 0.35);
    this.hud.add(box);

    this.hudIcons = {};
    GEAR.forEach((g, i)=>{
      const x = 78 + i*136, y = 72;
      const ico = this.add.image(x, y, g.tex).setDisplaySize(74, 54).setAlpha(0.22);
      const txt = this.add.text(x, y+30, g.name, {
        fontFamily:"system-ui, sans-serif", fontSize:"16px", color:"#e8dcc2"
      }).setOrigin(0.5).setAlpha(0.4);
      this.hudIcons[g.id] = { ico, txt };
      this.hud.add([ico, txt]);
    });

    this.futterTxt = this.add.text(W-40, 40, "🐟 Futter: 3", {
      fontFamily:"system-ui, sans-serif", fontSize:"28px", color:"#f0e4c8",
      stroke:"#000", strokeThickness:3
    }).setOrigin(1,0).setDepth(9000).setScrollFactor(0);

    // Hinweis direkt über der Spielerin, was der Knopf gerade macht
    this.aktionHint = this.add.text(0, 0, "", {
      fontFamily:"system-ui, sans-serif", fontSize:"20px", color:"#fff2d0",
      stroke:"#241a12", strokeThickness:4
    }).setOrigin(0.5, 1).setDepth(8000).setAlpha(0);
  }

  // ---------- Brief ----------
  showIntroLetter(){
    const KEY = "cats_intro_seen_v1";
    this.introOpen = false;
    let seen = false;
    try { seen = localStorage.getItem(KEY) === "1"; } catch(e){}
    if (seen) return;

    const brief =
`Bevor es in die Thermen geht: Deine Ausrüstung ist weg.
Maske, Flossen und Lampe – alle drei.

Zwei davon tragen die Katzen durch die Wohnung. Wenn Du
auf sie zuläufst, rennen sie weg. Leg ihnen lieber Futter
hin und schnapp sie Dir, während sie fressen.

Das dritte Teil liegt in einem Möbelstück. Stell Dich davor
und drück den Knopf, um nachzusehen.`;

    this.intro = makeLetter(this, {
      body: brief,
      footer: touchEnabled()
        ? "Joystick rechts bewegt Dich · 🐟 links = Futter / Suchen"
        : "Pfeiltasten oder [WASD] bewegen · [Leertaste] Futter / Suchen",
      hint: touchEnabled() ? "Tippe auf den Bildschirm, um loszulegen" : "[Leertaste] zum Starten"
    });

    this.introOpen = true;
    this.physics.world.pause();
    this.intro.setVisible(true);
    this.tweens.add({ targets:this.intro, alpha:1, duration:160, ease:"Quad.easeOut" });

    const close = ()=>{
      if (!this.introOpen) return;
      this.introOpen = false;
      this.physics.world.resume();
      try { localStorage.setItem(KEY, "1"); } catch(e){}
      this.tweens.add({ targets:this.intro, alpha:0, duration:180, ease:"Quad.easeIn",
        onComplete: ()=> this.intro.setVisible(false) });
    };
    const armedAt = performance.now() + 400;
    const tapClose = ()=> { if (performance.now() >= armedAt) close(); };
    this.intro.setInteractive(new Phaser.Geom.Rectangle(-9999,-9999,19999,19999),
                              Phaser.Geom.Rectangle.Contains);
    this.intro.on("pointerdown", tapClose);
    this.intro.on("pointerup",   tapClose);
    this.input.keyboard.once("keydown-SPACE", close);
  }

  // ---------- Aktionsknopf ----------
  aktion(){
    if (this.fertig || this.introOpen) return;

    const m = this.naechstesMoebel();
    if (m){ this.durchsuchen(m); return; }
    this.futterHinlegen();
  }

  naechstesMoebel(){
    let best = null, bestD = 200;
    for (const m of this.suchbar){
      const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, m.x, m.y);
      if (d < bestD){ bestD = d; best = m; }
    }
    return best;
  }

  durchsuchen(m){
    if (m.leer2){ showNote(this, this.note, "Da hast Du schon nachgesehen."); return; }
    m.leer2 = true;

    if (m === this.versteck && !this.gefunden[this.versteckTeil.id]){
      this.teilGefunden(this.versteckTeil, `Da ist sie ja! ${this.versteckTeil.name} gefunden.`);
      return;
    }
    this.suchVersuche++;
    showNote(this, this.note, m.leer || "Nichts.", { ms: 1300 });

    // Freundlicher Tipp, falls es zu lange dauert
    if (!this.hinweisGegeben && this.suchVersuche >= 3 && !this.gefunden[this.versteckTeil.id]){
      this.hinweisGegeben = true;
      this.time.delayedCall(1800, ()=>{
        if (this.gefunden[this.versteckTeil.id]) return;
        this.markiereVersteck();
      });
    }
  }

  markiereVersteck(){
    const v = this.versteck;
    showNote(this, this.note, "Such mal da, wo der Pfeil blinkt.", { ms: 1600 });
    const pfeil = this.add.text(v.x, v.y - v.h/2 - 60, "▼", {
      fontFamily:"system-ui, sans-serif", fontSize:"56px", color:"#ffd86b",
      stroke:"#3a2a10", strokeThickness:6
    }).setOrigin(0.5).setDepth(7000);
    this.tweens.add({ targets: pfeil, y: "+=16", alpha: 0.45, duration: 620,
                      yoyo:true, repeat:-1, ease:"Sine.easeInOut" });
    this.versteckPfeil = pfeil;
  }

  futterHinlegen(){
    if (this.futter <= 0){
      showNote(this, this.note, "Kein Futter mehr. Die Katzen wissen das.");
      return;
    }
    if (this.napf && this.napf.active){ this.napf.destroy(); }
    this.futter--;
    this.futterTxt.setText(`🐟 Futter: ${this.futter}`);

    this.napf = this.add.image(this.player.x, this.player.y + 40, "bowl")
      .setDisplaySize(86, 86).setDepth(400);
    this.tweens.add({ targets:this.napf, scale: this.napf.scale*1.12, duration:420,
                      yoyo:true, repeat:2, ease:"Sine.easeInOut" });

    // Die nächstgelegene Katze, die noch etwas trägt, kommt fressen
    let ziel = null, bestD = Infinity;
    this.cats.getChildren().forEach(c=>{
      if (!c.getData("teil")) return;
      const d = Phaser.Math.Distance.Between(c.x, c.y, this.napf.x, this.napf.y);
      if (d < bestD){ bestD = d; ziel = c; }
    });
    if (ziel){
      ziel.setData("state", "toBowl");
      ziel.setData("timer", 0);
      showNote(this, this.note, `${ziel.getData("name")} hat das gerochen …`, { ms: 1200 });
    }
  }

  teilGefunden(teil, msg){
    this.gefunden[teil.id] = true;
    const h = this.hudIcons[teil.id];
    if (h){
      h.ico.setAlpha(1); h.txt.setAlpha(1);
      this.tweens.add({ targets:h.ico, scale: h.ico.scale*1.3, duration:180, yoyo:true });
    }
    if (this.versteckPfeil){ this.versteckPfeil.destroy(); this.versteckPfeil = null; }
    showNote(this, this.note, msg, { icon: teil.tex, ms: 1500 });

    if (GEAR.every(g => this.gefunden[g.id])) setTimeout(()=> this.win(), 1200);
  }

  // ---------- Katzenlogik ----------
  updateCats(dtMs){
    const dt = Math.min(dtMs, 50) / 1000;

    this.cats.getChildren().forEach(c=>{
      const st = c.getData("state");
      const icon = c.getData("icon");
      const teil = c.getData("teil");

      if (icon){
        icon.setPosition(c.x, icon.y);      // x folgt, y macht der Tween
        if (!teil) icon.setVisible(false);
      }

      const dPlayer = Phaser.Math.Distance.Between(c.x, c.y, this.player.x, this.player.y);

      // Fressen: still halten, greifbar
      if (st === "eat"){
        c.setVelocity(0,0);
        c.setData("timer", c.getData("timer") - dt);
        if (dPlayer < 92 && teil){
          c.setData("teil", null);
          c.setData("state", "flee");
          c.setData("timer", 1.4);
          if (icon) icon.setVisible(false);
          this.teilGefunden(teil, `${c.getData("name")} gibt die ${teil.name} her.`);
          return;
        }
        if (c.getData("timer") <= 0){
          c.setData("state", "roam"); c.setData("timer", 0); c.setData("target", null);
          if (this.napf){ this.napf.destroy(); this.napf = null; }
        }
        return;
      }

      // Zum Napf laufen
      if (st === "toBowl"){
        if (!this.napf || !this.napf.active){ c.setData("state","roam"); return; }
        const d = Phaser.Math.Distance.Between(c.x, c.y, this.napf.x, this.napf.y);
        if (d < 60){
          c.setData("state", "eat"); c.setData("timer", 4.5);
          c.setVelocity(0,0);
          showNote(this, this.note, "Jetzt! Schnapp sie Dir, solange sie frisst.", { ms: 1400 });
          return;
        }
        this.laufeZu(c, this.napf.x, this.napf.y, 230);
        return;
      }

      // Flucht
      if (st === "flee"){
        c.setData("timer", c.getData("timer") - dt);
        if (c.getData("timer") <= 0){ c.setData("state","roam"); c.setData("target", null); }
        else {
          const a = Math.atan2(c.y - this.player.y, c.x - this.player.x);
          c.setVelocity(Math.cos(a)*330, Math.sin(a)*330);
          c.setFlipX(Math.cos(a) < 0);
          return;
        }
      }

      // Herumstromern – und abhauen, wenn man zu nah kommt
      if (teil && dPlayer < 250){
        c.setData("state","flee"); c.setData("timer", 1.5);
        return;
      }

      let t = c.getData("target");
      c.setData("timer", c.getData("timer") - dt);
      if (!t || c.getData("timer") <= 0 ||
          Phaser.Math.Distance.Between(c.x, c.y, t.x, t.y) < 50){
        t = { x: Phaser.Math.Between(WALL+120, W-WALL-120),
              y: Phaser.Math.Between(WALL+120, H-WALL-120) };
        c.setData("target", t);
        c.setData("timer", Phaser.Math.FloatBetween(2.5, 4.5));
      }
      this.laufeZu(c, t.x, t.y, 125);
    });
  }

  laufeZu(c, x, y, speed){
    const a = Math.atan2(y - c.y, x - c.x);
    c.setVelocity(Math.cos(a)*speed, Math.sin(a)*speed);
    c.setFlipX(Math.cos(a) < 0);
  }

  // ---------- Update ----------
  update(time, delta){
    if (this.fertig) return;
    if (this.introOpen){
      if (this.player && this.player.body) this.player.setVelocity(0,0);
      return;
    }

    const k = this.keys;
    let kx = 0, ky = 0;
    if (k.left.isDown  || k.a.isDown) kx -= 1;
    if (k.right.isDown || k.d.isDown) kx += 1;
    if (k.up.isDown    || k.w.isDown) ky -= 1;
    if (k.down.isDown  || k.s.isDown) ky += 1;
    const ax = readAxis(kx, ky);

    const ACC = 1900;
    this.player.setAcceleration(ax.x * ACC, ax.y * ACC);
    if (ax.x !== 0) this.player.setFlipX(ax.x < 0);

    const moving = Math.hypot(this.player.body.velocity.x, this.player.body.velocity.y) > 30;
    if (this.textures.exists("diver")){
      const want = moving ? "diver_swim" : "diver_idle";
      if (!this.player.anims.currentAnim || this.player.anims.currentAnim.key !== want){
        this.player.play(want, true);
      }
    }

    this.updateCats(delta);

    // Hinweis über dem Kopf: was macht der Knopf gerade?
    const m = this.naechstesMoebel();
    const label = m ? "Nachsehen" : (this.futter > 0 ? "Futter hinlegen" : "");
    this.aktionHint.setText(label);
    this.aktionHint.setPosition(this.player.x, this.player.y - 62);
    this.aktionHint.setAlpha(label ? 0.95 : 0);
  }

  // ---------- Ende ----------
  win(){
    if (this.fertig) return;
    this.fertig = true;
    this.physics.world.pause();
    this.player.setVelocity(0,0);
    markLevelDone("LevelCats");
    const nx = nextLevel("LevelCats");
    this.showEndPanel("Ausrüstung komplett! 🤿",
      nx ? `${levelTitle(nx)} ist jetzt freigeschaltet.` : "");
  }

  showEndPanel(title, subtitle){
    const dim = this.add.rectangle(W/2,H/2,W,H,0x000000,0.6).setScrollFactor(0).setDepth(20000);
    const panel = this.add.rectangle(W/2,H/2,760,320,0x1b1209,0.97)
      .setStrokeStyle(3, 0xd8c9a8, 0.8).setScrollFactor(0).setDepth(20001);
    this.add.text(W/2, H/2-96, title, {
      fontFamily:SERIF, fontSize:"38px", color:"#f4e7cd", fontStyle:"italic"
    }).setOrigin(0.5).setDepth(20002);
    if (subtitle){
      this.add.text(W/2, H/2-44, subtitle, {
        fontFamily:"system-ui, sans-serif", fontSize:"22px", color:"#d3bd97"
      }).setOrigin(0.5).setDepth(20002);
    }
    const btn = (txt, y, cb)=>{
      const r = this.add.rectangle(W/2, y, 300, 62, 0x3a2a18, 1)
        .setStrokeStyle(2, 0xd8c9a8, 0.7).setDepth(20002).setInteractive({useHandCursor:true});
      this.add.text(W/2, y, txt, {
        fontFamily:"system-ui, sans-serif", fontSize:"24px", color:"#f4e7cd"
      }).setOrigin(0.5).setDepth(20003);
      r.on("pointerdown", cb);
    };
    btn("Weiter", H/2+30, ()=> this.scene.start("MenuScene"));
    btn("Nochmal", H/2+108, ()=> this.scene.restart());
    void dim; void panel;
  }
}
