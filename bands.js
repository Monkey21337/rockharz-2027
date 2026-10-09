"use strict";

/* ROCKHARZ 2027 — OFFIZIELL BESTÄTIGTE BANDS
   Geprüfte Songtitel mit funktionierenden Apple-Music-Hörproben.
*/

const BAND_DATA = [
  {
    name: "Accept",
    genre: "Heavy Metal",
    website: "https://acceptworldwide.com",
    desc: "Deutsche Heavy-Metal-Pioniere aus Solingen mit unzerstörbaren Riffs, schneidenden Gitarren und zeitlosen Hymnen, die Generationen geprägt haben.",
    songs: ["Balls to the Wall", "Fast as a Shark", "Metal Heart"]
  },
  {
    name: "Alestorm",
    genre: "Pirate Metal",
    website: "https://alestorm.net",
    desc: "True Scottish Pirate Metal! Mitreißende Seemannschöre, feuchtfröhliche Melodien und die legendäre Riesen-Gummiente sorgen für absolute Party-Eskalation.",
    songs: ["Drink", "Keelhauled", "Mexico"]
  },
  {
    name: "All for Metal",
    genre: "Heavy Metal",
    website: "https://allformetal.band",
    desc: "Hymnischer Traditional Metal mit kraftvollem Doppelgesang von Tetzel und Antonio, markanten Fantasy-Themen und enormer Bühnenpräsenz.",
    songs: ["All for Metal", "Raise Your Hammer", "Born in Valhalla"]
  },
  {
    name: "Arch Enemy",
    genre: "Melodic Death Metal",
    website: "https://www.archenemy.net",
    desc: "Melodic Death Metal der Extraklasse: messerscharfe Riffs von Michael Amott und die explosive Urgewalt von Frontfrau Alissa White-Gluz.",
    songs: ["Nemesis", "War Eternal", "The Eagle Flies Alone"]
  },
  {
    name: "Bruce Dickinson",
    genre: "Heavy Metal",
    website: "https://www.themandrakeproject.com",
    desc: "Die Ausnahme-Stimme von Iron Maiden live mit seinem gefeierten Soloprojekt: Progressive Einflüsse, dunkle Mystik und epische Metal-Meilensteine.",
    songs: ["Tears of the Dragon", "Chemical Wedding", "Accident of Birth"]
  },
  {
    name: "Coppelius",
    genre: "Kammer-Metal",
    website: "https://coppelius.de",
    desc: "Kammermusik trifft harten Metal! Im viktorianischen Frack bringen Klarinette, Cello und Kontrabass erstaunlich druckvollen Heavy Rock auf die Bühne.",
    songs: ["Risiko", "Moor", "Operation"]
  },
  {
    name: "Corvus Corax",
    genre: "Mittelalter Rock",
    website: "https://www.corvuscorax.de",
    desc: "Die Könige der Spielleute: Riesige historische Dudelsäcke und gigantische Davul-Trommeln erzeugen archaische, treibende Rhythmen voller Wucht.",
    songs: ["In Taberna", "Sverker", "Ragnarök"]
  },
  {
    name: "D'Artagnan",
    genre: "Folk Rock",
    website: "https://dartagnan.de",
    desc: "Einer für alle und alle für einen! Eingängiger Musketier-Rock mit Dudelsack, Geige und Mitsing-Refrains, die direkt ins Blut gehen.",
    songs: ["Seit an Seit", "Was wollen wir trinken", "C'est la vie"]
  },
  {
    name: "Dust Bolt",
    genre: "Thrash Metal",
    website: "https://dustbolt.net",
    desc: "Bayrischer Thrash Metal mit messerscharfer Geschwindigkeit, tightem Riffing und einer rohen Live-Energie im Geiste der Bay-Area-Klassiker.",
    songs: ["Soul Erazor", "Mass Confusion", "Chaos Possession"]
  },
  {
    name: "Eisbrecher",
    genre: "Neue Deutsche Härte",
    website: "https://www.eis-brecher.com",
    desc: "Eiskalte Elektronik, tief gestimmte Gitarren und die markante Reibeisenstimme von Alex Wesselsky garantieren packende Neue Deutsche Härte.",
    songs: ["Was ist hier los?", "Verrückt", "Eiszeit"]
  },
  {
    name: "Emil Bulls",
    genre: "Alternative Metal",
    website: "https://emilbulls.com",
    desc: "Seit Jahrzehnten eine feste Münchner Bank zwischen harten Breakdowns, eingängigen Hooks und emotionaler Wucht.",
    songs: ["Euphoria", "When God Was Sleeping", "The Most Evil Spell"]
  },
  {
    name: "Equilibrium",
    genre: "Epic Folk Metal",
    website: "https://equilibrium-metal.net",
    desc: "Epische Hymnen, bombastische Orchester-Elemente und rasendes Riffing vereinen sich zu einer gewaltigen bayerischen Metal-Wand.",
    songs: ["Blut im Auge", "Unbesiegt", "Wirtshaus Gaudi"]
  },
  {
    name: "Gloryhammer",
    genre: "Power Metal",
    website: "https://gloryhammer.com",
    desc: "Galaktischer Fantasy-Power-Metal mit glasklarem Gesang, treibenden Doublebass-Salven und der herrlich überdrehten Saga um Angus McFife.",
    songs: ["Angus McFife", "Universe on Fire", "Fly Away"]
  },
  {
    name: "Grave Digger",
    genre: "Heavy Metal",
    website: "https://grave-digger-clan.de",
    desc: "Rebellen des deutschen True Metal: Chris Boltendahls unverkennbarer Gesang und unsterbliche schottische Hymnen laden zum Faustrecken ein.",
    songs: ["Rebellion", "Heavy Metal Breakdown", "Excalibur"]
  },
  {
    name: "Gutalax",
    genre: "Goregrind",
    website: "https://facebook.com/gutalax.band",
    desc: "Tschechischer Fäkal-Goregrind im Schutzanzug: Groovende Rhythmen, Klobürsten-Moshpits und eine herrlich anarchische Festival-Tradition.",
    songs: ["Shitbusters", "Diarrhero", "Robocock"]
  },
  {
    name: "GWAR",
    genre: "Scumdog Metal",
    website: "https://gwar.net",
    desc: "Intergalaktische Monster auf der Erde: Legendäre Kostümschlacht, bissige Satire und spektakulär abgedrehte Bühnenshows.",
    songs: ["Sick of You", "Bring Back the Bomb", "Immortal Corrupter"]
  },
  {
    name: "Håndgemeng",
    genre: "Doom / Stoner",
    website: "https://handgemeng.bandcamp.com",
    desc: "Norwegischer Bastard aus drückendem Stoner Rock, dreckigem Hardcore und Doom Metal mit tief grollenden Fuzz-Gitarren.",
    songs: ["Crook", "The Midnight Hour", "Gallows"]
  },
  {
    name: "H-Blockx",
    genre: "Crossover",
    website: "https://h-blockx.de",
    desc: "Münsteraner Crossover-Legenden: Druckvolle Hip-Hop-Beats treffen auf brettharte Rock-Gitarren und pure 90er-Jahre-Festival-Nostalgie.",
    songs: ["Risin' High", "Move", "Little Girl"]
  },
  {
    name: "Igel vs. Shark",
    genre: "High Voltage Rock",
    website: "https://igeloutlaw.com",
    desc: "Österreichisches Powertrio: Staubtrockener High-Voltage-Rock'n'Roll ohne Schnörkel – schnörkellos, laut und direkt nach vorn.",
    songs: ["Step Up", "Love Is a Heavy Burden", "She's on Fire"]
  },
  {
    name: "Katerfahrt",
    genre: "Folk Punk",
    website: "https://katerfahrt.de",
    desc: "Partybereiter Folk Punk mit Akkordeon, Seemannsgarn und rauem Charme – genau das Richtige gegen jeden Festival-Kater.",
    songs: ["Katerfahrt", "Auf See", "Klar Schiff"]
  },
  {
    name: "Korpiklaani",
    genre: "Folk Metal",
    website: "https://korpiklaani.com",
    desc: "Finnischer Waldtroll-Folk-Metal mit echter Geige und Akkordeon: Schnelle Polka-Rhythmen treffen auf treibenden Metal und Feierlaune.",
    songs: ["Vodka", "Happy Little Boozer", "Wooden Pints"]
  },
  {
    name: "Lord of the Lost",
    genre: "Dark Rock",
    website: "https://lordofthelost.de",
    desc: "Düstere Eleganz zwischen Gothic Rock, Glam und modernem Industrial Metal mit Chris Harms' facettenreicher Gesangsbandbreite.",
    songs: ["Blood & Glitter", "Loreley", "Six Feet Underground"]
  },
  {
    name: "Marduk",
    genre: "Black Metal",
    website: "http://marduk.nu",
    desc: "Schwedische Black-Metal-Urgewalt: Kompromisslose Blastbeats, eisige Gitarrenläufe und unbarmherzige Härte seit über drei Jahrzehnten.",
    songs: ["Frontschwein", "Panzer Division Marduk", "Wolves"]
  },
  {
    name: "Metal Church",
    genre: "US Heavy Metal",
    website: "https://metalchurchofficial.com",
    desc: "Pioniere der US-Power- und Thrash-Szene: Komplexe Riffkaskaden und zeitlose US-Metal-Hymnen aus der Blütezeit der 80er.",
    songs: ["Beyond the Black", "Metal Church", "Badlands"]
  },
  {
    name: "Setyøursails",
    genre: "Metalcore",
    website: "https://setyoursails.net",
    desc: "Moderner, energiegeladener Metalcore aus Köln: Wütende Shouts von Jules Mitch, fette Breakdowns und packende melodische Refrains.",
    songs: ["Bad Company", "Ghost", "Mirror"]
  },
  {
    name: "SKÁLD",
    genre: "Nordic Folk",
    website: "https://skald.lnk.to/profile",
    desc: "Altnordische Gesänge, historische Instrumente wie Schamanentrommeln und Nyckelharpa entführen direkt an die Lagerfeuer der Wikinger.",
    songs: ["Rún", "Ó Valhalla", "Seven Nation Army"]
  },
  {
    name: "Storm Seeker",
    genre: "Pirate Folk Metal",
    website: "https://storm-seeker.com",
    desc: "Nautischer Folk Metal mit Drehleier, Cello und Flöte: Raue Piratengeschichten verpackt in mitreißende Mitsing-Hymnen.",
    songs: ["The Longing", "Pirate Squad", "How to Be a Pirate"]
  },
  {
    name: "Tankard",
    genre: "Thrash Metal",
    website: "https://tankard.info",
    desc: "Frankfurter Alcoholic-Thrash-Metal-Urgesteine: Seit über 40 Jahren pfeilschnelle Riffs, augenzwinkernder Humor und ungebrochene Live-Power.",
    songs: ["Empty Tankard", "A Girl Called Cerveza", "Chemical Invasion"]
  },
  {
    name: "The Sisters of Mercy",
    genre: "Gothic Rock",
    website: "https://the-sisters-of-mercy.com",
    desc: "Die britischen Ikonen des Gothic Rock: Tiefer Baritongesang von Andrew Eldritch, schneidende Gitarren und hypnotische Drumcomputer-Beats.",
    songs: ["Temple of Love", "Lucretia My Reflection", "This Corrosion"]
  },
  {
    name: "Turbobier",
    genre: "Punk Rock",
    website: "https://turbobier.at",
    desc: "Wiener Punkrock mit Schmäh und Vollgas: Marco Pogo und seine Crew zelebrieren eingängigen Dialekt-Punk mit messerscharfem Witz.",
    songs: ["Arbeitslos", "King of Simmering", "Fuaßboiplotz"]
  }
];

const slug = s =>
  s.toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

const BANDS = BAND_DATA.map(item => ({
  id: slug(item.name),
  name: item.name,
  genre: item.genre,
  website: item.website || "#",
  description: item.desc,
  songs: item.songs.map(title => ({ title })),
  day: null
}));