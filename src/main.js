import { createAudio } from "./audio.js";
import { renderMeasureStaff } from "./notation.js";
import {
  KIT,
  SECTION_COLORS,
  GRID_DIVISIONS,
  availablePieces,
  cloneMeasure,
  createMeasure,
  createSong,
  findMeasure,
  findSection,
  hitKey,
  instrumentById,
  remapHits,
  songKitIds,
  sortRows,
  stepLabels,
  uid,
  velocityColor,
} from "./song.js";

const audio = createAudio();
const HOLD_MS = 380;
const app = document.getElementById("app");

const state = {
  song: createSong(),
  selectedSectionId: null,
  mode: "compose",
  playing: false,
  looping: true,
  playStep: 0,
  playMeasureIndex: 0,
  menus: {
    hit: null,
    measure: null,
    settings: false,
    editRows: null,
    addSection: false,
    addPiece: null,
  },
};

state.selectedSectionId = state.song.sections[1]?.id ?? state.song.sections[0].id;

let schedulerTimer = 0;
let playheadFrame = 0;
let playOrigin = 0;
let playOffsetBeats = 0;
let holdTimer = 0;
let holdFired = false;

function currentSection() {
  return findSection(state.song, state.selectedSectionId);
}

function sectionMeasures() {
  return currentSection().measures;
}

function secondsPerBeat() {
  return 60 / state.song.bpm;
}

function secondsPerStep(measure) {
  return secondsPerBeat() / (measure.gridDivision / 4);
}

function closeMenus() {
  state.menus = {
    hit: null,
    measure: null,
    settings: false,
    editRows: null,
    addSection: false,
    addPiece: null,
  };
}

function toggleHit(measureId, instrument, step) {
  const found = findMeasure(state.song, measureId);
  if (!found) return;
  const key = hitKey(instrument, step);
  if (found.measure.hits[key]) {
    delete found.measure.hits[key];
  } else {
    const articulation = instrument === "hat" ? "closed" : null;
    found.measure.hits[key] = { velocity: 80, articulation, timing: 0 };
    audio.play(instrument, 80, articulation);
  }
  const cell = app.querySelector(
    `[data-action="cell"][data-measure="${measureId}"][data-instrument="${instrument}"][data-step="${step}"]`
  );
  if (cell) cell.innerHTML = renderHit(found.measure, instrument, step);
  else render();
}

function updateHit(measureId, instrument, step, patch, redraw = true) {
  const found = findMeasure(state.song, measureId);
  if (!found) return;
  const key = hitKey(instrument, step);
  const current = found.measure.hits[key];
  if (!current) return;
  found.measure.hits[key] = { ...current, ...patch };
  if (redraw) render();
  else paintHit(measureId, instrument, step);
}

function paintHit(measureId, instrument, step) {
  const found = findMeasure(state.song, measureId);
  if (!found) return;
  const cell = app.querySelector(
    `[data-action="cell"][data-measure="${measureId}"][data-instrument="${instrument}"][data-step="${step}"]`
  );
  if (cell) cell.innerHTML = renderHit(found.measure, instrument, step);
  const value = app.querySelector(".popover-row .value, .slider-wrap");
  if (state.menus.hit?.view === "velocity") {
    const label = app.querySelector("[data-action='hit-view'][data-view='velocity'] .value");
    const hit = found.measure.hits[hitKey(instrument, step)];
    if (label && hit) label.textContent = `${hit.velocity} ›`;
  }
}

function insertMeasure(section, index, measure = createMeasure()) {
  section.measures.splice(index, 0, measure);
}

function removeMeasure(section, measureId) {
  if (section.measures.length <= 1) {
    section.measures[0] = createMeasure();
    return;
  }
  section.measures = section.measures.filter((item) => item.id !== measureId);
}

function icon(name) {
  const paths = {
    back: `<path d="M15 6 L8 12 L15 18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>`,
    gear: `<path d="M12 8.5a3.5 3.5 0 1 0 .01 7.01A3.5 3.5 0 0 0 12 8.5Zm8 3.1-.9-.16a7 7 0 0 0-.7-1.7l.55-.74a.8.8 0 0 0-.08-1.05l-1.7-1.7a.8.8 0 0 0-1.05-.08l-.74.55a7 7 0 0 0-1.7-.7L13.4 4a.8.8 0 0 0-.8-.7h-2.4a.8.8 0 0 0-.8.7l-.16.9a7 7 0 0 0-1.7.7l-.74-.55a.8.8 0 0 0-1.05.08L3.05 6.83a.8.8 0 0 0-.08 1.05l.55.74a7 7 0 0 0-.7 1.7L1.92 11.6a.8.8 0 0 0-.7.8v2.4c0 .4.29.73.7.8l.9.16a7 7 0 0 0 .7 1.7l-.55.74a.8.8 0 0 0 .08 1.05l1.7 1.7a.8.8 0 0 0 1.05.08l.74-.55a7 7 0 0 0 1.7.7l.16.9c.07.41.4.7.8.7h2.4c.4 0 .73-.29.8-.7l.16-.9a7 7 0 0 0 1.7-.7l.74.55a.8.8 0 0 0 1.05-.08l1.7-1.7a.8.8 0 0 0 .08-1.05l-.55-.74a7 7 0 0 0 .7-1.7l.9-.16c.41-.07.7-.4.7-.8v-2.4a.8.8 0 0 0-.7-.8Z" fill="currentColor"/>`,
    loop: `<path d="M7 9h8a3 3 0 0 1 0 6h-2M17 15H9a3 3 0 0 1 0-6h2" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M8 6.5 6.5 9 8 11.5M16 17.5 17.5 15 16 12.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>`,
    start: `<path d="M8 6v12M11 12 18 7v10z" fill="currentColor"/>`,
    play: `<path d="M8 5.5v13l11-6.5z" fill="currentColor"/>`,
    pause: `<rect x="7" y="6" width="3.4" height="12" rx="1"/><rect x="13.6" y="6" width="3.4" height="12" rx="1"/>`,
    kebab: `<circle cx="12" cy="6" r="1.7" fill="currentColor"/><circle cx="12" cy="12" r="1.7" fill="currentColor"/><circle cx="12" cy="18" r="1.7" fill="currentColor"/>`,
    handle: `<path d="M6 8h12M6 12h12M6 16h12" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>`,
    plus: `<path d="M12 6v12M6 12h12" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>`,
  };
  return `<svg viewBox="0 0 24 24" aria-hidden="true">${paths[name]}</svg>`;
}

