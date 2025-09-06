// scenes/level2.js
const Phaser = window.Phaser;
const DEBUG = false;

export default class Level2 extends Phaser.Scene {
  constructor(){ super("Level2"); }

  preload(){
    // Diver: 1920x1920 (4x4), Frames 480x480
    if (!this.textures.exists("diver")){
      this.load.spritesheet("diver", "assets/sprites/diver_v4_1920x1920.png", {
        frameWidth: 480, frameHeight: 480, endFrame: 15
      });
    }
  }

  create(){
    // ------- Einstellungen -------
    const TILE        = 88;     // Größe der Kacheln (optisch größer/kleiner)
    const CAM_ZOOM    = 1.5;    // Kamera-Zoom
    const PLAYER_SCALE= 0.24;   // Sprite-Skalierung

    this.TILE = TILE;

    // ------- Labyrinth (15 Zeilen × 28 Spalten) -------
    // #=Wand .=Boden  S=Start  M/F=NPC  D/E=Türen  X=Ausgang
    const MAP = [
      "############################",
      "#S.....#......####.........#",
      "###.##...####......#######.#",
      "#...#..#.....#.###.......#.#",
      "#.######.#.#.#.####.#.######",
      "#....M#..#.#.#....#D###...##",
      "############.######.....#..#",
      "#...#F#....###.##...###.####",
      "#.#.#...##........#...#....#",
      "#.#.######.######.#.#.######",
      "#.#.............#.#.#......#",
      "#......#.#.##.#.#.#...##.#E#",
      "######.#...##.#.#.####.#.#.#",
      "#......#.#....#.#......###X#",
      "############################"
    ];

    this.mapW = MAP[0].length * TILE;
    this.mapH = MAP.length     * TILE;

    // ------- Welt & Kamera -------
    this.cameras.main.setBackgroundColor("#041016");
    this.physics.world.setBounds(0,0,this.mapW,this.mapH);
    this.cameras.main.setBounds(0,0,this.mapW,this.mapH);
    this.cameras.main.setRoundPixels(true);
    this.cameras.main.setZoom(CAM_ZOOM);

    // Platzhalter-Texturen
    this.makeSimpleTextures();

    // Gruppen
    this.walls = this.physics.add.staticGroup();
    this.doors = this.physics.add.staticGroup();
    this.npcs  = this.physics.add.staticGroup();
    this.exit  = this.physics.add.staticGroup();

    // Welt aus MAP bauen
    let startX = TILE*2, startY = TILE*2;
    for (let y=0; y<MAP.length; y++){
      for (let x=0; x<MAP[0].length; x++){
        const ch = MAP[y][x];
        const px = x*TILE + TILE/2;
        const py = y*TILE + TILE/2;

        // Boden (damit Gänge sichtbar sind)
        this.add.image(px, py, "floor").setDepth(-5);

        if (ch === "#"){
          this.walls.create(px, py, "wall");
        } else if (ch === "S"){
          startX = px; startY = py;
        } else if (ch === "M"){
          const n = this.npcs.create(px, py, "mom").setData("id","mom");
          n.setData("line", "Mama (Kasse): 'Erst zahlen, dann saunieren!'");
        } else if (ch === "F"){
          const n = this.npcs.create(px, py, "dad").setData("id","dad");
          n.setData("line", "Papa (Sauna): 'Handtuch unterlegen!'");
        } else if (ch === "D"){
          this.doors.create(px, py, "door1").setData("id","door1").setData("locked", true);
        } else if (ch === "E"){
          this.doors.create(px, py, "door2").setData("id","door2").setData("locked", true);
        } else if (ch === "X"){
          this.exit.create(px, py, "exit");
        }
      }
    }

    // ------- Spieler -------
    this.player = this.textures.exists("diver")
      ? this.physics.add.sprite(startX, startY, "diver", 0).setScale(PLAYER_SCALE)
      : this.physics.add.image(startX, startY, "player");

    this.player.setCollideWorldBounds(true);
    this.player.body.setDrag(600,600);
    this.player.body.setMaxVelocity(320,320);
    this.updateBodySize();
    this.player.setFlipX(true); // Start-Blickrichtung: rechts

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

    // ------- HUD / Schlüssel -------
    this.haveMomKey = false;
    this.haveDadKey = false;
    this.hud = this.add.text(16,16,"Schlüssel: – / –\n[E] reden / benutzen",
      { fontFamily:"system-ui, sans-serif", fontSize:"24px", color:"#e6f0ff" })
      .setScrollFactor(0).setDepth(2000);

    // ------- O₂-Anzeige (wie Level1) -------
    this.gameOver   = false;
    this.oxygenMax  = 40;
    this.oxygen     = this.oxygenMax;
    this.oxyBar     = this.makeOxygenBar();
    this.time.addEvent({
      delay:1000, loop:true, callback: ()=>{
        if (this.gameOver) return;
        this.oxygen = Math.max(0, this.oxygen-1);
        this.updateOxygenBar();
        if (this.oxygen <= 0) this.fail("Keine Luft mehr!");
      }
    });

    // Kollisionen/Overlaps
    this.physics.add.collider(this.player, this.walls);
    this.physics.add.collider(this.player, this.doors, (_pl, door)=>{
      if (door.getData("locked")){
        this.showToast("Verschlossene Tür. Sprich mit Mama/Papa für Schlüssel!");
      }
    });
    this.physics.add.overlap(this.player, this.npcs, (_pl, npc)=> this.talkTo(npc));
    this.physics.add.overlap(this.player, this.exit, ()=> this.tryFinish());

    // Steuerung
    this.keys = this.input.keyboard.addKeys({
      left:"LEFT", right:"RIGHT", up:"UP", down:"DOWN",
      a:"A", d:"D", w:"W", s:"S", e:"E", esc:"ESC"
    });

    // ESC → Menü
    this.add.text(16, this.scale.height-10, "⟵ Menü (ESC)",
      { fontFamily:"system-ui, sans-serif", fontSize:"22px", color:"#a0c8ff" })
      .setScrollFactor(0).setOrigin(0,1).setDepth(2000);
    this.input.keyboard.on("keydown-ESC", ()=> this.scene.start("MenuScene"));
  }

