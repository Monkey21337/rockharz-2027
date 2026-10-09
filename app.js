"use strict";

/* ROCKHARZ 2027 — DEFINITIVE ENGINE
   - Exakter Song-Abgleich (Kein Ersetzen durch falsche Lieder mehr!)
   - Multi-Level Fallback (iTunes 6 Länder + Deezer JSONP)
   - Offline Line-Up PDF Export mit Farbmarkierungen
   - Nahtlose Audio-Wiedergabe & Master-Volume Save
*/

if ("scrollRestoration" in history) {
  history.scrollRestoration = "manual";
}
window.scrollTo(0, 0);

const KEY = "rockharz2027_favorites_v1";
const VOL_KEY = "rockharz2027_volume";
const $ = id => document.getElementById(id);

let ratings = {};
let currentPage = "lineup";
let activeBand = null;
let currentAudio = null;
let currentSongIndex = -1;
let playRequestId = 0;
let selectedDay = null;

let masterVolume = parseFloat(localStorage.getItem(VOL_KEY));
if (isNaN(masterVolume)) masterVolume = 0.5;

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
   WIKIPEDIA & iTUNES BILD-LADEROUTINE
   --------------------------------------------------------- */
const WIKI_TITLES = {
  "Accept": "Accept_(band)",
  "Alestorm": "Alestorm",
  "All for Metal": "All_for_Metal",
  "Arch Enemy": "Arch_Enemy",
  "Bruce Dickinson": "Bruce_Dickinson",
  "Coppelius": "Coppelius",
  "Corvus Corax": "Corvus_Corax_(band)",
  "D'Artagnan": "DArtagnan_(band)",
  "Dust Bolt": "Dust_Bolt",
  "Eisbrecher": "Eisbrecher_(band)",
  "Emil Bulls": "Emil_Bulls",
  "Equilibrium": "Equilibrium_(band)",
  "Grave Digger": "Grave_Digger_(band)",
  "Gutalax": "Gutalax",
  "GWAR": "Gwar",
  "Lord of the Lost": "Lord_of_the_Lost",
  "Marduk": "Marduk_(band)",
  "Metal Church": "Metal_Church",
  "Nestor": "Nestor_(band)",
  "Setyøursails": "Setyøursails",
  "SKÁLD": "Skáld",
  "Storm Seeker": "Storm_Seeker",
  "Tankard": "Tankard_(band)",
  "The Sisters of Mercy": "The_Sisters_of_Mercy",
  "Turbobier": "Turbobier"
};

async function fetchWikiRestImage(title, lang = "en") {
  try {
    const encoded = encodeURIComponent(title);
    const url = `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encoded}`;
    const res = await fetch(url, { referrerPolicy: "no-referrer" });
    if (!res.ok) return null;
    const data = await res.json();
    return data.thumbnail?.source || data.originalimage?.source || null;
  } catch (err) {
    return null;
  }
}

async function fetchItunesCover(bandName) {
  try {
    const cleanBand = bandName.toLowerCase().normalize("NFKD").replace(/[^\w\s]/g, "").trim();
    const url = `https://itunes.apple.com/search?term=${encodeURIComponent(bandName)}&entity=song&limit=15&country=DE`;
    const res = await fetch(url, { signal: AbortSignal.timeout(3500) });
    const data = await res.json();
    
    const match = data.results.find(t => {
      const tArt = t.artistName.toLowerCase().normalize("NFKD").replace(/[^\w\s]/g, "").trim();
      return tArt.includes(cleanBand) || cleanBand.includes(tArt);
    });

    if (match && match.artworkUrl100) {
      return match.artworkUrl100.replace("100x100bb", "600x600bb"); 
    }
  } catch (e) {}
  return null;
}

async function getBandPhoto(band) {
  if (photoCache.has(band.id)) return photoCache.get(band.id);

  const title = WIKI_TITLES[band.name] || band.name.replace(/ /g, "_");
  let img = await fetchWikiRestImage(title, "en");
  
  if (!img) {
    const deTitle = band.name.replace(/ /g, "_");
    img = await fetchWikiRestImage(deTitle, "de");
  }
  
  if (!img) {
    try {
      const actionUrl = `https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(title)}&prop=pageimages&pithumbsize=800&format=json&origin=*&redirects=1`;
      const res = await fetch(actionUrl);
      if (res.ok) {
        const data = await res.json();
        const page = Object.values(data.query?.pages || {})[0];
        img = page?.thumbnail?.source || null;
      }
    } catch (e) {}
  }

  if (!img) {
    img = await fetchItunesCover(band.name);
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
      if (src) {
        imgEl.src = src;
      } else {
        imgEl.src = "assets/stag-skull-clean.png";
        imgEl.style.objectFit = "contain";
        imgEl.style.padding = "20px";
      }
    });
  });
}