function drumGlyph(rx, headY, depth, stands = false) {
  const left = 12 - rx;
  const right = 12 + rx;
  const ry = Math.max(1.7, rx * 0.4);
  const bottom = headY + depth;
  const curve = ry * 1.15;
  let body = `<ellipse cx="12" cy="${headY}" rx="${rx}" ry="${ry}" fill="none" stroke="currentColor" stroke-width="1.55"/>
    <path d="M${left} ${headY} V${bottom} c0 ${curve} ${rx * 0.85} ${curve + 0.6} ${rx} ${curve + 0.6} s${rx} -0.5 ${rx} ${-(curve + 0.6)} V${headY}" fill="none" stroke="currentColor" stroke-width="1.55"/>`;
  if (stands) {
    const foot = Math.min(23.2, bottom + curve + 2.4);
    body += `<path d="M${left + 1.4} ${bottom + 1} L${left - 0.2} ${foot} M12 ${bottom + curve * 0.45} V${foot} M${right - 1.4} ${bottom + 1} L${right + 0.2} ${foot}" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round"/>`;
  }
  return `<svg viewBox="0 0 24 24">${body}</svg>`;
}

function kitGlyph(id) {
  if (id === "kick") {
    return `<svg viewBox="0 0 24 24"><circle cx="12" cy="13" r="7" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="12" cy="13" r="2" fill="currentColor"/></svg>`;
  }
  if (id === "snare") {
    return drumGlyph(7, 10, 5);
  }
  if (id === "hat") {
    return `<svg viewBox="0 0 24 24"><path d="M4 13h16M7 13l5-4 5 4M8 16h8" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>`;
  }
  if (id === "ride") {
    return `<svg viewBox="0 0 24 24"><ellipse cx="12" cy="12" rx="7.1" ry="2.15" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M12 6.6v10.8" stroke="currentColor" stroke-width="1.6"/></svg>`;
  }
  if (id === "crash" || id === "crash2") {
    const tilt = id === "crash2" ? 15 : -18;
    return `<svg viewBox="0 0 24 24"><g transform="rotate(${tilt} 12 12)"><ellipse cx="12" cy="12" rx="9.4" ry="2.85" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M12 5.2v13.6" stroke="currentColor" stroke-width="1.6"/></g></svg>`;
  }
  if (id === "splash") {
    return `<svg viewBox="0 0 24 24"><ellipse cx="12" cy="12" rx="5.5" ry="1.8" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M12 8v8" stroke="currentColor" stroke-width="1.6"/></svg>`;
  }
  if (id === "trash") {
    return `<svg viewBox="0 0 24 24"><path d="M4 12c2-2 4-3 8-3s6 1 8 3c-2 2-4 3-8 3s-6-1-8-3z" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M8 10.5 10 14M14 10l2 3.6" stroke="currentColor" stroke-width="1.4"/></svg>`;
  }
  if (id === "cowbell") {
    return `<svg viewBox="0 0 24 24"><path d="M8 6h8l2 12H6z" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M9 12h6" stroke="currentColor" stroke-width="1.4"/></svg>`;
  }
  if (id === "tambourine") {
    return `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="6.5" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="12" cy="5.4" r="1.2" fill="currentColor"/><circle cx="18" cy="9" r="1.2" fill="currentColor"/><circle cx="16.8" cy="16.2" r="1.2" fill="currentColor"/><circle cx="7.2" cy="16.2" r="1.2" fill="currentColor"/><circle cx="6" cy="9" r="1.2" fill="currentColor"/></svg>`;
  }
  if (id === "clap") {
    return `<svg viewBox="0 0 24 24"><path d="M8 15c-1.4-1-1.6-3.2-.4-4.6l4-4.6 1.3 1.1-3.2 3.7" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><path d="M11 16.5c-1.5-1.2-1.4-3.6.2-4.8l3.6-3.2 1.2 1.3-3 2.7" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>`;
  }
  if (id === "tomHigh1") return drumGlyph(4.6, 6.6, 9.2);
  if (id === "tomHigh2") return drumGlyph(5.5, 6.8, 8.6);
  if (id === "tom1") return drumGlyph(6.1, 7.6, 7.6);
  if (id === "tom2") return drumGlyph(6.6, 8, 7);
  if (id === "floorTom1") return drumGlyph(7.3, 6.8, 9.4, true);
  if (id === "floorTom") return drumGlyph(7.6, 6.6, 9.8, true);
  if (id === "floorTom2") return drumGlyph(8, 6.4, 10.2, true);
  return drumGlyph(6, 8, 7);
}

function modeButtons(buttonClass) {
  return ["compose", "playback", "perform"]
    .map((mode) => {
      const label = `${mode[0].toUpperCase()}${mode.slice(1)}`;
      return `<button class="${buttonClass} ${state.mode === mode ? "active" : ""}" data-action="mode" data-mode="${mode}">${label}</button>`;
    })
    .join("");
}

