<!-- PAGE BREAK -->

## 4.11 Menu Management

**Route:** `/menu` · Sidebar: **Menu & Kitchen › Menu**

### Ye page kis kaam ka hai

Restaurant ka poora menu yahan se chalta hai — naya item banana, qeemat badalna, tasveer lagana, size/type ke options (Half/Full) set karna, aur kisi item ko POS par se **chhupana ya dikhana**. Yahan ki har tabdeeli **foran POS par pohanch jati hai**.

**Kaun access kar sakta hai:** ✅ Admin, Manager · ❌ Cashier, Kitchen

**[Screenshot: menu-management]**

### 4.11.1 Ooper ke controls aur cards

| # | Element | Type | Kya karta hai | Notes |
|---|---|---|---|---|
| 1 | **+ Add Item** | Button (gold) | Naya menu item banane ka form kholta hai | 4.11.3 |
| 2 | **Total Items** | Stat card | Menu par kul kitne items hain | — |
| 3 | **Available** | Stat card | Kitne items POS par nazar aa rahe hain | — |
| 4 | **Categories** | Stat card | Kitni categories istemal mein hain | — |
| 5 | Sunehri notice patti | Message | Kaamyabi ka paighaam (misal category delete hone par) | 3.5 second baad khud gayab |
| 6 | **Search items…** | Search input | Item ka naam dhoondta hai | Search par list dobara shuru se |
| 7 | **All Categories** | Dropdown | Category ke hisab se filter | — |
| 8 | **Manage categories** | Button | Category delete karne ka box kholta hai | 4.11.4 |

### 4.11.2 Menu ki table

| Column | Kya batata hai |
|---|---|
| **Item** | Tasveer (ya khali box), item ka naam, aur neeche uske options (misal "Half · Full") |
| **Category** | Kis category mein hai |
| **Price (Rs.)** | Ek qeemat, ya options wale item par range (misal "Rs. 550 – Rs. 950") |
| **Available** | Toggle switch — POS par dikhe ya nahi |
| **Actions** | Edit aur Delete ke icons |

| # | Element | Type | Kya karta hai | Click ke baad kya hota hai | Notes |
|---|---|---|---|---|---|
| 1 | **Available** toggle | Toggle switch | Item ko POS par dikhata/chhupata hai | Sabz = dikh raha hai, khaakistari = chhupa hua | ⚠️ Foran asar hota hai — koi tasdeeq nahi. Chhupane se item **delete nahi hota**, purane orders bhi salamat rehte hain |
| 2 | ✏️ (edit) | Icon button | Item badalne ka form kholta hai | 4.11.3 | Title: "Edit" |
| 3 | 🗑 (trash) | Icon button | ⚠️ **Item foran delete kar deta hai** | Row list se hat jati hai | ⚠️ Ye foran hota hai — dabane se pehle tasdeeq kar lein ke sahi row hai. Item ko sirf POS se hatana ho to delete ke bajaye **Available** toggle band karein |
| 4 | **Load more · 20/71** | Button | Agle 20 items dikhata hai | — | Ek waqt mein 20 |
| 5 | **No items match your search.** | Empty state | Search/filter se kuch nahi mila | — | — |

### 4.11.3 "Add Item" / "Edit Item" ka form

