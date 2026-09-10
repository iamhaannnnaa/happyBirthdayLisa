// progress.js — gemeinsamer Spielstand über alle Level
//
// Ersetzt die verstreuten Einzel-Flags: hier steht an einer Stelle,
// welche Level geschafft sind. Daraus ergibt sich auch, welches Level
// im Menü freigeschaltet ist.

const KEY = "bd_progress_v1";

// Reihenfolge der Level – jedes Level schaltet das nächste frei
export const ORDER = ["Level1", "LevelCats", "LevelMemory", "Level2", "Level3"];

// Namen an einer Stelle, damit Menü und Endbildschirme dasselbe sagen
export const LABELS = {
  Level1:      "Limes-Ruine",
  LevelCats:   "Die zwei Katzen",
  LevelMemory: "Erinnerungs-Tauchgang",
  Level2:      "Limes-Thermen-Oase",
  Level3:      "Reichstädter Tage"
};

// Anzeige-Nummer (1-basiert) und voller Name für ein Level
export function levelNumber(id){ return ORDER.indexOf(id) + 1; }
export function levelTitle(id){
  const n = levelNumber(id);
  return (n > 0 ? `Level ${n} – ` : "") + (LABELS[id] || id);
}
// Was kommt nach diesem Level? null, wenn es das letzte ist.
export function nextLevel(id){
  const i = ORDER.indexOf(id);
  return (i >= 0 && i < ORDER.length - 1) ? ORDER[i+1] : null;
}

// Alte Einzel-Keys, damit "Zurücksetzen" wirklich alles löscht
const LEGACY_KEYS = [
  "l1_intro_seen_v1",
  "l2_intro_seen_v1",
  "l3_intro_seen_v1",
  "l3_gift_shown_v1",
  "l3_sharkdex_v1",
  "cats_intro_seen_v1",
  "memo_intro_seen_v1"
];

export function loadProgress(){
  try {
    const raw = localStorage.getItem(KEY);
    if (raw){
      const obj = JSON.parse(raw);
      if (obj && typeof obj === "object"){
        return { done: obj.done || {}, giftSeen: obj.giftSeen === true };
      }
    }
  } catch(e){ console.warn("Spielstand laden fehlgeschlagen:", e); }
  return { done: {}, giftSeen: false };
}

export function saveProgress(p){
  try { localStorage.setItem(KEY, JSON.stringify(p)); }
  catch(e){ console.warn("Spielstand speichern fehlgeschlagen:", e); }
}

export function markLevelDone(id){
  const p = loadProgress();
  p.done[id] = true;
  saveProgress(p);
  return p;
}

export function isLevelDone(id){
  return loadProgress().done[id] === true;
}

// Level 1 ist immer offen, jedes weitere braucht das Level davor
export function isUnlocked(id){
  const i = ORDER.indexOf(id);
  if (i <= 0) return true;
  return isLevelDone(ORDER[i-1]);
}

// Wie viele Level sind geschafft
export function doneCount(){
  const p = loadProgress();
  return ORDER.filter(id => p.done[id] === true).length;
}

export function allLevelsDone(){
  return doneCount() === ORDER.length;
}

export function markGiftSeen(){
  const p = loadProgress();
  p.giftSeen = true;
  saveProgress(p);
}

export function resetProgress(){
  try {
    localStorage.removeItem(KEY);
    for (const k of LEGACY_KEYS) localStorage.removeItem(k);
  } catch(e){ console.warn("Zurücksetzen fehlgeschlagen:", e); }
}
