# Crate

Inventory, sales and purchasing for **Deccan Electric Supply**, a Pune electrical distributor with three godowns (Bhosari, Chakan, Bhiwandi). Built with Next.js 16, Tailwind v4, shadcn/ui (Radix), Motion, Recharts and Zustand. Sample data, no login.

```bash
npm install
npm run dev        # http://localhost:3000  (use --port 3210 if 3000 is busy)
```

Live: https://crate-inventory-eight.vercel.app

## Modules

| Route | What it does |
| --- | --- |
| `/` Dashboard | Stock value, 30-day sales, open orders, pending purchases. Inbound vs outbound movement chart, low stock with one-click reorder, arriving POs with inline receive, activity feed, top movers, godown fill |
| `/sales` | Sales orders and invoices. Filter by status, payment, godown, search. Detail drawer with invoice totals (GST 18%), shortage check, ship / mark paid / cancel |
| `/purchases` | Purchase orders. Pending, late, received. Receive inline or from the drawer, which shows each item's stock before and after receiving |
| `/stock` | All items with the shelf meter, min level, per-godown quantities, incoming, value. Item drawer with stock history chart and full ledger |
| `/transfers` | Moves between godowns, validated against stock at the source |
| `/godowns` | Rack map per godown: every bin drawn against that godown's share of the min level |
| `/customers`, `/suppliers` | Directory with billed / outstanding, lead time and on-time delivery |
| `/reports` | Stock, sales and purchase reports for a chosen range, each exportable to CSV |

`Ctrl K` opens the command menu (pages, items, orders, create actions). The **New** button in the top bar creates a sales order, purchase order, transfer or stock adjustment from anywhere.

## How the workflow connects

All state lives in one store (`src/lib/store.ts`) and every stock change goes through the same path, which writes a ledger row (`Movement`) and an activity entry:

- **Ship a sales order** → stock leaves the order's godown. Blocked with a clear message if the godown is short, with a shortcut to raise a purchase order for the gap
- **Receive a purchase order** → stock arrives at its godown
- **Transfer** → out of one godown, into another
- **Adjust** → count corrections and damage, with a reason

Low stock is derived (on hand ≤ min level), so it updates everywhere at once: dashboard list, sidebar count, alerts bell, stock filters, rack map.

Try it: on the dashboard, *LED panel 15W* is low with PO arriving tomorrow. Receive that PO from **Arriving** and watch it leave the low stock list, the stock value tick up and the chart gain an inbound bar. *Cat6 cable* is out, and the draft order from Coastal Interiors cannot ship until you buy more.

State persists in `localStorage`. **Workspace menu → Reset sample data** restores the starting point.

## Sample data

`src/lib/seed.ts` simulates 75 days of trading with a seeded random generator: daily sales, reorders when stock dips, supplier lead times, weekly rebalancing transfers and the odd damage write-off. Every figure, chart and ledger row is therefore consistent with current stock, and dates are relative to today.

## Design

Direction, written before any screen was built:

- **Product**: the stock, sales and purchase desk for a three-godown electrical distributor
- **Character**: exact, unhurried, ledger-like
- **World**: the warehouse floor: racks, bin labels, stencilled SKUs, hi-vis vests
- **Moments**: the inbound vs outbound movement chart, and the godown rack map
- **Signature**: the shelf meter, ten slots against a min-level tick, shown wherever stock is shown

Graphite neutrals carry the chrome; one accent, the yellow-green of a safety vest, marks the key figure, the selection and the series that matters. Geist for the interface, Geist Mono for figures, SKUs and document numbers. One easing curve, one entrance per page, numbers that tween when stock changes.

The polish pass followed **unslop** by Damir Sokolovsky ([@heydamir](https://x.com/heydamir), [heydamir.design/unslop](https://heydamir.design/unslop)), licensed CC BY 4.0. References were gathered from inventory and dashboard work on Pinterest.

## Structure

```
src/lib/          types, seed simulation, store + workflow actions, calc helpers, formatting
src/components/
  kit/            Page, Panel, StatCard, StatusBadge, StockMeter, LineEditor, Segmented ...
  shell/          sidebar, top bar, command menu, global drawers
  dashboard/ sales/ purchases/ stock/ transfers/ godowns/ directory/ reports/
  ui/             shadcn/ui components
video/            35 s product video, built with Remotion (separate package)
```

## Product video

`video/` is a Remotion project that cuts real screens of the live app into a 35 second launch video: the hook, a received purchase raising stock, the low stock list clearing, a shipped sale, then the other screens. Music and sound effects are synthesized by a script, so nothing is downloaded.

```bash
cd video
npm install
node scripts/capture.mjs     # screenshots of the live app via headless Chrome
node scripts/audio.mjs       # music bed + SFX as WAVs
npm run render               # out/crate-launch.mp4
```
