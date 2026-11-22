import { AbsoluteFill, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion"
import { CrateMark } from "../components/mark"
import { Sfx } from "../components/sfx"
import { WordReveal } from "../components/text"
import { CLAMP, theme } from "../theme"

const c = theme.colors

export const WALL = 165

const COLUMNS = [
  ["stock", "transfers", "sales"],
  ["godowns", "command", "purchases"],
  ["reports", "dashboard-light", "stock-light"],
]
const DRIFT: [number, number][] = [
  [80, -120],
  [-150, 50],
  [100, -90],
]
const CARD_W = 820
const CARD_H = 512
const GAP = 40

const FEATURES = ["Godown rack map", "Ctrl K search", "CSV export", "Light and dark", "Works on phones"]

const Card: React.FC<{ src: string; delay: number }> = ({ src, delay }) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const p = spring({ frame: frame - delay, fps, config: theme.spring.smooth })
  return (
    <div
      style={{
        width: CARD_W,
        height: CARD_H,
        borderRadius: 16,
        overflow: "hidden",
        border: `1px solid ${c.hairline}`,
        boxShadow: "0 40px 80px -20px rgba(0,0,0,0.7)",
        opacity: p,
        transform: `translateY(${interpolate(p, [0, 1], [90, 0])}px) scale(${interpolate(p, [0, 1], [0.9, 1])})`,
      }}
    >
      <Img src={staticFile(`shots/${src}.png`)} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
    </div>
  )
}

const Feature: React.FC<{ text: string; delay: number }> = ({ text, delay }) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const p = spring({ frame: frame - delay, fps, config: theme.spring.snappy })
  return (
    <span
      style={{
        fontFamily: theme.fonts.mono,
        fontSize: 22,
        color: c.text,
        border: `1px solid ${c.hairline}`,
        background: "rgba(27,27,29,0.9)",
        borderRadius: 10,
        padding: "10px 18px",
        opacity: p,
        transform: `translateY(${interpolate(p, [0, 1], [24, 0])}px) scale(${interpolate(p, [0, 1], [0.9, 1])})`,
      }}
    >
      {text}
    </span>
  )
}

/** 27-32s: every other screen on a tilted wall, drifting in parallax. */
export const Wall: React.FC = () => {
  const frame = useCurrentFrame()
  const t = interpolate(frame, [0, WALL], [0, 1], { ...CLAMP, easing: theme.ease.inOut })
  const scrim = interpolate(frame, [8, 30], [0, 1], { ...CLAMP, easing: theme.ease.out })
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ perspective: 2400 }}>
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            display: "flex",
            gap: GAP,
            transform: `translate(-50%, -50%) rotateX(24deg) rotateZ(-9deg) scale(${0.96 + t * 0.04})`,
          }}
        >
          {COLUMNS.map((col, ci) => (
            <div
              key={ci}
              style={{
                display: "flex",
                flexDirection: "column",
                gap: GAP,
                transform: `translateY(${DRIFT[ci][0] + (DRIFT[ci][1] - DRIFT[ci][0]) * t}px)`,
              }}
            >
              {col.map((src, ri) => (
                <Card key={src} src={src} delay={2 + (ci * 3 + ri) * 3} />
              ))}
            </div>
          ))}
        </div>
      </AbsoluteFill>
      <AbsoluteFill
        style={{
          opacity: scrim,
          background:
            "radial-gradient(ellipse 62% 58% at 50% 50%, rgba(11,11,12,0.92) 0%, rgba(11,11,12,0.72) 50%, rgba(11,11,12,0.25) 100%)",
        }}
      />
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", gap: 48 }}>
        <WordReveal
          lines={[
            ["Godowns,", "transfers,", "reports."],
            ["Search", "on", "every", "screen."],
          ]}
          size={88}
          delay={24}
          align="center"
        />
        <div style={{ display: "flex", gap: 14 }}>
          {FEATURES.map((f, i) => (
            <Feature key={f} text={f} delay={62 + i * 5} />
          ))}
        </div>
      </AbsoluteFill>
      <Sfx at={0} name="whoosh" />
      {FEATURES.map((_, i) => (
        <Sfx key={i} at={60 + i * 5} name="click" volume={0.25} />
      ))}
    </AbsoluteFill>
  )
}

export const OUTRO = 135

/** 32-35.5s: mark, name, where to try it. */
export const Outro: React.FC = () => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const url = spring({ frame: frame - 36, fps, config: theme.spring.smooth })
  const tech = spring({ frame: frame - 50, fps, config: theme.spring.smooth })
  const exit = interpolate(frame, [OUTRO - 16, OUTRO - 1], [1, 0], { ...CLAMP, easing: theme.ease.in })
  const breathe = 1 + Math.sin(frame / 24) * 0.006
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", opacity: exit }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 44, transform: `scale(${breathe})` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 34 }}>
          <CrateMark size={116} />
          <WordReveal lines={[["Crate"]]} size={156} delay={6} />
        </div>
        <WordReveal
          lines={[["Inventory", "for", "the", "warehouse", "floor."]]}
          size={46}
          weight={500}
          color={c.textDim}
          delay={18}
          per={2}
        />
        <div
          style={{
            marginTop: 18,
            display: "flex",
            alignItems: "center",
            gap: 16,
            padding: "18px 30px",
            borderRadius: 999,
            border: `1px solid ${c.hairline}`,
            background: c.surface,
            opacity: url,
            transform: `translateY(${interpolate(url, [0, 1], [26, 0])}px) scale(${interpolate(url, [0, 1], [0.94, 1])})`,
          }}
        >
          <span style={{ width: 12, height: 12, borderRadius: 6, background: c.signal }} />
          <span style={{ fontFamily: theme.fonts.mono, fontSize: 32, color: c.text }}>crate-inventory-eight.vercel.app</span>
        </div>
        <div
          style={{
            fontFamily: theme.fonts.mono,
            fontSize: 22,
            color: c.muted,
            opacity: tech,
            transform: `translateY(${interpolate(tech, [0, 1], [16, 0])}px)`,
          }}
        >
          Next.js · Tailwind CSS · shadcn/ui · Motion
        </div>
      </div>
      <Sfx at={0} name="whoosh" volume={0.35} />
      <Sfx at={5} name="pop" />
      <Sfx at={35} name="click" />
    </AbsoluteFill>
  )
}
