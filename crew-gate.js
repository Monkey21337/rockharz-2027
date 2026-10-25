"use strict";

/* =========================================================
   CREW-GATE – PIN-Sperre für das private Camp-Tool
   ---------------------------------------------------------
   PIN ändern: CREW_PIN anpassen.
   Sollen danach ALLE Geräte die neue PIN eingeben müssen,
   zusätzlich CREW_REV hochzählen ("1" -> "2").

   Hinweis: Das ist ein Vorhang gegen Zufallsbesucher und
   Crawler, kein Tresor – der Quelltext ist öffentlich lesbar.
   ========================================================= */
(() => {
  const CREW_PIN = "9866";
  const CREW_REV = "1";
  const MAX_TRIES = 5;          // danach kurze Zwangspause
  const COOLDOWN_MS = 30 * 1000;

  const read = key => { try { return localStorage.getItem(key); } catch { return null; } };
  const write = (key, value) => { try { localStorage.setItem(key, value); } catch {} };

  const root = document.documentElement;
  const waiting = [];
  const gate = {
    unlocked: read("crew_auth") === "true" && (read("crew_rev") || "1") === CREW_REV,
    // app.js startet hierüber: sofort, wenn schon entsperrt, sonst nach korrekter PIN
    whenUnlocked(fn) { if (gate.unlocked) fn(); else waiting.push(fn); }
  };
  window.crewGate = gate;

  // Läuft im <head>: Sperre greift, bevor irgendetwas von der App sichtbar wird
  if (!gate.unlocked) root.classList.add("crew-locked");

  function unlock() {
    write("crew_auth", "true");
    write("crew_rev", CREW_REV);
    gate.unlocked = true;
    root.classList.add("crew-unlocking");
    // kurzer Abgang des Sperrbildschirms, dann App freigeben
    setTimeout(() => {
      root.classList.remove("crew-locked", "crew-unlocking");
      waiting.splice(0).forEach(fn => fn());
    }, 380);
  }

  document.addEventListener("DOMContentLoaded", () => {
    if (gate.unlocked) return;
    const form = document.getElementById("crew-lock-form");
    const input = document.getElementById("crew-pin");
    const error = document.getElementById("crew-pin-error");
    const button = form.querySelector("button[type=submit]");
    let tries = 0;

    const showError = text => {
      error.textContent = text;
      error.hidden = false;
      form.classList.remove("crew-shake");
      void form.offsetWidth; // Animation neu starten
      form.classList.add("crew-shake");
    };

    setTimeout(() => input.focus(), 60);

    form.addEventListener("submit", event => {
      event.preventDefault();
      const pin = input.value.replace(/\s+/g, "");
      if (!pin) { showError("Bitte gib die Crew-PIN ein."); input.focus(); return; }
      if (pin === CREW_PIN) { error.hidden = true; unlock(); return; }

      tries++;
      input.value = "";
      if (tries < MAX_TRIES) {
        showError("Falsche PIN. Frag im Camp nach dem Code.");
        input.focus();
        return;
      }
      // zu viele Fehlversuche: kurz sperren
      tries = 0;
      input.disabled = true;
      button.disabled = true;
      let left = COOLDOWN_MS / 1000;
      showError(`Zu viele Versuche. Neuer Versuch in ${left} s.`);
      const timer = setInterval(() => {
        left--;
        error.textContent = `Zu viele Versuche. Neuer Versuch in ${left} s.`;
        if (left > 0) return;
        clearInterval(timer);
        input.disabled = false;
        button.disabled = false;
        error.hidden = true;
        input.focus();
      }, 1000);
    });
  });
})();
