"use strict";

/* ROCKHARZ 2027 — Band-Dashboard: Festivalplanung, Bandfotos, 30-Sekunden-Hörproben. */

const STORAGE = {
  ratings: "rockharz2027_favorites_v1",
  legacyHearts: "rockharz2027_heart_favorites_v1",
  volume: "rockharz2027_volume"
};
const PREVIEW_SECONDS = 30;
/* Härtefälle (Nischen-Bands, falsche Treffer): Schlüssel = "<band-id>|<Songtitel>" (id wie in bands.js, z. B. "skald").
   Wert 1: direkte https-Audio-URL (MP3/M4A)   -> wird ohne Suche verwendet
   Wert 2: { term: "alternativer Suchbegriff", artist: "alternative Schreibweise des Bandnamens" } -> Stufe 5
   Beispiele:
     "skald|Rún": { term: "Skáld Rún", artist: "Skáld" },
     "turbobier|Arbeitslos": "https://example.com/preview.m4a"
*/
const AUDIO_OVERRIDES = {};

const WAVE_HEIGHTS = [20, 45, 65, 35, 85, 55, 100, 60, 75, 30, 65, 40, 85, 50, 25, 55, 90, 40, 70, 30, 60, 95, 45, 25];

const $ = id => document.getElementById(id);

const escapeHTML = value => String(value).replace(/[&<>"']/g, ch => (
  { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]
));

const readStore = (key, fallback) => {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch { return fallback; }
};
const writeStore = (key, value) => {
  try { localStorage.setItem(key, JSON.stringify(value)); }
  catch (error) { console.warn("Speichern fehlgeschlagen", error); }
};

/* ---------------------------------------------------------
   STATE
   --------------------------------------------------------- */
let ratings = readStore(STORAGE.ratings, {});
if (!ratings || typeof ratings !== "object" || Array.isArray(ratings)) ratings = {};

// Frühere Herz-Favoriten (Herzen gibt es nicht mehr) werden einmalig zu "★ FAVORIT".
(() => {
  const legacy = readStore(STORAGE.legacyHearts, []);
  if (Array.isArray(legacy) && legacy.length) {
    legacy.forEach(id => { if (!ratings[id]) ratings[id] = "must"; });
    writeStore(STORAGE.ratings, ratings);
  }
  try { localStorage.removeItem(STORAGE.legacyHearts); } catch {}
})();

// Alte Band-IDs vor dem ø-Fix im Slug ("sety-ursails") auf die neuen IDs übertragen.
(() => {
  const RENAMED = { "sety-ursails": "setyoursails" };
  let changed = false;
  Object.entries(RENAMED).forEach(([oldId, newId]) => {
    if (!(oldId in ratings)) return;
    if (!ratings[newId]) ratings[newId] = ratings[oldId];
    delete ratings[oldId];
    changed = true;
  });
  if (changed) writeStore(STORAGE.ratings, ratings);
})();

const DEFAULT_VOLUME = 0.52;
let masterVolume = Number(readStore(STORAGE.volume, DEFAULT_VOLUME));
if (!Number.isFinite(masterVolume)) masterVolume = DEFAULT_VOLUME;
masterVolume = Math.min(1, Math.max(0, masterVolume));

let activeBand = null;
let currentSongIndex = -1;
let playRequestId = 0;

const photoCache = new Map();      // bandId -> url | null
const photoRequests = new Map();   // bandId -> Promise
const previewCache = new Map();    // "bandId|song" -> { exp, list: Kandidaten[] }
const previewRequests = new Map();

const status = id => {
  const value = ratings[id];
  return value === "must" || value === "maybe" || value === "skip" ? value : "new";
};
const isFavoriteish = id => status(id) === "must" || status(id) === "maybe";

/* ---------------------------------------------------------
   TEXT-NORMALISIERUNG
   --------------------------------------------------------- */
