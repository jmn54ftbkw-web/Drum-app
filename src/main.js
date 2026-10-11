import { createAudio } from "./audio.js";
import { renderMeasureStaff } from "./notation.js";
import {
  KIT,
  SECTION_COLORS,
  GRID_DIVISIONS,
  cloneMeasure,
  createMeasure,
  createSong,
  findMeasure,
  findSection,
  hitKey,
  instrumentById,
  remapHits,
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
  render();
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

function kitGlyph(id) {
  if (id === "kick") {
    return `<svg viewBox="0 0 24 24"><circle cx="12" cy="13" r="7" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="12" cy="13" r="2" fill="currentColor"/></svg>`;
  }
  if (id === "snare") {
    return `<svg viewBox="0 0 24 24"><ellipse cx="12" cy="10" rx="7" ry="3" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M5 10v5c0 1.7 3.1 3 7 3s7-1.3 7-3v-5" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>`;
  }
  if (id === "hat") {
    return `<svg viewBox="0 0 24 24"><path d="M4 13h16M7 13l5-4 5 4M8 16h8" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>`;
  }
  if (id === "crash" || id === "ride") {
    return `<svg viewBox="0 0 24 24"><ellipse cx="12" cy="12" rx="8" ry="2.4" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M12 6v12" stroke="currentColor" stroke-width="1.6"/></svg>`;
  }
  return `<svg viewBox="0 0 24 24"><ellipse cx="12" cy="12" rx="6" ry="5" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M8 12h8" stroke="currentColor"/></svg>`;
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
          ? `<div class="gutter"><button data-action="nudge-insert" data-measure="${measure.id}">${icon("handle")}</button></div>`
          : `<div class="gutter"></div>`;
      const cells = Array.from({ length: measure.gridDivision }, (_, step) => {
        return `<div class="cell ${isBeatStart(step, measure.gridDivision) ? "beat-start" : ""}" role="button" tabindex="0" data-action="cell" data-measure="${measure.id}" data-instrument="${instrument}" data-step="${step}">${renderHit(measure, instrument, step)}</div>`;
      }).join("");
      return `${handle}<div class="row-icon">${kitGlyph(instrument)}<span>${inst.abbr}</span></div>${cells}<div class="gutter"></div>`;
    })
    .join("");

  return `<article class="measure" data-measure-el="${measure.id}" style="--cols:${measure.gridDivision}">
    <div class="measure-grid">${header}${body}</div>
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
        const insert =
          index < measures.length - 1
            ? `<button class="insert" data-action="insert-after" data-measure="${measure.id}"><span>+</span> Add</button>`
            : "";
        return `${renderMeasure(measure, index)}${insert}`;
      })
      .join("")}
    <div class="add-end"><button data-action="add-end" aria-label="Add measure">+</button></div>
  </div>`;
}

function renderPerform() {
  const section = currentSection();
  return `<div class="perform">
    <div class="perform-heading">
      <h2>${section.name}</h2>
      <p>${state.song.timeFeel} · ${state.song.bpm} BPM</p>
    </div>
    ${section.measures
      .map(
        (measure, index) =>
          `<div class="staff-card">${renderMeasureStaff(measure, index + 1, 860)}</div>`
      )
      .join("")}
  </div>`;
}

