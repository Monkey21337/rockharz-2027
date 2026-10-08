'use strict';

const BAND_NAMES = [
  "Accept", "Alestorm", "All for Metal", "Amon Amarth", "Arch Enemy",
  "Bruce Dickinson", "Coppelius", "D'Artagnan", "Dust Bolt", "Eisbrecher",
  "Emil Bulls", "Equilibrium", "Grave Digger", "Gutalax", "GWAR",
  "Håndgemeng", "H-Blockx", "Igel vs. Shark", "Katerfahrt", "Korpiklaani",
  "Lord of the Lost", "Marduk", "Metal Church", "Nestor", "Setyøursails",
  "SKÁLD", "Storm Seeker", "Tankard", "The Sisters of Mercy", "Turbobier"
];

const SONGS = {
  "Accept": ["Balls to the Wall", "Fast as a Shark", "Metal Heart"],
  "Alestorm": ["P.A.R.T.Y.", "Keelhauled", "Mexico"],
  "All for Metal": ["All for Metal", "Raise Your Hammer", "Born in Valhalla"],
  "Amon Amarth": ["Twilight of the Thunder God", "The Pursuit of Vikings", "Guardians of Asgaard"],
  "Arch Enemy": ["Nemesis", "Handshake with Hell", "The Eagle Flies Alone"],
  "Bruce Dickinson": ["Tears of the Dragon", "Chemical Wedding", "Accident of Birth"],
  "Coppelius": ["Risiko", "Moor", "Operation"],
  "D'Artagnan": ["Seit an Seit", "Was wollen wir trinken", "C'est la vie"],
  "Dust Bolt": ["Soul Erazor", "Turned to Grey", "Chaos Possession"],
  "Eisbrecher": ["Was ist hier los?", "Verrückt", "Eiszeit"],
  "Emil Bulls": ["Euphoria", "When God Was Sleeping", "The Most Evil Spell"],
  "Equilibrium": ["Blut im Auge", "Unbesiegt", "Wirtshaus Gaudi"],
  "Grave Digger": ["Rebellion (The Clans Are Marching)", "Heavy Metal Breakdown", "Excalibur"],
  "Gutalax": ["Shitbusters", "Diarrhero", "Robocock"],
  "GWAR": ["Gor-Gor", "GWAR Theme", "Immortal Corrupter"],
  "Håndgemeng": ["The Astronomer", "Medieval Knievel", "The Sundrinker"],
  "Igel vs. Shark": ["Set This Town on Fire", "500,000 Miles", "Rock n Roll Bomb"],
  "Katerfahrt": ["Piratenpogo", "Seemannsgarn", "Partyraten"],
  "Setyøursails": ["Bad Blood", "Nightfall", "Best of Me"],
  "H-Blockx": ["Risin' High", "Move", "Little Girl"],
  "Korpiklaani": ["Vodka", "Happy Little Boozer", "Wooden Pints"],
  "Lord of the Lost": ["Blood & Glitter", "Loreley", "Drag Me to Hell"],
  "Marduk": ["The Blond Beast", "Frontschwein", "Werwolf"],
  "Metal Church": ["Beyond the Black", "Metal Church", "Badlands"],
  "Nestor": ["On the Run", "1989", "Perfect 10 (Eyes Like Demi Moore)"],
  "SKÁLD": ["Rún", "Ó Valhalla", "Seven Nation Army"],
  "Storm Seeker": ["The Longing", "Pirate Squad", "How to Be a Pirate"],
  "Tankard": ["Empty Tankard", "A Girl Called Cerveza", "Chemical Invasion"],
  "The Sisters of Mercy": ["Temple of Love (1992)", "Lucretia My Reflection", "This Corrosion"],
  "Turbobier": ["Arbeitslos durch den Tag", "King of Simmering", "Fuaßboiplotz"]
};

