<!-- PAGE BREAK -->

# 5. Common Workflows

Ye poore kaam hain — shuru se aakhir tak. Har workflow batata hai **kaun** kya karega aur **kis page** par.

---

## 5.1 Din shuru karna (Opening)

| Kaun | Kya |
|---|---|
| 1. **Koi bhi** | Server PC chalu karein aur tasdeeq karein ke wo chal raha hai. Har device par app khol kar dekhein ke "Cannot reach the server" nahi aa raha. |
| 2. **Cashier** | Login karein. **"Drawer kholein"** ka box aayega — drawer mein maujood cash **gin kar** likhein aur **Drawer kholein** dabayein. |
| 3. **Admin / Manager** | Dashboard kholein. **Low Stock Alert** dekhein aur kharidari ki list banayein. |
| 4. **Admin / Manager** | Agar **Pending Ingredient Requests** hon to unka faisla karein. |
| 5. **Kitchen** | KDS screen kholein aur poore din chalne dein. |
| 6. **Admin / Manager** | **Attendance** page se dekhein ke sab log check-in huay. Machine kharab ho to **Override** se manual entry karein. |

---

## 5.2 Dine-in order — shuru se bill tak

| Kaun | Kya |
|---|---|
| 1. **Cashier** | **Tables** page kholein → **Available** tab → khali (sabz) table dabayein. |
| 2. | POS khul jayega, table pehle se chuni hui hogi. |
| 3. | Menu se items dabayein. Options wale item par size/type chunein. |
| 4. | Daayein taraf **Waiter** chunein. |
| 5. | Cart check karein — ginti **+ / −** se theek karein. |
| 6a. | **Paisa foran** lena hai → **Pay Now** → tareeqa chunein → **✓ Confirm**. |
| 6b. | **Paisa baad mein** → **Place as Unpaid** (ya **F12**). |
| 7. | KOT parchi har counter ke liye khud print hogi. |
| 8. **Kitchen** | KDS par ticket aayega. Har item ban jaye to us par **click** karein. Poora ban jaye to **✓ Served** dabayein. |
| 9. **Cashier** | Unpaid tha to baad mein **Orders** page → us order par click → **✓ Mark as Paid** → tareeqa chunein → **✓ Confirm**. |
| 10. | **Print** dabayein aur customer ko receipt dein. |

---

## 5.3 Takeaway ya Delivery ka order

| Kaun | Kya |
|---|---|
| 1. **Cashier** | POS kholein. |
| 2. | **Table** dropdown mein sab se ooper **🚗 Special Orders** se **Delivery** ya **Takeaway** chunein. |
| 3. | **Waiter** ka khana khud band ho jayega ("Not needed") — ye theek hai. |
| 4. | Items daalein aur **Pay Now** ya **Place as Unpaid** karein. |

> ℹ️ Delivery/Takeaway par ek hi waqt mein **kai order** lag sakte hain — ye asal table nahi hain, isliye "already in use" ki rok nahi lagti.

---

## 5.4 Chalti hui table par aur cheezein daalna (running bill)

| Kaun | Kya |
|---|---|
| 1. **Cashier** | **Tables** page kholein. |
| 2. | Us table ka **surkh** card dabayein. |
| 3. | **+ Add More Items** dabayein. |
| 4. | POS khulega; ooper sunehri patti mein purane items aur "Running total" dikhega. |
| 5. | Naye items daalein. |
| 6. | **Add to Order · Rs. …** dabayein. |
| 7. | Sirf **naye** items ki KOT print hogi. **Doosra bill nahi banta** — sab ek hi bill par chadta hai. |

---

## 5.5 Udhaar dena aur baad mein wasool karna

**Hissa A — Udhaar par bill likhna**

| Kaun | Kya |
|---|---|
| 1. **Admin / Manager** | **Orders** page → us unpaid order par click. |
| 2. | **Udhaar** dabayein. |
| 3. | Purana khata ho to **Existing account** se chunein; naya customer ho to **New customer** dabayein aur naam likhein. |
| 4. | **Confirm Udhaar** dabayein. Order ki halat **Udhaar** ho jayegi. |

**Hissa B — Paisa wasool karna**