function renderSections() {
  return `<div class="sections">
    ${state.song.sections
      .map(
        (section) => `<button class="section-chip ${section.id === state.selectedSectionId ? "active" : ""}" style="--section-color:${section.color}" data-action="section" data-id="${section.id}">${section.name}</button>`
      )
      .join("")}
    <button class="section-chip section-add" data-action="add-section">${icon("plus")}</button>
  </div>`;
}

function renderHit(measure, instrument, step) {
  const hit = measure.hits[hitKey(instrument, step)];
  if (!hit) return "";
  const open = instrument === "hat" && hit.articulation === "open";
  return `<span class="hit ${open ? "open" : ""}" style="--hit:${velocityColor(hit.velocity)}"></span>`;
}

function isBeatStart(step, division) {
  return step % (division / 4) === 0;
}

function renderMeasure(measure, index) {
  const labels = stepLabels(measure.gridDivision);
  const rows = measure.rows;
  const header = [`<div class="gutter"></div>`, `<div class="measure-num">${index + 1}</div>`]
    .concat(
      labels.map(
        (label, step) =>
          `<div class="mh ${isBeatStart(step, measure.gridDivision) ? "beat" : ""}">${label}</div>`
      )
    )
    .concat([
      `<div class="gutter"><button data-action="measure-menu" data-measure="${measure.id}" aria-label="Measure menu">${icon("kebab")}</button></div>`,
    ])
    .join("");

  const body = rows
    .map((instrument, rowIndex) => {
      const inst = instrumentById(instrument);
      const handle =
        rowIndex === 0
          ? `<div class="gutter"><span class="row-handle">${icon("handle")}</span></div>`
          : `<div class="gutter"></div>`;
      const cells = Array.from({ length: measure.gridDivision }, (_, step) => {
        return `<div class="cell ${isBeatStart(step, measure.gridDivision) ? "beat-start" : ""}" role="button" data-action="cell" data-measure="${measure.id}" data-instrument="${instrument}" data-step="${step}">${renderHit(measure, instrument, step)}</div>`;
      }).join("");
      return `${handle}<div class="row-icon">${kitGlyph(instrument)}<span>${inst.abbr}</span></div>${cells}<div class="gutter"></div>`;
    })
    .join("");

  return `<article class="measure" data-measure-el="${measure.id}" style="--cols:${measure.gridDivision}">
    <div class="measure-scroll">
      <div class="measure-grid">${header}${body}</div>
    </div>
  </article>`;
}

function renderCompose() {
  const measures = sectionMeasures();
  if (!measures.length) {
    return `<div class="empty-section">No measures in this section.</div>`;
  }
  return `<div class="measure-stack">
    ${measures
      .map((measure, index) => {
        return `${renderMeasure(measure, index)}<button class="insert" data-action="add-piece" data-measure="${measure.id}"><span>+</span> Add</button>`;
      })
      .join("")}
  </div>`;
}

function songTimeline() {
  const items = [];
  let startBeat = 0;
  let number = 1;
  for (const section of state.song.sections) {
    for (const measure of section.measures) {
      items.push({ section, measure, startBeat, number });
      startBeat += 4;
      number += 1;
    }
  }
  return items;
}

function renderPlayback() {
  const active = songKitIds(state.song);
  return `<div class="kit-stage" aria-label="Drummer kit view">
    <div class="kit-horizon"></div>
    ${KIT.map((inst) => {
      const on = active.has(inst.id);
      return `<div class="kit-piece kit-${inst.id} ${on ? "is-active" : "ghost"}" data-kit="${inst.id}">
        <div class="kit-lane" data-lane="${inst.id}"></div>
        <button class="kit-pad" ${on ? `data-action="kit-hit" data-instrument="${inst.id}"` : "disabled tabindex='-1'"} aria-label="${inst.name}">
          ${kitGlyph(inst.id)}<span>${inst.abbr}</span>
        </button>
      </div>`;
    }).join("")}
  </div>`;
}

function renderPerform() {
  const items = songTimeline();
  let lastSection = "";
  const blocks = items
    .map((item) => {
      const heading =
        item.section.id !== lastSection
          ? `<div class="staff-section-label" data-staff-section="${item.section.id}">${item.section.name}</div>`
          : "";
      lastSection = item.section.id;
      return `${heading}<div class="staff-card" data-staff-section="${item.section.id}" data-staff-measure="${item.measure.id}" data-start-beat="${item.startBeat}">${renderMeasureStaff(item.measure, item.number, 860)}</div>`;
    })
    .join("");
  return `<div class="perform">
    <div class="perform-heading">
      <h2>Full song</h2>
      <p>${state.song.timeFeel} · ${state.song.bpm} BPM</p>
    </div>
    ${blocks}
  </div>`;
}

