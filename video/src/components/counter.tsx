import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion"
import { CLAMP, theme } from "../theme"

const c = theme.colors

/**
 * A labelled figure that enters, holds its starting value, then counts to
 * its end value. Turns signal once it starts moving: the frame's hero.
 */
export const Counter: React.FC<{
  label: string
  from: number
  to: number
  enterAt: number
  countAt: number
  unit?: string
  prefix?: string
  size?: number
}> = ({ label, from, to, enterAt, countAt, unit, prefix = "", size = 112 }) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const enter = spring({ frame: frame - enterAt, fps, config: theme.spring.smooth })
  const run = spring({ frame: frame - countAt, fps, config: theme.spring.counter })
  const value = Math.round(interpolate(run, [0, 1], [from, to]))
  const live = frame >= countAt
  const pulse = live ? interpolate(frame - countAt, [0, 6, 16], [1, 1.06, 1], { ...CLAMP, easing: theme.ease.out }) : 1
  return (
    <div
      style={{
        opacity: enter,
        transform: `translateY(${interpolate(enter, [0, 1], [30, 0])}px)`,
        filter: `blur(${interpolate(enter, [0, 1], [8, 0], CLAMP)}px)`,
      }}
    >
      <div style={{ fontFamily: theme.fonts.mono, fontSize: 22, color: c.textDim }}>{label}</div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 16, marginTop: 8 }}>
        <span
          style={{
            display: "inline-block",
            fontFamily: theme.fonts.sans,
            fontSize: size,
            fontWeight: 600,
            letterSpacing: "-0.045em",
            lineHeight: 1,
            fontVariantNumeric: "tabular-nums",
            color: live ? c.signal : c.text,
            transform: `scale(${pulse})`,
            transformOrigin: "0% 100%",
          }}
        >
          {value === 0 ? "" : prefix}
          {value.toLocaleString("en-IN")}
        </span>
        {unit ? <span style={{ fontFamily: theme.fonts.sans, fontSize: size * 0.32, color: c.textDim }}>{unit}</span> : null}
      </div>
    </div>
  )
}