| Kaun | Kya |
|---|---|
| 5. **Admin / Manager** | **Receivables** page kholein. |
| 6. | Us customer ka khata dhoondein → **Mark Paid**. |
| 7. | Raqam (poori ya thori) aur **Payment method** chunein. |
| 8. | **✓ Confirm** dabayein. |

---

## 5.6 Cash ka safar — Cashier se Admin tak

```
   Cashier ka drawer
          │  (Manager ko cash dena / Shift khatam)
          ▼
   Manager ya Admin  ──── Accept ────►  ab cash unke paas
          │
          │  (sirf Manager: "Hand over to Admin")
          ▼
        Admin  ──── Accept ────►  din ka poora cash ek jagah
```

| Kaun | Kya |
|---|---|
| 1. **Cashier** | Header par **Manager ko cash dena** dabayein (beech-shift), **ya** shift ke aakhir mein **Shift khatam — cash ginein**. |
| 2. | Raqam aur lene wale ka naam chunein → confirm. |
| 3. | ⚠️ Cash abhi drawer se nikla **nahi** — manzoori ka intezar hai. |
| 4. **Manager / Admin** | **Handover Approvals** (ya Dashboard ka panel) → **Review**. |
| 5. | **Cash haath mein gin lein**, phir **✓ Accept** (ya wajah ke saath **✕ Reject**). |
| 6. **Manager** | Dashboard → **Cash on Hand** → **Hand over to Admin · Rs. …**. |
| 7. | Raqam likhein (ya **Hand over everything**) → **Confirm handover**. |
| 8. **Admin** | Handover Approvals se **✓ Accept** dabayein. |
| 9. | Ab din ka poora cash Admin ke paas hai, aur poori chain record ho chuki hai. |

---

## 5.7 Din band karna (Full Closing)

| Kaun | Kya |
|---|---|
| 1. **Cashier** | Aakhri order lag jane ke baad: header se log out → **Shift khatam — cash ginein**. |
| 2. | Drawer ka cash gin kar likhein, dekhein ke **✓ Cash poora hai** ya kitna kam/zyada hai. |
| 3. | Cash kis ko de rahe hain wo chunein → **Shift band karein**. (Aap log out ho jayenge.) |
| 4. **Manager / Admin** | Handover **✓ Accept** karein. |
| 5. **Admin / Manager** | **Day Closing** page kholein. |
| 6. | Agar **unpaid bills** ki list dikhe, to Orders page se har bill ko **Paid / Udhaar / Complimentary** karein, phir wapas aayein. |
| 7. | Sheet parhein — khaas kar **NET SALE** aur **REMAINING CASH HAND OVER**. |
| 8. | **Print** dabayein aur sheet nikaal lein. |
| 9. | **Save Closing** → **Yes, Save Closing**. |
| 10. | Gina hua cash sheet ki aakhri raqam se milayein. |
| 11. | (Marzi ho to) **Reports** → **Summary** → **Share on WhatsApp** se malik ko report bhej dein. |

> ⚠️ Din **ek hi device** se band karein.

---

## 5.8 Nayi dish menu par lagana (stock ke saath)

| Kaun | Kya |
|---|---|
| 1. **Admin / Manager** | **Menu** → **+ Add Item** → naam, category, qeemat (ya options + **Portion**) → **✓ Add Item**. |
| 2. **Admin / Manager** | **Inventory** → dekhein ke is dish ke saare ingredients maujood hain. Na hon to **+ Add New Item** se banayein. |
| 3. **Kitchen (Chef)** | **Kitchen** page → **+ Create Recipe** → dish chunein → har ingredient aur uski miqdaar daalein → **Submit for Approval**. |
| 4. **Admin** | **Kitchen** page → us recipe par **✓ Approve** dabayein. |
| 5. **Admin / Manager** | **Departments** → sahi counter par **✏️ Manage Items** → **+** se ye dish us counter par lagayein. |
| 6. **Koi bhi** | POS se ek test order lagayein — dekhein ke KOT sahi counter par gayi aur stock kam hua. |

---

## 5.9 Naya staff member rakhna

