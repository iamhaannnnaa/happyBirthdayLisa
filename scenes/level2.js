// scenes/level2.js
const Phaser = window.Phaser;
const DEBUG = false;

export default class Level2 extends Phaser.Scene {
  constructor(){ super("Level2"); }

  preload(){
    // Diver nur laden, wenn noch nicht vorhanden
    if (!this.textures.exists("diver")){
      this.load.spritesheet("diver", "assets/diver/diver_v4.png",
        { frameWidth: 1024, frameHeight: 1024 });
    }
  }

  create(){
    // --- ASCII-Labyrinth ---
    // # = Wand, . = Boden, D = Tür (Mama), E = Tür (Papa),
    // M = Mama, F = Papa, S = Start, X = Ausgang
    const MAP = [
      "########################################",
      "#S....#..............####..............#",
      "###.#.#.###########.#..#..######.#######",
      "#...#...#.........#.#..#..#....#.......#",
      "#.#####.#.#######.#.####..#.##.#######.#",
      "#.....#.#.#.....#.#......##.#..#.....#.#",
      "#####.#.#.#.###.#.#########.#.##.###.#.#",
      "#...#.#.#.#...#.#.#.......#.#..#...#.#.#",
      "#.#.#.#.#.###.#.#.#.#####.#.####.#.#.#.#",
      "#.#.#...#...#.#...#...#...#......#.#.#.#",
      "#.#.#########.#######.#.##########.#.#.#",
      "#.#.........#.......#.#.#..........#.#.#",
      "#.#########.#######.#.#.#.##########.#.#",
      "#.......#..#.....#.#.#.#.#.#........#.#X",
      "#######.#.##.###.#.#.#.#.#.#.########.#E",
      "#.....#.#..#.#.#.#.#.#.#.#.#.#......#.#.",
      "#.###.#.##.#.#.#.#.#.#.#.#.#.#.####.#.#.",
      "#.#...#....#.#.#...#.#.#.#.#.#....#.#.#.",
      "#.#.########.#.#####.#.#.#.#.####.#.#.#.",
      "#.#.#......#.#.....#.#.#.#.#....#.#.#.#.",
      "#.#.#.####.#.#####.#.#.#.#.####.#.#.#.#.",
      "#.#.#.#..#.#.....#.#.#.#.#....#.#.#.#.#.",
      "#.#.#.#M.#.#####.#.#.#.#.####.#.#.#.#.#.",
      "#.#...#..#.....#.#.#.#.#....#.#.#...#.#.",
      "#.#################.#.######.#.#####.#.#",
      "#........F..........#........#.......#D#",
      "########################################"
    ];
    this.TILE = 64;
    this.mapW = MAP[0].length * this.TILE;
    this.mapH = MAP.length     * this.TILE;

    // Welt & Kamera
    this.cameras.main.setBackgroundColor("#041016");
    this.physics.world.setBounds(0,0,this.mapW,this.mapH);
    this.cameras.main.setBounds(0,0,this.mapW,this.mapH);
    this.cameras.main.setRoundPixels(true);

    // Platzhalter-Texturen erzeugen
    this.makeSimpleTextures();

    // Gruppen
    this.walls = this.physics.add.staticGroup();
    this.doors = this.physics.add.staticGroup();
    this.npcs  = this.physics.add.staticGroup();
    this.exit  = this.physics.add.staticGroup();

    // Welt aus MAP bauen
    let startX = 2*this.TILE, startY = 2*this.TILE;
    for (let y=0; y<MAP.length; y++){
      for (let x=0; x<MAP[0].length; x++){
        const ch = MAP[y][x];
        const px = x*this.TILE + this.TILE/2;
        const py = y*this.TILE + this.TILE/2;

        // Boden-Kachel (damit Gänge sichtbar sind)
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
          n.setData("line", "Papa (Sauna): 'Nicht vergessen – Handtuch drunter!'");
        } else if (ch === "D"){
          this.doors.create(px, py, "door1").setData("id","door1").setData("locked", true);
        } else if (ch === "E"){
          this.doors.create(px, py, "door2").setData("id","door2").setData("locked", true);
        } else if (ch === "X"){
          this.exit.create(px, py, "exit");
        }
      }
    }

    // Spieler
    this.player = this.textures.exists("diver")
      ? this.physics.add.sprite(startX,startY,"diver",0).setScale(0.65)
      : this.physics.add.image(startX,startY,"player");

    this.player.setCollideWorldBounds(true);
    this.player.body.setDrag(600,600);
    this.player.body.setMaxVelocity(320,320);
    this.updateBodySize();

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

    // HUD / Schlüssel
    this.haveMomKey = false;
    this.haveDadKey = false;
    this.hud = this.add.text(16,16,"Schlüssel: – / –\n[E] reden / benutzen",
      { fontFamily:"system-ui, sans-serif", fontSize:"24px", color:"#e6f0ff" })
      .setScrollFactor(0).setDepth(20);

