<!-- PAGE BREAK -->

## 4.18 Accounting

**Route:** `/accounting` · Sidebar: **Finance › Accounting**

### Ye page kis kaam ka hai

Restaurant ka **hisab-kitab** — kitna kamaya, kitna kharch hua, aur kitna bacha. Aamdani (income) **khud POS ki sale se** aati hai; kharche (expenses) yahan haath se darj kiye jate hain. Din ka aur maheene ka — dono tarah ka nazariya milta hai, aur poori ledger print bhi ho sakti hai.

**Kaun access kar sakta hai:** ✅ Admin, Manager · ❌ Cashier, Kitchen

**[Screenshot: accounting]**

> ℹ️ **Aamdani haath se nahi likhi jati.** Sale khud POS ke paid orders se ginti hai. Isliye is page par sirf **Add Expense** ka button hai, "Add Income" ka nahi.

### 4.18.1 Ooper ke controls

| # | Element | Type | Kya karta hai | Notes |
|---|---|---|---|---|
| 1 | **Daily** / **Monthly** | Toggle | Ek din ka ya poore maheene ka hisab | Default: **Daily** |
| 2 | Tareekh ka picker | Date input | Kaunsa din dekhna hai | **Daily** mode mein. Pichhle 6 maheene se aaj tak |
| 3 | Maheene ka dropdown | Dropdown | Kaunsa maheena | **Monthly** mode mein. Pichhle 6 maheene |

### 4.18.2 Paanch stat tiles

| # | Tile | Kya batata hai |
|---|---|---|
| 1 | **Income** (sabz) | Us din/maheene ki wasooli (POS sale) |
| 2 | **Udhaar (credit)** (amber) | Kitna udhaar par gaya — *"On account · not yet received"*. ⚠️ Ye paisa **abhi aaya nahi** hai |
| 3 | **Expenses** (surkh) | Kul kharche. Neeche amber mein: **+ Maintenance: Rs. …** ⚠️ Maintenance is figure **mein shamil nahi** — uska apna alag box hai |
| 4 | **Net Profit** | Income − Expenses − Maintenance. Neeche "Profit" ya "Loss" |
| 5 | **Profit Margin** | Nafa income ka kitne percent hai |

> ℹ️ **Monthly mode mein "Expenses" ke andar staff payroll bhi shamil hai** (*"Incl. payroll"*). **Daily** mode mein payroll shamil nahi hota — wo maheene ka kharcha hai, kisi ek din par nahi baanta jata. Isi wajah se ek hi arse ka Daily aur Monthly kharcha alag lag sakta hai.

### 4.18.3 Complimentary orders ka panel

**Kab dikhta hai:** Sirf jab us arse mein koi muft (complimentary) order hua ho.

| # | Element | Kya batata hai |
|---|---|---|
| 1 | Bara jamni number | **Est. cost** — ingredients ka andaza kharcha |
| 2 | Neeche | "est. cost · bill forgone Rs. …" — jo bill chhora gaya |
| 3 | Table | Har order ki alag line: **Order · Table · Reason · Authorized By · Bill Forgone · Est. Cost** |

> **Usool:** Kitabon mein **cost** likha jata hai, bill ki raqam nahi — kyunke asal nuqsan sirf ingredients ka hai.

### 4.18.4 Charts aur breakdown

| # | Panel | Kab dikhta hai | Kya batata hai |
|---|---|---|---|
| 1 | **Profit & Loss** | Sirf **Monthly** | 6 maheene ka chart — sabz patti = Income, surkh = Expenses. Mouse le jane se raqam dikhti hai |
| 2 | **Expense Breakdown** | Dono | Har category ka kharcha, bari se chhoti tarteeb mein. Monthly mein **Salaries** bhi shamil. ⚠️ **Maintenance is mein nahi** |
| 3 | **Cafe Ali Maintenance** | Dono | Maintenance ke saare kharche alag, tareekh ke saath, aur unka **Total** |

### 4.18.5 Ledger (Transactions)

| # | Element | Type | Kya karta hai | Notes |
|---|---|---|---|---|
| 1 | **Print Report** | Button | Poori ledger print karta hai | ⚠️ Print par **saari rows** aati hain, sirf screen par dikhne wali nahi |
| 2 | **+ Add Expense** | Button (gold) | Naya kharcha darj karne ka form | 4.18.6 |
| 3 | Ledger ki table | Table | **Date · Description · Category · Amount · Action** | Income sabz "+", kharche surkh "−" |
| 4 | **AUTO** ka tag | Badge | Ye line khud bani hai | Misal: "POS sales (auto)", "Staff payroll (auto from Payroll)" |
| 5 | 🗑 (trash) | Icon button | Kharche ki line delete karta hai | ⚠️ **AUTO** wali lines par ye nahi hota — un ki jagah "—" hota hai |
| 6 | "—" (Action column) | Label | Ye line yahan se delete nahi ho sakti | Ye line kisi aur kaam se bani hai (stock purchase, salary advance). Use **usi page se** wapas lena parta hai |

