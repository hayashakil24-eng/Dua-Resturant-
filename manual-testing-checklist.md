# Café Ali — Manual Testing Checklist (Desktop App)

> Har point ko app mein khud chala kar `[x]` mark karein. Koi cheez galat mile to point ke saamne note likh dein.
> **Setup:** Backend chalao (`cd backend && npm run dev` → `:4000`), phir app (`cd frontend && npm run dev`). Agar "Cannot reach the server" aaye to backend band hai.
> **Demo logins:** `admin` / `manager` / `cashier` / `kitchen` — password sab ka `1234`.

---

## 0. Setup & Launch
- [ ] Backend start hota hai bina error (`:4000` pe listen)
- [ ] Desktop app khulta hai (Electron window)
- [ ] Server band ho to app "Cannot reach the server" dikhata hai
- [ ] Server dobara chalu karne par app khud connect ho jata hai

## 1. Login & Roles
- [ ] `admin`/`1234` se login hota hai
- [ ] `manager`/`1234` se login hota hai
- [ ] `cashier`/`1234` se login hota hai
- [ ] `kitchen`/`1234` se login hota hai
- [ ] Galat password par error dikhata hai (login nahi hota)
- [ ] Har role login ke baad apni sahi landing page par jata hai (Kitchen sirf /kitchen)
- [ ] Logout kaam karta hai, wapas login screen aata hai

## 2. Staff Self-Signup + Admin Approval
- [ ] Naya staff signup form se account bana sakta hai
- [ ] Naya account "pending" rehta hai, login nahi hota jab tak approve na ho
- [ ] Admin ko pending signup dikhta hai
- [ ] Admin approve kare to woh staff login kar sakta hai
- [ ] Admin reject kare to woh account login nahi kar sakta

## 3. Menu (Real Menu ~170 items + Images)
- [ ] POS/Menu par saare real items dikhte hain (Karahi, Biryani, Pizza, Shakes, BBQ, Chinese, etc.)
- [ ] Har item ki asli photo load hoti hai (broken image nahi)
- [ ] Categories sahi filter karti hain
- [ ] Search se item milta hai
- [ ] **Variants** wale items (Steak Beef/Chicken, Pizza S/M/L, Half/Full) sahi price/option dikhate hain
- [ ] Menu Management (Admin) se item add/edit hota hai

## 4. POS — Naya Order
- [ ] Order banate waqt **table select** karni parti hai
- [ ] Item cart mein add hota hai, qty barhti hai
- [ ] Variant select karne par sahi price aata hai
- [ ] Cart total sahi calculate hota hai
- [ ] Waiter/cashier name attach hota hai
- [ ] Order place hota hai (Unpaid ya Paid)
- [ ] GST on ho to total mein sahi tax add hota hai
- [ ] Rupees `Rs.` format mein dikhte hain (koi galat currency nahi)

## 5. Tables (Seating Map)
- [ ] Saari tables grid mein dikhti hain (A1, A2... HUT, etc.)
- [ ] Khaali table green, in-use table red dikhti hai
- [ ] In-use table par order ki detail dikhti hai (items, waiter, minutes)
- [ ] Khaali table par tap → POS khulta hai us table ke sath
- [ ] Category chips (A–H, Special/HUT) sahi filter karti hain
- [ ] Search se table milti hai
- [ ] Tabs (Running / Available / All) sahi count dikhate hain

## 6. Table Manage (Add / Rename / Delete)
- [ ] "Manage" button (Admin/Manager) khulta hai
- [ ] Nayi table add hoti hai (number, name, capacity, section)
- [ ] Existing table ka **naam (rename)** change hota hai — edit button se
- [ ] In-use table delete nahi hoti (button disabled)
- [ ] Khaali table delete hoti hai (sirf Admin)
- [ ] Duplicate table number par error aata hai