| Kaun | Kya |
|---|---|
| 1. **Admin / Manager** | **Employees** → **+ Add Employee** → naam, role, shift, phone, tankhwah. Biometric machine hai to **Attendance Machine ID** zaroor likhein → **✓ Add Employee**. |
| 2a. **Admin** | Login khud banana ho: **Settings › Login Passwords** → us shaks ka naam chunein → **Username**, **System role**, password → **Create Login**. |
| 2b. **Naya staff** | Ya wo khud: Login screen → **Sign up** → form bhar kar **Create account**. |
| 3. **Admin** | Us surat mein: **Approvals** page → role chunein (⚠️ default **Admin** hota hai, badalna na bhoolein) → **Approve**. |
| 4. **Naya staff** | Login kar ke jaanchein ke sahi pages nazar aa rahe hain. |

---

## 5.10 Maheene ke aakhir ka kaam

| Kaun | Kya |
|---|---|
| 1. **Admin / Manager** | **Payroll** → maheena chunein. |
| 2. | Har staff ka **Net salary** dekhein. Shak ho to **📅 Details** se us shaks ka hazri calendar dekh lein. |
| 3. | Tankhwah dein, phir **✓ Save & Confirm Payroll** dabayein. |
| 4. **Admin / Manager** | **Accounting** → **+ Add Expense** → category **Other** (ya jo munasib ho) → tankhwah ki adaigi darj karein. |
| 5. **Admin / Manager** | **Reports** → **Monthly** → maheena chunein → **Summary** → **Print / Save PDF**. |
| 6. **Admin / Manager** | **Receivables** dekhein — purane udhaar wasool karein. |

---

<!-- PAGE BREAK -->

# 6. Troubleshooting / FAQ

## 6.1 Connection aur server ke masail

### "Cannot reach the server. Is the local backend running?"

Sab se aam masla. Tarteeb se ye jaanchein:

1. **Server PC chalu hai?** Wo computer jis par system chalta hai — dekhein ke on hai aur so (sleep) nahi gaya.
2. **Aap ka device usi WiFi/network par hai?** Doosre WiFi par ho to server nahi milega.
3. **Server PC par app chal raha hai?** Server par ja kar dekhein ke system chal raha hai.
4. **Server PC khud thik kaam kar raha hai?** Usi PC par app khol kar dekhein. Wahan chale aur baaqi device par na chale — to network ka masla hai.
5. Kuch na chale to **server PC ko restart** karein aur 2 minute baad dobara koshish karein.

> ⚠️ **Data zaya nahi hota.** Sab kuch server PC par mehfooz hai. Connection wapas aate hi sab dobara nazar aa jayega.

### Server restart ke baad sab log out ho gaye

**Ye normal hai.** Server restart hone par har device ko dobara login karna parta hai — security ke liye. Isi khoobi ki wajah se kisi khoye hue ya ghair-mahfooz device ka session band kiya ja sakta hai.

### Ek device par kaam kiya, doosre par nazar nahi aa raha

1. 2–3 second intezar karein — updates apne aap aate hain.
2. Phir bhi na aaye to page refresh karein (**F5**).
3. Phir bhi nahi? Us device ka network toota hua hai — 6.1 wale steps dohrayein.

---

## 6.2 Login ke masail

| Masla | Wajah | Hal |
|---|---|---|
| **"Invalid username or password."** | Username/password ghalat, **ya account band (inactive)** kar diya gaya | Dhyan se dobara likhein. Phir bhi na chale to Admin se kahein — ho sakta hai account inactive ho |
| **"Your signup request was not approved."** | Admin ne signup reject kar diya | Admin se baat karein |
| **"This account has no system role assigned."** | Account approve to hai magar role nahi mila | Admin: Settings › Login Passwords se role dein |
| **"Awaiting approval" screen aa rahi hai** | Signup abhi manzoor nahi hua | Admin **Approvals** page se approve kare, phir **dobara login** karein |
| Password bhool gaye | — | ⚠️ Koi "Forgot password" link **nahi hai**. Admin: Settings › Login Passwords se reset karega |
| Achanak log out ho gaye | Admin ne password reset kiya, ya server restart hua | Naye password se dobara login karein |

---

## 6.3 Order aur billing ke masail