> ⚠️ **Locked lines kyun hain:** agar aap Buy Stock ka kharcha yahan se delete kar dein, to stock to barha hua rahega lekin uska kharcha ghayab ho jayega — hisab bigar jayega. Isliye aisi line sirf apne asal page se hat sakti hai.

### 4.18.6 "Add Expense" ka form

| # | Element | Type | Kya karta hai | Validation / Notes |
|---|---|---|---|---|
| 1 | **Category** | Dropdown | Kharche ki qism | **Rent · Utilities · Supplies · Gas · Cafe Ali Maintenance · Marketing · Other** |
| 2 | **Description** | Text input | Kharche ki tafseel | **Zaroori.** Misal: "Vegetable purchase" |
| 3 | **Amount (Rs.)** | Number input | Raqam | **Zaroori**, 0 se zyada |
| 4 | **Date** | Date picker | Kharche ki tareekh | Default: aaj |
| 5 | **✓ Save** | Button (gold) | Kharcha darj kar deta hai | Description aur amount bagair band rehta hai |
| 6 | **Cancel** / ✕ | Button / Icon | Box band | Escape se bhi |

> ℹ️ **"Cafe Ali Maintenance" chunne ka natija:** ye kharcha aam "Expenses" mein nahi, apne alag box mein jayega. Ye jaan-boojh kar hai — maintenance ko alag dekhna client ki zaroorat thi.

### Ye kaam kaise karein

**A. Rozana kharcha darj karna**

1. **Daily** mode mein sahi tareekh chunein.
2. **+ Add Expense** dabayein.
3. Category chunein, tafseel aur raqam likhein.
4. **✓ Save** dabayein.

**B. Maheene ka hisab dekhna**

1. **Monthly** dabayein aur maheena chunein.
2. **Net Profit** aur **Profit Margin** dekhein.
3. **Profit & Loss** chart se 6 maheene ka rujhan samjhein.
4. **Expense Breakdown** se dekhein ke paisa kahan zyada ja raha hai.

**C. Hisab ki copy nikalna**

1. Arsa (din ya maheena) chunein.
2. Ledger ke ooper **Print Report** dabayein.

---

<!-- PAGE BREAK -->

## 4.19 Receivables (Udhaar khaate)

**Route:** `/receivables` · Sidebar: **Finance › Receivables**

### Ye page kis kaam ka hai

Jin customers ne bill **udhaar** par liya, unke khaate yahan hain — kis ka kitna baqaya hai, kaun se bill se bana, aur kab kitna wasool hua. Yahin se **payment darj** ki jati hai.

**Kaun access kar sakta hai:** ✅ Admin, Manager · ❌ Cashier, Kitchen

> ⚠️ **Yahan naya khata haath se nahi banta.** Khata sirf tab banta hai jab koi unpaid order **Orders page se "Udhaar"** kiya jaye (Section 4.7.5). Ye jaan-boojh kar hai — har udhaar ke peeche ek asal bill hona chahiye.

**[Screenshot: receivables]**

### 4.19.1 Ooper ke controls aur cards

| # | Element | Type | Kya karta hai | Notes |
|---|---|---|---|---|
| 1 | **Show all (incl. settled)** | Checkbox | Poore ho chuke khaate bhi dikhata hai | Default: sirf **open** khaate |
| 2 | **Open Receivables** | Stat card | Kul kitna paisa wasool hona hai | — |
| 3 | **Settled** | Stat card | Ab tak kul kitna wasool hua | — |

### 4.19.2 Khaaton ki table

| Column | Kya batata hai |
|---|---|
| **(chevron)** | Row kholne ka nishan — bill-by-bill tafseel dikhata hai |
| **Account** | Customer ka naam (aur notes agar hon) |
| **Type** | **customer** / **hotel** / **business** |
| **Outstanding** | Baqaya raqam — surkh (open) ya sabz (settled) |
| **Status** | **OPEN** ya **SETTLED** ka badge |
| **Action** | **Mark Paid** ka button (sirf open par) |

| # | Element | Type | Kya karta hai | Notes |
|---|---|---|---|---|
| 1 | Row par click | Row | Bill breakdown kholta/band karta hai | 4.19.3 |
| 2 | **Mark Paid** | Button (gold) | Payment darj karne ka box | 4.19.4 |
| 3 | **Load more · 20/45** | Button | Aur khaate | — |
| 4 | **No open receivables.** / **No receivables.** | Empty state | Kuch nahi mila | — |

### 4.19.3 Bill breakdown (row khulne par)

| Column | Kya batata hai |
|---|---|
| **Date** | Bill ki tareekh |
| **Order** | Order number (ORD-…) |
| **By** | Kis ne udhaar kiya |
| **Amount** | Bill ki raqam |
| **View Bill** | Button — us bill ki poori receipt kholta hai |

> **No bills recorded on this account yet.** — agar khaate par abhi koi bill na chadha ho.

### 4.19.4 "Receive Payment" ka box

