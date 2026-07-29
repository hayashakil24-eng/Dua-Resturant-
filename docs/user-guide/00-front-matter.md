# Cafe Ali — User Guide

<!-- COVER -->

**[Logo: Cafe Ali — yahan logo image lagayein (`frontend/public/Cafe Ali Logo -final.png`)]**

## Cafe Ali
### Restaurant Management System — Mukammal User Guide

| | |
|---|---|
| **Product** | Cafe Ali — Restaurant / Hotel Management System |
| **Type** | Desktop software (Windows) — Electron app, offline-first |
| **Version** | 1.0.0 |
| **Guide version** | 1.0 |
| **Tareekh** | 28 July 2026 |
| **Tech stack** | React + Vite + Tailwind (screen), Fastify + Prisma (server), SQLite (local database), PostgreSQL (VPS backup) |
| **User roles** | Admin, Manager, Cashier, Kitchen |
| **Guide ki zabaan** | Roman Urdu (button aur field ke naam waise hi jaise screen par likhe hain) |

---

<!-- PAGE BREAK -->

## Ye guide kaise parhein

- **Button aur field ke naam** jaise screen par likhe hain waise hi likhe gaye hain (mostly English), taake aap seedha dhoondh sakein. Misal: "Sign in", "Process Bill".
- Screen ka naam **bold** mein hai, aur `route` (yani app ka internal address) uske saath diya gaya hai.
- Jahan `[Screenshot: ...]` likha hai, wahan aap apni screen ki tasveer laga sakte hain.
- ⚠️ ka nishan un cheezon par hai jo paisay, stock ya staff record ko permanently badalti hain.

---

<!-- PAGE BREAK -->

## Table of Contents

| # | Section | Page |
|---|---|---|
| **1** | **Introduction** | 5 |
| 1.1 | Cafe Ali kya hai | 5 |
| 1.2 | Ye system kis ke liye hai | 5 |
| 1.3 | System kaise chalta hai (local server + devices) | 6 |
| 1.4 | Guide ka daayra | 6 |
| **2** | **Getting Started** | 7 |
| 2.1 | Zaroori cheezein (requirements) | 7 |
| 2.2 | App kholna | 7 |
| 2.3 | Login karna | 8 |
| 2.4 | Naya account banana (signup) | 8 |
| 2.5 | Password badalna / bhool jaana | 9 |
| 2.6 | Zabaan badalna (English ⇄ اردو) | 9 |
| 2.7 | Log out karna | 10 |
| **3** | **User Roles aur Permissions** | 11 |
| 3.1 | Chaar roles — ek nazar mein | 11 |
| 3.2 | Page access table | 12 |
| 3.3 | Action-level permissions table | 13 |
| 3.4 | Separation of duties — kyun kuch kaam alag rakhe gaye hain | 14 |
| **4** | **Page-by-Page Guide** | 15 |
| 4.0 | Har page par mojood cheezein (Sidebar aur Header) | 15 |
| 4.1 | Login | 18 |
| 4.2 | Create account (Signup) | 20 |
| 4.3 | Awaiting approval | 22 |
| 4.4 | Approvals | 23 |
| 4.5 | Dashboard | 25 |
| 4.6 | New Order (POS) | *Batch 2* |
| 4.7 | Orders | *Batch 2* |
| 4.8 | Tables | *Batch 2* |
| 4.9 | Billing | *Batch 2* |
| 4.10 | Kitchen (KDS) | *Batch 2* |
| 4.11 | Menu | *Batch 3* |
| 4.12 | Departments | *Batch 3* |
| 4.13 | Inventory | *Batch 3* |
| 4.14 | Kitchen | *Batch 3* |
| 4.15 | Attendance | *Batch 4* |
| 4.16 | Employees | *Batch 4* |
| 4.17 | Payroll | *Batch 4* |
| 4.18 | Accounting | *Batch 5* |
| 4.19 | Receivables | *Batch 5* |
| 4.20 | Handover Approvals | *Batch 5* |
| 4.21 | Reports | *Batch 5* |
| 4.22 | Day Closing | *Batch 5* |
| 4.23 | Settings | *Batch 5* |
| **5** | **Common Workflows** | *Batch 6* |
| **6** | **Troubleshooting / FAQ** | *Batch 6* |
| **7** | **Glossary** | *Batch 6* |