| Masla | Wajah | Hal |
|---|---|---|
| **"Table ‹X› already has a running order…"** | Us table par pehle se bill chal raha hai | **Tables** page se us order mein items daalein (**Add More Items**), ya pehle bill settle karein |
| **"Out of stock: ‹item› — need …, have …"** | Recipe ke hisab se stock kam hai | Inventory mein stock daalein (**Buy Stock**), ya kam ginti ka order lein |
| Menu item halka (faded) hai, click nahi hota | Us par **Out of stock** ka chip hai | Stock daalein. Ya us item ki recipe ki miqdaar jaanchein — ho sakta hai ghalat ho |
| Table ka dropdown band ho gaya (🔒 Locked) | Table chun liya aur cart mein items hain | Ya saare items hata dein, ya checkout kar lein |
| **Pay Now / Place as Unpaid** dabta hi nahi | Chuna hua table busy hai | Doosra table chunein |
| Bill par GST nahi aa raha | Settings mein GST band hai | Admin: **Settings › Tax & GST** se chalu karein |
| Card ya Online se paisa liya hai | **Billing** ka "Mark Paid" bill ko **Cash** ke taur par settle karta hai | **Orders** page ka "Mark as Paid" istemal karein — wahan Cash / Card / Online chuna jata hai |
| Admin ke paas "Mark as Paid" ka button nahi | Ye jaan-boojh kar hai — bill settle karna Cashier/Manager ka kaam hai | Cashier ya Manager se karwayein |

---

## 6.4 Printing ke masail

| Masla | Hal |
|---|---|
| KOT parchi print nahi hui | Windows ka default printer sahi set hai? Printer on aur kaghaz maujood hai? |
| Do baar print ho gaya | System 1.5 second tak dobara print rokta hai. Iske baad phir dabaya to dobara nikal jayega — thora intezar karein |
| Receipt ki jagah galat cheez print hui | Har print ki apni alag screen hai. Jo box khula hai usi ka **Print** dabayein |
| PDF chahiye, kaghaz nahi | Print ke box mein printer ki jagah **"Microsoft Print to PDF"** ya **"Save as PDF"** chunein |
| Report ki sirf ek page print hui | Ledger print par **saari rows** aati hain. Sirf ek page aaye to printer ki settings dekhein |

---

## 6.5 Cash drawer aur handover

| Masla | Wajah | Hal |
|---|---|---|
| Login par kisi aur ke naam ka drawer khula mila | Drawer ek hi hai, poore restaurant ka | **"Aap nahi? Log out"** dabayein aur us cashier se kahein ke apni shift band kare |
| Shift ke aakhir mein cash **kam** nikla | Ya paisa kam hai, ya koi order galat method se darj hua | Farq Admin/Manager ke Dashboard par surkh nishan ke saath jayega. Us cashier se baat karein |
| **Manager ko cash dena** ka button gayab hai | Aap ne pehle hi cash bhej rakha hai | Header par **"Cash di — manzoori ka intezar"** dikhta hoga. Manager ke accept karne ka intezar karein |
| Manager ka **Hand over to Admin** band hai | Ya aap ke paas cash nahi, ya pehla handover abhi manzoor nahi hua | Admin se kahein ke pehle wala accept kare |
| Handover list mein nazar nahi aa raha | Wo aap ke role ko nahi bheja gaya | Cashier sahi shaks chun kar dobara bheje |
| **Day Closing** band hai | Kisi ki shift khuli hai ya bill unpaid hain | Page par likhi hui wajah parhein aur wo pehle theek karein |

---

## 6.6 Stock aur recipe

| Masla | Wajah | Hal |
|---|---|---|
| Order lag raha hai magar stock kam nahi ho raha | Us dish ki recipe **approved** nahi hai | Kitchen recipe banaye, Admin **Approve** kare |
| Recipe edit ki, ab stock katna band ho gaya | Edit karne se recipe wapas **Pending** ho jati hai | Admin dobara **Approve** kare |
| Ingredient ki request approve karne ka option nahi | Sirf **Admin** ye kar sakta hai | Admin se kahein |
| Low Stock alert kabhi nahi aata | Us item ka **Threshold 0** hai | Inventory mein us item ka threshold maqool number par set karein |
| Inventory mein stock seedha barhana chahte hain | Stock sirf record ke saath badalta hai | **Buy Stock** istemal karein — rate, supplier aur tareekh ke saath |
| "Half" order par poora stock kat raha hai | Us option ka **Portion** 1 rakha hua hai | **Menu › Edit Item** mein Half ka Portion **0.5** karein |

---

## 6.7 Attendance aur payroll