const BAND_DESCRIPTIONS = {
  "Accept": "Deutscher Heavy Metal mit kantigen Riffs, markanten Gitarrensoli und Hymnen wie „Balls to the Wall“. Ein Klassiker für alle, die Metal schnörkellos und kraftvoll mögen.",
  "Alestorm": "Schottischer Piratenmetal zwischen harten Gitarren, Folk-Melodien und trinkfesten Mitsing-Refrains. Hier treffen Seeräuberhumor und ausgelassene Festivalenergie aufeinander.",
  "All for Metal": "Hymnischer Heavy und Power Metal mit großen Chören, druckvollen Riffs und heroischen Motiven. Der Sound setzt auf Gemeinschaftsgefühl und eingängige Refrains.",
  "Amon Amarth": "Schwedischer Melodic Death Metal mit tiefen Growls, mächtigen Gitarrenmelodien und Geschichten aus der nordischen Sagenwelt. Episch, wuchtig und wie geschaffen fürs gemeinsame Headbangen.",
  "Arch Enemy": "Melodic Death Metal aus Schweden: aggressive Vocals treffen auf virtuose Gitarrenarbeit und melodische Leads. Die Songs verbinden Härte mit sofort erkennbaren Hooks.",
  "Bruce Dickinson": "Der Iron-Maiden-Sänger zeigt solo seine eigene Mischung aus klassischem Heavy Metal, dramatischen Melodien und progressiven Akzenten. Seine markante Stimme steht auch hier im Mittelpunkt.",
  "Coppelius": "Kammermusik trifft Metal: Klarinetten, Cello und Kontrabass sorgen für einen ungewöhnlich schweren Sound. Dazu kommen deutschsprachige Geschichten und eine theatralische Ästhetik.",
  "D'Artagnan": "Deutschsprachiger Folk Rock mit Musketierromantik, Dudelsackklängen und kräftigen Mitsing-Hymnen. Abenteuer, Freundschaft und Feierlaune prägen die Songs.",
  "Dust Bolt": "Deutscher Thrash Metal mit schnellen Riffs, kompromisslosem Groove und rauer Energie. Zwischen klassischer Thrash-Attacke und modernen Rock-Einflüssen bleibt der Sound direkt und druckvoll.",
  "Eisbrecher": "Neue Deutsche Härte mit tiefem Gesang, präzisen Gitarrenriffs und elektronischen Beats. Deutschsprachige Texte und ein kühler Industrial-Sound geben den Songs ihren charakteristischen Druck.",
  "Emil Bulls": "Alternative Metal aus München mit einer Mischung aus schweren Gitarren, melodischen Refrains und aggressiven Ausbrüchen. Eingängigkeit und Energie gehen hier Hand in Hand.",
  "Equilibrium": "Deutscher Folk Metal mit epischen Melodien, rauen Vocals und modernen Klangfarben. Zwischen Fantasy, Naturmotiven und Feierlaune entstehen vielschichtige, mitreißende Songs.",
  "Grave Digger": "Deutscher Heavy und Power Metal mit rauem Gesang, geradlinigen Riffs und historischen Erzählungen. Besonders die schottischen Themen und großen Refrains sind zu Markenzeichen geworden.",
  "Gutalax": "Tschechischer Goregrind mit extrem tiefen Vocals, kurzen Songs und stampfenden Rhythmen. Der bewusst groteske Humor macht daraus eine ungewöhnlich ausgelassene Extrem-Metal-Party.",
  "GWAR": "US-amerikanischer Metal mit grotesken Monsterfiguren und satirischem Science-Fiction-Humor. Thrash- und Punk-Einflüsse liefern den Soundtrack zu ihrem theatralischen Universum.",
  "Håndgemeng": "Norwegischer Stoner und Sludge Metal mit schweren Fuzz-Riffs, rauer Stimme und Rock-’n’-Roll-Groove. Ihr „Doom’n’Roll“ verbindet düstere Wucht mit ungebändigter Energie.",
  "H-Blockx": "Crossover-Rock aus Münster mit funkigen Grooves, Rap-Einflüssen und kräftigen Gitarren. Songs wie „Risin’ High“ und „Move“ verbinden Bewegung, Melodie und Rockdruck.",
  "Igel vs. Shark": "Österreichisches Rocktrio mit direktem Gitarrensound, treibenden Rhythmen und rauem Rock-’n’-Roll-Charme. Die Songs setzen auf Energie, eingängige Hooks und wenig Schnickschnack.",
  "Katerfahrt": "Deutschsprachiger Piraten-Folk-Rock mit Seefahrtsgeschichten und Partystimmung. Mitsing-Refrains und tanzbare Melodien verwandeln den Auftritt gedanklich in eine Hafenschenke.",
  "Korpiklaani": "Finnischer Folk Metal mit Geige, Akkordeon und kernigen Gitarren. Traditionelle Melodien, Naturgeschichten und ausgelassene Trinkhymnen laden zum Tanzen ein.",
  "Lord of the Lost": "Dark Rock und Gothic Metal aus Hamburg mit elektronischen Elementen und dramatischen Melodien. Dunkle Atmosphäre und eingängige Refrains verbinden sich zu einem theatralischen Sound.",
  "Marduk": "Schwedischer Black Metal mit rasenden Blastbeats, schneidenden Riffs und erbarmungsloser Intensität. Die Songs setzen auf dunkle Atmosphäre und kompromisslose Härte.",
  "Metal Church": "US-amerikanischer Heavy Metal mit deutlicher Thrash-Kante, markanten Riffs und kraftvollem Gesang. Klassische Metal-Melodien treffen auf einen dunklen, druckvollen Sound.",
  "Nestor": "Schwedischer Hard Rock mit dem Gefühl der Achtziger: große Melodien, warme Keyboards und glänzende Gitarrensoli. Ideal für Fans von hymnischen Refrains und klassischem Arena-Rock.",
  "Setyøursails": "Moderner Metalcore aus Deutschland mit heftigen Breakdowns, aggressiven Screams und melodischen Refrains. Emotionale Songs wechseln zwischen verletzlichen Momenten und voller Wucht.",
  "SKÁLD": "Nordisch geprägte Folk-Musik mit mehrstimmigem Gesang, traditionellen Klangfarben und mächtigen Rhythmen. Mythologische Motive und altnordische Texte schaffen eine archaische Atmosphäre.",
  "Storm Seeker": "Piraten-Folk-Metal mit Cello, Drehleier, schweren Gitarren und eingängigen Melodien. Maritime Geschichten und tanzbare Rhythmen treffen auf kräftigen Metal-Sound.",
  "Tankard": "Frankfurter Thrash Metal mit schnellen Riffs, rauem Gesang und viel Bierhumor. Unter der Feierlaune steckt geradliniger, energischer Thrash mit langjähriger Tradition.",
  "The Sisters of Mercy": "Britischer Gothic Rock mit tiefem Gesang, markanten Basslinien und treibenden Drumcomputer-Beats. Dunkle Klangflächen und große Melodien machen den Sound unverwechselbar.",
  "Turbobier": "Österreichischer Punk Rock mit Wiener Schmäh, rauem Gesang und direkter Sprache. Eingängige Refrains und rotziger Humor sorgen für reichlich Mitsing- und Pogo-Potenzial."
};

