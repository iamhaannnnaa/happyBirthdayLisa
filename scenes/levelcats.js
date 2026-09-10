// scenes/levelcats.js
// "Die zwei Katzen" – Wohnung mit vier Zimmern und Garten, Kamera folgt Lisa.
//
// Aufgabe: drei Teile der Tauchausrüstung zurückholen. Eins liegt in einem
// Möbelstück oder Busch, zwei haben die Katzen. Direkt hinterherlaufen bringt
// nichts – die Katzen fliehen. Nur am Futternapf halten sie still.
const Phaser = window.Phaser;
import { readAxis, startTouch, touchEnabled } from "./touch.js";
import { markLevelDone, levelTitle, nextLevel } from "../progress.js";
import { makeLetter, makeNote, showNote, SERIF } from "./ui.js";

// Die Welt ist größer als der Bildschirm – die Kamera fährt mit.
const WW = 3400, WH = 1900;
const T  = 56;               // Wandstärke

const GEAR = [
  { id:"mask", tex:"gear_mask", name:"Maske" },
  { id:"fins", tex:"gear_fins", name:"Flossen" },
  { id:"lamp", tex:"gear_lamp", name:"Lampe" }
];

// Wände: [x, y, breite, höhe, textur]
const WAENDE = [
  // Außenmauer Wohnung
  [0, 0, 2128, T, "wall_home"], [0, WH-T, 2128, T, "wall_home"], [0, 0, T, WH, "wall_home"],
  // Hecke um den Garten
  [2128, 0, WW-2128, T, "hedge"], [2128, WH-T, WW-2128, T, "hedge"], [WW-T, 0, T, WH, "hedge"],
  // Hauswand zum Garten, mit Terrassentür bei y 760–1120
  [2072, 0, T, 760, "wall_home"], [2072, 1120, T, WH-1120, "wall_home"],
  // Innenwand senkrecht (Durchgang y 556–780)
  [972, T, T, 500, "wall_home"], [972, 780, T, WH-T-780, "wall_home"],
  // Innenwand waagerecht links (Durchgang x 536–760)
  [T, 952, 480, T, "wall_home"], [760, 952, 212, T, "wall_home"],
  // Innenwand waagerecht rechts (Durchgang x 1488–1760)
  [1028, 732, 460, T, "wall_home"], [1760, 732, 312, T, "wall_home"]
];

// Möbel: such:true → hier kann das versteckte Teil liegen
const MOEBEL = [
  // --- Wohnzimmer (oben links) ---
  { id:"sofa",   tex:"sofa",   x: 330, y: 250, w:360, h:210, such:true,
    leer:"Unter dem Sofa: drei Haargummis und ein Stück Trockenfutter." },
  { id:"regal",  tex:"shelf",  x: 150, y: 640, w:180, h:360, such:true,
    leer:"Nur Bücher. Sehr viele Bücher." },
  { id:"tisch",  tex:"table",  x: 760, y: 300, w:260, h:160, such:true,
    leer:"Auf dem Tisch: kalter Kaffee. Sonst nichts." },
  { id:"pflanze",tex:"plant",  x: 830, y: 760, w:110, h:100, such:false, deko:true },

  // --- Schlafzimmer (unten links) ---
  { id:"bett",   tex:"bed",    x: 340, y:1240, w:320, h:280, such:true,
    leer:"Im Bett: nur eine zerwühlte Decke." },
  { id:"kommode",tex:"dresser",x: 740, y:1680, w:260, h:130, such:true,
    leer:"Schublade auf, Schublade zu. Socken." },
  { id:"kratz",  tex:"scratchpost", x: 170, y:1700, w:170, h:200, such:true,
    leer:"Der Kratzbaum ist voller Fell. Aber leer." },

  // --- Küche (oben rechts) ---
  { id:"tisch2", tex:"table",  x:1330, y: 260, w:260, h:160, such:true,
    leer:"Auf der Küchenzeile: Brotkrümel und eine Kerze." },
  { id:"kommode2",tex:"dresser",x:1900, y: 180, w:260, h:130, such:true,
    leer:"Besteckschublade. Klappert, hilft aber nicht." },
  { id:"pflanze2",tex:"plant", x:1980, y: 600, w:110, h:100, such:false, deko:true },

  // --- Flur (unten rechts) ---
  { id:"sofa2",  tex:"sofa",   x:1360, y:1620, w:360, h:210, such:true,
    leer:"Der zweite Sessel. Auch nur Katzenhaare." },
  { id:"regal2", tex:"shelf",  x:1990, y:1350, w:180, h:360, such:true,
    leer:"Schuhregal. Zwei linke Gummistiefel." },
  { id:"kratz2", tex:"scratchpost", x:1160, y:1020, w:170, h:200, such:true,
    leer:"Kratzbaum Nummer zwei. Oben liegt eine Maus aus Filz." },

  // --- Garten ---
  { id:"liege",  tex:"lounger",x:2520, y: 420, w:300, h:170, such:true,
    leer:"Unter der Liege: ein vergessenes Buch, aufgeweicht vom Regen." },
  { id:"busch1", tex:"bush",   x:2950, y: 300, w:200, h:170, such:true,
    leer:"Im Busch raschelt es. War nur der Wind." },
  { id:"busch2", tex:"bush",   x:3120, y: 950, w:200, h:170, such:true,
    leer:"Nichts. Aber hier riecht es sehr nach Katze." },
  { id:"busch3", tex:"bush",   x:2420, y:1520, w:200, h:170, such:true,
    leer:"Nur Erde und ein Schneckenhaus." },
  { id:"tisch3", tex:"table",  x:2920, y:1560, w:260, h:160, such:true,
    leer:"Gartentisch. Eine leere Tasse von letztem Sommer." }
];

