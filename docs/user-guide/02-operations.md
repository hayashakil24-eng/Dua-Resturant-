<!-- PAGE BREAK -->

## 4.6 New Order (POS)

**Route:** `/pos` · Sidebar: **Operations › New Order**

### Ye page kis kaam ka hai

Ye counter ka asal kaam karne wali screen hai. Yahan aap menu se cheezein chun kar order banate hain, table aur waiter assign karte hain, aur phir ya to foran paisay le lete hain (**Pay Now**) ya order kitchen bhej kar bill baad mein lete hain (**Place as Unpaid**). Order bhejte hi **har counter ki apni KOT parchi khud print ho jati hai**.

**Kaun access kar sakta hai:**

| Role | Access |
|---|---|
| **Cashier** | ✅ Poora — ye unka mukhya page hai |
| **Admin** | ✅ Poora |
| **Manager** | ✅ Order punch kar sakta hai (lekin drawer nahi chalata) |
| **Kitchen** | ❌ Nazar nahi aata |

> Ye page hamesha **English aur baayein-se-dayein** rehta hai, chahe zabaan Urdu par ho — counter par raftaar ke liye.

**[Screenshot: pos-new-order]**

### 4.6.1 Menu ka hissa (baayein taraf)

| # | Element | Type | Kya karta hai | Click ke baad kya hota hai | Validation / Notes |
|---|---|---|---|---|---|
| 1 | **Search menu…** | Search input | Naam ya category se item dhoondta hai | Grid foran filter ho jata hai | Search chalu ho to "Most Ordered" ka hissa chhup jata hai, taake nataij bina scroll ke dikhein |
| 2 | ✕ (search ke andar) | Icon button | Search khali karta hai | Poora menu wapas | Sirf tab jab kuch likha ho. Title: "Clear search" |
| 3 | **‹** aur **›** | Icon buttons | Category ki patti ko baayein/dayein sarkate hain | Patti smooth scroll hoti hai | Sirf bari screen par. Mouse ka wheel bhi is patti par kaam karta hai |
| 4 | Category pills — **All**, aur har category | Filter buttons | Sirf us category ke items dikhata hai | Grid filter ho jata hai; page 1 par wapas | Chuni hui pill sunehri ho jati hai |
| 5 | **⭐ Most Ordered** | Section | Aap ke chune hue "best seller" items ki quick list | — | Ye list **sab ke liye ek hi hai** (shared) |
| 6 | Most Ordered ka card | Card button | Ek click par item cart mein daalta hai | Card par 0.7 second ke liye **"✓ Added"** aa jata hai | Poora card dabane wala hai — "+ Add" sirf nishani hai, alag button nahi |
| 7 | **⚙️ Manage** | Button | Most Ordered list badalne ka box kholta hai | Neeche 4.6.5 | Admin, Manager aur **Cashier** — teeno kar sakte hain. Kitchen nahi |
| 8 | Menu item ka card | Card button | Item cart mein daalta hai | Agar item ke **options** hon to pehle option chunne ka box khulta hai | Card par item ka naam, category, aur qeemat |
| 9 | Card par **from Rs. …** | Text | Batata hai ke item ki qeemat option ke hisab se badalti hai | — | Sirf options wale items par |
| 10 | Card par sunehri ginti (badge) | Badge | Is item ke kitne pieces cart mein hain | — | Ooper daayein kone mein |
| 11 | **Out of stock** (surkh chip) | Status chip | Item banane ke liye stock nahi hai — card **band** ho jata hai | Click nahi hota | Sirf un items par jin ki **approved recipe** hai |
| 12 | **Low stock** (amber chip) | Status chip | Stock kam bacha hai, lekin abhi order le sakte hain | — | — |
| 13 | **No items match your search.** | Empty state | Search se kuch nahi mila | — | — |
| 14 | **‹ Previous** / numbers / **Next ›** | Pagination | Ek safhe par **20 items** — aage/peeche jane ke liye | Grid badal jata hai | Sirf tab jab 20 se zyada items hon. Category ya search badalte hi page 1 par wapas |

> **Stock ka usool:** Sirf un items par "Out of stock" lagta hai jin ki **approved recipe** maujood hai. Jis item ki recipe nahi bani, uska stock check nahi hota — POS chalta rehta hai.

### 4.6.2 Options chunne ka box (Choose an option)

**Kab aata hai:** Jab aap koi aisa item dabayein jiske **options** hon (misal Half / Full, Small / Large).

| # | Element | Type | Kya karta hai | Notes |
|---|---|---|---|---|
| 1 | Item ka naam + "Choose an option" | Heading | — | — |
| 2 | Option ki patti (misal "Half — Rs. 550") | Button | Wohi option cart mein daal deta hai | Har option ki apni qeemat |
| 3 | ✕ (close) | Icon | Box band, kuch nahi hota | Escape se bhi band hota hai |

### 4.6.3 Order ka hissa (daayein taraf — "Current Order")

