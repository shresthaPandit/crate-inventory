import { Easing } from "remotion"
import { loadFont as loadGeist } from "@remotion/google-fonts/Geist"
import { loadFont as loadGeistMono } from "@remotion/google-fonts/GeistMono"

// Crate's own palette: graphite neutrals and one hi-vis "signal" accent.
// Signal is the hero colour: at most one signal element per frame.
export const theme = {
  colors: {
    bg: "#0b0b0c",
    surface: "#141415",
    raised: "#1b1b1d",
    hairline: "rgba(237,237,237,0.10)",
    grid: "rgba(237,237,237,0.055)",
    signal: "#d6ee5f",
    text: "#ededed",
    textDim: "#a1a1a6",
    muted: "#6b6b70",
  },
  fonts: {
    sans: loadGeist("normal", { weights: ["400", "500", "600"] }).fontFamily,
    mono: loadGeistMono("normal", { weights: ["400", "500"] }).fontFamily,
  },
  ease: {
    out: Easing.bezier(0.22, 1, 0.36, 1), // Crate's one UI curve, used for entrances
    inOut: Easing.bezier(0.83, 0, 0.17, 1), // camera moves, Ken Burns
    in: Easing.bezier(0.7, 0, 0.84, 0), // exits only
  },
  spring: {
    snappy: { damping: 14, stiffness: 160, mass: 0.6 },
    smooth: { damping: 20, stiffness: 90, mass: 1 },
    bouncy: { damping: 11, stiffness: 170, mass: 0.7 },
    counter: { damping: 30, stiffness: 60, mass: 1 },
  },
  shot: { w: 2880, h: 1800 },
} as const

export const CLAMP = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const