| Masla | Wajah | Hal |
|---|---|---|
| Sab log **Absent** dikh rahe hain | Machine se koi record nahi aaya | **Settings › Attendance Machine** se connection jaanchein; **Server Health › Sync Attendance Now** dabayein |
| Ek shaks ki hazri nahi aa rahi | Uska **Attendance Machine ID** darj nahi hai | **Employees › Edit** se machine ka ID likhein |
| Payroll ke "Present days" par shak hai | Sunday working day mein nahi ginta, is liye ginti kam lag sakti hai | Us staff ke card par **📅 Details** dabayein — calendar har din ka rang ke saath khulasa deta hai |
| Advance delete nahi ho raha | Us par **recovered** ka badge hai | Recovered advance hat nahi sakta |
| Koi employee payroll mein nahi aa raha | Uska record **Inactive** hai | **Employees** mein uska Status toggle chalu karein |

---

## 6.8 Aam sawalat (FAQ)

**S: Kya internet band hone par kaam ruk jayega?**
J: Nahi. Poora kaam restaurant ke andar wale server par hota hai. Internet sirf cloud backup aur WhatsApp report ke liye chahiye.

**S: Kya delete kiya hua order wapas aa sakta hai?**
J: **Order kabhi delete hi nahi hota.** Cancel hone par bhi wo "Cancelled" ban kar record mein rehta hai — wajah, kis ne kiya aur kab, sab ke saath.

**S: Din band karne ke baad purana data mit jata hai?**
J: Nahi. Sirf "live" totals sifar hote hain. Saare orders **Reports** aur **Closing History** mein waise hi rehte hain.

**S: Ek hi waqt mein kitne log app istemal kar sakte hain?**
J: Jitne chahein. Har ek ka apna login hota hai aur sab ko live update milta rehta hai.

**S: Cashier discount kyun nahi de sakta?**
J: Ye jaan-boojh kar hai. Discount se bill kam hota hai, isliye ye ikhtiyar sirf Admin/Manager ke paas hai.

**S: Manager bill cancel kyun nahi kar sakta?**
J: Bill cancel karna paisa ghayab karne ka sab se aasan tareeqa hai — isliye sirf Admin.

**S: Manager apna cash drawer kyun nahi chala sakta?**
J: Manager wohi hai jo cashier se cash **wasool** karta hai. Agar wohi drawer bhi chalaye, to dene wala aur lene wala ek hi banda ho jayega.

**S: Purani qeemat wale bill qeemat badalne par badal jate hain?**
J: Nahi. Har order apni us waqt ki qeemat aur GST rate mehfooz rakhta hai.

**S: Complimentary order ka nuqsan kaise ginte hain?**
J: Bill ki raqam nahi, balke **ingredients ka kharcha (cost)** — kyunke asal nuqsan wohi hai.

**S: Backup kab hota hai?**
J: Rozana khud-ba-khud. Admin **Settings › Server Health › Backup Now** se kabhi bhi foran backup bana sakta hai.

**S: App ki zabaan Urdu kar dein to kya POS bhi Urdu ho jayega?**
J: Nahi. **POS, Orders aur Billing** hamesha English aur LTR rehte hain — counter par raftaar aur receipt ki tarteeb ke liye. Baaqi admin pages Urdu ho jate hain.

**S: Ek item do counters par lag sakta hai?**
J: Nahi. Ek item hamesha **sirf ek** counter par hota hai. Naye counter par lagane se purane se khud hat jata hai.

---

<!-- PAGE BREAK -->

# 7. Glossary