| # | Element | Type | Kya karta hai | Click ke baad kya hota hai | Validation / Notes |
|---|---|---|---|---|---|
| 1 | **Current Order** | Heading | Cart ka unwan | — | Purane bill mein cheez daal rahe hon to unwan **"New Items to Add"** ho jata hai |
| 2 | **Clear** | Text button (surkh) | ⚠️ Poora cart khali kar deta hai | Sab items hat jate hain | Bina poochhe khali karta hai — dhyan se |
| 3 | **Table** | Dropdown | Table ya order type chunte hain | — | **Zaroori.** Groups: **🚗 Special Orders** (Delivery/Takeaway) phir **📍 Category …** |
| 4 | Table dropdown mein **(In Use)** | Label | Batata hai ke us table par pehle se order chal raha hai | — | Aise table par naya alag order nahi ban sakta |
| 5 | **🔒 Locked** | Label | Table lock ho gaya hai | Dropdown band ho jata hai | ⚠️ **Kab lock hota hai:** jab table chun lein **aur** cart mein kam se kam ek item ho. Kholne ke liye ya sab items hatayein ya checkout karein |
| 6 | Sunehri patti — "🔒 Locked to ‹table› · ‹waqt›" | Note | Kis table par aur kab se locked hai | — | — |
| 7 | Amber warning — "⚠️ ‹table› is already in use…" | Warning | Chuna hua table pehle se busy hai | Dono checkout buttons band ho jate hain | Hal: Tables page se us ke order mein items daalein, ya khali table chunein |
| 8 | **Waiter** | Dropdown | Waiter assign karte hain | — | **Zaroori** — magar Delivery/Takeaway par **nahi** (wahan field band ho jata hai aur likha aata hai "Not needed") |
| 9 | Cart ki list | List | Har item: emoji, naam, per-piece qeemat, ginti aur line total | — | Khali ho to: "Cart is empty · Tap menu items to add them." |
| 10 | **−** (minus) | Icon button | Item ki ginti 1 kam karta hai | 0 par item cart se nikal jata hai | — |
| 11 | **+** (plus) | Icon button | Item ki ginti 1 barhata hai | — | — |
| 12 | 🗑 (trash) | Icon button | Poori line hata deta hai | Item cart se gayab | Title: "Remove item" |
| 13 | **Subtotal / GST (X%) / Total** | Figures | Bill ka hisab | — | GST sirf tab dikhta hai jab Settings mein chalu ho |
| 14 | **Pay Now · Rs. …** | Button (gold) | Payment ka box kholta hai | 4.6.4 | Pehle poori jaanch hoti hai (item, table, waiter, stock) |
| 15 | **Place as Unpaid** + `F12` | Button | Order kitchen bhejta hai, paisa baad mein | KOT print + neeche sabz toast | Keyboard par **F12** dabane se bhi wohi kaam hota hai |
| 16 | **Add to Order · Rs. …** | Button (gold) | Chalti hui bill mein naye items jorta hai | KOT print, phir Tables page par wapas | Sirf tab jab aap kisi purane order mein items daal rahe hon |
| 17 | Neeche ki chalti patti (mobile) | Floating button | "‹X› in order · Rs. … · View ↓" | Order wale hisse tak scroll kar deta hai | Sirf chhoti screen par |

### 4.6.4 Payment ka box — "Take Payment"

| # | Element | Type | Kya karta hai | Click ke baad kya hota hai | Validation / Notes |
|---|---|---|---|---|---|
| 1 | **Amount due** | Info | Kitna paisa lena hai | — | Bara sunehri number |
| 2 | **Cash / Card / Online** | 3 buttons | Payment ka tareeqa | Neeche ka hissa badal jata hai | Default: **Cash** |
| 3 | **Cash received** | Number input | Customer ne kitna diya | Neeche **Change due** khud calculate hota hai | Sirf Cash mode mein. Bill se kam ho to Confirm band rehta hai |
| 4 | Quick cash buttons (misal Rs. 500, 1000) | Buttons | Aam notes ki raqam ek click par bhar dete hain | Cash received bhar jata hai | Bill ki raqam se ooper ke 4 suggestions |
| 5 | **Change due** / **Remaining** | Info | Wapas kitna dena hai (sabz), ya abhi kitna kam hai (surkh) | — | — |
| 6 | **Received in account** | Dropdown | Online paisa kis account mein aaya | Neeche bank ka naam aur IBAN dikhta hai | Sirf Online mode mein. **Zaroori** |
| 7 | Surkh note — "No active online accounts…" | Warning | Koi online account set nahi hai | — | Hal: Admin → Settings → Online Payment Accounts |
| 8 | **✓ Confirm Rs. …** | Button (gold) | ⚠️ Order **Paid** bana deta hai | KOT print hoti hai, phir receipt ka box khulta hai | Band rehta hai jab tak: Cash poora na ho, ya Online account na chuna ho |
| 9 | **Cancel** / ✕ | Button / Icon | Box band, order nahi banta | — | Escape se bhi |

### 4.6.5 "⭐ Manage Most Ordered" ka box

| # | Element | Type | Kya karta hai | Notes |
|---|---|---|---|---|
| 1 | **Search items…** | Search input | Item dhoondta hai | Naam aur category dono se |
| 2 | Item ki patti + checkbox | Checkbox row | Tick karne se item Most Ordered mein aa jata hai | ⚠️ Tabdeeli **foran aur sab ke liye** hoti hai — Save dabane ki zaroorat nahi |
| 3 | **✓ Added** | Label | Batata hai ke ye item list mein hai | — |
| 4 | **Done · ‹X› selected** | Button (gold) | Box band | Sirf band karta hai — tabdeeliyan pehle hi mehfooz ho chuki hain |
| 5 | ✕ (close) | Icon | Box band | Escape se bhi |

### 4.6.6 Order lagne ke baad

| Cheez | Kab | Kya hai |
|---|---|---|
| **KOT parchi** | Har baar jab order kitchen jaye | Har counter (department) ki **apni alag parchi** print hoti hai — ooper CAFÉ ALI, counter ka naam, ORDER/TABLE/WAITER, items ki list, tareekh-waqt, aur "Slip 1 / 2" |
| **Receipt ka box** | Sirf "Pay Now" ke baad | Print karne ke liye — tafseel 4.9.2 |
| **Sabz toast** | Sirf "Place as Unpaid" ke baad | "Order ORD-1046 placed" — table, waiter aur halat. 4 second baad khud gayab. **Dismiss** se foran band |

### Ye kaam kaise karein

**A. Naya order lena (paisa foran)**

1. Menu se items dabayein (ya Search se dhoondein). Options wale item par option chunein.
2. Daayein taraf **Table** chunein.
3. **Waiter** chunein (Delivery/Takeaway par zaroorat nahi).
4. Cart check kar lein — ginti + / − se theek karein.
5. **Pay Now · Rs. …** dabayein.
6. Tareeqa chunein: Cash / Card / Online.
   - Cash: customer ne jitna diya wo likhein → **Change due** dekh kar wapsi dein.
   - Online: account chunein aur number customer ko batayein.
7. **✓ Confirm Rs. …** dabayein.
8. KOT parchi khud print hogi. Receipt ke box mein **Print** dabayein.

**B. Order kitchen bhejna, paisa baad mein**

1. Ooper ke steps 1–4 karein.
2. **Place as Unpaid** dabayein (ya keyboard par **F12**).
3. KOT print ho jayegi aur sabz toast aayega.
4. Baad mein bill **Billing** ya **Orders** page se settle karein.

