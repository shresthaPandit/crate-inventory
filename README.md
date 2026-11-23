# Crate

Inventory, sales and purchasing for **Deccan Electric Supply**, a Pune electrical distributor with three godowns (Bhosari, Chakan, Bhiwandi). Built with Next.js 16, Tailwind v4, shadcn/ui (Radix), Motion, Recharts and Zustand. Sample data, no login.

```bash
npm install
npm run dev        # http://localhost:3000  (use --port 3210 if 3000 is busy)
```

Live: https://crate-inventory-eight.vercel.app

## What changed in the redesign, and why

The first version looked premium but was hard for someone opening it for the first time. The redesign is built for a shop owner or godown clerk with no software training: they should be able to use it just by looking.

| Change | Why it is easier |
| --- | --- |
| **Plain words.** "Running low", "Ready to ship", "On the way", "Goods received". No SKU, PO or ledger | Nothing to learn. Each status has a colour, an icon and words, so it reads at a glance |
| **Home tells you what to do.** A "Needs your attention" list (low stock, late orders, late payments), each with its button, plus four big quick actions | The first screen answers "what should I do now?" |
| **Next step on every order.** Each order opens with a box saying what to do next, with the button right there | No guessing which button moves the order forward |
| **Confirm before anything changes.** Shipping, receiving, cancelling, moving or correcting stock shows exactly what goes up or down, then asks | No surprises, and mistakes are caught before they happen |
| **Simple forms.** Numbered steps, − / + buttons for quantity, errors in plain words next to the field | Works for people who would rather tap than type |
| **Clear look.** White pages, orange highlights, navy sidebar, bigger text and buttons | Easier to read, fewer things competing for attention |
| **Phone friendly.** Bottom tab bar, cards instead of wide tables | Works on the phone in the godown |
| **Built-in help.** A "How Crate works" guide and "?" tips on words like Godown and Minimum level | Answers are on the screen, not in a manual |

The workflow and the features are unchanged: purchase received → stock up, sale shipped → stock down, low stock on Home, and search plus filters on every page.

## Modules

| Route | What it does |
| --- | --- |
| `/` Home | Greeting and today's summary, how it works in 3 steps, quick actions, "Needs your attention" with one-tap Order more, stock in vs out chart, deliveries arriving soon, recent activity in plain sentences |
| `/sales` | Orders from customers. Filter by status, payment, godown, search. Each row shows its next step (Confirm, Ship order, Mark as paid). The drawer explains the order and blocks shipping when stock is short |
| `/purchases` | Orders to suppliers: on the way, late, received. "Goods received" adds the stock, after showing what will go up |
| `/stock` | Every item with how many are in each godown, minimum level, what is on the way, and Order more for low items. Item drawer with stock history in sentences |
| `/transfers` Move stock | Move items between godowns, checked against what the source godown has |
| `/godowns` | Each godown: how full it is, what is running low, and the items kept there |
| `/customers`, `/suppliers` | Who buys from you and what they owe; who you buy from and what is on the way |
| `/reports` | Sales, purchases and stock for a chosen time period, each downloadable for Excel (CSV) |

The **New** button in the top bar starts a sale, a supplier order, a stock move or a stock count correction from anywhere. The search bar (or `Ctrl K`) finds any item, customer, order or page.

## How the workflow connects

All state lives in one store (`src/lib/store.ts`) and every stock change goes through the same path, which writes a stock history row (`Movement`) and an activity entry:

- **Ship a sale** → stock leaves the order's godown. Blocked with a clear message if the godown is short, with shortcuts to order more or move stock in
- **Goods received** on a supplier order → stock arrives at its godown
- **Move stock** → out of one godown, into another
- **Correct stock count** → after a shelf count, with a reason

Low stock is worked out from the numbers (in stock ≤ minimum level), so it updates everywhere at once: Home, the sidebar count, the bell, and the stock filters.

Try it: on Home, *Cat6 cable* is out of stock. Press **Order more**, create the order, then press **Goods received** on it and watch it leave the attention list and the stock value go up.

State persists in `localStorage`. **Help → Reset sample data** restores the starting point.

## Sample data

`src/lib/seed.ts` simulates 75 days of trading with a seeded random generator: daily sales, reorders when stock dips, supplier lead times, weekly rebalancing transfers and the odd damage write-off. Every figure, chart and ledger row is therefore consistent with current stock, and dates are relative to today.

## Design

Built for first-time, non-technical users:

- **Words**: one shared vocabulary in `src/lib/words.ts` (button labels, glossary, how-it-works steps), so the same thing is always called the same name
- **Colour has meaning**: green = done or fine, amber = needs attention soon, red = act now, blue = waiting on the next step, orange = the action to press
- **Shared pieces** in `src/components/kit`: plain status badges, "what happens next" banners, a confirm dialog that lists what will change, "?" help tips, and the item editor used by every form
- **Type and size**: 15px body text, 40px+ buttons and inputs, nothing below 13px

Earlier polish followed **unslop** by Damir Sokolovsky ([@heydamir](https://x.com/heydamir), [heydamir.design/unslop](https://heydamir.design/unslop)), licensed CC BY 4.0.

## Structure

```
src/lib/          types, seed simulation, store + workflow actions, calc helpers, formatting, words.ts (plain vocabulary)
src/components/
  kit/            Page, Panel, StatCard, StatusBadge, NextStep, HelpTip, ConfirmDialog, LineEditor ...
  shell/          sidebar, top bar, phone tab bar, help guide, search, global drawers
  dashboard/ sales/ purchases/ stock/ transfers/ godowns/ directory/ reports/
  ui/             shadcn/ui components
video/            35 s product video, built with Remotion (separate package)
```

## Product video

`video/` is a Remotion project that cuts real screens of the live app into a 35 second launch video (recorded before the redesign; rerun the steps below to capture the new screens): the hook, a received purchase raising stock, the low stock list clearing, a shipped sale, then the other screens. Music and sound effects are synthesized by a script, so nothing is downloaded.

```bash
cd video
npm install
node scripts/capture.mjs     # screenshots of the live app via headless Chrome
node scripts/audio.mjs       # music bed + SFX as WAVs
npm run render               # out/crate-launch.mp4
```