| # | Element | Type | Kya karta hai | Validation / Notes |
|---|---|---|---|---|
| 1 | **Item name** | Text input | Item ka naam | **Zaroori.** Misal: "Chicken Tikka Pizza" |
| 2 | **Category** | Dropdown | Kis category mein rakhna hai | Aakhri option: **+ New category…** |
| 3 | Nayi category ka naam | Text input | Nayi category banata hai | Sirf "+ New category…" chunne par. ℹ️ Nayi category **yahin se** banti hai — Manage categories mein sirf delete hota hai |
| 4 | **Description (optional)** | Textarea | Chhota bayan | Ikhtiyari |
| 5 | **Item image (optional)** | File upload | Item ki tasveer | Sirf image file, **2MB se kam**. Tasveer na ho to POS par saada placeholder aata hai |
| 6 | **Change image** / **Remove image** | Button / link | Tasveer badalna ya hatana | — |
| 7 | **This item has options (sizes / types)** | Checkbox | Half/Full ya Beef/Chicken jaise options chalu karta hai | Tick karne par neeche options ki table aati hai |
| 8 | **Price (Rs.)** | Number input | Ek hi qeemat | Sirf tab jab options band hon. **0 se zyada zaroori** |
| 9 | Option ki row — **Label** | Text input | Option ka naam | Misal: "Large", "Half" |
| 10 | Option ki row — **Price** | Number input | Us option ki qeemat | 0 se zyada. Kam qeemat wala option POS par "from Rs. …" ban jata hai |
| 11 | Option ki row — **Portion** | Number input | ⚠️ **Ye option recipe ka kitna hissa istemal karta hai** | Full = **1**, Half = **0.5**, Large = **1.5**. Khali ya 0 chhoren to 1 mana jata hai. Agar option size nahi balke qism hai (Beef/Chicken) to **1 hi rakhein** |
| 12 | **−** (minus) | Icon button | Option ki row hata deta hai | — |
| 13 | **+ Add option** | Button | Nayi option row jorta hai | Kam se kam **1** mukammal option zaroori hai |
| 14 | **Available (shown on POS)** | Checkbox | Item POS par dikhega ya nahi | Naye item par default: tick |
| 15 | **Re-servable if cancelled** | Checkbox | Order cancel hone par ye cheez kisi aur ko di ja sakti hai | ⚠️ Tick ho to **material loss nahi** ginta — stock wapas aa jata hai. Misal: cold drink, ice cream, bread. Default: **band** |
| 16 | **✓ Add Item** / **✓ Save Changes** | Button (gold) | Item mehfooz karta hai | Naam, category, aur qeemat (ya kam se kam ek option) bagair band rehta hai |
| 17 | **Cancel** / ✕ | Button / Icon | Box band, kuch mehfooz nahi hota | Escape se bhi |

> ⚠️ **Portion sab se ahem khana hai.** Stock isi hisaab se kata jata hai. Agar "Half" ka portion 1 chhor dein, to aadhi plate par bhi **poori recipe ka stock** kat jayega.

**Errors:** *"Please choose an image file."* · *"Image must be under 2MB."*

### 4.11.4 "Manage categories" ka box

| # | Element | Type | Kya karta hai | Notes |
|---|---|---|---|---|
| 1 | Hidayat | Text | "Delete an empty category. Add a category from the item form." | — |
| 2 | Category ki patti | List row | Category ka naam aur us mein kitne items hain | — |
| 3 | 🗑 (trash) | Icon button | Khali category delete karta hai | Sirf tab jab category mein **koi item na ho** |
| 4 | **In use** | Label | Category istemal mein hai — delete nahi hoti | 🗑 ki jagah yahi dikhta hai |
| 5 | Surkh error patti | Error | Server ka message | — |
| 6 | ✕ (close) | Icon | Box band | — |

**Tasdeeq ka box:** "Delete category?" — *"Delete the empty category '‹naam›'? This can't be undone."* → **Delete** / **Cancel**.

### Ye kaam kaise karein

**A. Naya item menu par lagana**

1. **+ Add Item** dabayein.
2. **Item name** aur **Category** bharein (nayi category chahiye to **+ New category…**).
3. Agar item ke size/type hon to **This item has options** tick karein aur har option ka **Label**, **Price** aur **Portion** likhein. Warna seedha **Price (Rs.)** likhein.
4. Chahein to tasveer aur description lagayein.
5. **Available (shown on POS)** tick rehne dein.
6. **✓ Add Item** dabayein.
7. (Marzi ho to) Kitchen se kahein ke is item ki **recipe** banayein, taake stock khud katne lage.

**B. Item ko POS se hatana (bina delete kiye)**

1. Item ki row dhoondein.
2. **Available** toggle band kar dein.
3. Item POS par nazar aana band ho jayega, lekin uska record aur purane orders salamat rahenge.

**C. Qeemat badalna**

1. Item ki row par ✏️ dabayein.
2. **Price (Rs.)** — ya har option ki **Price** — badlein.
3. **✓ Save Changes** dabayein. POS par foran nayi qeemat lag jayegi.

> ℹ️ **Purane bill nahi badalte.** Qeemat badalne se pehle lag chuke orders par koi asar nahi hota — har order apni us waqt ki qeemat mehfooz rakhta hai.

---

<!-- PAGE BREAK -->

## 4.12 Departments (Counters)

**Route:** `/departments` · Sidebar: **Menu & Kitchen › Departments**

### Ye page kis kaam ka hai

