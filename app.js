"use strict";

/* ROCKHARZ 2027 — DEFINITIVE ENGINE
   - Mobile Bottom-Sheet Steuerung & Backdrop
   - Volle Klickbarkeit auf allen Geräten
   - Exakte Songprüfung ohne falsche Tracks
*/

const KEY = "rockharz2027_favorites_v1";
const $ = id => document.getElementById(id);

let ratings = {};
let currentPage = "lineup";
let activeBand = null;
let currentAudio = null;
let currentSongIndex = -1;
let playRequestId = 0;
let selectedDay = null;

const photoCache = new Map();
const previewCache = new Map();

try {
  ratings = JSON.parse(localStorage.getItem(KEY) || "{}");
} catch (e) {
  ratings = {};
}

const status = id => {
  const val = ratings[id];
  return (val === "must" || val === "maybe" || val === "skip") ? val : "new";
};

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(ratings));
  } catch (e) {
    console.warn("Speichern fehlgeschlagen", e);
  }
}

/* ---------------------------------------------------------
   WIKIPEDIA BAND FOTOS
   --------------------------------------------------------- */
const WIKI_TITLES = {
  "Accept": "Accept (band)",
  "Alestorm": "Alestorm",
  "All for Metal": "All for Metal",
  "Arch Enemy": "Arch Enemy",
  "Bruce Dickinson": "Bruce Dickinson",
  "Coppelius": "Coppelius",
  "Corvus Corax": "Corvus Corax (band)",
  "D'Artagnan": "dArtagnan (band)",
  "Dust Bolt": "Dust Bolt",
  "Eisbrecher": "Eisbrecher (band)",
  "Emil Bulls": "Emil Bulls",
  "Equilibrium": "Equilibrium (band)",
  "Gloryhammer": "Gloryhammer",
  "Grave Digger": "Grave Digger (band)",
  "Gutalax": "Gutalax",
  "GWAR": "Gwar",
  "Håndgemeng": "Håndgemeng",
  "H-Blockx": "H-Blockx",
  "Igel vs. Shark": "Igel vs. Shark",
  "Katerfahrt": "Katerfahrt",
  "Korpiklaani": "Korpiklaani",
  "Lord of the Lost": "Lord of the Lost",
  "Marduk": "Marduk (band)",
  "Metal Church": "Metal Church",
  "Setyøursails": "Setyøursails",
  "SKÁLD": "Skáld",
  "Storm Seeker": "Storm Seeker",
  "Tankard": "Tankard (band)",
  "The Sisters of Mercy": "The Sisters of Mercy",
  "Turbobier": "Turbobier"
};

async function fetchWikiImage(title, lang = "en") {
  const url = `https://${lang}.wikipedia.org/w/api.php?` +
    new URLSearchParams({
      action: "query",
      titles: title,
      prop: "pageimages",
      pithumbsize: "800",
      format: "json",
      origin: "*",
      redirects: "1"
    });

  const res = await fetch(url);
  if (!res.ok) return null;
  const data = await res.json();
  const pageObj = Object.values(data.query?.pages || {})[0];
  return pageObj?.thumbnail?.source || null;
}

async function getBandPhoto(band) {
  if (band.name === "All for Metal") return "assets/all-for-metal-art.webp";
  if (photoCache.has(band.id)) return photoCache.get(band.id);

  const title = WIKI_TITLES[band.name] || band.name;
  let img = await fetchWikiImage(title, "en").catch(() => null);

  if (!img) {
    img = await fetchWikiImage(band.name, "de").catch(() => null);
  }

  if (!img && title.includes("(")) {
    const cleanTitle = title.replace(/\s*\(.*?\)\s*/g, "");
    img = await fetchWikiImage(cleanTitle, "en").catch(() => null);
  }

  photoCache.set(band.id, img);
  return img;
}

function loadCardPhotos() {
  document.querySelectorAll("[data-img-band-id]").forEach(imgEl => {
    const bandId = imgEl.dataset.imgBandId;
    const band = BANDS.find(b => b.id === bandId);
    if (!band) return;

    getBandPhoto(band).then(src => {
      imgEl.src = src || "assets/all-for-metal-art.webp";
    });
  });
}

