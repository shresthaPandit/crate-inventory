import { Audio } from "@remotion/media"
import { linearTiming, TransitionSeries } from "@remotion/transitions"
import { AbsoluteFill, Composition, staticFile } from "remotion"
import { Backdrop, Grade, Grain, Vignette } from "./components/layers"
import { blurFade } from "./components/transition"
import { DASH, Dashboard, LOW, LowStock, PURCHASE, Purchase, SALE, Sale } from "./scenes/flow"
import { CONTEXT, Context, HOOK, Hook } from "./scenes/intro"
import { OUTRO, Outro, WALL, Wall } from "./scenes/outro"
import { theme } from "./theme"

// 120 BPM: a beat is 15 frames, and every cut lands on one.
const T = 15
const SCENES = [
  { d: HOOK, C: Hook },
  { d: CONTEXT, C: Context },
  { d: DASH, C: Dashboard },
  { d: PURCHASE, C: Purchase },
  { d: LOW, C: LowStock },
  { d: SALE, C: Sale },
  { d: WALL, C: Wall },
  { d: OUTRO, C: Outro },
]
export const DURATION = SCENES.reduce((s, x) => s + x.d, 0) - T * (SCENES.length - 1)

const CrateLaunch: React.FC = () => (
  <AbsoluteFill style={{ background: theme.colors.bg }}>
    <Backdrop />
    <TransitionSeries>
      {SCENES.flatMap(({ d, C }, i) => {
        const seq = (
          <TransitionSeries.Sequence key={`s${i}`} durationInFrames={d}>
            <C />
          </TransitionSeries.Sequence>
        )
        return i === 0
          ? [seq]
          : [
              <TransitionSeries.Transition
                key={`t${i}`}
                presentation={blurFade()}
                timing={linearTiming({ durationInFrames: T, easing: theme.ease.inOut })}
              />,
              seq,
            ]
      })}
    </TransitionSeries>
    <Grade />
    <Grain />
    <Vignette />
    <Audio src={staticFile("audio/music.wav")} volume={0.6} />
  </AbsoluteFill>
)

export const Root: React.FC = () => (
  <Composition id="CrateLaunch" component={CrateLaunch} durationInFrames={DURATION} fps={30} width={1920} height={1080} />
)
