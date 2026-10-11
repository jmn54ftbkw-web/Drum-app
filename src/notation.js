import { hitKey } from "./song.js";

const STAFF_TOP = 36;
const LINE_GAP = 12;
const STAFF_LEFT = 58;

const PITCH = {
  crash: STAFF_TOP - LINE_GAP,
  hat: STAFF_TOP - LINE_GAP / 2,
  ride: STAFF_TOP,
  tom2: STAFF_TOP + LINE_GAP * 1.5,
  snare: STAFF_TOP + LINE_GAP * 2.5,
  kick: STAFF_TOP + LINE_GAP * 4.5,
};

const UP_VOICE = ["hat", "crash", "ride"];
const DOWN_VOICE = ["kick", "snare", "tom2"];

function hitsAt(measure, step, ids) {
  return ids
    .map((id) => {
      const hit = measure.hits[hitKey(id, step)];
      return hit ? { id, hit } : null;
    })
    .filter(Boolean);
}

function durationFromSteps(steps, division) {
  const beats = steps * (4 / division);
  if (Math.abs(beats - 4) < 0.01) return { name: "w", dots: 0, beamable: false };
  if (Math.abs(beats - 3) < 0.01) return { name: "h", dots: 1, beamable: false };
  if (Math.abs(beats - 2) < 0.01) return { name: "h", dots: 0, beamable: false };
  if (Math.abs(beats - 1.5) < 0.01) return { name: "q", dots: 1, beamable: false };
  if (Math.abs(beats - 1) < 0.01) return { name: "q", dots: 0, beamable: false };
  if (Math.abs(beats - 0.75) < 0.01) return { name: "8", dots: 1, beamable: true };
  if (Math.abs(beats - 0.5) < 0.01) return { name: "8", dots: 0, beamable: true };
  if (Math.abs(beats - 0.375) < 0.01) return { name: "16", dots: 1, beamable: true };
  if (Math.abs(beats - 0.25) < 0.01) return { name: "16", dots: 0, beamable: true };
  if (Math.abs(beats - 0.125) < 0.01) return { name: "32", dots: 0, beamable: true };
  if (beats >= 2) return { name: "h", dots: 0, beamable: false };
  if (beats >= 1) return { name: "q", dots: 0, beamable: false };
  if (beats >= 0.5) return { name: "8", dots: 0, beamable: true };
  if (beats >= 0.25) return { name: "16", dots: 0, beamable: true };
  return { name: "32", dots: 0, beamable: true };
}

function voiceEvents(measure, ids) {
  const steps = measure.gridDivision;
  const occupied = [];
  for (let step = 0; step < steps; step += 1) {
    const notes = hitsAt(measure, step, ids);
    if (notes.length) occupied.push({ step, notes });
  }

  const events = [];
  let cursor = 0;
  occupied.forEach((item, index) => {
    if (item.step > cursor) {
      events.push({
        step: cursor,
        rest: true,
        notes: [],
        ...durationFromSteps(item.step - cursor, steps),
      });
    }
    const nextStep = index < occupied.length - 1 ? occupied[index + 1].step : steps;
    events.push({
      step: item.step,
      rest: false,
      notes: item.notes,
      ...durationFromSteps(nextStep - item.step, steps),
    });
    cursor = nextStep;
  });

  if (cursor < steps) {
    events.push({
      step: cursor,
      rest: true,
      notes: [],
      ...durationFromSteps(steps - cursor, steps),
    });
  }

  if (!events.length) {
    events.push({
      step: 0,
      rest: true,
      notes: [],
      ...durationFromSteps(steps, steps),
    });
  }
  return events;
}

function xNotehead(x, y, open) {
  const s = 5.4;
  let svg = `<line class="x-head" x1="${x - s}" y1="${y - s}" x2="${x + s}" y2="${y + s}" />
    <line class="x-head" x1="${x + s}" y1="${y - s}" x2="${x - s}" y2="${y + s}" />`;
  if (open) svg += `<circle class="open-hat" cx="${x}" cy="${y}" r="7.6" />`;
  return svg;
}

function ovalNotehead(x, y, filled) {
  if (filled) {
    return `<ellipse cx="${x}" cy="${y}" rx="7" ry="5" transform="rotate(-20 ${x} ${y})" fill="#f2f2f7" stroke="none" />`;
  }
  return `<ellipse cx="${x}" cy="${y}" rx="7" ry="5" transform="rotate(-20 ${x} ${y})" fill="#000" stroke="#f2f2f7" stroke-width="1.5" />`;
}

function restMark(x, midY, name) {
  if (name === "w") return `<rect class="rest-mark" x="${x - 8}" y="${midY - 14}" width="16" height="4" />`;
  if (name === "h") return `<rect class="rest-mark" x="${x - 8}" y="${midY - 4}" width="16" height="4" />`;
  if (name === "q") {
    return `<path class="rest-mark" d="M ${x + 3} ${midY - 18} c -6 8 -1 12 2 16 c -8 2 -8 12 0 16 c -10 -8 -6 -20 2 -24 c -4 -4 -6 -6 -4 -8 z" />`;
  }
  if (name === "8") {
    return `<g>
      <circle class="rest-mark" cx="${x - 2}" cy="${midY - 2}" r="3.1" />
      <path class="flag-mark" d="M ${x + 1} ${midY - 2} C ${x + 8} ${midY + 4}, ${x + 4} ${midY + 16}, ${x + 2} ${midY + 20}" />
    </g>`;
  }
  return `<g>
    <circle class="rest-mark" cx="${x - 3}" cy="${midY - 6}" r="2.5" />
    <circle class="rest-mark" cx="${x + 1}" cy="${midY + 2}" r="2.5" />
    <path class="flag-mark" d="M ${x + 2} ${midY - 6} C ${x + 8} ${midY + 2}, ${x + 5} ${midY + 16}, ${x + 3} ${midY + 20}" />
  </g>`;
}

