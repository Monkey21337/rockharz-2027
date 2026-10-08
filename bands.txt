'use strict';
// ROCKHARZ Companion: Vorläufige Bandauswahl aus dem bisherigen Projekt.
// Nicht als offiziell verifiziertes Line-up verstehen.
const BAND_NAMES = ["Accept","Alestorm","All for Metal","Amon Amarth","Arch Enemy","Bruce Dickinson","Coppelius","D'Artagnan","Dust Bolt","Eisbrecher","Emil Bulls","Equilibrium","Grave Digger","Gutalax","GWAR","Håndgemeng","H-Blockx","Igel vs. Shark","Katerfahrt","Korpiklaani","Lord of the Lost","Marduk","Metal Church","Nestor","Setyøursails","SKÁLD","Storm Seeker","Tankard","The Sisters of Mercy","Turbobier"];
const SONGS = {
"Accept":["Balls to the Wall","Fast as a Shark","Metal Heart"],
"Alestorm":["Drink","Keelhauled","Mexico"],
"All for Metal":["All for Metal","Raise Your Hammer","Born in Valhalla"],
"Amon Amarth":["Twilight of the Thunder God","The Pursuit of Vikings","Guardians of Asgaard"],
"Arch Enemy":["Nemesis","War Eternal","The Eagle Flies Alone"],
"Bruce Dickinson":["Tears of the Dragon","Chemical Wedding","Accident of Birth"],
"Coppelius":["Risiko","Moor","Operation"],
"D'Artagnan":["Seit an Seit","Was wollen wir trinken","C'est la vie"],
"Dust Bolt":["Soul Erazor","Mass Confusion","Chaos Possession"],
"Eisbrecher":["Was ist hier los?","Verrückt","Eiszeit"],
"Emil Bulls":["Euphoria","When God Was Sleeping","The Most Evil Spell"],
"Equilibrium":["Blut im Auge","Unbesiegt","Wirtshaus Gaudi"],
"Grave Digger":["Rebellion (The Clans Are Marching)","Heavy Metal Breakdown","Excalibur"],
"Gutalax":["Shitbusters","Diarrhero","Robocock"],
"GWAR":["Sick of You","Bring Back the Bomb","Immortal Corrupter"],
"H-Blockx":["Risin' High","Move","Little Girl"],
"Korpiklaani":["Vodka","Happy Little Boozer","Wooden Pints"],
"Lord of the Lost":["Blood & Glitter","Loreley","Six Feet Underground"],
"Marduk":["Panzer Division Marduk","Frontschwein","Wolves"],
"Metal Church":["Beyond the Black","Metal Church","Badlands"],
"Nestor":["On the Run","1989","Perfect 10 (Eyes Like Demi Moore)"],
"SKÁLD":["Rún","Ó Valhalla","Seven Nation Army"],
"Storm Seeker":["The Longing","Pirate Squad","How to Be a Pirate"],
"Tankard":["Empty Tankard","A Girl Called Cerveza","Chemical Invasion"],
"The Sisters of Mercy":["Temple of Love","Lucretia My Reflection","This Corrosion"],
"Turbobier":["Arbeitslos","King of Simmering","Fuaßboiplotz"]
};
// Video-IDs nur bei bekannten Kandidaten. Einbettbarkeit / regionale Freigabe nicht garantiert.
const VIDEOS = {}; // Keine ungeprüften YouTube-IDs; der Player nutzt Studio-Hörproben.
const BAND_DESCRIPTIONS = {
"Accept":"Deutsche Heavy-Metal-Legenden mit klassischen Riffs und großen Hymnen.",
"Alestorm":"Piratenmetal aus Schottland mit mitreißenden Refrains.",
"Amon Amarth":"Melodic Death Metal mit epischen Wikingerthemen.",
"Arch Enemy":"Melodischer Death Metal mit markanten Gitarrenmelodien.",
"Bruce Dickinson":"Die Iron-Maiden-Stimme mit eigenständigem Solomaterial.",
"Eisbrecher":"Neue Deutsche Härte mit elektronischen Elementen.",
"Korpiklaani":"Finnischer Folk Metal mit traditionellen Instrumenten.",
"Lord of the Lost":"Düsterer Rock und Metal mit theatralischer Atmosphäre.",
"The Sisters of Mercy":"Gothic-Rock-Klassiker mit unverwechselbarer Atmosphäre.",
"Tankard":"Frankfurter Thrash Metal mit temporeichen Songs."
};
const slug = s => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const BANDS = BAND_NAMES.map(name => ({
 id: slug(name), name,
 description: BAND_DESCRIPTIONS[name] || 'Entdecke die Musik dieser Band und entscheide, ob du sie live sehen möchtest.',
 songs: (SONGS[name] || []).map(title => ({title, youtubeId: VIDEOS[name]?.[title] || ''})),
 day: null, start: null, end: null, stage: null
}));
