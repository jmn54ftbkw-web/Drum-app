const T = 36;
const L = 12;

export const KIT = [
  { id: "kick", abbr: "Kk", name: "Kick", voice: "down", head: "oval", pitch: T + L * 4.5, layout: { pad: 82 } },
  { id: "snare", abbr: "Sn", name: "Snare", voice: "down", head: "oval", pitch: T + L * 2.5, layout: { pad: 66 } },
  { id: "hat", abbr: "Hh", name: "High Hat", voice: "up", head: "x", pitch: T - L / 2, layout: { pad: 58 } },
  { id: "crash", abbr: "Cr", name: "Crash", voice: "up", head: "x", pitch: T - L, layout: { pad: 62 } },
  { id: "ride", abbr: "Rd", name: "Ride", voice: "up", head: "x", pitch: T, layout: { pad: 62 } },
  { id: "splash", abbr: "Sp", name: "Splash", voice: "up", head: "x", pitch: T - L * 1.5, layout: { pad: 48 } },
  { id: "crash2", abbr: "Cr2", name: "Crash 2", voice: "up", head: "x", pitch: T - L * 1.15, layout: { pad: 58 } },
  { id: "trash", abbr: "Tr", name: "Trash", voice: "up", head: "x", pitch: T - L * 0.65, layout: { pad: 52 } },
  { id: "tomHigh1", abbr: "HT1", name: "High Tom 1", voice: "down", head: "oval", pitch: T + L * 0.5, layout: { pad: 52 } },
  { id: "tomHigh2", abbr: "HT2", name: "High Tom 2", voice: "down", head: "oval", pitch: T + L * 0.85, layout: { pad: 54 } },
  { id: "tom1", abbr: "T1", name: "Tom 1", voice: "down", head: "oval", pitch: T + L, layout: { pad: 56 } },
  { id: "tom2", abbr: "T2", name: "Tom 2", voice: "down", head: "oval", pitch: T + L * 1.5, layout: { pad: 58 } },
  { id: "floorTom1", abbr: "FT1", name: "Floor Tom 1", voice: "down", head: "oval", pitch: T + L * 3.25, layout: { pad: 62 } },
  { id: "floorTom", abbr: "FT", name: "Floor Tom", voice: "down", head: "oval", pitch: T + L * 3.5, layout: { pad: 64 } },
  { id: "floorTom2", abbr: "FT2", name: "Floor Tom 2", voice: "down", head: "oval", pitch: T + L * 4, layout: { pad: 66 } },
  { id: "cowbell", abbr: "Cb", name: "Cowbell", voice: "up", head: "x", pitch: T + L * 0.25, layout: { pad: 46 } },
  { id: "tambourine", abbr: "Tb", name: "Tambourine", voice: "up", head: "x", pitch: T - L * 1.35, layout: { pad: 46 } },
  { id: "clap", abbr: "Cp", name: "Clap", voice: "up", head: "x", pitch: T + L * 2, layout: { pad: 48 } },
];

export const DEFAULT_ROWS = ["kick", "snare", "hat", "crash", "ride", "tom2"];

export const SECTION_COLORS = {
  Intro: "#5AC8F5",
  Verse: "#F2F2F7",
  "Pre-Chorus": "#0A84FF",
  Chorus: "#FF9F0A",
  Bridge: "#BF5AF2",
  Outro: "#8E8E93",
};

export const GRID_DIVISIONS = [4, 8, 16, 32];