**C. Chalti hui table par aur cheezein daalna**

1. **Tables** page kholein.
2. Us table ka (surkh) card dabayein.
3. **Add More Items** dabayein — aap POS par pohanch jayenge, ooper sunehri patti mein purane items dikhenge.
4. Naye items daalein.
5. **Add to Order · Rs. …** dabayein.
6. Sirf **naye** items ki KOT print hogi, aur aap Tables par wapas aa jayenge. **Doosra bill nahi banta.**

### Is page par aane wale error messages

| Error | Matlab | Hal |
|---|---|---|
| **Add at least one item to the order.** | Cart khali hai | Menu se kuch chunein |
| **Please select a table number.** | Table nahi chuna | Table dropdown se chunein |
| **Please assign a waiter.** | Waiter nahi chuna | Waiter dropdown se chunein |
| **Table ‹X› already has a running order (ORD-…) — add items to it from the Tables page, or settle it first.** | Us table par pehle se bill chal raha hai | Tables page se us order mein items daalein, ya pehle bill settle karein |
| **Out of stock: ‹item› — need 2.5kg, have 1.2kg.** | Recipe ke hisab se stock kam hai | Inventory mein stock daalein, ya kam ginti ka order lein |
| **Add at least one new item to append.** | Purane order mein daalne ke liye kuch nahi chuna | Kam se kam ek naya item chunein |

---

<!-- PAGE BREAK -->

## 4.7 Orders

**Route:** `/orders` · Sidebar: **Operations › Orders**

### Ye page kis kaam ka hai

Aaj ke **saare orders** ki mukammal list — paid, unpaid, udhaar, complimentary aur cancelled. Kisi bhi order par click kar ke uski poori tafseel khulti hai, aur wahin se aap bill settle kar sakte hain, udhaar par daal sakte hain, muft (complimentary) kar sakte hain, bill print kar sakte hain, table badal sakte hain, ya (sirf Admin) order cancel kar sakte hain.

**Kaun access kar sakta hai:**

| Role | Access | Kya kar sakte hain |
|---|---|---|
| **Admin** | ✅ Edit | Sab dekh sakta hai; **cancel** sirf Admin karta hai. ⚠️ Admin **Mark as Paid nahi kar sakta** — bill settle karna Cashier/Manager ka kaam hai |
| **Manager** | 👁 View | List dekh sakta hai, bill print kar sakta hai, Udhaar aur Complimentary kar sakta hai. Cancel nahi kar sakta |
| **Cashier** | ✅ Edit | Mark as Paid, Print Bill, Shift Table. Udhaar/Complimentary/Cancel nahi |
| **Kitchen** | ❌ Nazar nahi aata | — |

**[Screenshot: orders]**

### 4.7.1 Ooper ke controls

| # | Element | Type | Kya karta hai | Notes |
|---|---|---|---|---|
| 1 | **Search order / waiter / table** | Search input | Order number, waiter ke naam ya table se dhoondta hai | Har naye search par list dobara shuru se |
| 2 | Filter pills — **All · Paid · Unpaid · Udhaar · Complimentary · Cancelled** | Filter buttons | Sirf us halat ke orders dikhata hai | Har pill par us ki ginti likhi hoti hai, misal "Unpaid (7)" |
| 3 | Surkh patti — "Total material loss · ‹X› cancelled order(s)" | Summary | Cancelled orders mein kitne ingredients zaya huay | Sirf **Cancelled** filter par |

### 4.7.2 Orders ki table (bari screen)

| Column | Kya batata hai |
|---|---|
| **Order ID** | Order ka number (misal ORD-1046) — sunehri rang |
| **Table** | Table ka naam/number |
| **Waiter** | Kis waiter ka order hai |
| **Items** | Sab items ek line mein (misal "2× Karahi, 1× Naan") |
| **Total** | Kul bill (discount aur GST ke baad) |
| **Loss** | Sirf Cancelled filter par — kitne ka material zaya hua |
| **Status** | Paid / Unpaid / Udhaar / Complimentary / Cancelled ka badge. Udhaar par 📋 customer ka naam, Complimentary par 🎁 ijazat dene wale ka naam |
| **Time** | Order ka waqt |

> **Kisi bhi row par click** karne se daayein taraf se **order ki tafseel** slide ho kar aati hai.
> Cancelled orders halke (faded) aur items par line kata hua dikhta hai.
> Chhoti screen par table ki jagah cards aate hain — maloomat wohi hoti hai.

| # | Element | Type | Kya karta hai |
|---|---|---|---|
| 1 | **Load more · 20/47** | Button | Agle 20 orders dikhata hai | Ek waqt mein 20 |

### 4.7.3 Order ki tafseel (daayein se aane wala panel)

| # | Element | Type | Kya batata hai / karta hai |
|---|---|---|---|
| 1 | Order ID, table, waiter, waqt | Heading | — |
| 2 | Status badge | Badge | Paid / Unpaid / Udhaar / Complimentary / Cancelled |
| 3 | Items ki list | List | Har item ka naam, ginti aur raqam |
| 4 | **Subtotal / GST / Discount / Material loss / Total** | Figures | Poora hisab. Discount sabz mein, Material loss surkh mein |
| 5 | ✕ (close) | Icon | Panel band (Escape se bhi) |

**Panel ke neeche ke action buttons** (sirf **Unpaid** aur non-cancelled orders par):

| # | Button | Kaun dekhta hai | Kya karta hai |
|---|---|---|---|
| 1 | **✓ Mark as Paid** (gold) | Cashier, Manager — **Admin nahi** | Payment ka box kholta hai (wohi jo POS mein hai) |
| 2 | **Udhaar** | Admin, Manager | Bill customer ke khaate mein daalta hai — 4.7.5 |
| 3 | **🎁 Complimentary** | Admin, Manager | Order muft kar deta hai — 4.7.6 |
| 4 | **Print Bill** | Har wo role jo orders dekh sakta hai | Bill print karta hai **bina settle kiye** — panel khula rehta hai |
| 5 | **Shift Table** | Admin, Manager, Cashier | Order ko doosri table par le jata hai — 4.7.7 |
| 6 | **✕ Cancel Order** | **Sirf Admin** | ⚠️ Cancel ka box kholta hai — 4.7.4 |

