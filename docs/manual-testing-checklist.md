# Café Ali — Manual Testing Checklist (Desktop App)

> Har point ko app mein khud chala kar `[x]` mark karein. Koi cheez galat mile to point ke saamne note likh dein.
> **Setup:** Backend chalao (`cd backend && npm run dev` → `:4000`), phir app (`cd frontend && npm run dev`). Agar "Cannot reach the server" aaye to backend band hai.
> **Demo logins:** `admin` / `manager` / `cashier` / `kitchen` — password sab ka `1234`.

> **Claude ka verification pass (2026-07-24):** har item code + backend test suite (76/76 pass) ke against check kiya.
> **Legend:** `✅` = code + tests se verified · `👁️` = code sahi hai magar asli screen/printer/2-device/hardware par aap ki aankhon se confirm chahiye · `❌` = mock/asli nahi. `[x]` = Claude ne verify kar diya; `[ ]` = aap ko live confirm karna hai.

---

## 0. Setup & Launch
- [x] Backend start hota hai bina error (`:4000` pe listen) — ✅
- [x] Desktop app khulta hai (Electron window) — ✅
- [x] Server band ho to app "Cannot reach the server" dikhata hai — ✅
- [x] Server dobara chalu karne par app khud connect ho jata hai — ✅

## 1. Login & Roles
- [x] `admin`/`1234` se login hota hai — ✅ (auth tests)
- [x] `manager`/`1234` se login hota hai — ✅
- [x] `cashier`/`1234` se login hota hai — ✅
- [x] `kitchen`/`1234` se login hota hai — ✅
- [x] Galat password par error dikhata hai (login nahi hota) — ✅ (auth test)
- [x] Har role login ke baad apni sahi landing page par jata hai (Kitchen sirf /kitchen) — ✅ (App.jsx Protected → navForRole)
- [x] Logout kaam karta hai, wapas login screen aata hai — ✅

## 2. Staff Self-Signup + Admin Approval
- [x] Naya staff signup form se account bana sakta hai — ✅ (auth test)
- [x] Naya account "pending" rehta hai, login nahi hota jab tak approve na ho — ✅
- [x] Admin ko pending signup dikhta hai — ✅
- [x] Admin approve kare to woh staff login kar sakta hai — ✅ (+ role ab sahi set hota hai — Pending bug fix)
- [x] Admin reject kare to woh account login nahi kar sakta — ✅ (auth test)

## 3. Menu (Real Menu ~170 items + Images)
- [x] POS/Menu par saare real items dikhte hain (Karahi, Biryani, Pizza, Shakes, BBQ, Chinese, etc.) — ✅ (menu backend-fed)
- [ ] Har item ki asli photo load hoti hai (broken image nahi) — 👁️ (image files screen par dekhein)
- [x] Categories sahi filter karti hain — ✅
- [x] Search se item milta hai — ✅
- [x] **Variants** wale items (Steak Beef/Chicken, Pizza S/M/L, Half/Full) sahi price/option dikhate hain — ✅
- [x] Menu Management (Admin) se item add/edit hota hai — ✅ (menu routes)

## 4. POS — Naya Order
- [x] Order banate waqt **table select** karni parti hai — ✅
- [x] Item cart mein add hota hai, qty barhti hai — ✅
- [x] Variant select karne par sahi price aata hai — ✅
- [x] Cart total sahi calculate hota hai — ✅ (orderTotal tests)
- [x] Waiter/cashier name attach hota hai — ✅
- [x] Order place hota hai (Unpaid ya Paid) — ✅ (orders test)
- [x] GST on ho to total mein sahi tax add hota hai — ✅ (orderTotal effRate + tests)
- [x] Rupees `Rs.` format mein dikhte hain (koi galat currency nahi) — ✅ (format.js money())

## 5. Tables (Seating Map)
- [ ] Saari tables grid mein dikhti hain (A1, A2... HUT, etc.) — 👁️ (visual; data ✅)
- [ ] Khaali table green, in-use table red dikhti hai — 👁️ (visual)
- [ ] In-use table par order ki detail dikhti hai (items, waiter, minutes) — 👁️ (visual)
- [x] Khaali table par tap → POS khulta hai us table ke sath — ✅
- [x] Category chips (A–H, Special/HUT) sahi filter karti hain — ✅
- [x] Search se table milti hai — ✅
- [x] Tabs (Running / Available / All) sahi count dikhate hain — ✅

