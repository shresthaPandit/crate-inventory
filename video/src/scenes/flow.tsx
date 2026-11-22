import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion"
import { Counter } from "../components/counter"
import { BAR, Camera, camPoint, Cursor, lerpCam, Window, type Cam } from "../components/screen"
import { Sfx, Ticks } from "../components/sfx"
import { Label, Line, WordReveal } from "../components/text"
import { CLAMP, theme } from "../theme"

const c = theme.colors
const APP_URL = "crate-inventory-eight.vercel.app"
const ease = (frame: number, a: number, b: number, easing = theme.ease.inOut) =>
  interpolate(frame, [a, b], [0, 1], { ...CLAMP, easing })

// ---------------------------------------------------------------- dashboard

export const DASH = 165

/** 6-11.5s: the dashboard rises out of the floor, then the camera leans in. */
export const Dashboard: React.FC = () => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const W = 1520
  const H = Math.round((W - 2) / 1.6)
  const p = spring({ frame, fps, config: theme.spring.smooth })
  const cam = lerpCam({ cx: 0.5, cy: 0.5, vw: 1 }, { cx: 0.6, cy: 0.46, vw: 0.78 }, ease(frame, 40, DASH))
  const float = Math.sin(frame / 30) * 4
  return (
    <AbsoluteFill>
      <div style={{ position: "absolute", top: 84, width: "100%", display: "flex", justifyContent: "center" }}>
        <WordReveal lines={[["The", "whole", "floor,", "on", "one", "screen."]]} size={64} delay={10} align="center" />
      </div>
      <div style={{ position: "absolute", left: (1920 - W) / 2, top: 212, perspective: 2200 }}>
        <div
          style={{
            opacity: Math.min(1, p * 1.4),
            transformOrigin: "50% 0%",
            transform: `translateY(${interpolate(p, [0, 1], [320, 0]) + float}px) rotateX(${interpolate(p, [0, 1], [26, 0])}deg) scale(${interpolate(p, [0, 1], [0.9, 1])})`,
          }}
        >
          <Window width={W} url={APP_URL}>
            <Camera w={W - 2} h={H} cam={cam} src="dashboard" />
          </Window>
        </div>
      </div>
      <Sfx at={0} name="whoosh" />
      <Sfx at={12} name="hit" volume={0.4} />
    </AbsoluteFill>
  )
}

// ------------------------------------------------------- drawer + click beats

type Beat = {
  shot: string
  after: string
  button: { x: number; y: number }
  camA: Cam
  camB: Cam
  camC: Cam
  // scene-local frames
  toButton: [number, number]
  click: number
  toTop: [number, number]
}

/** A drawer shown through a moving camera, with a cursor that presses its main button. */
const DrawerShot: React.FC<{ beat: Beat; width: number; enterFrom: "left" | "right" }> = ({ beat, width, enterFrom }) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const w = width - 2
  const h = Math.round(w / 1.6)
  const enter = spring({ frame, fps, config: theme.spring.smooth })
  const dir = enterFrom === "right" ? 1 : -1

  const toB = ease(frame, beat.toButton[0], beat.toButton[1])
  const toC = ease(frame, beat.toTop[0], beat.toTop[1])
  const cam = toC > 0 ? lerpCam(beat.camB, beat.camC, toC) : lerpCam(beat.camA, beat.camB, toB)
  const mix = interpolate(frame, [beat.click + 1, beat.click + 4], [0, 1], CLAMP)

  // cursor glides in from below the window and lands on the live button position
  const target = camPoint(w, h, cam, beat.button.x, beat.button.y)
  const start = { x: w * 0.42, y: h + 160 }
  const arrive = beat.toButton[1] + 2
  const glide = interpolate(frame, [beat.toButton[0] + 4, arrive], [0, 1], { ...CLAMP, easing: theme.ease.out })
  const cursor = { x: start.x + (target.x - start.x) * glide, y: start.y + (target.y - start.y) * glide }
  const press = interpolate(frame, [beat.click - 3, beat.click, beat.click + 5], [0, 1, 0], CLAMP)
  const ring = interpolate(frame, [beat.click, beat.click + 16], [0, 1], CLAMP)
  const cursorOpacity =
    interpolate(frame, [beat.toButton[0] + 4, beat.toButton[0] + 10], [0, 1], CLAMP) *
    interpolate(frame, [beat.toTop[0] - 6, beat.toTop[0] + 4], [1, 0], CLAMP)

  return (
    <div
      style={{
        position: "relative",
        perspective: 2000,
        opacity: Math.min(1, enter * 1.4),
        transform: `translateX(${interpolate(enter, [0, 1], [180 * dir, 0])}px) translateY(${Math.sin(frame / 28) * 4}px)`,
      }}
    >
      <div style={{ transform: `rotateY(${interpolate(enter, [0, 1], [-16 * dir, 0])}deg)`, transformOrigin: "50% 50%" }}>
        <Window width={width} url={APP_URL}>
          <Camera w={w} h={h} cam={cam} src={beat.shot} src2={beat.after} mix={mix} />
        </Window>
      </div>
      <div style={{ position: "absolute", left: 1, top: BAR + 1, width: w, height: h }}>
        <Cursor x={cursor.x} y={cursor.y} press={press} ring={ring} opacity={cursorOpacity} />
      </div>
    </div>
  )
}