> **Note:** Mark as Paid, Udhaar, Complimentary aur Shift Table dabate hi panel **band ho jata hai** — kyunke order badal jayega aur panel ki purani maloomat ghalat ho jati. **Print Bill** panel band nahi karta, kyunke wo order ko badalta nahi.

### 4.7.4 "Cancel Order" ka box — **sirf Admin**

| # | Element | Type | Kya karta hai | Validation / Notes |
|---|---|---|---|---|
| 1 | Order ka khulasa | Info | Order ID, table, items aur total | — |
| 2 | **Material loss (ingredients wasted)** | Info (surkh) | Pakane par kitne ke ingredients zaya huay | Sirf tab jab order **cooked** mana jaye |
| 3 | **Mark as Cooked** | Button (sabz) | Batata hai ke khana ban chuka tha — ab material loss lagega | Default: agar KDS par order "Ready" ho to **cooked** khud se lagta hai |
| 4 | **Undo — not cooked (no loss)** | Text link | Wapas "nahi paka" par le jata hai — koi loss nahi | ⚠️ Ye link **nahi** dikhta agar KDS par order waqai "Ready" ho |
| 5 | **Reason for cancellation \*** | Dropdown | Cancel ki wajah | **Zaroori.** Options: Customer Request, Wrong Order, Out of Stock, Other |
| 6 | **Notes (optional)** | Textarea | Tafseel | Ikhtiyari |
| 7 | **Confirm Cancel** | Button (surkh) | ⚠️ Order cancel kar deta hai | Bina "Reason" ke band rehta hai. **Order delete nahi hota** — sirf "Cancelled" ban jata hai |
| 8 | **Keep Order** | Button | Kuch nahi karta, box band | — |
| 9 | ✕ (close) | Icon | Box band | Escape se bhi |

> ⚠️ **"Nahi paka" = ingredients wapas stock mein.** "Pak chuka" = ingredients zaya, aur uska kharcha **Material loss** ke taur par likha jata hai. Ye faisla sahi karna zaroori hai — is se stock aur hisab dono par asar parta hai.
> Har cancel **audit log** mein mehfooz hota hai.

### 4.7.5 "Mark as Udhaar" ka box

**Maqsad:** Bill customer ke naam par **udhaar** likh dena. Paisa abhi nahi aata — customer ke khaate mein jama ho jata hai, jo baad mein **Receivables** page se wasool hota hai.

| # | Element | Type | Kya karta hai | Validation / Notes |
|---|---|---|---|---|
| 1 | **Bill amount** | Info | Kitna udhaar ho raha hai | Order ID aur table bhi |
| 2 | **Existing account** / **New customer** | 2 buttons | Purana khata ya naya customer | Purane khate na hon to seedha "New customer" khulta hai |
| 3 | **Customer account** | Dropdown | Purana khata chunein | Har naam ke saath uska mojooda baqaya: "Ali Bhai — Rs. 3,400 due" |
| 4 | **Customer name \*** | Text input | Naye customer ka naam | **Zaroori.** Misal: "Ali Bhai, Shahid Sahab" |
| 5 | **Confirm Udhaar** | Button (gold) | ⚠️ Bill khaate mein daal deta hai | Order ki halat **Udhaar** ho jati hai |
| 6 | **Cancel** / ✕ | Button / Icon | Box band | Escape se bhi |

**Errors:** *"Select a customer account."* · *"Customer name is required."*

### 4.7.6 "Mark as Complimentary" ka box

**Maqsad:** Order bilkul **muft** kar dena. Na paisa aayega, na udhaar chadhega.

| # | Element | Type | Kya karta hai | Validation / Notes |
|---|---|---|---|---|
| 1 | **Bill amount (waived)** | Info | Kitni raqam maaf ho rahi hai | — |
| 2 | **Authorised / ordered by \*** | Text input | Kis ke kehne par muft kiya | **Zaroori.** Misal: "Owner, Ali Kakar". Audit trail mein mehfooz hota hai |
| 3 | **Reason** | Dropdown | Wajah | Options: Owner's Guest, Staff Meal, Promotional, Damaged Item, VIP Guest, Owner's Relative, Business Partner, Other. Default: **Owner's Guest** |
| 4 | **Notes (optional)** | Textarea | Tafseel | Ikhtiyari |
| 5 | **✓ Mark Complimentary** | Button (violet) | ⚠️ Order muft kar deta hai | — |
| 6 | **Cancel** / ✕ | Button / Icon | Box band | — |

**Error:** *"Enter who authorised the free order."*

> **Hisab ka usool:** Complimentary order mein hisab-kitab **bill ki raqam nahi**, balke **ingredients ka kharcha (cost)** likha jata hai — kyunke restaurant ka asal nuqsan wohi hai.

### 4.7.7 "Shift Table" ka box

**Maqsad:** Chalta hua order kisi doosri table par le jana (party ne seat badal li).

| # | Element | Type | Kya karta hai | Validation / Notes |
|---|---|---|---|---|
| 1 | **‹purani table› → ‹nayi table›** | Info | Kahan se kahan ja raha hai | Naya table chunte hi update ho jata hai |
| 2 | **Search table** | Search input | Table number se dhoondta hai | Har search page 1 se |
| 3 | Table ka button | Grid button | Manzil chunta hai | Ek safhe par **12 tables** |
| 4 | **in use** (surkh, dotted) | Disabled button | Us table par pehle se order chal raha hai — chuna nahi ja sakta | ⚠️ Do unpaid order ek table par jama karna billing ki ghalti hai, isliye rok di gayi hai |
| 5 | **Prev / numbers / Next** | Pagination | Aur tables | Sirf 12 se zyada hone par |
| 6 | **✓ Move Order** | Button (sabz) | ⚠️ Order nayi table par le jata hai | Table chune bagair band rehta hai. Audit log mein mehfooz |
| 7 | **Cancel** / ✕ | Button / Icon | Box band | Escape se bhi |

**Messages:**