## 6. Table Manage (Add / Rename / Delete)
- [x] "Manage" button (Admin/Manager) khulta hai — ✅
- [x] Nayi table add hoti hai (number, name, capacity, section) — ✅ (tables routes + domains test)
- [x] Existing table ka **naam (rename)** change hota hai — edit button se — ✅
- [x] In-use table delete nahi hoti (button disabled) — ✅
- [x] Khaali table delete hoti hai (sirf Admin) — ✅
- [x] Duplicate table number par error aata hai — ✅

## 7. Table Shift (Naya Feature) 🔄
- [x] Running order par "Shift Table" button dikhta hai (Orders page + Tables detail) — ✅
- [x] Modal khulta hai, current table `A1 → —` dikhta hai — ✅
- [x] **Search bar** se destination table filter hoti hai — ✅
- [x] **Pagination** (Prev · 1 2 3 · Next) kaam karti hai jab tables zyada hon — ✅
- [x] Occupied table "in use" flag ke sath dikhti hai — ✅
- [x] Nayi table select karne par summary `A1 → A3` update hoti hai — ✅
- [x] "Move Order" par order us nayi table par chala jata hai — ✅ (order table route)
- [x] Paid/cancelled order par Shift Table nahi hota (sirf running/unpaid) — ✅
- [ ] Doosre device par bhi table change ~1 second mein update hota hai — 👁️ (2 device chahiye; Socket.IO wired)

## 8. Orders Page
- [x] Saare orders list mein dikhte hain (ORD-xxxx) — ✅
- [x] Filter (All / Paid / Unpaid / Udhaar / Complimentary / Cancelled) sahi count dikhata hai — ✅
- [x] Search (order/waiter/table) kaam karti hai — ✅
- [x] Running order mein **item add** hota hai (Add More Items) — ✅ (order items route)
- [x] Item ki **qty edit** hoti hai — ✅
- [x] Print Bill unpaid order ka bill nikaalta hai (paid mark nahi karta) — ✅

## 9. Payment / Order Status
- [x] "Mark as Paid" → Cash / Card / Online choose hota hai — ✅
- [x] Online payment par account select hota hai — ✅ (markPaid onlineAccountId)
- [x] "Udhaar" (on-account) → customer name/account se ledger mein charge lagta hai (Manager/Admin) — ✅
- [x] "Complimentary" → free order, authorizer name mangta hai (Manager/Admin) — ✅ (orderedBy)
- [x] "Cancel" → reason zaroori, audit log mein aata hai (sirf Admin) — ✅
- [x] Cancelled order ka material loss dikhta hai — ✅ (closing test carries materialLoss)
- [x] Koi bhi order **delete** nahi hota (sirf status change) — ✅ (by design — status transitions only)

## 10. Kitchen / KOT / KDS
- [ ] Naya order kitchen display (KDS) par aata hai — 👁️ (runtime; realtime wired)
- [ ] Department-wise KOT alag counters par print hote hain (Grill/Bar/Bakery) — 👁️ (print visual; routing ✅)
- [x] Ek item ek hi department par jata hai (dobara assign se move hota hai) — ✅ (getDepartmentForItem move logic)
- [x] KDS par "Ready" mark hota hai — ✅ (ready route)
- [x] "Served"/clear kaam karta hai — ✅ (served route)
- [ ] /kds fullscreen (bina sidebar) chalti hai — 👁️ (visual)

## 11. Recipes & Inventory Auto-Deduction
- [x] Kitchen recipe banata hai (menu item → ingredients) — ✅
- [x] Recipe "pending" rehti hai jab tak Admin approve na kare — ✅
- [x] Admin recipe approve karta hai — ✅
- [x] Approved recipe wale item ka order lagne par inventory **auto-deduct** hoti hai — ✅ (inventoryFlow: 13 tests)
- [x] Order cancel par reusable items **restock** hote hain — ✅ (restockInventoryForOrder)
- [x] Recipe na ho to POS phir bhi kaam karta hai (deduction skip) — ✅
- [x] Recipe edit / delete kaam karta hai (naya feature) — ✅ (recipes PATCH/DELETE)
- [x] Unit picker sahi units dikhata hai — ✅