Yahan aap **counters** (department) banate hain — misal Grill, Bar, Chai Counter, Bakery — aur tay karte hain ke kaunsa menu item kis counter par jayega. Isi tarteeb ki wajah se order lagte hi **har counter ki apni KOT parchi** print hoti hai, aur KDS par bhi kaam counter ke hisab se bata hua nazar aata hai.

**Kaun access kar sakta hai:** ✅ Admin, Manager · ❌ Cashier, Kitchen

> Ijazat na ho to page par likha aata hai: *"Only Admin & Manager can manage departments."*

**[Screenshot: departments]**

### 4.12.1 Page ke elements

| # | Element | Type | Kya karta hai | Click ke baad kya hota hai | Validation / Notes |
|---|---|---|---|---|---|
| 1 | **+ New Department** | Button (gold) | Naya counter banane ka form kholta/band karta hai | Sunehri form khulta hai | — |
| 2 | **Department name** | Text input | Counter ka naam | — | Misal: "Chai Counter" |
| 3 | **Urdu name** | Text input | Urdu mein naam | — | Urdu mode mein yahi naam dikhta hai. RTL likhayi |
| 4 | **Description** | Textarea | Ye counter kya banata hai | — | Ikhtiyari |
| 5 | **Create** | Button (gold) | Counter bana deta hai | Form band, naya card list mein | Server error surkh mein dikhta hai |
| 6 | **Cancel** | Button | Form band | — | — |
| 7 | Department ka card | Card | Counter ka naam, description aur assign shuda items | — | Har card ki lambai barabar hai |
| 8 | **Items: ‹X›** | Counter | Is counter par kitne items hain | — | Neeche items ke sunehri tags |
| 9 | **No items assigned** | Empty text | Is counter par abhi koi item nahi | — | — |
| 10 | 🗑 (trash) | Icon button | Counter delete karne ki tasdeeq maangta hai | **Delete** / ✕ | Do-qadam tasdeeq |
| 11 | **Delete** (surkh) | Confirm button | ⚠️ Counter delete kar deta hai | Card hat jata hai | — |
| 12 | **✏️ Manage Items** | Button | Items assign karne ka box kholta hai | 4.12.2 | — |
| 13 | **No departments yet.** | Empty state | Abhi koi counter nahi bana | — | — |
| 14 | **‹X› items routed to counters.** | Summary | Kul kitne items kisi na kisi counter par lagay huay hain | — | Page ke sab se neeche |

### 4.12.2 "Assign items to ‹counter›" ka box

Do khaane — baayein **Assigned** (is counter par), daayein **Available items** (baaqi sab).

| # | Element | Type | Kya karta hai | Notes |
|---|---|---|---|---|
| 1 | **Assigned (‹X›)** | List | Is counter ke items | Khali ho to: "No items assigned yet." |
| 2 | **−** (minus, surkh) | Icon button | Item is counter se hata deta hai | Foran asar |
| 3 | **Search items…** | Search input | Naam ya category se dhoondta hai | — |
| 4 | **Available items** | List | Har item ka naam, category, qeemat | — |
| 5 | **on ‹counter›** | Label | ⚠️ Batata hai ke ye item **pehle se kisi doosre counter** par hai | — |
| 6 | **+** (plus, sunehri) | Icon button | Item is counter par laga deta hai | ⚠️ **Item MOVE hota hai** — doosre counter se khud-ba-khud hat jata hai. Ek item hamesha **sirf ek** counter par hota hai |
| 7 | **No matching items.** | Empty text | Search se kuch nahi mila | — |
| 8 | **Done** / ✕ | Button / Icon | Box band | Tabdeeliyan pehle hi mehfooz ho chuki hain |

> ⚠️ **Jo item kisi counter par nahi lagaya gaya**, uski parchi ek aam **"Kitchen"** naam ki slip par chali jati hai. Yani koi item KOT se ghayab nahi hota — bas alag counter par nahi jata.

### Ye kaam kaise karein

**A. Naya counter banana**

1. **+ New Department** dabayein.
2. **Department name** likhein (misal "Bar").
3. Urdu naam aur description (chahein to) bharein.
4. **Create** dabayein.

**B. Items counter par lagana**

1. Us counter ke card par **✏️ Manage Items** dabayein.
2. Daayein khaane mein item dhoondein.
3. **+** dabayein — item baayein taraf aa jayega.
4. Ghalti se laga diya ho to baayein taraf **−** dabayein.
5. **Done** dabayein.