| Message | Matlab |
|---|---|
| *"Select a table to move this order to."* | Manzil nahi chuni |
| *"No other tables configured."* | Sirf yehi ek table bani hui hai |
| *"No tables match "‹search›"."* | Search se kuch nahi mila |
| *"Every other table is in use — free one up before moving this order."* | Har doosri table busy hai |

### 4.7.8 Cancellation Log — **sirf Admin**

Page ke sab se neeche. Sirf tab dikhta hai jab kam se kam ek cancellation hui ho.

| # | Element | Kya batata hai |
|---|---|---|
| 1 | **Cancellation Log** + ginti | "‹X› cancellation(s) recorded this session." |
| 2 | Har entry | Order number, wajah, notes, aur "Loss Rs. …" (agar ho) |
| 3 | Entry ke daayein | Kis ne cancel kiya (naam + role) aur kab |
| 4 | **Load more** | Aur purane record |

### Ye kaam kaise karein

**A. Unpaid bill se paisa lena (Cashier)**

1. Filter mein **Unpaid** dabayein.
2. Us order par click karein.
3. **✓ Mark as Paid** dabayein.
4. Cash / Card / Online chunein aur **✓ Confirm** dabayein.

**B. Customer ko bill dena bina settle kiye**

1. Order par click karein.
2. **Print Bill** dabayein.
3. Slip ke box mein **Print** dabayein. Order abhi bhi Unpaid rahega.

**C. Bill udhaar par likhna (Admin/Manager)**

1. Order par click karein.
2. **Udhaar** dabayein.
3. Purana khata chunein, ya **New customer** dabayein aur naam likhein.
4. **Confirm Udhaar** dabayein.

**D. Order cancel karna (sirf Admin)**

1. Order par click karein → **✕ Cancel Order**.
2. Tay karein ke khana bana tha ya nahi — **Mark as Cooked** / **Undo — not cooked**.
3. **Reason** chunein aur zaroorat ho to Notes likhein.
4. **Confirm Cancel** dabayein.

---

<!-- PAGE BREAK -->

## 4.8 Tables

**Route:** `/tables` · Sidebar: **Operations › Tables**

### Ye page kis kaam ka hai

Poore floor ki live tasveer — kaunsi table chal rahi hai, kaunsi khali hai, kitni der se chal rahi hai, aur kis waiter ke paas hai. Khali table par click kar ke seedha naya order shuru hota hai; chalti table par click kar ke uski tafseel khulti hai. Admin/Manager yahin se nayi tables bhi bana sakte hain.

**Kaun access kar sakta hai:** ✅ Admin, Manager, Cashier · ❌ Kitchen

| Kaam | Admin | Manager | Cashier |
|---|---|---|---|
| Table dekhna / order shuru karna | ✅ | ✅ | ✅ |
| **Manage Tables** (banana/badalna) | ✅ | ✅ | ❌ |
| Table **delete** karna | ✅ | ❌ | ❌ |
| **Add More Items** (chalti bill mein) | ✅ | ❌ (POS nahi) | ✅ |
| **Shift Table** | ✅ | ✅ | ✅ |

**[Screenshot: tables]**

### 4.8.1 Ooper ke controls

| # | Element | Type | Kya karta hai | Notes |
|---|---|---|---|---|
| 1 | **Manage Tables** | Button | Tables banane/badalne ka box kholta hai | Sirf Admin aur Manager |
| 2 | Tabs — **Running** · **Available** · **All Tables** | Tabs | Halat ke hisab se filter | Har tab par ginti aur rangeen dot: surkh = running, sabz = available, sunehri = all. Default: **All Tables** |
| 3 | **‹** / **›** | Icon buttons | Category ki patti sarkate hain | — |
| 4 | Category pills | Filter buttons | Sirf us hall/category ki tables | Live banti hain — hall ka naam badlein to yahan bhi badal jata hai |
| 5 | **Search table number…** | Search input | Table number se dhoondta hai | Misal: A5, G12, HUT15 |

### 4.8.2 Table ka card

| Halat | Rang | Card par kya hota hai |
|---|---|---|
| **Available** (khali) | Sabz border, sabz dot | Table ka naam, **Seats ‹X› · tap to start order** |
| **In use** (chal rahi) | Surkh border, surkh dot | Naam, kitne items, **kitne minute** se chal rahi hai, 👤 waiter ka naam, aur pehle 2 items ("+3 more") |
| **In use, 15+ minute** | **Gehra surkh** + ⚠️ | Wohi maloomat, lekin waqt surkh aur ⚠️ ke saath — dhyan dene ke liye |
| **Delivery / Takeaway** | Sabz | 🚗 ya 🛍️ ke saath "tap to start order" |

> Waqt har **15 second** baad khud update hota hai.

| Click par kya hota hai | |
|---|---|
| **Khali table** | Seedha POS khulta hai, table pehle se chuna hua |
| **Chal rahi table** | Order ki tafseel ka box khulta hai (4.8.3) |

### 4.8.3 Order ki tafseel ka box

| # | Element | Type | Kya batata hai / karta hai | Notes |
|---|---|---|---|---|
| 1 | Table ka naam | Heading | Order ID, waiter, waqt | — |
| 2 | Status badges | Badges | Payment ki halat, aur **Kitchen: Pending / Ready** | — |
| 3 | Items ki list | List | Naam, ginti, raqam | — |
| 4 | **Subtotal / GST / Discount / Total** | Figures | Poora hisab | — |
| 5 | **+ Add More Items** | Button (gold) | POS kholta hai — naye items **isi bill** mein jayenge | Sirf Unpaid par. Cashier aur Admin (Manager ke paas POS nahi) |
| 6 | **Shift Table** | Button | Order doosri table par le jata hai | Sirf Unpaid par. Box 4.7.7 wala |
| 7 | ✕ (close) | Icon | Box band | Escape se bhi |

### 4.8.4 Neeche ka stats footer

| # | Element | Kya batata hai |
|---|---|---|
| 1 | 🔴 **In use: ‹X›** | Kitni tables chal rahi hain |
| 2 | 🟢 **Available: ‹X›** | Kitni khali hain |
| 3 | **Total: ‹X›** | Kul kitni tables hain |
| 4 | **New Order** | Button — seedha POS kholta hai |

