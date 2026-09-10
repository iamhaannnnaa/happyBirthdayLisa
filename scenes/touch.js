// scenes/touch.js
// Touch-Steuerung: virtueller Joystick links, optionaler Aktions-Button rechts,
// kleiner Menü-Button unten mittig.
//
// Läuft als eigene Szene ÜBER dem Level. Grund: Level 2 hat Kamera-Zoom 2x,
// Level 3 hat 1.25x – in der Level-Szene selbst wäre die Bedienung dadurch
// verzerrt und falsch positioniert.

const Phaser = window.Phaser;

// Gemeinsamer Zustand, den die Level in update() auslesen. Werte -1 .. 1.
export const TOUCH = { x: 0, y: 0, active: false };

// Touch-Bedienung nur auf Geräten mit Touchscreen einblenden.
// Zum Testen am Rechner: ?touch=1 anhängen (bzw. ?touch=0 zum Abschalten).
export function touchEnabled(){
  try {
    const q = window.location.search || "";
    if (q.indexOf("touch=1") !== -1) return true;
    if (q.indexOf("touch=0") !== -1) return false;
    return (navigator.maxTouchPoints || 0) > 0 || ("ontouchstart" in window);
  } catch(e){ return false; }
}

// Tastatur- und Touch-Eingabe zusammenführen.
// Tastatur hat Vorrang, Touch springt ein, wenn keine Taste gedrückt ist.
export function readAxis(keyX, keyY){
  if (keyX === 0 && keyY === 0 && TOUCH.active) return { x: TOUCH.x, y: TOUCH.y };
  return { x: keyX, y: keyY };
}

// In create() des Levels aufrufen. opts: { action:true, label:"📷" }
export function startTouch(scene, opts){
  TOUCH.x = 0; TOUCH.y = 0; TOUCH.active = false;
  if (!touchEnabled()) return;

  scene.registry.set("touchOpts", Object.assign({ action:false, label:"FOTO" }, opts || {}));
  scene.scene.launch("TouchScene");

  // Beim Verlassen/Neustart des Levels sauber aufräumen
  scene.events.once("shutdown", ()=>{
    TOUCH.x = 0; TOUCH.y = 0; TOUCH.active = false;
    if (scene.scene.isActive("TouchScene")) scene.scene.stop("TouchScene");
  });
}

export default class TouchScene extends Phaser.Scene {
  constructor(){ super({ key:"TouchScene" }); }

  create(){
    const opts = this.registry.get("touchOpts") || { action:false, label:"FOTO" };
    const W = this.scale.width, H = this.scale.height;

    TOUCH.x = 0; TOUCH.y = 0; TOUCH.active = false;
    this.stickId = null;
    this.maxR  = 100;
    this.baseX = 250;
    this.baseY = H - 250;

    // Mehrere Finger gleichzeitig (Joystick + Aktions-Button)
    this.input.addPointer(2);
    this.scene.bringToTop();

    // ---------- Joystick ----------
    this.ring = this.add.circle(this.baseX, this.baseY, this.maxR, 0x07263a, 0.30)
      .setStrokeStyle(3, 0xaad4ff, 0.5).setDepth(10);
    this.thumb = this.add.circle(this.baseX, this.baseY, 40, 0xaad4ff, 0.5)
      .setStrokeStyle(3, 0xe6f0ff, 0.85).setDepth(11);
    this.stickLabel = this.add.text(this.baseX, this.baseY + this.maxR + 20, "Bewegen", {
      fontFamily:"system-ui, sans-serif", fontSize:"22px", color:"#cfe9ff",
      stroke:"#000", strokeThickness:3
    }).setOrigin(0.5, 0).setAlpha(0.7).setDepth(10);

    // ---------- Aktions-Button (nur wo das Level einen braucht) ----------
    this.actionArea = null;
    if (opts.action){
      const bx = W - 250, by = H - 250, br = 92;

      this.actionBtn = this.add.circle(bx, by, br, 0x0d2e46, 0.85)
        .setStrokeStyle(4, 0xaad4ff, 0.9).setDepth(10);
      this.actionTxt = this.add.text(bx, by, opts.label, {
        fontFamily:"system-ui, sans-serif", fontSize:"34px", color:"#e6f0ff",
        stroke:"#000", strokeThickness:3
      }).setOrigin(0.5).setDepth(11);

      this.actionBtn.setInteractive(new Phaser.Geom.Circle(br, br, br), Phaser.Geom.Circle.Contains);
      this.actionBtn.on("pointerdown", ()=>{
        this.actionBtn.setFillStyle(0x1b5c86, 0.95);
        this.tweens.add({ targets:[this.actionBtn, this.actionTxt], scale:0.9, duration:70, yoyo:true });
        this.game.events.emit("touch-action");
      });
      const releaseBtn = ()=> this.actionBtn.setFillStyle(0x0d2e46, 0.85);
      this.actionBtn.on("pointerup", releaseBtn);
      this.actionBtn.on("pointerout", releaseBtn);

      // Bereich, in dem der Joystick nicht anspringen darf
      this.actionArea = { x: bx, y: by, r: br + 24 };
    }

    // ---------- Menü-Button unten mittig ----------
    const mx = W/2, my = H - 54;
    this.menuBtn = this.add.rectangle(mx, my, 176, 58, 0x0b2b3b, 0.75)
      .setStrokeStyle(2, 0x79d0ff, 0.8).setDepth(10)
      .setInteractive({ useHandCursor:true });
    this.add.text(mx, my, "☰ Menü", {
      fontFamily:"system-ui, sans-serif", fontSize:"26px", color:"#cfe9ff",
      stroke:"#000", strokeThickness:3
    }).setOrigin(0.5).setDepth(11);
    // bewusst pointerdown: pointerup wird in der aufgesetzten Szene nicht
    // zuverlässig ausgelöst, wenn man nur kurz antippt
    this.menuBtn.on("pointerdown", ()=> this.game.events.emit("touch-menu"));
    this.menuArea = { x: mx, y: my, w: 176 + 40, h: 58 + 40 };

    // ---------- Eingabe ----------
    this.input.on("pointerdown", (p)=> this.onDown(p));
    this.input.on("pointermove", (p)=> { if (p.id === this.stickId) this.moveThumb(p.x, p.y); });
    this.input.on("pointerup",        (p)=> this.release(p));
    this.input.on("pointerupoutside", (p)=> this.release(p));

    this.events.once("shutdown", ()=>{ TOUCH.x = 0; TOUCH.y = 0; TOUCH.active = false; });
  }

