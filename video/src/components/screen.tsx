import { Img, staticFile } from "remotion"
import { theme } from "../theme"

const c = theme.colors
export const BAR = 46

/** Browser chrome around a screen: graphite dots and the live URL. */
export const Window: React.FC<{ width: number; url: string; children: React.ReactNode; style?: React.CSSProperties }> = ({
  width,
  url,
  children,
  style,
}) => (
  <div
    style={{
      width,
      borderRadius: 18,
      overflow: "hidden",
      border: `1px solid ${c.hairline}`,
      background: c.surface,
      boxShadow: "0 60px 120px -30px rgba(0,0,0,0.85), 0 0 0 1px rgba(0,0,0,0.4)",
      ...style,
    }}
  >
    <div
      style={{
        height: BAR,
        display: "flex",
        alignItems: "center",
        padding: "0 18px",
        gap: 8,
        borderBottom: `1px solid ${c.hairline}`,
        background: "#111112",
        position: "relative",
      }}
    >
      {[0, 1, 2].map((i) => (
        <span key={i} style={{ width: 11, height: 11, borderRadius: 6, background: "#2c2c2f" }} />
      ))}
      <span
        style={{
          position: "absolute",
          left: "50%",
          transform: "translateX(-50%)",
          fontFamily: theme.fonts.mono,
          fontSize: 15,
          color: c.textDim,
          background: c.raised,
          borderRadius: 8,
          padding: "5px 16px",
        }}
      >
        {url}
      </span>
    </div>
    {children}
  </div>
)

export type Cam = { cx: number; cy: number; vw: number }

/** Where the image sits inside a camera viewport. vw = fraction of the image width in view. */
export function camLayout(w: number, h: number, cam: Cam, img: { w: number; h: number } = theme.shot) {
  const rw = w / cam.vw
  const rh = (rw * img.h) / img.w
  const left = Math.min(0, Math.max(w - rw, w / 2 - cam.cx * rw))
  const top = Math.min(0, Math.max(h - rh, h / 2 - cam.cy * rh))
  return { rw, rh, left, top }
}

/** Maps a point on the screenshot (0..1) to viewport pixels. */
export function camPoint(w: number, h: number, cam: Cam, x: number, y: number) {
  const l = camLayout(w, h, cam)
  return { x: l.left + x * l.rw, y: l.top + y * l.rh }
}

export function lerpCam(a: Cam, b: Cam, t: number): Cam {
  return { cx: a.cx + (b.cx - a.cx) * t, cy: a.cy + (b.cy - a.cy) * t, vw: a.vw + (b.vw - a.vw) * t }
}

/** A viewport onto a screenshot, with an optional second shot cross-fading over it. */
export const Camera: React.FC<{
  w: number
  h: number
  cam: Cam
  src: string
  src2?: string
  mix?: number
}> = ({ w, h, cam, src, src2, mix = 0 }) => {
  const l = camLayout(w, h, cam)
  const img = (s: string, opacity: number) => (
    <Img
      src={staticFile(`shots/${s}.png`)}
      style={{ position: "absolute", left: l.left, top: l.top, width: l.rw, height: l.rh, opacity }}
    />
  )
  return (
    <div style={{ width: w, height: h, position: "relative", overflow: "hidden", background: c.bg }}>
      {img(src, 1)}
      {src2 ? img(src2, mix) : null}
    </div>
  )
}

/** Pointer with a press state and a ring on click. */
export const Cursor: React.FC<{ x: number; y: number; press: number; ring: number; opacity: number }> = ({
  x,
  y,
  press,
  ring,
  opacity,
}) => (
  <div style={{ position: "absolute", left: x - 4, top: y - 3, opacity, pointerEvents: "none" }}>
    {ring > 0 && ring < 1 ? (
      <div
        style={{
          position: "absolute",
          left: 4 - 30 * (0.35 + ring),
          top: 3 - 30 * (0.35 + ring),
          width: 60 * (0.35 + ring),
          height: 60 * (0.35 + ring),
          borderRadius: "50%",
          border: "2px solid rgba(237,237,237,0.85)",
          opacity: 1 - ring,
        }}
      />
    ) : null}
    <svg
      width={30}
      height={36}
      viewBox="0 0 30 36"
      style={{
        transform: `scale(${1 - press * 0.14})`,
        transformOrigin: "4px 3px",
        filter: "drop-shadow(0 6px 10px rgba(0,0,0,0.5))",
      }}
    >
      <path
        d="M4 3 L4 28 L10.5 22 L15 32 L19.5 30 L15 20.5 L24 20.5 Z"
        fill="#fafafa"
        stroke="#0b0b0c"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  </div>
)