const TextColumn: React.FC<{ children: React.ReactNode; left: number }> = ({ children, left }) => (
  <div
    style={{
      position: "absolute",
      left,
      top: 0,
      bottom: 0,
      display: "flex",
      flexDirection: "column",
      justifyContent: "center",
      gap: 34,
    }}
  >
    {children}
  </div>
)

// ---------------------------------------------------------------- purchase

export const PURCHASE = 195

const PO_BEAT: Beat = {
  shot: "po",
  after: "po-received",
  button: { x: 0.942, y: 0.964 },
  camA: { cx: 0.8, cy: 0.42, vw: 0.4 },
  camB: { cx: 0.8, cy: 0.86, vw: 0.4 },
  camC: { cx: 0.8, cy: 0.16, vw: 0.4 },
  toButton: [58, 88],
  click: 98,
  toTop: [136, 172],
}

/** 11-17.5s: receive a PO, stock goes up. */
export const Purchase: React.FC = () => (
  <AbsoluteFill>
    <TextColumn left={140}>
      <Label index="01" text="Purchase" delay={4} />
      <WordReveal
        lines={[
          ["Receive", "a", "PO."],
          ["Stock", "goes", "up."],
        ]}
        size={92}
        delay={10}
      />
      <div style={{ marginTop: 20 }}>
        <Counter label="LED panel 15W, on hand" from={5} to={305} enterAt={30} countAt={PO_BEAT.click + 2} unit="pcs" />
      </div>
      <Line text="+₹78,600 stock value, logged in the ledger" delay={PO_BEAT.click + 40} size={26} mono />
    </TextColumn>
    <div style={{ position: "absolute", left: 800, top: 196 }}>
      <DrawerShot beat={PO_BEAT} width={1000} enterFrom="right" />
    </div>
    <Sfx at={0} name="whoosh" />
    <Sfx at={PO_BEAT.click - 2} name="click" volume={0.5} />
    <Sfx at={PO_BEAT.click + 1} name="hit" />
    <Ticks from={PO_BEAT.click + 3} to={PO_BEAT.click + 33} />
  </AbsoluteFill>
)

// ---------------------------------------------------------------- low stock

export const LOW = 135

// The dashboard's low stock panel, as fractions of the screenshot
const PANEL: Cam = { cx: 0.851, cy: 0.61, vw: 0.2535 }