  // ------- Interaktionen -------
  talkTo(npc){
    if (!this.keys.e.isDown) return;
    const id = npc.getData("id");

    if (id === "mom" && !this.haveMomKey){
      this.haveMomKey = true;
      this.showToast(npc.getData("line") + "  → Kassen-Schlüssel erhalten!");
      this.openDoor("door1");
    } else if (id === "dad" && !this.haveDadKey){
      this.haveDadKey = true;
      this.showToast(npc.getData("line") + "  → Sauna-Schlüssel erhalten!");
      this.openDoor("door2");
    } else {
      this.showToast(npc.getData("line"));
    }
    this.updateHud();
  }

  openDoor(id){
    this.doors.children.iterate(d=>{
      if (d.getData("id")===id && d.getData("locked")){
        d.setTexture("door_open");
        d.setData("locked", false);
        d.disableBody(true, true);                 // keine Kollision mehr
        this.add.image(d.x, d.y, "door_open").setDepth(-4); // Deko
      }
    });
  }

  tryFinish(){
    if (this.haveMomKey && this.haveDadKey){
      this.win();
    } else {
      this.showToast("Die Ausgangstür öffnet sich erst mit beiden Schlüsseln.");
    }
  }

  // ------- Update / Bewegung -------
  update(){
    const speed = 300;
    const ix = (this.keys.left.isDown || this.keys.a.isDown ? -1 : 0) +
               (this.keys.right.isDown|| this.keys.d.isDown ?  1 : 0);
    const iy = (this.keys.up.isDown   || this.keys.w.isDown ? -1 : 0) +
               (this.keys.down.isDown || this.keys.s.isDown ?  1 : 0);

    this.player.body.setAcceleration(ix*speed*2, iy*speed*2);

    if (ix!==0 || iy!==0){
      if (this.textures.exists("diver")) this.player.play("diver_swim", true);
      if (ix < 0)      this.player.setFlipX(false);
      else if (ix > 0) this.player.setFlipX(true);
    } else {
      this.player.body.setAcceleration(0,0);
      if (this.textures.exists("diver")) this.player.play("diver_idle", true);
    }
  }

  // ------- UI / Helpers -------
  makeSimpleTextures(){
    const g = this.add.graphics();
    const t = this.TILE;
    // floor
    g.clear(); g.fillStyle(0x06202c, 1); g.fillRect(0,0,t,t); g.generateTexture("floor", t, t);
    // wall
    g.clear(); g.fillStyle(0x0b3a4e, 1); g.fillRect(0,0,t,t);
    g.lineStyle(4, 0x0f5776, 0.9); g.strokeRect(2,2,t-4,t-4);
    g.generateTexture("wall", t, t);
    // doors
    g.clear(); g.fillStyle(0x1a5c3a, 1); g.fillRect(0,0,t,t); g.generateTexture("door1", t, t);
    g.clear(); g.fillStyle(0x5c1a3a, 1); g.fillRect(0,0,t,t); g.generateTexture("door2", t, t);
    g.clear(); g.fillStyle(0x123a20, 1); g.fillRect(0,0,t,t);
    g.lineStyle(6, 0x1eff7e, 0.9); g.strokeRect(8,8,t-16,t-16); g.generateTexture("door_open", t, t);
    // exit
    g.clear(); g.fillStyle(0x274b63, 1); g.fillRect(0,0,t,t);
    g.lineStyle(6, 0xffffff, 0.9); g.strokeRect(10,10,t-20,t-20); g.generateTexture("exit", t, t);
    // NPC-Icons
    g.clear(); g.fillStyle(0xffe08a, 1); g.fillCircle(t/2, t/2, t*0.4); g.generateTexture("mom", t, t);
    g.clear(); g.fillStyle(0x9ad0ff, 1); g.fillCircle(t/2, t/2, t*0.4); g.generateTexture("dad", t, t);
    // Fallback Player
    g.clear(); g.fillStyle(0xffffff, 1); g.fillRect(0,0,48,32); g.generateTexture("player", 48, 32);
    g.destroy();
  }

