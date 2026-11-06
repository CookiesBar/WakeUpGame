// Synthesises the UI sound effects (our own work, no third-party audio, no licence to track).
// Run: node assets/sounds/make-sfx.mjs  →  sfx_ting.wav, sfx_fire.wav (44.1 kHz, 16-bit, mono). Deterministic.
import fs from 'fs';
import path from 'path';

const RATE = 44100;
const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1'));

function wav(file, seconds, sample) {
  const n = Math.round(seconds * RATE);
  const data = new Float32Array(n);
  for (let i = 0; i < n; i++) data[i] = sample(i / RATE, i);
  // Normalise to the asked peak, 5 ms fade at the end so it never clicks.
  const peak = data.reduce((m, v) => Math.max(m, Math.abs(v)), 0) || 1;
  const buf = Buffer.alloc(44 + n * 2);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * 2, 4); buf.write('WAVE', 8);
  buf.write('fmt ', 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(RATE, 24); buf.writeUInt32LE(RATE * 2, 28); buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34);
  buf.write('data', 36); buf.writeUInt32LE(n * 2, 40);
  const tail = Math.round(0.005 * RATE);
  for (let i = 0; i < n; i++) {
    const end = Math.min(1, (n - 1 - i) / tail);
    buf.writeInt16LE(Math.round((data[i] / peak) * sample.peak * end * 32767), 44 + i * 2);
  }
  fs.writeFileSync(path.join(HERE, file), buf);
  console.log(file, (buf.length / 1024).toFixed(1) + ' KB');
}

// Seeded noise, so every run writes the same bytes.
let seed = 7;
const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296) * 2 - 1;

// Ting: a small, soft bell. G6 with two quiet partials, 4 ms attack, ~0.2 s decay.
const ting = (t) => {
  const env = Math.min(1, t / 0.004) * Math.exp(-t / 0.2);
  const s = Math.sin(2 * Math.PI * 1568 * t) + 0.35 * Math.sin(2 * Math.PI * 2349 * t) * Math.exp(-t / 0.08) + 0.12 * Math.sin(2 * Math.PI * 3136 * t) * Math.exp(-t / 0.05);
  return env * s;
};
ting.peak = 0.5; // −6 dBFS: present, never sharp
wav('sfx_ting.wav', 0.6, ting);

// Fire lit: a soft "fwoomp". Low-passed noise whose cutoff sweeps up as it catches, a warm low body,
// and a few quiet crackles in the tail.
let lp = 0;
const crackles = Array.from({ length: 7 }, (_, i) => 0.22 + i * 0.09 + Math.abs(rnd()) * 0.05);
const fire = (t) => {
  const catchUp = Math.min(1, t / 0.18);
  const cutoff = 300 + 2200 * catchUp * Math.exp(-Math.max(0, t - 0.18) / 0.35);
  const a = 1 - Math.exp((-2 * Math.PI * cutoff) / RATE);
  lp += a * (rnd() - lp);
  const whoosh = lp * Math.min(1, t / 0.06) * Math.exp(-Math.max(0, t - 0.12) / 0.22);
  const body = 0.5 * Math.sin(2 * Math.PI * (95 + 40 * catchUp) * t) * Math.min(1, t / 0.02) * Math.exp(-t / 0.18);
  let crackle = 0;
  for (const c of crackles) if (t > c && t < c + 0.012) crackle += 0.35 * rnd() * Math.exp(-(t - c) / 0.003);
  return whoosh * 2.2 + body + crackle;
};
fire.peak = 0.45;
wav('sfx_fire.wav', 0.9, fire);