> Page numbers final PDF banane ke baad update honge.

---

<!-- PAGE BREAK -->

# 1. Introduction

## 1.1 Cafe Ali kya hai

Cafe Ali ek **restaurant management software** hai jo aap ke restaurant ka poora din-bhar ka kaam ek hi jagah sambhalta hai — order lena, table sambhalna, bill banana, kitchen ko parchi bhejna, stock ghatana, staff ki hazri, tankhwah, hisab-kitab aur din ke aakhir ki closing report.

Ye ek **desktop software** hai (Windows par install hota hai), website nahi. Iska matlab ye hai ke **internet band ho jaye tab bhi restaurant ka kaam nahi rukta** — sara kaam restaurant ke andar wale server PC par hota hai. Internet sirf backup ke liye chahiye hota hai.

## 1.2 Ye system kis ke liye hai

| Kaun | Kya karta hai |
|---|---|
| **Malik / Admin** | Poore restaurant ki nigrani — paisa, reports, staff, settings, aur har ahem manzoori (approval). |
| **Manager** | Rozana ka operation — floor, staff, stock, cashier se cash lena. |
| **Cashier** | Order punch karna, bill lena, apna cash drawer chalana. |
| **Kitchen / Chef** | Kitchen screen par order dekhna aur recipe banana. |

## 1.3 System kaise chalta hai (local server + devices)

```
        ┌──────────────────────────────┐
        │   Server PC (restaurant)     │
        │   • Local database (SQLite)  │
        │   • Sab ka data yahan hai    │
        └───────────────┬──────────────┘
                        │  LAN / WiFi
        ┌───────────────┼───────────────┬───────────────┐
        │               │               │               │
   ┌────▼────┐    ┌─────▼────┐    ┌─────▼────┐   ┌──────▼─────┐
   │ Cashier │    │ Manager  │    │  Admin   │   │ Kitchen KDS│
   │ counter │    │  laptop  │    │  office  │   │  monitor   │
   └─────────┘    └──────────┘    └──────────┘   └────────────┘
                        │
                        │  (jab internet ho)
                  ┌─────▼─────┐
                  │  VPS      │  ← backup copy, cloud par
                  └───────────┘
```

Do ahem baatein:

1. **Ek device par kiya gaya kaam doosre device par khud-ba-khud (roughly 1 second mein) nazar aa jata hai.** Refresh dabane ki zaroorat nahi.
2. **Server PC chalna zaroori hai.** Agar server band ho ya network toot jaye, to baaqi devices par "Cannot reach the server" ka message aayega.

## 1.4 Guide ka daayra

Is guide mein app ka **har page** aur har page ka **har button, field, dropdown aur icon** shamil hai. Har page ke liye ye cheezein di gayi hain:

- Page ka naam aur route
- Page kis kaam ka hai
- Kaun kaun is page ko khol sakta hai
- Screenshot ki jagah
- **Elements table** — har control ka poora tafseeli bayan
- "Ye kaam kaise karein" — numbered steps
- Us page par aane wale error messages aur unka hal

---

<!-- PAGE BREAK -->

# 2. Getting Started

## 2.1 Zaroori cheezein (requirements)

| Cheez | Tafseel |
|---|---|
| **Operating system** | Windows 10 ya us se naya |
| **Server PC** | Ek dedicated computer jo restaurant ke andar hamesha chalta rahe. Isi par data mehfooz hota hai. |
| **Network** | Sab devices ek hi WiFi/LAN par hone chahiye |
| **Internet** | Rozana kaam ke liye **zaroori nahi**. Sirf cloud backup ke liye chahiye. |
| **Printer** | Receipt printer (bill aur KOT parchi ke liye) — Windows ka default printer set hona chahiye |
| **Screen** | Kam se kam 1366×768. Kitchen Display (KDS) ke liye alag monitor behtar hai. |