/** 17.5-21.5s: the same panel before and after, wiped across. */
export const LowStock: React.FC = () => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const W = 640
  const H = 734
  const enter = spring({ frame, fps, config: theme.spring.smooth })
  const wipe = ease(frame, 50, 78)
  const kb = interpolate(frame, [0, LOW], [1, 1.035], { ...CLAMP, easing: theme.ease.inOut })
  const tag = (text: string, o: number) => (
    <span
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        opacity: o,
        fontFamily: theme.fonts.mono,
        fontSize: 22,
        color: c.text,
        border: `1px solid ${c.hairline}`,
        background: c.raised,
        borderRadius: 8,
        padding: "5px 12px",
      }}
    >
      {text}
    </span>
  )
  return (
    <AbsoluteFill>
      <div
        style={{
          position: "absolute",
          left: 220,
          top: 190,
          opacity: Math.min(1, enter * 1.4),
          transform: `translateX(${interpolate(enter, [0, 1], [-120, 0])}px) translateY(${Math.sin(frame / 28) * 4}px)`,
        }}
      >
        <div style={{ position: "relative", height: 44 }}>
          {tag("Before", interpolate(wipe, [0, 0.4], [1, 0], CLAMP) * enter)}
          {tag("After", interpolate(wipe, [0.6, 1], [0, 1], CLAMP))}
        </div>
        <div
          style={{
            position: "relative",
            width: W,
            height: H,
            borderRadius: 20,
            overflow: "hidden",
            border: `1px solid ${c.hairline}`,
            boxShadow: "0 60px 120px -30px rgba(0,0,0,0.85)",
          }}
        >
          <div style={{ position: "absolute", inset: 0, transform: `scale(${kb})` }}>
            <Camera w={W} h={H} cam={PANEL} src="dashboard" />
          </div>
          <div style={{ position: "absolute", inset: 0, transform: `scale(${kb})`, clipPath: `inset(0 ${(1 - wipe) * 100}% 0 0)` }}>
            <Camera w={W} h={H} cam={PANEL} src="dashboard-after" />
          </div>
          {wipe > 0 && wipe < 1 ? (
            <div style={{ position: "absolute", top: 0, bottom: 0, left: wipe * W - 1.5, width: 3, background: c.signal }} />
          ) : null}
        </div>
      </div>
      <TextColumn left={1000}>
        <Label index="02" text="Dashboard" delay={6} />
        <WordReveal
          lines={[
            ["Low", "stock"],
            ["clears", "itself."],
          ]}
          size={92}
          delay={12}
        />
        <div style={{ marginTop: 20 }}>
          <Counter label="Items at or below min level" from={5} to={4} enterAt={34} countAt={80} />
        </div>
        <Line text="The LED panel drops off the list the moment its PO lands." delay={96} size={28} />
      </TextColumn>
      <Sfx at={0} name="whoosh" volume={0.35} />
      <Sfx at={48} name="whoosh" volume={0.4} />
      <Sfx at={79} name="pop" />
    </AbsoluteFill>
  )
}

// ---------------------------------------------------------------- sale

export const SALE = 165

const SALE_BEAT: Beat = {
  shot: "sale",
  after: "sale-shipped",
  button: { x: 0.95, y: 0.964 },
  camA: { cx: 0.8, cy: 0.4, vw: 0.4 },
  camB: { cx: 0.8, cy: 0.86, vw: 0.4 },
  camC: { cx: 0.8, cy: 0.16, vw: 0.4 },
  toButton: [44, 72],
  click: 82,
  toTop: [118, 150],
}

/** 21.5-27s: ship an order, stock comes out. */
export const Sale: React.FC = () => (
  <AbsoluteFill>
    <div style={{ position: "absolute", left: 100, top: 202 }}>
      <DrawerShot beat={SALE_BEAT} width={980} enterFrom="left" />
    </div>
    <TextColumn left={1160}>
      <Label index="03" text="Sales" delay={4} />
      <WordReveal
        lines={[
          ["Ship", "an", "order."],
          ["Stock", "comes", "out."],
        ]}
        size={84}
        delay={10}
      />
      <div style={{ marginTop: 20 }}>
        <Counter label="Out of Bhosari, SO-2451" from={0} to={218} prefix="−" enterAt={30} countAt={SALE_BEAT.click + 2} unit="units" />
      </div>
      <Line text="Short on stock? The order will not ship." delay={SALE_BEAT.click + 40} size={28} />
    </TextColumn>
    <Sfx at={0} name="whoosh" />
    <Sfx at={SALE_BEAT.click - 2} name="click" volume={0.5} />
    <Sfx at={SALE_BEAT.click + 1} name="hit" />
    <Ticks from={SALE_BEAT.click + 3} to={SALE_BEAT.click + 33} />
  </AbsoluteFill>
)