// Vorläufige Slot-Einträge für den Zeitplan (Donnerstag, Freitag, Samstag)
const SCHEDULE_DATA = {
  "Arch Enemy": { day: "Donnerstag", start: "20:30", end: "21:40", stage: "Dark Stage" },
  "Accept": { day: "Donnerstag", start: "21:45", end: "23:00", stage: "Rock Stage" },
  "Eisbrecher": { day: "Freitag", start: "20:30", end: "21:40", stage: "Dark Stage" },
  "Alestorm": { day: "Freitag", start: "21:45", end: "23:00", stage: "Rock Stage" },
  "Lord of the Lost": { day: "Samstag", start: "20:45", end: "21:55", stage: "Dark Stage" },
  "Bruce Dickinson": { day: "Samstag", start: "22:00", end: "23:30", stage: "Rock Stage" }
};

const slug = s => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// Am 08.10.2026 im deutschen Apple-Katalog auf Interpret, Titel und Studiofassung geprüft.
const VERIFIED_TRACKS = {
  "Accept": {
    "Balls to the Wall": {
      "trackId": 1787140532,
      "artistId": 545085
    },
    "Fast as a Shark": {
      "trackId": 1443152102,
      "artistId": 545085
    },
    "Metal Heart": {
      "trackId": 1787140286,
      "artistId": 545085
    }
  },
  "Alestorm": {
    "P.A.R.T.Y.": {
      "trackId": 1613617245,
      "artistId": 272280214
    },
    "Keelhauled": {
      "trackId": 1184090499,
      "artistId": 272280214
    },
    "Mexico": {
      "trackId": 1216690909,
      "artistId": 272280214
    }
  },
  "All for Metal": {
    "All for Metal": {
      "trackId": 1681003056,
      "artistId": 1638071786
    },
    "Raise Your Hammer": {
      "trackId": 1681003063,
      "artistId": 1638071786
    },
    "Born in Valhalla": {
      "trackId": 1681003062,
      "artistId": 1638071786
    }
  },
  "Amon Amarth": {
    "Twilight of the Thunder God": {
      "trackId": 288236837,
      "artistId": 54261107
    },
    "The Pursuit of Vikings": {
      "trackId": 54267110,
      "artistId": 54261107
    },
    "Guardians of Asgaard": {
      "trackId": 288236843,
      "artistId": 54261107
    }
  },
  "Arch Enemy": {
    "Nemesis": {
      "trackId": 1045077665,
      "artistId": 18098340
    },
    "Handshake with Hell": {
      "trackId": 1604942258,
      "artistId": 18098340
    },
    "The Eagle Flies Alone": {
      "trackId": 1252750322,
      "artistId": 18098340
    }
  },
  "Bruce Dickinson": {
    "Tears of the Dragon": {
      "trackId": 1528518971,
      "artistId": 546389
    },
    "Chemical Wedding": {
      "trackId": 1727180756,
      "artistId": 546389
    },
    "Accident of Birth": {
      "trackId": 1727181120,
      "artistId": 546389
    }
  },
  "Coppelius": {
    "Risiko": {
      "trackId": 408876846,
      "artistId": 262666805
    },
    "Moor": {
      "trackId": 948679327,
      "artistId": 262666805
    },
    "Operation": {
      "trackId": 408879515,
      "artistId": 262666805
    }
  },
  "D'Artagnan": {
    "Seit an Seit": {
      "trackId": 1152983233,
      "artistId": 1072871475
    },
    "Was wollen wir trinken": {
      "trackId": 1259947390,
      "artistId": 1072871475
    },
    "C'est la vie": {
      "trackId": 1542412002,
      "artistId": 1072871475
    }
  },
  "Dust Bolt": {
    "Soul Erazor": {
      "trackId": 1184163123,
      "artistId": 541925257
    },
    "Turned to Grey": {
      "trackId": 1183989549,
      "artistId": 541925257
    },
    "Chaos Possession": {
      "trackId": 1495748714,
      "artistId": 541925257
    }
  },
  "Eisbrecher": {
    "Was ist hier los?": {
      "trackId": 1245762342,
      "artistId": 120379659
    },
    "Verrückt": {
      "trackId": 569259279,
      "artistId": 120379659
    },
    "Eiszeit": {
      "trackId": 1398485888,
      "artistId": 120379659
    }
  },
  "Emil Bulls": {
    "Euphoria": {
      "trackId": 1273672456,
      "artistId": 13432035
    },
    "When God Was Sleeping": {
      "trackId": 977708275,
      "artistId": 13432035
    },
    "The Most Evil Spell": {
      "trackId": 976560052,
      "artistId": 13432035
    }
  },
  "Equilibrium": {
    "Blut im Auge": {
      "trackId": 1460468746,
      "artistId": 129528357
    },
    "Unbesiegt": {
      "trackId": 1460468751,
      "artistId": 129528357
    },
    "Wirtshaus Gaudi": {
      "trackId": 1456934729,
      "artistId": 129528357
    }
  },
  "Grave Digger": {
    "Rebellion (The Clans Are Marching)": {
      "trackId": 204431993,
      "artistId": 17270887
    },
    "Heavy Metal Breakdown": {
      "trackId": 1356163784,
      "artistId": 17270887
    },
    "Excalibur": {
      "trackId": 204290259,
      "artistId": 17270887
    }
  },
  "Gutalax": {
    "Shitbusters": {
      "trackId": 1654887652,
      "artistId": 438823706
    },
    "Diarrhero": {
      "trackId": 1654887456,
      "artistId": 438823706
    },
    "Robocock": {
      "trackId": 1717500189,
      "artistId": 438823706
    }
  },
  "GWAR": {
    "Gor-Gor": {
      "trackId": 336254524,
      "artistId": 28693087
    },
    "GWAR Theme": {
      "trackId": 1526594829,
      "artistId": 28693087
    },
    "Immortal Corrupter": {
      "trackId": 210625352,
      "artistId": 28693087
    }
  },
  "Håndgemeng": {
    "The Astronomer": {
      "trackId": 1677633749,
      "artistId": 1353558262
    },
    "Medieval Knievel": {
      "trackId": 1794127381,
      "artistId": 1353558262
    },
    "The Sundrinker": {
      "trackId": 1794127387,
      "artistId": 1353558262
    }
  },
  "H-Blockx": {
    "Risin' High": {
      "trackId": 253917239,
      "artistId": 18262718
    },
    "Move": {
      "trackId": 253917019,
      "artistId": 18262718
    },
    "Little Girl": {
      "trackId": 253917051,
      "artistId": 18262718
    }
  },
  "Igel vs. Shark": {
    "Set This Town on Fire": {
      "trackId": 1755009643,
      "artistId": 1472005862
    },
    "500,000 Miles": {
      "trackId": 1755009150,
      "artistId": 1472005862
    },
    "Rock n Roll Bomb": {
      "trackId": 1602355084,
      "artistId": 1472005862
    }
  },
  "Katerfahrt": {
    "Piratenpogo": {
      "trackId": 1871804024,
      "artistId": 1708791401
    },
    "Seemannsgarn": {
      "trackId": 1871804007,
      "artistId": 1708791401
    },
    "Partyraten": {
      "trackId": 6793183033,
      "artistId": 1708791401
    }
  },
  "Korpiklaani": {
    "Vodka": {
      "trackId": 1456968878,
      "artistId": 35939436
    },
    "Happy Little Boozer": {
      "trackId": 1183993751,
      "artistId": 35939436
    },
    "Wooden Pints": {
      "trackId": 1184711097,
      "artistId": 35939436
    }
  },
  "Lord of the Lost": {
    "Blood & Glitter": {
      "trackId": 1658069068,
      "artistId": 327165319
    },
    "Loreley": {
      "trackId": 1730495872,
      "artistId": 327165319
    },
    "Drag Me to Hell": {
      "trackId": 1733052405,
      "artistId": 327165319
    }
  },
  "Marduk": {
    "The Blond Beast": {
      "trackId": 1056497946,
      "artistId": 79550945
    },
    "Frontschwein": {
      "trackId": 1056497944,
      "artistId": 79550945
    },
    "Werwolf": {
      "trackId": 1374598340,
      "artistId": 79550945
    }
  },
  "Metal Church": {
    "Beyond the Black": {
      "trackId": 309589786,
      "artistId": 612150
    },
    "Metal Church": {
      "trackId": 309589789,
      "artistId": 612150
    },
    "Badlands": {
      "trackId": 357720130,
      "artistId": 612150
    }
  },
  "Nestor": {
    "1989": {
      "trackId": 1640058640,
      "artistId": 1568669714
    },
    "On the Run": {
      "trackId": 1640057559,
      "artistId": 1568669714
    },
    "Perfect 10 (Eyes Like Demi Moore)": {
      "trackId": 1640058295,
      "artistId": 1568669714
    }
  },
  "Setyøursails": {
    "Bad Blood": {
      "trackId": 1721583146,
      "artistId": 1438904761
    },
    "Nightfall": {
      "trackId": 1589989969,
      "artistId": 1438904761
    },
    "Best of Me": {
      "trackId": 1721583154,
      "artistId": 1438904761
    }
  },
  "SKÁLD": {
    "Rún": {
      "trackId": 1473134218,
      "artistId": 1413889666
    },
    "Ó Valhalla": {
      "trackId": 1473134224,
      "artistId": 1413889666
    },
    "Seven Nation Army": {
      "trackId": 1473134232,
      "artistId": 1413889666
    }
  },
  "Storm Seeker": {
    "The Longing": {
      "trackId": 1104994304,
      "artistId": 1104994009
    },
    "Pirate Squad": {
      "trackId": 1460863057,
      "artistId": 1104994009
    },
    "How to Be a Pirate": {
      "trackId": 1539734739,
      "artistId": 1104994009
    }
  },
  "Tankard": {
    "Empty Tankard": {
      "trackId": 1312797930,
      "artistId": 72276068
    },
    "A Girl Called Cerveza": {
      "trackId": 1456945867,
      "artistId": 72276068
    },
    "Chemical Invasion": {
      "trackId": 942517670,
      "artistId": 72276068
    }
  },
  "The Sisters of Mercy": {
    "Temple of Love (1992)": {
      "trackId": 694683047,
      "artistId": 702929
    },
    "Lucretia My Reflection": {
      "trackId": 1384587816,
      "artistId": 702929
    },
    "This Corrosion": {
      "trackId": 1027459956,
      "artistId": 702929
    }
  },
  "Turbobier": {
    "Arbeitslos durch den Tag": {
      "trackId": 995219195,
      "artistId": 978354799
    },
    "King of Simmering": {
      "trackId": 1507995661,
      "artistId": 978354799
    },
    "Fuaßboiplotz": {
      "trackId": 995219120,
      "artistId": 978354799
    }
  }
};

const BANDS = BAND_NAMES.map(name => {
  const sched = SCHEDULE_DATA[name] || {};
  return {
    id: slug(name),
    name,
    description: BAND_DESCRIPTIONS[name],
    songs: (SONGS[name] || []).map(title => ({ title, ...(VERIFIED_TRACKS[name]?.[title] || {}) })),
    day: sched.day || null,
    start: sched.start || null,
    end: sched.end || null,
    stage: sched.stage || null,
    scheduleConfirmed: false
  };
});
