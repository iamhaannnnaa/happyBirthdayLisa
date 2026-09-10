// fullscreen.js — Vollbild-Knopf oben rechts.
//
// Chrome, Android und Rechner: der Knopf schaltet echtes Vollbild ein und
// versucht zusätzlich, das Querformat zu sperren.
// iPhone/iPad-Safari: Apple erlaubt Webseiten kein Vollbild (nur Videos).
// Dort erklärt derselbe Knopf den einzigen Weg ohne Browserleiste:
// „Zum Home-Bildschirm hinzufügen".

(function () {
  var root = document.documentElement;
  var btn  = document.getElementById("fs-btn");
  var help = document.getElementById("fs-help");
  var helpClose = document.getElementById("fs-help-close");

  var request = root.requestFullscreen || root.webkitRequestFullscreen || root.mozRequestFullScreen;
  var release = document.exitFullscreen || document.webkitExitFullscreen || document.mozCancelFullScreen;
  var supported = !!request;

  var standalone = (window.navigator.standalone === true) ||
                   (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) ||
                   (window.matchMedia && window.matchMedia("(display-mode: fullscreen)").matches);

  function inFullscreen() {
    return !!(document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement);
  }

  function lockLandscape() {
    try {
      if (screen.orientation && screen.orientation.lock) {
        var p = screen.orientation.lock("landscape");
        if (p && p.catch) p.catch(function () {});
      }
    } catch (e) { /* nicht überall unterstützt */ }
  }

  function enter() {
    if (!supported || inFullscreen()) return;
    try {
      var p = request.call(root, { navigationUI: "hide" });
      if (p && p.then) p.then(lockLandscape).catch(function () {});
      else lockLandscape();
    } catch (e) { /* abgelehnt */ }
  }

  function leave() {
    if (!inFullscreen() || !release) return;
    try { release.call(document); } catch (e) {}
  }

  function showHelp() {
    if (help) help.hidden = false;
  }
  function hideHelp() {
    if (help) help.hidden = true;
  }
  if (helpClose) helpClose.addEventListener("click", hideHelp);
  if (help) {
    help.addEventListener("click", function (ev) {
      if (ev.target === help) hideHelp();      // neben dem Kasten tippen schließt
    });
  }

  function refresh() {
    if (!btn) return;
    // Der Knopf ist immer da – nur läuft schon alles ohne Leiste, wenn das
    // Spiel vom Home-Bildschirm gestartet wurde.
    btn.hidden = standalone && !supported;
    var full = inFullscreen();
    btn.textContent = full ? "⤡" : "⛶";
    btn.setAttribute("aria-label", full ? "Vollbild beenden" : "Vollbild");
    btn.classList.toggle("is-full", full);
  }

  if (btn) {
    btn.addEventListener("click", function (ev) {
      ev.preventDefault();
      if (!supported) { showHelp(); return; }   // Safari auf dem iPhone
      inFullscreen() ? leave() : enter();
    });
  }
  ["fullscreenchange", "webkitfullscreenchange", "mozfullscreenchange"].forEach(function (evt) {
    document.addEventListener(evt, refresh);
  });
  refresh();

  // Auf Geräten, die es können: beim ersten Tippen automatisch ins Vollbild.
  var coarse = window.matchMedia && window.matchMedia("(pointer: coarse)").matches;
  if (supported && coarse) {
    window.addEventListener("pointerdown", function once() {
      window.removeEventListener("pointerdown", once);
      if (window.innerWidth > window.innerHeight) enter();
    }, { passive: true });
  }
})();