function popoverHtml() {
  const { hit, measure, settings, editRows, addSection, addPiece } = state.menus;
  let extra = "";

  if (hit) {
    extra += renderHitMenu(hit);
  }
  if (measure) {
    extra += renderMeasureMenu(measure);
  }
  if (settings) {
    extra += `<div class="sheet" data-action="dismiss">
      <form class="sheet-card" data-action="save-settings" onclick="event.stopPropagation()">
        <h2>Song</h2>
        <label class="field">Title
          <input name="title" value="${escapeAttr(state.song.title)}" />
        </label>
        <label class="field">Tempo (BPM)
          <input name="bpm" type="number" min="40" max="220" value="${state.song.bpm}" />
        </label>
        <button class="t-btn" style="width:100%;height:42px" type="submit">Done</button>
      </form>
    </div>`;
  }
  if (editRows) {
    const found = findMeasure(state.song, editRows);
    extra += `<div class="sheet" data-action="dismiss">
      <div class="sheet-card" onclick="event.stopPropagation()">
        <h2>Edit grid rows</h2>
        <div class="row-toggles">
          ${KIT.map((item) => {
            const on = found.measure.rows.includes(item.id);
            return `<label>${item.name}<input type="checkbox" data-action="toggle-row" data-measure="${editRows}" data-instrument="${item.id}" ${on ? "checked" : ""} /></label>`;
          }).join("")}
        </div>
      </div>
    </div>`;
  }
  if (addPiece) {
    const found = findMeasure(state.song, addPiece);
    const choices = found ? availablePieces(found.measure.rows) : [];
    extra += `<div class="sheet" data-action="dismiss">
      <div class="sheet-card" onclick="event.stopPropagation()">
        <h2>Add kit piece</h2>
        <p class="sheet-hint">Pieces not already on this grid</p>
        <div class="piece-list">
          ${
            choices.length
              ? choices
                  .map(
                    (item) =>
                      `<button class="piece-choice" data-action="pick-piece" data-measure="${addPiece}" data-instrument="${item.id}">${kitGlyph(item.id)}<span class="piece-name">${item.name}</span><span class="piece-abbr">${item.abbr}</span></button>`
                  )
                  .join("")
              : `<p class="sheet-empty">Every piece is already on this grid.</p>`
          }
        </div>
      </div>
    </div>`;
  }
  if (addSection) {
    extra += `<div class="sheet" data-action="dismiss">
      <div class="sheet-card" onclick="event.stopPropagation()">
        <h2>Add section</h2>
        ${Object.keys(SECTION_COLORS)
          .map(
            (name) =>
              `<button class="popover-row" data-action="create-section" data-name="${name}">${name}</button>`
          )
          .join("")}
      </div>
    </div>`;
  }

  if (!extra) return "";
  return `<div class="menu-layer" data-action="dismiss">${extra}</div>`;
}

function escapeAttr(value) {
  return String(value).replaceAll('"', "&quot;");
}

function renderHitMenu(menu) {
  const found = findMeasure(state.song, menu.measureId);
  if (!found) return "";
  const hit = found.measure.hits[hitKey(menu.instrument, menu.step)];
  if (!hit) return "";
  const inst = instrumentById(menu.instrument);
  const x = menu.x;
  const y = menu.y;
  const phone = window.innerWidth < 700;
  const below = y < window.innerHeight - 280;
  const top = phone
    ? Math.min(Math.max(12, y + 16), window.innerHeight - 260)
    : below
      ? y + 18
      : y - 210;
  const left = phone ? 12 : Math.min(Math.max(12, x - 40), window.innerWidth - 250);
  const widthStyle = phone ? ";right:12px;width:auto;max-width:none" : "";

  let body = "";
  if (menu.view === "root") {
    body = `
      <div class="popover-title">${kitGlyph(menu.instrument)} ${inst.name}</div>
      ${
        menu.instrument === "hat"
          ? `<button class="popover-row" data-action="hit-view" data-view="articulation"><span>Articulation</span><span class="value">${hit.articulation === "open" ? "Open" : "Closed"} ›</span></button>`
          : ""
      }
      <button class="popover-row" data-action="hit-view" data-view="velocity"><span>Velocity</span><span class="value">${hit.velocity} ›</span></button>
      <button class="popover-row" data-action="hit-view" data-view="timing"><span>Timing</span><span class="value">${hit.timing} ›</span></button>
    `;
  } else if (menu.view === "articulation") {
    body = `
      <button class="popover-title" data-action="hit-view" data-view="root">‹ Articulation</button>
      <button class="choice" data-action="set-art" data-value="closed">Closed ${hit.articulation !== "open" ? "<span class='check'>✓</span>" : "<span class='check'>●</span>"}</button>
      <button class="choice" data-action="set-art" data-value="open">Open ${hit.articulation === "open" ? "<span class='check'>✓</span>" : "<span class='check'>○</span>"}</button>
    `;
  } else if (menu.view === "velocity") {
    body = `
      <button class="popover-title" data-action="hit-view" data-view="root">‹ Velocity</button>
      <div class="slider-wrap">
        <input type="range" min="1" max="127" value="${hit.velocity}" data-action="set-velocity" />
      </div>
    `;
  } else {
    body = `
      <button class="popover-title" data-action="hit-view" data-view="root">‹ Timing</button>
      <div class="slider-wrap">
        <input type="range" min="-80" max="80" value="${hit.timing}" data-action="set-timing" />
      </div>
    `;
  }

  return `<div class="popover ${below ? "below" : "above"}" style="top:${top}px;left:${left}px;--caret-x:28px${widthStyle}" onclick="event.stopPropagation()">${body}</div>`;
}

function renderMeasureMenu(menu) {
  const found = findMeasure(state.song, menu.measureId);
  if (!found) return "";
  const measure = found.measure;
  const left = Math.min(Math.max(12, menu.x - 220), window.innerWidth - 270);
  const top = Math.min(menu.y - 10, window.innerHeight - 340);

  if (menu.view === "grid") {
    return `<div class="popover right-caret" style="top:${top}px;left:${left}px" onclick="event.stopPropagation()">
      <button class="popover-title" data-action="measure-view" data-view="root">‹ Grid divisions</button>
      ${GRID_DIVISIONS.map(
        (div) =>
          `<button class="choice" data-action="set-grid" data-value="${div}">1/${div} ${measure.gridDivision === div ? "<span class='check'>✓</span>" : ""}</button>`
      ).join("")}
    </div>`;
  }

  const index = found.section.measures.findIndex((item) => item.id === measure.id);
  return `<div class="popover right-caret" style="top:${top}px;left:${left}px" onclick="event.stopPropagation()">
    <div class="popover-title">Measure ${index + 1}</div>
    <button class="popover-row" data-action="measure-view" data-view="grid"><span>Grid divisions</span><span class="value">1/${measure.gridDivision} ›</span></button>
    <button class="popover-row" data-action="edit-rows">Edit grid rows</button>
    <button class="popover-row" data-action="delete-measure">Delete measure</button>
    <button class="popover-row" data-action="duplicate-measure">Duplicate measure</button>
    <button class="popover-row" data-action="add-above">Add measure above</button>
    <button class="popover-row" data-action="add-below">Add measure below</button>
  </div>`;
}