| # | Element | Type | Kya karta hai | Validation / Notes |
|---|---|---|---|---|
| 1 | **Outstanding** | Info | Kitna baqaya hai | Bara sunehri number |
| 2 | **Amount received (Rs.)** | Number input | Kitna paisa mila | **Poori baqaya raqam pehle se bhari hoti hai.** Kam likhein to partial payment. Baqaya se **zyada nahi** ho sakti |
| 3 | **Payment method** | Dropdown | **Cash · Card · Bank Transfer · Cheque · Online** | Default: Cash |
| 4 | **Notes (optional)** | Textarea | Cheque number, reference waghera | Ikhtiyari |
| 5 | Natija ki patti | Info | Sabz: *"This clears the balance and marks the account settled."* · Neeli: *"Partial payment — the balance will reduce."* | Likhte hi badalta hai |
| 6 | **✓ Confirm** | Button (gold) | ⚠️ Payment darj kar deta hai | — |
| 7 | **Cancel** / ✕ | Button / Icon | Box band | Escape se bhi |

**Error:** *"Enter a valid amount up to the outstanding balance."*

### 4.19.5 Settlement ka record

Page ke neeche **aakhri 8 payments** ki list — har ek par: khaate ka naam, tareeqa, notes, raqam, kis ne li aur kab.

### Ye kaam kaise karein

**A. Udhaar wasool karna**

1. Us customer ka khata dhoondein.
2. **Mark Paid** dabayein.
3. Poora paisa mila to raqam waise hi rehne dein; kam mila to raqam badal dein.
4. **Payment method** chunein.
5. **✓ Confirm** dabayein.

**B. Dekhna ke udhaar kis bill se bana**

1. Us khaate ki row par click karein.
2. **Bill breakdown** khul jayega.
3. Kisi bill ki tafseel dekhni ho to **View Bill** dabayein.

---

<!-- PAGE BREAK -->

## 4.20 Handover Approvals

**Route:** `/handovers` · Sidebar: **Finance › Handover Approvals**

### Ye page kis kaam ka hai

Cashier ka bheja hua **cash qubool ya rad** karne ki jagah. Har handover par waqt aur naam darj hota hai, aur poora record hamesha ke liye mehfooz rehta hai. Yahi kaam Dashboard ke panel se bhi hota hai — ye page us ka poora, tafseeli roop hai (**Processed** history ke saath).

**Kaun access kar sakta hai:** ✅ Admin, Manager · ❌ Cashier, Kitchen

> ⚠️ **Aap ko sirf wo handover nazar aayenge jo aap ke role ko bheje gaye hain.** Cashier ne agar Admin ko cash bheja, to Manager use accept nahi kar sakta. Jo cash le raha hai, wohi dastakhat karega.

**[Screenshot: handover-approvals]**

### 4.20.1 Tabs

| # | Tab | Kya dikhata hai |
|---|---|---|
| 1 | **Pending (‹X›)** | Jo abhi faisle ke muntazir hain |
| 2 | **Processed (‹Y›)** | Poori history — accepted aur rejected dono |

> Admin ko poori history dikhti hai; Manager ko sirf wo jo usne khud sign kiye.

### 4.20.2 Pending tab

| # | Element | Kya batata hai |
|---|---|---|
| 1 | Amber card | "‹cashier› wants to hand over **Rs. …** → ‹kis ko›" |
| 2 | Qism ka badge | **Shift-end drawer** (neela) = poora drawer band karte waqt · **Partial** (khaakistari) = beech-shift ka thora cash |
| 3 | Tareekh, waqt aur wajah | — |
| 4 | **Review** | Button — faisle ka box kholta hai (Section 4.5.5 wala) |
| 5 | **No pending handovers.** | Empty state |

### 4.20.3 Processed tab

| Column | Kya batata hai |
|---|---|
| **From** | Kis ne bheja + qism ka badge |
| **To** | Kis ko bheja |
| **Amount** | Raqam |
| **Status** | **Accepted** (sabz) ya **Rejected** (surkh) |
| **Reason** | Rad karne ki wajah (warna "—") |
| **Action by** | Kis ne faisla kiya |
| **Time** | Kab faisla hua |

| # | Element | Notes |
|---|---|---|
| 1 | **Load more · 20/38** | Aur purana record |
| 2 | **No processed handovers yet.** | Abhi koi faisla nahi hua |

> **Ye record badla nahi ja sakta** — na edit, na delete. Ye cash ki chain ka sab se ahem sabooot hai.

### Ye kaam kaise karein

**Cash qubool karna**

1. **Pending** tab kholein.
2. Handover ka card dhoondein — dekhein kis ne bheja aur kitna.
3. **Review** dabayein.
4. **Cash haath mein gin lein.**
5. Sahi ho to **✓ Accept** dabayein.
6. Ghalat ho to **✕ Reject** dabayein, wajah likhein aur **Confirm Reject** dabayein — cash cashier ke drawer mein wapas gina jayega.

### Is page par aane wale error messages