const cleanStr = value =>
  String(value || "")
    .toLowerCase()
    .replace(/ß/g, "ss")
    .replace(/[åäæ]/g, "a")
    .replace(/[øö]/g, "o")
    .replace(/ü/g, "u")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/['’´`]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/* ---------------------------------------------------------
   BANDFOTOS: Deezer-Artist-API -> Wikipedia-Infobox -> Hirsch-Fallback
   --------------------------------------------------------- */
const WIKI_TITLES = {
  "Accept": "Accept_(band)", "All for Metal": "All_for_Metal", "Arch Enemy": "Arch_Enemy",
  "Bruce Dickinson": "Bruce_Dickinson",
  "D'Artagnan": "DArtagnan_(band)", "Dust Bolt": "Dust_Bolt", "Eisbrecher": "Eisbrecher_(band)",
  "Equilibrium": "Equilibrium_(band)", "Grave Digger": "Grave_Digger_(band)", "GWAR": "Gwar",
  "Marduk": "Marduk_(band)", "Nestor": "Nestor_(band)", "SKÁLD": "Skáld",
  "Tankard": "Tankard_(band)", "The Sisters of Mercy": "The_Sisters_of_Mercy"
};

// Apostroph-Namen: Katalog- und Wikipedia-Suchen scheitern an "D'Artagnan" / "d’Artagnan".
const searchName = band => cleanStr(band.name) === "dartagnan" ? "DArtagnan" : band.name.replace(/['’´`]/g, "");

// Bands, bei denen Deezer erwiesenermaßen Logos/Artwork liefert: nur Wikipedia verwenden.
const WIKI_ONLY = {
  dartagnan: [["DArtagnan_(Band)", "de"], ["D’Artagnan_(Band)", "de"], ["D'Artagnan_(Band)", "de"], ["DArtagnan_(band)", "en"]],
  accept: [["Accept_(band)", "en"], ["Accept", "de"]],
  "dust bolt": [["Dust_Bolt", "en"], ["Dust_Bolt", "de"]]
};

// Logos, Albumcover und Deezers leere Platzhalter-Bilder sind keine Promofotos.
const NON_PHOTO = /(logo|wordmark|album|cover|artwork|\.svg)/i;
function isPromoPhotoUrl(url) {
  if (typeof url !== "string" || !/^https:\/\//i.test(url)) return false;
  if (/\/images\/artist\/\//.test(url)) return false; // Deezer-Platzhalter ohne Bild-Hash
  let file = url.split("?")[0].split("/").pop() || "";
  try { file = decodeURIComponent(file); } catch {}
  return !NON_PHOTO.test(file);
}

/* ---- Offline-Cache (localStorage): Wikipedia-Antworten und Bandfotos, 14 Tage frisch ----
   Ist ein Eintrag älter, wird neu geladen; scheitert das (Funkloch), gilt weiter der alte Stand. */
const OFFLINE = {
  wiki: "rockharz2027_wiki_cache_v1",     // Anfrage-URL -> { at, json }
  photos: "rockharz2027_photo_cache_v1",  // bandId -> { at, url, data }  (data = verkleinerte JPEG-Kopie)
  ttl: 14 * 24 * 60 * 60 * 1000,
  keep: 90 * 24 * 60 * 60 * 1000,         // danach endgültig verwerfen
  photoSize: 560
};
const isFresh = entry => Boolean(entry) && Date.now() - entry.at < OFFLINE.ttl;
const pruneOld = store => Object.fromEntries(Object.entries(store || {}).filter(([, e]) => e && Date.now() - e.at < OFFLINE.keep));
let wikiStore = pruneOld(readStore(OFFLINE.wiki, {}));
let photoStore = pruneOld(readStore(OFFLINE.photos, {}));

// Bei vollem Speicher die ältesten Bildkopien opfern, die URLs bleiben erhalten.
function saveOffline(key, store) {
  for (;;) {
    try { localStorage.setItem(key, JSON.stringify(store)); return; }
    catch {
      const oldest = Object.values(photoStore).filter(e => e.data).sort((a, b) => a.at - b.at)[0];
      if (!oldest) return;
      oldest.data = null;
      if (store !== photoStore) { try { localStorage.setItem(OFFLINE.photos, JSON.stringify(photoStore)); } catch {} }
    }
  }
}

// Nur die Felder behalten, die die App nutzt (Bild + Text), damit der Speicher reicht.
const slimWiki = json => json?.query
  ? { query: { pages: Object.fromEntries(Object.entries(json.query.pages || {}).map(([k, p]) => [k, { title: p.title, index: p.index, original: p.original }])) } }
  : { type: json?.type, title: json?.title, description: json?.description, extract: json?.extract, thumbnail: json?.thumbnail, originalimage: json?.originalimage };

async function wikiJSON(url) {
  const hit = wikiStore[url];
  if (isFresh(hit)) return hit.json;
  try {
    const res = await fetch(url, { referrerPolicy: "no-referrer", signal: AbortSignal.timeout(5000) });
    if (!res.ok) {
      if (res.status !== 404) return hit?.json ?? null; // Drosselung o. Ä.: alten Stand nutzen
      wikiStore[url] = { at: Date.now(), json: null };
    } else {
      wikiStore[url] = { at: Date.now(), json: slimWiki(await res.json()) };
    }
    saveOffline(OFFLINE.wiki, wikiStore);
    return wikiStore[url].json;
  } catch {
    return hit?.json ?? null; // offline
  }
}

// Wikimedia-Original -> 500-px-Vorschau (Standardgröße), spart Datenvolumen beim Speichern
const wikimediaThumb = url => {
  const m = /^(https:\/\/upload\.wikimedia\.org\/wikipedia\/[^/]+)\/(\w\/\w\w)\/([^/?]+)$/.exec(url.split("?")[0]);
  return m ? `${m[1]}/thumb/${m[2]}/${m[3]}/500px-${m[3]}` : null;
};

function photoToData(url) {
  return new Promise(resolve => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.referrerPolicy = "no-referrer";
    const timer = setTimeout(() => resolve(null), 10000);
    image.onload = () => {
      clearTimeout(timer);
      try {
        const scale = Math.min(1, OFFLINE.photoSize / Math.max(image.naturalWidth, image.naturalHeight));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(image.naturalWidth * scale);
        canvas.height = Math.round(image.naturalHeight * scale);
        canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.72));
      } catch { resolve(null); } // ohne CORS-Freigabe bleibt nur die URL im Cache
    };
    image.onerror = () => { clearTimeout(timer); resolve(null); };
    image.src = url;
  });
}

async function storePhoto(bandId, url) {
  const thumb = wikimediaThumb(url);
  const data = (thumb && await photoToData(thumb)) || await photoToData(url);
  photoStore[bandId] = { at: Date.now(), url, data };
  saveOffline(OFFLINE.photos, photoStore);
}

async function fetchWikiImage(title, lang = "en") {
  const data = await wikiJSON(`https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`);
  const url = data?.originalimage?.source || data?.thumbnail?.source || null;
  return isPromoPhotoUrl(url) ? url : null;
}

// Volltextsuche als Sicherheitsnetz, falls der exakte Artikeltitel nicht passt.
async function fetchWikiSearchImage(band, lang) {
  try {
    const params = new URLSearchParams({
      action: "query", format: "json", origin: "*", generator: "search",
      gsrsearch: searchName(band) + " Band", gsrlimit: "5", prop: "pageimages", piprop: "original"
    });
    const data = await wikiJSON(`https://${lang}.wikipedia.org/w/api.php?` + params);
    if (!data) return null;
    const wanted = cleanStr(searchName(band));
    const pages = Object.values(data.query?.pages || {}).sort((a, b) => a.index - b.index);
    for (const page of pages) {
      const url = page.original?.source;
      if (cleanStr(page.title).includes(wanted) && isPromoPhotoUrl(url)) return url;
    }
  } catch {}
  return null;
}

async function fetchDeezerArtistPhoto(band) {
  const data = await catalogueJSONP("https://api.deezer.com/search/artist", {
    q: band.name, output: "jsonp", limit: 5
  });
  const wanted = cleanStr(band.name);
  // Nie einen fremden Künstler anzeigen, nur weil die Suche etwas liefert.
  const artist = (data?.data || []).find(item => cleanStr(item.name) === wanted);
  if (!artist) return null;
  return [artist.picture_xl, artist.picture_big].find(isPromoPhotoUrl) || null;
}

function loadablePhoto(url) {
  if (!url) return Promise.resolve(null);
  return new Promise(resolve => {
    const image = new Image();
    let done = false;
    const finish = result => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      image.onload = image.onerror = null;
      resolve(result);
    };
    const timer = setTimeout(() => finish(null), 8000);
    image.referrerPolicy = "no-referrer";
    image.onload = () => finish(image.naturalWidth > 0 ? url : null);
    image.onerror = () => finish(null);
    image.src = url;
  });
}

async function resolveBandPhoto(band) {
  const wikiOnly = WIKI_ONLY[cleanStr(band.name)];
  if (wikiOnly) {
    for (const [title, lang] of wikiOnly) {
      const photo = await loadablePhoto(await fetchWikiImage(title, lang));
      if (photo) return photo;
    }
    for (const lang of ["de", "en"]) {
      const photo = await loadablePhoto(await fetchWikiSearchImage(band, lang));
      if (photo) return photo;
    }
    return null;
  }
  let photo = await loadablePhoto(await fetchDeezerArtistPhoto(band));
  if (photo) return photo;
  const title = WIKI_TITLES[band.name] || band.name.replace(/ /g, "_");
  photo = await loadablePhoto(await fetchWikiImage(title, "en"));
  if (photo) return photo;
  return loadablePhoto(await fetchWikiImage(band.name.replace(/ /g, "_"), "de"));
}

// Online: Original-URL (beste Qualität). Offline: gespeicherte Kopie aus dem localStorage.
const offlineSrc = entry => entry ? (navigator.onLine ? entry.url : entry.data || entry.url) : null;

function getBandPhoto(band) {
  if (photoCache.has(band.id)) return Promise.resolve(photoCache.get(band.id));
  const saved = photoStore[band.id];
  if (isFresh(saved) && (saved.data || navigator.onLine)) {
    const src = offlineSrc(saved);
    photoCache.set(band.id, src);
    return Promise.resolve(src);
  }
  if (photoRequests.has(band.id)) return photoRequests.get(band.id);
  const pending = resolveBandPhoto(band)
    .catch(() => null)
    .then(photo => {
      if (photo) storePhoto(band.id, photo); // im Hintergrund für offline sichern
      const src = photo || (saved ? saved.data || saved.url : null); // Funkloch: alter Stand statt leerer Kachel
      photoCache.set(band.id, src);
      photoRequests.delete(band.id);
      return src;
    });
  photoRequests.set(band.id, pending);
  return pending;
}

function applyPhoto(img, fallback, src) {
  if (!img || !fallback) return;
  if (src) {
    img.src = src;
    img.classList.remove("hidden");
    fallback.classList.add("hidden");
  } else {
    img.classList.add("hidden");
    fallback.classList.remove("hidden");
  }
}

function loadCardPhotos() {
  document.querySelectorAll(".page:not(.hidden) img[data-img-band-id]").forEach(img => {
    if (img.getAttribute("src")) return;
    const band = BANDS.find(item => item.id === img.dataset.imgBandId);
    if (!band) return;
    getBandPhoto(band).then(src => applyPhoto(img, img.parentElement.querySelector(".stag-relief-fallback"), src));
  });
}

// Ein später fehlschlagendes Bild fällt sauber auf das Hirsch-Relief zurück.
document.addEventListener("error", event => {
  const img = event.target;
  if (!(img instanceof HTMLImageElement) || !img.getAttribute("src")) return;
  const id = img.dataset.imgBandId || (img.id === "detail-img" ? activeBand?.id : null);
  if (!id) return;
  // Original nicht erreichbar (z. B. Funkloch trotz "online"): auf die gespeicherte Kopie wechseln
  const copy = photoStore[id]?.data;
  if (copy && img.getAttribute("src") !== copy) {
    photoCache.set(id, copy);
    document.querySelectorAll(`img[data-img-band-id="${id}"]`).forEach(el => { el.src = copy; });
    if (activeBand?.id === id) $("detail-img").src = copy;
    return;
  }
  photoCache.set(id, null);
  img.removeAttribute("src");
  applyPhoto(img, img.parentElement.querySelector(".stag-relief-fallback"), null);
}, true);

/* ---------------------------------------------------------
   AUDIO-ENGINE
   ---------------------------------------------------------
   ANALYSE – warum Hörproben im Browser scheitern (und was dagegen getan wird)

   1. Rate-Limits: Die iTunes-Search-API erlaubt nur ca. 20 Anfragen/Minute pro IP, Deezer ca. 50 pro 5 s.
      Die alte Kaskade feuerte pro Song bis zu 6 Anfragen und prüfte beim Öffnen einer Band alle Songs
      vorab. Folge: HTTP 403 -> bei JSONP nur ein stummes "script error" -> Song galt als "nicht verfügbar".
      -> Pro Anbieter serialisierte Warteschlange mit Mindestabstand, Cooldown nach Fehlern,
         Deezer zuerst (großzügiges Limit, MP3 läuft in jedem Browser), iTunes nur als Reserve.
   2. Ablaufende Links: Deezer-Preview-URLs enthalten ein Token (hdnea=exp=<unix>), das nach kurzer Zeit
      verfällt. Der alte Cache hielt sie 30 min (auch im localStorage) -> "Ladefehler" beim Abspielen.
      -> Ablaufzeit wird aus der URL gelesen; Kandidaten mit < 90 s Restlaufzeit werden verworfen.
   3. Autoplay-Policy: Safari/iOS erlaubt play() nur direkt in der Klick-Geste. Die alte Engine rief play()
      erst nach mehreren Netzwerk-Awaits auf -> NotAllowedError, "stumm".
      -> Das <audio>-Element wird im Klick synchron per Stummschnitt "entsperrt".
   4. Nur ein Kandidat: Schlug der eine Link fehl (404/403/Format), blieb die Zeile im Fehlerzustand.
      -> Es werden bis zu 5 bewertete Kandidaten gesammelt; beim Abspielen wird der Reihe nach probiert
         (canplay/playing-Event mit Timeout, MediaError-Code wird protokolliert). Danach 2. Runde mit
         frischer Suche bei den anderen Anbietern.
   5. Format: Apple liefert AAC in MP4 (.m4a), Deezer MP3. Beides spielt in allen gängigen Browsern, aber
      nicht in jeder Linux-Firefox-/Chromium-Build -> canPlayType-Prüfung vor dem Versuch.
   6. CORS: <audio> ohne crossorigin-Attribut braucht keine CORS-Header – das Attribut darf NICHT gesetzt werden.
      Das Referrer-Verhalten wird vorsorglich auf "no-referrer" gestellt (Skripte, Bilder, Audio).
   7. Sonderzeichen / Negativ-Cache: Namen wie D'Artagnan, SKÁLD, Håndgemeng werden in mehreren
      Schreibweisen gesucht. "Nicht vorhanden" wird nur gespeichert, wenn Deezer UND iTunes geantwortet haben
      (1 h), nie nach einem Netzwerkfehler.

   DEBUGGING (F12 -> Konsole): jede Suche wird als aufklappbare Gruppe protokolliert (welche Anfrage,
   welche Treffer, warum verworfen). RH_AUDIO.diagnose() prüft Browser, APIs und echte Audio-Ladbarkeit.
   RH_AUDIO.debug(false) schaltet das Logging ab.
   --------------------------------------------------------- */
const AUDIO_CFG = {
  jsonpTimeout: 7000,                       // ms pro API-Anfrage
  playTimeout: 9000,                        // ms bis "playing" nach src-Zuweisung
  gap: { Deezer: 150, Apple: 2600 },        // Mindestabstand zwischen Anfragen je Anbieter
  cooldown: { Deezer: 4000, Apple: 20000 }, // Pause nach Fehler/Rate-Limit
  maxCandidates: 5,
  acceptScore: 2.5,                         // ab hier gilt ein Treffer als sauberer Studio-Treffer
  ttlFound: 6 * 60 * 60 * 1000,
  ttlMiss: 60 * 60 * 1000,
  minRemainingMs: 90 * 1000                 // Links mit kürzerer Restlaufzeit werden nicht mehr genutzt
};
const AUDIO_STORE = "rockharz2027_previews_v3";
try { ["rockharz2027_previews_v1", "rockharz2027_previews_v2"].forEach(key => localStorage.removeItem(key)); } catch {}

// Referrer-Policy vorsorglich auf "no-referrer" (betrifft auch <audio>-Anfragen).
if (!document.querySelector('meta[name="referrer"]')) {
  const meta = document.createElement("meta");
  meta.name = "referrer";
  meta.content = "no-referrer";
  document.head.appendChild(meta);
}

/* ---- Logging ---- */
const audioDebug = { enabled: readStore("rockharz2027_audio_debug", true) !== false };

function audioLog(level, band, song, message) {
  if (!audioDebug.enabled) return;
  (console[level] || console.log).call(console, `%c[RH-Audio]%c ${band.name} – ${song.title}: ${message}`,
    "color:#e66722;font-weight:bold", "color:inherit");
}

function makeTrace(band, song) {
  const lines = [];
  const started = performance.now();
  return {
    add(stage, message) { lines.push({ "+ms": Math.round(performance.now() - started), Stufe: stage, Meldung: message }); },
    flush(outcome, ok) {
      if (!audioDebug.enabled) return;
      console.groupCollapsed(`%c[RH-Audio] ${band.name} – ${song.title}: ${outcome}`,
        ok ? "color:#2ed573;font-weight:bold" : "color:#e66722;font-weight:bold");
      console.table(lines);
      console.groupEnd();
    }
  };
}

/* ---- Normalisierung / Fuzzy-Matching ---- */
const NON_STUDIO = /\b(live|remix|karaoke|instrumental|acoustic|demo|tribute|cover|made famous|originally performed)\b/i;
const stripThe = value => value.replace(/^the /, "");
const compact = value => value.replace(/ /g, "");

// "Metal Heart (Remastered 2015) [Live] - 2011 Remaster feat. X" -> "metal heart"
function normalizeForSearch(value) {
  let s = String(value || "").toLowerCase();
  s = s.replace(/\([^)]*\)|\[[^\]]*\]|\{[^}]*\}/g, " ");
  s = s.replace(/\s[-–—]\s+.*\b(?:remaster\w*|live|edit|version|mono|stereo|mix|bonus|demo|single|deluxe|anniversary|re-?record\w*|\d{4})\b.*$/, " ");
  s = s.replace(/\s(?:feat\.?|ft\.?|featuring)\s.*$/, " ");
  s = s.replace(/&/g, " and ");
  s = s.replace(/ß/g, "ss").replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue")
       .replace(/æ/g, "ae").replace(/œ/g, "oe").replace(/ø/g, "o").replace(/ð/g, "d").replace(/ł/g, "l").replace(/đ/g, "d");
  s = s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  s = s.replace(/['’‘`´.]/g, "");
  s = s.replace(/[^a-z0-9]+/g, " ");
  return s.replace(/\s+/g, " ").trim();
}

function levenshtein(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    for (let j = 1; j <= b.length; j++) {
      row[j] = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = row;
  }
  return prev[b.length];
}
const similarity = (a, b) => (!a || !b) ? 0 : 1 - levenshtein(a, b) / Math.max(a.length, b.length);

function bandSimilarity(candidate, wanted) {
  const a = stripThe(normalizeForSearch(candidate));
  const b = stripThe(normalizeForSearch(wanted));
  if (!a || !b) return 0;
  if (a === b || compact(a) === compact(b)) return 1;
  const wordsA = a.split(" ");
  if (b.split(" ").every(word => wordsA.includes(word))) return 0.9;
  return Math.max(similarity(a, b), similarity(compact(a), compact(b)));
}

function titleMatchScore(candidate, wanted) {
  const c = normalizeForSearch(candidate);
  const w = normalizeForSearch(wanted);
  if (!c || !w) return 0;
  if (c === w || compact(c) === compact(w)) return 3;
  const includes = (text, part) => (" " + text + " ").includes(" " + part + " ");
  if (includes(c, w) || (c.length >= 4 && includes(w, c))) return 2;
  if (w.length >= 6 && similarity(c, w) >= 0.85) return 1.5;
  return 0;
}

const previewKey = (band, song) => band.id + "|" + song.title;
const songTerm = song => song.title.replace(/\([^)]*\)|\[[^\]]*\]/g, " ").replace(/\s+/g, " ").trim() || song.title;
const toHttps = url => String(url || "").replace(/^http:\/\//i, "https://");

function nameVariants(band) {
  return uniq([band.name, foldText(band.name, false), foldText(band.name, true), searchName(band)]);
}

/* ---- Browser-Fähigkeiten & Format ---- */
const probeAudio = document.createElement("audio");
const CAN_PLAY = {
  mp3: probeAudio.canPlayType ? probeAudio.canPlayType("audio/mpeg") !== "" : true,
  m4a: probeAudio.canPlayType
    ? (probeAudio.canPlayType('audio/mp4; codecs="mp4a.40.2"') !== "" || probeAudio.canPlayType("audio/aac") !== "")
    : true
};
function formatOf(url) {
  const path = String(url).split("?")[0].toLowerCase();
  if (/\.(m4a|mp4|aac)$/.test(path)) return "m4a";
  if (/\.mp3$/.test(path)) return "mp3";
  return "unknown";
}
// Deezer-Links tragen ihr Ablaufdatum in der URL (hdnea=exp=<unix-sekunden>~…)
function urlExpiry(url) {
  const match = /exp=(\d{9,})/.exec(url || "");
  return match ? Number(match[1]) * 1000 : 0;
}

/* ---- Bewertung eines API-Treffers (mit Begründung für das Log) ---- */
function evaluate(track, ctx) {
  const { band, song, alias } = ctx;
  const url = toHttps(track.previewUrl);
  if (!url) return { ok: false, why: "kein previewUrl im Treffer (Rechte/Region)" };
  if (!/^https:\/\//.test(url)) return { ok: false, why: "previewUrl ist kein URL" };
  if (ctx.avoidUrls?.has(url)) return { ok: false, why: "URL ist beim Abspielen bereits gescheitert" };
  const format = formatOf(url);
  if (format !== "unknown" && !CAN_PLAY[format]) return { ok: false, why: `Browser kann ${format === "m4a" ? "audio/mp4 (AAC)" : "audio/mpeg"} nicht abspielen` };
  const expiry = urlExpiry(url); // frisch geladene Links sind gültig; nur im Cache wird die Restlaufzeit geprüft

  const artistScore = Math.max(
    bandSimilarity(track.artistName, band.name),
    alias ? bandSimilarity(track.artistName, alias) : 0
  );
  if (artistScore < 0.7) return { ok: false, why: `Künstler "${track.artistName}" nur ${Math.round(artistScore * 100)} % ähnlich (< 70 %)` };

  const titleScore = titleMatchScore(track.trackName, song.title);
  if (!titleScore) return { ok: false, why: `Titel "${track.trackName}" passt nicht zu "${song.title}"` };

  let score = titleScore + (artistScore === 1 ? 0.3 : 0);
  let note = "";
  if (!NON_STUDIO.test(song.title) && [track.trackName, track.collectionName, track.artistName].some(t => NON_STUDIO.test(t || ""))) {
    score -= 1.5;
    note = ", Live/Remix/Tribute-Abzug";
  }
  score = Math.max(score, 0.1);
  return { ok: true, score, url, expiry, why: `Titel ${titleScore}, Künstler ${Math.round(artistScore * 100)} %${note}, ${format}${expiry ? ", Link gültig noch " + Math.max(0, Math.round((expiry - Date.now()) / 1000)) + " s" : ""}` };
}

function consider(ctx, tracks, label) {
  let shown = 0;
  let hidden = 0;
  for (const track of tracks) {
    const verdict = evaluate(track, ctx);
    const name = `${track.artistName} – ${track.trackName} [${track.provider}]`;
    if (verdict.ok) {
      ctx.trace.add(label, `✔ ${name} · Score ${verdict.score.toFixed(1)} (${verdict.why})`);
      const known = ctx.pool.get(verdict.url);
      if (!known || verdict.score > known.score) {
        ctx.pool.set(verdict.url, {
          provider: track.provider, id: track.id, artistName: track.artistName, trackName: track.trackName,
          previewUrl: verdict.url, exp: verdict.expiry || 0, score: verdict.score
        });
      }
    } else if (shown < 6) {
      shown++;
      ctx.trace.add(label, `✘ ${name}: ${verdict.why}`);
    } else {
      hidden++;
    }
  }
  if (hidden) ctx.trace.add(label, `… ${hidden} weitere Treffer verworfen`);
}

/* ---- Netzwerk: JSONP + serialisierte Warteschlange je Anbieter ---- */
let jsonpCounter = 0;
function jsonp(base, parameters, timeoutMs = AUDIO_CFG.jsonpTimeout) {
  return new Promise(resolve => {
    const name = "rh_catalogue_" + (++jsonpCounter);
    const script = document.createElement("script");
    let done = false;
    const finish = result => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      script.remove();
      window[name] = () => {};
      setTimeout(() => { delete window[name]; }, 30000);
      resolve(result);
    };
    const timer = setTimeout(() => finish({ ok: false, reason: `Timeout nach ${timeoutMs / 1000} s` }), timeoutMs);
    window[name] = data => finish({ ok: true, data });
    script.onerror = () => finish({ ok: false, reason: "Script nicht ladbar (offline, Adblocker/Tracking-Schutz oder HTTP-Fehler/Rate-Limit)" });
    script.referrerPolicy = "no-referrer";
    script.async = true;
    script.src = base + "?" + new URLSearchParams({ ...parameters, callback: name });
    document.head.appendChild(script);
  });
}
// Für Bildsuche & Co.: einfache Variante, liefert Daten oder null.
const catalogueJSONP = async (base, parameters) => {
  const result = await jsonp(base, parameters);
  return result.ok ? result.data : null;
};

const providerState = {
  Deezer: { chain: Promise.resolve(), last: 0, cooldownUntil: 0 },
  Apple: { chain: Promise.resolve(), last: 0, cooldownUntil: 0 }
};
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

function scheduled(provider, task) {
  const state = providerState[provider];
  const run = state.chain.then(async () => {
    const wait = state.last + AUDIO_CFG.gap[provider] - Date.now();
    if (wait > 0) await sleep(wait);
    state.last = Date.now();
    return task();
  });
  state.chain = run.catch(() => {});
  return run;
}

async function queryProvider(ctx, provider, label, base, params, extract) {
  const state = providerState[provider];
  const q = params.term || params.q || base.replace(/^https:\/\/[^/]+/, "");
  if (Date.now() < state.cooldownUntil) {
    ctx.trace.add(label, `übersprungen – ${provider} pausiert noch ${Math.ceil((state.cooldownUntil - Date.now()) / 1000)} s nach vorherigem Fehler`);
    return null;
  }
  const result = await scheduled(provider, async () => (ctx.cancelled() ? { cancelled: true } : jsonp(base, params)));
  if (result.cancelled) throw Object.assign(new Error("abgebrochen"), { cancelled: true });
  if (!result.ok) {
    state.cooldownUntil = Date.now() + AUDIO_CFG.cooldown[provider];
    ctx.trace.add(label, `FEHLER bei "${q}": ${result.reason}`);
    return null;
  }
  const tracks = extract(result.data);
  if (!tracks) {
    state.cooldownUntil = Date.now() + AUDIO_CFG.cooldown[provider];
    const detail = result.data?.error ? JSON.stringify(result.data.error) : "unerwartete Antwortstruktur";
    ctx.trace.add(label, `FEHLER bei "${q}": ${detail}`);
    return null;
  }
  ctx.reached.add(provider);
  ctx.trace.add(label, `${tracks.length} Treffer für "${q}"`);
  return tracks;
}

const deezerExtract = data => Array.isArray(data?.data) ? data.data.map(t => ({
  provider: "Deezer", id: t.id, artistName: t.artist?.name, trackName: t.title_short || t.title,
  collectionName: t.album?.title, previewUrl: t.preview
})) : null;
const appleExtract = data => Array.isArray(data?.results) ? data.results.map(t => ({
  provider: "Apple", id: t.trackId, artistName: t.artistName, trackName: t.trackName,
  collectionName: t.collectionName, previewUrl: t.previewUrl
})) : null;

const catalogCache = new Map(); // "DE|bandId|Suchbegriff" -> Treffer des Künstler-Katalogs
const quoteSafe = text => String(text).replace(/"/g, "");
const uniq = list => list.filter((value, index) => value && list.indexOf(value) === index);

/* ---- Umlaut-/Sonderzeichen-Fallback: å->a, ø->o, ä/ö/ü->a/o/u bzw. ae/oe/ue, é/è/á/à->e/a ---- */
function foldText(text, digraph = false) {
  let s = String(text || "");
  if (digraph) s = s.replace(/ä/g, "ae").replace(/Ä/g, "Ae").replace(/ö/g, "oe").replace(/Ö/g, "Oe").replace(/ü/g, "ue").replace(/Ü/g, "Ue");
  s = s.replace(/ß/g, "ss").replace(/æ/g, "ae").replace(/Æ/g, "Ae").replace(/œ/g, "oe").replace(/Œ/g, "Oe")
       .replace(/ø/g, "o").replace(/Ø/g, "O").replace(/å/g, "a").replace(/Å/g, "A").replace(/ł/g, "l").replace(/Ł/g, "L");
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, ""); // übrige Akzente (é è á à ó …) fallen weg
}

// Ersatz-Suchpaare (Bandname + Songtitel) ohne Sonderzeichen – nur wenn sie sich vom Original unterscheiden.
function buildFoldPairs(band, title) {
  const original = band.name + "\u0000" + title;
  const pairs = [];
  const add = (name, text) => {
    const key = name + "\u0000" + text;
    if (key !== original && !pairs.some(pair => pair.key === key)) pairs.push({ name, title: text, key });
  };
  add(foldText(band.name, false), foldText(title, false));
  add(foldText(band.name, true), foldText(title, true));
  add(foldText(searchName(band), false), foldText(title, false)); // D'Artagnan -> DArtagnan
  return pairs;
}

async function deezerSearch(ctx, label, q) {
  const tracks = await queryProvider(ctx, "Deezer", label, "https://api.deezer.com/search",
    { q, output: "jsonp", limit: 25 }, deezerExtract);
  if (tracks) consider(ctx, tracks, label);
  return tracks;
}
async function appleSearch(ctx, label, term, country, limit) {
  const tracks = await queryProvider(ctx, "Apple", label, "https://itunes.apple.com/search",
    { term, media: "music", entity: "song", limit, country }, appleExtract);
  if (tracks) consider(ctx, tracks, label);
  return tracks;
}

async function appleSong(ctx, label, country) {
  await appleSearch(ctx, label, `${ctx.band.name} ${ctx.title}`, country, 15);
  if (ctx.good() || !ctx.foldPairs.length || country !== "DE") return; // iTunes-Limit schonen: Fallback nur im DE-Store
  const pair = ctx.foldPairs[0];
  ctx.trace.add(label, `kein sauberer Treffer – zweiter Versuch ohne Sonderzeichen ("${pair.name} ${pair.title}")`);
  await appleSearch(ctx, label + " (ohne Sonderzeichen)", `${pair.name} ${pair.title}`, country, 15);
}

async function catalogTracks(ctx, country, term) {
  const cacheKey = country + "|" + ctx.band.id + "|" + term;
  if (catalogCache.has(cacheKey)) return catalogCache.get(cacheKey);
  const tracks = await queryProvider(ctx, "Apple", "Künstler-Katalog " + country, "https://itunes.apple.com/search",
    { term, media: "music", entity: "song", limit: 50, country }, appleExtract);
  if (tracks) catalogCache.set(cacheKey, tracks);
  return tracks;
}
const catalogTerms = ctx => uniq([ctx.foldPairs[0]?.name, ctx.band.name]); // ohne Sonderzeichen zuerst
const isArtistTrack = (track, ctx) => bandSimilarity(track.artistName, ctx.band.name) >= 0.7 ||
  (ctx.alias && bandSimilarity(track.artistName, ctx.alias) >= 0.7);

/* ---- Top-Track-Fallback: beliebtester verfügbarer Preview-Track des Künstlers ---- */
function considerFallback(ctx, tracks, label) {
  const usable = [];
  for (const track of tracks) {
    const url = toHttps(track.previewUrl);
    if (!/^https:\/\//.test(url) || ctx.avoidUrls?.has(url)) continue;
    const format = formatOf(url);
    if (format !== "unknown" && !CAN_PLAY[format]) continue;
    if (!isArtistTrack(track, ctx)) continue;
    if ([track.trackName, track.collectionName].some(text => NON_STUDIO.test(text || ""))) continue;
    const core = normalizeForSearch(track.trackName);
    if (!core || usable.some(item => normalizeForSearch(item.trackName) === core)) continue; // Album-/Single-Duplikate
    usable.push({ ...track, previewUrl: url });
  }
  ctx.trace.add(label, `${usable.length} nutzbare Top-Tracks: ${usable.slice(0, 6).map(t => `"${t.trackName}"`).join(", ") || "–"}`);
  if (!usable.length) return false;
  // Steht der gewünschte Song selbst in der Top-Liste, ist es ein echter Treffer (kein Ausweich-Track).
  const own = usable.find(track => titleMatchScore(track.trackName, ctx.song.title) >= 2);
  if (own) {
    ctx.trace.add(label, `✔ gewünschter Song "${own.trackName}" steht in der Top-Liste`);
    ctx.pool.set(own.previewUrl, {
      provider: own.provider, id: own.id, artistName: own.artistName, trackName: own.trackName,
      previewUrl: own.previewUrl, exp: urlExpiry(own.previewUrl), score: 2.5
    });
    return true;
  }
  // Jeder Song der Band bekommt einen anderen Ausweich-Track (Reihenfolge rotiert nach Songposition).
  const shift = Math.max(0, ctx.band.songs.indexOf(ctx.song)) % usable.length;
  const ordered = usable.slice(shift).concat(usable.slice(0, shift)).slice(0, 3);
  ordered.forEach((track, i) => ctx.pool.set(track.previewUrl, {
    provider: track.provider, id: track.id, artistName: track.artistName, trackName: track.trackName,
    previewUrl: track.previewUrl, exp: urlExpiry(track.previewUrl), score: 0.4 - i * 0.01, fallback: true
  }));
  return true;
}

async function deezerTopTracks(ctx) {
  for (const name of uniq([ctx.band.name, ctx.foldPairs[0]?.name, ctx.foldPairs[2]?.name]).slice(0, 2)) {
    const artists = await queryProvider(ctx, "Deezer", "Deezer Künstlersuche", "https://api.deezer.com/search/artist",
      { q: name, output: "jsonp", limit: 5 },
      data => Array.isArray(data?.data) ? data.data.map(a => ({ id: a.id, name: a.name })) : null);
    if (!artists) return null;
    const match = artists
      .map(artist => ({ artist, score: Math.max(bandSimilarity(artist.name, ctx.band.name), ctx.alias ? bandSimilarity(artist.name, ctx.alias) : 0) }))
      .filter(item => item.score >= 0.7)
      .sort((a, b) => b.score - a.score)[0];
    if (!match) { ctx.trace.add("Deezer Künstlersuche", `kein Künstler "${name}" gefunden`); continue; }
    ctx.trace.add("Deezer Künstlersuche", `Künstler "${match.artist.name}" (ID ${match.artist.id}, ${Math.round(match.score * 100)} %)`);
    return queryProvider(ctx, "Deezer", "Deezer Top-Tracks", `https://api.deezer.com/artist/${match.artist.id}/top`,
      { output: "jsonp", limit: 25 }, deezerExtract);
  }
  return null;
}

const STAGES = [
  { provider: "Deezer", run: async ctx => {
      await deezerSearch(ctx, "Deezer (streng)", `artist:"${quoteSafe(ctx.band.name)}" track:"${quoteSafe(ctx.title)}"`);
      if (ctx.good()) return;
      await deezerSearch(ctx, "Deezer (locker)", `${ctx.band.name} ${ctx.title}`);
      for (const pair of ctx.foldPairs.slice(0, 2)) {
        if (ctx.good()) return;
        ctx.trace.add("Deezer", `kein sauberer Treffer – Versuch ohne Sonderzeichen ("${pair.name}" / "${pair.title}")`);
        await deezerSearch(ctx, "Deezer (ohne Sonderzeichen, streng)", `artist:"${quoteSafe(pair.name)}" track:"${quoteSafe(pair.title)}"`);
        if (ctx.good()) return;
        await deezerSearch(ctx, "Deezer (ohne Sonderzeichen, locker)", `${pair.name} ${pair.title}`);
      }
  } },
  { provider: "Apple", run: ctx => appleSong(ctx, "iTunes DE", "DE") },
  { provider: "Apple", run: ctx => appleSong(ctx, "iTunes US", "US") },
  { provider: "Apple", run: async ctx => {
      for (const country of ["DE", "US"]) {
        for (const term of catalogTerms(ctx)) {
          const tracks = await catalogTracks(ctx, country, term);
          if (!tracks) continue;
          consider(ctx, tracks, "Künstler-Katalog " + country);
          if (ctx.good()) return;
          if (!tracks.length || tracks.some(track => isArtistTrack(track, ctx))) break; // Künstler gefunden bzw. Katalog leer: zweiter Suchbegriff unnötig
        }
      }
  } },
  { provider: "Any", run: async ctx => {
      const term = ctx.override?.term;
      if (!term) return;
      await deezerSearch(ctx, "Override Deezer", term);
      if (!ctx.good()) await appleSearch(ctx, "Override iTunes", term, "DE", 25);
  } },
  // Letzte Stufe: der gewünschte Song ist nicht freigeschaltet -> beliebtester Preview-Track des Künstlers
  { provider: "Any", run: async ctx => {
      if (ctx.pool.size) return;
      ctx.trace.add("Top-Track", "kein Treffer für den Song – suche beliebtesten Preview-Track des Künstlers (Ausweich-Hörprobe)");
      if (!ctx.avoidProviders?.has("Deezer")) {
        const tracks = await deezerTopTracks(ctx);
        if (tracks && considerFallback(ctx, tracks, "Deezer Top-Tracks")) return;
      }
      if (ctx.avoidProviders?.has("Apple")) return;
      for (const country of ["DE", "US"]) {
        for (const term of catalogTerms(ctx)) {
          const tracks = await catalogTracks(ctx, country, term);
          if (!tracks) continue;
          if (considerFallback(ctx, tracks, "iTunes Künstler-Katalog " + country)) return;
          if (!tracks.length) break;
        }
      }
  } }
];

/* ---- Overrides ---- */
function overrideFor(band, song) {
  const entry = AUDIO_OVERRIDES[previewKey(band, song)];
  if (!entry) return null;
  return typeof entry === "string" ? { url: entry } : entry;
}

/* ---- Cache (Speicher + localStorage mit Ablauf) ---- */
function persistPreviews() {
  const out = {};
  const now = Date.now();
  previewCache.forEach((entry, key) => { if (entry.exp > now) out[key] = entry; });
  writeStore(AUDIO_STORE, out);
}
function cacheCandidates(key, list) {
  previewCache.set(key, { exp: Date.now() + (list.length ? AUDIO_CFG.ttlFound : AUDIO_CFG.ttlMiss), list });
  persistPreviews();
}
function forgetPreview(key) {
  previewCache.delete(key);
  persistPreviews();
}
// null = nichts Brauchbares im Cache, [] = bestätigt "nicht vorhanden", sonst frische Kandidaten
function cachedCandidates(key) {
  const entry = previewCache.get(key);
  if (!entry || entry.exp <= Date.now()) return null;
  if (!entry.list.length) return [];
  const fresh = entry.list.filter(c => !c.exp || c.exp - Date.now() > AUDIO_CFG.minRemainingMs);
  return fresh.length ? fresh : null;
}
(() => {
  const saved = readStore(AUDIO_STORE, {});
  const now = Date.now();
  if (!saved || typeof saved !== "object") return;
  Object.entries(saved).forEach(([key, entry]) => {
    const valid = entry && entry.exp > now && Array.isArray(entry.list) &&
      entry.list.every(c => /^https:\/\//.test(c?.previewUrl || ""));
    if (valid) previewCache.set(key, entry);
  });
})();

/* ---- Kandidaten suchen ---- */
async function findCandidates(band, song, opts = {}) {
  const key = previewKey(band, song);
  const override = overrideFor(band, song);
  if (override?.url && /^https:\/\//.test(override.url)) {
    return [{ provider: "Override", artistName: band.name, trackName: song.title, previewUrl: override.url, exp: 0, score: 99 }];
  }

  const useCache = !opts.fresh && !opts.avoidUrls;
  if (useCache) {
    const hit = cachedCandidates(key);
    if (hit !== null) return hit;
  }
  const shared = useCache && !opts.onlyProviders;
  if (shared && previewRequests.has(key)) return previewRequests.get(key);

  const request = searchCandidates(band, song, key, override, opts);
  if (shared) previewRequests.set(key, request);
  try { return await request; }
  finally { if (shared) previewRequests.delete(key); }
}

async function searchCandidates(band, song, key, override, opts) {
  const trace = makeTrace(band, song);
  const ctx = {
    band, song, override, trace,
    alias: override?.artist,
    title: songTerm(song),
    variants: nameVariants(band),
    foldPairs: buildFoldPairs(band, songTerm(song)),
    avoidProviders: opts.avoidProviders,
    pool: new Map(),
    reached: new Set(),
    avoidUrls: opts.avoidUrls,
    cancelled: opts.isCancelled || (() => false),
    good: () => [...ctx.pool.values()].some(c => c.score >= AUDIO_CFG.acceptScore)
  };
  trace.add("Start", `Suche "${band.name}" – "${song.title}" (Kern: "${normalizeForSearch(song.title)}", Varianten: ${ctx.variants.join(" | ")}, ` +
    `Browser: mp3 ${CAN_PLAY.mp3 ? "ja" : "NEIN"}, m4a ${CAN_PLAY.m4a ? "ja" : "NEIN"})`);

  for (const stage of STAGES) {
    if (opts.onlyProviders && !opts.onlyProviders.includes(stage.provider)) continue;
    if (opts.avoidProviders?.has(stage.provider)) { trace.add(stage.provider, "übersprungen (hat beim Abspielen versagt)"); continue; }
    try { await stage.run(ctx); }
    catch (error) {
      if (error.cancelled) { trace.add("Abbruch", "Anfrage nicht mehr benötigt"); throw error; }
      trace.add("Fehler", String(error?.message || error));
    }
    if (ctx.good()) break;
  }

  const list = [...ctx.pool.values()].sort((a, b) => b.score - a.score).slice(0, AUDIO_CFG.maxCandidates);
  if (list.length) {
    cacheCandidates(key, list);
    trace.flush(list[0].fallback
      ? `Ausweich-Hörprobe: ${list[0].provider} "${list[0].trackName}" (Top-Track, Song selbst nicht freigeschaltet)`
      : `${list.length} Kandidat(en), bester: ${list[0].provider} "${list[0].trackName}" (Score ${list[0].score.toFixed(1)})`, true);
    return list;
  }
  if (opts.onlyProviders || opts.avoidUrls) {
    trace.flush("kein (weiterer) Kandidat", false);
    return [];
  }
  // Nur wenn BEIDE Anbieter geantwortet haben, gilt der Song als wirklich nicht vorhanden.
  if (ctx.reached.size >= 2) {
    cacheCandidates(key, []);
    trace.flush("nicht im Katalog vorhanden (Deezer + iTunes befragt)", false);
    return [];
  }
  trace.flush(`Katalog nicht (vollständig) erreichbar – erreicht: ${[...ctx.reached].join(", ") || "keiner"}`, false);
  throw new Error("Katalog vorübergehend nicht erreichbar");
}

// Wärmt die Deezer-Treffer der Songs im Hintergrund vor (billig, keine iTunes-Anfragen).
async function prefetchPreviews(band) {
  for (const song of band.songs) {
    if (activeBand !== band) return;
    try { await findCandidates(band, song, { onlyProviders: ["Deezer"], isCancelled: () => activeBand !== band }); }
    catch (error) { if (error.cancelled) return; }
  }
}

/* ---- <audio>: Entsperren, Abspielen mit Nachweis, Fehlerbeschreibung ---- */
const SILENT_WAV = "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA";
let unlockPromise = null;
let audioUnlocked = false;

// Muss synchron im Klick laufen: Safari/iOS erlaubt späteres play() nur nach einer Geste.
function unlockAudio() {
  if (audioUnlocked || unlockPromise) return;
  const audio = $("preview-audio");
  try {
    audio.muted = true;
    audio.src = SILENT_WAV;
    const attempt = audio.play();
    unlockPromise = Promise.resolve(attempt).then(() => true, () => false).then(ok => {
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
      audio.muted = false;
      audioUnlocked = ok;
      unlockPromise = null;
      if (audioDebug.enabled) console.info(`%c[RH-Audio]%c Audio-Element ${ok ? "entsperrt" : "konnte nicht entsperrt werden (unkritisch auf Desktop)"}`, "color:#e66722;font-weight:bold", "color:inherit");
    });
  } catch { unlockPromise = null; }
}

function describeMediaError(error) {
  if (!error) return "unbekannter Medienfehler";
  const names = {
    1: "MEDIA_ERR_ABORTED (abgebrochen)",
    2: "MEDIA_ERR_NETWORK (Netzwerk/CORS/HTTP-Fehler oder abgelaufener Link)",
    3: "MEDIA_ERR_DECODE (Datei nicht dekodierbar)",
    4: "MEDIA_ERR_SRC_NOT_SUPPORTED (Format nicht unterstützt oder Server antwortet mit 403/404)"
  };
  return `${names[error.code] || "Medienfehler " + error.code}${error.message ? " – " + error.message : ""}`;
}

// Löst erst auf, wenn das "playing"-Event wirklich gefeuert hat – sonst Fehler mit Begründung.
function attemptPlayback(audio, candidate, request) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = error => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      audio.onplaying = audio.onerror = null;
      error ? reject(error) : resolve();
    };
    const timer = setTimeout(() => finish(Object.assign(
      new Error(`Timeout nach ${AUDIO_CFG.playTimeout / 1000} s ohne "playing" (readyState ${audio.readyState}, networkState ${audio.networkState})`),
      { kind: "timeout" })), AUDIO_CFG.playTimeout);
    audio.onplaying = () => finish();
    audio.onerror = () => finish(Object.assign(new Error(describeMediaError(audio.error)), { kind: "media" }));
    audio.muted = false;
    audio.volume = masterVolume;
    audio.src = candidate.previewUrl;
    const promise = audio.play();
    if (promise && promise.catch) {
      promise.catch(error => {
        if (request !== playRequestId) return finish(Object.assign(new Error("abgebrochen"), { kind: "stale" }));
        finish(Object.assign(new Error(`play() abgelehnt: ${error.name} – ${error.message}`),
          { kind: error.name === "NotAllowedError" ? "gesture" : "play" }));
      });
    }
  });
}