    // Kollisionen
    this.physics.add.collider(this.player, this.walls);
    this.physics.add.collider(this.player, this.doors, (pl, door)=>{
      if (door.getData("locked")){
        this.showToast("Verschlossene Tür. Sprich mit Mama/Papa für Schlüssel!");
      }
    });

    // Overlaps
    this.physics.add.overlap(this.player, this.npcs, (pl, npc)=> this.talkTo(npc));
    this.physics.add.overlap(this.player, this.exit, ()=> this.tryFinish());

    // Steuerung
    this.keys = this.input.keyboard.addKeys({
      left:"LEFT", right:"RIGHT", up:"UP", down:"DOWN",
      a:"A", d:"D", w:"W", s:"S", e:"E", esc:"ESC"
    });

    // Sauerstoff
    this.oxygenMax = 40; this.oxygen = this.oxygenMax;
    this.oxyBar = this.makeOxygenBar();
    this.time.addEvent({ delay:1000, loop:true, callback:()=>{
      this.oxygen = Math.max(0, this.oxygen-1);
      this.updateOxygenBar();
      if (this.oxygen <= 0) this.gameOver("Du bist außer Atem!");
    }});

    // ESC
    this.add.text(16, this.scale.height-10, "⟵ Menü (ESC)",
      { fontFamily:"system-ui, sans-serif", fontSize:"22px", color:"#a0c8ff" })
      .setScrollFactor(0).setOrigin(0,1);
    this.input.keyboard.on("keydown-ESC", ()=> this.scene.start("MenuScene"));
  }

  talkTo(npc){
    if (this._talking) return;
    if (!this.keys.e.isDown) return;
    const id = npc.getData("id");
    if (id === "mom" && !this.haveMomKey){
      this.haveMomKey = true;
      this.showToast(npc.getData("line") + "  → Du erhältst den Kassen-Schlüssel!");
      this.openDoor("door1");
    } else if (id === "dad" && !this.haveDadKey){
      this.haveDadKey = true;
      this.showToast(npc.getData("line") + "  → Du erhältst den Sauna-Schlüssel!");
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
      this.scene.start("MenuScene");
      this.showToast("Geschafft! Weiter geht's …");
    } else {
      this.showToast("Die Ausgangstür öffnet sich erst mit beiden Schlüsseln.");
    }
  }

  update(time, dt){
    const speed = 300;
    const ix = (this.keys.left.isDown || this.keys.a.isDown ? -1 : 0) +
               (this.keys.right.isDown || this.keys.d.isDown ? 1 : 0);
    const iy = (this.keys.up.isDown   || this.keys.w.isDown ? -1 : 0) +
               (this.keys.down.isDown || this.keys.s.isDown ? 1 : 0);

    this.player.body.setAcceleration(ix*speed*2, iy*speed*2);
    if (ix===0 && iy===0){
      this.player.body.setAcceleration(0,0);
      if (this.textures.exists("diver")) this.player.play("diver_idle", true);
    } else {
      if (this.textures.exists("diver")) this.player.play("diver_swim", true);
    }
    if (ix!==0) this.player.setFlipX(ix<0);
  }

  // --- Hilfen & UI ---
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
    const W=this.scale.width, H=this.scale.height;
    const barW = 260, barH = 18;
    const bg = this.add.rectangle(W-20, 20, barW, barH, 0x000000, 0.35).setOrigin(1,0).setScrollFactor(0);
    const fg = this.add.rectangle(W-20-barW/2, 29, barW-12, barH-12, 0x39c5ff, 0.9).setOrigin(0.5,0).setScrollFactor(0);
    fg.maxW = barW-12;
    return {bg,fg};
  }
  updateOxygenBar(){
    const pct = Phaser.Math.Clamp(this.oxygen/this.oxygenMax, 0, 1);
    this.oxyBar.fg.width = this.oxyBar.fg.maxW * pct;
  }

  updateHud(){
    const a = this.haveMomKey ? "✓" : "–";
    const b = this.haveDadKey ? "✓" : "–";
    this.hud.setText(`Schlüssel: ${a} / ${b}\n[E] reden / benutzen`);
  }

  updateBodySize(){
    const bw=this.player.displayWidth*0.45, bh=this.player.displayHeight*0.58;
    if (this.player.body?.setSize) this.player.body.setSize(bw,bh,true);
  }

  showToast(msg){
    const W=this.scale.width, H=this.scale.height;
    const panel=this.add.rectangle(W/2, H*0.92, 1100, 64, 0x000000, 0.5).setScrollFactor(0).setDepth(50);
    const t=this.add.text(W/2, H*0.92, msg,
      { fontFamily:"system-ui, sans-serif", fontSize:"24px", color:"#e6f0ff", wordWrap:{width:1000} })
      .setOrigin(0.5).setDepth(51);
    this.time.delayedCall(1400, ()=>{ panel.destroy(); t.destroy(); });
  }

  gameOver(msg){
    this.physics.pause();
    this.showToast(msg);
    this.time.delayedCall(1200, ()=> this.scene.start("MenuScene"));
  }
}