function workspaceView() {
  if (state.mode === "perform") return renderPerform();
  if (state.mode === "playback") return renderPlayback();
  return renderCompose();
}

function render() {
  const playSvg = state.playing ? icon("pause") : icon("play");
  const workspace = app.querySelector(".workspace");
  const savedScroll = workspace ? workspace.scrollTop : 0;
  app.innerHTML = `
    <div class="app">
      <header class="topbar">
        <button class="icon-btn" aria-label="Back">${icon("back")}</button>
        <div class="song-meta">
          <div class="song-title">${state.song.title}</div>
          <div class="song-feel">${state.song.timeFeel}</div>
        </div>
        <div class="mode-tabs top-modes">${modeButtons("mode-tab")}</div>
        <button class="icon-btn" data-action="settings" aria-label="Settings">${icon("gear")}</button>
      </header>
      ${renderSections()}
      <main class="workspace">
        ${workspaceView()}
      </main>
      <footer class="transport">
        <div class="transport-modes">${modeButtons("transport-mode")}</div>
        <div class="transport-buttons">
          <button class="t-btn ${state.looping ? "active" : ""}" data-action="loop" aria-label="Loop">${icon("loop")}</button>
          <button class="t-btn" data-action="return" aria-label="Return to start">${icon("start")}</button>
          <button class="t-btn play ${state.playing ? "playing" : ""}" data-action="play" aria-label="Play">${playSvg}</button>
        </div>
      </footer>
      <footer class="portrait-transport">
        <button class="side ${state.looping ? "active" : ""}" data-action="loop" aria-label="Loop">${icon("loop")}</button>
        <button class="play-wide ${state.playing ? "playing" : ""}" data-action="play" aria-label="Play">${playSvg}</button>
        <button class="side" data-action="return" aria-label="Return to start">${icon("start")}</button>
      </footer>
    </div>
    ${popoverHtml()}
  `;
  bind();
  const nextWorkspace = app.querySelector(".workspace");
  if (nextWorkspace) {
    nextWorkspace.scrollTop = savedScroll;
    nextWorkspace.addEventListener("scroll", onWorkspaceScroll, { passive: true });
  }
  updatePlayhead();
  updateKitNotes();
}

function bind() {
  app.querySelectorAll("[data-action]").forEach((el) => {
    if (el.dataset.action === "cell") return;
    if (el.dataset.action === "set-velocity" || el.dataset.action === "set-timing") {
      el.addEventListener("input", onSlider);
      el.addEventListener("click", (event) => event.stopPropagation());
      return;
    }
    if (el.dataset.action === "save-settings") {
      el.addEventListener("submit", onSaveSettings);
      return;
    }
    if (el.dataset.action === "toggle-row") {
      el.addEventListener("change", onToggleRow);
      return;
    }
    if (el.dataset.action === "play") {
      el.addEventListener("pointerdown", onPlayUnlock);
      el.addEventListener("touchend", onPlayGesture, { passive: false });
      el.addEventListener("click", onPlayGesture);
      return;
    }
    el.addEventListener("click", onAction);
  });
}

let press = null;

function cellFromEvent(event) {
  const el = event.target?.closest?.("[data-action='cell']");
  return el instanceof HTMLElement ? el : null;
}

function onAppPointerDown(event) {
  const cell = cellFromEvent(event);
  if (!cell || state.mode !== "compose") return;
  if (event.button != null && event.button !== 0) return;
  audio.unlock();
  const { measure, instrument, step } = cell.dataset;
  clearTimeout(holdTimer);
  holdFired = false;
  press = {
    pointerId: event.pointerId,
    measure,
    instrument,
    step: Number(step),
    x: event.clientX,
    y: event.clientY,
    at: performance.now(),
    dragged: false,
  };
  const found = findMeasure(state.song, measure);
  const existing = found?.measure.hits[hitKey(instrument, Number(step))];
  holdTimer = window.setTimeout(() => {
    if (!press || press.dragged || !existing) return;
    holdFired = true;
    openHitMenu(press.measure, press.instrument, press.step, press.x, press.y);
  }, HOLD_MS);
}

function onAppPointerMove(event) {
  if (!press) return;
  if (event.pointerId != null && press.pointerId != null && event.pointerId !== press.pointerId) {
    return;
  }
  const dx = Math.abs(event.clientX - press.x);
  const dy = Math.abs(event.clientY - press.y);
  if (dx > 8 || dy > 8) {
    press.dragged = true;
    clearTimeout(holdTimer);
  }
}

function onAppPointerUp(event) {
  if (!press) return;
  if (event.pointerId != null && press.pointerId != null && event.pointerId !== press.pointerId) {
    return;
  }
  const elapsed = performance.now() - press.at;
  if (holdFired) {
    press = null;
    return;
  }
  if (elapsed < 30) return;
  const current = press;
  press = null;
  clearTimeout(holdTimer);
  if (current.dragged) return;
  const dx = Math.abs(event.clientX - current.x);
  const dy = Math.abs(event.clientY - current.y);
  if (dx > 10 || dy > 10) return;
  toggleHit(current.measure, current.instrument, current.step);
}

function onAppContextMenu(event) {
  const cell = cellFromEvent(event);
  if (!cell || state.mode !== "compose") return;
  event.preventDefault();
  const { measure, instrument, step } = cell.dataset;
  openHitMenu(measure, instrument, Number(step), event.clientX, event.clientY);
}