/* ---------------------------------------------------------
   TRACKLIST-ZEILEN (feste Höhe, nur Zustandswechsel)
   --------------------------------------------------------- */
const songRow = index => document.querySelector('.drawer-song-row[data-song-idx="' + index + '"]');

function setRowState(row, state, message = "") {
  if (!row) return;
  const button = row.querySelector(".song-play-btn");
  const duration = row.querySelector(".song-duration");
  const title = row.dataset.title;

  row.dataset.state = state;
  row.classList.toggle("playing", state === "playing");
  row.classList.toggle("loading", state === "loading");

  button.setAttribute("aria-pressed", String(state === "playing"));
  button.setAttribute("aria-label", title + (state === "playing" ? " pausieren" : " abspielen"));
  button.title = message || (state === "playing" ? "Hörprobe pausieren" : "Hörprobe abspielen");
  row.querySelector(".song-state-text").textContent = message;

  if (state === "idle") duration.textContent = "0:" + String(PREVIEW_SECONDS);
  if (state === "error") { duration.textContent = "!"; duration.title = message; }
  else duration.removeAttribute("title");
}

// Kein legaler Stream gefunden: dezent inaktiver Button, Amazon-Link bleibt klickbar, Zeilenhöhe unverändert.
function markPreviewUnavailable(row) {
  if (!row) return;
  setRowState(row, "idle", "Keine Hörprobe im Katalog verfügbar");
  row.classList.add("preview-unavailable");
  row.dataset.state = "unavailable";
  const button = row.querySelector(".song-play-btn");
  button.disabled = true;
  button.setAttribute("aria-label", row.dataset.title + ": keine Hörprobe verfügbar – Amazon-Link nutzen");
  row.querySelector(".song-duration").textContent = "—";
}