## 7. Table Shift (Naya Feature) 🔄
- [ ] Running order par "Shift Table" button dikhta hai (Orders page + Tables detail)
- [ ] Modal khulta hai, current table `A1 → —` dikhta hai
- [ ] **Search bar** se destination table filter hoti hai
- [ ] **Pagination** (Prev · 1 2 3 · Next) kaam karti hai jab tables zyada hon
- [ ] Occupied table "in use" flag ke sath dikhti hai
- [ ] Nayi table select karne par summary `A1 → A3` update hoti hai
- [ ] "Move Order" par order us nayi table par chala jata hai
- [ ] Paid/cancelled order par Shift Table nahi hota (sirf running/unpaid)
- [ ] Doosre device par bhi table change ~1 second mein update hota hai

## 8. Orders Page
- [ ] Saare orders list mein dikhte hain (ORD-xxxx)
- [ ] Filter (All / Paid / Unpaid / Udhaar / Complimentary / Cancelled) sahi count dikhata hai
- [ ] Search (order/waiter/table) kaam karti hai
- [ ] Running order mein **item add** hota hai (Add More Items)
- [ ] Item ki **qty edit** hoti hai
- [ ] Print Bill unpaid order ka bill nikaalta hai (paid mark nahi karta)

## 9. Payment / Order Status
- [ ] "Mark as Paid" → Cash / Card / Online choose hota hai
- [ ] Online payment par account select hota hai
- [ ] "Udhaar" (on-account) → customer name/account se ledger mein charge lagta hai (Manager/Admin)
- [ ] "Complimentary" → free order, authorizer name mangta hai (Manager/Admin)
- [ ] "Cancel" → reason zaroori, audit log mein aata hai (sirf Admin)
- [ ] Cancelled order ka material loss dikhta hai
- [ ] Koi bhi order **delete** nahi hota (sirf status change)

## 10. Kitchen / KOT / KDS
- [ ] Naya order kitchen display (KDS) par aata hai
- [ ] Department-wise KOT alag counters par print hote hain (Grill/Bar/Bakery)
- [ ] Ek item ek hi department par jata hai (dobara assign se move hota hai)
- [ ] KDS par "Ready" mark hota hai
- [ ] "Served"/clear kaam karta hai
- [ ] /kds fullscreen (bina sidebar) chalti hai

## 11. Recipes & Inventory Auto-Deduction
- [ ] Kitchen recipe banata hai (menu item → ingredients)
- [ ] Recipe "pending" rehti hai jab tak Admin approve na kare
- [ ] Admin recipe approve karta hai
- [ ] Approved recipe wale item ka order lagne par inventory **auto-deduct** hoti hai
- [ ] Order cancel par reusable items **restock** hote hain
- [ ] Recipe na ho to POS phir bhi kaam karta hai (deduction skip)
- [ ] Recipe edit / delete kaam karta hai (naya feature)
- [ ] Unit picker sahi units dikhata hai

## 12. Inventory
- [ ] Inventory items list dikhti hai (stock, threshold)
- [ ] Manager naya stock add karta hai
- [ ] Admin existing quantity correct karta hai
- [ ] Low-stock items highlight hote hain
- [ ] Ingredient request (Kitchen) → Admin approve/reject kar sakta hai

## 13. Cash Drawer / Shift (Cashier)
- [ ] Cashier login par opening cash mangta hai (drawer start)
- [ ] Shift pause / resume hota hai
- [ ] Sales shift se attach hoti hain (shiftId, timestamp se nahi)
- [ ] Mid-shift handover → Manager/Admin accept/reject kare tab cash nikalta hai
- [ ] Shift end par expected vs actual cash reconcile hota hai (match/short/over)
- [ ] Handover approvals page par pending/processed dikhte hain

## 14. Accounting
- [ ] Monthly view saara data dikhata hai
- [ ] **Daily** view par click karne se us din ka data dikhta hai (khaali nahi)
- [ ] Naya transaction (income/expense) add hota hai
- [ ] Raat 12 baje ke baad ka entry sahi tareekh par jata hai (UTC bug nahi)
- [ ] Expense **category-wise breakdown** dikhta hai (Maintenance/Construction alag)
- [ ] Har function ka detail/breakdown available hai

