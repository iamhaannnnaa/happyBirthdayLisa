// scenes/ui.js
// Gemeinsame Meldungs-Optik: kleine Pergament-Notiz im Stil der Briefe.
// Wird in Level 2 (Schlüssel gefunden) und Level 3 (Foto gemacht) benutzt,
// damit alle Hinweise gleich aussehen.

const Phaser = window.Phaser;

export const SERIF = "Georgia, 'Iowan Old Style', 'Times New Roman', serif";
export const INK   = "#3f2d1c";

// Spielt ein Video bildschirmfüllend ab – ohne Titel, ohne Beschriftung,
// nur ein kleines ✕ oben links. urls: Liste von Dateien, der Browser nimmt
// die erste, die er kann (mp4 fürs iPhone, webm als Rückfall).
export function zeigeVideo(scene, urls, onClose){
  const W = scene.scale.width, H = scene.scale.height;
  const lay = scene.add.container(W/2, H/2).setScrollFactor(0).setDepth(21000);
  lay.add(scene.add.rectangle(0, 0, W*2, H*2, 0x05080b, 0.96));

  // Bedienknöpfe des Levels ausblenden, damit nur das Video zu sehen ist
  const touchScene = scene.scene.get("TouchScene");
  const touchWarSichtbar = !!(touchScene && touchScene.scene.isVisible());
  if (touchWarSichtbar) touchScene.scene.setVisible(false);

  let video = null;
  const schliessen = ()=>{
    if (!lay.active) return;
    try { if (video) video.stop(); } catch(e){}
    scene._laufendesVideo = null;
    if (touchWarSichtbar && touchScene) touchScene.scene.setVisible(true);
    lay.destroy();
    if (onClose) onClose();
  };

  try {
    video = scene.add.video(0, 0);
    video.setDepth(1);
    lay.add(video);
    const anpassen = ()=>{
      const vw = video.width || 640, vh = video.height || 360;
      video.setScale(Math.min((W*0.94)/vw, (H*0.88)/vh));
    };
    video.on("created", ()=>{ anpassen(); try { video.play(false); } catch(e){} });
    video.on("play", anpassen);
    video.on("complete", schliessen);
    video.loadURL(Array.isArray(urls) ? urls : [urls]);
    try { video.play(false); } catch(e){}   // der Tipp auf den Knopf zählt als Geste
    anpassen();
  } catch(e){
    lay.add(scene.add.text(0, 0, "Video lässt sich hier nicht abspielen.", {
      fontFamily:"system-ui, sans-serif", fontSize:"24px", color:"#e6d8bd"
    }).setOrigin(0.5));
  }
  scene._laufendesVideo = video;

  // links oben – rechts oben sitzt schon der Vollbild-Knopf der Seite
  // scrollFactor(0) muss auf dem Knopf selbst stehen, nicht nur auf dem
  // Container – sonst rechnet Phaser die Trefferfläche mit dem Kamera-Versatz
  // um und der Knopf reagiert in mitfahrenden Levels nicht.
  const zu = scene.add.circle(-W*0.44, -H*0.41, 34, 0x1a1410, 0.85)
    .setStrokeStyle(2, 0xd8c9a8, 0.6)
    .setScrollFactor(0)
    .setInteractive({ useHandCursor:true });
  const zuT = scene.add.text(-W*0.44, -H*0.41, "✕", {
    fontFamily:"system-ui, sans-serif", fontSize:"30px", color:"#f4e7cd"
  }).setOrigin(0.5).setScrollFactor(0);
  lay.add([zu, zuT]);
  zu.on("pointerdown", schliessen);

  // Sicherheitsnetz: Tipp oben links schließt das Video auch dann
  scene.input.on("pointerdown", (p)=>{
    if (!lay.active) return;
    if (p.x < W*0.14 && p.y < H*0.16) schliessen();
  });

  return lay;
}