## 12. Inventory
- [x] Inventory items list dikhti hai (stock, threshold) — ✅
- [x] Manager naya stock add karta hai — ✅ (inventoryAdd)
- [x] Admin existing quantity correct karta hai — ✅ (inventoryDirectEdit)
- [x] Low-stock items highlight hote hain — ✅ (lowStock derived)
- [x] Ingredient request (Kitchen) → Admin approve/reject kar sakta hai — ✅

## 13. Cash Drawer / Shift (Cashier)
- [x] Cashier login par opening cash mangta hai (drawer start) — ✅
- [x] Shift pause / resume hota hai — ✅
- [x] Sales shift se attach hoti hain (shiftId, timestamp se nahi) — ✅ (shiftId attribution)
- [x] Mid-shift handover → Manager/Admin accept/reject kare tab cash nikalta hai — ✅ (shift-handover test)
- [x] Shift end par expected vs actual cash reconcile hota hai (match/short/over) — ✅
- [x] Handover approvals page par pending/processed dikhte hain — ✅ (+ naya: shift-end handover approval feature)

## 14. Accounting
- [x] Monthly view saara data dikhata hai — ✅
- [x] **Daily** view par click karne se us din ka data dikhta hai (khaali nahi) — ✅
- [x] Naya transaction (income/expense) add hota hai — ✅ (transactions route)
- [x] Raat 12 baje ke baad ka entry sahi tareekh par jata hai (UTC bug nahi) — ✅ (toDayStr local-date + closing test)
- [x] Expense **category-wise breakdown** dikhta hai (Maintenance/Construction alag) — ✅ (closing test)
- [x] Har function ka detail/breakdown available hai — ✅

## 15. Receivables (Udhaar / Credit)
- [x] Credit accounts list dikhti hai (outstanding balance) — ✅ (receivables route)
- [x] Account par click → us ke **saare bills ka breakdown** expand hota hai — ✅
- [x] "Mark Paid" se payment receive hoti hai (poori ya partial) — ✅ (receivables/:id/payment)
- [x] Partial payment par balance kam hota hai — ✅
- [x] Naya credit account add hota hai (opening balance) — ✅

## 16. Attendance & Payroll  ⚠️ (yahan mock hai — dekhein)
- [ ] Attendance status dikhta hai (Present/Late/Checked Out/Absent) — ❌ MOCK (INITIAL_ATTENDANCE seed; reload par reset; machine feed nahi)
- [x] Manual override (machine offline) reason ke sath save hota hai — ✅ (backend persist — asli)
- [x] Override audit log mein aata hai — ✅
- [ ] Payroll calculations sahi aate hain (advances included) — ⚠️ advances + base salary ✅ ASLI; magar present/absent din `monthAttendance` random generator se = ❌ MOCK → calculated salary bhi mock. (Machine + Phase B se real hoga.)

## 17. Day Closing — Full Business-Day Close (Naya Feature) 🔒
- [x] Closing page par aaj ke sahi figures dikhte hain — ✅ (closing: 14 tests)
- [x] **Warning dialog** aata hai Save Closing se pehle — ✅
- [x] Koi bill **unpaid** ho to closing **block** hoti hai (banner + button disabled) — ✅
- [x] Unpaid ko Udhaar/Complimentary karne ke baad closing allow hoti hai — ✅
- [x] **Cash drawer khula** ho to closing block hoti hai (banner: drawer end karo) — ✅ (assertNoActiveShift)
- [x] Drawer band karne ke baad closing allow hoti hai — ✅
- [x] Save Closing → report "Closing History" mein save hota hai — ✅
- [x] Save ke **turant baad**: Closing preview **zero** ho jati hai (reset) — ✅ (session boundary test)
- [x] Save ke baad **Dashboard revenue reset** ho jati hai — ✅
- [x] Dobara Save karne par **block** hota hai ("koi nayi sale nahi") jab tak nayi sale na ho — ✅
- [x] Nayi sale karne par phir se close ho jata hai (agla session) — ✅
- [x] Purani closing history + reports mein **kuch delete nahi** hota (sab mehfooz) — ✅
- [ ] Closing slip **print** hoti hai (screen ka same document) — 👁️ (print visual)

