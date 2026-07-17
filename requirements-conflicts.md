# Requirements Review — Open Conflicts & Ambiguities

_Companion to `requirements.md`. These are points where two sections make assumptions that don't line up, or where the requirement is ambiguous enough to cause two different features to be built on contradictory assumptions. Needs client clarification._

## 1. KDS "no printing needed" vs. printed slip/KOT flow

- **Section 10** states the kitchen screen removes the need for printing.
- **Section 15** describes a printed slip/token generated at the same time the order appears on the KDS.
- The existing codebase (`src/components/KOTView.jsx`) implements KOT as a printable report, not a live-updating kitchen screen.
- **Open question:** Is the printed slip a customer/waiter token (fine, doesn't contradict the KDS requirement) or is it meant to be the kitchen's working ticket (contradicts "no printing needed")? Need to confirm which one the client actually wants as the kitchen's day-to-day workflow.

## 2. Automated WhatsApp report vs. "free only if admin-initiated" model

- **Section 6** requires the system to push a daily report automatically to the admin.
- **Section 7** states automatic/system-initiated messages incur a per-message charge (~$0.01–0.02), while admin-initiated requests stay free within the service conversation window.
- Not a technical conflict, but Section 6's "automated daily report" line item carries an ongoing cost that Section 7 doesn't make obvious — client should be told this explicitly before signing off.

## 3. Offline-first desktop app vs. real-time multi-device features

- **Section 11** describes a single desktop app, not web-based.
- **Sections 9 and 10** require real-time state shared across multiple cashiers (Active Tables View) and a separate kitchen screen (KDS) — only achievable via a local client-server setup.
- **Section 12** (dedicated PC "server") resolves this in practice, but Section 11 should explicitly state "multiple local clients connecting to the local server" so it isn't misread as a single-machine app.

## 4. Two separate, uncoordinated backup mechanisms

- **Section 11**: cloud backup/sync "if available."
- **Section 12**: daily backup to external HDD/USB.
- Not contradictory, but described as two independent processes rather than one coordinated backup strategy — risk of drift between what's in the cloud and what's on the USB drive.

## 5. Void/approval flow vs. "add to same bill until checkout"

- **Section 8** requires manager/admin approval and a mandatory reason to void any order.
- **Section 9** allows freely appending items to an open table's order before checkout, with the final bill only generated at checkout.
- **Open question:** Does *removing* an item from a still-open, unprinted/unsent order also require void/PIN approval, or does that requirement only kick in once an item has been sent to the kitchen or printed? Needs a one-line clarification in `requirements.md`.

---

**Priority for client follow-up:** #1 and #5 matter most right now since they directly affect the void/print/KDS features currently being built.

---

# Sidebar Navigation — UX/Architecture Review

_Internal design review of the grouped/collapsible sidebar nav (`src/config/nav.js`, `src/components/Layout.jsx`). Not a client-facing requirements conflict — these are engineering/UX decisions to resolve before the nav pattern is considered final._

## Full inventory

**Top-level nav (17 pages, 6 groups):**

| Group | Pages | Route |
|---|---|---|
| *(flat)* | Dashboard | `/` |
| Operations ▾ | New Order (POS), Orders, Tables, Kitchen (KDS) | `/pos` `/orders` `/tables` `/kds` |
| Menu & Kitchen ▾ | Menu, Departments, Inventory, Kitchen | `/menu` `/departments` `/inventory` `/kitchen` |
| People ▾ | Attendance, Employees, Payroll | `/attendance` `/employees` `/payroll` |
| Finance ▾ | Accounting, Receivables, Handover Approvals, Billing | `/accounting` `/receivables` `/handovers` `/billing` |
| *(flat)* | Reports | `/reports` |

**Per-role visibility:** Admin sees all 17; Manager sees 15 (no New Order, no Menu); Cashier sees 4 (New Order, Orders, Tables, Billing); Kitchen sees 2 (Kitchen, Kitchen (KDS)).

**Options beyond tabs:** Shift lifecycle (Start/Auto-Resume/Partial Handover/End/Reconcile), order-level actions (Discount, Void/Cancel, Mark Udhaar, Mark Complimentary, Item Assignment), approval queues (Recipe, Ingredient Request, Handover), Manual Attendance Override, Recipe Form, Manage Most-Ordered, EN/UR language toggle, print flows (receipt/KOT/daily report).

## Drawbacks — UI/UX and empathy gaps

1. **Auto-expand quietly defeats the point of collapsing.** Every navigation opens that page's group and never re-collapses it. Over a real shift, most groups end up expanded anyway. **Open question:** should a group auto-collapse when you navigate away, or is "grows throughout the day" acceptable?
2. **No badges on collapsed groups hide things that need attention.** Handover Approvals and Receivables (time-sensitive, action-required) sit inside a collapsed "Finance" group with zero visual signal — an Admin could miss a pending cash handover for hours.
3. **Icon reuse on group headers creates lookalikes.** Operations/Menu & Kitchen/Finance each borrow an icon from one of their own children, so the collapsed group row can be mistaken for that specific child page.
4. **Time-critical monitoring pages are still buried.** KDS is meant to be checked constantly during a rush, yet sits one click deep inside "Operations" — same justification we used to keep Dashboard flat wasn't applied to KDS.
5. **Grouping is by department, not by job-to-be-done.** A real task like "close out today's finances" spans Dashboard, Operations, and Finance — three different collapsed sections. Category-based IA doesn't match how an owner actually thinks about their day.
6. **English-only group labels in an app that promises Urdu accessibility.** `requirements.md` §6 requires Urdu reports and the app ships full i18n, but the new group labels/RTL chevron behavior haven't been verified in Urdu mode.
7. **No search/quick-jump.** Admin still has to know which of 5 groups a page lives in — grouping helps scanning but doesn't solve findability the way a "jump to page" affordance would.
8. **Setup-once pages share visual weight with daily-use pages.** Departments (configured once) sits in the same dropdown as Menu and Inventory (touched constantly), making daily-use items harder to spot at a glance.

**Priority:** #1 and #2 are the most consequential — they affect whether real cash/approvals actually get missed, not just aesthetics. Worth resolving before this nav pattern ships.
