// Bundles once, then renders the given frames as PNGs into out/check for inspection.
// node scripts/stills.mjs 40 160 260 ...
import { bundle } from "@remotion/bundler"
import { renderStill, selectComposition } from "@remotion/renderer"
import { mkdirSync } from "node:fs"
import path from "node:path"

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1")), "..")
const out = path.join(root, "out", "check")
mkdirSync(out, { recursive: true })
const frames = process.argv.slice(2).map(Number)

const serveUrl = await bundle({ entryPoint: path.join(root, "src", "index.ts") })
const composition = await selectComposition({ serveUrl, id: "CrateLaunch" })
console.log("duration", composition.durationInFrames)
for (const frame of frames) {
  const output = path.join(out, `f${String(frame).padStart(4, "0")}.png`)
  await renderStill({ serveUrl, composition, frame, output, scale: 0.5, overwrite: true })
  console.log("still", frame)
}