| Error | Matlab | Hal |
|---|---|---|
| Box mein surkh patti | Kisi aur ne pehle faisla kar liya, ya wo shift band ho gayi | Box band karein aur list dobara dekhein |
| Handover list mein nazar nahi aa raha | Wo aap ke role ko nahi bheja gaya | Cashier se kahein ke sahi shaks ka naam chun kar dobara bheje |

---

<!-- PAGE BREAK -->

## 4.21 Reports

**Route:** `/reports` · Sidebar: **Reports › Reports**

### Ye page kis kaam ka hai

Sale aur nafa-nuqsan ki **print hone wali report**. Do arse mil sakte hain: ek **session** (ek closing se agli closing tak — yani asal "karobari din") ya ek poora **maheena**. Report print bhi hoti hai aur **WhatsApp par bheji** bhi ja sakti hai.

**Kaun access kar sakta hai:** ✅ Admin, Manager · ❌ Cashier, Kitchen

**[Screenshot: reports]**

> ℹ️ **"Session" kya hai:** restaurant ka din calendar ke din se nahi milta (2 baje khulta hai, agle din 3 baje band hota hai). Isliye report **ek closing se agli closing tak** ke arse par banti hai, kisi ek tareekh par nahi. Report ke ooper hamesha **"Recording period"** likha hota hai taake arsa saaf rahe.

### 4.21.1 Ooper ke controls

| # | Element | Type | Kya karta hai | Notes |
|---|---|---|---|---|
| 1 | **Session** / **Monthly** | Toggle | Arse ki qism | KOT aur History tab par ye nazar nahi aata |
| 2 | Session ka dropdown | Dropdown | Kaunsa session | Naya sab se ooper. Chalu session par likha hota hai **"Current — …"** |
| 3 | Maheene ka dropdown | Dropdown | Kaunsa maheena | **Monthly** mode mein. Pichhle 6 maheene |

### 4.21.2 Paanch view tabs

| # | Tab | Kya dikhata hai |
|---|---|---|
| 1 | **Session Report** | Chhota khulasa — orders, sale, Cash/Card/Online, kharche, maintenance, net profit |
| 2 | **Summary** | Poora khulasa — ooper wala + Top Selling Items + Discounts Given + Estimated Stock Used |
| 3 | **Item-Wise** | Har item ki alag line: kitna bika aur kitne ka |
| 4 | **KOT Report** | Order-by-order list (sirf mojooda session ka) |
| 5 | **History** | Har purani session ki list |

### 4.21.3 Report ki sheet (safed kaghaz)

Ye wohi shakl hai jo print par aayegi.

| Hissa | Kya hota hai |
|---|---|
| Header | **Cafe Ali** · Hawksbay Road, Karachi · 021-111-ALI |
| Unwan | "Session Report" ya "Monthly Report", aur arse ka label |
| **Recording period** | Session mode mein — poora arsa (kab se kab tak) |
| **Generated** | Report kab banayi gayi |
| **Total Orders** | Kitne order huay |
| **Total Sale (collected)** | ⚠️ Sirf **paid** orders. Unpaid/chalti hui bill shamil nahi. Isliye Cash + Card + Online hamesha isi ke barabar hota hai |
| **— Cash / — Card / — Online** | Tareeqe ke hisab se batwara (sirf Session mode) |
| Online ke neeche account-wise | Har account mein kitna aaya — bank statement se milane ke liye |
| **Expenses** | Kharche |
| **Cafe Ali Maintenance** | Maintenance alag |
| **Net Profit** | Sabz (nafa) ya surkh (nuqsan) |
| Footer | "Cafe Ali POS — figures in Pakistani Rupees (Rs.)" |

**Summary tab mein mazeed:**

| Hissa | Kya hota hai |
|---|---|
| **Top Selling Items** | Sab se zyada bikne wale 5 items |
| **Discounts Given** | Kitne order par discount hua, kul kitna, aur wajah ke hisab se batwara |
| **Estimated Stock Used** | Approved recipes ke hisab se kitna raw material laga. ⚠️ Jis item ki recipe nahi, wo shamil nahi hota |

### 4.21.4 Print aur WhatsApp ke buttons

| # | Element | Type | Kya karta hai | Notes |
|---|---|---|---|---|
| 1 | **Print / Save PDF** | Button (gold) | Report print karta hai | Printer ki jagah "Save as PDF" chun kar PDF bhi bana sakte hain |
| 2 | **Share on WhatsApp** | Button | Poori report text ki soorat mein WhatsApp par kholta hai | ⚠️ Message **hamesha Urdu mein** jata hai, chahe screen English par ho. Numbers Latin (1,2,3) rehte hain |

> **WhatsApp message mein kya jata hai:** unwan aur arsa, Total Orders, sale, Cash/Card/Online (aur har online account), Expenses, Maintenance, Net Profit, discounts, Top Selling, poori item-wise list, aur Estimated Stock Used.

### 4.21.5 KOT Report tab