/* ---------------------------------------------------------
   AUDIO ENGINE (Apple Music / iTunes API)
   --------------------------------------------------------- */
const cleanStr = val =>
  String(val || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[åäæ]/g, "a")
    .replace(/[øö]/g, "o")
    .replace(/[ü]/g, "u")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

function matchExactTrack(track, band, song) {
  if (!track?.previewUrl?.startsWith("https://")) return false;
  
  const aWanted = cleanStr(band.name).replace(/^the /, "");
  const aTrack = cleanStr(track.artistName).replace(/^the /, "");
  
  const sWanted = cleanStr(song.title);
  const sTrack = cleanStr(track.trackName)
    .replace(/\s*(explicit|remaster(ed)?|radio edit|single version|album version|version|live)\s*/g, " ")
    .trim();

  const artistMatch = aTrack.includes(aWanted) || aWanted.includes(aTrack);
  const songMatch = sTrack.includes(sWanted) || sWanted.includes(sTrack);

  return artistMatch && songMatch;
}

async function queryItunes(params) {
  const url = "https://itunes.apple.com/search?" + new URLSearchParams(params);
  const res = await fetch(url, { signal: AbortSignal.timeout(4500) });
  if (!res.ok) return [];
  const data = await res.json();
  return data.results || [];
}

async function findStudioAudio(band, song) {
  const cacheKey = band.name + "|" + song.title;
  if (previewCache.has(cacheKey)) return previewCache.get(cacheKey);

  const cleanBandName = band.name
    .replace(/å/g, "a").replace(/Å/g, "A")
    .replace(/ø/g, "o").replace(/Ø/g, "O");

  for (const country of ["DE", "US"]) {
    try {
      const results = await queryItunes({
        term: `${cleanBandName} ${song.title}`,
        entity: "song",
        limit: "25",
        country,
        media: "music"
      });

      const match = results.find(t => matchExactTrack(t, band, song));
      if (match?.previewUrl) {
        previewCache.set(cacheKey, match);
        return match;
      }
    } catch (e) {}
  }

  try {
    const artistResults = await queryItunes({
      term: cleanBandName,
      entity: "song",
      limit: "50",
      country: "DE",
      media: "music"
    });

    const match2 = artistResults.find(t => matchExactTrack(t, band, song));
    if (match2?.previewUrl) {
      previewCache.set(cacheKey, match2);
      return match2;
    }
  } catch (e) {}

  previewCache.set(cacheKey, null);
  return null;
}

function stopCurrentAudio() {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.removeAttribute("src");
    currentAudio.load();
    currentAudio = null;
  }
}

async function toggleSongPlay(index) {
  if (!activeBand || !activeBand.songs[index]) return;

  const band = activeBand;
  const song = band.songs[index];
  const row = document.querySelector(`.drawer-song-row[data-song-idx="${index}"]`);
  const playBtn = row?.querySelector(".song-play-btn");
  const stateText = row?.querySelector(".song-state-text");

  if (currentSongIndex === index && currentAudio && !currentAudio.paused) {
    currentAudio.pause();
    row?.classList.remove("playing");
    if (playBtn) playBtn.textContent = "▶";
    if (stateText) stateText.textContent = "Pausiert";
    return;
  }

  if (currentSongIndex === index && currentAudio && currentAudio.paused) {
    try {
      await currentAudio.play();
      row?.classList.add("playing");
      if (playBtn) playBtn.textContent = "⏸";
      if (stateText) stateText.textContent = "Hörprobe läuft";
    } catch (err) {
      if (stateText) stateText.textContent = "Wiedergabe blockiert";
    }
    return;
  }

  stopCurrentAudio();
  const thisRequest = ++playRequestId;
  currentSongIndex = index;

  document.querySelectorAll(".drawer-song-row").forEach(r => {
    r.classList.remove("playing");
    r.removeAttribute("aria-busy");
    const btn = r.querySelector(".song-play-btn");
    const st = r.querySelector(".song-state-text");
    if (btn) btn.textContent = "▶";
    if (st) st.textContent = "Hörprobe starten";
  });

  if (row) row.setAttribute("aria-busy", "true");
  if (stateText) stateText.textContent = "Lade Hörprobe …";

  const track = await findStudioAudio(band, song);
  if (thisRequest !== playRequestId || activeBand !== band) return;

  if (row) row.removeAttribute("aria-busy");

  if (!track || !track.previewUrl) {
    if (stateText) stateText.textContent = "Hörprobe nicht verfügbar";
    if (playBtn) playBtn.textContent = "×";
    currentSongIndex = -1;
    return;
  }

  const audio = new Audio();
  audio.preload = "auto";
  audio.src = track.previewUrl;
  currentAudio = audio;

  audio.addEventListener("ended", () => {
    if (currentAudio !== audio) return;
    row?.classList.remove("playing");
    if (playBtn) playBtn.textContent = "▶";
    if (stateText) stateText.textContent = "Hörprobe beendet";
    currentSongIndex = -1;
  });

  audio.addEventListener("error", () => {
    if (currentAudio !== audio) return;
    row?.classList.remove("playing");
    if (playBtn) playBtn.textContent = "×";
    if (stateText) stateText.textContent = "Wiedergabefehler";
    currentSongIndex = -1;
  });

  try {
    await audio.play();
    if (thisRequest !== playRequestId) {
      audio.pause();
      return;
    }
    row?.classList.add("playing");
    if (playBtn) playBtn.textContent = "⏸";
    if (stateText) stateText.textContent = "Hörprobe läuft";
  } catch (e) {
    if (stateText) stateText.textContent = "Klick nötig";
    if (playBtn) playBtn.textContent = "▶";
  }
}

