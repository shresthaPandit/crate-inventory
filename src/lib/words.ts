/**
 * Plain words used across Crate. People using this for the first time
 * are not software people: every label says what will happen in everyday
 * language, and every term that might be new has a one-line meaning.
 * Screens import from here so the same thing is always called the same name.
 */

export const ACTION = {
  newSale: "New sale",
  newPurchase: "Order from supplier",
  newTransfer: "Move stock",
  adjust: "Correct stock count",
  confirmSale: "Confirm order",
  shipSale: "Ship order",
  markPaid: "Mark as paid",
  cancelSale: "Cancel order",
  receivePurchase: "Goods received",
  cancelPurchase: "Cancel order",
  reorder: "Order more",
  view: "View",
} as const

/** What each quick action does, in one sentence. Shown under the action. */
export const ACTION_HINT = {
  newSale: "Sell items to a customer. Stock goes down when you ship.",
  newPurchase: "Buy items from a supplier. Stock goes up when they arrive.",
  newTransfer: "Send items from one godown to another.",
  adjust: "Fix the count after you check the shelf.",
} as const

export const GLOSSARY: { term: string; meaning: string }[] = [
  { term: "Godown", meaning: "A warehouse where you keep stock. This business has three." },
  { term: "Stock", meaning: "The items you have right now, counted per godown." },
  { term: "Minimum level", meaning: "The lowest amount you want to keep. Below this, Crate asks you to order more." },
  { term: "Running low", meaning: "The item is at or below its minimum level. Order more soon." },
  { term: "Out of stock", meaning: "None left in any godown. You cannot ship it until more arrives." },
  { term: "Booked for orders", meaning: "Items promised to customers in sales that are not shipped yet. They are still on the shelf." },
  { term: "On the way", meaning: "Items you ordered from a supplier that have not arrived yet." },
  { term: "Sale (sales order)", meaning: "An order from a customer. Shipping it takes the items out of stock." },
  { term: "Purchase order", meaning: "An order you send to a supplier. When the goods arrive, mark it received and stock goes up." },
  { term: "Move stock (transfer)", meaning: "Sending items from one godown to another. The total stays the same." },
  { term: "Stock value", meaning: "What all the items in your godowns cost you to buy." },
  { term: "GST", meaning: "Tax added to the bill. Crate adds 18% automatically." },
]

/** The three steps that explain the whole app. */
export const HOW_IT_WORKS = [
  {
    title: "Buy stock",
    text: "Create an order to your supplier. When the goods arrive, press “Goods received” and the stock goes up.",
  },
  {
    title: "Sell stock",
    text: "Create a sale for your customer. When the goods leave, press “Ship order” and the stock goes down.",
  },
  {
    title: "Watch the alerts",
    text: "When an item runs low, it shows on Home under “Needs your attention”. Press “Order more” to restock it.",
  },
] as const