**C. Jaanchna ke routing sahi hai**

1. POS se ek test order lagayein jis mein alag-alag counters ke items hon.
2. Dekhein ke **har counter ki alag parchi** print hui — har parchi par counter ka naam aur "Slip 1 / 2" likha hoga.

---

<!-- PAGE BREAK -->

## 4.13 Inventory

**Route:** `/inventory` · Sidebar: **Menu & Kitchen › Inventory**

### Ye page kis kaam ka hai

Kitchen ka poora stock yahan hai — kis cheez ka kitna maal hai, kitna kam ho gaya hai, aur uska rate kya hai. Yahin se **stock kharida (Buy Stock)** jata hai, jo saath hi **kharche ke taur par hisab mein bhi chala jata hai**. Stock khud-ba-khud kam hota rehta hai jab bhi koi aisa item bike jiski recipe approved ho.

**Kaun access kar sakta hai:** ✅ Admin, Manager · ❌ Cashier, Kitchen

| Kaam | Admin | Manager |
|---|---|---|
| Stock dekhna | ✅ | ✅ |
| **Buy Stock** (kharidari) | ✅ | ✅ |
| **Add New Item** (naya inventory item) | ✅ | ✅ |

**[Screenshot: inventory]**

> ⚠️ **Stock sirf do tareeqon se badalta hai:** **(1) Buy Stock** — jis ke saath rate, supplier aur tareekh darj hoti hai, ya **(2) recipe ke zariye khud-ba-khud kam hona** jab koi dish bikay. Is tarah har tabdeeli ke peeche ek wajah aur record hota hai.

### 4.13.1 Ooper ke controls aur cards

| # | Element | Type | Kya karta hai | Notes |
|---|---|---|---|---|
| 1 | **Search items…** | Search input | Naam ya category se dhoondta hai | — |
| 2 | **+ Add New Item** | Button (gold) | Naya inventory item banane ka form | 4.13.3 |
| 3 | **Total Items** | Stat card | Kul kitni cheezein track ho rahi hain | — |
| 4 | **Low Stock** | Stat card | Kitni cheezein had (threshold) par ya us se neeche hain | — |
| 5 | **Critical** | Stat card | Kitni cheezein **had ke aadhay se bhi kam** hain | "Needs immediate restock" |
| 6 | Note patti | Info | *"New stock entries are handled by the Manager…"* | Sirf us role ko jise stock add karne ki ijazat nahi |

### 4.13.2 Inventory ki table

| Column | Kya batata hai |
|---|---|
| **Item** | Cheez ka naam (Urdu mode mein Urdu naam) aur uska ID |
| **Category** | Kis category ki hai |
| **In Stock** | Kitna maal hai, aur neeche rangeen patti (bar) |
| **Threshold** | Kitne par "kam" ka alert aana chahiye |
| **Cost/Unit** | Per unit rate (na ho to "—") |
| **Status** | **In stock** (sabz) / **Low** (amber) / **Critical** (surkh) |
| **Adjust** | **Buy Stock** ka button |

**Status ka usool:**

| Halat | Kab |
|---|---|
| 🟢 **In stock** | Stock threshold se zyada hai |
| 🟡 **Low** | Stock threshold par ya us se neeche |
| 🔴 **Critical** | Stock threshold ke **aadhay** par ya us se neeche |

| # | Element | Type | Kya karta hai | Notes |
|---|---|---|---|---|
| 1 | **Buy Stock** | Button (gold) | Kharidari darj karne ka box kholta hai | 4.13.4. Title: "Add new stock (purchase)" |
| 2 | **Load more · 20/58** | Button | Agle 20 items | Nayi cheezein sab se ooper dikhti hain |
| 3 | **No items match "‹search›".** | Empty state | Search se kuch nahi mila | — |

### 4.13.3 "Add New Item" ka form

