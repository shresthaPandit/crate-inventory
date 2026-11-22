// Synthesizes the music bed and SFX kit as 16-bit mono WAVs into public/audio.
// Deterministic, no downloads. node scripts/audio.mjs
import { mkdirSync, writeFileSync } from "node:fs"

const SR = 44100
const OUT = new URL("../public/audio/", import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1")
mkdirSync(OUT, { recursive: true })

function writeWav(name, data, peak = 0.85) {
  let max = 0
  for (const v of data) max = Math.max(max, Math.abs(v))
  const k = max > 0 ? peak / max : 1
  const buf = Buffer.alloc(44 + data.length * 2)
  buf.write("RIFF", 0)
  buf.writeUInt32LE(36 + data.length * 2, 4)
  buf.write("WAVEfmt ", 8)
  buf.writeUInt32LE(16, 16)
  buf.writeUInt16LE(1, 20)
  buf.writeUInt16LE(1, 22)
  buf.writeUInt32LE(SR, 24)
  buf.writeUInt32LE(SR * 2, 28)
  buf.writeUInt16LE(2, 32)
  buf.writeUInt16LE(16, 34)
  buf.write("data", 36)
  buf.writeUInt32LE(data.length * 2, 40)
  for (let i = 0; i < data.length; i++) {
    buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, data[i] * k)) * 32767), 44 + i * 2)
  }
  writeFileSync(OUT + name, buf)
  console.log("wrote", name, (data.length / SR).toFixed(2) + "s")
}

// seeded noise so renders are identical
let seed = 7
const rand = () => {
  seed = (seed * 1664525 + 1013904223) >>> 0
  return seed / 4294967296
}
const noise = () => rand() * 2 - 1
const midi = (n) => 440 * Math.pow(2, (n - 69) / 12)

// ---------- music bed: 120 BPM, 36 s ----------
const BPM = 120
const BEAT = 60 / BPM
const LEN = 36
const N = Math.floor(LEN * SR)
const music = new Float32Array(N)

// A minor family, one chord per bar (2 s): Am9, Fmaj7, Cmaj7, G6
const CHORDS = [
  [57, 60, 64, 67, 71],
  [53, 57, 60, 64, 69],
  [48, 55, 59, 64, 67],
  [55, 59, 62, 64, 71],
]
const ROOTS = [45, 41, 36, 43]
const BAR = BEAT * 4
const KICK_FROM = 4 // seconds
const KICK_TO = 31.5
const HAT_FROM = 8

// pad: soft additive tones, slow attack, overlapping bars
for (let bar = 0; bar * BAR < LEN; bar++) {
  const chord = CHORDS[bar % 4]
  const start = bar * BAR
  const dur = BAR + 0.8
  for (const note of chord) {
    for (const det of [-0.0018, 0, 0.0021]) {
      const f = midi(note) * (1 + det)
      const s0 = Math.floor(start * SR)
      const s1 = Math.min(N, Math.floor((start + dur) * SR))
      for (let i = s0; i < s1; i++) {
        const t = (i - s0) / SR
        const env = Math.min(1, t / 0.6) * Math.min(1, (dur - t) / 0.8)
        const ph = 2 * Math.PI * f * t
        const v = Math.sin(ph) + 0.28 * Math.sin(2 * ph) + 0.1 * Math.sin(3 * ph)
        music[i] += v * env * 0.032
      }
    }
  }
}

// sidechain-ish duck on the pad, then drums and bass on top
const beats = []
for (let t = KICK_FROM; t < KICK_TO; t += BEAT) beats.push(t)
for (let i = 0; i < N; i++) {
  const t = i / SR
  if (t >= KICK_FROM && t < KICK_TO + 0.5) {
    const since = (t - KICK_FROM) % BEAT
    music[i] *= 1 - 0.38 * Math.exp(-since * 9)
  }
}
for (const t0 of beats) {
  const s0 = Math.floor(t0 * SR)
  for (let i = 0; i < 0.32 * SR && s0 + i < N; i++) {
    const t = i / SR
    const f = 45 + 95 * Math.exp(-t * 32)
    const ph = 2 * Math.PI * (45 * t + (95 / 32) * (1 - Math.exp(-t * 32)))
    music[s0 + i] += Math.sin(ph) * Math.exp(-t * 11) * 0.55 * (f > 0 ? 1 : 0)
  }
  // bass: root an octave down, short pluck on every beat
  const bar = Math.floor(t0 / BAR)
  const fb = midi(ROOTS[bar % 4] - 12 + 12)
  for (let i = 0; i < 0.42 * SR && s0 + i < N; i++) {
    const t = i / SR
    const env = Math.min(1, t / 0.01) * Math.exp(-t * 6)
    music[s0 + i] += (Math.sin(2 * Math.PI * fb * t) + 0.25 * Math.sin(4 * Math.PI * fb * t)) * env * 0.16
  }
}
// hats on the off-beats
let hp = 0
let prev = 0
for (let t0 = HAT_FROM + BEAT / 2; t0 < KICK_TO; t0 += BEAT) {
  const s0 = Math.floor(t0 * SR)
  for (let i = 0; i < 0.05 * SR && s0 + i < N; i++) {
    const n = noise()
    hp = n - prev
    prev = n
    music[s0 + i] += hp * Math.exp(-(i / SR) * 90) * 0.07
  }
}
// master fade in/out
for (let i = 0; i < N; i++) {
  const t = i / SR
  music[i] *= Math.min(1, t / 1.2) * Math.min(1, Math.max(0, (35.4 - t) / 3.4))
}
writeWav("music.wav", music, 0.8)

// ---------- SFX ----------
function make(seconds, fn) {
  const out = new Float32Array(Math.floor(seconds * SR))
  for (let i = 0; i < out.length; i++) out[i] = fn(i / SR, i)
  return out
}

// whoosh: band-swept noise, swells to the middle
{
  let lp = 0
  let lp2 = 0
  const dur = 0.55
  writeWav(
    "whoosh.wav",
    make(dur, (t) => {
      const x = t / dur
      const cutoff = 0.02 + 0.22 * Math.sin(Math.PI * x)
      lp += cutoff * (noise() - lp)
      lp2 += cutoff * (lp - lp2)
      return lp2 * Math.pow(Math.sin(Math.PI * x), 1.6)
    }),
    0.55,
  )
}
// click: tight UI click
writeWav(
  "click.wav",
  make(0.06, (t) => Math.sin(2 * Math.PI * 2200 * t) * Math.exp(-t * 140) * 0.7 + noise() * Math.exp(-t * 400) * 0.3),
  0.5,
)
// pop: pitch-drop blip
writeWav(
  "pop.wav",
  make(0.14, (t) => {
    const ph = 2 * Math.PI * (320 * t + (700 / 28) * (1 - Math.exp(-t * 28)))
    return Math.sin(ph) * Math.exp(-t * 26)
  }),
  0.55,
)
// hit: low thump for payoffs
writeWav(
  "hit.wav",
  make(0.7, (t) => {
    const ph = 2 * Math.PI * (38 * t + (120 / 18) * (1 - Math.exp(-t * 18)))
    return Math.sin(ph) * Math.exp(-t * 5) + noise() * Math.exp(-t * 60) * 0.25
  }),
  0.8,
)
// tick: counter tick
writeWav(
  "tick.wav",
  make(0.02, (t) => Math.sin(2 * Math.PI * 3400 * t) * Math.exp(-t * 300)),
  0.3,
)