### 4.8.5 "Manage Tables" ka box — Admin/Manager

| # | Element | Type | Kya karta hai | Validation / Notes |
|---|---|---|---|---|
| 1 | **+ Add Tables** | Button (gold) | Nayi tables banane ka form kholta hai | 4.8.6 |
| 2 | **Halls** ki list | List | Har hall ka naam aur us mein kitni tables hain | — |
| 3 | ✏️ (edit) | Icon button | Hall badalne ka form kholta hai | Naam, seats, section badal sakte hain ya aur tables jor sakte hain |
| 4 | 🗑 (trash) — hall par | Icon button | ⚠️ Poore hall ki saari tables delete karta hai | **Sirf Admin.** Agar us hall ki koi table chal rahi ho to **band** rehta hai |
| 5 | **Delete all** / ✕ | Confirm buttons | Do-qadam tasdeeq — pehle 🗑, phir "Delete all" | Ghalti se delete se bachne ke liye |
| 6 | 🔒 **Locked** | Label | Ye group badla nahi ja sakta (Delivery/Takeaway) | Ye fixed order types hain |
| 7 | **Search table…** | Search input | Table dhoondein | Misal: A5, HUT12 |
| 8 | **All halls** | Dropdown | Hall ke hisab se filter | — |
| 9 | Table ki har patti | List row | Table ka naam, seats, hall aur section | Chal rahi ho to **In use** badge |
| 10 | 🗑 (trash) — table par | Icon button | ⚠️ Ek table delete karta hai | **Sirf Admin.** Chal rahi table par band rehta hai |
| 11 | **Delete?** / ✕ | Confirm buttons | Do-qadam tasdeeq | — |
| 12 | Pagination numbers | Buttons | Ek safhe par **20 tables** | — |
| 13 | **No tables match.** | Empty state | Search se kuch nahi mila | — |

### 4.8.6 "Add Tables" / "Edit Hall" ka form

> Dono kaam ek hi form se hote hain, kyunke sawal wohi chaar hain: kaunsa hall, kitni tables, kitni seats, kaunsa section.
> **Table ka number aap ko khud nahi likhna parta** — system khud banata hai (A1, A2, A3 …).

| # | Element | Type | Kya karta hai | Validation / Notes |
|---|---|---|---|---|
| 1 | **Hall / Category** | Dropdown | Kaunsa hall | Aakhri option: **+ New hall…** |
| 2 | Naye hall ka naam | Text input | Naya hall ka naam | Sirf "+ New hall…" chunne par. Misal: "Roof, Family Hall" |
| 3 | **How many tables?** | Number input | Kitni nayi tables banani hain | Ek baar mein **1 se 100** tak |
| 4 | Quick counts — **1 · 5 · 10 · 20 · 40** | Buttons | Ginti ek click par bhar dete hain | Default: **10** |
| 5 | **Tables in this hall** | Number input | (Edit mode) Is hall mein kul kitni tables honi chahiyein | Mojooda ginti se **kam nahi** ho sakti |
| 6 | **Seats per table** | Number input | Har table par kitni seats | Kam se kam 1 |
| 7 | **Section** | Dropdown | **Indoor / Outdoor / Special** | Default: Indoor |
| 8 | **These will be created** | Preview | Jo naam banenge unki jhalak, misal "A1, A2, A3 … A10 (10)" | Likhte hi update hota hai |
| 9 | **Fix the names (A1, A2, A3 …)** | Checkbox | (Edit mode) Poore hall ke naam tarteeb se dobara likhta hai | ⚠️ Sirf tab istemal karein jab naam duplicate ho gaye hon |
| 10 | **Tables banayein** / **Hall save karein** | Button (gold) | ⚠️ Tables banata ya hall update karta hai | Kaamyabi par sabz message; box khula rehta hai taake agla hall bhi bana sakein |
| 11 | **Cancel** / **Done** | Button | Box band | Kaam hone ke baad label "Done" ho jata hai |

**Errors:**

| Error | Matlab |
|---|---|
| **Choose a hall first.** | Hall nahi chuna (ya naye hall ka naam khali hai) |
| **Add between 1 and 100 tables at a time.** | Ginti 1–100 se bahar hai |
| **To remove tables, delete them one by one below.** | Edit mein ginti kam karne ki koshish ki — tables sirf neeche ki list se ek-ek kar ke delete hoti hain |

### Ye kaam kaise karein

**A. Nayi table par order shuru karna**

1. **Available** tab dabayein.
2. Khali table ka sabz card dabayein.
3. POS khul jayega, table pehle se chuni hui hogi — bas items daal kar checkout karein.

**B. Nayi tables banana (Admin/Manager)**

1. **Manage Tables** dabayein.
2. **+ Add Tables** dabayein.
3. **Hall / Category** chunein — ya **+ New hall…** se naya banayein.
4. **How many tables?** likhein (ya 10 / 20 wala button dabayein).
5. **Seats per table** aur **Section** set karein.
6. Preview mein naam dekh lein.
7. **Tables banayein** dabayein.

**C. Der se chal rahi table pakarna**

1. **Running** tab dabayein.
2. Jo card **gehra surkh + ⚠️** ho, wo 15 minute se zyada se chal raha hai.
3. Us par click kar ke dekhein kya chal raha hai, aur waiter se poochhein.

---

<!-- PAGE BREAK -->

## 4.9 Billing & Receipts

**Route:** `/billing` · Sidebar: **Finance › Billing**

### Ye page kis kaam ka hai

Kisi bhi order ki **receipt dekhna aur print karna**. Har order ek card ki soorat mein dikhta hai; card dabate hi asli slip khul jati hai jo print ho sakti hai. Admin/Manager yahin se bill par **discount** bhi laga sakte hain.

**Kaun access kar sakta hai:**

| Role | Access | Notes |
|---|---|---|
| **Admin** | ✅ Poora | Discount laga sakta hai, lekin **Mark Paid nahi** (settle karna Cashier ka kaam) |
| **Manager** | ➕ Create | Apna punch kiya hua bill settle kar sakta hai; discount de sakta hai |
| **Cashier** | ➕ Create | Bill settle kar sakta hai; **discount nahi** de sakta |
| **Kitchen** | ❌ | Nazar nahi aata |

