"use strict";

/* ROCKHARZ 2027 — OFFIZIELLE BANDS (BANDWELLE 1)
   day bleibt null, bis die Running Order offiziell bestätigt ist.
   Bestätigte Tageswerte: "wed" (Mi), "thu" (Do), "fri" (Fr), "sat" (Sa).
*/

const BAND_DATA = [
  {
    name: "Accept", genre: "Heavy Metal", website: "https://acceptworldwide.com",
    desc: "Deutsche Heavy-Metal-Pioniere aus Solingen mit unzerstörbaren Riffs und zeitlosen Hymnen.",
    songs: ["Balls to the Wall", "Fast as a Shark", "Metal Heart"],
    day: null
  },
  {
    name: "Alestorm", genre: "Pirate Metal", website: "https://alestorm.net",
    desc: "True Scottish Pirate Metal! Mitreißende Seemannschöre und die legendäre Riesen-Gummiente.",
    songs: ["Drink", "Keelhauled", "Mexico"],
    day: null
  },
  {
    name: "All for Metal", genre: "Heavy Metal", website: "https://allformetal.band",
    desc: "Hymnischer Traditional Metal mit kraftvollem Doppelgesang von Tetzel und Antonio.",
    songs: ["All for Metal", "Raise Your Hammer", "Born in Valhalla"],
    day: null
  },
  {
    name: "Arch Enemy", genre: "Melodic Death Metal", website: "https://www.archenemy.net",
    desc: "Speerspitze des Melodic Death Metal – jetzt mit Frontfrau Lauren Hart (ex-Once Human) und brachialen Riffs.",
    songs: ["Nemesis", "War Eternal", "The Eagle Flies Alone"],
    day: null
  },
  {
    name: "Bruce Dickinson", genre: "Heavy Metal", website: "https://www.themandrakeproject.com",
    desc: "Die Ausnahme-Stimme von Iron Maiden live mit seinem gefeierten Soloprojekt.",
    songs: ["Tears of the Dragon", "Chemical Wedding", "Accident of Birth"],
    day: null
  },
  {
    name: "Coppelius", genre: "Kammer-Metal", website: "https://coppelius.de",
    desc: "Kammermusik trifft harten Metal! Im viktorianischen Frack bringen sie druckvollen Heavy Rock auf die Bühne.",
    songs: ["Risiko", "Moor", "Operation"],
    day: null
  },
  {
    name: "Corvus Corax", genre: "Mittelalter Rock", website: "https://www.corvuscorax.de",
    desc: "Die Könige der Spielleute: Riesige historische Dudelsäcke und gigantische Davul-Trommeln.",
    songs: ["Sverker", "In Taberna", "Ragnarök"],
    day: null
  },
  {
    name: "D'Artagnan", genre: "Folk Rock", website: "https://dartagnan.de",
    desc: "Eingängiger Musketier-Rock mit Dudelsack, Geige und Mitsing-Refrains.",
    songs: ["Seit an Seit", "Was wollen wir trinken", "C'est la vie"],
    day: null
  },
  {
    name: "Dust Bolt", genre: "Thrash Metal", website: "https://dustbolt.net",
    desc: "Bayrischer Thrash Metal mit messerscharfer Geschwindigkeit und roher Live-Energie.",
    songs: ["Soul Erazor", "Mass Confusion", "Chaos Possession"],
    day: null
  },
  {
    name: "Eisbrecher", genre: "Neue Deutsche Härte", website: "https://www.eis-brecher.com",
    desc: "Eiskalte Elektronik, tief gestimmte Gitarren und die markante Reibeisenstimme von Alex Wesselsky.",
    songs: ["Was ist hier los?", "Verrückt", "Eiszeit"],
    day: null
  },
  {
    name: "Emil Bulls", genre: "Alternative Metal", website: "https://emilbulls.com",
    desc: "Münchner Alternative Metal zwischen harten Breakdowns und eingängigen Hooks.",
    songs: ["Euphoria", "When God Was Sleeping", "The Most Evil Spell"],
    day: null
  },
  {
    name: "Equilibrium", genre: "Epic Folk Metal", website: "https://equilibrium-metal.net",
    desc: "Epische Hymnen und rasendes Riffing vereinen sich zu einer gewaltigen Metal-Wand.",
    songs: ["Blut im Auge", "Unbesiegt", "Wirtshaus Gaudi"],
    day: null
  },
  {
    name: "Grave Digger", genre: "Heavy Metal", website: "https://grave-digger-clan.de",
    desc: "Rebellen des deutschen True Metal mit unsterblichen schottischen Hymnen.",
    songs: ["Rebellion", "Heavy Metal Breakdown", "Excalibur"],
    day: null
  },
  {
    name: "Gutalax", genre: "Goregrind", website: "https://facebook.com/gutalax.band",
    desc: "Tschechischer Fäkal-Goregrind: Groovende Rhythmen und Klobürsten-Moshpits.",
    songs: ["Shitbusters", "Diarrhero", "Robocock"],
    day: null
  },
  {
    name: "GWAR", genre: "Scumdog Metal", website: "https://gwar.net",
    desc: "Intergalaktische Monster auf der Erde: Bissige Satire und spektakulär abgedrehte Bühnenshows.",
    songs: ["Sick of You", "Bring Back the Bomb", "Immortal Corrupter"],
    day: null
  },
  {
    name: "Håndgemeng", genre: "Doom / Stoner", website: "https://handgemeng.bandcamp.com",
    desc: "Norwegischer Bastard aus drückendem Stoner Rock und Doom Metal.",
    songs: ["The Sundrinker", "The Cauldron Born", "Medieval Knievel"],
    day: null
  },
  {
    name: "H-Blockx", genre: "Crossover", website: "https://h-blockx.de",
    desc: "Crossover-Legenden: Hip-Hop-Beats treffen auf brettharte Rock-Gitarren.",
    songs: ["Risin' High", "Move", "Little Girl"],
    day: null
  },
  {
    name: "Igel vs. Shark", genre: "High Voltage Rock", website: "https://igeloutlaw.com",
    desc: "Staubtrockener High-Voltage-Rock'n'Roll ohne Schnörkel – laut und direkt nach vorn.",
    songs: ["She's on Fire", "Don't Steal My Thunder", "Set This Town on Fire"],
    day: null
  },
  {
    name: "Katerfahrt", genre: "Folk Punk", website: "https://katerfahrt.de",
    desc: "Partybereiter Folk Punk mit Akkordeon und rauem Charme – genau das Richtige gegen jeden Kater.",
    songs: ["Katerfahrt", "Volle Fahrt Voraus!", "Der Grog und Du"],
    day: null
  },
  {
    name: "Korpiklaani", genre: "Folk Metal", website: "https://korpiklaani.com",
    desc: "Finnischer Waldtroll-Folk-Metal mit Polka-Rhythmen und purer Feierlaune.",
    songs: ["Vodka", "Happy Little Boozer", "Wooden Pints"],
    day: null
  },
  {
    name: "Lord of the Lost", genre: "Dark Rock", website: "https://lordofthelost.de",
    desc: "Düstere Eleganz zwischen Gothic Rock, Glam und modernem Industrial Metal.",
    songs: ["Blood & Glitter", "Loreley", "Six Feet Underground"],
    day: null
  },
  {
    name: "Marduk", genre: "Black Metal", website: "http://marduk.nu",
    desc: "Schwedische Black-Metal-Urgewalt: Kompromisslose Blastbeats und eisige Gitarrenläufe.",
    songs: ["Frontschwein", "Panzer Division Marduk", "Wolves"],
    day: null
  },
  {
    name: "Metal Church", genre: "US Heavy Metal", website: "https://metalchurchofficial.com",
    desc: "Pioniere der US-Power- und Thrash-Szene mit zeitlosen Metal-Hymnen.",
    songs: ["Beyond the Black", "Metal Church", "Badlands"],
    day: null
  },
  {
    name: "Nestor", genre: "AOR / Hard Rock", website: "https://nestortheband.com",
    desc: "Purer 80s-Arena-Rock aus Schweden mit großen Melodien und Synthesizern.",
    songs: ["On the Run", "1989", "Perfect 10 (Eyes Like Demi Moore)"],
    day: null
  },
  {
    name: "Setyøursails", genre: "Metalcore", website: "https://setyoursails.net",
    desc: "Moderner, energiegeladener Metalcore aus Köln mit wütenden Shouts und fetten Breakdowns.",
    songs: ["Bad Company", "Ghost", "Mirror"],
    day: null
  },
  {
    name: "SKÁLD", genre: "Nordic Folk", website: "https://skald.lnk.to/profile",
    desc: "Altnordische Gesänge und historische Instrumente wie Schamanentrommeln.",
    songs: ["Rún", "Gleipnir", "Grótti"],
    day: null
  },
  {
    name: "Storm Seeker", genre: "Pirate Folk Metal", website: "https://storm-seeker.com",
    desc: "Nautischer Folk Metal mit Drehleier, Cello und mitreißenden Mitsing-Hymnen.",
    songs: ["The Longing", "Pirate Squad", "How to Be a Pirate"],
    day: null
  },
  {
    name: "Tankard", genre: "Thrash Metal", website: "https://tankard.info",
    desc: "Frankfurter Alcoholic-Thrash-Metal-Urgesteine mit pfeilschnellen Riffs.",
    songs: ["Zombie Attack", "A Girl Called Cerveza", "Chemical Invasion"],
    day: null
  },
  {
    name: "The Sisters of Mercy", genre: "Gothic Rock", website: "https://the-sisters-of-mercy.com",
    desc: "Die britischen Ikonen des Gothic Rock mit dem tiefen Baritongesang von Andrew Eldritch.",
    songs: ["Temple of Love", "Lucretia My Reflection", "This Corrosion"],
    day: null
  },
  {
    name: "Turbobier", genre: "Punk Rock", website: "https://turbobier.at",
    desc: "Wiener Punkrock mit Schmäh und Vollgas.",
    songs: ["Arbeitslos", "King of Simmering", "Fuaßboiplotz"],
    day: null
  }
];

