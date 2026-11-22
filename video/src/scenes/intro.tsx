import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion"
import { CrateMark } from "../components/mark"
import { Sfx } from "../components/sfx"
import { Label, WordReveal } from "../components/text"
import { CLAMP, theme } from "../theme"

const c = theme.colors

export const HOOK = 105

/** 0-3.5s: the mark lands, then the promise. */
export const Hook: React.FC = () => {
  const frame = useCurrentFrame()
  const push = interpolate(frame, [0, HOOK], [1, 1.05], { ...CLAMP, easing: theme.ease.inOut })
  const breathe = Math.sin(frame / 22) * 3
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 64,
          transform: `scale(${push}) translateY(${breathe}px)`,
        }}
      >
        <CrateMark size={124} />
        <WordReveal
          lines={[
            ["Every", "unit,"],
            ["accounted", "for."],
          ]}
          size={136}
          delay={14}
          per={4}
          align="center"
          highlight={["accounted", "for."]}
        />
      </div>
      <Sfx at={0} name="whoosh" />
      <Sfx at={7} name="pop" />
      <Sfx at={25} name="hit" />
    </AbsoluteFill>
  )
}

export const CONTEXT = 105

const GODOWNS = [
  ["PUN-01", "Bhosari"],
  ["PUN-02", "Chakan"],
  ["MUM-01", "Bhiwandi"],
] as const

const Chip: React.FC<{ code: string; name: string; delay: number }> = ({ code, name, delay }) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const p = spring({ frame: frame - delay, fps, config: theme.spring.snappy })
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 16,
        height: 68,
        padding: "0 26px",
        borderRadius: 14,
        border: `1px solid ${c.hairline}`,
        background: c.surface,
        opacity: p,
        transform: `translateY(${interpolate(p, [0, 1], [30, 0])}px) scale(${interpolate(p, [0, 1], [0.92, 1])})`,
      }}
    >
      <span style={{ fontFamily: theme.fonts.mono, fontSize: 22, color: c.muted }}>{code}</span>
      <span style={{ fontFamily: theme.fonts.sans, fontSize: 30, fontWeight: 500, color: c.text }}>{name}</span>
    </div>
  )
}

/** 3-6.5s: who it is for. */
export const Context: React.FC = () => {
  const frame = useCurrentFrame()
  const drift = interpolate(frame, [0, CONTEXT], [0, -26], { ...CLAMP, easing: theme.ease.inOut })
  return (
    <AbsoluteFill style={{ justifyContent: "center", paddingLeft: 170 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 40, transform: `translateX(${drift}px)` }}>
        <Label text="Crate for Deccan Electric Supply, Pune" />
        <WordReveal
          lines={[
            ["Stock,", "sales", "and", "purchases"],
            ["on", "one", "ledger."],
          ]}
          size={108}
          delay={6}
          highlight={["one", "ledger."]}
        />
        <div style={{ display: "flex", gap: 20, marginTop: 18 }}>
          {GODOWNS.map(([code, name], i) => (
            <Chip key={code} code={code} name={name} delay={46 + i * 6} />
          ))}
        </div>
      </div>
      <Sfx at={4} name="whoosh" volume={0.3} />
      {GODOWNS.map((_, i) => (
        <Sfx key={i} at={44 + i * 6} name="click" />
      ))}
    </AbsoluteFill>
  )
}