/* ---------------------------------------------------------
   RENDER & TEMPLATES
   --------------------------------------------------------- */
function cardHTML(band) {
  const isSelected = activeBand?.id === band.id;
  const currentStatus = status(band.id);

  return `
    <article class="concept-card ${isSelected ? 'active-selected' : ''}" data-band-id="${band.id}">
      <div class="concept-card-img-wrap">
        <img data-img-band-id="${band.id}" src="assets/all-for-metal-art.webp" alt="${band.name}" loading="lazy">
      </div>
      <div class="concept-card-body">
        <h3 class="concept-card-name">${band.name}</h3>
        <div class="concept-card-genre">${band.genre}</div>
        <div class="concept-card-ratings">
          <button data-rate="must" data-id="${band.id}" class="${currentStatus === 'must' ? 'active' : ''}" title="Ja (Muss ich sehen)">★</button>
          <button data-rate="maybe" data-id="${band.id}" class="${currentStatus === 'maybe' ? 'active' : ''}" title="Vielleicht">◉</button>
          <button data-rate="skip" data-id="${band.id}" class="${currentStatus === 'skip' ? 'active' : ''}" title="Nein (Eher nicht)">✕</button>
        </div>
      </div>
    </article>
  `;
}

function render() {
  const query = $("search").value.trim().toLowerCase();

  const isFilterActive = Boolean(selectedDay || query);
  const resetBtn = $("reset-view-btn");
  if (resetBtn) {
    resetBtn.classList.toggle("hidden", !isFilterActive);
  }

  const baseFilter = band => {
    const matchQuery = band.name.toLowerCase().includes(query);
    const matchDay = selectedDay ? (band.day === selectedDay) : true;
    return matchQuery && matchDay;
  };

  const lineupBands = BANDS.filter(baseFilter);

  const favoriteBands = BANDS.filter(b => {
    const s = status(b.id);
    return (s === "must" || s === "maybe") && baseFilter(b);
  });

  const unratedBands = BANDS.filter(b => {
    return status(b.id) === "new" && baseFilter(b);
  });

  // 1. Line-Up
  if ($("band-grid")) {
    if (selectedDay && lineupBands.length === 0) {
      $("band-grid").innerHTML = `
        <div style="grid-column: 1/-1; padding: 40px; color: var(--rh-muted); text-align: center; line-height: 1.7;">
          <h3 style="color: var(--rh-orange); margin: 0 0 10px;">SPIELTAGE NOCH NICHT BESTÄTIGT</h3>
          Für diesen Tag sind in den offiziellen Festival-Daten noch keine Bands fest eingeteilt.<br>
          <button id="inline-reset-btn" class="day-reset-btn" style="margin-top: 15px;">Zurück zu allen Bands</button>
        </div>`;
      const inlineBtn = $("inline-reset-btn");
      if (inlineBtn) inlineBtn.onclick = resetToAllBands;
    } else {
      $("band-grid").innerHTML = lineupBands.length
        ? lineupBands.map(cardHTML).join("")
        : '<div style="grid-column: 1/-1; padding: 30px; color: var(--rh-muted); text-align: center;">Keine Bands gefunden. 🤘</div>';
    }
  }

  // 2. Meine Bands
  if ($("mine-grid")) {
    $("mine-grid").innerHTML = favoriteBands.length
      ? favoriteBands.map(cardHTML).join("")
      : '<div style="grid-column: 1/-1; padding: 40px 10px; color: var(--rh-muted); text-align: center; line-height: 1.6;">Du hast noch keine Bands mit <strong>★ (Ja)</strong> oder <strong>◉ (Vielleicht)</strong> markiert.</div>';
  }

  // 3. Noch Offen
  if ($("unrated-grid")) {
    $("unrated-grid").innerHTML = unratedBands.length
      ? unratedBands.map(cardHTML).join("")
      : '<div style="grid-column: 1/-1; padding: 40px 10px; color: var(--rh-muted); text-align: center; line-height: 1.6;">Stark! Du hast bereits alle Bands bewertet. 🤘</div>';
  }

  loadCardPhotos();

  // Badges
  const favCount = BANDS.filter(b => status(b.id) === "must" || status(b.id) === "maybe").length;
  const unratedCount = BANDS.filter(b => status(b.id) === "new").length;
  if ($("nav-count-favorites")) $("nav-count-favorites").textContent = favCount;
  if ($("nav-count-unrated")) $("nav-count-unrated").textContent = unratedCount;

  if ($("lineup-subtitle")) {
    $("lineup-subtitle").textContent = `${BANDS.length} BANDS · DEINE PERSÖNLICHE FESTIVALPLANUNG`;
  }
}

