import { ArrowRightLeftIcon, ClipboardCheckIcon, ShoppingCartIcon, TruckIcon } from "lucide-react"
import { ACTION, ACTION_HINT } from "@/lib/words"

/** The four things people do every day, in one place, with the same icon everywhere. */
export const QUICK_ACTIONS = [
  { type: "sale", label: ACTION.newSale, hint: ACTION_HINT.newSale, icon: ShoppingCartIcon },
  { type: "purchase", label: ACTION.newPurchase, hint: ACTION_HINT.newPurchase, icon: TruckIcon },
  { type: "transfer", label: ACTION.newTransfer, hint: ACTION_HINT.newTransfer, icon: ArrowRightLeftIcon },
  { type: "adjust", label: ACTION.adjust, hint: ACTION_HINT.adjust, icon: ClipboardCheckIcon },
] as const