// Futtersack in der Küche – hier gibt es Nachschub, damit nie Schluss ist
const SACK = { x: 1720, y: 1000 };

export default class LevelCats extends Phaser.Scene {
  constructor(){ super("LevelCats"); }

  preload(){
    const p = "assets/objects/cats/";
    for (const k of ["floor_wood","wall_home","grass","hedge","rug","bowl",
                     "sofa","shelf","bed","table","dresser","scratchpost","plant",
                     "bush","lounger","cat_a_foto","cat_b_foto","lisa_foto"]){
      this.load.image(k, p+k+".png");
    }
    for (const g of GEAR) this.load.image(g.tex, p+g.tex+".png");
    if (!this.textures.exists("parchment")){
      this.load.image("parchment", "assets/objects/level2/parchment.png");
    }
  }

  create(){
    this.cameras.main.setBackgroundColor("#1b1410");
    this.cameras.main.setBounds(0,0,WW,WH);
    this.cameras.main.setRoundPixels(true);
    this.physics.world.setBounds(T, T, WW-T*2, WH-T*2);

    this.gefunden = {};
    this.futter   = 0;
    this.fertig   = false;
    this.suchVersuche = 0;
    this.hinweisGegeben = false;

    this.buildRoom();
    this.buildFurniture();
    this.buildPlayer();
    this.buildCats();
    this.buildHud();

    this.cameras.main.startFollow(this.player, true, 0.12, 0.12);
    this.note = makeNote(this, { width: 720, y: 0.20 });

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
      if (this.video){ try { this.video.stop(); } catch(e){} }
      const ts = this.scene.get("TouchScene");
      if (ts) ts.scene.setVisible(true);
    });
    startTouch(this, { action:true, label:"🐟" });

    this.showIntroLetter();
  }

  // ---------- Wohnung & Garten ----------
  buildRoom(){
    this.add.tileSprite(0, 0, 2100, WH, "floor_wood").setOrigin(0,0).setDepth(-20);
    this.add.tileSprite(2100, 0, WW-2100, WH, "grass").setOrigin(0,0).setDepth(-20);
    this.add.image(430, 700, "rug").setDepth(-19).setDisplaySize(520, 350).setAlpha(0.95);
    this.add.image(1500, 1300, "rug").setDepth(-19).setDisplaySize(420, 300).setAlpha(0.8);

    // Türschwelle zum Garten sichtbar machen
    this.add.rectangle(2100, 940, 56, 360, 0xb9a988, 0.55).setDepth(-18);

    this.walls = this.physics.add.staticGroup();
    for (const [x,y,w,h,tex] of WAENDE){
      this.add.tileSprite(x, y, w, h, tex).setOrigin(0,0).setDepth(6);
      const body = this.add.rectangle(x + w/2, y + h/2, w, h, 0x000000, 0);
      this.physics.add.existing(body, true);
      this.walls.add(body);
      this.add.rectangle(x, y, w, h).setOrigin(0,0)
        .setStrokeStyle(3, tex === "hedge" ? 0x2f5030 : 0x6d6154, 0.8).setDepth(7);
    }
  }

  buildFurniture(){
    this.moebel = this.physics.add.staticGroup();
    this.suchbar = [];

    for (const m of MOEBEL){
      const img = this.add.image(m.x, m.y, m.tex).setDepth(100 + m.y/100);
      img.setDisplaySize(m.w * 1.22, m.h * 1.30);
      // Deko (Blumentöpfe) blockiert nicht – dahinter hatte sich eine Katze
      // festgeklemmt und kam nicht mehr weg.
      if (!m.deko){
        const body = this.add.rectangle(m.x, m.y + 6, m.w, m.h, 0x000000, 0);
        this.physics.add.existing(body, true);
        this.moebel.add(body);
      }
      if (m.such) this.suchbar.push(Object.assign({}, m, { img }));
    }

    // Futtersack: Nachschub, damit man sich nie festspielt
    this.sack = this.add.container(SACK.x, SACK.y).setDepth(150);
    const sackBody = this.add.ellipse(0, 0, 110, 130, 0xb99a68).setStrokeStyle(4, 0x836b46);
    const sackTop  = this.add.rectangle(0, -58, 70, 28, 0x8f7550).setStrokeStyle(3, 0x5f4c31);
    const fisch    = this.add.text(0, 6, "🐟", { fontSize:"46px" }).setOrigin(0.5);
    const label    = this.add.text(0, 86, "Futter", {
      fontFamily:"system-ui, sans-serif", fontSize:"20px", color:"#f0e4c8",
      stroke:"#241a12", strokeThickness:4
    }).setOrigin(0.5);
    this.sack.add([sackBody, sackTop, fisch, label]);

    this.versteck = Phaser.Math.RND.pick(this.suchbar);
    this.versteckTeil = GEAR[0];
  }

  buildPlayer(){
    // Lisa als freigestelltes Foto
    this.player = this.physics.add.sprite(1250, 400, "lisa_foto");
    const zielH = 190;
    const src = this.textures.get("lisa_foto").getSourceImage();
    const sc = (src && src.height) ? zielH / src.height : 0.45;
    this.player.setScale(sc);
    this.player.setDepth(1000);
    this.player.setCollideWorldBounds(true);
    this.player.body.setDrag(1800, 1800);
    this.player.body.setMaxVelocity(430, 430);

    // Körper nur um die Füße, damit sie nicht mit dem Kopf an Möbeln hängt
    // setSize rechnet in Textur-Pixeln, deshalb durch die Skalierung teilen
    const fw = this.player.width, fh = this.player.height;
    const bw = Math.min(fw * 0.8, 44 / sc), bh = 40 / sc;
    this.player.body.setSize(bw, bh);
    this.player.body.setOffset((fw - bw)/2, fh - bh - 8/sc);

    this.physics.add.collider(this.player, this.walls);
    this.physics.add.collider(this.player, this.moebel);
  }

  buildCats(){
    this.cats = this.physics.add.group();
    const mk = (x, y, tex, name, teil)=>{
      const c = this.cats.create(x, y, tex);
      const src = this.textures.get(tex).getSourceImage();
      const sc = (src && src.height) ? 150 / src.height : 0.5;
      c.setScale(sc).setDepth(900);
      const bw = c.width * 0.7, bh = c.height * 0.5;
      c.body.setSize(bw, bh);
      c.body.setOffset((c.width-bw)/2, c.height - bh - 6);
      c.setCollideWorldBounds(true);
      c.setData("name", name);
      c.setData("teil", teil);
      c.setData("state", "roam");
      c.setData("timer", 0);
      c.setData("target", null);
      c.setData("phase", Math.random()*6.28);

      // Das Teil schwebt über der Katze und bleibt dort, bis Lisa es hat.
      // (Kein Tween mehr – der lief früher aus dem Takt und blieb hängen.)
      const icon = this.add.image(x, y-100, teil.tex).setDepth(950);
      const isrc = this.textures.get(teil.tex).getSourceImage();
      icon.setDisplaySize(96, 96 * (isrc.height / isrc.width));
      const halo = this.add.circle(x, y-100, 58, 0xffe9a8, 0.22).setDepth(949);
      c.setData("icon", icon);
      c.setData("halo", halo);
      return c;
    };
    this.katzeA = mk(2400, 500,  "cat_a_foto", "Die Getigerte", GEAR[1]);
    this.katzeB = mk(2800, 1200,"cat_b_foto", "Die Kleine",    GEAR[2]);

    this.physics.add.collider(this.cats, this.walls);
    this.physics.add.collider(this.cats, this.moebel);
    this.physics.add.collider(this.cats, this.cats);
    this.napf = null;
  }

  buildHud(){
    const Wd = this.scale.width;
    this.hud = this.add.container(0,0).setDepth(9000).setScrollFactor(0);
    const box = this.add.rectangle(30, 26, 430, 92, 0x120d0a, 0.62)
      .setOrigin(0,0).setStrokeStyle(2, 0xd8c9a8, 0.35);
    this.hud.add(box);

    this.hudIcons = {};
    GEAR.forEach((g, i)=>{
      const x = 78 + i*136, y = 70;
      const src = this.textures.get(g.tex).getSourceImage();
      const ico = this.add.image(x, y, g.tex).setAlpha(0.22);
      ico.setDisplaySize(76, 76 * (src.height/src.width));
      const txt = this.add.text(x, y+30, g.name, {
        fontFamily:"system-ui, sans-serif", fontSize:"16px", color:"#e8dcc2"
      }).setOrigin(0.5).setAlpha(0.4);
      this.hudIcons[g.id] = { ico, txt };
      this.hud.add([ico, txt]);
    });

    this.futterTxt = this.add.text(Wd-40, 40, "🐟 Futter: 0", {
      fontFamily:"system-ui, sans-serif", fontSize:"28px", color:"#f0e4c8",
      stroke:"#000", strokeThickness:3
    }).setOrigin(1,0).setDepth(9000).setScrollFactor(0);

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

Zwei davon tragen die Katzen mit sich herum, quer durch die
Wohnung und bis in den Garten. Läufst Du auf sie zu, rennen
sie weg. Leg ihnen Futter hin und schnapp sie Dir beim Fressen.

Du hast noch kein Futter dabei: Der Sack steht im Zimmer
ganz unten rechts. Da kannst Du Dir immer wieder welches holen.

Das dritte Teil liegt irgendwo im Haus oder im Garten. Stell
Dich davor und drück den Knopf, um nachzusehen.`;

    this.intro = makeLetter(this, {
      body: brief, height: 600,
      footer: touchEnabled()
        ? "Joystick rechts bewegt Dich · 🐟 links = Futter / Nachsehen"
        : "Pfeiltasten oder [WASD] bewegen · [Leertaste] Futter / Nachsehen",
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

    if (Phaser.Math.Distance.Between(this.player.x, this.player.y, SACK.x, SACK.y) < 190){
      if (this.futter >= 3){ showNote(this, this.note, "Die Taschen sind voll."); return; }
      this.futter = 3;
      this.futterTxt.setText("🐟 Futter: 3");
      this.tweens.add({ targets:this.sack, scale:1.12, duration:140, yoyo:true });
      showNote(this, this.note, "Nachschub eingesteckt.");
      return;
    }
    const m = this.naechstesMoebel();
    if (m){ this.durchsuchen(m); return; }
    this.futterHinlegen();
  }

  naechstesMoebel(){
    let best = null, bestD = 210;
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

    if (!this.hinweisGegeben && this.suchVersuche >= 5 && !this.gefunden[this.versteckTeil.id]){
      this.hinweisGegeben = true;
      setTimeout(()=>{
        if (!this.scene || !this.scene.isActive()) return;
        if (this.gefunden[this.versteckTeil.id]) return;
        this.markiereVersteck();
      }, 1800);
    }
  }

  // Nach fünf Fehlversuchen zeigt ein Pfeil auf das richtige Versteck
  markiereVersteck(){
    const v = this.versteck;
    showNote(this, this.note, "Ein Pfeil zeigt Dir, wo Du noch nicht warst.", { ms: 1800 });
    const pfeil = this.add.text(v.x, v.y - v.h/2 - 70, "▼", {
      fontFamily:"system-ui, sans-serif", fontSize:"64px", color:"#ffd86b",
      stroke:"#3a2a10", strokeThickness:6
    }).setOrigin(0.5).setDepth(7000);
    this.tweens.add({ targets: pfeil, y: "+=18", alpha: 0.45, duration: 620,
                      yoyo:true, repeat:-1, ease:"Sine.easeInOut" });
    this.versteckPfeil = pfeil;
  }

  futterHinlegen(){
    if (this.futter <= 0){
      showNote(this, this.note, "Kein Futter dabei. Der Sack steht im Zimmer unten rechts.", { ms: 1900 });
      return;
    }
    if (this.napf && this.napf.active) this.napf.destroy();
    this.futter--;
    this.futterTxt.setText(`🐟 Futter: ${this.futter}`);

    this.napf = this.add.image(this.player.x, this.player.y + 50, "bowl")
      .setDisplaySize(96, 84).setDepth(300);
    this.tweens.add({ targets:this.napf, scale: this.napf.scale*1.1, duration:420,
                      yoyo:true, repeat:3, ease:"Sine.easeInOut" });

    let ziel = null, bestD = Infinity;
    this.cats.getChildren().forEach(c=>{
      if (!c.getData("teil")) return;
      const d = Phaser.Math.Distance.Between(c.x, c.y, this.napf.x, this.napf.y);
      if (d < bestD){ bestD = d; ziel = c; }
    });
    if (ziel && bestD < 1500){
      ziel.setData("state", "toBowl");
      ziel.setData("timer", 0);
      showNote(this, this.note, `${ziel.getData("name")} hat das gerochen …`, { ms: 1300 });
    } else {
      showNote(this, this.note, "Keine Katze in der Nähe. Die riechen das nicht.", { ms: 1500 });
    }
  }

  teilGefunden(teil, msg){
    this.gefunden[teil.id] = true;
    const h = this.hudIcons[teil.id];
    if (h){
      h.ico.setAlpha(1); h.txt.setAlpha(1);
      this.tweens.add({ targets:h.ico, scale: h.ico.scale*1.25, duration:180, yoyo:true });
    }
    if (this.versteckPfeil){ this.versteckPfeil.destroy(); this.versteckPfeil = null; }
    showNote(this, this.note, msg, { icon: teil.tex, ms: 1600 });
    if (GEAR.every(g => this.gefunden[g.id])) setTimeout(()=> this.win(), 1300);
  }

  // ---------- Katzen ----------
  updateCats(dtMs, time){
    const dt = Math.min(dtMs, 50) / 1000;

    this.cats.getChildren().forEach(c=>{
      const st   = c.getData("state");
      const teil = c.getData("teil");
      const icon = c.getData("icon");
      const halo = c.getData("halo");

      // Symbol klebt an der Katze, solange sie das Teil hat
      if (icon){
        if (teil){
          const bob = Math.sin(time/380 + c.getData("phase")) * 7;
          icon.setPosition(c.x, c.y - 104 + bob);
          halo.setPosition(c.x, c.y - 104 + bob);
        } else {
          icon.setVisible(false); halo.setVisible(false);
        }
      }

      const dPlayer = Phaser.Math.Distance.Between(c.x, c.y, this.player.x, this.player.y);

      if (st === "eat"){
        c.setVelocity(0,0);
        c.setData("timer", c.getData("timer") - dt);
        if (dPlayer < 110 && teil){
          c.setData("teil", null);
          c.setData("state", "flee");
          c.setData("timer", 1.6);
          if (icon){ icon.setVisible(false); halo.setVisible(false); }
          this.teilGefunden(teil, `${c.getData("name")} gibt die ${teil.name} her.`);
          return;
        }
        if (c.getData("timer") <= 0){
          c.setData("state", "roam"); c.setData("timer", 0); c.setData("target", null);
          if (this.napf){ this.napf.destroy(); this.napf = null; }
        }
        return;
      }

      if (st === "toBowl"){
        if (!this.napf || !this.napf.active){ c.setData("state","roam"); return; }
        const d = Phaser.Math.Distance.Between(c.x, c.y, this.napf.x, this.napf.y);
        if (d < 70){
          c.setData("state", "eat"); c.setData("timer", 5.0);
          c.setVelocity(0,0);
          showNote(this, this.note, "Jetzt! Ran an die Katze, solange sie frisst.", { ms: 1500 });
          return;
        }
        this.laufeZu(c, this.napf.x, this.napf.y, 250);
        return;
      }

      if (st === "flee"){
        c.setData("timer", c.getData("timer") - dt);
        if (c.getData("timer") <= 0){ c.setData("state","roam"); c.setData("target", null); }
        else {
          const a = Math.atan2(c.y - this.player.y, c.x - this.player.x);
          c.setVelocity(Math.cos(a)*380, Math.sin(a)*380);
          c.setFlipX(Math.cos(a) < 0);
          return;
        }
      }

      if (teil && dPlayer < 300){
        c.setData("state","flee"); c.setData("timer", 1.6);
        return;
      }

      // Steckengeblieben? Wer sich trotz Vollgas kaum bewegt, sucht sich
      // ein neues Ziel – sonst hängt eine Katze ewig in einer Ecke.
      const last = c.getData("last") || { x:c.x, y:c.y };
      const bewegt = Phaser.Math.Distance.Between(c.x, c.y, last.x, last.y);
      c.setData("last", { x:c.x, y:c.y });
      let fest = c.getData("fest") || 0;
      fest = (bewegt < 1.2) ? fest + dt : 0;
      c.setData("fest", fest);
      if (fest > 1.2){
        c.setData("fest", 0);
        c.setData("target", null);
        c.setData("timer", 0);
      }

      let t = c.getData("target");
      c.setData("timer", c.getData("timer") - dt);
      if (!t || c.getData("timer") <= 0 ||
          Phaser.Math.Distance.Between(c.x, c.y, t.x, t.y) < 60){
        t = { x: Phaser.Math.Between(T+140, WW-T-140),
              y: Phaser.Math.Between(T+140, WH-T-140) };
        c.setData("target", t);
        c.setData("timer", Phaser.Math.FloatBetween(2.5, 4.5));
      }
      this.laufeZu(c, t.x, t.y, 150);
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

    this.player.setAcceleration(ax.x * 2600, ax.y * 2600);
    if (ax.x !== 0) this.player.setFlipX(ax.x < 0);

    this.updateCats(delta, time);

    const nahSack = Phaser.Math.Distance.Between(this.player.x, this.player.y, SACK.x, SACK.y) < 190;
    const m = this.naechstesMoebel();
    const label = nahSack ? "Futter nachfüllen"
                : (m ? "Nachsehen" : (this.futter > 0 ? "Futter hinlegen" : ""));
    this.aktionHint.setText(label);
    this.aktionHint.setPosition(this.player.x, this.player.y - 108);
    this.aktionHint.setAlpha(label ? 0.95 : 0);
  }

  // ---------- Ende ----------
  win(){
    if (this.fertig) return;
    this.fertig = true;
    this.physics.world.pause();
    this.player.setVelocity(0,0);
    markLevelDone("LevelCats");
    // Joystick & Co. wegblenden, damit sie nicht über dem Video liegen
    const ts = this.scene.get("TouchScene");
    if (ts && ts.scene.isActive()) ts.scene.setVisible(false);
    if (this.hud) this.hud.setVisible(false);
    if (this.futterTxt) this.futterTxt.setVisible(false);
    if (this.aktionHint) this.aktionHint.setVisible(false);
    const nx = nextLevel("LevelCats");
    this.showEndPanel("Ausrüstung komplett! 🤿",
      nx ? `${levelTitle(nx)} ist jetzt freigeschaltet.` : "");
  }

  showEndPanel(title, subtitle){
    const Wd = this.scale.width, Hd = this.scale.height;
    const lay = this.add.container(Wd/2, Hd/2).setScrollFactor(0).setDepth(20000);
    lay.add(this.add.rectangle(0,0,Wd*2,Hd*2,0x000000,0.62));
    lay.add(this.add.rectangle(0,0,820,380,0x1b1209,0.97).setStrokeStyle(3, 0xd8c9a8, 0.8));
    lay.add(this.add.text(0, -128, title, {
      fontFamily:SERIF, fontSize:"38px", color:"#f4e7cd", fontStyle:"italic"
    }).setOrigin(0.5));
    if (subtitle){
      lay.add(this.add.text(0, -76, subtitle, {
        fontFamily:"system-ui, sans-serif", fontSize:"22px", color:"#d3bd97"
      }).setOrigin(0.5));
    }
    const btn = (txt, y, cb)=>{
      const r = this.add.rectangle(0, y, 420, 62, 0x3a2a18, 1)
        .setStrokeStyle(2, 0xd8c9a8, 0.7).setInteractive({useHandCursor:true});
      const t = this.add.text(0, y, txt, {
        fontFamily:"system-ui, sans-serif", fontSize:"24px", color:"#f4e7cd"
      }).setOrigin(0.5);
      r.on("pointerdown", cb);
      lay.add([r, t]);
    };
    btn("▶  Kleine Erinnerung ansehen", -8, ()=> { lay.setVisible(false); this.zeigeVideo(()=> lay.setVisible(true)); });
    btn("Weiter",  70,  ()=> this.scene.start("MenuScene"));
    btn("Nochmal", 146, ()=> this.scene.restart());
    this.endPanel = lay;
  }

  // ---------- Video ----------
  zeigeVideo(onClose){
    const Wd = this.scale.width, Hd = this.scale.height;
    const lay = this.add.container(Wd/2, Hd/2).setScrollFactor(0).setDepth(21000);
    lay.add(this.add.rectangle(0,0,Wd*2,Hd*2,0x05080b,0.96));

    // Bewusst ohne Titel und Beschriftung – es soll nur das Video wirken.
    let video = null;
    try {
      video = this.add.video(0, 0);
      video.setDepth(1);
      lay.add(video);
      // Erst wenn die Größe bekannt ist, kann sauber skaliert werden
      const anpassen = ()=>{
        const vw = video.width || 406, vh = video.height || 720;
        const sc = Math.min((Wd*0.94)/vw, (Hd*0.88)/vh);
        video.setScale(sc);
      };
      video.on("created", ()=>{ anpassen(); try { video.play(false); } catch(e){} });
      video.on("play", anpassen);
      video.on("complete", ()=> schliessen());
      // mp4 zuerst (iPhone/Safari), webm als Rückfall für Browser ohne H.264
      video.loadURL(["assets/video/erinnerung.mp4", "assets/video/erinnerung.webm"]);
      try { video.play(false); } catch(e){}   // Tipp auf den Knopf zählt als Geste
      anpassen();
    } catch(e){
      lay.add(this.add.text(0, 0, "Video lässt sich hier nicht abspielen.", {
        fontFamily:"system-ui, sans-serif", fontSize:"24px", color:"#e6d8bd"
      }).setOrigin(0.5));
    }
    this.video = video;

    // Nur ein kleines Kreuz oben rechts zum Schließen
    const zu = this.add.circle(Wd*0.44, -Hd*0.41, 34, 0x1a1410, 0.85)
      .setStrokeStyle(2, 0xd8c9a8, 0.6).setInteractive({useHandCursor:true});
    const zuT = this.add.text(Wd*0.44, -Hd*0.41, "✕", {
      fontFamily:"system-ui, sans-serif", fontSize:"30px", color:"#f4e7cd"
    }).setOrigin(0.5);
    lay.add([zu, zuT]);

    const schliessen = ()=>{
      if (!lay.active) return;
      try { if (video) video.stop(); } catch(e){}
      this.video = null;
      lay.destroy();
      if (onClose) onClose();
    };
    zu.on("pointerdown", schliessen);
  }
}