| # | Element | Type | Kya karta hai | Validation / Notes |
|---|---|---|---|---|
| 1 | **Item Name** | Text input | Cheez ka naam | **Zaroori.** Misal: "Green Chillies" |
| 2 | **Urdu name (optional)** | Text input | Urdu naam | Ikhtiyari, RTL likhayi. Misal: "ہری مرچیں" |
| 3 | **Category** | Dropdown | Kaunsi category | Aakhri option: **+ New category…** |
| 4 | Nayi category ka naam | Text input | Nayi category | Sirf "+ New category…" par |
| 5 | **Base Unit** | Dropdown | Ye cheez kis unit mein rakhi jati hai | **kg, g, L, ml, pcs, packs**. Default: kg. ⚠️ Sirf **bulk** units — chamach/cup recipe mein hote hain, stock mein nahi |
| 6 | **Initial Stock** | Number input | Abhi kitna maal maujood hai | Default: 0 |
| 7 | **Threshold (low-stock alert)** | Number input | Kitne par alert aaye | Default: 0. ⚠️ 0 rakhne se **kabhi alert nahi aayega** — koi maqool number rakhein |
| 8 | **Cost / Unit (₨)** | Number input | Per unit rate | Isi se complimentary aur cancel orders ka nuqsan lagta hai |
| 9 | **✓ Add Item** | Button (gold) | Item bana deta hai | Naam aur category bagair band rehta hai |
| 10 | **Cancel** / ✕ | Button / Icon | Box band | Escape se bhi |

### 4.13.4 "Buy Stock" ka box

| # | Element | Type | Kya karta hai | Validation / Notes |
|---|---|---|---|---|
| 1 | **Quantity (‹unit›)** | Number input | Kitna maal kharida | **Zaroori**, 0 se zyada. Dashamlav chalta hai |
| 2 | **Rate per unit (Rs)** | Number input | Per unit rate | Item ka purana rate pehle se bhara aata hai |
| 3 | **Total bill (Rs)** | Number input | Poore bill ki raqam | ⚠️ Khali chhoren to system khud "Quantity × Rate" laga leta hai. **Asli bill alag ho** (rounding, delivery kharcha) to yahan asli raqam likhein — yahi chalegi |
| 4 | **Purchase date** | Date picker | Kharidari ki tareekh | Default: aaj |
| 5 | **Supplier (optional)** | Text input | Kis se kharida | Ikhtiyari. Misal: "Karachi Wholesale" |
| 6 | Surkh patti | Preview | *"Will be recorded as an expense of Rs. …"* | ⚠️ Pehle se ittila ke ye raqam **kharche mein jayegi** |
| 7 | **Save** | Button (gold) | ⚠️ Stock barhata hai **aur** kharcha darj karta hai | Quantity aur total dono 0 se zyada zaroori |
| 8 | **Cancel** / ✕ | Button / Icon | Box band | Escape se bhi |

> ⚠️ **Buy Stock sirf stock nahi barhata — ye paisa bhi kharch dikhata hai.** Ye raqam Accounting ke kharchon mein aur din ki closing report mein nazar aayegi. Isliye tareekh aur raqam sahi likhein.

### Ye kaam kaise karein

**A. Stock kharid kar darj karna**

1. Item search karein.
2. **Buy Stock** dabayein.
3. **Quantity** aur **Rate per unit** likhein.
4. Agar bill ki asli raqam alag hai to **Total bill (Rs)** mein wohi likhein.
5. **Purchase date** aur (chahein to) **Supplier** set karein.
6. Surkh patti mein kharche ki raqam check kar lein.
7. **Save** dabayein.

**B. Kam stock ki list banana**

1. Ooper **Low Stock** aur **Critical** cards dekhein.
2. Status column mein 🔴 **Critical** wali cheezein pehle kharidein.
3. Har ek par **Buy Stock** kar ke darj karein.

**C. Nayi cheez track karna shuru karna**

1. **+ Add New Item** dabayein.
2. Naam, category aur **Base Unit** set karein.
3. **Initial Stock**, **Threshold** aur **Cost / Unit** bharein.
4. **✓ Add Item** dabayein.
5. Kitchen se kahein ke jis dish mein ye lagti hai, uski recipe mein isay shamil karein.

> ℹ️ **Chef bhi nayi cheez maang sakta hai.** Recipe banate waqt chef "Request New Ingredient" bhejta hai, jo **Dashboard** par Admin ke paas manzoori ke liye aata hai (Section 4.5.6). Wahan se approve hone par cheez khud inventory mein bann jati hai.

---

<!-- PAGE BREAK -->

## 4.14 Kitchen (Recipes)

**Route:** `/kitchen` · Sidebar: **Menu & Kitchen › Kitchen**

### Ye page kis kaam ka hai