  onDown(p){
    if (this.stickId !== null) return;                         // ein Finger reicht
    if (this.inActionArea(p) || this.inMenuArea(p)) return;    // Buttons haben Vorrang
    if (p.x > this.scale.width * 0.55) return;                 // rechte Hälfte: keine Bewegung

    const W = this.scale.width, H = this.scale.height;
    this.stickId = p.id;
    // Joystick erscheint dort, wo der Daumen aufsetzt
    this.baseX = Phaser.Math.Clamp(p.x, this.maxR + 20, W * 0.5);
    this.baseY = Phaser.Math.Clamp(p.y, this.maxR + 20, H - this.maxR - 20);
    this.ring.setPosition(this.baseX, this.baseY);
    this.stickLabel.setAlpha(0);
    this.moveThumb(p.x, p.y);
  }

  moveThumb(px, py){
    const dx = px - this.baseX, dy = py - this.baseY;
    const len = Math.hypot(dx, dy);
    const nx = len > 0 ? dx/len : 0;
    const ny = len > 0 ? dy/len : 0;

    this.thumb.setPosition(this.baseX + nx * Math.min(len, this.maxR),
                           this.baseY + ny * Math.min(len, this.maxR));

    const dead = 14;
    if (len < dead){ TOUCH.x = 0; TOUCH.y = 0; TOUCH.active = false; return; }
    const strength = Phaser.Math.Clamp((len - dead) / (this.maxR - dead), 0, 1);
    TOUCH.x = nx * strength;
    TOUCH.y = ny * strength;
    TOUCH.active = true;
  }

  release(p){
    if (p.id !== this.stickId) return;
    this.stickId = null;
    TOUCH.x = 0; TOUCH.y = 0; TOUCH.active = false;

    this.baseX = 250; this.baseY = this.scale.height - 250;
    this.ring.setPosition(this.baseX, this.baseY);
    this.thumb.setPosition(this.baseX, this.baseY);
    this.stickLabel.setPosition(this.baseX, this.baseY + this.maxR + 20).setAlpha(0.7);
  }

  inActionArea(p){
    const a = this.actionArea;
    return !!a && Phaser.Math.Distance.Between(p.x, p.y, a.x, a.y) <= a.r;
  }
  inMenuArea(p){
    const m = this.menuArea;
    return !!m && Math.abs(p.x - m.x) <= m.w/2 && Math.abs(p.y - m.y) <= m.h/2;
  }
}