**[Screenshot: billing]**

### 4.9.1 Page ke controls

| # | Element | Type | Kya karta hai | Notes |
|---|---|---|---|---|
| 1 | **Search order no.** | Search input | Sirf **order number** se dhoondta hai | Jaan-boojh kar sirf number — counter par aap ke haath mein parchi hoti hai. (Orders page waiter/table se bhi dhoondta hai) |
| 2 | **Collected** | Stat card | Aaj kitna paisa wasool hua | ⚠️ Ye chaar cards **filter se nahi badalte** — ye din ke kul figures hain |
| 3 | **Outstanding** | Stat card | Kitna wasool hona baaqi hai | — |
| 4 | **Receipts** | Stat card | Kul kitne order/receipts hain | — |
| 5 | **Complimentary (est. cost)** | Stat card (amber) | Muft diye gaye orders ka **ingredient kharcha** | Neeche: kitne orders aur "Bill forgone: Rs. …". Note: *"Accounting books the cost, not the bill"* |
| 6 | Filter pills — **All · Paid · Unpaid · Udhaar · Complimentary · Cancelled** | Filter buttons | Sirf us halat ke receipts | Ginti ke saath |
| 7 | Receipt ka card | Card button | Slip kholta hai | Card par: order ID, table, waiter, waqt, total, halat ka badge. Discount ho to sabz mein "−Rs. …" |
| 8 | **View receipt** | Hover label | Card par mouse le jane se dikhta hai | Sirf nishani |
| 9 | **Load more · 20/47** | Button | Agle 20 receipts | — |
| 10 | **No receipts yet** / **No receipts found** | Empty state | Koi order nahi, ya filter/search se kuch nahi mila | — |

### 4.9.2 Receipt (slip) ka box

Yehi slip POS, Orders aur Dashboard — teeno jagah se khulti hai.

**Slip par kya chhapta hai:**

| Hissa | Tafseel |
|---|---|
| Header | **Cafe Ali** · Hawksbay Road, Karachi · 021-111-ALI |
| Qisam | **"Receipt"** agar paid ho, **"Bill"** agar unpaid ho — taake customer unpaid parchi ko paid ki raseed na samjhe |
| Maloomat | Order number, Date, Time, Table, Waiter |
| Items | Item · Qty · Amount |
| Hisab | Subtotal, GST (agar ho), Discount (percent aur wajah ke saath), **TOTAL** |
| 🎁 COMPLIMENTARY | Sirf muft orders par — kis ne ijazat di aur wajah |
| Payment | "Paid · Cash" ya "Paid via ‹account›", aur online ho to account ki tafseel |
| Footer | "Thank you for dining with us!" aur **Software by SoftDap \| Support: +92 334 3207049** |

**Box ke buttons:**

| # | Element | Type | Kya karta hai | Kaun dekhta hai | Notes |
|---|---|---|---|---|---|
| 1 | **Apply Discount** | Button | Discount ka box kholta hai | Admin, Manager | Sirf **Unpaid** aur non-cancelled par |
| 2 | Discount ki patti + **Remove** | Info + link | Laga hua discount aur kis ne lagaya; Remove se hat jata hai | Admin, Manager | — |
| 3 | **✓ Mark Paid** | Button (sabz) | ⚠️ Order ko **Paid** kar deta hai | Cashier, Manager — **Admin nahi** | ⚠️ Ye bill ko **Cash** payment ke taur par settle karta hai. **Card ya Online** lena ho to **Orders** page ka "Mark as Paid" istemal karein — wahan tareeqa chuna jata hai |
| 4 | **Print** | Button (gold) | Slip print karta hai | Sab | Dabate hi 1.5 second ke liye "Printing…" — double print se bachne ke liye |
| 5 | ✕ (close) | Button | Box band | Sab | Escape se bhi |
| 6 | Costing panel | Info panel | Sirf complimentary orders par — ingredients ka andaza kharcha | Sab | ⚠️ Ye **print nahi hota** — customer ki receipt par restaurant ka cost kabhi nahi aata |

### 4.9.3 "Apply Discount" ka box

| # | Element | Type | Kya karta hai | Validation / Notes |
|---|---|---|---|---|
| 1 | Bill ka khulasa | Info | Subtotal, + GST, aur **Bill total (with GST)** | ⚠️ Discount **GST ke baad** wale total par lagta hai |
| 2 | **Percentage (%)** / **Fixed (Rs.)** | 2 buttons | Discount ka tareeqa | Default: Percentage. Badalne par likhi hui values saaf ho jati hain |
| 3 | **Discount percentage (%)** | Number input | Kitne percent | **1 se 100** tak, poora number (dashamlav nahi) |
| 4 | Quick percents — **5 · 10 · 15 · 20 · 25 · 50** | Buttons | Ek click par percent | — |
| 5 | Hisab ki line | Info | "10% of Rs. 2,200 (with GST) = Rs. 220" | — |
| 6 | **Discount amount (Rs.)** | Number input | Seedhi raqam | Bill se zyada nahi ("Max Rs. …") |
| 7 | **Reason** | Dropdown | Wajah | Options: VIP Customer, Bulk Order, Regular Customer, Promotional, Damaged Item, Wrong Billing, Other. Khali chhoren to "Manual Discount" likha jata hai |
| 8 | **Notes (optional)** | Textarea | Tafseel | Ikhtiyari |
| 9 | **New bill total** | Preview (sabz) | Discount ke baad ka total aur "Saves Rs. …" | — |
| 10 | **Apply Discount** | Button (gold) | ⚠️ Discount laga deta hai | Slip aur order dono par foran nazar aata hai |
| 11 | **Cancel** / ✕ | Button / Icon | Box band | Escape se bhi |

**Errors:** *"Enter a whole percentage between 1 and 100."* · *"Enter a discount amount."* · *"Discount cannot exceed Rs. …"*

### Ye kaam kaise karein

**A. Receipt dobara print karna**

1. **Search order no.** mein order number likhein (misal `1046`).
2. Card par click karein.
3. **Print** dabayein.

**B. Bill par discount dena (Admin/Manager)**