export function uid(prefix = "id") {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

export function hitKey(instrument, step) {
  return `${instrument}:${step}`;
}

export function velocityColor(velocity) {
  if (velocity >= 115) return "#FF453A";
  if (velocity >= 100) return "#FFD60A";
  if (velocity >= 55) return "#30D158";
  return "#64D2FF";
}

export function stepLabels(division) {
  if (division === 4) return ["1", "2", "3", "4"];
  if (division === 8) return ["1", "+", "2", "+", "3", "+", "4", "+"];
  if (division === 16) {
    return ["1", "e", "+", "a", "2", "e", "+", "a", "3", "e", "+", "a", "4", "e", "+", "a"];
  }
  const out = [];
  const names = ["1", "e", "+", "a", "2", "e", "+", "a", "3", "e", "+", "a", "4", "e", "+", "a"];
  names.forEach((name) => {
    out.push(name, "");
  });
  return out;
}

export function emptyHits() {
  return {};
}

export function createMeasure(hits = {}, gridDivision = 16, rows = DEFAULT_ROWS) {
  return {
    id: uid("m"),
    gridDivision,
    rows: [...rows],
    hits: { ...hits },
  };
}

function H(velocity, articulation = null, timing = 0) {
  return { velocity, articulation, timing };
}

function rockVerse(crashOnOne, fill) {
  const hits = {};
  const put = (id, step, vel, art) => {
    hits[hitKey(id, step)] = H(vel, art ?? null);
  };

  [0, 6, 8, 10, 14].forEach((step) => put("kick", step, 86));
  put("snare", 4, 92);
  put("snare", 12, 94);
  put("hat", 0, 78, "closed");
  put("hat", 2, 50, "open");
  put("hat", 4, 80, "closed");
  put("hat", 6, 48, "closed");
  put("hat", 8, 80, "closed");
  put("hat", 10, 76, "closed");
  put("hat", 12, 80, "closed");
  put("hat", 14, 46, "closed");
  if (crashOnOne) put("crash", 0, 118);
  if (fill) {
    delete hits[hitKey("kick", 14)];
    put("snare", 12, 120);
    put("snare", 13, 100);
    put("snare", 14, 102);
    delete hits[hitKey("hat", 12)];
    delete hits[hitKey("hat", 14)];
  }
  return hits;
}

function introHits() {
  const hits = {};
  const put = (id, step, vel, art) => {
    hits[hitKey(id, step)] = H(vel, art ?? null);
  };
  [0, 8].forEach((step) => put("kick", step, 80));
  put("hat", 0, 70, "closed");
  put("hat", 4, 50, "closed");
  put("hat", 8, 70, "closed");
  put("hat", 12, 50, "closed");
  return hits;
}

function chorusHits(crash) {
  const hits = rockVerse(crash, false);
  hits[hitKey("ride", 2)] = H(64);
  hits[hitKey("ride", 10)] = H(60);
  return hits;
}

function bridgeHits() {
  const hits = {};
  const put = (id, step, vel, art) => {
    hits[hitKey(id, step)] = H(vel, art ?? null);
  };
  put("kick", 0, 88);
  put("kick", 8, 84);
  put("snare", 4, 90);
  put("snare", 12, 92);
  put("tom2", 6, 86);
  put("tom2", 14, 80);
  put("ride", 0, 70);
  put("ride", 4, 62);
  put("ride", 8, 70);
  put("ride", 12, 62);
  return hits;
}

function outroHits() {
  const hits = {};
  hits[hitKey("kick", 0)] = H(90);
  hits[hitKey("snare", 4)] = H(88);
  hits[hitKey("crash", 0)] = H(120);
  hits[hitKey("hat", 8)] = H(50, "open");
  return hits;
}

function section(name, patterns) {
  return {
    id: uid("s"),
    name,
    color: SECTION_COLORS[name] ?? "#8E8E93",
    measures: patterns.map((hits) => createMeasure(hits)),
  };
}

export function createSong() {
  return {
    title: "My Drum Beat",
    timeFeel: "4/4 Straight",
    bpm: 100,
    sections: [
      section("Intro", [introHits(), introHits()]),
      section("Verse", [
        rockVerse(true, false),
        rockVerse(false, false),
        rockVerse(false, false),
        rockVerse(false, true),
      ]),
      section("Pre-Chorus", [rockVerse(false, false), rockVerse(false, true)]),
      section("Chorus", [
        chorusHits(true),
        chorusHits(false),
        chorusHits(false),
        rockVerse(true, true),
      ]),
      section("Bridge", [bridgeHits(), bridgeHits()]),
      section("Outro", [outroHits(), outroHits()]),
    ],
  };
}

export function findSection(song, sectionId) {
  return song.sections.find((sectionItem) => sectionItem.id === sectionId) ?? song.sections[0];
}

export function findMeasure(song, measureId) {
  for (const sectionItem of song.sections) {
    const measure = sectionItem.measures.find((item) => item.id === measureId);
    if (measure) return { section: sectionItem, measure };
  }
  return null;
}

export function cloneMeasure(measure) {
  return {
    id: uid("m"),
    gridDivision: measure.gridDivision,
    rows: [...measure.rows],
    hits: structuredClone(measure.hits),
  };
}

export function remapHits(measure, nextDivision) {
  const prev = measure.gridDivision;
  if (prev === nextDivision) return measure.hits;
  const next = {};
  Object.entries(measure.hits).forEach(([key, value]) => {
    const [instrument, stepText] = key.split(":");
    const step = Number(stepText);
    const ratio = nextDivision / prev;
    const mapped = Math.round(step * ratio);
    if (mapped >= 0 && mapped < nextDivision) {
      next[hitKey(instrument, mapped)] = value;
    }
  });
  return next;
}

export function instrumentById(id) {
  return (
    KIT.find((item) => item.id === id) ?? {
      id,
      abbr: id.slice(0, 2),
      name: id,
      voice: "down",
      head: "oval",
      pitch: T + L * 2.5,
      layout: { left: 50, top: 40 },
    }
  );
}

export function sortRows(rows) {
  const order = KIT.map((item) => item.id);
  return order.filter((id) => rows.includes(id));
}

export function availablePieces(rows) {
  return KIT.filter((item) => !rows.includes(item.id));
}

export function songKitIds(song) {
  const used = new Set();
  song.sections.forEach((section) => {
    section.measures.forEach((measure) => {
      measure.rows.forEach((id) => used.add(id));
    });
  });
  return used;
}

export function songRows(song) {
  return sortRows([...songKitIds(song)]);
}

export function addRowToSong(song, instrument) {
  song.sections.forEach((section) => {
    section.measures.forEach((measure) => {
      if (!measure.rows.includes(instrument)) {
        measure.rows = sortRows([...measure.rows, instrument]);
      }
    });
  });
}

export function removeRowFromSong(song, instrument) {
  const current = songRows(song);
  if (current.length <= 1 || !current.includes(instrument)) return false;
  song.sections.forEach((section) => {
    section.measures.forEach((measure) => {
      measure.rows = measure.rows.filter((id) => id !== instrument);
      Object.keys(measure.hits).forEach((key) => {
        if (key.startsWith(`${instrument}:`)) delete measure.hits[key];
      });
    });
  });
  return true;
}

export function songKit(song) {
  const used = songKitIds(song);
  return KIT.filter((item) => used.has(item.id));
}
