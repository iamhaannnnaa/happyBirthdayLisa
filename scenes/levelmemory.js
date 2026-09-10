// scenes/levelmemory.js
// "Erinnerungs-Tauchgang" – an jeder Station kommt eine Frage auf Pergament,
// im Wasser schweben drei Antwortblasen. In die richtige reinschwimmen.
// Richtig: ein Polaroid klappt auf. Falsch: die Blase platzt, Luft ist weg.
//
// Fragen, Antworten und Polaroid-Texte stehen unten in FRAGEN – dort kannst
// Du alles ändern, ohne den Rest anzufassen. foto: Dateiname ohne Endung in
// assets/objects/memories/ (weglassen = nur Text auf dem Polaroid).
const Phaser = window.Phaser;
import { readAxis, startTouch, touchEnabled } from "./touch.js";
import { markLevelDone, levelTitle, nextLevel } from "../progress.js";
import { makeLetter, makeNote, showNote, SERIF, INK } from "./ui.js";

// Bühnenmaße – in create() an den Bildschirm angepasst (siehe main.js)
let W = 1920, H = 1080;
const REF_W = 1920;   // Bezugsbreite, auf der die Stationen geplant sind

export const FRAGEN = [
  {
    frage: "Wo sind wir mit Delfinen geschwommen?",
    antworten: ["Mexiko", "Malediven", "Kroatien"],
    richtig: 0,
    foto: "memo_delfine",
    notiz: "Delfine in Mexiko – Du wolltest gar nicht mehr aus dem Wasser."
  },
  {
    frage: "Welcher Riese ist uns beim Tauchen begegnet?",
    antworten: ["Walhai", "Schwertfisch", "Zackenbarsch"],
    richtig: 0,
    foto: "memo_walhai",
    notiz: "Ein Walhai. Größer als das Boot und völlig entspannt."
  },
  {
    frage: "Wer gleitet wie ein fliegender Teppich durchs Wasser?",
    antworten: ["Manta", "Seestern", "Krake"],
    richtig: 0,
    foto: "memo_manta",
    notiz: "Mantas – lautlos über uns weggeflogen."
  },
  {
    frage: "Auf welcher Insel waren wir?",
    antworten: ["Hawaii", "Bali", "Kreta"],
    richtig: 0,
    foto: "memo_hawaii",
    notiz: "Hawaii. Schwarzer Sand und viel zu viele Fotos."
  },
  {
    frage: "In welchem Land waren wir ganz unten auf der Karte?",
    antworten: ["Südafrika", "Australien", "Argentinien"],
    richtig: 0,
    foto: "memo_suedafrika",
    notiz: "Südafrika – und Du hast wieder jedes Tier angefasst."
  },
  {
    frage: "Wer wohnt bei Lisa im Terrarium?",
    antworten: ["Eine Schlange", "Ein Gecko", "Eine Vogelspinne"],
    richtig: 0,
    foto: null,
    notiz: "Deine Schlange. Die einzige, die nie mit ins Wasser will."
  }
];

// Wo die Stationen im Level liegen
// y bleibt unter dem Fragenband (150) und weg von Joystick/Menü
const STATIONEN = [
  { x: 380,  y: 360 },
  { x: 1080, y: 330 },
  { x: 1660, y: 340 },
  { x: 1380, y: 780 },
  { x: 760,  y: 800 },
  { x: 240,  y: 720 }
];

export default class LevelMemory extends Phaser.Scene {
  constructor(){ super("LevelMemory"); }

  preload(){
    this.load.image("l1_back",  "assets/backgrounds/level1_back.jpg");
    this.load.image("l1_mid",   "assets/backgrounds/level1_mid.png");
    this.load.image("caustics", "assets/backgrounds/caustics_overlay.png");
    if (!this.textures.exists("diver")){
      this.load.spritesheet("diver", "assets/sprites/diver_v4_1920x1920.png",
        { frameWidth:480, frameHeight:480, endFrame:15 });
    }
    if (!this.textures.exists("parchment")){
      this.load.image("parchment", "assets/objects/level2/parchment.png");
    }
    // Urlaubsfotos – fehlen sie, zeigt das Polaroid nur den Text
    this.load.on("loaderror", ()=>{});
    for (const f of FRAGEN){
      if (f.foto) this.load.image(f.foto, `assets/objects/memories/${f.foto}.jpg`);
    }
  }

