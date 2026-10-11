export const KIT = [
  { id: "kick", abbr: "Kk", name: "Kick" },
  { id: "snare", abbr: "Sn", name: "Snare" },
  { id: "hat", abbr: "Hh", name: "High Hat" },
  { id: "crash", abbr: "Cr", name: "Crash" },
  { id: "ride", abbr: "Rd", name: "Ride" },
  { id: "tom2", abbr: "T2", name: "Tom 2" },
];

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

export function createMeasure(hits = {}, gridDivision = 16, rows = KIT.map((k) => k.id)) {
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
  return KIT.find((item) => item.id === id);
}