function onAppDoubleClick(event) {
  const cell = cellFromEvent(event);
  if (!cell || state.mode !== "compose") return;
  const { measure, instrument, step } = cell.dataset;
  if (openHitMenu(measure, instrument, Number(step), event.clientX, event.clientY)) {
    event.preventDefault();
  }
}

function openHitMenu(measureId, instrument, step, x, y) {
  const found = findMeasure(state.song, measureId);
  if (!found?.measure.hits[hitKey(instrument, step)]) return false;
  state.menus.hit = {
    measureId,
    instrument,
    step,
    view: "root",
    x,
    y,
  };
  render();
  return true;
}

function onSlider(event) {
  const menu = state.menus.hit;
  if (!menu) return;
  const value = Number(event.currentTarget.value);
  if (event.currentTarget.dataset.action === "set-velocity") {
    updateHit(menu.measureId, menu.instrument, menu.step, { velocity: value }, false);
    const found = findMeasure(state.song, menu.measureId);
    const hit = found.measure.hits[hitKey(menu.instrument, menu.step)];
    audio.play(menu.instrument, value, hit.articulation);
  } else {
    updateHit(menu.measureId, menu.instrument, menu.step, { timing: value }, false);
  }
}

function onSaveSettings(event) {
  event.preventDefault();
  const data = new FormData(event.currentTarget);
  state.song.title = String(data.get("title") || "My Drum Beat");
  state.song.bpm = Math.max(40, Math.min(220, Number(data.get("bpm")) || 100));
  closeMenus();
  render();
}

function onToggleRow(event) {
  const measureId = event.currentTarget.dataset.measure;
  const instrument = event.currentTarget.dataset.instrument;
  const found = findMeasure(state.song, measureId);
  if (!found) return;
  if (event.currentTarget.checked) {
    if (!found.measure.rows.includes(instrument)) {
      found.measure.rows = sortRows([...found.measure.rows, instrument]);
    }
  } else if (found.measure.rows.length > 1) {
    found.measure.rows = found.measure.rows.filter((id) => id !== instrument);
  }
  render();
}

function onAction(event) {
  const action = event.currentTarget.dataset.action;
  const section = currentSection();
  event.stopPropagation();

  if (action === "dismiss") {
    closeMenus();
    render();
    return;
  }
  if (action === "mode") {
    state.mode = event.currentTarget.dataset.mode;
    closeMenus();
    render();
    return;
  }
  if (action === "section") {
    state.selectedSectionId = event.currentTarget.dataset.id;
    if (state.mode === "perform") {
      refreshSectionStrip();
      scrollPerformToSection(state.selectedSectionId);
      return;
    }
    render();
    return;
  }
  if (action === "kit-hit") {
    audio.play(event.currentTarget.dataset.instrument, 90, event.currentTarget.dataset.instrument === "hat" ? "closed" : null);
    return;
  }
  if (action === "settings") {
    state.menus.settings = true;
    render();
    return;
  }
  if (action === "add-section") {
    state.menus.addSection = true;
    render();
    return;
  }
  if (action === "create-section") {
    const name = event.currentTarget.dataset.name;
    const next = {
      id: uid("s"),
      name,
      color: SECTION_COLORS[name],
      measures: [createMeasure()],
    };
    state.song.sections.push(next);
    state.selectedSectionId = next.id;
    closeMenus();
    render();
    return;
  }
  if (action === "loop") {
    state.looping = !state.looping;
    render();
    return;
  }
  if (action === "return") {
    returnToStart();
    return;
  }
  if (action === "play") {
    onPlayGesture(event);
    return;
  }
  if (action === "add-piece") {
    audio.unlock();
    state.menus.addPiece = event.currentTarget.dataset.measure;
    state.menus.measure = null;
    render();
    return;
  }
  if (action === "pick-piece") {
    const measureId = event.currentTarget.dataset.measure;
    const instrument = event.currentTarget.dataset.instrument;
    const found = findMeasure(state.song, measureId);
    if (found && !found.measure.rows.includes(instrument)) {
      found.measure.rows = sortRows([...found.measure.rows, instrument]);
      audio.play(instrument, 90, instrument === "hat" ? "closed" : null);
    }
    closeMenus();
    render();
    return;
  }
  if (action === "measure-menu") {
    const rect = event.currentTarget.getBoundingClientRect();
    state.menus.measure = {
      measureId: event.currentTarget.dataset.measure,
      view: "root",
      x: rect.left,
      y: rect.bottom,
    };
    render();
    return;
  }
  if (action === "measure-view") {
    state.menus.measure.view = event.currentTarget.dataset.view;
    render();
    return;
  }
  if (action === "set-grid") {
    const found = findMeasure(state.song, state.menus.measure.measureId);
    const next = Number(event.currentTarget.dataset.value);
    found.measure.hits = remapHits(found.measure, next);
    found.measure.gridDivision = next;
    closeMenus();
    render();
    return;
  }
  if (action === "edit-rows") {
    state.menus.editRows = state.menus.measure.measureId;
    state.menus.measure = null;
    render();
    return;
  }
  if (action === "delete-measure") {
    removeMeasure(section, state.menus.measure.measureId);
    closeMenus();
    render();
    return;
  }
  if (action === "duplicate-measure") {
    const found = findMeasure(state.song, state.menus.measure.measureId);
    const index = found.section.measures.findIndex((item) => item.id === found.measure.id);
    insertMeasure(found.section, index + 1, cloneMeasure(found.measure));
    closeMenus();
    render();
    return;
  }
  if (action === "add-above" || action === "add-below") {
    const found = findMeasure(state.song, state.menus.measure.measureId);
    const index = found.section.measures.findIndex((item) => item.id === found.measure.id);
    insertMeasure(found.section, action === "add-above" ? index : index + 1);
    closeMenus();
    render();
    return;
  }
  if (action === "hit-view") {
    state.menus.hit.view = event.currentTarget.dataset.view;
    render();
    return;
  }
  if (action === "set-art") {
    const menu = state.menus.hit;
    updateHit(menu.measureId, menu.instrument, menu.step, {
      articulation: event.currentTarget.dataset.value,
    });
    const found = findMeasure(state.song, menu.measureId);
    const hit = found.measure.hits[hitKey(menu.instrument, menu.step)];
    audio.play(menu.instrument, hit.velocity, hit.articulation);
    return;
  }
}