function stopCurrentAudio() {
  playRequestId++; // laufende Suchen und Abspielversuche ungültig machen
  const audio = $("preview-audio");
  audio.onended = audio.onerror = audio.onwaiting = audio.onplaying = audio.ontimeupdate = null;
  audio.pause();
  audio.removeAttribute("src");
  audio.load();
  currentSongIndex = -1;
  document.querySelectorAll(".drawer-song-row:not(.preview-unavailable)").forEach(row => setRowState(row, "idle"));
}

const clock = seconds => "0:" + String(Math.min(PREVIEW_SECONDS, Math.max(0, Math.floor(seconds || 0)))).padStart(2, "0");

async function toggleSongPlay(index) {
  const band = activeBand;
  const song = band?.songs[index];
  const row = songRow(index);
  if (!song || !row || row.classList.contains("preview-unavailable")) return;
  const audio = $("preview-audio");

  // Gleicher Song: Pause / Fortsetzen (play() direkt in der Geste)
  if (currentSongIndex === index && audio.getAttribute("src")) {
    if (!audio.paused) {
      audio.pause();
      setRowState(row, "paused", "Pausiert");
      return;
    }
    const resumeRequest = playRequestId;
    try {
      await audio.play();
      if (resumeRequest === playRequestId) setRowState(row, "playing", "Hörprobe läuft …");
    } catch {
      if (resumeRequest === playRequestId) setRowState(row, "paused", "Zum Starten erneut tippen");
    }
    return;
  }

  // Zweiter Klick während der Suche bricht ab
  if (row.classList.contains("loading")) { stopCurrentAudio(); return; }

  stopCurrentAudio();
  unlockAudio(); // synchron in der Klick-Geste
  delete row.dataset.fallback;
  row.querySelector(".song-titles strong").title = song.title;
  const request = playRequestId;
  currentSongIndex = index;
  setRowState(row, "loading", "Hörprobe wird gesucht …");

  const key = previewKey(band, song);
  const stale = () => request !== playRequestId || activeBand !== band;
  const failedUrls = new Set();
  const failedProviders = new Set();

  const load = async opts => {
    for (let attempt = 0; attempt < 2; attempt++) {
      try { return await findCandidates(band, song, { ...opts, isCancelled: stale }); }
      catch (error) { if (!(error.cancelled && !stale())) throw error; } // geteilte Suche wurde von anderem Aufrufer abgebrochen
    }
    throw new Error("Suche wiederholt abgebrochen");
  };

  for (let round = 0; round < 2; round++) {
    let list;
    try {
      list = await load(round === 0 ? {} : { fresh: true, avoidUrls: failedUrls, avoidProviders: failedProviders });
    } catch (error) {
      if (stale()) return;
      currentSongIndex = -1;
      audioLog("warn", band, song, "Suche fehlgeschlagen: " + error.message);
      setRowState(row, "error", "Katalog nicht erreichbar – erneut versuchen");
      return;
    }
    if (stale()) return;

    if (!list.length) {
      currentSongIndex = -1;
      if (round === 0) markPreviewUnavailable(row);
      else setRowState(row, "error", "Hörprobe konnte nicht geladen werden – erneut versuchen");
      return;
    }

    await unlockPromise; // Entsperr-Vorgang abwarten, bevor die echte Quelle gesetzt wird
    if (stale()) return;

    for (const candidate of list) {
      if (failedUrls.has(candidate.previewUrl)) continue;
      audioLog("info", band, song, `Versuch: ${candidate.provider} "${candidate.trackName}" (${candidate.previewUrl.slice(0, 80)}…)`);
      try {
        await attemptPlayback(audio, candidate, request);
      } catch (error) {
        if (stale() || error.kind === "stale") return;
        if (error.kind === "gesture") {
          audioLog("warn", band, song, "Browser verlangt eine Geste (Autoplay-Policy): " + error.message);
          setRowState(row, "paused", "Zum Starten erneut tippen");
          return; // src bleibt gesetzt, der nächste Klick startet direkt
        }
        audioLog("warn", band, song, `${candidate.provider} fehlgeschlagen: ${error.message}`);
        failedUrls.add(candidate.previewUrl);
        failedProviders.add(candidate.provider);
        continue;
      }
      if (stale()) return;

      audioLog("info", band, song, `Wiedergabe läuft ✔ (${candidate.provider}, ${candidate.fallback ? "Ausweich-Track" : "Score " + candidate.score.toFixed(1)})`);
      if (candidate.fallback) {
        // Kennzeichnung ohne Layout-Änderung: Marker "≈" (CSS) + Tooltip
        row.dataset.fallback = candidate.trackName;
        row.querySelector(".song-titles strong").title = `Ausweich-Hörprobe: „${candidate.trackName}" von ${candidate.artistName} – „${song.title}" ist nicht als Preview freigeschaltet`;
      }
      const duration = row.querySelector(".song-duration");
      duration.textContent = "0:00";
      const finishPreview = () => {
        if (request !== playRequestId) return;
        audio.pause();
        audio.currentTime = 0;
        setRowState(row, "paused", "Hörprobe beendet");
        duration.textContent = "0:" + PREVIEW_SECONDS;
      };
      audio.ontimeupdate = () => {
        if (request !== playRequestId || audio.paused) return;
        duration.textContent = clock(audio.currentTime);
        if (audio.currentTime >= PREVIEW_SECONDS) finishPreview();
      };
      audio.onended = finishPreview;
      audio.onwaiting = () => { if (request === playRequestId) row.querySelector(".song-state-text").textContent = "Audio lädt …"; };
      audio.onplaying = () => { if (request === playRequestId) setRowState(row, "playing", "Hörprobe läuft …"); };
      audio.onerror = () => {
        if (request !== playRequestId) return;
        audioLog("error", band, song, "Wiedergabe abgebrochen: " + describeMediaError(audio.error));
        forgetPreview(key);
        stopCurrentAudio();
        setRowState(row, "error", "Wiedergabe abgebrochen – erneut versuchen");
      };
      setRowState(row, "playing", "Hörprobe läuft …");
      return;
    }
    // alle Kandidaten dieser Runde sind gescheitert -> Runde 2 sucht frisch bei den anderen Anbietern
  }

  if (stale()) return;
  forgetPreview(key);
  currentSongIndex = -1;
  audioLog("error", band, song, "Alle Kandidaten sind beim Abspielen gescheitert.");
  setRowState(row, "error", "Hörprobe konnte nicht abgespielt werden – erneut versuchen");
}