| # | Element | Kya batata hai |
|---|---|---|
| 1 | **Total Orders** | Session ke kul orders |
| 2 | **Total Amount** | Kul raqam |
| 3 | **Cash** | Cash se kitna |
| 4 | **Card / Online** | Card aur online mila kar |
| 5 | Table | **Table / Type · Items · Qty · Amount · Payment · Time**, aur aakhir mein **Grand Total** |
| 6 | **Print** | Button — ye report print karta hai |

### 4.21.6 History tab

| Column | Kya batata hai |
|---|---|
| **Period** | Session kab se kab tak chala |
| **Duration** | Kitni der chala |
| **Total Orders** | Kitne orders |
| **Net Sale** | Kul sale |
| **Closed by** | Kis ne din band kiya |
| **View** | Us session ki poori report kholta hai |
| **Print sheet** | Us din ki closing sheet print karta hai |

> **No closed sessions yet. Save a day closing and it will appear here.** — jab tak koi din band na kiya gaya ho.

### Ye kaam kaise karein

**A. Din ki report malik ko WhatsApp par bhejna**

1. **Session** mode mein sahi session chunein.
2. **Summary** tab dabayein.
3. **Share on WhatsApp** dabayein.
4. WhatsApp khulega — number chunein aur bhej dein.

**B. Maheene ki report print karna**

1. **Monthly** dabayein aur maheena chunein.
2. **Summary** tab dabayein.
3. **Print / Save PDF** dabayein.

**C. Dekhna ke kaunsi dish sab se zyada bikti hai**

1. **Item-Wise** tab dabayein.
2. List **kamai ke hisab se** tarteeb mein hoti hai — sab se ooper wali dish sab se zyada kamane wali hai.

---

<!-- PAGE BREAK -->

## 4.22 Day Closing

**Route:** `/closing` · Sidebar: **Reports › Day Closing**

### Ye page kis kaam ka hai

Din band karne ki jagah. Ye wohi **closing sheet** banata hai jo client ki apni likhi hui sheet jaisi hai — gross sale, discount, net sale, account-wise sale, cash sale, kharche, aur aakhir mein **kitna cash hawale karna hai**. Save karte hi din band ho jata hai aur agle session ke liye sab number **sifar** se shuru hote hain.

**Kaun access kar sakta hai:** ✅ Admin, Manager · ❌ Cashier, Kitchen

**[Screenshot: day-closing]**

### 4.22.1 Din band karne ki 3 shartein

Jab tak ye teeno poori na hon, **Save Closing** ka button band rehta hai:

| # | Shart | Ruk jane par kya dikhta hai | Hal |
|---|---|---|---|
| 1 | **Koi cash drawer khula na ho** | Amber patti: *"A cash drawer is still open — end the shift…"* | Cashier se kahein ke apni shift band kare (header se) |
| 2 | **Koi bill unpaid na ho** | Amber patti + un bills ki list: *"‹X› bills are still unpaid — closing is blocked…"* | Har bill ko ya **Paid**, ya **Udhaar**, ya **Complimentary** karein |
| 3 | **Kuch naya band karne ko ho** | Khaakistari patti: *"The day is already closed — no new sales since the last closing."* | Naya order lein — naya session khud shuru ho jayega |

> ⚠️ **Unpaid bill ki rok kyun lagi hai:** har bill ka anjaam tay hona zaroori hai — warna us ka paisa kisi hisab mein nahi aata. Isi liye din band karne se pehle har bill ko **Paid**, **Udhaar** ya **Complimentary** karna parta hai.

### 4.22.2 Page ke buttons

| # | Element | Type | Kya karta hai | Notes |
|---|---|---|---|---|
| 1 | **Print** | Button | Mojooda (abhi tak ka) closing sheet print karta hai | Bina save kiye bhi print ho sakti hai |
| 2 | **Save Closing** | Button (gold) | ⚠️ Tasdeeq ka box kholta hai | Teeno shartein poori na hon to **band** rehta hai — mouse le jane se wajah dikhti hai |

### 4.22.3 Closing sheet (safed sheet)

Bilkul wohi jo print hogi:

| Line | Kya batata hai |
|---|---|
| **CAFÉ ALI** | Sheet ka header |
| Din aur tareekh | Misal: Monday · 28/Jul/26 |
| **RECORDING PERIOD** | Poora arsa — kab se kab tak (ek session aksar do din par phaila hota hai) |
| **GROSS SALE ( ٹوٹل سیل )** | Discount se pehle ki kul sale |
| **LESS : DISCOUNT ( ڈسکاؤنٹ )** | Kul discount |
| **NET SALE ( سیل )** | Discount ke baad ki sale |
| Account ki lines | Har online account mein kitna aaya (koi na ho to "ACCOUNT SALES —") |
| **NET CASH SALES ( نیٹ کیش سیل )** | Sirf cash wali sale |
| **LESS : EXPENSES ( اخراجات )** | Kul kharche, aur neeche har category ka alag |
| **REMAINING CASH HAND OVER TO ZAMAN A/C** | ⚠️ **Aakhri raqam — itna cash hawale karna hai** |
| Neeche | "Closed by: ‹naam› (‹role›) · ‹waqt›" |