function resetToAllBands() {
  selectedDay = null;
  $("search").value = "";
  document.querySelectorAll("[data-day-filter]").forEach(b => b.classList.remove("active-day"));
  const resetBtn = $("reset-view-btn");
  if (resetBtn) resetBtn.classList.add("hidden");
  navigate("lineup");
  render();
}

function closeDrawer() {
  stopCurrentAudio();
  $("detail-drawer").classList.add("hidden");
  const backdrop = $("drawer-backdrop");
  if (backdrop) backdrop.classList.add("hidden");
  activeBand = null;
  render();
}

function openBand(band) {
  stopCurrentAudio();
  currentSongIndex = -1;
  activeBand = band;

  $("detail-title").textContent = band.name;
  $("detail-genre").textContent = band.genre;
  $("detail-website").href = band.website;
  $("detail-desc").textContent = band.description;
  
  // Drawer & Mobile Backdrop öffnen
  $("detail-drawer").classList.remove("hidden");
  const backdrop = $("drawer-backdrop");
  if (backdrop) backdrop.classList.remove("hidden");

  getBandPhoto(band).then(src => {
    $("detail-img").src = src || "assets/all-for-metal-art.webp";
  });

  const currentStatus = status(band.id);
  $("detail-rating-btns").innerHTML = `
    <button data-rate="must" data-id="${band.id}" class="${currentStatus === 'must' ? 'active' : ''}">★ Ja</button>
    <button data-rate="maybe" data-id="${band.id}" class="${currentStatus === 'maybe' ? 'active' : ''}">◉ Vielleicht</button>
    <button data-rate="skip" data-id="${band.id}" class="${currentStatus === 'skip' ? 'active' : ''}">✕ Nein</button>
  `;

  $("detail-songs").innerHTML = band.songs.length
    ? band.songs.map((song, i) => `
      <div class="drawer-song-row" data-song-idx="${i}">
        <div class="song-skull-icon" aria-hidden="true"></div>
        <button class="song-play-btn" data-play="${i}" aria-label="${song.title} abspielen">▶</button>
        <div class="song-titles">
          <strong>${song.title}</strong>
          <small class="song-state-text">Hörprobe starten</small>
        </div>
        <div class="song-waveform">
          <span></span><span></span><span></span><span></span>
        </div>
        <span class="song-duration">0:30</span>
      </div>
    `).join("")
    : `<div style="padding:10px; font-size:12px; color:#888;">Keine Songs hinterlegt.</div>`;

  render();
}

