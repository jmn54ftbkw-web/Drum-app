const KIT_GAIN = {
  kick: 1,
  snare: 0.78,
  hat: 0.42,
  crash: 0.55,
  ride: 0.4,
  tomHigh1: 0.78,
  tomHigh2: 0.8,
  tom1: 0.82,
  tom2: 0.85,
  floorTom: 0.9,
  floorTom1: 0.88,
  floorTom2: 0.92,
  cowbell: 0.55,
  tambourine: 0.48,
  clap: 0.7,
  splash: 0.5,
  crash2: 0.52,
  trash: 0.58,
};

function write(buffer, fn) {
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i += 1) {
    data[i] = fn(i / buffer.sampleRate, i, buffer.sampleRate);
  }
  return buffer;
}

function makeKick(ctx) {
  const seconds = 0.5;
  const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * seconds), ctx.sampleRate);
  return write(buffer, (t) => {
    const freq = 42 + 120 * Math.exp(-t * 22);
    const body = Math.sin(2 * Math.PI * freq * t) * Math.exp(-t * 7.2);
    const click = Math.sin(2 * Math.PI * 1800 * t) * Math.exp(-t * 90) * 0.22;
    return (body + click) * 1.15;
  });
}

function makeTom(ctx, startHz) {
  const seconds = 0.55;
  const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * seconds), ctx.sampleRate);
  return write(buffer, (t) => {
    const freq = startHz * Math.exp(-t * 4.2) + 18;
    const body = Math.sin(2 * Math.PI * freq * t) * Math.exp(-t * 5.4);
    const noise = (Math.random() * 2 - 1) * Math.exp(-t * 28) * 0.08;
    return body + noise;
  });
}

function makeSnare(ctx) {
  const seconds = 0.32;
  const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * seconds), ctx.sampleRate);
  return write(buffer, (t) => {
    const tone = Math.sin(2 * Math.PI * 190 * t) * Math.exp(-t * 16) * 0.45;
    const noise = (Math.random() * 2 - 1) * Math.exp(-t * 14) * 0.7;
    return tone + noise;
  });
}

function makeCowbell(ctx) {
  const seconds = 0.38;
  const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * seconds), ctx.sampleRate);
  return write(buffer, (t) => {
    const a = Math.sin(2 * Math.PI * 800 * t) * Math.exp(-t * 11);
    const b = Math.sin(2 * Math.PI * 540 * t) * Math.exp(-t * 9) * 0.72;
    const clang = Math.sin(2 * Math.PI * 1280 * t) * Math.exp(-t * 28) * 0.22;
    const click = (Math.random() * 2 - 1) * Math.exp(-t * 70) * 0.12;
    return a + b + clang + click;
  });
}

function makeTambourine(ctx) {
  const seconds = 0.45;
  const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * seconds), ctx.sampleRate);
  return write(buffer, (t) => {
    const jingle = 0.55 + 0.45 * Math.abs(Math.sin(2 * Math.PI * 42 * t));
    const noise = (Math.random() * 2 - 1) * Math.exp(-t * 8) * jingle;
    const shell = Math.sin(2 * Math.PI * 210 * t) * Math.exp(-t * 18) * 0.12;
    return noise * 0.85 + shell;
  });
}

function makeClap(ctx) {
  const seconds = 0.28;
  const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * seconds), ctx.sampleRate);
  return write(buffer, (t) => {
    const bursts = [0, 0.012, 0.024, 0.048];
    let amp = 0;
    bursts.forEach((start, i) => {
      if (t >= start) {
        amp += Math.exp(-(t - start) * (26 + i * 6)) * (i === bursts.length - 1 ? 1 : 0.55);
      }
    });
    return (Math.random() * 2 - 1) * amp * 0.9;
  });
}

function makeNoiseBurst(ctx, seconds, highpass, decay) {
  const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * seconds), ctx.sampleRate);
  const data = buffer.getChannelData(0);
  let hp = 0;
  for (let i = 0; i < data.length; i += 1) {
    const t = i / ctx.sampleRate;
    const white = Math.random() * 2 - 1;
    hp += highpass * (white - hp);
    const bright = white - hp;
    data[i] = bright * Math.exp(-t * decay);
  }
  return buffer;
}

export function createAudio() {
  let ctx = null;
  let master = null;
  let samples = null;
  let unlocking = null;

  function ensure() {
    if (ctx) return;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    ctx = new Ctx();
    master = ctx.createGain();
    master.gain.value = 0.9;
    master.connect(ctx.destination);
    samples = {
      kick: makeKick(ctx),
      snare: makeSnare(ctx),
      hatClosed: makeNoiseBurst(ctx, 0.09, 0.18, 55),
      hatOpen: makeNoiseBurst(ctx, 0.42, 0.14, 9),
      crash: makeNoiseBurst(ctx, 1.6, 0.08, 3.2),
      crash2: makeNoiseBurst(ctx, 1.35, 0.09, 3.8),
      splash: makeNoiseBurst(ctx, 0.5, 0.05, 9),
      trash: makeNoiseBurst(ctx, 0.72, 0.035, 6.2),
      ride: makeNoiseBurst(ctx, 0.7, 0.12, 7),
      tomHigh1: makeTom(ctx, 230),
      tomHigh2: makeTom(ctx, 190),
      tom1: makeTom(ctx, 155),
      tom2: makeTom(ctx, 128),
      floorTom: makeTom(ctx, 98),
      floorTom1: makeTom(ctx, 105),
      floorTom2: makeTom(ctx, 82),
      cowbell: makeCowbell(ctx),
      tambourine: makeTambourine(ctx),
      clap: makeClap(ctx),
    };
  }

  async function unlock() {
    ensure();
    if (!unlocking) {
      unlocking = (async () => {
        if (ctx.state === "suspended") {
          await ctx.resume();
        }
        const silent = ctx.createBuffer(1, 1, ctx.sampleRate);
        const source = ctx.createBufferSource();
        source.buffer = silent;
        source.connect(master);
        source.start(0);
      })().catch(() => {});
    }
    await unlocking;
  }

  function sampleFor(instrument, articulation) {
    if (instrument === "hat") {
      return articulation === "open" ? samples.hatOpen : samples.hatClosed;
    }
    return samples[instrument];
  }

  function play(instrument, velocity = 80, articulation = null, when = 0) {
    ensure();
    const buffer = sampleFor(instrument, articulation);
    if (!buffer) return;
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const gain = ctx.createGain();
    const vel = Math.max(1, Math.min(127, velocity)) / 127;
    gain.gain.value = (KIT_GAIN[instrument] ?? 0.6) * (0.25 + vel * 0.85);
    source.connect(gain);
    gain.connect(master);
    source.start(when || ctx.currentTime);
  }

  return {
    unlock,
    play,
    get currentTime() {
      ensure();
      return ctx.currentTime;
    },
  };
}