/* ---- Diagnose-Werkzeug für die Konsole: RH_AUDIO.diagnose() ---- */
function probeAudioUrl(url, timeoutMs = 9000) {
  return new Promise(resolve => {
    const element = new Audio();
    element.preload = "metadata";
    const done = result => { clearTimeout(timer); element.onloadedmetadata = element.onerror = null; element.removeAttribute("src"); resolve(result); };
    const timer = setTimeout(() => done({ ok: false, reason: "Timeout" }), timeoutMs);
    element.onloadedmetadata = () => done({ ok: true, reason: `lädt, Dauer ${Math.round(element.duration)} s` });
    element.onerror = () => done({ ok: false, reason: describeMediaError(element.error) });
    element.src = url;
  });
}

async function diagnoseAudio() {
  const rows = [];
  const add = (Test, Ergebnis, Details = "") => rows.push({ Test, Ergebnis, Details });
  add("Seite", location.protocol, `online: ${navigator.onLine}, Referrer-Policy: ${document.querySelector('meta[name="referrer"]')?.content || "Standard"}`);
  add("Codec MP3", CAN_PLAY.mp3 ? "OK" : "FEHLT", probeAudio.canPlayType("audio/mpeg") || "nein");
  add("Codec AAC/MP4", CAN_PLAY.m4a ? "OK" : "FEHLT", probeAudio.canPlayType('audio/mp4; codecs="mp4a.40.2"') || "nein");
  add("Audio entsperrt", audioUnlocked ? "ja" : "noch nicht", "wird beim ersten Klick auf ▶ gesetzt");

  const deezer = await jsonp("https://api.deezer.com/search", { q: 'artist:"Arch Enemy" track:"War Eternal"', output: "jsonp", limit: 5 });
  const dz = deezer.ok ? deezerExtract(deezer.data) : null;
  add("Deezer-API", dz ? "OK" : "FEHLER", dz ? `${dz.length} Treffer` : (deezer.reason || JSON.stringify(deezer.data?.error)));
  const dzUrl = dz?.find(t => t.previewUrl)?.previewUrl;
  if (dzUrl) {
    const probe = await probeAudioUrl(dzUrl);
    add("Deezer-Audio", probe.ok ? "OK" : "FEHLER", probe.reason + (urlExpiry(dzUrl) ? `, Link gültig noch ${Math.round((urlExpiry(dzUrl) - Date.now()) / 60000)} min` : ""));
  } else if (dz) add("Deezer-Audio", "KEIN LINK", "Treffer ohne preview-Feld");

  const apple = await jsonp("https://itunes.apple.com/search", { term: "Arch Enemy War Eternal", media: "music", entity: "song", limit: 5, country: "DE" });
  const ap = apple.ok ? appleExtract(apple.data) : null;
  add("iTunes-API", ap ? "OK" : "FEHLER", ap ? `${ap.length} Treffer` : apple.reason);
  const apUrl = ap?.find(t => t.previewUrl)?.previewUrl;
  if (apUrl) {
    const probe = await probeAudioUrl(apUrl);
    add("iTunes-Audio", probe.ok ? "OK" : "FEHLER", probe.reason);
  } else if (ap) add("iTunes-Audio", "KEIN LINK", "Treffer ohne previewUrl");

  console.group("%c[RH-Audio] Diagnose", "color:#e66722;font-weight:bold");
  console.table(rows);
  console.info("Tipp: FEHLER bei einer API = Adblocker/Tracking-Schutz, Offline oder Rate-Limit. FEHLER bei *-Audio = Format/Netzwerk des Streams.");
  console.groupEnd();
  return rows;
}

