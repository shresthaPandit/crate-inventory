import type { TransitionPresentation, TransitionPresentationComponentProps } from "@remotion/transitions"
import { AbsoluteFill } from "remotion"

type Props = Record<string, never>

// Outgoing scene pushes forward and blurs out fast; the next one settles in from slightly small.
const BlurFade: React.FC<TransitionPresentationComponentProps<Props>> = ({
  children,
  presentationDirection,
  presentationProgress: p,
}) => {
  const entering = presentationDirection === "entering"
  const style: React.CSSProperties = entering
    ? { opacity: p, transform: `scale(${0.965 + 0.035 * p})`, filter: `blur(${(1 - p) * 10}px)` }
    : { opacity: Math.max(0, 1 - p * 1.6), transform: `scale(${1 + 0.05 * p})`, filter: `blur(${p * 12}px)` }
  return <AbsoluteFill style={style}>{children}</AbsoluteFill>
}

export const blurFade = (): TransitionPresentation<Props> => ({ component: BlurFade, props: {} })