  create(){
    W = this.scale.width; H = this.scale.height;
    this.cameras.main.setBackgroundColor("#06121f");
    this.cameras.main.setBounds(0,0,W,H);
    this.physics.world.setBounds(60, 60, W-120, H-120);

    this.safeCover(0,0,"l1_back", 1.0);
    this.safeCover(0,0,"l1_mid",  0.75);
    if (this.textures.exists("caustics")){
      this.add.tileSprite(0,0,W,H,"caustics").setOrigin(0,0)
        .setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.16).setDepth(-8);
    }
    this.add.rectangle(0,0,W,H,0x02121e,0.35).setOrigin(0,0).setDepth(-7);

    this.gefunden   = 0;
    this.gameOver   = false;
    this.frageOffen = false;
    this.oxygenMax  = 110;
    this.oxygen     = this.oxygenMax;

    this.buildPlayer();
    this.buildStations();
    this.buildHud();

    this.note = makeNote(this, { width: 700, y: 0.30, depth: 14000 });

    this.keys = this.input.keyboard.addKeys({
      left:"LEFT", right:"RIGHT", up:"UP", down:"DOWN",
      a:"A", d:"D", w:"W", s:"S", space:"SPACE", esc:"ESC"
    });
    const toMenu = ()=> this.scene.start("MenuScene");
    this.input.keyboard.on("keydown-ESC", toMenu);
    this.game.events.on("touch-menu", toMenu);
    this.events.once("shutdown", ()=> this.game.events.off("touch-menu", toMenu));
    startTouch(this, { action:false });

    // Luft läuft nur, wenn keine Frage und kein Brief offen ist
    this.time.addEvent({ delay:1000, loop:true, callback: ()=>{
      if (this.gameOver || this.frageOffen || this.introOpen) return;
      this.oxygen = Math.max(0, this.oxygen - 1);
      this.updateOxygenBar();
      if (this.oxygen <= 0) this.fail("Keine Luft mehr!");
    }});