window.RH_AUDIO = {
  diagnose: diagnoseAudio,
  debug: on => { audioDebug.enabled = on !== false; writeStore("rockharz2027_audio_debug", audioDebug.enabled); return audioDebug.enabled; },
  clearCache: () => { previewCache.clear(); catalogCache.clear(); persistPreviews(); return "Cache geleert"; },
  overrides: AUDIO_OVERRIDES,
  cache: previewCache
};
if (audioDebug.enabled) console.info("%c[RH-Audio]%c Debug-Log aktiv. Test im Browser: RH_AUDIO.diagnose() · Abschalten: RH_AUDIO.debug(false)", "color:#e66722;font-weight:bold", "color:inherit");

/* ---------------------------------------------------------
   RENDERING
   --------------------------------------------------------- */
function cardHTML(band) {
  const cached = photoCache.get(band.id);
  const name = escapeHTML(band.name);
  const selected = activeBand?.id === band.id;
  return `
    <article class="concept-card${selected ? " active-selected" : ""} rated-${status(band.id)}" data-band-id="${band.id}" tabindex="0" role="button" aria-pressed="${selected}" aria-label="${name}: Details öffnen">
      <div class="concept-card-img-wrap">
        <img data-img-band-id="${band.id}"${cached ? ` src="${escapeHTML(cached)}"` : ""} alt="${name}" loading="lazy" referrerpolicy="no-referrer" class="${cached ? "" : "hidden"}">
        <div class="stag-relief-fallback${cached ? " hidden" : ""}" aria-hidden="true"></div>
      </div>
      <div class="card-frame-overlay" aria-hidden="true"></div>
      ${campCountBadgeHTML(band.id)}
      <h3 class="concept-card-name">${name}</h3>
    </article>`;
}

function render() {
  const query = ($("search").value || "").trim().toLowerCase();
  $("reset-view-btn").classList.toggle("hidden", !query);

  const matches = band => cleanStr(band.name).includes(cleanStr(query)) || band.name.toLowerCase().includes(query);
  const fill = (id, list, emptyText) => {
    $(id).innerHTML = list.length
      ? list.map(cardHTML).join("")
      : `<div class="empty-state">${emptyText}</div>`;
  };

  fill("band-grid", BANDS.filter(matches), "Keine Bands gefunden.");
  fill("mine-grid", BANDS.filter(b => isFavoriteish(b.id) && matches(b)),
    "Hier erscheinen deine Favoriten und Vielleicht-Bands.<br>Öffne eine Band und wähle FAVORIT oder VIELLEICHT im Player.");
  fill("unrated-grid", BANDS.filter(b => status(b.id) === "new" && matches(b)),
    "Stark! Du hast bereits alle Bands bewertet. 🤘");

  $("nav-count-favorites").textContent = BANDS.filter(b => isFavoriteish(b.id)).length;
  $("nav-count-unrated").textContent = BANDS.filter(b => status(b.id) === "new").length;

  loadCardPhotos();
  if (activeBand) { updateStepButtons(); updateDetailCampCount(); }
  refreshCampPopover();
}

function ratingButtonsHTML(id) {
  const current = status(id);
  return [
    ["must", "★ FAVORIT"],
    ["maybe", "◉ VIELLEICHT"],
    ["skip", "✕ AUSLASSEN"]
  ].map(([rate, label]) =>
    `<button type="button" data-rate="${rate}" data-id="${id}" class="rating-choice-btn${current === rate ? " active" : ""}" aria-pressed="${current === rate}">${label}</button>`
  ).join("");
}

function songRowHTML(band, song, index) {
  const title = escapeHTML(song.title);
  const bars = WAVE_HEIGHTS.map((h, n) => `<span style="--bar-height:${h}%;--delay:${(n * 0.07).toFixed(2)}s"></span>`).join("");
  return `
    <div class="drawer-song-row" data-song-idx="${index}" data-title="${title}" data-state="idle">
      <button type="button" class="song-play-btn" data-play="${index}" aria-label="${title} abspielen" aria-pressed="false"></button>
      <div class="song-titles">
        <strong title="${title}">${title}</strong>
        <small class="song-state-text" role="status"></small>
      </div>
      <div class="song-waveform" aria-hidden="true">${bars}</div>
      <span class="song-duration">0:${PREVIEW_SECONDS}</span>
    </div>`;
}

function setDrawerOpen(open) {
  $("detail-drawer").classList.toggle("hidden", !open);
  $("drawer-backdrop").classList.toggle("hidden", !open);
  document.body.classList.toggle("drawer-open", open);
}

function closeDrawer() {
  stopCurrentAudio();
  setDrawerOpen(false);
}

function openBand(band) {
  // Gleiche Band erneut gewählt: Player nur wieder einblenden, Wiedergabe nicht anfassen.
  if (activeBand?.id === band.id) { setDrawerOpen(true); return; }

  stopCurrentAudio();
  activeBand = band;

  $("detail-title").textContent = band.name;
  $("detail-meta").textContent = [band.genre, band.origin].filter(Boolean).join(" · ");
  $("detail-desc").textContent = band.description;
  // Ein Link pro Band; Suchbegriff ohne Sonderzeichen ("Håndgemeng" -> "Handgemeng")
  const amazon = $("detail-amazon");
  amazon.href = "https://music.amazon.de/search/" + encodeURIComponent(foldText(searchName(band)));
  amazon.setAttribute("aria-label", band.name + " auf Amazon Music öffnen (neuer Tab)");
  setDrawerOpen(true);
  $("detail-drawer").querySelector(".drawer-scroll").scrollTop = 0;

  // Foto (Fallback bis das Bild geladen ist)
  const img = $("detail-img");
  const fallback = $("detail-fallback");
  img.alt = band.name;
  const cached = photoCache.get(band.id);
  img.removeAttribute("src");
  applyPhoto(img, fallback, cached || null);
  if (cached === undefined) {
    getBandPhoto(band).then(src => { if (activeBand?.id === band.id) applyPhoto(img, fallback, src); });
  }

  // Tracklist
  $("detail-songs").innerHTML = band.songs.length
    ? band.songs.map((song, i) => songRowHTML(band, song, i)).join("")
    : '<div class="empty-state" style="padding:10px 0;font-size:15px">Keine Songs hinterlegt.</div>';

  // Bekannte Fehlschläge sofort ausgrauen, Deezer-Treffer im Hintergrund vorwärmen
  band.songs.forEach((song, index) => {
    const entry = previewCache.get(previewKey(band, song));
    if (entry && entry.exp > Date.now() && !entry.list.length) markPreviewUnavailable(songRow(index));
  });
  prefetchPreviews(band);

  $("detail-rating-btns").innerHTML = ratingButtonsHTML(band.id);
  render();
}

/* ---- Vor/Zurück im Player: blättert durch die aktuell sichtbaren Kacheln (Ansicht + Suche) ---- */
const visibleBandIds = () =>
  [...document.querySelectorAll(".page:not(.hidden) .concept-card")].map(card => card.dataset.bandId);

function neighbourBand(dir) {
  const ids = visibleBandIds();
  if (!activeBand || !ids.length) return null;
  const index = ids.indexOf(activeBand.id);
  // Band nicht mehr in der Liste (z. B. gerade bewertet in "Unbewertet"): am Anfang bzw. Ende einsteigen
  const target = index < 0 ? ids[dir > 0 ? 0 : ids.length - 1] : ids[(index + dir + ids.length) % ids.length];
  return target === activeBand.id ? null : BANDS.find(band => band.id === target) || null;
}

function updateStepButtons() {
  [[-1, "drawer-prev"], [1, "drawer-next"]].forEach(([dir, id]) => {
    const band = neighbourBand(dir);
    $(id).disabled = !band;
    $(id).setAttribute("aria-label", band ? (dir < 0 ? "Vorherige Band: " : "Nächste Band: ") + band.name : "Keine weitere Band");
  });
}