> Sifar ki jagah sheet par **"-"** likha aata hai, aur raqam bina currency ke nishan ke — bilkul client ki apni sheet ki tarah.

### 4.22.4 Tasdeeq ka box — "Save today's closing?"

| # | Element | Type | Kya karta hai | Notes |
|---|---|---|---|---|
| 1 | Paighaam | Text | *"This closes the business day: today's report (Rs. … net sale) is saved to Closing History and the live totals reset to zero for the next session. Nothing is deleted — all orders stay in reports and history — but this saved record can't be edited afterward."* | — |
| 2 | **✓ Yes, Save Closing** | Button (gold) | ⚠️ **Din band kar deta hai** | Dabate hi "Saving…" ho jata hai. Do baar dabane se do closing **nahi** banti |
| 3 | **Cancel** / ✕ | Button / Icon | Kuch nahi hota | Escape se bhi |

> ⚠️ **Save ke baad ye record badla nahi ja sakta.** Lekin ghabrane ki baat nahi — **kuch delete nahi hota**. Saare orders reports aur history mein waise hi rehte hain. Sirf "live" totals sifar ho jate hain.
>
> ⚠️ **Din hamesha ek hi device se band karein** — ek hi waqt mein do device se save karne ki koshish na karein.

### 4.22.5 Closing History

| # | Element | Kya batata hai |
|---|---|---|
| 1 | Har entry | Tareekh, **recording period** (sunehri), "Closed by ‹naam› (‹role›) · ‹waqt› · handover Rs. …" |
| 2 | Daayein | Us din ki **Net Sale** aur **Print** ka button |
| 3 | **Load more** | Aur purani closings |
| 4 | **No closings saved yet.** | Abhi koi din band nahi hua |

### Ye kaam kaise karein

**Din band karne ka mukammal tareeqa**

1. Pehle **cashier se shift band karwayein** — usay header se "Shift khatam — cash ginein" karna hoga.
2. Cashier ka **cash handover accept** karein (Section 4.20).
3. **Day Closing** page kholein.
4. Agar koi **unpaid bill** ki list dikhe, to Orders page par ja kar har bill ko Paid / Udhaar / Complimentary karein.
5. Sheet ko ooper se neeche parh lein — khaas kar **NET SALE** aur **REMAINING CASH HAND OVER**.
6. **Print** dabayein aur sheet nikaal lein.
7. **Save Closing** dabayein → **Yes, Save Closing**.
8. Gina hua cash sheet ki aakhri raqam se milayein.

### Is page par aane wale error messages

| Error / Patti | Matlab | Hal |
|---|---|---|
| *"A cash drawer is still open…"* | Kisi cashier ki shift chal rahi hai | Cashier se shift band karwayein |
| *"‹X› bills are still unpaid — closing is blocked…"* | Kuch bill ka faisla baaqi hai | Har bill ko Paid/Udhaar/Complimentary karein |
| *"The day is already closed — no new sales since the last closing."* | Pehle hi band ho chuka hai | Kuch karne ki zaroorat nahi |
| Surkh patti (server ka message) | Server ne save qubool nahi kiya | Message parhein; masla rahe to Section 6 dekhein |

---

<!-- PAGE BREAK -->

## 4.23 Settings

**Route:** `/settings` · Sidebar: **Settings**

### Ye page kis kaam ka hai

Poore system ki **configuration** — GST, WhatsApp ki khud-kaar report, attendance machine ka connection, online payment accounts, server ki sehat, aur passwords.

**Kaun access kar sakta hai:** ✅ **Sirf Admin.** Manager, Cashier aur Kitchen ko ye page sidebar mein nazar hi nahi aata.

**[Screenshot: settings]**

### 4.23.1 Baayein taraf ka menu

| # | Section | Kya hai |
|---|---|---|
| 1 | **Tax & GST** | GST chalu/band aur uska rate |
| 2 | **WhatsApp Daily Report** | Rozana report khud-ba-khud bhejna |
| 3 | **Attendance Machine** | Fingerprint/face machine ka connection |
| 4 | **Online Payment Accounts** | JazzCash, Easypaisa, bank waghera |
| 5 | **Server Health** | Server chal raha hai ya nahi, backup, sync |
| 6 | **Login Passwords** | Password badalna aur naya login banana |

> Chhoti screen par ye menu ooper ek qatar (row) ki soorat mein aa jata hai.

### 4.23.2 Tax & GST

| # | Element | Type | Kya karta hai | Validation / Notes |
|---|---|---|---|---|
| 1 | GST ka toggle | Toggle | GST chalu/band | ⚠️ **Foran asar** — Save dabane ki zaroorat nahi |
| 2 | **GST Rate (%)** | Number input | GST ki sharah | **0 se 100** tak. 0.5 ke qadam mein |
| 3 | **Save** | Button (gold) | Rate mehfooz karta hai | Kaamyabi par: *"Rate updated."* |
| 4 | Halat ki patti | Info | GST chalu hai ya band | — |