Yahan **recipes** banti aur manzoor hoti hain. Recipe ka matlab hai: "ye dish banane mein inventory se kya kya aur kitna lagta hai". Jab kisi dish ki recipe **approved** ho jati hai, to us dish ka order lagte hi **stock khud-ba-khud kat jata hai** — koi manually ghatane ki zaroorat nahi.

**Kaun access kar sakta hai:**

| Role | Access | Kya kar sakte hain |
|---|---|---|
| **Kitchen (Chef)** | ✅ Poora | Recipe **banana** aur **edit** karna, nayi ingredient maangna |
| **Admin** | 👁 View + approve | Recipe **Approve / Reject** karna, aur **Delete** karna |
| **Manager** | 👁 Sirf dekh sakta hai | Na bana sakta hai, na approve kar sakta hai |
| **Cashier** | ❌ | Nazar nahi aata |

> ⚠️ **Ye jaan-boojh kar bata hua hai:** jo recipe banaye wo khud approve na kare. Ghalat recipe har order par khamoshi se ghalat stock kaat degi, isliye approve karne ka ikhtiyar sirf Admin ke paas hai.

**[Screenshot: kitchen-recipes]**

### 4.14.1 Ooper ke controls aur cards

| # | Element | Type | Kya karta hai | Notes |
|---|---|---|---|---|
| 1 | **Search recipes…** | Search input | Dish ke naam se dhoondta hai | Ooper ke 3 cards **filter se nahi badalte** — wo asli kul ginti batate hain |
| 2 | **+ Create Recipe** | Button (gold) | Nayi recipe ka form kholta hai | **Sirf Kitchen role** |
| 3 | **Pending Approval** | Stat card | Kitni recipes Admin ke intezar mein hain | "Awaiting Admin" |
| 4 | **Approved** | Stat card | Kitni chalu hain | "Live for deduction" — yani inhi se stock kat raha hai |
| 5 | **Total Recipes** | Stat card | Kul kitni recipes hain (har halat ki) | — |

### 4.14.2 Recipe ka card

| # | Element | Type | Kya batata hai / karta hai | Kaun dekhta hai |
|---|---|---|---|---|
| 1 | Dish ka naam | Heading | Kis menu item ki recipe hai | Sab |
| 2 | **By ‹naam› · ‹waqt›** | Text | Kis ne banayi aur kab | Sab |
| 3 | Status badge | Badge | **✓ Approved** / **⏳ Pending Approval** / **✕ Rejected** | Sab |
| 4 | **Ingredients** | List | Har ingredient ka naam aur miqdaar (misal "Chicken — 0.25 kg") | Sab |
| 5 | **Rejected: ‹wajah›** | Text (surkh) | Rad karne ki wajah | Sab (sirf rejected par) |
| 6 | **✓ Approve** | Button (gold) | ⚠️ Recipe chalu kar deta hai — ab is dish par stock katega | **Sirf Admin**, sirf pending par |
| 7 | **✕ Reject** | Button | Rad karne ka form kholta hai | **Sirf Admin**, sirf pending par |
| 8 | Wajah ka khana | Text input | Rad karne ki wajah | **Zaroori** — bina wajah "Confirm Reject" band rehta hai |
| 9 | **Confirm Reject** | Button (surkh) | Recipe rad kar deta hai | Admin |
| 10 | **✏️ Edit** | Button | Recipe badalne ka form kholta hai | **Sirf Kitchen** |
| 11 | **🗑 Delete** | Button (surkh) | Delete ka form kholta hai | **Sirf Admin** |
| 12 | Delete ki wajah ka khana | Text input | Delete ki wajah | **Zaroori** |
| 13 | **Confirm Delete** | Button (surkh) | ⚠️ Recipe delete kar deta hai | Admin |

> ⚠️ **Approved recipe edit karne ka natija:** recipe dobara **Pending** ho jati hai aur Admin ki nayi manzoori maangti hai. Yani edit karte hi us dish par stock katna **ruk jata hai**, jab tak Admin dobara approve na kare.

### 4.14.3 "Create Recipe" ka form