1. Filter mein **Unpaid** dabayein.
2. Us order ka card kholein.
3. **Apply Discount** dabayein.
4. **Percentage (%)** ya **Fixed (Rs.)** chunein aur raqam likhein.
5. **Reason** chunein.
6. **New bill total** dekh kar **Apply Discount** dabayein.

**C. Discount hatana**

1. Wohi order kholein.
2. Discount ki patti par **Remove** dabayein.

---

<!-- PAGE BREAK -->

## 4.10 Kitchen Display (KDS)

**Route:** `/kds` · Sidebar: **Operations › Kitchen (KDS)**

### Ye page kis kaam ka hai

Ye kitchen ki deewar par lagne wali screen hai. Jaise hi counter se order lagta hai, uska **ticket** yahan aa jata hai. Chef har item ko tayyar hone par tick karta hai, aur poora order ban jane par **Served** kar deta hai.

**Ye poori screen par chalta hai** — na sidebar, na header. Ye jaan-boojh kar hai, kyunke ye monitor bina kisi ke chalta rehta hai.

**Kaun access kar sakta hai:** ✅ Kitchen, Admin, Manager · ❌ Cashier

> Ye screen hamesha **English aur LTR** rehti hai.
> Ticket ka waqt aur ghari har **2 second** baad khud update hoti hai.

**[Screenshot: kds]**

### 4.10.1 Ooper ki patti

| # | Element | Type | Kya karta hai | Notes |
|---|---|---|---|---|
| 1 | **Kitchen Display** | Heading | Screen ka naam | — |
| 2 | **‹X› cooking** | Badge (gold) | Kitne order abhi ban rahe hain | — |
| 3 | **Auto-refresh · ‹waqt›** | Live indicator | Chalti hui ghari + sabz dot | Batata hai ke screen live hai |
| 4 | **✕ Exit** | Link button | KDS se nikal kar aam app par le jata hai | Kitchen role ke liye ye Kitchen page par le jata hai |

### 4.10.2 Filter ki patti

| # | Element | Type | Kya karta hai | Notes |
|---|---|---|---|---|
| 1 | **All Counters** | Filter button | Har counter ka kaam dikhata hai | Default. Har item par uske counter ka chhota tag lagta hai |
| 2 | Counter ke naam (misal Grill, Bar) | Filter buttons | Sirf us counter ke items dikhata hai | Jis order mein us counter ka koi item na ho, wo ticket poora hi gayab ho jata hai |
| 3 | **All / Not ready / Ready** | Toggle group | Halat ke hisab se filter | Har ek par ginti |
| 4 | **Search table, order, dish…** | Search input | Table, order number, waiter ya dish ke naam se | Poore ticket par jo kuch likha hai, sab dhoonda ja sakta hai |
| 5 | ✕ (search ke andar) | Icon button | Search khali | — |

### 4.10.3 Order ka ticket (card)

| # | Element | Type | Kya batata hai / karta hai | Notes |
|---|---|---|---|---|
| 1 | Table ka naam | Heading | Bara aur numayan | Door se parhne ke liye |
| 2 | Waiter ka naam | Text | Kis waiter ka order | — |
| 3 | Order ID ka badge | Badge | ORD-… | Ready ho to sabz, warna sunehri |
| 4 | **‹X› / ‹Y› ready** | Counter | Kitne items tayyar ho chuke | Sab tayyar hon to sabz |
| 5 | Item ki patti | **Button** | ⚠️ **Click karne se wo item tayyar (ready) ho jata hai** | Dobara click se wapas bhi ho jata hai (toggle). Tayyar item par ✓ aur line kat jati hai |
| 6 | Counter ka tag (misal "Bar") | Label | Item kis counter ka hai | Sirf "All Counters" mode mein |
| 7 | **×2** | Qty | Kitne banane hain | — |
| 8 | **+N more** / **Show less** | Button | 4 se zyada items chhupe hote hain — ye unhein kholta/band karta hai | Har ticket ki lambai barabar rakhi gayi hai, taake deewar par tarteeb kharab na ho |
| 9 | 🕐 **‹X› min** | Timer | Order kitni der se lag chuka hai | **15 minute** ke baad surkh ho jata hai aur poora ticket surkh border le leta hai |
| 10 | **Mark all ready** | Button (gold) | Poore order ke saare items ek saath tayyar | Ticket sabz ho jata hai |
| 11 | **✓ Served** | Button (sabz) | ⚠️ Ticket screen se hata deta hai | Sirf tab dikhta hai jab order Ready ho. Iska matlab: khana table par pohanch gaya |
| 12 | **All caught up 🎉** | Empty state | Koi kaam baaqi nahi | — |
| 13 | **Nothing matches** | Empty state | Search/filter se kuch nahi mila | — |

**Ticket ke rang ka matlab:**

| Rang | Matlab |
|---|---|
| **Sunehri border** | Aam ticket — ban raha hai |
| **Surkh border** | 15 minute se zyada ho gaye — foran dekhein |
| **Sabz border** | Poora order tayyar hai — utha lein |

> **Tarteeb:** Naya order sab se **ooper baayein** aata hai, wahan jahan kitchen ki nazar pehle se hoti hai. Purana order neeche jata hai — lekin uska **surkh timer** hi asal nishani hai, jagah nahi.

### Ye kaam kaise karein

**A. Rozana kitchen ka kaam (Chef)**

1. KDS screen kholein — ye poora din chalti rehti hai.
2. Naya ticket ooper baayein aata hai.
3. Jo item ban jaye, us par **click** karein — wo sabz aur ✓ ho jayega.
4. Jab poora order tayyar ho jaye, **✓ Served** dabayein — ticket screen se hat jayega.

**B. Sirf apne counter ka kaam dekhna**

1. Ooper apne counter ka naam dabayein (misal **Grill**).
2. Ab sirf aap ke counter ke items dikhenge.

**C. Der wale order dekhna**

1. **Not ready** filter dabayein.
2. Jo ticket **surkh** hai aur jiska timer surkh hai, wo 15 minute se zyada purana hai — pehle wohi banayein.

### Is page par aane wale error messages

Is screen par error alag se nahi dikhta. Agar click ka koi asar na ho, to server se rabta toot gaya hoga — screen refresh karein (F5) ya Section 6 dekhein.

---
