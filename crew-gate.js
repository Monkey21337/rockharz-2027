"use strict";

/* =========================================================
   CREW-GATE – Zugang zum privaten Camp-Tool
   ---------------------------------------------------------
   Die Crew-Phrase steht NICHT im Code. Sie liegt nur in der
   Firebase-Datenbank unter /crewSecret (für niemanden lesbar).
   app.js meldet das Gerät anonym an und versucht, die Phrase
   unter /members/{uid} zu speichern – die Datenbank-Regeln
   lassen das nur zu, wenn sie mit /crewSecret übereinstimmt.
   Danach darf genau dieses Gerät die Camp-Wertungen lesen und
   schreiben (siehe database.rules.json).

   Alle Geräte aussperren: in der Firebase-Konsole /members
   löschen und /crewSecret ändern – jedes Gerät fragt dann
   automatisch nach der neuen Phrase.
   ========================================================= */
(() => {
  const MEMBER_KEY = "crew_member_v2"; // alter PIN-Schlüssel "crew_auth" gilt nicht mehr
  const MAX_TRIES = 5;                 // danach kurze Zwangspause
  const COOLDOWN_MS = 30 * 1000;

  const read = key => { try { return localStorage.getItem(key); } catch { return null; } };
  const write = (key, value) => { try { localStorage.setItem(key, value); } catch {} };
  const drop = key => { try { localStorage.removeItem(key); } catch {} };

  const root = document.documentElement;
  const waiting = [];
  const gate = {
    unlocked: read(MEMBER_KEY) === "true",
    // app.js startet hierüber: sofort, wenn schon eingetreten, sonst nach geprüfter Phrase
    whenUnlocked(fn) { if (gate.unlocked) fn(); else waiting.push(fn); },
    // app.js ruft das auf, wenn die Datenbank das Gerät nicht (mehr) als Crew kennt
    lock(message) {
      drop(MEMBER_KEY);
      gate.unlocked = false;
      root.classList.add("crew-locked");
      const error = document.getElementById("crew-pin-error");
      if (error && message) { error.textContent = message; error.hidden = false; }
      setTimeout(() => document.getElementById("crew-pin")?.focus(), 60);
    }
  };
  window.crewGate = gate;

  // Läuft im <head>: Sperre greift, bevor irgendetwas von der App sichtbar wird
  if (!gate.unlocked) root.classList.add("crew-locked");

  function unlock() {
    write(MEMBER_KEY, "true");
    gate.unlocked = true;
    root.classList.add("crew-unlocking");
    // kurzer Abgang des Sperrbildschirms, dann App freigeben
    setTimeout(() => {
      root.classList.remove("crew-locked", "crew-unlocking");
      waiting.splice(0).forEach(fn => fn());
    }, 380);
  }

  document.addEventListener("DOMContentLoaded", () => {
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
    const toggle = document.getElementById("crew-pin-toggle");
    toggle.addEventListener("click", () => {
      const show = input.type === "password";
      input.type = show ? "text" : "password";
      toggle.setAttribute("aria-pressed", String(show));
      toggle.setAttribute("aria-label", show ? "Phrase verbergen" : "Phrase anzeigen");
      input.focus();
      input.setSelectionRange(input.value.length, input.value.length);
    });

    const busy = on => {
      input.disabled = on;
      toggle.disabled = on;
      button.disabled = on;
      button.textContent = on ? "Prüfe …" : "Eintreten";
    };

    if (!gate.unlocked) setTimeout(() => input.focus(), 60);

    form.addEventListener("submit", async event => {
      event.preventDefault();
      const phrase = input.value.trim();
      if (!phrase) { showError("Bitte gib die Crew-Phrase ein."); input.focus(); return; }
      if (!window.crewAuth) { showError("Die App lädt noch – gleich nochmal versuchen."); return; }

      busy(true);
      const result = await window.crewAuth.join(phrase);
      busy(false);

      if (result === "ok") { error.hidden = true; input.value = ""; unlock(); return; }
      if (result === "offline") {
        showError("Keine Verbindung zur Datenbank. Die Phrase wird einmal online geprüft – danach geht's auch im Funkloch.");
        input.focus();
        return;
      }

      tries++;
      if (tries < MAX_TRIES) {
        // Eingabe stehen lassen: mit dem Augen-Knopf lässt sich der Tippfehler finden
        showError("Falsche Phrase. Tipp aufs Auge, um deine Eingabe zu prüfen.");
        input.focus();
        return;
      }
      input.value = "";
      // zu viele Fehlversuche: kurz sperren
      tries = 0;
      busy(true);
      button.textContent = "Eintreten";
      let left = COOLDOWN_MS / 1000;
      showError(`Zu viele Versuche. Neuer Versuch in ${left} s.`);
      const timer = setInterval(() => {
        left--;
        error.textContent = `Zu viele Versuche. Neuer Versuch in ${left} s.`;
        if (left > 0) return;
        clearInterval(timer);
        busy(false);
        error.hidden = true;
        input.focus();
      }, 1000);
    });
  });
})();
