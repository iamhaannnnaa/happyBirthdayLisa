// scenes/level2.js
const Phaser = window.Phaser;
const DEBUG = false;

/* === DEBUG: Level2 Version Marker (Safari-/Legacy-safe) === */
(function () {
  var VERSION = "L2-2025-09-08-final";
  var now = new Date().toISOString();
  var url = "(unknown)";

  try {
    if (typeof document !== "undefined") {
      if (document.currentScript && document.currentScript.src) {
        url = document.currentScript.src;
      } else {
        var scripts = document.getElementsByTagName("script");
        if (scripts && scripts.length) {
          var last = scripts[scripts.length - 1];
          if (last && last.src) url = last.src;
        }
      }
    }
    if (url === "(unknown)" && typeof location !== "undefined" && location.href) {
      url = location.href;
    }
  } catch (e) {}

  try {
    console.log("%c[Level2] geladen:", "color:#4cf;font-weight:700;", VERSION, "@", now);
    console.log("Quelle:", url);
    if (typeof window !== "undefined") {
      try {
        Object.defineProperty(window, "__LEVEL2_VERSION__", { value: VERSION, writable: false, configurable: true });
      } catch (_) { window.__LEVEL2_VERSION__ = VERSION; }
      window.level2Info = function () { return { version: VERSION, url: url, loadedAt: now }; };
    }
  } catch (e) {}
})();

export default class Level2 extends Phaser.Scene {
  constructor(){ super("Level2"); }


}