// Baut einen Brief auf Pergament (wie in Level 2 und 3).
// opts: { title, body, footer, hint, width, height }
export function makeLetter(scene, opts){
  const o = Object.assign({
    title: "Liebe Lisa,", body: "", footer: "", hint: "", width: 760, height: 520
  }, opts || {});
  const W = scene.scale.width, H = scene.scale.height;
  const zoom = (scene.cameras && scene.cameras.main && scene.cameras.main.zoom) || 1;

  const cont = scene.add.container(W/2, H/2)
    .setScrollFactor(0)
    .setDepth(25000)
    .setScale(1 / zoom)
    .setVisible(false)
    .setAlpha(0);

  const dim = scene.add.rectangle(0, 0, W*2, H*2, 0x04141c, 0.72).setOrigin(0.5);

  const paper = scene.textures.exists("parchment")
    ? scene.add.image(0, 0, "parchment").setOrigin(0.5).setDisplaySize(o.width, o.height)
    : scene.add.rectangle(0, 0, o.width, o.height, 0xe9dcbf, 1).setOrigin(0.5);
  paper.setAngle(-1.1);

  const head = scene.add.text(-o.width/2 + 64, -o.height/2 + 46, o.title, {
    fontFamily: SERIF, fontSize: "34px", color: INK, fontStyle: "italic"
  }).setOrigin(0, 0).setAngle(-1.1);

  const txt = scene.add.text(-o.width/2 + 64, -o.height/2 + 112, o.body, {
    fontFamily: SERIF, fontSize: "21px", color: INK, align: "left",
    lineSpacing: 7, wordWrap: { width: o.width - 150 }
  }).setOrigin(0, 0).setAngle(-1.1);

  const parts = [dim, paper, head, txt];

  if (o.footer){
    parts.push(scene.add.text(-o.width/2 + 64, o.height/2 - 96, o.footer, {
      fontFamily: SERIF, fontSize: "17px", color: "#6b5334", fontStyle: "italic"
    }).setOrigin(0, 0).setAngle(-1.1));
  }

  // Siegel unten rechts
  const sx = o.width/2 - 86, sy = o.height/2 - 74;
  parts.push(scene.add.circle(sx, sy, 30, 0x8e2f2c, 1));
  parts.push(scene.add.circle(sx, sy, 24, 0x000000, 0).setStrokeStyle(2, 0xb75a52, 0.9));
  parts.push(scene.add.text(sx, sy, "H", {
    fontFamily: SERIF, fontSize: "26px", color: "#f0cfc4"
  }).setOrigin(0.5));

  if (o.hint){
    const hint = scene.add.text(0, o.height/2 + 44, o.hint, {
      fontFamily: "system-ui, sans-serif", fontSize: "20px", color: "#cfe9ff"
    }).setOrigin(0.5).setAlpha(0.85);
    scene.tweens.add({ targets: hint, alpha: 0.35, duration: 900, yoyo: true, repeat: -1 });
    parts.push(hint);
  }

  cont.add(parts);
  cont._dim = dim;
  cont._paper = paper;
  return cont;
}

// Legt die Notiz an (unsichtbar). Position: oberes Drittel, damit sie
// die Spielfigur nicht verdeckt.
export function makeNote(scene, opts){
  const o = Object.assign({ width: 640, depth: 20000, y: 0.26 }, opts || {});
  const W = scene.scale.width, H = scene.scale.height;
  const zoom = (scene.cameras && scene.cameras.main && scene.cameras.main.zoom) || 1;

  // Zielhöhe auf dem Bildschirm; bei gezoomter Kamera muss die Position
  // zurückgerechnet werden, sonst rutscht die Notiz aus dem Bild.
  const targetY = H * o.y;
  const posY = H/2 + (targetY - H/2) / zoom;

  const cont = scene.add.container(W/2, posY)
    .setScrollFactor(0)
    .setDepth(o.depth)
    .setScale(1 / zoom)          // Kamera-Zoom herausrechnen
    .setAlpha(0)
    .setVisible(false);

  const paper = scene.textures.exists("parchment")
    ? scene.add.image(0, 0, "parchment").setOrigin(0.5).setDisplaySize(o.width, 150)
    : scene.add.rectangle(0, 0, o.width, 150, 0xe9dcbf, 1).setOrigin(0.5);
  paper.setAngle(-0.8);

  const icon = scene.add.image(0, 0, "__DEFAULT").setVisible(false);

  const txt = scene.add.text(0, 0, "", {
    fontFamily: SERIF, fontSize: "23px", color: INK,
    align: "center", lineSpacing: 5,
    wordWrap: { width: o.width - 130 }
  }).setOrigin(0.5).setAngle(-0.8);

  cont.add([paper, icon, txt]);
  cont._paper = paper;
  cont._icon  = icon;
  cont._text  = txt;
  cont._width = o.width;
  return cont;
}

// Zeigt die Notiz. text: String oder Array von Zeilen.
// opts: { icon: "textur-key", ms: Anzeigedauer }
export function showNote(scene, cont, text, opts){
  if (!cont) return;
  const o = Object.assign({ icon: null, ms: 1400 }, opts || {});
  const msg = Array.isArray(text) ? text.join("\n") : String(text || "");

  cont._text.setText(msg);

  // Bild links daneben (z. B. der fotografierte Hai)
  const withIcon = !!(o.icon && scene.textures.exists(o.icon));
  if (withIcon){
    cont._icon.setTexture(o.icon).setVisible(true);
    const src = scene.textures.get(o.icon).getSourceImage();
    const h = 62;
    const sc = (src && src.height) ? h / src.height : 1;
    cont._icon.setScale(sc);
    const iw = src ? src.width * sc : h;
    cont._icon.setPosition(-cont._width/2 + 46 + iw/2, 0);
    cont._text.setPosition(iw/2 + 26, 0);
  } else {
    cont._icon.setVisible(false);
    cont._text.setPosition(0, 0);
  }

  // Papier an die Texthöhe anpassen
  const needed = Math.max(130, cont._text.height + 62);
  cont._paper.setDisplaySize(cont._width, needed);

  scene.tweens.killTweensOf(cont);
  const zoom = (scene.cameras && scene.cameras.main && scene.cameras.main.zoom) || 1;
  const base = 1 / zoom;

  cont.setVisible(true).setAlpha(0).setScale(base * 0.92);
  scene.tweens.add({
    targets: cont, alpha: 1, scale: base, duration: 170, ease: "Back.easeOut",
    onComplete: () => {
      scene.tweens.add({
        targets: cont, alpha: 0, duration: 260, delay: o.ms, ease: "Quad.easeIn",
        onComplete: () => cont.setVisible(false)
      });
    }
  });
}
