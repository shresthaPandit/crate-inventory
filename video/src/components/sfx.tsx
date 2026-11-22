import { Audio } from "@remotion/media"
import { Sequence, staticFile } from "remotion"

const VOLUME = { whoosh: 0.45, click: 0.35, pop: 0.4, hit: 0.55, tick: 0.12 } as const
export type SfxName = keyof typeof VOLUME

/** Plays a sound effect at a scene-local frame. Land it 2-3 frames before the visual. */
export const Sfx: React.FC<{ at: number; name: SfxName; volume?: number }> = ({ at, name, volume }) => (
  <Sequence from={Math.max(0, at)} durationInFrames={30} layout="none">
    <Audio src={staticFile(`audio/${name}.wav`)} volume={volume ?? VOLUME[name]} />
  </Sequence>
)

/** Soft ticks while a counter runs. */
export const Ticks: React.FC<{ from: number; to: number; every?: number }> = ({ from, to, every = 3 }) => (
  <>
    {Array.from({ length: Math.floor((to - from) / every) }).map((_, i) => (
      <Sfx key={i} at={from + i * every} name="tick" />
    ))}
  </>
)