const ORIGINS = {
  "Accept": "Deutschland", "Alestorm": "Schottland", "All for Metal": "Deutschland / Italien",
  "Arch Enemy": "Schweden", "Bruce Dickinson": "Großbritannien", "Coppelius": "Deutschland",
  "Corvus Corax": "Deutschland", "D'Artagnan": "Deutschland", "Dust Bolt": "Deutschland",
  "Eisbrecher": "Deutschland", "Emil Bulls": "Deutschland", "Equilibrium": "Deutschland",
  "Grave Digger": "Deutschland", "Gutalax": "Tschechien", "GWAR": "USA",
  "Håndgemeng": "Norwegen", "H-Blockx": "Deutschland", "Igel vs. Shark": "Deutschland",
  "Katerfahrt": "Deutschland", "Korpiklaani": "Finnland",
  "Lord of the Lost": "Deutschland", "Marduk": "Schweden", "Metal Church": "USA",
  "Nestor": "Schweden", "Setyøursails": "Deutschland", "SKÁLD": "Frankreich",
  "Storm Seeker": "Deutschland", "Tankard": "Deutschland",
  "The Sisters of Mercy": "Großbritannien", "Turbobier": "Österreich"
};

// ø/å/æ/ß zerfallen bei normalize() nicht – vorher ersetzen ("Setyøursails" -> "setyoursails")
const slug = s =>
  s.toLowerCase()
    .replace(/ø/g, "o").replace(/å/g, "a").replace(/æ/g, "ae").replace(/œ/g, "oe").replace(/ß/g, "ss")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

const BANDS = BAND_DATA.map(item => ({
  id: slug(item.name),
  name: item.name,
  genre: item.genre,
  origin: ORIGINS[item.name] || "",
  website: item.website || "#",
  description: item.desc,
  songs: item.songs.map(title => ({ title })),
  day: item.day || null
}));