| Lafz | Matlab |
|---|---|
| **Advance** | Maheene ke beech staff ko di gayi tankhwah ka hissa, jo maheene ke aakhir mein kaat liya jata hai |
| **Audit trail / Audit log** | Har ahem kaam ka khud-ba-khud banne wala record — kis ne kiya, kab kiya, kya kiya. Ye mitaya nahi ja sakta |
| **Backend / Server** | Wo computer program jo data sambhalta hai. Ye restaurant ke server PC par chalta hai |
| **Base unit** | Wo unit jis mein koi cheez stock mein rakhi jati hai (kg, L, pcs waghera) |
| **Biometric machine** | Fingerprint ya face se hazri lagane wali machine (ZKTeco uFace 950) |
| **Business day / Session** | Ek closing se agli closing tak ka arsa. Ye calendar ke din se alag hai — restaurant 2 baje khulta aur agle din 3 baje band hota hai |
| **Cash drawer** | Cashier ka golla/till. "Kholna" = shuruati cash likhna; "band karna" = gin kar hisab milana |
| **Complimentary** | Muft / on-the-house order. Na paisa, na udhaar |
| **COGS / Est. cost** | Kisi cheez ko banane mein laga ingredients ka kharcha (bill ki raqam nahi) |
| **Department / Counter** | Kitchen ka hissa — Grill, Bar, Bakery. Har counter ki apni KOT parchi banti hai |
| **Discount** | Bill par kami — percent mein ya seedhi raqam mein |
| **Expected cash** | System ke hisab se drawer mein kitna cash hona chahiye (shuruati + cash sale) |
| **Forward (cash)** | Manager ka jama shuda cash Admin ko aage dena |
| **GST** | Government Sales Tax — bill par lagne wala tax. Settings se chalu/band aur rate set hota hai |
| **Handover** | Cash ek shaks se doosre ko dena. Lene wale ki manzoori ke bagair cash nahi nikalta |
| **IBAN** | Bank account ka bainul-aqwami number — Pakistan mein 24 characters, "PK" se shuru |
| **KDS (Kitchen Display System)** | Kitchen ki screen jis par order live nazar aate hain |
| **KOT (Kitchen Order Ticket)** | Kitchen ki parchi. Har counter ki apni alag parchi print hoti hai |
| **LAN** | Restaurant ka apna andaruni network (WiFi/cable) jis se sab devices judte hain |
| **Ledger** | Aamdani aur kharche ki tafseeli list |
| **Low stock / Critical** | **Low** = tay shuda had par ya us se neeche · **Critical** = had ke aadhay se bhi kam |
| **Manual Override** | Machine kharab hone par haath se hazri daalna. Wajah likhna zaroori, aur record chhorta hai |
| **Most Ordered** | POS par sab se ooper dikhne wali "best sellers" ki list. Ye sab ke liye ek hi hoti hai |
| **Net Sale** | Discount kaatne ke baad ki sale |
| **Net Profit** | Income − Expenses − Maintenance |
| **Online account** | JazzCash, Easypaisa, SadaPay, NayaPay ya bank — jahan online payment aati hai |
| **Partial handover** | Shift band kiye bagair beech mein kuch cash Manager ko dena |
| **Pending (role)** | Wo naya account jiski Admin manzoori baaqi hai. Is halat mein koi page nahi khulta |
| **Portion** | Kisi option (Half/Full/Large) mein recipe ka kitna hissa lagta hai. Full = 1, Half = 0.5, Large = 1.5 |
| **POS (Point of Sale)** | Order lene aur bill banane wali screen (**New Order** page) |
| **Receivable** | Udhaar khata — jo paisa customer se lena baaqi hai |
| **Recipe** | Kisi dish mein kaunsa raw material kitna lagta hai. **Approved** recipe hi stock kaatti hai |
| **Re-servable** | Wo cheez jo order cancel hone par kisi aur ko di ja sakti hai (cold drink, bread) — iska nuqsan nahi ginte |
| **Recovered (advance)** | Wo advance jo tankhwah se kaat liya gaya |
| **Separation of duties** | Ikhtiyar jaan-boojh kar do logon mein baantna, taake ek akela paisa idhar-udhar na kar sake |
| **Shift** | Ek cashier ka drawer kholne se band karne tak ka arsa |
| **Shortage / Excess** | Shift ke aakhir mein gina hua cash mutawaqqa se **kam** (shortage) ya **zyada** (excess) |
| **Threshold** | Wo had jis se neeche jane par "Low Stock" ka alert aata hai |
| **Udhaar** | Credit — bill customer ke khaate mein likh dena, paisa baad mein lena |
| **VPS** | Cloud par mojood server jahan backup jata hai. Ye band ho to rozana kaam par koi asar nahi parta |
| **Variant / Option** | Ek hi item ke alag roop — Half/Full, Small/Large, Beef/Chicken |
| **Waiter** | Order ke saath juda hua staff member. Delivery/Takeaway par zaroorat nahi |

---

<!-- PAGE BREAK -->

# Support

**Software by SoftDap**
Support: **+92 334 3207049**

---

*Cafe Ali — User Guide · Version 1.0 · 28 July 2026*