## 15. Receivables (Udhaar / Credit)
- [ ] Credit accounts list dikhti hai (outstanding balance)
- [ ] Account par click → us ke **saare bills ka breakdown** expand hota hai
- [ ] "Mark Paid" se payment receive hoti hai (poori ya partial)
- [ ] Partial payment par balance kam hota hai
- [ ] Naya credit account add hota hai (opening balance)

## 16. Attendance & Payroll
- [ ] Attendance status dikhta hai (Present/Late/Checked Out/Absent)
- [ ] Manual override (machine offline) reason ke sath save hota hai
- [ ] Override audit log mein aata hai
- [ ] Payroll calculations sahi aate hain (advances included)

## 17. Day Closing — Full Business-Day Close (Naya Feature) 🔒
- [ ] Closing page par aaj ke sahi figures dikhte hain
- [ ] **Warning dialog** aata hai Save Closing se pehle
- [ ] Koi bill **unpaid** ho to closing **block** hoti hai (banner + button disabled)
- [ ] Unpaid ko Udhaar/Complimentary karne ke baad closing allow hoti hai
- [ ] **Cash drawer khula** ho to closing block hoti hai (banner: drawer end karo)
- [ ] Drawer band karne ke baad closing allow hoti hai
- [ ] Save Closing → report "Closing History" mein save hota hai
- [ ] Save ke **turant baad**: Closing preview **zero** ho jati hai (reset)
- [ ] Save ke baad **Dashboard revenue reset** ho jati hai
- [ ] Dobara Save karne par **block** hota hai ("koi nayi sale nahi") jab tak nayi sale na ho
- [ ] Nayi sale karne par phir se close ho jata hai (agla session)
- [ ] Purani closing history + reports mein **kuch delete nahi** hota (sab mehfooz)
- [ ] Closing slip **print** hoti hai (screen ka same document)

## 18. Reports
- [ ] Daily report sahi figures dikhata hai (receipts se match)
- [ ] KOT report table-wise dikhata hai
- [ ] WhatsApp share link system browser mein khulta hai (chromeless window nahi)
- [ ] Report print hota hai

## 19. Printing (Saari Surfaces)
- [ ] Receipt print hota hai
- [ ] KOT print hota hai
- [ ] KOT ke turant baad Receipt print karne par overlap nahi hota (dono alag)
- [ ] Daily/Closing report print hota hai
- [ ] Double-click par double print nahi hota (debounce)

## 20. Permissions (Role-based)
- [ ] Cashier ko sirf allowed pages dikhte hain (cancel/comp nahi)
- [ ] Manager ko sahi pages (POS nahi, approvals haan)
- [ ] Kitchen ko sirf /kitchen dikhta hai
- [ ] Admin ko sab dikhta hai
- [ ] Restricted route par direct jaane se redirect ho jata hai

## 21. Language / i18n
- [ ] English ⇄ Urdu toggle kaam karta hai
- [ ] Urdu mode mein layout RTL (right-to-left) ho jata hai
- [ ] Urdu mode mein numbers/dates Urdu digits mein dikhte hain
- [ ] Language choice reload ke baad yaad rehti hai

## 22. Multi-Device / Real-Time (agar 2 device/window ho)
- [ ] Ek device par order lagane se doosre ki Tables/KDS ~1 sec mein update hoti hai
- [ ] Ek device par payment doosre par turant reflect hoti hai
- [ ] Table Shift doosre device par update hota hai
- [ ] Manual refresh ki zaroorat nahi

## 23. Dashboard
- [ ] Revenue, pending orders, active tables, low-stock counts sahi dikhte hain
- [ ] Closing ke baad revenue reset dikhata hai (naya session)

## 24. General / Stability
- [ ] App reload par login state + current route survive karta hai (deep-link reload)
- [ ] Backend restart ke baad har device dobara login maangta hai (ye expected hai, bug nahi)
- [ ] External links (WhatsApp etc.) system browser mein khulte hain, chromeless window mein nahi
- [ ] Koi console error / blank white screen / crash nahi aata
- [ ] Lambi session ke baad bhi app slow/hang nahi hota

---

### Notes / Bugs mile to yahan likhein:
-
-
-
