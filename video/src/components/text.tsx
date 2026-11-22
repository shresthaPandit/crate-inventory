import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion"
import { CLAMP, theme } from "../theme"

const c = theme.colors

/**
 * Headline that lands word by word: opacity, rise and de-blur together,
 * 3 frames apart, continuing the stagger across lines.
 */
export const WordReveal: React.FC<{
  lines: string[][]
  delay?: number
  per?: number
  size: number
  weight?: number
  color?: string
  highlight?: string[]
  align?: "flex-start" | "center"
  lineGap?: number
}> = ({ lines, delay = 0, per = 3, size, weight = 600, color = c.text, highlight = [], align = "flex-start", lineGap = 0 }) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  let index = 0
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: align, gap: lineGap }}>
      {lines.map((words, li) => (
        <div key={li} style={{ display: "flex", gap: size * 0.26, flexWrap: "nowrap" }}>
          {words.map((word) => {
            const i = index++
            const p = spring({ frame: frame - delay - i * per, fps, config: theme.spring.snappy })
            return (
              <span
                key={i}
                style={{
                  display: "inline-block",
                  fontFamily: theme.fonts.sans,
                  fontSize: size,
                  fontWeight: weight,
                  letterSpacing: "-0.035em",
                  lineHeight: 1.04,
                  color: highlight.includes(word) ? c.signal : color,
                  opacity: interpolate(p, [0, 1], [0, 1], CLAMP),
                  transform: `translateY(${interpolate(p, [0, 1], [size * 0.42, 0])}px)`,
                  filter: `blur(${interpolate(p, [0, 1], [10, 0], CLAMP)}px)`,
                }}
              >
                {word}
              </span>
            )
          })}
        </div>
      ))}
    </div>
  )
}

/** Mono section label with a numbered tag, like Crate's bin codes. */
export const Label: React.FC<{ index?: string; text: string; delay?: number }> = ({ index, text, delay = 0 }) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const p = spring({ frame: frame - delay, fps, config: theme.spring.smooth })
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 16,
        fontFamily: theme.fonts.mono,
        fontSize: 24,
        color: c.textDim,
        opacity: p,
        transform: `translateX(${interpolate(p, [0, 1], [-24, 0])}px)`,
      }}
    >
      {index ? (
        <span
          style={{
            border: `1px solid ${c.hairline}`,
            borderRadius: 8,
            padding: "4px 10px",
            color: c.text,
            background: c.raised,
          }}
        >
          {index}
        </span>
      ) : null}
      <span>{text}</span>
    </div>
  )
}

/** A short supporting line that rises in once. */
export const Line: React.FC<{ text: string; delay: number; size?: number; color?: string; mono?: boolean }> = ({
  text,
  delay,
  size = 30,
  color = c.textDim,
  mono,
}) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const p = spring({ frame: frame - delay, fps, config: theme.spring.smooth })
  return (
    <div
      style={{
        fontFamily: mono ? theme.fonts.mono : theme.fonts.sans,
        fontSize: size,
        color,
        lineHeight: 1.35,
        opacity: p,
        transform: `translateY(${interpolate(p, [0, 1], [18, 0])}px)`,
        filter: `blur(${interpolate(p, [0, 1], [6, 0], CLAMP)}px)`,
      }}
    >
      {text}
    </div>
  )
}