> **Note:** App ko phone ya tablet par bhi kholna mumkin hai (browser ke zariye), lekin ye asal mein **desktop ke liye banaya gaya hai**.

## 2.2 App kholna

1. Desktop par **Cafe Ali** ka icon double-click karein.
2. App khulte hi seedha **Login** screen aati hai.
3. Agar screen par "Cannot reach the server" likha aaye, to iska matlab hai ke server PC band hai ya network mein masla hai — Section 6 (Troubleshooting) dekhein.

## 2.3 Login karna

Section **4.1 Login** mein poori tafseel di gayi hai. Mukhtasar tareeqa:

1. **Username** likhein (chhote haroof mein — capital/small ka farq nahi parta).
2. **Password** likhein.
3. **Sign in** dabayein.

Login ke baad app aap ko **aap ke role ke pehle page** par le jata hai:

| Role | Login ke baad kahan pohanchte hain |
|---|---|
| Admin | Dashboard |
| Manager | Dashboard |
| Cashier | New Order (POS) — pehle cash drawer kholne ka box aata hai |
| Kitchen | Kitchen page |

## 2.4 Naya account banana (signup)

Naya staff member khud apna account bana sakta hai, lekin **jab tak Admin manzoori na de, wo app istemal nahi kar sakta**.

1. Login screen par **Sign up** par click karein.
2. Full name, Username, Password, Confirm password bhar kar **Create account** dabayein.
3. Ab Admin ka intezar karein. Admin **Approvals** page se aap ka role (Admin / Manager / Cashier / Kitchen) chun kar **Approve** dabayega.
4. Manzoori ke baad dobara login karein — ab app khul jayega.

Tafseel ke liye Section **4.2** aur **4.4** dekhein.

## 2.5 Password badalna / bhool jaana

> ⚠️ **Login screen par "Forgot password" ka koi link nahi hai.** Ye jaan-boojh kar hai — password sirf Admin reset kar sakta hai.

| Surat-e-haal | Kya karein |
|---|---|
| **Apna password badalna hai** (aur purana yaad hai) | Sirf Admin ke paas Settings page hai. Baaqi roles apne manager/Admin se kehen. → Settings › **Login Passwords** › "My password" |
| **Password bhool gaye** | Admin se rabta karein. Admin: Settings › **Login Passwords** › us shaks ka naam chunein › naya password daal kar **Change Password** dabayein. |
| **Naye employee ko pehli baar login dena hai** | Admin: Settings › **Login Passwords** › employee chunein › username + system role + password daal kar **Create Login** dabayein. |

**Password ka usool:** kam se kam **6 characters**.

> ⚠️ Jab Admin kisi ka password reset karta hai, to us shaks ke **saare devices se session khatam ho jata hai** — unhein naye password se dobara login karna parta hai. Ye jaan-boojh kar hai, taake khoya hua ya ghalat session band kiya ja sake.

## 2.6 Zabaan badalna (English ⇄ اردو)

Har page ke ooper daayein taraf **EN | اردو** ka toggle hai.

- **EN** — poora app English mein.
- **اردو** — admin/reports wale pages Urdu mein aur **RTL** (dayein se baayein) ho jate hain, aur numbers bhi Urdu ke andaaz mein likhe jate hain.
- **Ahem:** Cashier ke rozana kaam wale pages (**New Order/POS, Orders, Billing**) hamesha English aur LTR hi rehte hain, chahe zabaan Urdu chuni ho. Ye jaan-boojh kar hai, taake counter par kaam ki raftaar aur receipt ki tarteeb kharab na ho.
- Aap ka chunaav **yaad rakha jata hai** — agli baar app kholne par wahi zabaan hogi.

## 2.7 Log out karna

Sidebar mein sab se neeche aap ke naam wale card par **log-out ka icon** (↪) hai.

| Role | Log out dabane par kya hota hai |
|---|---|
| Admin / Manager / Kitchen | Seedha log out ho jate hain. |
| **Cashier (drawer khula ho)** | Ek box aata hai: **"Log out — kya karein?"** — pehle ye tay karna parta hai ke drawer band karna hai ya thori der ke liye pause. Tafseel Section 4.0.4 mein. |

