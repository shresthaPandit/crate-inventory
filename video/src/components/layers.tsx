import { AbsoluteFill, useCurrentFrame } from "remotion"
import { theme } from "../theme"

const c = theme.colors

/** Bottom layer: graphite mesh plus a slow-moving warehouse floor grid. */
export const Backdrop: React.FC = () => {
  const frame = useCurrentFrame()
  const d1 = Math.sin(frame / 60) * 60
  const d2 = Math.cos(frame / 75) * 50
  const mask = "linear-gradient(to top, rgba(0,0,0,0.9) 5%, transparent 80%)"
  return (
    <AbsoluteFill style={{ background: c.bg, overflow: "hidden" }}>
      <div
        style={{
          position: "absolute",
          width: 1500,
          height: 1500,
          borderRadius: "50%",
          top: -820,
          left: -260 + d1,
          background: "radial-gradient(circle, rgba(237,237,237,0.075), transparent 60%)",
          filter: "blur(40px)",
        }}
      />
      <div
        style={{
          position: "absolute",
          width: 1200,
          height: 1200,
          borderRadius: "50%",
          bottom: -760,
          right: -320 - d2,
          background: "radial-gradient(circle, rgba(214,238,95,0.07), transparent 62%)",
          filter: "blur(60px)",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: -1200,
          right: -1200,
          bottom: -260,
          height: 980,
          transform: "perspective(900px) rotateX(66deg)",
          transformOrigin: "50% 100%",
          backgroundImage: `linear-gradient(${c.grid} 1px, transparent 1px), linear-gradient(90deg, ${c.grid} 1px, transparent 1px)`,
          backgroundSize: "104px 104px",
          backgroundPosition: `0px ${frame * 1.4}px`,
          maskImage: mask,
          WebkitMaskImage: mask,
        }}
      />
    </AbsoluteFill>
  )
}

/** Above all content: a faint signal tint and top/bottom falloff. */
export const Grade: React.FC = () => (
  <AbsoluteFill style={{ pointerEvents: "none" }}>
    <AbsoluteFill style={{ backgroundColor: c.signal, mixBlendMode: "soft-light", opacity: 0.035 }} />
    <AbsoluteFill
      style={{
        background: "linear-gradient(180deg, rgba(0,0,0,0.16), transparent 24%, transparent 76%, rgba(0,0,0,0.26))",
      }}
    />
  </AbsoluteFill>
)

const NOISE = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='220' height='220'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='220' height='220' filter='url(%23n)' opacity='0.5'/%3E%3C/svg%3E")`

export const Grain: React.FC = () => {
  const frame = useCurrentFrame()
  return (
    <AbsoluteFill
      style={{
        pointerEvents: "none",
        backgroundImage: NOISE,
        backgroundSize: "220px",
        backgroundPosition: `${(frame * 7) % 220}px ${(frame * 13) % 220}px`,
        opacity: 0.07,
        mixBlendMode: "overlay",
      }}
    />
  )
}

export const Vignette: React.FC = () => (
  <AbsoluteFill
    style={{
      pointerEvents: "none",
      background: "radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,0.5) 100%)",
    }}
  />
)