function stepBand(dir) {
  const band = neighbourBand(dir);
  if (!band) return;
  const scroller = $("detail-drawer").querySelector(".drawer-scroll");
  scroller.classList.remove("swap-next", "swap-prev");
  void scroller.offsetWidth; // Animation neu starten
  scroller.classList.add(dir > 0 ? "swap-next" : "swap-prev");
  openBand(band);
  document.querySelector(`.page:not(.hidden) .concept-card[data-band-id="${band.id}"]`)?.scrollIntoView({ block: "nearest" });
}

// Wischen im mobilen Player (Lautstärkeregler ausgenommen)
(() => {
  const drawer = $("detail-drawer");
  let start = null;
  drawer.addEventListener("touchstart", event => {
    start = event.touches.length === 1 && !event.target.closest("input") ? { x: event.touches[0].clientX, y: event.touches[0].clientY } : null;
  }, { passive: true });
  drawer.addEventListener("touchend", event => {
    if (!start) return;
    const dx = event.changedTouches[0].clientX - start.x;
    const dy = event.changedTouches[0].clientY - start.y;
    start = null;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) stepBand(dx < 0 ? 1 : -1);
  }, { passive: true });
})();

function navigate(page) {
  document.querySelectorAll(".page").forEach(el => el.classList.toggle("hidden", el.id !== "page-" + page));
  document.querySelectorAll(".nav-tab").forEach(el => el.classList.toggle("active", el.dataset.page === page));
  document.querySelector(".rh-main-content").scrollTop = 0;
  render();
}

/* ---------------------------------------------------------
   CAMP-VOTING (Firebase Realtime Database)
   Pfad: /ratings/{bandId}/{userKey} = { name, status: "favorite"|"maybe"|"skip", timestamp }
   Gleicher Name auf Handy und PC = gleicher userKey = dieselben Bewertungen.
   In der Oberfläche erscheinen nur Zahlen, Namen ausschließlich im PDF-Export.
   --------------------------------------------------------- */
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyDhDkObnPJ9UsjSdgwxWQGZ1hmn5LKSzjY",
  authDomain: "rockharz-bands.firebaseapp.com",
  databaseURL: "https://rockharz-bands-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "rockharz-bands",
  storageBucket: "rockharz-bands.firebasestorage.app",
  messagingSenderId: "659115908192",
  appId: "1:659115908192:web:2b8373a258ef376d207705"
};
const USER_STORE = { name: "rockharz_user_name", key: "rockharz_user_key" };
const TO_REMOTE = { must: "favorite", maybe: "maybe", skip: "skip" };   // App-Status -> Firebase
const FROM_REMOTE = { favorite: "must", maybe: "maybe", skip: "skip" }; // Firebase -> App-Status

const makeUserKey = name => String(name || "").trim().toLowerCase().replace(/[^a-z0-9äöüß]/g, "_");
const lsGet = key => { try { return localStorage.getItem(key) || ""; } catch { return ""; } };
const lsSet = (key, value) => { try { localStorage.setItem(key, value); } catch {} };

let userName = lsGet(USER_STORE.name);
let userKey = lsGet(USER_STORE.key) || makeUserKey(userName);
let campDb = null;
let campRatings = {};      // bandId -> { userKey: { name, status, timestamp } }
let campLoaded = false;    // erster Snapshot angekommen?
let pendingRate = null;    // Bewertung, die vor dem Namen geklickt wurde

const campVotes = bandId => Object.values(campRatings[bandId] || {}).filter(vote => vote && vote.status === "favorite");
const peopleIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="8" r="3.2"/><path d="M3 19c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5"/><circle cx="17" cy="9" r="2.6"/><path d="M15.5 13.7c.5-.1 1-.2 1.5-.2 2.6 0 4.5 1.8 4.5 4.6"/></svg>';

const wantVerb = count => (count === 1 ? "will" : "wollen");

// Wer will die Band sehen? Sortiert, eigener Eintrag markiert.
const campVoters = bandId => Object.entries(campRatings[bandId] || {})
  .filter(([, vote]) => vote && vote.status === "favorite")
  .map(([key, vote]) => ({ key, name: vote.name || key }))
  .sort((a, b) => a.name.localeCompare(b.name, "de", { sensitivity: "base" }));

/* ---- Hirschschädel-Zähler "Wer will mit?" ----
   cold = niemand will hin (grau) · warm = 1–2 Stimmen (neutral)
   hot  = Konsens (alle im Camp wollen hin) oder Mehrheit ab 3 Stimmen (Glut-Glow) */
const skullIcon = '<img class="camp-skull" src="assets/stag-skull-clean.png" alt="" aria-hidden="true" decoding="async">';
const HEAT_CLASSES = ["camp-cold", "camp-warm", "camp-hot"];

// Camp-Größe: alle, die mindestens eine Band bewertet haben
function campSize() {
  const people = new Set();
  Object.values(campRatings).forEach(votes => Object.keys(votes || {}).forEach(key => people.add(key)));
  return people.size;
}

function campHeat(count) {
  if (!count) return "camp-cold";
  const size = campSize();
  const hot = count >= 2 && (count === size || (count >= 3 && count > size / 2));
  return hot ? "camp-hot" : "camp-warm";
}

function campCountBadgeHTML(bandId) {
  const count = campVotes(bandId).length;
  const label = count ? `${count} aus dem Camp ${wantVerb(count)} die Band sehen` : "Noch niemand aus dem Camp will die Band sehen";
  return `<span class="camp-count-badge card-camp-count ${campHeat(count)}" data-camp-band="${bandId}" aria-label="${label}" title="${label}">${skullIcon}${count}</span>`;
}

function updateDetailCampCount() {
  const badge = $("detail-camp-count");
  badge.hidden = !activeBand;
  if (!activeBand) return;
  const count = campVotes(activeBand.id).length;
  badge.dataset.campBand = activeBand.id;
  badge.classList.remove(...HEAT_CLASSES);
  badge.classList.add(campHeat(count));
  badge.innerHTML = count
    ? `${skullIcon}<span>${count} ${wantVerb(count)} die Band sehen</span>`
    : `${skullIcon}<span>Noch niemand will hin</span>`;
  badge.setAttribute("aria-label", count ? `${count} ${wantVerb(count)} die Band sehen – Namen anzeigen` : "Noch niemand aus dem Camp will die Band sehen");
}

/* ---- Namen-Popover am Zähler: Maus = Hover, Touch/Tastatur = Antippen ---- */
let campPopover = null; // { bandId, inDrawer, pinned }

function campBadgeFor(state) {
  return state.inDrawer
    ? (!$("detail-camp-count").hidden && $("detail-camp-count").dataset.campBand === state.bandId ? $("detail-camp-count") : null)
    : document.querySelector(`.page:not(.hidden) .card-camp-count[data-camp-band="${state.bandId}"]`);
}

function showCampPopover(badge, pinned) {
  const bandId = badge.dataset.campBand;
  const voters = campVoters(bandId);
  if (!voters.length) { hideCampPopover(); return; }
  const band = BANDS.find(item => item.id === bandId);
  const pop = $("camp-popover");
  pop.innerHTML = `
    <div class="camp-popover-title">${peopleIcon}<span>${voters.length} ${wantVerb(voters.length)} ${escapeHTML(band?.name || "")} sehen</span></div>
    <ul>${voters.map(voter => `<li>${escapeHTML(voter.name)}${voter.key === userKey ? " <em>(du)</em>" : ""}</li>`).join("")}</ul>`;
  document.querySelectorAll(".camp-count-badge[aria-expanded]").forEach(el => el.setAttribute("aria-expanded", "false"));
  if (badge.id === "detail-camp-count") badge.setAttribute("aria-expanded", "true");
  campPopover = { bandId, inDrawer: badge.id === "detail-camp-count", pinned };

  // unter dem Zähler, rechtsbündig (Kachel) bzw. linksbündig (Player); oben, wenn unten kein Platz ist
  pop.hidden = false;
  pop.style.left = "0px";
  pop.style.top = "0px";
  const r = badge.getBoundingClientRect();
  const w = pop.offsetWidth;
  const h = pop.offsetHeight;
  const m = 8;
  let left = campPopover.inDrawer ? r.left : r.right - w;
  left = Math.min(Math.max(m, left), window.innerWidth - w - m);
  let top = r.bottom + 8;
  if (top + h > window.innerHeight - m) top = Math.max(m, r.top - h - 8);
  pop.style.left = Math.round(left) + "px";
  pop.style.top = Math.round(top) + "px";
}

function hideCampPopover() {
  if (!campPopover) return;
  campPopover = null;
  $("camp-popover").hidden = true;
  document.querySelectorAll(".camp-count-badge[aria-expanded]").forEach(el => el.setAttribute("aria-expanded", "false"));
}

// Nach jedem Rendern (z. B. neue Stimme live): offenes Popover mit frischen Namen neu aufbauen
function refreshCampPopover() {
  if (!campPopover) return;
  const badge = campBadgeFor(campPopover);
  if (badge) showCampPopover(badge, campPopover.pinned); else hideCampPopover();
}

document.addEventListener("pointerover", event => {
  if (event.pointerType !== "mouse") return;
  const badge = event.target.closest(".camp-count-badge");
  if (badge && campPopover?.bandId !== badge.dataset.campBand) showCampPopover(badge, false);
});
document.addEventListener("pointerout", event => {
  if (event.pointerType !== "mouse" || !campPopover || campPopover.pinned) return;
  if (!event.target.closest(".camp-count-badge, #camp-popover")) return;
  if (event.relatedTarget?.closest?.(".camp-count-badge, #camp-popover")) return;
  hideCampPopover();
});
// Scrollen/Größenänderung: Popover würde sonst in der Luft hängen
document.addEventListener("scroll", event => { if (!event.target.closest?.("#camp-popover")) hideCampPopover(); }, true);
window.addEventListener("resize", hideCampPopover);

function updateUserButton() {
  $("camp-user-name").textContent = userName || "Name festlegen";
  $("camp-user-btn").setAttribute("aria-label", userName ? `Angemeldet als ${userName} – Namen ändern` : "Namen für das Camp-Voting festlegen");
}

function setSyncState(online) {
  $("camp-user-btn").classList.toggle("offline", !online);
  $("camp-user-btn").title = online
    ? "Live mit dem Camp synchronisiert"
    : "Keine Verbindung – Bewertungen werden lokal gespeichert und später nicht automatisch übertragen";
}

// Eigene Bewertungen aus dem Camp-Snapshot übernehmen (Firebase ist die Quelle der Wahrheit).
function applyCampRatings() {
  if (userKey) {
    const mine = {};
    Object.entries(campRatings).forEach(([bandId, votes]) => {
      const status = FROM_REMOTE[votes?.[userKey]?.status];
      if (status) mine[bandId] = status;
    });
    ratings = mine;
    writeStore(STORAGE.ratings, ratings);
  }
  if (activeBand) $("detail-rating-btns").innerHTML = ratingButtonsHTML(activeBand.id);
  render();
}

// Lokale Bewertungen (vor dem ersten Namen entstanden) einmalig hochladen, falls der Name im Camp noch leer ist.
function uploadLocalIfEmpty() {
  if (!campDb || !userKey || !campLoaded) return;
  const hasRemote = Object.values(campRatings).some(votes => votes?.[userKey]);
  const local = Object.entries(ratings).filter(([, status]) => TO_REMOTE[status]);
  if (hasRemote || !local.length) return;
  const updates = {};
  local.forEach(([bandId, status]) => {
    updates[`${bandId}/${userKey}`] = { name: userName, status: TO_REMOTE[status], timestamp: Date.now() };
  });
  campDb.ref("ratings").update(updates).catch(error => console.warn("[Camp] Hochladen fehlgeschlagen", error));
}