---

<!-- PAGE BREAK -->

# 3. User Roles aur Permissions

## 3.1 Chaar roles — ek nazar mein

| Role | Kaam | Sab se ahem ikhtiyar | Sab se ahem pabandi |
|---|---|---|---|
| **Admin** | Malik / owner-level. Poore system ka control. | Recipe approve karna, bill cancel karna, Settings, staff signup approve karna, sab ka cash apne paas jama karna | **Cash drawer nahi chala sakta** ka matlab nahi — Admin drawer chala sakta hai, lekin cash forward nahi kar sakta (wo aakhri manzil hai) |
| **Manager** | Rozana operation ka incharge. | Stock kharidna, staff, payroll, discount, cashier se cash lena aur Admin ko aage dena | **Cash drawer nahi chala sakta**; **recipe approve nahi kar sakta**; **bill cancel nahi kar sakta**; **staff signup approve nahi kar sakta** |
| **Cashier** | Counter par order aur bill. | Order punch karna, bill lena, apna cash drawer chalana, "Most Ordered" list set karna | Discount nahi de sakta; bill cancel nahi kar sakta; complimentary nahi kar sakta; Dashboard/Reports/Inventory nahi dekh sakta |
| **Kitchen** | Chef / kitchen staff. | Recipe banana, ingredient ki request dena, KDS dekhna | Sirf 2 page dekh sakte hain (Kitchen aur KDS). Apni banayi recipe khud approve nahi kar sakte. |
| *(Pending)* | Naya signup jiski manzoori baaqi hai. | Kuch nahi | Har page band. Sirf "Awaiting approval" screen dikhti hai. |

## 3.2 Page access table

**Nishaniyan:** ✅ = poora access · 👁 = sirf dekh sakte hain · ➕ = bana/add kar sakte hain (sab kuch nahi) · ❌ = ye page nazar hi nahi aata

| # | Page | Route | Admin | Manager | Cashier | Kitchen |
|---|---|---|---|---|---|---|
| 1 | Dashboard | `/` | ✅ | ✅ | ❌ | ❌ |
| 2 | New Order (POS) | `/pos` | ✅ | ✅ | ✅ | ❌ |
| 3 | Orders | `/orders` | ✅ | 👁 | ✅ | ❌ |
| 4 | Tables | `/tables` | ✅ | ✅ | ✅ | ❌ |
| 5 | Kitchen (KDS) | `/kds` | ✅ | ✅ | ❌ | ✅ |
| 6 | Menu | `/menu` | ✅ | ✅ | ❌ | ❌ |
| 7 | Departments | `/departments` | ✅ | ✅ | ❌ | ❌ |
| 8 | Inventory | `/inventory` | ✅ | ✅ | ❌ | ❌ |
| 9 | Kitchen | `/kitchen` | 👁 | 👁 | ❌ | ✅ |
| 10 | Attendance | `/attendance` | ✅ | ✅ | ❌ | ❌ |
| 11 | Employees | `/employees` | ✅ | ✅ | ❌ | ❌ |
| 12 | Approvals | `/approvals` | ✅ | ❌ | ❌ | ❌ |
| 13 | Payroll | `/payroll` | ✅ | ✅ | ❌ | ❌ |
| 14 | Accounting | `/accounting` | ✅ | ✅ | ❌ | ❌ |
| 15 | Receivables | `/receivables` | ✅ | ✅ | ❌ | ❌ |
| 16 | Handover Approvals | `/handovers` | ✅ | ✅ | ❌ | ❌ |
| 17 | Billing | `/billing` | ✅ | ➕ | ➕ | ❌ |
| 18 | Reports | `/reports` | ✅ | ✅ | ❌ | ❌ |
| 19 | Day Closing | `/closing` | ✅ | ✅ | ❌ | ❌ |
| 20 | Settings | `/settings` | ✅ | ❌ | ❌ | ❌ |