function navigate(targetPage) {
  currentPage = targetPage;
  document.querySelectorAll(".page").forEach(el => {
    el.classList.toggle("hidden", el.id !== "page-" + targetPage);
  });
  document.querySelectorAll("[data-page]").forEach(el => {
    el.classList.toggle("active", el.dataset.page === targetPage);
  });
  render();
}

/* ---------------------------------------------------------
   EVENTS & DELEGATION
   --------------------------------------------------------- */
document.addEventListener("click", e => {
  // 1. Rating-Buttons
  const rateBtn = e.target.closest("[data-rate]");
  if (rateBtn) {
    const id = rateBtn.dataset.id;
    const clickedVal = rateBtn.dataset.rate;

    if (ratings[id] === clickedVal) {
      delete ratings[id];
    } else {
      ratings[id] = clickedVal;
    }

    persist();
    render();
    if (activeBand?.id === id) openBand(activeBand);
    return;
  }

  // 2. Band-Auswahl
  const card = e.target.closest(".concept-card");
  if (card) {
    const bandId = card.dataset.bandId;
    const band = BANDS.find(b => b.id === bandId);
    if (band) openBand(band);
    return;
  }

  // 3. Audio abspielen
  const playBtn = e.target.closest("[data-play]");
  if (playBtn) {
    const idx = Number(playBtn.dataset.play);
    toggleSongPlay(idx);
    return;
  }

  // 4. Logo / Brand Reset
  if (e.target.closest("#brand-reset")) {
    resetToAllBands();
    return;
  }

  // 5. Navigation
  const nav = e.target.closest("[data-page]");
  if (nav) {
    if (nav.dataset.page === "lineup") {
      resetToAllBands();
    } else {
      navigate(nav.dataset.page);
    }
    return;
  }

  // 6. Tagesfilter
  const dayBtn = e.target.closest("[data-day-filter]");
  if (dayBtn) {
    const clickedDay = dayBtn.dataset.dayFilter;
    if (selectedDay === clickedDay) {
      selectedDay = null;
      dayBtn.classList.remove("active-day");
    } else {
      document.querySelectorAll("[data-day-filter]").forEach(b => b.classList.remove("active-day"));
      dayBtn.classList.add("active-day");
      selectedDay = clickedDay;
    }
    navigate("lineup");
    render();
    return;
  }
});

const resetViewBtn = $("reset-view-btn");
if (resetViewBtn) {
  resetViewBtn.onclick = resetToAllBands;
}

// Schließen des Drawers (Button & Klick auf Backdrop)
$("drawer-close-btn").onclick = closeDrawer;
const backdrop = $("drawer-backdrop");
if (backdrop) backdrop.onclick = closeDrawer;

$("desc-expand-btn").onclick = () => {
  const p = $("detail-desc");
  const isCollapsed = p.classList.toggle("desc-collapsed");
  $("desc-expand-btn").textContent = isCollapsed ? "Mehr anzeigen ∨" : "Weniger anzeigen ∧";
};

$("search").addEventListener("input", render);

// Export / Import
$("export").onclick = () => {
  const blob = new Blob([JSON.stringify(ratings, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "rockharz-2027-favoriten.json";
  a.click();
  URL.revokeObjectURL(url);
};

$("import").onclick = () => $("import-file").click();

$("import-file").onchange = async event => {
  const file = event.target.files[0];
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    if (data && typeof data === "object") {
      ratings = data;
      persist();
      render();
      alert("Favoriten erfolgreich importiert!");
    }
  } catch (err) {
    alert("Ungültige Importdatei.");
  }
  event.target.value = "";
};

// Start
render();
// Auf Desktop automatisch Accept öffnen, auf Mobile Drawer standardmäßig zu lassen
if (window.innerWidth > 900 && BANDS.length > 0) {
  openBand(BANDS[0]);
}