function initCamp() {
  updateUserButton();
  try {
    if (window.firebase) {
      if (!firebase.apps.length) firebase.initializeApp(FIREBASE_CONFIG);
      campDb = firebase.database();
    }
  } catch (error) {
    console.warn("[Camp] Firebase nicht verfügbar – Bewertungen bleiben lokal", error);
    campDb = null;
  }
  if (!campDb) { setSyncState(false); return; }

  campDb.ref(".info/connected").on("value", snap => setSyncState(snap.val() === true));
  campDb.ref("ratings").on("value", snap => {
    campRatings = snap.val() || {};
    const first = !campLoaded;
    campLoaded = true;
    if (first) uploadLocalIfEmpty();
    applyCampRatings();
  }, error => {
    console.warn("[Camp] Lesen verweigert/fehlgeschlagen", error);
    setSyncState(false);
  });
}

function setRating(bandId, rate) {
  if (!userName) { pendingRate = { bandId, rate }; openNameModal(); return; }
  const next = ratings[bandId] === rate ? null : rate;
  if (next) ratings[bandId] = next; else delete ratings[bandId];
  writeStore(STORAGE.ratings, ratings);
  if (activeBand?.id === bandId) $("detail-rating-btns").innerHTML = ratingButtonsHTML(bandId);
  render();
  if (!campDb) return;
  const ref = campDb.ref(`ratings/${bandId}/${userKey}`);
  (next ? ref.set({ name: userName, status: TO_REMOTE[next], timestamp: Date.now() }) : ref.remove())
    .catch(error => console.warn("[Camp] Speichern fehlgeschlagen", error));
}

// Namenswechsel: Einträge vom alten auf den neuen Schlüssel umziehen, bei Konflikt gewinnt der neuere.
async function changeUser(newName) {
  const newKey = makeUserKey(newName);
  const oldKey = userKey;
  userName = newName;
  userKey = newKey;
  lsSet(USER_STORE.name, newName);
  lsSet(USER_STORE.key, newKey);
  updateUserButton();

  if (campDb && campLoaded) {
    const updates = {};
    Object.entries(campRatings).forEach(([bandId, votes]) => {
      const oldVote = oldKey && oldKey !== newKey ? votes?.[oldKey] : null;
      const newVote = votes?.[newKey];
      if (oldVote) {
        const winner = !newVote || (oldVote.timestamp || 0) > (newVote.timestamp || 0) ? oldVote : newVote;
        updates[`${bandId}/${newKey}`] = { ...winner, name: newName };
        updates[`${bandId}/${oldKey}`] = null; // keine Karteileichen / Doppel-Stimmen
      } else if (newVote && newVote.name !== newName) {
        updates[`${bandId}/${newKey}/name`] = newName; // Schreibweise vereinheitlichen
      }
    });
    try {
      if (Object.keys(updates).length) await campDb.ref("ratings").update(updates);
      uploadLocalIfEmpty();
    } catch (error) {
      console.warn("[Camp] Namenswechsel konnte nicht übertragen werden", error);
    }
  }
  applyCampRatings();

  if (pendingRate) {
    const { bandId, rate } = pendingRate;
    pendingRate = null;
    if (ratings[bandId] !== rate) setRating(bandId, rate);
  }
}

/* ---- Namens-Modal ---- */
let modalReturnFocus = null;
function openNameModal() {
  modalReturnFocus = document.activeElement;
  $("camp-modal").hidden = false;
  document.body.classList.add("modal-open");
  $("camp-name-input").value = userName;
  $("camp-name-error").hidden = true;
  setTimeout(() => $("camp-name-input").focus(), 30);
}
function closeNameModal() {
  $("camp-modal").hidden = true;
  document.body.classList.remove("modal-open");
  pendingRate = null;
  modalReturnFocus?.focus?.();
}
$("camp-modal-form").addEventListener("submit", async event => {
  event.preventDefault();
  const name = $("camp-name-input").value.trim().replace(/\s+/g, " ");
  if (!/[a-z0-9äöüß]/.test(makeUserKey(name))) {
    $("camp-name-error").textContent = "Bitte gib mindestens einen Buchstaben oder eine Zahl ein.";
    $("camp-name-error").hidden = false;
    $("camp-name-input").focus();
    return;
  }
  const keepPending = pendingRate;
  $("camp-modal").hidden = true;
  document.body.classList.remove("modal-open");
  pendingRate = keepPending;
  await changeUser(name);
  modalReturnFocus?.focus?.();
});
$("camp-modal-cancel").addEventListener("click", closeNameModal);
$("camp-modal").addEventListener("click", event => { if (event.target === $("camp-modal")) closeNameModal(); });
$("camp-user-btn").addEventListener("click", openNameModal);

/* ---------------------------------------------------------
   EVENTS
   --------------------------------------------------------- */
document.addEventListener("click", event => {
  // Zähler antippen: Namen ein-/ausblenden – öffnet NICHT die Band
  const campBadge = event.target.closest(".camp-count-badge");
  if (campBadge) {
    event.preventDefault();
    if (campPopover?.pinned && campPopover.bandId === campBadge.dataset.campBand) hideCampPopover();
    else showCampPopover(campBadge, true);
    return;
  }
  if (campPopover && !event.target.closest("#camp-popover")) hideCampPopover();

  const rateBtn = event.target.closest("[data-rate]");
  if (rateBtn) {
    setRating(rateBtn.dataset.id, rateBtn.dataset.rate);
    return;
  }

  const playBtn = event.target.closest("[data-play]");
  if (playBtn) { toggleSongPlay(Number(playBtn.dataset.play)); return; }

  const stepBtn = event.target.closest("[data-step]");
  if (stepBtn) { stepBand(Number(stepBtn.dataset.step)); return; }

  if (event.target.closest(".amazon-link")) return; // normaler Link

  const card = event.target.closest(".concept-card");
  if (card) {
    const band = BANDS.find(item => item.id === card.dataset.bandId);
    if (band) openBand(band);
    return;
  }

  const tab = event.target.closest(".nav-tab[data-page]");
  if (tab) navigate(tab.dataset.page);
});

// Kacheln sind per Tastatur bedienbar.
document.addEventListener("keydown", event => {
  if (event.key === "Escape" && campPopover) { hideCampPopover(); return; }
  if (!$("camp-modal").hidden) { // Modal hat Vorrang
    if (event.key === "Escape") closeNameModal();
    return;
  }
  const drawerOpen = !$("detail-drawer").classList.contains("hidden");
  if (event.key === "Escape" && drawerOpen) {
    closeDrawer();
    return;
  }
  // Pfeiltasten blättern zur vorherigen/nächsten Band (nicht beim Tippen oder am Lautstärkeregler)
  if (drawerOpen && (event.key === "ArrowLeft" || event.key === "ArrowRight") && !event.target.closest("input, textarea")) {
    event.preventDefault();
    stepBand(event.key === "ArrowRight" ? 1 : -1);
    return;
  }
  if ((event.key === "Enter" || event.key === " ") && event.target.matches(".concept-card")) {
    event.preventDefault();
    const band = BANDS.find(item => item.id === event.target.dataset.bandId);
    if (band) openBand(band);
  }
});

/* LAUTSTÄRKE */
const volumeSlider = $("master-volume");
function updateVolumeUI() {
  const percent = Math.round(masterVolume * 100);
  volumeSlider.value = masterVolume;
  volumeSlider.style.setProperty("--fill", percent + "%");
  $("volume-value").value = percent + "%";
}
volumeSlider.addEventListener("input", event => {
  masterVolume = parseFloat(event.target.value);
  writeStore(STORAGE.volume, masterVolume);
  $("preview-audio").volume = masterVolume;
  updateVolumeUI();
});
updateVolumeUI();

$("reset-view-btn").addEventListener("click", () => { $("search").value = ""; render(); $("search").focus(); });
$("drawer-close-btn").addEventListener("click", closeDrawer);
$("drawer-backdrop").addEventListener("click", closeDrawer);
$("search").addEventListener("input", () => { document.querySelector(".rh-main-content").scrollTop = 0; render(); });

/* PDF-EXPORT */
$("export").addEventListener("click", () => {
  const byName = (a, b) => a.name.localeCompare(b.name, "de");
  const must = BANDS.filter(b => status(b.id) === "must").sort(byName);
  const maybe = BANDS.filter(b => status(b.id) === "maybe").sort(byName);
  const rest = BANDS.filter(b => status(b.id) !== "must" && status(b.id) !== "maybe").sort(byName);

  const section = (title, list, bg, border, icon, text) => !list.length ? "" : `
    <h2 style="margin:30px 0 0;font-size:22px;border-bottom:2px solid ${border};padding-bottom:5px;text-transform:uppercase;color:${border}">
      ${icon} ${title} (${list.length})
    </h2>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:15px;margin-top:15px">
      ${list.map(b => `
        <div style="background:${bg};border:2px solid ${border};padding:12px;border-radius:6px;break-inside:avoid">
          <strong style="display:block;font-size:18px;margin-bottom:4px;color:${text}">${escapeHTML(b.name)}</strong>
          <span style="font-size:12px;color:#333">${escapeHTML(b.genre)}</span>
        </div>`).join("")}
    </div>`;

  // Camp-Voting: NUR hier erscheinen Namen ("ARCH ENEMY — 4 Stimmen (Tobias, Patty, …)")
  const campList = BANDS
    .map(band => ({ band, voters: campVotes(band.id).map(vote => vote.name).filter(Boolean).sort((a, b) => a.localeCompare(b, "de")) }))
    .filter(item => item.voters.length)
    .sort((a, b) => b.voters.length - a.voters.length || byName(a.band, b.band));
  const campSection = !campList.length ? "" : `
    <h2 style="margin:30px 0 0;font-size:22px;border-bottom:2px solid #1f7a42;padding-bottom:5px;text-transform:uppercase;color:#1f7a42">
      👥 Camp-Voting (${campList.length} Bands)
    </h2>
    <ol style="margin:12px 0 0;padding-left:28px;font-size:16px;line-height:1.6">
      ${campList.map(({ band, voters }) => `
        <li style="break-inside:avoid">
          <strong style="text-transform:uppercase">${escapeHTML(band.name)}</strong>
          — ${voters.length} ${voters.length === 1 ? "Stimme" : "Stimmen"}
          <span style="color:#333">(${voters.map(escapeHTML).join(", ")})</span>
        </li>`).join("")}
    </ol>`;

  const printNode = document.createElement("div");
  printNode.id = "print-section";
  printNode.style.cssText = "width:100%;font-family:'Barlow Condensed','Inter',sans-serif;color:#000;background:#fff;padding:20px";
  printNode.innerHTML = `
    <h1 style="text-align:center;margin:0 0 25px;text-transform:uppercase;font-size:36px;border-bottom:3px solid #000;padding-bottom:10px">
      ROCKHARZ 2027 — ${userName ? "LINE-UP VON " + escapeHTML(userName) : "MEIN LINE-UP"}
    </h1>
    ${campSection}
    ${section("Pflicht-Bands (Ja)", must, "#fff2e9", "#e66722", "★", "#713013")}
    ${section("Vielleicht", maybe, "#fff8e6", "#c48c34", "◉", "#54390b")}
    ${section("Restliches Line-up", rest, "#f5f5f5", "#888888", "◇", "#222")}`;

  document.body.appendChild(printNode);
  window.addEventListener("afterprint", () => printNode.remove(), { once: true });
  window.print();
});

/* START – erst nach der Crew-PIN (crew-gate.js): vorher keine Fotos, Hörproben oder Camp-Daten laden */
function startApp() {
  render();
  if (window.matchMedia("(min-width: 901px)").matches && BANDS.length) openBand(BANDS[0]);
  initCamp();
  if (!userName) openNameModal(); // erster Besuch: Namen für das Camp abfragen
}
if (window.crewGate) window.crewGate.whenUnlocked(startApp); else startApp();