function flags(x, y1, y2, up, count) {
  const dir = up ? 1 : -1;
  let svg = "";
  for (let i = 0; i < count; i += 1) {
    const y = y2 + i * 6 * (up ? 1 : -1);
    svg += `<path class="flag-mark" d="M ${x} ${y} C ${x + 11 * dir} ${y + 3}, ${x + 12 * dir} ${y + 12}, ${x + 3 * dir} ${y + 16}" />`;
  }
  return svg;
}

function flagCount(name) {
  if (name === "8") return 1;
  if (name === "16") return 2;
  if (name === "32") return 3;
  return 0;
}

function renderVoice(events, division, width, up) {
  const staffWidth = width - STAFF_LEFT - 18;
  const xOf = (step) => STAFF_LEFT + 18 + (step / division) * staffWidth;
  const midY = STAFF_TOP + LINE_GAP * 2;
  const stemLen = 28;
  let svg = "";

  const drawn = events.map((event) => {
    const x = xOf(event.step);
    if (event.rest) {
      svg += restMark(x, midY + (up ? -6 : 8), event.name);
      if (event.dots) svg += `<circle cx="${x + 10}" cy="${midY}" r="1.6" />`;
      return { ...event, x, stemY: midY, tipY: midY };
    }

    const ys = event.notes.map((note) => PITCH[note.id]);
    const yMin = Math.min(...ys);
    const yMax = Math.max(...ys);
    const tipY = up ? yMin - stemLen : yMax + stemLen;
    const stemY = up ? yMax : yMin;
    const stemX = up ? x + 5.6 : x - 5.6;

    event.notes.forEach((note) => {
      const y = PITCH[note.id];
      const isCymbal = note.id === "hat" || note.id === "crash" || note.id === "ride";
      if (isCymbal) {
        svg += xNotehead(x, y, note.id === "hat" && note.hit.articulation === "open");
        if (note.id === "hat" && note.hit.articulation === "open") {
          svg += `<text class="art-mark" x="${x}" y="${y - 12}">o</text>`;
        }
      } else {
        svg += ovalNotehead(x, y, event.name !== "w" && event.name !== "h");
      }
      if (note.hit.velocity >= 110) {
        const markY = up ? yMin - 36 : yMax + 38;
        svg += `<text class="art-mark" x="${x}" y="${markY}">&gt;</text>`;
      }
    });

    if (event.name !== "w") {
      svg += `<line class="note-stem" x1="${stemX}" y1="${stemY}" x2="${stemX}" y2="${tipY}" />`;
    }
    if (event.dots) svg += `<circle cx="${x + 11}" cy="${ys[0]}" r="1.6" />`;
    return { ...event, x, stemX, stemY, tipY };
  });

  const beatSteps = division / 4;
  for (let beat = 0; beat < 4; beat += 1) {
    const start = beat * beatSteps;
    const end = start + beatSteps;
    const group = drawn.filter(
      (event) => !event.rest && event.beamable && event.step >= start && event.step < end
    );
    if (group.length >= 2) {
      const y = up
        ? Math.min(...group.map((item) => item.tipY))
        : Math.max(...group.map((item) => item.tipY));
      const layers = Math.max(...group.map((item) => flagCount(item.name)));
      for (let layer = 0; layer < layers; layer += 1) {
        const offset = layer * 5 * (up ? 1 : -1);
        svg += `<line class="beam" x1="${group[0].stemX}" y1="${y + offset}" x2="${group[group.length - 1].stemX}" y2="${y + offset}" />`;
      }
    } else if (group.length === 1 && group[0].name !== "q") {
      svg += flags(group[0].stemX, group[0].stemY, group[0].tipY, up, flagCount(group[0].name));
    }
  }

  drawn
    .filter((event) => !event.rest && event.beamable)
    .forEach((event) => {
      const beat = Math.floor(event.step / beatSteps);
      const peers = drawn.filter(
        (other) =>
          !other.rest &&
          other.beamable &&
          Math.floor(other.step / beatSteps) === beat
      );
      if (peers.length === 1 && event.name !== "q") {
        // flags already added
      }
    });

  return svg;
}

function percussionClef(x, y) {
  return `<g class="clef">
    <rect x="${x}" y="${y + 8}" width="5" height="32" rx="1" />
    <rect x="${x + 9}" y="${y + 8}" width="5" height="32" rx="1" />
  </g>`;
}

export function renderMeasureStaff(measure, number, width = 720) {
  const height = 132;
  const lines = Array.from({ length: 5 }, (_, i) => {
    const y = STAFF_TOP + i * LINE_GAP;
    return `<line x1="${STAFF_LEFT}" y1="${y}" x2="${width - 12}" y2="${y}" />`;
  }).join("");

  const up = voiceEvents(measure, UP_VOICE);
  const down = voiceEvents(measure, DOWN_VOICE);

  return `<svg class="staff-svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" aria-label="Measure ${number} drum staff">
    <g class="staff-lines">${lines}</g>
    ${percussionClef(18, STAFF_TOP)}
    <text class="time-sig" x="42" y="${STAFF_TOP + 20}">4</text>
    <text class="time-sig" x="42" y="${STAFF_TOP + 44}">4</text>
    <text class="bar-num" x="8" y="18">${number}</text>
    <g class="voice-up">${renderVoice(up, measure.gridDivision, width, true)}</g>
    <g class="voice-down">${renderVoice(down, measure.gridDivision, width, false)}</g>
    <line x1="${width - 12}" y1="${STAFF_TOP}" x2="${width - 12}" y2="${STAFF_TOP + LINE_GAP * 4}" />
  </svg>`;
}
