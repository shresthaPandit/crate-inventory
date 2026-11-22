import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion"
import { theme } from "../theme"

/** Crate's mark: a rounded crate with a hand slot. The slot draws open after the box lands. */
export const CrateMark: React.FC<{ size: number; delay?: number }> = ({ size, delay = 0 }) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const box = spring({ frame: frame - delay, fps, config: theme.spring.bouncy })
  const slot = spring({ frame: frame - delay - 8, fps, config: theme.spring.snappy })
  return (
    <div
      style={{
        width: size,
        height: size,
        opacity: Math.min(1, box * 1.6),
        transform: `scale(${interpolate(box, [0, 1], [0.4, 1])}) rotate(${interpolate(box, [0, 1], [-16, 0])}deg)`,
      }}
    >
      <svg viewBox="0 0 20 20" width={size} height={size}>
        <rect x="2" y="2" width="16" height="16" rx="4" fill={theme.colors.text} />
        <rect x={10 - 5 * slot} y="9" width={Math.max(0, 10 * slot)} height="2" rx="1" fill={theme.colors.bg} />
      </svg>
    </div>
  )
}