  makeOxygenBar(){
    const W = this.scale.width;
    const BAR_W = 220, BAR_H = 20, RIGHT_PAD = 40;
    const leftX = W - RIGHT_PAD - BAR_W, y = 40;

    const bg = this.add.rectangle(leftX, y, BAR_W, BAR_H, 0xffffff, 0.12)
      .setOrigin(0,0.5).setScrollFactor(0).setDepth(1000);

    const fg = this.add.rectangle(leftX, y, BAR_W, BAR_H, 0x67b7ff, 0.95)
      .setOrigin(0,0.5).setScrollFactor(0).setDepth(1001);

    const outline = this.add.rectangle(leftX, y, BAR_W, BAR_H)
      .setOrigin(0,0.5).setStrokeStyle(2, 0xaad4ff, 1)
      .setScrollFactor(0).setDepth(1002).setFillStyle(0,0);

    this.add.text(leftX + BAR_W/2, y + 24, "Sauerstoff", {
      fontFamily:"system-ui", fontSize:"14px", color:"#a0c8ff"
    }).setOrigin(0.5,0).setScrollFactor(0).setDepth(1002);

    return { bg, fg, outline, leftX, width: BAR_W };
  }

  updateOxygenBar(){
    const p = Phaser.Math.Clamp(this.oxygen/this.oxygenMax, 0, 1);
    this.oxyBar.fg.scaleX = p; // füllt von links
  }

  updateHud(){
    const a = this.haveMomKey ? "✓" : "–";
    const b = this.haveDadKey ? "✓" : "–";
    this.hud.setText(`Schlüssel: ${a} / ${b}\n[E] reden / benutzen`);
  }

  updateBodySize(){
    // schmalere Hitbox, damit man besser durch enge Gänge passt
    const bw=this.player.displayWidth*0.38, bh=this.player.displayHeight*0.52;
    this.player.body.setSize(bw,bh);
    this.player.body.setOffset(
      (this.player.displayWidth  - bw)/2,
      (this.player.displayHeight - bh)/2
    );
  }

  showToast(msg){
    const W=this.scale.width, H=this.scale.height;
    const panel=this.add.rectangle(W/2, H*0.92, 1100, 64, 0x000000, 0.55)
      .setScrollFactor(0).setDepth(1500);
    const t=this.add.text(W/2, H*0.92, msg,
      { fontFamily:"system-ui, sans-serif", fontSize:"24px", color:"#e6f0ff", wordWrap:{width:1000} })
      .setOrigin(0.5).setScrollFactor(0).setDepth(1501);
    this.time.delayedCall(1400, ()=>{ panel.destroy(); t.destroy(); });
  }

  // ------- Endbildschirme wie Level1 -------
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
    const W=this.scale.width, H=this.scale.height;
    const dim   = this.add.rectangle(W/2,H/2,W,H,0x000000,0.55).setScrollFactor(0).setDepth(3000);
    const panel = this.add.rectangle(W/2,H/2,680,320,0x071a2b,0.95).setScrollFactor(0).setDepth(3001);
    this.add.text(W/2,H/2-90,title,{ fontFamily:"system-ui", fontSize:"36px", color:"#e6f0ff"})
      .setOrigin(0.5).setScrollFactor(0).setDepth(3002);

    const makeBtn = (txt, y, onClick)=>{
      const r=this.add.rectangle(W/2, y, 260, 56, 0x0d2e46, 1).setScrollFactor(0).setDepth(3002).setInteractive({ useHandCursor:true });
      const t=this.add.text(W/2, y, txt, { fontFamily:"system-ui", fontSize:"22px", color:"#cfe9ff"}).setOrigin(0.5).setScrollFactor(0).setDepth(3003);
      r.on("pointerover", ()=>r.setFillStyle(0x134062,1));
      r.on("pointerout",  ()=>r.setFillStyle(0x0d2e46,1));
      r.on("pointerdown", ()=>{ onClick(); dim.destroy(); panel.destroy(); r.destroy(); t.destroy(); });
    };
    makeBtn("Nochmal",  H/2+10, ()=> this.scene.restart());
    makeBtn("Zum Menü", H/2+80, ()=> this.scene.start("MenuScene"));
  }
}