let lastPlayGestureAt = 0;

function onPlayUnlock() {
  audio.unlock();
}

function onPlayGesture(event) {
  event.preventDefault();
  event.stopPropagation();
  audio.unlock();
  const now = performance.now();
  if (now - lastPlayGestureAt < 350) return;
  lastPlayGestureAt = now;
  togglePlayback();
}

function togglePlayback() {
  audio.unlock();
  if (state.playing) {
    stopPlayback(true);
    return;
  }
  startPlayback();
}

function startPlayback() {
  if (!songTimeline().length) return;
  audio.unlock();
  state.playing = true;
  playOffsetBeats = 0;
  state.playMeasureIndex = 0;
  state.playStep = 0;
  scheduledUntil = 0;

  const first = songTimeline()[0];
  if (first) {
    first.measure.rows.forEach((id) => {
      const hit = first.measure.hits[hitKey(id, 0)];
      if (hit) audio.play(id, hit.velocity, hit.articulation, 0);
    });
    scheduledUntil = 4 / first.measure.gridDivision;
  }

  playOrigin = audio.currentTime;
  playOffsetBeats = 0;
  render();
  pumpScheduler();
  window.clearInterval(schedulerTimer);
  schedulerTimer = window.setInterval(() => pumpScheduler(), 40);
  const tick = () => {
    if (!state.playing) return;
    updatePlayhead();
    updateKitNotes();
    playheadFrame = window.requestAnimationFrame(tick);
  };
  playheadFrame = window.requestAnimationFrame(tick);
}

function totalBeats() {
  return Math.max(1, songTimeline().length * 4);
}

function currentSongBeats() {
  if (!state.playing) return 0;
  const elapsed = (audio.currentTime - playOrigin) * (state.song.bpm / 60) + playOffsetBeats;
  const length = totalBeats();
  if (state.looping) return ((elapsed % length) + length) % length;
  return Math.min(Math.max(0, elapsed), length);
}

function locate(beats) {
  const items = songTimeline();
  for (const item of items) {
    if (beats < item.startBeat + 4) {
      const step = Math.floor((beats - item.startBeat) * (item.measure.gridDivision / 4));
      return { ...item, step: Math.max(0, step) };
    }
  }
  const last = items.at(-1);
  return last ? { ...last, step: 0 } : null;
}

let scheduledUntil = 0;

function scheduleFrom(startBeat, startTime) {
  scheduledUntil = startBeat;
  playOrigin = startTime;
  playOffsetBeats = startBeat;
}

function pumpScheduler() {
  if (!state.playing) return;
  const horizon = 0.18;
  const now = audio.currentTime;
  const elapsedBeats = (now - playOrigin) * (state.song.bpm / 60) + playOffsetBeats;
  const length = totalBeats();
  if (elapsedBeats >= length) {
    if (state.looping) {
      playOrigin = now;
      playOffsetBeats = 0;
      scheduledUntil = 0;
    } else {
      stopPlayback(true);
      return;
    }
  }

  const lookBeats = ((now + horizon - playOrigin) * state.song.bpm) / 60 + playOffsetBeats;
  const wrappedLook = state.looping ? lookBeats % length : Math.min(lookBeats, length);
  scheduleHits(scheduledUntil % length, wrappedLook);
  scheduledUntil = lookBeats;
  updatePlayhead();
}

function scheduleHits(fromBeat, toBeat) {
  const items = songTimeline();
  if (toBeat < fromBeat) {
    scheduleHits(fromBeat, totalBeats());
    scheduleHits(0, toBeat);
    return;
  }
  items.forEach((item) => {
    const stepBeats = 4 / item.measure.gridDivision;
    for (let step = 0; step < item.measure.gridDivision; step += 1) {
      const beat = item.startBeat + step * stepBeats;
      if (beat >= fromBeat && beat < toBeat) {
        const when = playOrigin + ((beat - playOffsetBeats) * 60) / state.song.bpm;
        KIT.forEach((inst) => {
          if (!item.measure.rows.includes(inst.id)) return;
          const hit = item.measure.hits[hitKey(inst.id, step)];
          if (!hit) return;
          const timing = (hit.timing || 0) / 1000;
          audio.play(inst.id, hit.velocity, hit.articulation, Math.max(audio.currentTime, when + timing));
        });
      }
    }
  });
}