function popoverHtml() {
  const { hit, measure, settings, editRows, addSection } = state.menus;
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
  const below = y < window.innerHeight - 280;
  const top = below ? y + 18 : y - 210;
  const left = Math.min(Math.max(12, x - 40), window.innerWidth - 250);

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

  return `<div class="popover ${below ? "below" : "above"}" style="top:${top}px;left:${left}px;--caret-x:28px" onclick="event.stopPropagation()">${body}</div>`;
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

function render() {
  const playSvg = state.playing ? icon("pause") : icon("play");
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
        ${state.mode === "perform" ? renderPerform() : renderCompose()}
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
  updatePlayhead();
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
  };
  const found = findMeasure(state.song, measure);
  const existing = found?.measure.hits[hitKey(instrument, Number(step))];
  holdTimer = window.setTimeout(() => {
    if (!press || !existing) return;
    holdFired = true;
    openHitMenu(press.measure, press.instrument, press.step, press.x, press.y);
  }, HOLD_MS);
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
  const dx = Math.abs(event.clientX - current.x);
  const dy = Math.abs(event.clientY - current.y);
  if (dx > 18 || dy > 18) return;
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
      const order = KIT.map((item) => item.id);
      found.measure.rows = order.filter(
        (id) => found.measure.rows.includes(id) || id === instrument
      );
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
    stopPlayback(false);
    render();
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
    togglePlayback();
    return;
  }
  if (action === "add-end") {
    insertMeasure(section, section.measures.length);
    render();
    return;
  }
  if (action === "insert-after" || action === "nudge-insert") {
    const measureId = event.currentTarget.dataset.measure;
    const index = section.measures.findIndex((item) => item.id === measureId);
    insertMeasure(section, action === "insert-after" ? index + 1 : index);
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

async function togglePlayback() {
  await audio.unlock();
  if (state.playing) {
    stopPlayback(true);
    return;
  }
  startPlayback();
}

function startPlayback() {
  const measures = sectionMeasures();
  if (!measures.length) return;
  state.playing = true;
  playOrigin = audio.currentTime + 0.06;
  playOffsetBeats = 0;
  state.playMeasureIndex = 0;
  state.playStep = 0;
  render();
  scheduleFrom(0, 0);
  schedulerTimer = window.setInterval(() => pumpScheduler(), 40);
  const tick = () => {
    if (!state.playing) return;
    updatePlayhead();
    playheadFrame = window.requestAnimationFrame(tick);
  };
  playheadFrame = window.requestAnimationFrame(tick);
}

function totalBeats() {
  return sectionMeasures().reduce((sum, measure) => sum + 4, 0);
}

function locate(beats) {
  let remaining = beats;
  const measures = sectionMeasures();
  for (let i = 0; i < measures.length; i += 1) {
    if (remaining < 4) {
      const step = Math.floor(remaining * (measures[i].gridDivision / 4));
      return { measureIndex: i, step, measure: measures[i] };
    }
    remaining -= 4;
  }
  return { measureIndex: measures.length - 1, step: 0, measure: measures.at(-1) };
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
  const measures = sectionMeasures();
  if (toBeat < fromBeat) {
    scheduleHits(fromBeat, totalBeats());
    scheduleHits(0, toBeat);
    return;
  }
  let cursor = 0;
  measures.forEach((measure) => {
    const stepBeats = 4 / measure.gridDivision;
    for (let step = 0; step < measure.gridDivision; step += 1) {
      const beat = cursor + step * stepBeats;
      if (beat >= fromBeat && beat < toBeat) {
        const when = playOrigin + ((beat - playOffsetBeats) * 60) / state.song.bpm;
        KIT.forEach((inst) => {
          const hit = measure.hits[hitKey(inst.id, step)];
          if (!hit) return;
          const timing = (hit.timing || 0) / 1000;
          audio.play(inst.id, hit.velocity, hit.articulation, Math.max(audio.currentTime, when + timing));
        });
      }
    }
    cursor += 4;
  });
}

function updatePlayhead() {
  document.querySelectorAll(".playhead, .beat-bar").forEach((el) => el.remove());
  if (!state.playing && state.mode === "perform") return;
  const measures = sectionMeasures();
  if (!measures.length) return;
  const now = audio.currentTime;
  const elapsedBeats = state.playing
    ? Math.max(0, (now - playOrigin) * (state.song.bpm / 60) + playOffsetBeats)
    : 0;
  const pos = locate(elapsedBeats % Math.max(totalBeats(), 0.0001));
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

  const beatStart = Math.floor(pos.step / (pos.measure.gridDivision / 4)) * (pos.measure.gridDivision / 4);
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
window.addEventListener("pointerup", onAppPointerUp);
app.addEventListener("contextmenu", onAppContextMenu);
app.addEventListener("dblclick", onAppDoubleClick);
render();