| # | Element | Type | Kya karta hai | Validation / Notes |
|---|---|---|---|---|
| 1 | **Menu item** | Dropdown | Kis dish ki recipe hai | **Zaroori.** Jis dish ki recipe pehle se ho, uske aage likha aata hai " — already has a recipe". Edit mode mein ye khana **band** rehta hai (dish nahi badal sakti) |
| 2 | **+ Add ingredient** | Button | Nayi ingredient ki row | Kam se kam **1** zaroori |
| 3 | Ingredient ka dropdown | Dropdown | Inventory se cheez chunta hai | Neeche pending requests bhi "(Pending Request)" ke saath dikhti hain |
| 4 | **+ Request New Ingredient** | Dropdown option (gold) | Nayi cheez maangne ka form kholta hai | 4.14.4 |
| 5 | **Qty** | Number input | Kitna lagta hai | **0 se zyada zaroori.** Dashamlav chalta hai (0.01) |
| 6 | Unit ka dropdown | Dropdown | Naapne ki unit | Item ki apni unit khud aa jati hai. Wazn wali cheez par: **kg, g, tbsp, tsp, cup**. Maaye (liquid) par: **L, ml, tbsp, tsp, cup** |
| 7 | 🔒 Locked unit | Badge | Unit badli nahi ja sakti | **pcs / packs** wali cheezon par — inhein chamach mein nahi naapa ja sakta |
| 8 | 🗑 (trash) | Icon button | Ingredient ki row hata deta hai | — |
| 9 | Note patti | Info | *"This recipe needs Admin approval before it affects inventory deduction."* | — |
| 10 | **Submit for Approval** | Button (gold) | Recipe Admin ko bhej deta hai | Halat **Pending** ho jati hai |
| 11 | **Cancel** / ✕ | Button / Icon | Box band | Escape se bhi |

> ℹ️ **Unit ki tabdeeli khud hoti hai.** Aap "4 tbsp" likhein aur cheez kg mein rakhi ho — system order lagte waqt khud kg mein badal kar ghatata hai. Aap ko hisab nahi lagana parta.

**Errors:**

| Error | Matlab |
|---|---|
| **Select a menu item.** | Dish nahi chuni |
| **Add at least one ingredient with a quantity greater than zero.** | Koi mukammal ingredient row nahi |
| **Each ingredient must be a different inventory item.** | Ek hi cheez do baar daal di |

### 4.14.4 "Request New Ingredient" ka box

**Kab istemal karein:** Jab recipe mein koi aisi cheez chahiye jo abhi inventory mein hai hi nahi.

| # | Element | Type | Kya karta hai | Validation / Notes |
|---|---|---|---|---|
| 1 | **Ingredient Name \*** | Text input | Cheez ka naam | **Zaroori.** Misal: "Fresh Cream" |
| 2 | **Category (optional)** | Text input | Category | Khali chhoren to "Other" |
| 3 | **Temporary unit \*** | Dropdown | Abhi ke liye unit | **kg, g, L, ml, tbsp, tsp, pcs, packs**. Default: kg. ⚠️ Aakhri unit **Admin** approve karte waqt tay karega |
| 4 | **Submit Request** | Button (gold) | Darkhwast Admin ko bhejta hai | Row mein cheez "(Pending Request)" ke saath aa jati hai |
| 5 | **Cancel** | Button | Box band | — |

> ⚠️ **Pending ingredient wali recipe ka stock nahi katega** jab tak Admin us ingredient ko approve kar ke inventory mein na daal de (Dashboard → Pending Ingredient Requests, Section 4.5.6).

### Ye kaam kaise karein

**A. Nayi recipe banana (Chef)**

1. **+ Create Recipe** dabayein.
2. **Menu item** chunein.
3. **+ Add ingredient** dabayein.
4. Har row mein cheez chunein, **Qty** likhein aur unit set karein.
5. Koi cheez inventory mein na ho to **+ Request New Ingredient** se maang lein.
6. **Submit for Approval** dabayein.
7. Ab Admin ke approve karne ka intezar karein.

**B. Recipe approve karna (Admin)**

1. **Kitchen** page kholein.
2. **⏳ Pending Approval** wali recipes dekhein.
3. Ingredients ki list parh kar tasdeeq karein ke miqdaar sahi hai.
4. Theek ho to **✓ Approve** dabayein — ab is dish par stock katna shuru ho jayega.
5. Galat ho to **✕ Reject** dabayein, wajah likhein aur **Confirm Reject** dabayein.

**C. Recipe theek karna (Chef)**

1. Us recipe ke card par **✏️ Edit** dabayein.
2. Ingredients badlein.
3. **Submit for Approval** dabayein.
4. ⚠️ Recipe dobara **Pending** ho jayegi — Admin se kahein ke phir se approve kar dein.

---