function updatePlayhead() {
  document.querySelectorAll(".playhead, .beat-bar").forEach((el) => el.remove());
  const pos = locate(currentSongBeats());
  if (!pos) return;

  if (state.mode === "compose") {
    const article = document.querySelector(`[data-measure-el="${pos.measure.id}"]`);
    if (!article) return;
    const cells = article.querySelectorAll(".cell");
    const first = cells[pos.step];
    if (!first) return;
    const grid = article.querySelector(".measure-grid");
    const rect = grid.getBoundingClientRect();
    const cellRect = first.getBoundingClientRect();
    const playhead = document.createElement("div");
    playhead.className = "playhead";
    playhead.style.left = `${cellRect.left - rect.left}px`;
    grid.appendChild(playhead);
    const beatStart =
      Math.floor(pos.step / (pos.measure.gridDivision / 4)) * (pos.measure.gridDivision / 4);
    const beatCell = cells[beatStart];
    const beatEnd = cells[Math.min(cells.length - 1, beatStart + pos.measure.gridDivision / 4 - 1)];
    if (beatCell && beatEnd) {
      const bar = document.createElement("div");
      bar.className = "beat-bar";
      const start = beatCell.getBoundingClientRect();
      const end = beatEnd.getBoundingClientRect();
      bar.style.left = `${start.left - rect.left}px`;
      bar.style.width = `${end.right - start.left}px`;
      grid.appendChild(bar);
    }
    return;
  }

  if (state.mode === "perform") {
    const card = document.querySelector(`[data-staff-measure="${pos.measure.id}"]`);
    if (!card) return;
    const svg = card.querySelector("svg");
    if (!svg) return;
    const frac = (currentSongBeats() - pos.startBeat) / 4;
    const playhead = document.createElement("div");
    playhead.className = "playhead staff-playhead";
    playhead.style.left = `${(58 + (790 * Math.min(1, Math.max(0, frac)))) * (svg.clientWidth / 860)}px`;
    card.appendChild(playhead);
    if (state.playing && pos.section.id !== state.selectedSectionId) {
      state.selectedSectionId = pos.section.id;
      refreshSectionStrip();
    }
    if (state.playing) followPerformPlayhead(card);
  }
}

function updateKitNotes() {
  const stage = app.querySelector(".kit-stage");
  if (!stage) return;
  const nowBeat = currentSongBeats();
  const ahead = 3;
  const length = totalBeats();
  KIT.forEach((inst) => {
    const piece = stage.querySelector(`.kit-${inst.id}`);
    const lane = stage.querySelector(`[data-lane="${inst.id}"]`);
    const pad = stage.querySelector(`.kit-${inst.id} .kit-pad`);
    if (!lane || !piece || piece.classList.contains("ghost")) return;
    const notes = [];
    songTimeline().forEach((item) => {
      const stepBeats = 4 / item.measure.gridDivision;
      for (let step = 0; step < item.measure.gridDivision; step += 1) {
        if (!item.measure.rows.includes(inst.id)) continue;
        const hit = item.measure.hits[hitKey(inst.id, step)];
        if (!hit) continue;
        const beat = item.startBeat + step * stepBeats;
        let delta = beat - nowBeat;
        if (state.looping && state.playing && delta < -0.15) delta += length;
        if (delta < -0.12 || delta > ahead) continue;
        notes.push({
          t: Math.max(0, delta / ahead),
          hit,
          open: inst.id === "hat" && hit.articulation === "open",
          hot: Math.abs(delta) < 0.08,
        });
      }
    });
    lane.innerHTML = notes
      .map((note) => {
        const scale = 0.4 + (1 - note.t) * 0.75;
        return `<span class="kit-note ${note.open ? "open" : ""} ${note.hot ? "hot" : ""}" style="--hit:${velocityColor(note.hit.velocity)};top:${note.t * 100}%;--s:${scale}"></span>`;
      })
      .join("");
    pad?.classList.toggle("strike", notes.some((note) => note.hot));
  });
}

let suppressScrollSelect = false;
let followLock = 0;

function refreshSectionStrip() {
  app.querySelectorAll(".section-chip[data-id]").forEach((el) => {
    el.classList.toggle("active", el.dataset.id === state.selectedSectionId);
  });
}

function scrollPerformToSection(sectionId) {
  const workspace = app.querySelector(".workspace");
  const target = app.querySelector(`[data-staff-section="${sectionId}"]`);
  if (!workspace || !target) return;
  suppressScrollSelect = true;
  target.scrollIntoView({ behavior: "smooth", block: "start" });
  window.setTimeout(() => {
    suppressScrollSelect = false;
  }, 450);
}

function followPerformPlayhead(card) {
  const now = performance.now();
  if (now - followLock < 240) return;
  const workspace = app.querySelector(".workspace");
  if (!workspace) return;
  const cardTop = card.offsetTop;
  const viewTop = workspace.scrollTop;
  const viewBottom = viewTop + workspace.clientHeight;
  if (cardTop < viewTop + 40 || cardTop > viewBottom - 120) {
    followLock = now;
    workspace.scrollTo({ top: Math.max(0, cardTop - 48), behavior: "smooth" });
  }
}

function onWorkspaceScroll() {
  if (state.mode !== "perform" || suppressScrollSelect) return;
  const workspace = app.querySelector(".workspace");
  if (!workspace) return;
  const labels = [...app.querySelectorAll(".staff-section-label[data-staff-section]")];
  if (!labels.length) return;
  const marker = workspace.scrollTop + 72;
  let current = labels[0].dataset.staffSection;
  labels.forEach((label) => {
    if (label.offsetTop <= marker) current = label.dataset.staffSection;
  });
  if (current && current !== state.selectedSectionId) {
    state.selectedSectionId = current;
    refreshSectionStrip();
  }
}

function stopPlayback(renderAfter) {
  state.playing = false;
  window.clearInterval(schedulerTimer);
  window.cancelAnimationFrame(playheadFrame);
  if (renderAfter) render();
}

function returnToStart() {
  playOrigin = audio.currentTime;
  playOffsetBeats = 0;
  state.playMeasureIndex = 0;
  state.playStep = 0;
  if (state.playing) {
    scheduledUntil = 0;
  }
  render();
}

window.addEventListener("resize", () => {
  if (state.playing) updatePlayhead();
});

app.addEventListener("pointerdown", () => {
  audio.unlock();
});
app.addEventListener("pointerdown", onAppPointerDown);
window.addEventListener("pointermove", onAppPointerMove, { passive: true });
window.addEventListener("pointerup", onAppPointerUp);
app.addEventListener("contextmenu", onAppContextMenu);
app.addEventListener("dblclick", onAppDoubleClick);
render();