> **Note:** Jo page kisi role ke liye ❌ hai, wo us role ke sidebar mein **nazar hi nahi aata**. Agar koi seedha us ka address kholne ki koshish kare, to app khud us ke apne pehle page par wapas bhej deta hai.

## 3.3 Action-level permissions table

Ye wo kaam hain jo page khulne ke *baad* alag se check hote hain:

| Action | Kya hai | Admin | Manager | Cashier | Kitchen |
|---|---|---|---|---|---|
| `orderCancel` | Bill/order cancel karna | ✅ | ❌ | ❌ | ❌ |
| `discount` | Bill par discount dena | ✅ | ✅ | ❌ | ❌ |
| `orderComplimentary` | Order muft (free) karna | ✅ | ✅ | ❌ | ❌ |
| `drawer` | Cash drawer chalana (start/pause/end) | ✅ | ❌ | ✅ | ❌ |
| `handovers` | Cash handover accept/reject karna | ✅ | ✅ | ❌ | ❌ |
| `handoverForward` | Jama shuda cash aage Admin ko dena | ❌ | ✅ | ❌ | ❌ |
| `recipeCreate` | Nayi recipe banana | ❌ | ❌ | ❌ | ✅ |
| `recipeApproval` | Recipe approve karna | ✅ | ❌ | ❌ | ❌ |
| `inventoryAdd` | Stock kharidna / add karna | ✅ | ✅ | ❌ | ❌ |
| `inventoryCreate` | Bilkul naya inventory item banana | ✅ | ✅ | ❌ | ❌ |
| `inventoryDirectEdit` | Mojooda stock ki quantity theek karna | ✅ | ✅ | ❌ | ❌ |
| `staffApproval` | Naye signup ko approve karna | ✅ | ❌ | ❌ | ❌ |
| `tableAdd` | Naya table banana | ✅ | ✅ | ❌ | ❌ |
| `categoryAdd` | Nayi menu category banana | ✅ | ✅ | ❌ | ❌ |
| `mostOrderedManage` | POS ki "Most Ordered" list set karna | ✅ | ✅ | ✅ | ❌ |
| `attendanceOverride` | Hazri manually theek karna (machine kharab ho to) | ✅ | ✅ | ❌ | ❌ |
| `wastageReport` | Zaya (wastage) report karna | ✅ | ✅ | ❌ | ✅ |
| `wastageApproval` | Wastage approve karna | ✅ | ✅ | ❌ | ❌ |

> **Note:** `wastageReport` aur `wastageApproval` aane wale wastage feature ke liye pehle se tay ki gayi policy hain.

## 3.4 Separation of duties — kyun kuch kaam alag rakhe gaye hain

Kuch pabandiyan "kami" nahi, balke **jaan-boojh kar** rakhi gayi hain, taake ek hi banda akela paisa ya stock idhar-udhar na kar sake. Inhein badalne se pehle zaroor sochein:

| Usool | Kyun |
|---|---|
| **Sirf Admin recipe approve karta hai** (Kitchen banata hai) | Ghalat recipe har order par khamoshi se ghalat stock kaat degi. Isliye jo banaye wo approve na kare. |
| **Manager cash drawer nahi chala sakta** | Manager wo shaks hai jo cashier se **cash wasool** karta hai. Agar wohi drawer bhi chalaye, to cash dene wala aur lene wala ek hi banda ho jayega — poori chain bekar. |
| **Sirf Manager cash aage forward karta hai; Admin nahi** | Cash ka rasta hai: Cashier → Manager/Admin → Admin. Admin aakhri manzil hai, us ke aage koi nahi. |
| **Handover sirf wohi role accept karta hai jise bheja gaya** | Jo cash le raha hai, wohi dastakhat karega — koi doosra Manager beech mein click kar ke sign nahi kar sakta. |
| **Manager bill cancel nahi kar sakta** | Bill cancel karna paisa ghayab karne ka sab se aasan tareeqa hai — isliye sirf Admin. |
| **Manager staff signup approve nahi kar sakta** | Warna Manager apna hi banaya hua account approve kar ke extra ikhtiyar le sakta tha. |

---