> ⚠️ **Rate badalne ka asar sirf naye bill par hota hai.** Purane order apna us waqt ka rate mehfooz rakhte hain — puranay bill kabhi nahi badalte.

### 4.23.3 WhatsApp Daily Report

| # | Element | Type | Kya karta hai | Validation / Notes |
|---|---|---|---|---|
| 1 | **Automated daily send** toggle | Toggle | Khud-kaar bhejna chalu/band | ⚠️ Foran asar |
| 2 | **Send hour (24h)** | Number input | Kis waqt bheja jaye | **0 se 23** tak (misal 22 = raat 10 baje) |
| 3 | **Admin WhatsApp number** | Text input | Kis number par bheja jaye | ⚠️ **Sirf digits, country code pehle, `+` nahi.** Misal: `923001234567` |
| 4 | **Save** | Button (gold) | Waqt aur number mehfooz karta hai | Kaamyabi par: *"Saved."* |
| 5 | Halat ki patti | Info | *"Automated send is ON — sends daily at 22:00."* ya OFF | — |

> ⚠️ **Jab tak koi din band (closing) na ho, kuch nahi bheja jata.** Report hamesha **aakhri band shuda din** ki hoti hai.
> ℹ️ Admin WhatsApp par message kar ke **kabhi bhi** taza report maang bhi sakta hai.

### 4.23.4 Attendance Machine

| # | Element | Type | Kya karta hai | Validation / Notes |
|---|---|---|---|---|
| 1 | **Scan for device** | Button | Server ke network par machine dhoondta hai | Ek mile to IP khud bhar jata hai; ek se zyada milein to aap chunein |
| 2 | Scan ka natija | Text / buttons | *"Found a device at ‹IP› — filled in below."* · *"Found more than one — pick the right one:"* · *"No device found on this network…"* | — |
| 3 | **Machine IP address** | Text input | Machine ka IP | Misal: `192.168.1.201` |
| 4 | **Port** | Number input | Port number | Default: **4370**. 1–65535 |
| 5 | **Save** | Button (gold) | Connection mehfooz karta hai | ⚠️ **Koi config file ya restart nahi chahiye** — bas Save |
| 6 | Halat ki patti | Info | *"Connected — punches sync automatically in the background."* ya *"Not set up yet…"* | — |
| 7 | Hidayat | Note | *"Find the IP on the machine itself: Menu → Comm. → Ethernet."* | ⚠️ Machine par **fixed (non-DHCP) IP** set karein, warna bijli jane ke baad IP badal sakta hai |

### 4.23.5 Online Payment Accounts

| # | Element | Type | Kya karta hai | Notes |
|---|---|---|---|---|
| 1 | **+ Add Account** | Button (gold) | Naya account form | 4.23.6 |
| 2 | Account ki patti | List row | Naam, **Active/Inactive** badge, aur qism/bank/number |
| 3 | **Deactivate** / **Activate** | Button | Account chalu/band karta hai | ⚠️ Sirf **Active** accounts POS ke payment box mein dikhte hain |
| 4 | **Edit** | Button | Account badalne ka form | — |
| 5 | **No online accounts yet…** | Empty state | ⚠️ Koi account na ho to cashier **Online payment darj nahi kar sakta** | — |

### 4.23.6 Account ka form (Add / Edit)

| # | Element | Type | Kya karta hai | Validation / Notes |
|---|---|---|---|---|
| 1 | **Account Name \*** | Text input | Account ka naam | **Zaroori.** Misal: "Zaman Khan" |
| 2 | **Account Type** | Dropdown | **JazzCash · Easypaisa · SadaPay · NayaPay · Bank Account · Other** | Qism badalne par neeche ke khane badal jate hain |
| 3 | **Bank Name \*** | Dropdown | Bank ka naam | Sirf **Bank Account** par. "Other" chunein to naam khud likh sakte hain |
| 4 | **Mobile Number** | Text input | Wallet ka number | JazzCash/Easypaisa waghera par. **11 digits** (misal 03001234567) |
| 5 | **Account Number / IBAN** | Text input | Bank ka number | **10, 14 ya 16 digits**, ya **24 characters ka IBAN** (PK se shuru) |
| 6 | **IBAN** (optional) | Text input | SadaPay/NayaPay ka IBAN | 24 characters, PK se shuru |
| 7 | **✓ Save** | Button (gold) | Account mehfooz karta hai | — |
| 8 | **Cancel** / ✕ | Button / Icon | Box band | Escape se bhi |

**Errors:** *"Account name is required."* · *"Bank name is required for a bank account."* · *"Account number is required."* · *"IBAN must be 24 characters starting with PK."*

> ⚠️ **Number sahi likhna zaroori hai** — cashier yahi number customer ko parh kar sunata hai.

### 4.23.7 Server Health