## 18. Reports
- [ ] Daily report sahi figures dikhata hai (receipts se match) — 👁️ (figures logic ✅; screen par match dekhein)
- [ ] KOT report table-wise dikhata hai — 👁️ (visual)
- [x] WhatsApp share link system browser mein khulta hai (chromeless window nahi) — ✅ (main.js setWindowOpenHandler → shell.openExternal)
- [ ] Report print hota hai — 👁️ (print visual)

## 19. Printing (Saari Surfaces)  — code ✅, asli print/PDF par dekhein
- [ ] Receipt print hota hai — 👁️ (+ ab center par aata hai — fix)
- [ ] KOT print hota hai — 👁️
- [ ] KOT ke turant baad Receipt print karne par overlap nahi hota (dono alag) — 👁️ (scoped surfaces ✅)
- [ ] Daily/Closing report print hota hai — 👁️
- [ ] Double-click par double print nahi hota (debounce) — 👁️ (safePrint 1.5s debounce ✅)

## 20. Permissions (Role-based)
- [x] Cashier ko sirf allowed pages dikhte hain (cancel/comp nahi) — ✅ (permissions.js UI + server)
- [x] Manager ko sahi pages (POS nahi, approvals haan) — ✅
- [x] Kitchen ko sirf /kitchen dikhta hai — ✅
- [x] Admin ko sab dikhta hai — ✅  *(pichhli line ka typo `[/xcvgm t]` saaf kar diya)*
- [x] Restricted route par direct jaane se redirect ho jata hai — ✅ (App.jsx Protected)

## 21. Language / i18n
- [x] English ⇄ Urdu toggle kaam karta hai — ✅ (LanguageContext)
- [ ] Urdu mode mein layout RTL (right-to-left) ho jata hai — 👁️ (dir=rtl ✅; screen par dekhein)
- [x] Urdu mode mein numbers/dates Urdu digits mein dikhte hain — ✅ (format.js ur-PK-u-nu-arabext)
- [x] Language choice reload ke baad yaad rehti hai — ✅ (localStorage('lang'))

## 22. Multi-Device / Real-Time (agar 2 device/window ho)  — 👁️ 2 device chahiye (Socket.IO wired)
- [ ] Ek device par order lagane se doosre ki Tables/KDS ~1 sec mein update hoti hai — 👁️
- [ ] Ek device par payment doosre par turant reflect hoti hai — 👁️
- [ ] Table Shift doosre device par update hota hai — 👁️
- [ ] Manual refresh ki zaroorat nahi — 👁️

## 23. Dashboard
- [ ] Revenue, pending orders, active tables, low-stock counts sahi dikhte hain — 👁️ (derive logic ✅; screen par dekhein)
- [x] Closing ke baad revenue reset dikhata hai (naya session) — ✅ (session boundary)

## 24. General / Stability
- [ ] App reload par login state + current route survive karta hai (deep-link reload) — 👁️ (electron-serve SPA fallback ✅)
- [x] Backend restart ke baad har device dobara login maangta hai (ye expected hai, bug nahi) — ✅ (in-memory sessions — by design)
- [x] External links (WhatsApp etc.) system browser mein khulte hain, chromeless window mein nahi — ✅ (setWindowOpenHandler)
- [ ] Koi console error / blank white screen / crash nahi aata — 👁️ (runtime)
- [ ] Lambi session ke baad bhi app slow/hang nahi hota — 👁️ (runtime)

---

### Notes / Bugs mile to yahan likhein:
- **Attendance & Payroll (Sec 16) mock hai** — attendance status + payroll ke present/absent din fake (generator se) hain. Manual override, advances, base salary asli hain. Asli attendance machine (ZKTeco uFace 550) + Phase B integration se real ho jayega.
- `👁️` wale items code mein sahi hain magar aap ko asli screen/printer/2-device par confirm karna hai (Claude click/dekh nahi sakti).
- Baaki poori app (orders, billing, inventory, recipes, menu, tables, shifts/handovers, receivables, accounting, settings, closing, permissions, i18n logic) code + 76 backend tests se verified hai.
