# Dua Restaurant — Management System (Frontend)

A premium, luxury-themed restaurant management frontend for **Dua Restaurant / Café Ali**.
Built with **React + Vite + Tailwind CSS**. Frontend-only (mock data, no backend).

## Palette & Design
- Background: black `#0B0B0D`
- Accent: gold `#C9A227` (with `#E0C463` / `#8C6F1A` gradient)
- Text: cream `#F5EFE0`
- Serif display font (Cormorant Garamond) for headings, Inter for body
- Fully responsive: desktop / tablet / mobile

## Roles & Access (role-based sidebar)
| Screen              | Admin | Manager | Cashier |
|---------------------|:-----:|:-------:|:-------:|
| Dashboard           | ✅ | ✅ | ✅ |
| New Order (POS)     | ✅ | ✅ | ✅ |
| Orders              | ✅ | ✅ | ✅ |
| Attendance          | ✅ | ✅ | — |
| Billing & Receipts  | ✅ | — | ✅ |

## Screens
1. **Login** — role selector (Admin / Manager / Cashier), any password works (demo).
2. **Dashboard** — today's orders, revenue, active tables, staff present, revenue-by-hour chart, recent orders, on-duty staff.
3. **POS / New Order** — searchable menu grid + categories, cart with qty controls, assign table + waiter, payment status (Paid/Unpaid) & method, checkout.
4. **Orders** — table/cards with Order ID, Table, Waiter, Items, Total, payment badge, time; filter + search + mark-as-paid.
5. **Attendance** — staff list with check-in / check-out and daily status badges.
6. **Billing & Receipts** — receipt cards + printable thermal-style receipt view (`Print`).

## Run

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # production build → dist/
npm run preview  # preview the production build
```

## Structure
```
src/
  context/AppContext.jsx   # auth + orders + attendance state (mock)
  data/mockData.js         # menu, staff, tables, seed orders
  config/nav.js            # role-based navigation
  components/              # Layout, Logo, Icons, shared UI
  pages/                   # Login, Dashboard, POS, Orders, Attendance, Billing
```

> Data is in-memory only — refreshing the page resets to seed data.