/* ---------------------------------------------------------
   AUDIO ENGINE (EXAKTER SONG-MATCHING MODUS)
   --------------------------------------------------------- */
const cleanStr = val =>
  String(val || "")
    .toLowerCase()
    .replace(/ß/g, "ss")
    .replace(/[åäæ]/g, "a")
    .replace(/[øö]/g, "o")
    .replace(/[ü]/g, "u")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/['’´`]/g, "") 
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

function isSongMatch(track, band, song) {
  if (!track?.previewUrl?.startsWith("https://") && !track?.previewUrl?.startsWith("http://")) return false;
  
  const aWanted = cleanStr(band.name).replace(/^the /, "");
  const aTrack = cleanStr(track.artistName || track.artist?.name || "").replace(/^the /, "");
  const sWanted = cleanStr(song.title);
  const sTrack = cleanStr(track.trackName || track.title || "")
    .replace(/\s*(explicit|remaster(ed)?|radio edit|single version|album version|version|live)\s*/g, " ")
    .trim();

  const artistMatch = aTrack.includes(aWanted) || aWanted.includes(aTrack);
  // Strenger Song-Match: Der gesuchte Titel muss im Tracknamen vorkommen!
  const songMatch = sTrack.includes(sWanted) || sWanted.includes(sTrack);

  return artistMatch && songMatch;
}

function fetchDeezerJSONP(query) {
  return new Promise((resolve) => {
    const cb = 'dz_' + Date.now() + Math.floor(Math.random() * 10000);
    window[cb] = (data) => {
      delete window[cb];
      resolve(data);
    };
    const script = document.createElement('script');
    script.src = `https://api.deezer.com/search?q=${encodeURIComponent(query)}&output=jsonp&callback=${cb}`;
    script.onerror = () => resolve(null);
    document.body.appendChild(script);
    
    setTimeout(() => resolve(null), 3500);
  });
}

async function findStudioAudio(band, song) {
  const cacheKey = band.name + "|" + song.title;
  if (previewCache.has(cacheKey)) return previewCache.get(cacheKey);

  const nameRaw = band.name;
  const songRaw = song.title;
  const nameClean = band.name.replace(/å/gi, "a").replace(/Å/gi, "A").replace(/ø/gi, "o").replace(/Ø/gi, "O").replace(/ß/gi, "ss");
  const countries = ["DE", "NO", "SE", "US", "AT", "CH"];

  // 1. ITUNES EXAKTER SUCHLAUF ÜBER 6 LÄNDER
  for (const country of countries) {
    try {
      const url = `https://itunes.apple.com/search?term=${encodeURIComponent(`${nameRaw}${songRaw}`)}&entity=song&limit=30&country=${country}`;
      const res = await fetch(url, { signal: AbortSignal.timeout(2500) });
      if (!res.ok) continue;
      const data = await res.json();
      const match = data.results.find(t => isSongMatch(t, band, song));
      if (match) {
        previewCache.set(cacheKey, match);
        return match;
      }
    } catch (e) {}
  }

  // 2. DEEZER API EXAKTER SUCHLAUF
  try {
    let dzData = await fetchDeezerJSONP(`artist:"${nameClean}" track:"${songRaw}"`);
    if (dzData && dzData.data && dzData.data.length > 0) {
      const match = dzData.data.find(t => t.preview && isSongMatch({
        artistName: t.artist.name, 
        trackName: t.title, 
        previewUrl: t.preview
      }, band, song));

      if (match) {
        const mapped = { previewUrl: match.preview };
        previewCache.set(cacheKey, mapped);
        return mapped;
      }
    }
  } catch(e) {}

  // 3. DEEZER WEICHE SUCHE (Nur Songname + Bandname ohne Feldfilter)
  try {
    let dzData = await fetchDeezerJSONP(`${nameClean} ${songRaw}`);
    if (dzData && dzData.data && dzData.data.length > 0) {
      const match = dzData.data.find(t => t.preview && isSongMatch({
        artistName: t.artist.name, 
        trackName: t.title, 
        previewUrl: t.preview
      }, band, song));

      if (match) {
        const mapped = { previewUrl: match.preview };
        previewCache.set(cacheKey, mapped);
        return mapped;
      }
    }
  } catch(e) {}

  // Nichts gefunden -> Kein falsches Lied abspielen, sauberer Abbruch!
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
    if (playBtn) playBtn.innerHTML = "▶";
    if (stateText) stateText.textContent = "Pausiert";
    return;
  }

  if (currentSongIndex === index && currentAudio && currentAudio.paused) {
    try {
      currentAudio.volume = masterVolume;
      await currentAudio.play();
      row?.classList.add("playing");
      if (playBtn) playBtn.innerHTML = "⏸";
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
    if (btn) btn.innerHTML = "▶";
    if (st) st.textContent = "Hörprobe starten";
  });

  if (row) row.setAttribute("aria-busy", "true");
  if (stateText) stateText.textContent = "Suche Stream …";

  const track = await findStudioAudio(band, song);
  if (thisRequest !== playRequestId || activeBand !== band) return;

  if (row) row.removeAttribute("aria-busy");

  if (!track || !track.previewUrl) {
    if (stateText) stateText.textContent = "Hörprobe nicht verfügbar";
    if (playBtn) playBtn.innerHTML = "×";
    currentSongIndex = -1;
    return;
  }

  const audio = new Audio();
  audio.preload = "auto";
  audio.src = track.previewUrl;
  audio.volume = masterVolume;
  currentAudio = audio;

  audio.addEventListener("ended", () => {
    if (currentAudio !== audio) return;
    row?.classList.remove("playing");
    if (playBtn) playBtn.innerHTML = "▶";
    if (stateText) stateText.textContent = "Hörprobe beendet";
    currentSongIndex = -1;
  });

  audio.addEventListener("error", () => {
    if (currentAudio !== audio) return;
    row?.classList.remove("playing");
    if (playBtn) playBtn.innerHTML = "×";
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
    if (playBtn) playBtn.innerHTML = "⏸";
    if (stateText) stateText.textContent = "Hörprobe läuft";
  } catch (e) {
    if (stateText) stateText.textContent = "Klick nötig";
    if (playBtn) playBtn.innerHTML = "▶";
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
        <img data-img-band-id="${band.id}" src="assets/stag-skull-clean.png" alt="${band.name}" loading="lazy" referrerpolicy="no-referrer">
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
  if (resetBtn) resetBtn.classList.toggle("hidden", !isFilterActive);

  const baseFilter = band => {
    const matchQuery = band.name.toLowerCase().includes(query);
    const matchDay = selectedDay ? (band.day === selectedDay) : true;
    return matchQuery && matchDay;
  };

  const lineupBands = BANDS.filter(baseFilter);
  const favoriteBands = BANDS.filter(b => (status(b.id) === "must" || status(b.id) === "maybe") && baseFilter(b));
  const unratedBands = BANDS.filter(b => status(b.id) === "new" && baseFilter(b));

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

  if ($("mine-grid")) {
    $("mine-grid").innerHTML = favoriteBands.length
      ? favoriteBands.map(cardHTML).join("")
      : '<div style="grid-column: 1/-1; padding: 40px 10px; color: var(--rh-muted); text-align: center; line-height: 1.6;">Du hast noch keine Bands mit <strong>★ (Ja)</strong> oder <strong>◉ (Vielleicht)</strong> markiert.</div>';
  }

  if ($("unrated-grid")) {
    $("unrated-grid").innerHTML = unratedBands.length
      ? unratedBands.map(cardHTML).join("")
      : '<div style="grid-column: 1/-1; padding: 40px 10px; color: var(--rh-muted); text-align: center; line-height: 1.6;">Stark! Du hast bereits alle Bands bewertet. 🤘</div>';
  }

  loadCardPhotos();

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
  if (window.innerWidth <= 900) {
    $("detail-drawer").classList.add("hidden");
    const backdrop = $("drawer-backdrop");
    if (backdrop) backdrop.classList.add("hidden");
  }
}

function openBand(band) {
  if (!activeBand || activeBand.id !== band.id) {
    stopCurrentAudio();
    currentSongIndex = -1;
  }
  
  activeBand = band;

  $("detail-title").textContent = band.name;
  $("detail-genre").textContent = band.genre;
  $("detail-website").href = band.website;
  $("detail-desc").textContent = band.description;
  
  $("detail-drawer").classList.remove("hidden");
  if (window.innerWidth <= 900) {
    const backdrop = $("drawer-backdrop");
    if (backdrop) backdrop.classList.remove("hidden");
  }

  const detailImg = $("detail-img");
  detailImg.referrerPolicy = "no-referrer";
  getBandPhoto(band).then(src => {
    if (src) {
      detailImg.src = src;
      detailImg.style.objectFit = "cover";
      detailImg.style.padding = "0";
    } else {
      detailImg.src = "assets/stag-skull-clean.png";
      detailImg.style.objectFit = "contain";
      detailImg.style.padding = "20px";
    }
  });

  const currentStatus = status(band.id);
  $("detail-rating-btns").innerHTML = `
    <button data-rate="must" data-id="${band.id}" class="${currentStatus === 'must' ? 'active' : ''}">★ Ja</button>
    <button data-rate="maybe" data-id="${band.id}" class="${currentStatus === 'maybe' ? 'active' : ''}">◉ Vielleicht</button>
    <button data-rate="skip" data-id="${band.id}" class="${currentStatus === 'skip' ? 'active' : ''}">✕ Nein</button>
  `;

  $("detail-songs").innerHTML = band.songs.length
    ? band.songs.map((song, i) => {
        const isCurrentlyPlaying = (currentSongIndex === i && currentAudio && !currentAudio.paused);
        const stateStr = isCurrentlyPlaying ? "Hörprobe läuft" : (currentSongIndex === i ? "Pausiert" : "Hörprobe starten");
        const btnStr = isCurrentlyPlaying ? "⏸" : "▶";
        
        return `
        <div class="drawer-song-row ${isCurrentlyPlaying ? 'playing' : ''}" data-song-idx="${i}">
          <div class="song-skull-icon" aria-hidden="true"></div>
          <button class="song-play-btn" data-play="${i}" aria-label="${song.title} abspielen">${btnStr}</button>
          <div class="song-titles">
            <strong>${song.title}</strong>
            <small class="song-state-text">${stateStr}</small>
          </div>
          <div class="song-waveform">
            <span></span><span></span><span></span><span></span>
          </div>
          <span class="song-duration">0:30</span>
        </div>`;
      }).join("")
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
  
  // Rating-Buttons
  const rateBtn = e.target.closest("[data-rate]");
  if (rateBtn) {
    e.stopPropagation();
    e.preventDefault();
    
    const id = rateBtn.dataset.id;
    const clickedVal = rateBtn.dataset.rate;

    if (ratings[id] === clickedVal) {
      delete ratings[id];
    } else {
      ratings[id] = clickedVal;
    }

    persist();
    render();

    if (activeBand && activeBand.id === id) {
      const currentStatus = status(id);
      $("detail-rating-btns").innerHTML = `
        <button data-rate="must" data-id="${id}" class="${currentStatus === 'must' ? 'active' : ''}">★ Ja</button>
        <button data-rate="maybe" data-id="${id}" class="${currentStatus === 'maybe' ? 'active' : ''}">◉ Vielleicht</button>
        <button data-rate="skip" data-id="${id}" class="${currentStatus === 'skip' ? 'active' : ''}">✕ Nein</button>
      `;
    }
    return;
  }

  // Band-Auswahl
  const card = e.target.closest(".concept-card");
  if (card) {
    const bandId = card.dataset.bandId;
    if (activeBand && activeBand.id === bandId) {
      $("detail-drawer").classList.remove("hidden");
      if (window.innerWidth <= 900) {
        const backdrop = $("drawer-backdrop");
        if (backdrop) backdrop.classList.remove("hidden");
      }
      return; 
    }
    const band = BANDS.find(b => b.id === bandId);
    if (band) openBand(band);
    return;
  }

  // Audio abspielen
  const playBtn = e.target.closest("[data-play]");
  if (playBtn) {
    const idx = Number(playBtn.dataset.play);
    toggleSongPlay(idx);
    return;
  }

  // Logo Reset
  if (e.target.closest("#brand-reset")) {
    resetToAllBands();
    return;
  }

  // Navigation
  const nav = e.target.closest("[data-page]");
  if (nav) {
    if (nav.dataset.page === "lineup") {
      resetToAllBands();
    } else {
      navigate(nav.dataset.page);
    }
    return;
  }

  // Tagesfilter
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

/* LAUTSTÄRKEREGLER */
const volSlider = $("master-volume");
if (volSlider) {
  volSlider.value = masterVolume;
  volSlider.addEventListener("input", (e) => {
    masterVolume = parseFloat(e.target.value);
    localStorage.setItem(VOL_KEY, masterVolume.toString());
    if (currentAudio) {
      currentAudio.volume = masterVolume;
    }
  });
}

const resetViewBtn = $("reset-view-btn");
if (resetViewBtn) {
  resetViewBtn.onclick = resetToAllBands;
}

$("drawer-close-btn").onclick = closeDrawer;
const backdrop = $("drawer-backdrop");
if (backdrop) backdrop.onclick = closeDrawer;

$("desc-expand-btn").onclick = () => {
  const p = $("detail-desc");
  const isCollapsed = p.classList.toggle("desc-collapsed");
  $("desc-expand-btn").textContent = isCollapsed ? "Mehr anzeigen ∨" : "Weniger anzeigen ∧";
};

$("search").addEventListener("input", render);

/* ---------------------------------------------------------
   OFFLINE LINE-UP GENERATOR (QUERFORMAT PDF)
   --------------------------------------------------------- */
$("export").onclick = () => {
  const mustBands = BANDS.filter(b => status(b.id) === "must").sort((a,b) => a.name.localeCompare(b.name));
  const maybeBands = BANDS.filter(b => status(b.id) === "maybe").sort((a,b) => a.name.localeCompare(b.name));
  const restBands = BANDS.filter(b => status(b.id) !== "must" && status(b.id) !== "maybe").sort((a,b) => a.name.localeCompare(b.name));

  let html = `
    <div id="print-section" style="width: 100%; font-family: 'Barlow Condensed', 'Inter', sans-serif; color: #000; background: #fff; padding: 20px;">
      <h1 style="text-align: center; margin-top: 0; margin-bottom: 25px; text-transform: uppercase; font-size: 36px; border-bottom: 3px solid #000; padding-bottom: 10px;">
        ROCKHARZ 2027 — MEIN LINE-UP
      </h1>
  `;

  const renderGrid = (title, list, bgColor, borderColor, icon) => {
    if(!list.length) return "";
    let out = `
      <h2 style="margin-top: 30px; font-size: 22px; border-bottom: 2px solid ${borderColor}; padding-bottom: 5px; text-transform: uppercase;">
        ${icon} ${title} (${list.length})
      </h2>
      <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 15px; margin-top: 15px;">
    `;
    list.forEach(b => {
        out += `
          <div style="background: ${bgColor}; border: 1px solid ${borderColor}; padding: 12px; border-radius: 6px; page-break-inside: avoid;">
            <strong style="display: block; font-size: 18px; margin-bottom: 4px;">${b.name}</strong>
            <span style="font-size: 12px; color: #333;">${b.genre}</span>
          </div>
        `;
    });
    out += `</div>`;
    return out;
  };

  html += renderGrid("PFLICHT-BANDS", mustBands, "#ffebe6", "#e65a28", "★");
  html += renderGrid("VIELLEICHT", maybeBands, "#fff8e6", "#e5a455", "◉");
  html += renderGrid("RESTLICHES LINE-UP", restBands, "#f5f5f5", "#ccc", "◇");

  html += `</div>`;

  const printDiv = document.createElement("div");
  printDiv.id = "print-section";
  printDiv.innerHTML = html;
  document.body.appendChild(printDiv);
  
  window.print();
  document.body.removeChild(printDiv);
};

// Start
render();
if (window.innerWidth <= 900) {
  $("detail-drawer").classList.add("hidden");
  if (BANDS.length > 0) openBand(BANDS[0]);
  $("detail-drawer").classList.add("hidden");
  if (backdrop) backdrop.classList.add("hidden");
} else {
  if (BANDS.length > 0) openBand(BANDS[0]);
}

window.addEventListener("load", () => {
  window.scrollTo(0, 0);
});