| # | Element | Type | Kya batata hai / karta hai | Notes |
|---|---|---|---|---|
| 1 | **Status** | Info | **Online** (sabz dot) | Har minute khud check hota hai |
| 2 | **Up for** | Info | Server kitni der se chal raha hai | — |
| 3 | **Last backup** | Info | Aakhri backup kab hua | — |
| 4 | **Backup Now** | Button | Foran backup banata hai | Rozana khud bhi hota hai. Kaamyabi par: *"Saved at ‹waqt›."* |
| 5 | **Last VPS sync** | Info | Cloud par aakhri baar kab bheja gaya, aur kitna baaqi hai | Sirf tab jab VPS set ho |
| 6 | **Sync Now** | Button | Foran cloud par bhejta hai | Natija: *"‹X› sent, ‹Y› failed."* |
| 7 | **Last attendance sync** | Info | Machine se aakhri baar kab hazri aayi | Sirf tab jab machine set ho |
| 8 | **Sync Attendance Now** | Button | Foran hazri mangwata hai | Natija: *"‹X› record(s) updated."* |
| 9 | 🔄 (refresh) | Icon button | Sab kuch dobara check karta hai | — |
| 10 | **Cannot reach the local server.** | Error | Server band hai ya network toota hai | Section 6 dekhein |

### 4.23.8 Login Passwords

| # | Element | Type | Kya karta hai | Validation / Notes |
|---|---|---|---|---|
| 1 | **Whose password** | Dropdown | Kis ka password badalna hai | Pehla option: **My password**. Neeche har active employee, uske role aur username ke saath (ya *"no login yet"*) |
| 2 | Sunehri patti | Note | *"‹naam› has no login yet — set a username and role to create one."* | Jab us employee ka koi login na ho |
| 3 | **Username \*** | Text input | Naya username | Sirf naya login banate waqt. Chhote haroof mein mehfooz hota hai |
| 4 | **System role \*** | Dropdown | App ka role | **Admin · Manager · Cashier · Kitchen**. Default: **Cashier** |
| 5 | **Current Password \*** | Password input | Aap ka mojooda password | ⚠️ Sirf tab jab aap **apna** password badal rahe hon — taake khuli screen par koi aur aap ka password na badal de |
| 6 | **New Password \*** | Password input | Naya password | Kam se kam **6 characters** |
| 7 | **Confirm New Password \*** | Password input | Wohi password dobara | Milna zaroori |
| 8 | Amber patti | Warning | *"This user will be signed out of every device and must log in with the new password."* | ⚠️ Doosre ka password badalte waqt |
| 9 | **Change Password** / **Create Login** | Button (gold) | Password mehfooz karta hai ya naya login banata hai | Label khud badalta hai |

**Errors:**

| Error | Matlab |
|---|---|
| **Password must be at least 6 characters.** | Password chhota hai |
| **The two passwords do not match.** | Dono password alag hain |
| **Choose a username for this employee.** | Naya login banate waqt username nahi likha |
| **Current password is incorrect.** | Apna purana password ghalat likha |
| **That username is already taken.** | Ye username kisi aur ka hai |

> ⚠️ **Apna password badalne ka natija:** aap ke **doosre devices** se session khatam ho jate hain, lekin ye wala chalta rehta hai.
> ⚠️ **Kisi aur ka password badalne ka natija:** us ke **saare devices** se session khatam. Ye jaan-boojh kar hai — khoya hua ya ghair-mahfooz session band karne ka yahi tareeqa hai.

### Ye kaam kaise karein

**A. GST chalu karna**

1. **Tax & GST** kholein.
2. Toggle **On** karein.
3. **GST Rate (%)** mein sharah likhein aur **Save** dabayein.
4. Ab har naye bill par GST lagega.

**B. Rozana report khud-ba-khud malik ko bhejna**

1. **WhatsApp Daily Report** kholein.
2. Toggle **On** karein.
3. **Send hour (24h)** likhein (misal 23 = raat 11 baje).
4. **Admin WhatsApp number** likhein — bina `+`, country code ke saath (misal `923001234567`).
5. **Save** dabayein.

**C. Attendance machine jorna**

1. Machine ko Ethernet cable se usi network par lagayein jis par server hai.
2. **Attendance Machine** kholein.
3. **Scan for device** dabayein.
4. Machine mil jaye to IP khud bhar jayega; warna machine par **Menu → Comm. → Ethernet** se IP dekh kar likhein.
5. **Save** dabayein.
6. **Server Health** mein ja kar **Sync Attendance Now** dabayein aur jaanchein ke record aa rahe hain.

**D. Naye employee ko login dena**

1. Pehle **Employees** page se uska record banayein.
2. **Settings › Login Passwords** kholein.
3. **Whose password** se uska naam chunein (uske aage *"no login yet"* likha hoga).
4. **Username** aur **System role** chunein.
5. **New Password** aur **Confirm** bharein (6+ characters).
6. **Create Login** dabayein.
7. Usay username aur password bata dein.

---