    this.showIntroLetter();
  }

  safeCover(x,y,key,alpha){
    if (!this.textures.exists(key)) return null;
    const img = this.add.image(x,y,key).setOrigin(0,0).setAlpha(alpha).setDepth(-10);
    const src = this.textures.get(key).getSourceImage();
    if (src && src.width){
      const s = Math.max(W/src.width, H/src.height);
      img.setScale(s);
    }
    return img;
  }

  buildPlayer(){
    this.player = this.textures.exists("diver")
      ? this.physics.add.sprite(W*0.5, H*0.55, "diver", 0).setScale(0.6)
      : this.physics.add.image(W*0.5, H*0.55, "__DEFAULT");
    this.player.setDepth(500);
    this.player.setCollideWorldBounds(true);
    this.player.body.setDrag(700, 700);
    this.player.body.setMaxVelocity(330, 330);

    if (this.textures.exists("diver")){
      if (!this.anims.exists("diver_swim")){
        this.anims.create({ key:"diver_swim",
          frames:this.anims.generateFrameNumbers("diver",{start:0,end:15}), frameRate:10, repeat:-1 });
        this.anims.create({ key:"diver_idle",
          frames:this.anims.generateFrameNumbers("diver",{start:0,end:1}), frameRate:2, repeat:-1 });
      }
      this.player.play("diver_idle");
    }
  }

  // ---------- Stationen ----------
  buildStations(){
    this.stationen = [];
    FRAGEN.forEach((f, i)=>{
      const roh = STATIONEN[i % STATIONEN.length];
      const p = { x: roh.x * (W / REF_W), y: roh.y * (H / 1080) };
      const cont = this.add.container(p.x, p.y).setDepth(120);

      const glow = this.add.circle(0, 0, 62, 0x9fe4ff, 0.16);
      const ring = this.add.circle(0, 0, 44, 0x000000, 0)
        .setStrokeStyle(4, 0xaee6ff, 0.85);
      const kern = this.add.circle(0, 0, 26, 0xdff4ff, 0.9);
      const zahl = this.add.text(0, 0, String(i+1), {
        fontFamily:SERIF, fontSize:"26px", color:"#0b3348"
      }).setOrigin(0.5);
      cont.add([glow, ring, kern, zahl]);

      this.tweens.add({ targets: ring, scale: 1.18, alpha: 0.5,
                        duration: 1400, yoyo:true, repeat:-1, ease:"Sine.easeInOut" });
      this.tweens.add({ targets: cont, y: p.y - 12,
                        duration: 2000, yoyo:true, repeat:-1, ease:"Sine.easeInOut" });

      this.stationen.push({ cont, x:p.x, y:p.y, frage:f, index:i, gelöst:false });
    });
  }

  buildHud(){
    this.hudTxt = this.add.text(48, 42, `Erinnerungen: 0 / ${FRAGEN.length}`, {
      fontFamily:"system-ui, sans-serif", fontSize:"30px", color:"#e6f0ff",
      stroke:"#000", strokeThickness:3
    }).setScrollFactor(0).setDepth(9000);

    const BAR_W = 240, BAR_H = 20, left = W - 200 - BAR_W, y = 58;   // Platz für den Vollbild-Knopf
    this.add.rectangle(left, y, BAR_W, BAR_H, 0xffffff, 0.12)
      .setOrigin(0,0.5).setScrollFactor(0).setDepth(9000);
    this.oxyFg = this.add.rectangle(left, y, BAR_W, BAR_H, 0x67b7ff, 0.95)
      .setOrigin(0,0.5).setScrollFactor(0).setDepth(9001);
    this.add.rectangle(left, y, BAR_W, BAR_H).setOrigin(0,0.5)
      .setStrokeStyle(2, 0xaad4ff, 1).setFillStyle(0,0).setScrollFactor(0).setDepth(9002);
    this.add.text(left + BAR_W/2, y + 22, "Sauerstoff", {
      fontFamily:"system-ui", fontSize:"14px", color:"#a0c8ff"
    }).setOrigin(0.5,0).setScrollFactor(0).setDepth(9002);
  }

  updateOxygenBar(){
    const p = Phaser.Math.Clamp(this.oxygen/this.oxygenMax, 0, 1);
    this.oxyFg.scaleX = p;
    this.oxyFg.fillColor = p < 0.25 ? 0xff6b6b : (p < 0.5 ? 0xffc46b : 0x67b7ff);
  }

  // ---------- Brief ----------
  showIntroLetter(){
    const KEY = "memo_intro_seen_v1";
    this.introOpen = false;
    let seen = false;
    try { seen = localStorage.getItem(KEY) === "1"; } catch(e){}
    if (seen) return;

    const brief =
`Bevor Du weitertauchst, ein kleiner Umweg. Im Wasser
schweben ${FRAGEN.length} leuchtende Perlen – jede eine Erinnerung
von uns beiden.

Schwimm eine an, dann kommt eine Frage. Die Antworten
treiben als Blasen um Dich herum: In die richtige
reinschwimmen. Danebengegriffen kostet Luft.

Hast Du alle, geht es weiter.`;

    this.intro = makeLetter(this, {
      body: brief,
      footer: touchEnabled()
        ? "Joystick rechts bewegt Dich · „☰ Menü“ unten führt zurück"
        : "Pfeiltasten oder [WASD] bewegen · [ESC] Menü",
      hint: touchEnabled() ? "Tippe auf den Bildschirm, um loszutauchen" : "[Leertaste] zum Starten"
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

  // ---------- Frage ----------
  frageStarten(st){
    if (this.frageOffen || st.gelöst || this.gameOver) return;
    this.frageOffen = true;
    this.aktiveStation = st;

    const f = st.frage;

    // Frage oben auf einem Pergamentstreifen
    const band = this.add.container(W/2, 150).setDepth(6000).setScrollFactor(0).setAlpha(0);
    const paper = this.textures.exists("parchment")
      ? this.add.image(0,0,"parchment").setDisplaySize(Math.min(1180, W*0.62), 170)
      : this.add.rectangle(0,0,Math.min(1180, W*0.62),170,0xe9dcbf,1);
    paper.setAngle(-0.6);
    const txt = this.add.text(0, 0, f.frage, {
      fontFamily:SERIF, fontSize:"34px", color:INK, align:"center",
      wordWrap:{ width: 940 }
    }).setOrigin(0.5).setAngle(-0.6);
    band.add([paper, txt]);
    this.tweens.add({ targets: band, alpha:1, duration:220, ease:"Quad.easeOut" });
    this.frageBand = band;

    // Antwortblasen um die Station herum verteilen.
    // Kurze Sperre, damit nichts platzt, während die Blasen erst erscheinen.
    this.blasen = [];
    this.blasenAb = performance.now() + 600;
    const reihenfolge = Phaser.Utils.Array.Shuffle(f.antworten.map((a,i)=>({ a, i })));
    const spots = this.blasenPlaetze(st.x, st.y, reihenfolge.length);

    reihenfolge.forEach((eintrag, k)=>{
      const pos = spots[k];
      const b = this.add.container(pos.x, pos.y).setDepth(5000);
      const r = 108;
      const hull = this.add.circle(0, 0, r, 0x9fdfff, 0.20).setStrokeStyle(4, 0xdff4ff, 0.85);
      const shine = this.add.circle(-r*0.46, -r*0.5, r*0.16, 0xffffff, 0.55);
      const label = this.add.text(0, 0, eintrag.a, {
        fontFamily:"system-ui, sans-serif", fontSize:"30px", color:"#f2fbff",
        align:"center", wordWrap:{ width: r*1.6 }, stroke:"#08202e", strokeThickness:4
      }).setOrigin(0.5);
      b.add([hull, shine, label]);
      b.setData("index", eintrag.i);
      b.setData("r", r);
      b.setData("phase", Math.random()*Math.PI*2);
      b.setData("home", { x: pos.x, y: pos.y });
      this.tweens.add({ targets: b, scale: 1.06, duration: 1500 + k*180,
                        yoyo:true, repeat:-1, ease:"Sine.easeInOut" });
      this.blasen.push(b);
    });

    st.cont.setAlpha(0.25);
  }

  // Plätze für die Blasen: rund um die Station verteilt, aber garantiert
  // im Bild, weit genug auseinander und nicht direkt auf der Spielerin.
  // (Vorher wurden Positionen an den Rand geklemmt – dann lagen zwei Blasen
  // übereinander und eine platzte sofort beim Ankommen.)
  blasenPlaetze(x, y, n){
    const R = 340, MIN = 300;
    const passt = (px, py, out)=>
      px > 240 && px < W-240 && py > 320 && py < H-240 &&
      Phaser.Math.Distance.Between(px, py, x, y) > 260 &&
      Phaser.Math.Distance.Between(px, py, this.player.x, this.player.y) > 240 &&
      !out.some(p => Phaser.Math.Distance.Between(p.x, p.y, px, py) < MIN);

    const out = [];
    const start = Math.random() * Math.PI * 2;
    for (let k = 0; k < 12 && out.length < n; k++){
      const a = start + k * (Math.PI*2/12);
      const px = x + Math.cos(a)*R, py = y + Math.sin(a)*R;
      if (passt(px, py, out)) out.push({ x:px, y:py });
    }
    // Falls die Station zu nah am Rand liegt: freie Stelle im Bild suchen
    let schutz = 0;
    while (out.length < n && schutz++ < 400){
      const px = Phaser.Math.Between(260, W-260);
      const py = Phaser.Math.Between(340, H-260);
      if (passt(px, py, out)) out.push({ x:px, y:py });
    }
    while (out.length < n){   // absoluter Notfall
      out.push({ x: 320 + out.length*640, y: 700 });
    }
    return out;
  }

  blaseGetroffen(b){
    const st = this.aktiveStation;
    if (!st) return;
    const richtig = b.getData("index") === st.frage.richtig;

    if (richtig){
      this.platzen(b, 0xffe89a);
      this.blasen.forEach(x=>{ if (x !== b) this.wegblenden(x); });
      this.blasen = [];
      this.frageBand && this.tweens.add({ targets:this.frageBand, alpha:0, duration:200,
        onComplete: ()=>{ this.frageBand.destroy(); this.frageBand = null; } });
      st.gelöst = true;
      st.cont.destroy();
      this.gefunden++;
      this.hudTxt.setText(`Erinnerungen: ${this.gefunden} / ${FRAGEN.length}`);
      this.polaroidZeigen(st.frage);
    } else {
      this.platzen(b, 0xff8f8f);
      this.blasen = this.blasen.filter(x=>x !== b);
      this.oxygen = Math.max(0, this.oxygen - 8);
      this.updateOxygenBar();
      this.cameras.main.shake(160, 0.006);
      showNote(this, this.note, "Leider nicht. Das kostet Luft.", { ms: 1100 });
      if (this.oxygen <= 0) this.fail("Keine Luft mehr!");
    }
  }

  platzen(b, color){
    const x = b.x, y = b.y;
    b.destroy();
    for (let i=0;i<10;i++){
      const a = (i/10) * Math.PI*2;
      const d = this.add.circle(x, y, Phaser.Math.Between(5, 11), color, 0.85).setDepth(5200);
      this.tweens.add({
        targets: d, x: x + Math.cos(a)*Phaser.Math.Between(90,150),
        y: y + Math.sin(a)*Phaser.Math.Between(90,150),
        alpha: 0, duration: 520, ease:"Quad.easeOut",
        onComplete: ()=> d.destroy()
      });
    }
  }

  wegblenden(b){
    this.tweens.add({ targets:b, alpha:0, scale:0.7, duration:260,
                      onComplete: ()=> b.destroy() });
  }

  // ---------- Polaroid ----------
  polaroidZeigen(f){
    const lay = this.add.container(W/2, H/2).setDepth(15000).setScrollFactor(0).setAlpha(0);
    const dim = this.add.rectangle(0,0,W*2,H*2,0x03121c,0.82);
    lay.add(dim);

    const pw = 620, ph = 720;
    const karte = this.add.rectangle(0, 0, pw, ph, 0xf6f1e6, 1)
      .setStrokeStyle(3, 0xd9d0bd, 1);
    karte.setAngle(-2);
    lay.add(karte);

    const bw = pw - 64, bh = 470;
    if (f.foto && this.textures.exists(f.foto)){
      const bild = this.add.image(0, -ph/2 + 32 + bh/2, f.foto).setOrigin(0.5);
      const src = this.textures.get(f.foto).getSourceImage();
      const sc = Math.max(bw/src.width, bh/src.height);
      bild.setScale(sc);
      // auf das Bildfenster zuschneiden
      const maske = this.make.graphics({ x:0, y:0, add:false });
      maske.fillRect(W/2 - bw/2, H/2 - ph/2 + 32, bw, bh);
      bild.setMask(maske.createGeometryMask());
      bild.setAngle(-2);
      lay.add(bild);
    } else {
      const platz = this.add.rectangle(0, -ph/2 + 32 + bh/2, bw, bh, 0x2b3b48, 1)
        .setStrokeStyle(2, 0x8fa6b4, 0.6).setAngle(-2);
      const herz = this.add.text(0, -ph/2 + 32 + bh/2, "♥", {
        fontFamily:SERIF, fontSize:"120px", color:"#7fa8c8"
      }).setOrigin(0.5).setAlpha(0.5).setAngle(-2);
      lay.add([platz, herz]);
    }

    const notiz = this.add.text(0, ph/2 - 110, f.notiz || "", {
      fontFamily:SERIF, fontSize:"25px", color:"#3f2d1c", align:"center",
      wordWrap:{ width: pw - 90 }, lineSpacing: 5
    }).setOrigin(0.5).setAngle(-2);
    lay.add(notiz);

    const weiter = this.add.text(0, ph/2 + 56, "Tippen zum Weitertauchen", {
      fontFamily:"system-ui, sans-serif", fontSize:"22px", color:"#cfe9ff"
    }).setOrigin(0.5).setAlpha(0.9);
    this.tweens.add({ targets: weiter, alpha:0.4, duration:900, yoyo:true, repeat:-1 });
    lay.add(weiter);

    this.tweens.add({ targets: lay, alpha:1, duration:240, ease:"Quad.easeOut" });
    lay.setScale(0.94);
    this.tweens.add({ targets: lay, scale:1, duration:280, ease:"Back.easeOut" });
    this.polaroid = lay;

    // Erst nach kurzer Sperrzeit wegtippbar, sonst schließt der Schwimm-Tipper sofort
    const armedAt = performance.now() + 500;
    const close = ()=>{
      if (performance.now() < armedAt) return;
      if (!this.polaroid) return;
      const l = this.polaroid; this.polaroid = null;
      this.input.off("pointerdown", close);
      this.tweens.add({ targets:l, alpha:0, duration:200, onComplete: ()=> l.destroy() });
      this.frageOffen = false;
      this.aktiveStation = null;
      if (this.gefunden >= FRAGEN.length) setTimeout(()=> this.win(), 300);
    };
    this.input.on("pointerdown", close);
    this.input.keyboard.on("keydown-SPACE", close);
  }

  // ---------- Update ----------
  update(time, delta){
    if (this.gameOver) return;
    if (this.introOpen || this.polaroid){
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

    this.player.setAcceleration(ax.x * 1500, ax.y * 1500);
    if (ax.x !== 0) this.player.setFlipX(ax.x < 0);

    const moving = Math.hypot(this.player.body.velocity.x, this.player.body.velocity.y) > 30;
    if (this.textures.exists("diver")){
      const want = moving ? "diver_swim" : "diver_idle";
      if (!this.player.anims.currentAnim || this.player.anims.currentAnim.key !== want){
        this.player.play(want, true);
      }
    }

    // Blasen treiben leicht
    if (this.blasen){
      const t = time / 1000;
      for (const b of this.blasen){
        if (!b.active) continue;
        const home = b.getData("home"), ph = b.getData("phase");
        b.x = home.x + Math.sin(t*0.8 + ph) * 26;
        b.y = home.y + Math.cos(t*0.6 + ph) * 20;
      }
    }

    // Station anschwimmen
    if (!this.frageOffen){
      for (const st of this.stationen){
        if (st.gelöst) continue;
        if (Phaser.Math.Distance.Between(this.player.x, this.player.y, st.x, st.y) < 90){
          this.frageStarten(st); break;
        }
      }
    } else if (this.blasen && this.blasen.length && performance.now() >= (this.blasenAb || 0)){
      for (const b of this.blasen.slice()){
        if (!b.active) continue;
        const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, b.x, b.y);
        if (d < b.getData("r") * 0.78){ this.blaseGetroffen(b); break; }
      }
    }
  }

  // ---------- Ende ----------
  win(){
    if (this.gameOver) return;
    this.gameOver = true;
    this.physics.world.pause();
    this.player.setVelocity(0,0);
    markLevelDone("LevelMemory");
    const nx = nextLevel("LevelMemory");
    this.showEndPanel("Alle Erinnerungen gesammelt! 💙",
      nx ? `${levelTitle(nx)} ist jetzt freigeschaltet.` : "");
  }

  fail(msg){
    if (this.gameOver) return;
    this.gameOver = true;
    this.physics.world.pause();
    this.player.setVelocity(0,0);
    this.showEndPanel(msg || "Game Over", "");
  }

  showEndPanel(title, subtitle){
    this.add.rectangle(W/2,H/2,W,H,0x000000,0.6).setScrollFactor(0).setDepth(20000);
    this.add.rectangle(W/2,H/2,760,320,0x071a2b,0.97)
      .setStrokeStyle(3, 0xaad4ff, 0.8).setScrollFactor(0).setDepth(20001);
    this.add.text(W/2, H/2-96, title, {
      fontFamily:SERIF, fontSize:"38px", color:"#e6f0ff", fontStyle:"italic"
    }).setOrigin(0.5).setDepth(20002);
    if (subtitle){
      this.add.text(W/2, H/2-44, subtitle, {
        fontFamily:"system-ui, sans-serif", fontSize:"22px", color:"#a0c8ff"
      }).setOrigin(0.5).setDepth(20002);
    }
    const btn = (txt, y, cb)=>{
      const r = this.add.rectangle(W/2, y, 300, 62, 0x0d2e46, 1)
        .setStrokeStyle(2, 0xaad4ff, 0.7).setDepth(20002).setInteractive({useHandCursor:true});
      this.add.text(W/2, y, txt, {
        fontFamily:"system-ui, sans-serif", fontSize:"24px", color:"#cfe9ff"
      }).setOrigin(0.5).setDepth(20003);
      r.on("pointerdown", cb);
    };
    btn("Weiter",  H/2+30,  ()=> this.scene.start("MenuScene"));
    btn("Nochmal", H/2+108, ()=> this.scene.restart());
  }
}
