// fullscreen.js — Vollbild-Knopf oben rechts + automatischer Versuch beim ersten Tippen.
// Muss durch eine echte Nutzer-Geste ausgelöst werden, sonst lehnt der Browser ab.
// Auf dem iPhone gibt es die Fullscreen-API nicht – dort bleibt der Knopf aus
// (Alternative: „Zum Home-Bildschirm hinzufügen", das startet ohne Browserleiste).

(function () {
  var root = document.documentElement;
  var btn  = document.getElementById("fs-btn");

  var request = root.requestFullscreen || root.webkitRequestFullscreen || root.mozRequestFullScreen;
  var release = document.exitFullscreen || document.webkitExitFullscreen || document.mozCancelFullScreen;
  var supported = !!request;

  function inFullscreen() {
    return !!(document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement);
  }

  function lockLandscape() {
    try {
      if (screen.orientation && screen.orientation.lock) {
        var p = screen.orientation.lock("landscape");
        if (p && p.catch) p.catch(function () {});
      }
    } catch (e) { /* wird nicht überall unterstützt */ }
  }

  function enter() {
    if (!supported || inFullscreen()) return;
    try {
      var p = request.call(root, { navigationUI: "hide" });
      if (p && p.then) p.then(lockLandscape).catch(function () {});
      else lockLandscape();
    } catch (e) { /* abgelehnt – kein Problem */ }
  }

  function leave() {
    if (!inFullscreen() || !release) return;
    try { release.call(document); } catch (e) {}
  }

  function refresh() {
    if (!btn) return;
    if (!supported) { btn.hidden = true; return; }
    btn.hidden = false;
    var full = inFullscreen();
    btn.textContent = full ? "⤡" : "⛶";
    btn.setAttribute("aria-label", full ? "Vollbild beenden" : "Vollbild");
    // im Vollbild zurückhaltend, damit er das Spiel nicht stört
    btn.classList.toggle("is-full", full);
  }

  if (btn) {
    btn.addEventListener("click", function (ev) {
      ev.preventDefault();
      inFullscreen() ? leave() : enter();
    });
  }
  ["fullscreenchange", "webkitfullscreenchange", "mozfullscreenchange"].forEach(function (evt) {
    document.addEventListener(evt, refresh);
  });
  refresh();

  // Auf dem Handy beim allerersten Tippen automatisch ins Vollbild –
  // das ist die Geste, die der Browser dafür verlangt.
  var coarse = window.matchMedia && window.matchMedia("(pointer: coarse)").matches;
  if (supported && coarse) {
    window.addEventListener("pointerdown", function once() {
      window.removeEventListener("pointerdown", once);
      if (window.innerWidth > window.innerHeight) enter();
    }, { passive: true });
  }
})();
