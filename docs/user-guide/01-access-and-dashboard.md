# 4. Page-by-Page Guide

---

## 4.0 Har page par mojood cheezein (Sidebar aur Header)

Ye koi alag page nahi — ye wo dhaancha (frame) hai jo **har page ke ird-gird** hamesha mojood rehta hai. Isliye ise sab se pehle samajh lein; aage har page ki tafseel mein ye cheezein dobara nahi likhi jayengi.

**Kaun dekhta hai:** Har logged-in user. Sirf **Kitchen (KDS)** page ye frame nahi dikhata — wo poori screen par chalta hai kyunke wo kitchen ke monitor par bina kisi ke chalta rehta hai.

**[Screenshot: sidebar-aur-header]**

### 4.0.1 Sidebar (baayein taraf)

| # | Element | Type | Kya karta hai | Click ke baad kya hota hai | Notes |
|---|---|---|---|---|---|
| 1 | **Cafe Ali** logo | Image + text | Restaurant ka brand mark, sab se ooper | Kuch nahi — ye sirf nishani hai | Agar logo file na mile to "CA" ka monogram khud-ba-khud aa jata hai |
| 2 | **Dashboard** | Link | Dashboard page kholta hai | `/` par le jata hai | Ye hamesha ek click par rehta hai, kisi dropdown ke andar nahi |
| 3 | **Operations** | Group (dropdown) | New Order, Orders, Tables, Kitchen (KDS) ko ek jagah rakhta hai | Group khulta/band hota hai | Chevron (⌄) ghoom kar batata hai ke khula hai ya band |
| 4 | **Menu & Kitchen** | Group (dropdown) | Menu, Departments, Inventory, Kitchen | Group khulta/band hota hai | — |
| 5 | **People** | Group (dropdown) | Attendance, Employees, Approvals, Payroll | Group khulta/band hota hai | — |
| 6 | **Finance** | Group (dropdown) | Accounting, Receivables, Handover Approvals, Billing | Group khulta/band hota hai | — |
| 7 | **Reports** | Group (dropdown) | Reports, Day Closing | Group khulta/band hota hai | — |
| 8 | **Settings** | Group / Link | Settings page | `/settings` par le jata hai | Sirf Admin ko nazar aata hai |
| 9 | Chalu page ka nishan | Indicator | Jis page par aap abhi hain us par **sunehri dot (●)** aur sunehri rang aa jata hai | — | Sirf dekhne ke liye |
| 10 | User card (aap ka naam) | Card | Aap ka naam, role aur naam ke pehle do haroof ka circle | — | Sab se neeche |
| 11 | **Log out** icon (↪) | Icon button | Aap ko app se bahar nikalta hai | Login screen par wapas | ⚠️ Cashier ka drawer khula ho to pehle chunav ka box aata hai — dekhein 4.0.4 |

**Group ke bare mein 3 ahem baatein:**

1. Jis group ke andar aap ka mojooda page hai, wo **khud-ba-khud khul jata hai** — page kabhi chhupa nahin rehta.
2. Agar kisi group mein aap ke role ke liye **sirf ek hi page** ho, to wo dropdown nahi banta — seedha ek link ban jata hai.
3. Agar kisi group mein aap ke role ke liye **koi bhi page na ho**, to wo group bilkul nazar hi nahi aata (khali group nahi dikhta).

### 4.0.2 Header (ooper ki patti)

| # | Element | Type | Kya karta hai | Click ke baad kya hota hai | Notes |
|---|---|---|---|---|---|
| 1 | ☰ (hamburger) | Icon button | Chhoti screen par sidebar kholta hai | Baayein se sidebar slide ho kar aata hai | Sirf chhoti screen / tang window par nazar aata hai |
| 2 | Aaj ki tareekh | Text | Aaj ki poori tareekh | — | Sirf dekhne ke liye. Chhoti screen par chhup jati hai |
| 3 | **EN \| اردو** | Toggle | App ki zabaan badalta hai | Poora app foran badal jata hai; Urdu mein safhe dayein se baayein ho jate hain | Chunaav yaad rakha jata hai. POS/Orders/Billing hamesha English rehte hain |
| 4 | **Manager ko cash dena** | Button | Cashier beech-shift mein kuch cash Manager ko de sakta hai | "Manager ko cash dena · Beech-shift" ka box khulta hai (dekhein 4.0.5) | ⚠️ Sirf Cashier ko, aur sirf jab drawer khula ho |
| 5 | **Cash di — manzoori ka intezar** | Badge (amber) | Batata hai ke aap ne cash bhej diya hai aur manzoori baaqi hai | Kuch nahi — sirf halat batata hai | Jab tak Manager manzoori na de, "Manager ko cash dena" button ki jagah yahi dikhta hai — taake ek hi cash do baar na di jaye |
| 6 | **Log out** (surkh) | Button | Cashier ko seedha log out ka rasta | Chunav ka box (4.0.4) | Sirf Cashier ko, aur sirf drawer khula hone par |
| 7 | **Signed in as ‹Role›** | Badge | Batata hai ke aap kis role se logged in hain | — | Sirf dekhne ke liye |
| 8 | Naam ka circle | Avatar | Aap ke naam ke pehle do haroof | — | Chhoti screen par |

### 4.0.3 Cash drawer kholna — "Drawer kholein"

**Kab aata hai:** Jab **Cashier** login karta hai aur koi drawer khula nahi hota. Ye box **band nahi kiya ja sakta** — jab tak drawer na khulay, order lena mumkin nahi.

| # | Element | Type | Kya karta hai | Click ke baad kya hota hai | Validation / Notes |
|---|---|---|---|---|---|
| 1 | **Shuruati cash (Rs.)** | Number input | Drawer mein pehle se maujood cash gin kar likhein | Neeche "Shuruati raqam: Rs. …" dikhta hai | Khali nahi ho sakta; minus (−) nahi ho sakta. Enter dabane se bhi submit hota hai |
| 2 | **Drawer kholein** | Button (gold) | Shift shuru kar deta hai | Box band, POS khul jata hai | ⚠️ Ye raqam **base** hai jis se shift ke aakhir mein hisab milaya jayega — ghalat likha to shift ke aakhir mein "kam/zyada" dikhega |
| 3 | **Log out** | Button (ghost) | Bina drawer khole app se bahar | Login screen | Agar aap ki shift nahi hai to ye istemal karein |

**Error:** *"Drawer ka cash likhein."* — matlab: khana khali hai ya ghalat number hai. Sahi number likhein (0 bhi chalega).

### 4.0.4 Log out ka chunav — "Log out — kya karein?"

**Kab aata hai:** Sirf **Cashier** ko, jab drawer khula ho aur wo log out dabaye.

| # | Element | Type | Kya karta hai | Click ke baad kya hota hai | Notes |
|---|---|---|---|---|---|
| 1 | Drawer ki patti | Info | Kis ka drawer hai aur abhi kitna "Mutawaqqa" cash hai | — | Sirf dekhne ke liye |
| 2 | **Thori der ke liye ja rahe hain** | Button | Drawer ko **pause** kar deta hai — cash gine bagair | Log out ho jate hain; drawer khula rehta hai | Agli baar login par "Shift jaari rakhein" ka option milega |
| 3 | **Shift khatam — cash ginein** | Button (gold) | Cash count wala box kholta hai | "Shift khatam · Cash ginein" box (4.0.6) | ⚠️ Ye shift **band** kar deta hai |
| 4 | **Wapas kaam par** | Text link | Kuch nahi karta, box band | Wahin wapas | — |

### 4.0.5 Beech-shift cash dena — "Manager ko cash dena · Beech-shift"

**Kab aata hai:** Cashier header ka **Manager ko cash dena** dabaye.
**Maqsad:** Drawer mein cash zyada ho jaye to kuch cash Manager/Admin ko de dena, **shift band kiye bagair**.

| # | Element | Type | Kya karta hai | Click ke baad kya hota hai | Validation / Notes |
|---|---|---|---|---|---|
| 1 | **Drawer mein abhi** | Info box | Abhi drawer mein kitna cash hona chahiye | — | Ye khud calculate hota hai (shuruati + cash sale) |
| 2 | **Kitna cash de rahe hain? (Rs.)** | Number input | Di jane wali raqam | Neeche "Drawer mein bachega" dikhta hai | Drawer ki raqam se **zyada nahi** ho sakti; 0 ya minus nahi |
| 3 | **Drawer mein bachega** | Info (green) | Dene ke baad kitna bachega | — | Sirf tab dikhta hai jab sahi raqam likhi ho |
| 4 | **Kis ko dena hai?** | Dropdown | Cash lene wale ka naam | — | Sirf **active Manager aur Admin** dikhte hain. Zaroori hai |
| 5 | **Wajah (ikhtiyari)** | Textarea | Wajah likh sakte hain, misal "drawer mein cash zyada ho gaya" | — | Ikhtiyari — khali chhor sakte hain |
| 6 | **Cash dena confirm karein** | Button (gold) | Handover ki darkhwast bhejta hai | Box band; header par "Cash di — manzoori ka intezar" aa jata hai | ⚠️ **Cash abhi drawer se nahi nikalta** — jab tak Manager/Admin "Accept" na kare |
| 7 | **Rehne dein** | Button | Kuch nahi karta, box band | — | — |
| 8 | ✕ (close) | Icon | Box band | — | Escape key se bhi band hota hai |

**Errors:**

| Error | Matlab | Hal |
|---|---|---|
| *"Drawer ki raqam ke andar sahi amount likhein."* | Raqam 0 hai, minus hai, ya drawer se zyada hai | Drawer mein maujood raqam ke andar likhein |
| *"Cash lene wale ko chunein."* | Naam nahi chuna | Dropdown se Manager/Admin ka naam chunein |

### 4.0.6 Shift band karna — "Shift khatam · Cash ginein"

**Kab aata hai:** Cashier "Shift khatam — cash ginein" dabaye (ya login par "Ye shift khatam kar ke nai shuru karein" chune).

| # | Element | Type | Kya karta hai | Click ke baad kya hota hai | Validation / Notes |
|---|---|---|---|---|---|
| 1 | Drawer ki tafseel | Info panel | **Shuruati cash**, **Cash sale**, **Card sale**, **Online sale** aur **Mutawaqqa cash** dikhata hai | — | Sirf dekhne ke liye. "Mutawaqqa cash" = shuruati + cash sale |
| 2 | **Drawer mein kitna cash hai? Ginein (Rs.)** | Number input | Aap haqeeqi gina hua cash likhein | Neeche foran farq ka natija dikhta hai | Zaroori. Minus nahi |
| 3 | Natija ka box | Info | **"✓ Cash poora hai"** (sabz) / **"Rs. … kam hai"** (surkh) / **"Rs. … zyada hai"** (neela) | — | Rs. 10 tak ka farq "poora" mana jata hai |
| 4 | **Cash kis ko de rahe hain?** — Admin / Manager / **Koi aur** | 3 buttons | Cash lene wale ka role chunte hain | "Koi aur" chunne par naam ka dropdown khulta hai | Default: **Admin** |
| 5 | Naam ka dropdown ("Koi aur") | Dropdown | Kis shaks ko cash de rahe hain | — | Sirf **active Admin/Manager** dikhte hain — kyunke sirf wohi cash sign kar sakte hain |
| 6 | **Wajah (ikhtiyari)** | Textarea | Wajah | — | Ikhtiyari |
| 7 | Neeli patti | Note | "Submit karne par shift band ho jayegi aur aap log out ho jayenge." | — | Pehle se ittila |
| 8 | **Shift band karein** | Button (gold) | ⚠️ Shift band karta hai, handover banata hai, **aur aap ko log out kar deta hai** | Login screen par wapas | Ye ek hi action hai — alag se log out nahi karna parta |
| 9 | **Wapas kaam par** | Button | Box band, shift jaari | — | — |
| 10 | ✕ (close) | Icon | Box band | — | Escape se bhi |

**Errors:**

| Error | Matlab | Hal |
|---|---|---|
| *"Drawer ka cash gin kar likhein."* | Count khali ya ghalat | Cash gin kar number likhein |
| *"Cash lene wale ka naam chunein."* | "Koi aur" chuna par naam nahi chuna | Dropdown se naam chunein |

> ⚠️ **Kam/zyada cash chhupta nahi.** Farq Admin aur Manager ke Dashboard par **Cash Reconciliation** mein surkh nishan ke saath dikhta hai.

### 4.0.7 Drawer wapas kholna — "Khush aamdeed" / "Drawer pehle se khula hai"

**Kab aata hai:** Cashier login kare aur koi drawer pehle se khula (paused) ho.

| # | Element | Type | Kya karta hai | Click ke baad kya hota hai | Notes |
|---|---|---|---|---|---|
| 1 | Title | Text | Agar drawer aap ka hai: **"Khush aamdeed"**. Agar kisi aur ka hai: **"Drawer pehle se khula hai"** | — | Naam bhi likha hota hai |
| 2 | Amber warning | Note | Sirf tab jab drawer **kisi aur ka** ho: "Agar ye aap ka drawer nahi to neeche 'Aap nahi? Log out' dabayein." | — | ⚠️ Ghalti se doosre ka drawer band karne se bachne ke liye |
| 3 | **Ab tak mutawaqqa cash** | Info | Abhi tak ka hisab: shuruati + cash sale | — | Sirf dekhne ke liye |
| 4 | **Shift jaari rakhein** | Button (gold) | Wohi shift dobara chalu | Box band, kaam shuru | — |
| 5 | **Ye shift khatam kar ke nai shuru karein** | Button | Shift band karne ka box kholta hai | 4.0.6 wala box | ⚠️ Purani shift ka hisab pehle poora hoga |
| 6 | **Aap nahi? Log out** | Text link | App se bahar | Login screen | Agar drawer aap ka nahi to yahi dabayein |

---

<!-- PAGE BREAK -->

## 4.1 Login

**Route:** `/login`

### Ye page kis kaam ka hai

Ye app ka darwaza hai. Yahan aap apna **username aur password** daal kar andar aate hain. Har device par har shift ke shuru mein login karna parta hai. Login ke baad app aap ko aap ke role ke mutabiq pehle page par le jata hai.

**Kaun access kar sakta hai:** Har koi (login se pehle). Jo pehle se logged in ho, use ye page nazar nahi aata — app use seedha andar bhej deta hai.

**[Screenshot: login]**

### Elements table

| # | Element | Type | Kya karta hai | Click ke baad kya hota hai | Validation / Notes |
|---|---|---|---|---|---|
| 1 | Logo + "Fine Dining · Est. 2019" | Image + text | Brand panel (baayein taraf) | — | Sirf dekhne ke liye. Chhoti screen par chhup jata hai |
| 2 | "12 Tables / 18 Menu items / 8 Staff" | Text | Brand panel par restaurant ka taaruf | — | Sirf dekhne ke liye |
| 3 | **Welcome back** | Heading | Screen ka unwan | — | — |
| 4 | **Username** | Text input | Aap ka username | — | Aage-peeche ki khali jagah khud hat jati hai. Capital/small ka farq nahi parta. Page khulte hi cursor yahin hota hai |
| 5 | **Password** | Password input | Aap ka password | — | Likhte waqt •••• dikhta hai |
| 6 | Aankh ka icon (👁) | Icon button | Password ko dikhata/chhupata hai | Text saaf nazar aane lagta hai | Icon **mojooda halat** batata hai: kati hui aankh = chhupa hua, khuli aankh = nazar aa raha. Ye focus nahi cheenta, aap likhte reh sakte hain |
| 7 | **Sign in** | Button (gold) | Login ki koshish karta hai | Kaamyab: aap ke role ke pehle page par. Nakaam: surkh error patti | Dabate hi "Signing in…" ho jata hai aur dobara nahi dabta — do baar login nahi hota |
| 8 | Demo logins ki line | Text | Shuruati (demo) accounts ki yaad-dehani | — | ⚠️ Restaurant chalu karte waqt in accounts ke passwords zaroor badal lein (Settings › Login Passwords) |
| 9 | **Sign up** | Link | Naya account banane ka page | `/signup` | Dekhein 4.2 |

> **Note:** Is page par **koi "Forgot password" link nahi hai** — password sirf Admin reset kar sakta hai (Section 2.5).
> Ye page hamesha **English aur baayein-se-dayein** rehta hai, chahe app ki zabaan Urdu par set ho.

### Ye kaam kaise karein — Login

1. Username ke khane mein apna username likhein.
2. Password likhein. (Zaroorat ho to aankh ke icon se check kar lein ke sahi likha hai.)
3. **Sign in** dabayein — ya seedha keyboard par **Enter** dabayein.
4. Aap apne role ke pehle page par pohanch jayenge.
5. **Cashier** ho to foran "Drawer kholein" ka box aayega — drawer ka cash gin kar likhein (Section 4.0.3).

### Is page par aane wale error messages

| Error | Matlab | Hal |
|---|---|---|
| **Invalid username or password.** | Username ghalat hai, ya password ghalat hai, ya account band (deactivated) kar diya gaya hai | Dobara dhyan se likhein. Phir bhi na chale to Admin se rabta karein. *(Ye ek hi message har surat mein aata hai — jaan-boojh kar, taake koi bahar se ye na jaan sake ke kaunsa username mojood hai)* |
| **Username and password are required.** | Koi ek khana khali chhor diya | Dono khane bharein |
| **Your signup request was not approved.** | Aap ka signup Admin ne reject kar diya | Admin se baat karein |
| **This account has no system role assigned.** | Account approve to hai lekin role nahi mila | Admin: Settings ya Approvals se role assign karein |
| **Cannot reach the server. Is the local backend running?** | App server PC se baat nahi kar pa raha | Section 6 (Troubleshooting) dekhein — server PC chalu hai? WiFi juda hai? |

> **Manzoori ka intezar:** Agar aap ka account abhi approve nahi hua, to login **kaamyab** hoga lekin aap "Awaiting approval" screen par pohanch jayenge (Section 4.3), app ke andar nahi.

---

<!-- PAGE BREAK -->

## 4.2 Create account (Signup)

**Route:** `/signup`

### Ye page kis kaam ka hai

Naya staff member yahan **khud apna account bana sakta hai**. Account banate hi wo istemal ke qabil nahi hota — **Admin ko manzoori deni parti hai** aur wohi tay karta hai ke aap ka role kya hoga (Admin / Manager / Cashier / Kitchen).

**Kaun access kar sakta hai:** Har koi (login se pehle). Logged-in shaks ko ye page nazar nahi aata.

**[Screenshot: signup]**

### Elements table

| # | Element | Type | Kya karta hai | Click ke baad kya hota hai | Validation / Notes |
|---|---|---|---|---|---|
| 1 | Brand panel — "Join the team behind the golden story." | Text | Sirf sajawat | — | Chhoti screen par chhup jata hai |
| 2 | **Create account** | Heading | Screen ka unwan | — | — |
| 3 | **Full name** | Text input | Aap ka poora naam | — | Zaroori. Yahi naam receipts aur audit trail mein aayega. Cursor yahin shuru hota hai |
| 4 | **Username** | Text input | Login ke liye naam | — | Zaroori. Chhote haroof mein mehfooz hota hai. **Pehle se mojood username nahi chalega** |
| 5 | **Password** | Password input (aankh ke icon ke saath) | Naya password | — | Zaroori. Kam se kam **6 characters** |
| 6 | **Confirm password** | Password input (aankh ke icon ke saath) | Wohi password dobara | — | Ooper wale se bilkul milna chahiye |
| 7 | **Create account** | Button (gold) | Darkhwast bhejta hai | Kaamyab: screen badal kar "Request submitted" ho jati hai | Dabate hi "Creating account…" ho jata hai aur dobara nahi dabta |
| 8 | **Sign in** | Link | Login page par wapas | `/login` | — |
| 9 | **Request submitted** + "Go to Login" | Screen + button | Kaamyabi ka paighaam aur login par wapas jane ka button | `/login` | Ab Admin ki manzoori ka intezar karein |

### Ye kaam kaise karein — Naya account banana

1. Login page par **Sign up** dabayein.
2. **Full name** likhein — poora naam, jaisa staff record mein aana chahiye.
3. **Username** chunein (aasan aur chhota, misal `ahmed`).
4. **Password** likhein (kam se kam 6 characters) aur **Confirm password** mein wohi dobara likhein.
5. **Create account** dabayein.
6. "Request submitted" nazar aaye to **Go to Login** dabayein.
7. Ab apne Admin ko batayein. Admin **Approvals** page se aap ka role chun kar **Approve** dabayega (Section 4.4).
8. Manzoori ke baad dobara login karein.

### Is page par aane wale error messages

| Error | Matlab | Hal |
|---|---|---|
| **Name, username, and password are required.** | Koi khana khali hai | Teeno khane bharein |
| **Passwords do not match.** | Password aur Confirm password alag hain | Dono dobara dhyan se likhein |
| **That username is already taken.** | Ye username kisi aur ke paas hai | Koi doosra username chunein |
| **Password must be at least 6 characters.** | Password chhota hai | 6 ya us se zyada characters ka password rakhein |
| **Cannot reach the server. Is the local backend running?** | Server se rabta nahi | Section 6 dekhein |

---

<!-- PAGE BREAK -->

## 4.3 Awaiting approval

**Route:** `/pending-approval`

### Ye page kis kaam ka hai

Ye wo screen hai jo aap ko tab dikhti hai jab aap ka account **ban to gaya hai lekin Admin ne abhi manzoori nahi di**. Is halat mein app ka koi bhi page nahi khulta — aap chahe kuch bhi address daalein, app aap ko wapas isi screen par le aata hai.

**Kaun access kar sakta hai:** Sirf wo account jiska role abhi **Pending** hai. Baaqi har koi khud-ba-khud yahan se hat jata hai.

**[Screenshot: awaiting-approval]**

### Elements table

| # | Element | Type | Kya karta hai | Click ke baad kya hota hai | Notes |
|---|---|---|---|---|---|
| 1 | Logo | Image | Brand mark | — | — |
| 2 | **Awaiting approval** | Heading | Halat ka unwan | — | — |
| 3 | Paighaam | Text | "Thanks, ‹aap ka naam› — your account is awaiting admin approval…" | — | Aap ka naam khud aa jata hai |
| 4 | **Log out** | Button (gold) | App se bahar | Login screen | Ek hi button hai is page par |

### Ye kaam kaise karein — Manzoori ka intezar

1. Apne Admin ko batayein ke aap ne signup kar liya hai.
2. **Log out** dabayein aur intezar karein.
3. Admin ke approve karne ke baad dobara login karein — ab app khul jayega.

> **Ahem:** Ye screen **khud refresh nahi hoti**. Admin ke approve karne ke baad aap ko **log out kar ke dobara login** karna hoga — sirf intezar karne se screen nahi badlegi.

### Is page par aane wale error messages

Is page par koi error nahi aata. Agar dobara login par bhi yahi screen aaye, to iska matlab hai ke manzoori abhi nahi mili.

---

<!-- PAGE BREAK -->

## 4.4 Approvals

**Route:** `/approvals` · Sidebar: **People › Approvals**

### Ye page kis kaam ka hai

Yahan Admin un logon ki darkhwasten dekhta hai jinhon ne khud signup kiya hai, aur har ek ko **role de kar Approve** ya **Reject** karta hai. Jab tak yahan se manzoori na mile, wo shaks app istemal nahi kar sakta.

**Kaun access kar sakta hai:** ✅ **Sirf Admin.** Manager, Cashier aur Kitchen ko ye page sidebar mein nazar hi nahi aata.

> ⚠️ Ye pabandi jaan-boojh kar hai — agar Manager bhi approve kar sakta, to wo apna banaya hua account khud approve kar ke zyada ikhtiyar le sakta tha.

**[Screenshot: approvals]**

### Elements table

| # | Element | Type | Kya karta hai | Click ke baad kya hota hai | Validation / Notes |
|---|---|---|---|---|---|
| 1 | **Approvals** | Page heading | Page ka naam | — | Neeche likha hai: "Review signup requests and assign a role." |
| 2 | **No pending signup requests.** | Empty state | Jab koi darkhwast na ho to yahi dikhta hai | — | ✓ ka icon ke saath |
| 3 | Darkhwast ka card | Card (amber border) | Ek shaks ki darkhwast: **naam**, **@username**, aur "Requested ‹tareekh› · ‹waqt›" | — | Har darkhwast ka apna card |
| 4 | Role ka dropdown | Dropdown | Us shaks ko kaunsa role dena hai | — | Options: **Admin, Manager, Cashier, Kitchen**. Default: **Admin** — ⚠️ isliye **approve karne se pehle role zaroor badal lein**, warna galti se Admin ban jayega |
| 5 | **Approve** | Button (gold) | ⚠️ Account chalu kar deta hai aur chuna hua role de deta hai | Card list se hat jata hai; wo shaks ab login kar sakta hai | Dabate hi thori der ke liye band ho jata hai (double-click se bachaav) |
| 6 | **Reject** | Button (surkh) | ⚠️ Darkhwast rad kar deta hai | Card list se hat jata hai | Us shaks ko agle login par ye message milega: "Your signup request was not approved." **Wajah likhne ka khana nahi hai** |

> **Note:** Ye page sirf **muntazir** darkhwasten dikhata hai. Jis par faisla ho jaye wo list se hat jati hai; uska record audit trail mein mehfooz rehta hai.

### Ye kaam kaise karein

**A. Naye staff ko manzoori dena**

1. Sidebar mein **People › Approvals** kholein.
2. Us shaks ka card dhoondein (naam aur @username se pehchanein).
3. **Role ka dropdown** kholein aur sahi role chunein — Cashier, Manager, Kitchen ya Admin.
   > ⚠️ Default **Admin** hota hai. Ise badalna **na bhoolein**.
4. **Approve** dabayein.
5. Us shaks ko batayein ke ab wo login kar sakte hain.

**B. Darkhwast rad karna**

1. Card dhoondein.
2. **Reject** dabayein — card foran hat jayega.
3. Us shaks ko zabani wajah bata dein (system mein wajah likhne ki jagah nahi hai).

### Is page par aane wale error messages

Is page par error seedha screen par nahi likha jata; agar action nakaam ho to card list mein wapas aa jata hai. Aam wajuhat:

| Surat-e-haal | Hal |
|---|---|
| Button dabaya lekin card nahi hata | Server se rabta toot gaya hoga — page refresh karein aur dobara koshish karein |
| Card khud-ba-khud gayab ho gaya | Kisi doosre Admin ne dusre device se pehle hi faisla kar diya (live update) |

---

<!-- PAGE BREAK -->

## 4.5 Dashboard

**Route:** `/` · Sidebar: **Dashboard**

### Ye page kis kaam ka hai

Ye poore restaurant ka **ek nazar mein khulasa** hai — aaj kitne order huay, kitna paisa aaya, kaunsi tables chal rahi hain, kaun duty par hai, kis stock ki kami hai, aur kis cheez ko aap ki manzoori ka intezar hai. Ye page har 5 second baad khud ko taza karta hai.

**Kaun access kar sakta hai:**

| Role | Access |
|---|---|
| **Admin** | ✅ Poora — paisay ki tafseel, payroll, cash reconciliation, sab |
| **Manager** | ✅ Operations wala view — tables, staff, cash, lekin revenue/payroll ki tafseel nahi |
| **Cashier** | ❌ Nazar nahi aata — Cashier seedha **New Order (POS)** par jata hai |
| **Kitchen** | ❌ Nazar nahi aata |

> **Note:** Cashier ko Dashboard ki zaroorat nahi parti — uska saara kaam **New Order (POS)**, **Orders** aur **Billing** par hota hai, aur drawer ka hisab header se chalta hai.

**[Screenshot: dashboard-admin]**

### 4.5.1 Page ke ooper ka hissa (dono roles ke liye)

| # | Element | Type | Kya karta hai | Click ke baad kya hota hai | Notes |
|---|---|---|---|---|---|
| 1 | Unwan — "Admin Overview · ‹naam›" ya "Operations Dashboard · ‹naam›" | Heading | Role ke mutabiq unwan aur aap ka pehla naam | — | — |
| 2 | Live clock (sabz nishan ke saath) | Widget | Chalta hua waqt, din, aur "synced ‹X›s ago" | — | Sabz dot batata hai ke data live hai |
| 3 | **Refresh** | Text button | Data ko foran taza karta hai | "synced" ka waqt 0s ho jata hai | Waise bhi har 5 second baad khud taza hota hai |
| 4 | **New Order** | Button (gold) | POS kholta hai | `/pos` | — |

### 4.5.2 Ooper ke chaar StatCards

**Admin ke liye:**

| # | Card | Kya batata hai |
|---|---|---|
| 1 | **Today's Orders** | Aaj kitne order huay · neeche: kitne "awaiting payment" |
| 2 | **Revenue** | Aaj kitna paisa wasool hua ("Collected today") |
| 3 | **Active Tables** | Abhi kitni tables par log baithe hain |
| 4 | **Staff Present** | Kitne staff duty par hain / kul kitne hain |

**Manager ke liye:**

| # | Card | Kya batata hai |
|---|---|---|
| 1 | **Today's Orders** | Aaj ke order · awaiting payment |
| 2 | **Active Tables** | Abhi chal rahi tables |
| 3 | **Staff Present** | Duty par staff |
| 4 | **Outstanding** | Kitna paisa wasool hona baaqi hai · kitne unpaid orders |

> Manager ko **Revenue** card nahi dikhta — ye jaan-boojh kar hai.

### 4.5.3 Low Stock Alert

**Kab dikhta hai:** Sirf tab jab koi item apni tay shuda had (threshold) se kam ho jaye. Warna ye poora panel gayab rehta hai.

| # | Element | Type | Kya karta hai | Click ke baad kya hota hai | Notes |
|---|---|---|---|---|---|
| 1 | **Low Stock Alert** + ginti | Heading | "‹X› items need restocking soon." | — | Amber rang ka panel |
| 2 | Item ki patti | List row | Item ka naam aur "‹X› ‹unit› left" | — | **Surkh** rang = bohot kam (had ke aadhay se bhi neeche), **amber** = kam |
| 3 | **View Inventory** | Link button | Inventory page kholta hai | `/inventory` | — |

### 4.5.4 Pending Handovers (⏳ Pending Handovers)

**Kab dikhta hai:** Jab koi cashier aap ko cash bhejne ki darkhwast de. **Sirf wohi handover dikhte hain jo aap ke role ko bheje gaye hain.**

| # | Element | Type | Kya karta hai | Click ke baad kya hota hai | Notes |
|---|---|---|---|---|---|
| 1 | Ginti ka badge | Badge | Kitne handover intezar mein hain | — | — |
| 2 | Handover ka card | Card | "‹naam› wants to hand over" + raqam + waqt | — | — |
| 3 | **Review** | Button (gold) | Faisla karne ka box kholta hai | "Handover Approval" box | Neeche 4.5.5 |

### 4.5.5 "Handover Approval" ka box

| # | Element | Type | Kya karta hai | Click ke baad kya hota hai | Validation / Notes |
|---|---|---|---|---|---|
| 1 | Tafseel | Info | **From** (kis ne bheja), **Amount**, **Reason** (agar likhi ho), **Time** | — | Sirf dekhne ke liye |
| 2 | **✓ Accept** | Button (gold) | ⚠️ Cash qubool kar leta hai — ab ye raqam aap ke naam par hai | Box band; "Cash on Hand" mein aap ka figure barh jata hai | Ye faisla wapas nahi hota |
| 3 | **✕ Reject** | Button | Rad karne ka form kholta hai | Wajah likhne ka khana aata hai | — |
| 4 | Wajah ka khana | Text input | Rad karne ki wajah | — | **Zaroori** — bina wajah "Confirm Reject" nahi dabta |
| 5 | **✕ Confirm Reject** | Button (surkh) | ⚠️ Handover rad kar deta hai | Box band; cashier ke drawer mein cash wapas | — |
| 6 | **Back** | Button | Rad karne ke form se wapas | — | — |
| 7 | ✕ (close) | Icon | Box band | — | Escape se bhi |

**Error:** Agar kisi doosre Manager ne pehle hi faisla kar liya ho, to surkh patti mein server ka message aayega — box band kar ke list dobara dekhein.

### 4.5.6 Pending Ingredient Requests

**Kab dikhta hai:** Jab kitchen (chef) ne koi naya ingredient maanga ho aur uska faisla baaqi ho.
**Kaun faisla kar sakta hai:** **Sirf Admin.** Manager ko ye panel dikhta hai lekin **Approve/Reject ke buttons nahi** — wo sirf dekh sakta hai.

| # | Element | Type | Kya karta hai | Click ke baad kya hota hai | Validation / Notes |
|---|---|---|---|---|---|
| 1 | Request ka card | Card | Ingredient ka naam, **Category**, **Requested by** aur tareekh | — | — |
| 2 | **Approve** | Button (gold) | Approve ka form kholta hai | Neeche 3 khane khulte hain | Sirf Admin |
| 3 | **Base Unit \*** | Dropdown | Ye cheez kis unit mein stock hoti hai | — | Options: **kg, g, L, ml, pcs, packs**. Default: **kg**. Sirf bulk units — chamach/cup recipe mein hote hain, stock mein nahi |
| 4 | **Initial Stock \*** | Number input | Shuru mein kitna stock hai | — | Default: **0**. Dashamlav (0.01) chalta hai |
| 5 | **Min Threshold \*** | Number input | Kitna kam hone par "Low Stock Alert" aaye | — | Default: **10** |
| 6 | **Confirm Approve** | Button (sabz) | ⚠️ Naya inventory item bana deta hai | Card hat jata hai; item Inventory page par aa jata hai | — |
| 7 | **Cancel** | Button | Form band, kuch nahi hota | — | — |
| 8 | **Reject** | Button (surkh) | Rad karne ka form kholta hai | Wajah ka khana | Sirf Admin |
| 9 | **Reason for rejection \*** | Text input | Rad karne ki wajah | — | **Zaroori.** Misal: "Already tracked under another name" |
| 10 | **Confirm Reject** | Button (surkh) | ⚠️ Request rad kar deta hai | Card hat jata hai | Bina wajah ke button band rehta hai |

**Error:** *"Base unit is required."* — Base Unit chunna zaroori hai.

### 4.5.7 Cash on Hand

Ye batata hai ke **handover ka cash abhi kis ke paas hai**.

| # | Element | Type | Kya karta hai | Kaun dekhta hai | Notes |
|---|---|---|---|---|---|
| 1 | **Total on hand** (bara sunehri number) | Figure | Kul cash jo staff ke paas hai | **Sirf Admin** | Manager ko iski jagah **"You are holding"** dikhta hai — sirf uska apna hissa |
| 2 | **Admin holds** / **Manager holds** cards | Breakdown | Har role ke paas kitna cash hai, aur us mein har shaks ka naam aur raqam | **Sirf Admin** | ⚠️ Manager ko ye breakdown nahi dikhta — warna wo ghata kar ke Admin ka figure nikaal leta |
| 3 | **Hand over to Admin · Rs. …** | Button (gold) | Manager apna jama shuda cash Admin ko bhejta hai | **Sirf Manager** | Admin ke paas ye button nahi — wo aakhri manzil hai |
| 4 | **Awaiting Admin approval** | Button (band) | Batata hai ke aap ka bheja hua cash abhi manzoor nahi hua | Manager | ⚠️ Jab tak Admin sign na kare, dobara nahi bhej sakte — taake ek hi cash do baar na chala jaye |
| 5 | **No cash to hand over** | Button (band) | Aap ke paas dene ko kuch nahi | Manager | — |
| 6 | **By cashier** | List | Kis cashier se kitna cash aaya — kitne "Partial" aur kitne "Shift-end drawer" | Admin: sab · Manager: sirf jo usne khud sign kiya | — |
| 7 | Amber patti — "Rs. … · ‹X› awaiting approval" | Link | Handover Approvals page kholta hai | `/handovers` | Sirf tab jab kuch intezar mein ho |

**"Hand cash over to Admin" ka box:**

| # | Element | Type | Kya karta hai | Validation / Notes |
|---|---|---|---|---|
| 1 | **You are holding** | Info | Aap ke paas kitna cash hai | — |
| 2 | **Amount to hand over (Rs.)** | Number input | Kitna bhejna hai | Aap ke paas maujood raqam se zyada nahi |
| 3 | **Hand over everything** | Text button | Poori raqam khud bhar deta hai | Aasani ke liye |
| 4 | **You will still hold** | Info (green) | Bhejne ke baad kitna bachega | Sirf sahi raqam par dikhta hai |
| 5 | **Reason (optional)** | Textarea | Wajah | Ikhtiyari |
| 6 | **Confirm handover** | Button (gold) | ⚠️ Handover ki darkhwast bhejta hai | Cash tab tak aap ka hai jab tak Admin accept na kare |
| 7 | **Cancel** / ✕ | Button / Icon | Box band | Escape se bhi |

**Error:** *"Enter a valid amount within the cash you are holding."* — raqam 0/minus hai ya aap ke paas maujood cash se zyada hai.

### 4.5.8 Cash Reconciliation

**Kaun dekhta hai:** Admin aur Manager. Ye **aaj** ki har shift ka drawer hisab dikhata hai.

| # | Element | Type | Kya batata hai | Notes |
|---|---|---|---|---|
| 1 | Surkh badge — "‹X› shortages" | Badge | Aaj kitni shifts kam cash ke saath band huin | Sirf tab jab shortage ho |
| 2 | Surkh warning patti | Alert | "⚠️ ‹X› shifts closed with a cash shortage — review below." | — |
| 3 | Shift ka card | Card | Cashier ka naam, waqt (shuru – khatam), aur halat ka badge | Rang: sabz = **✓ Matched**, surkh = **Shortage**, neela = **Excess**, sunehri = **⏳ Active** |
| 4 | Chalu shift ke figures | Info | **Opening** aur **Expected so far** | Jo shift abhi chal rahi ho |
| 5 | Band shift ke figures | Info | **Expected**, **Actual**, **Difference** | Difference ka rang halat ke mutabiq |
| 6 | **Handed to** | Text | Cash kis ko diya gaya, aur wajah | Sirf tab jab handover hua ho |
| 7 | "No shifts recorded today." | Text | Aaj koi shift nahi chali | — |

### 4.5.9 Sirf Admin ke panels

| Panel | Kya batata hai | Elements |
|---|---|---|
| **Revenue by hour** | Ghante ke hisab se aaj ki paid sale ka chart | Har bar par mouse le jane se us ghante ki raqam dikhti hai. Khali ho to: "No paid revenue yet." |
| **Payment Methods** | **Cash Payments** aur **Card Payments** ka hissa (%) aur **Total collected** | Do rangeen patti (bars) — sunehri = cash, amber = card |
| **Monthly Payroll** | Is mahine ki mutawaqqa tankhwah, aur "Across ‹X› staff · before deductions" | **View payroll →** button `/payroll` kholta hai |

### 4.5.10 Sirf Manager ka panel

| Panel | Kya batata hai | Elements |
|---|---|---|
| **Active Tables** | Sirf wo tables jin par abhi unpaid order chal raha hai | Har card par: table ka number, **seats**, **Waiter** ka naam, **Total Bill**, aur chamakta hua sunehri dot. **View all tables →** `/tables` kholta hai. Khali ho to: "No occupied tables right now." |

> Ye jaan-boojh kar sirf **chalu** tables dikhata hai — 300+ tables ki poori list Dashboard ko bekar kar deti thi. Poori list **Tables** page par hai.

### 4.5.11 Dono ke liye — Recent orders aur On duty

| Panel | Element | Kya karta hai |
|---|---|---|
| **Recent orders** | Aakhri 5 order — table, order ID, waiter, kitne items, waqt, raqam aur halat ka badge (Paid / Unpaid / Udhaar / Complimentary / Cancelled) | — |
| | **View all →** | `/orders` kholta hai |
| **On duty** | Abhi duty par maujood staff — naam, role, shift aur check-in ka waqt | Sabz badge par kul ginti |
| | **Manage attendance** | `/attendance` kholta hai |

### Ye kaam kaise karein

**A. Rozana subah ki jaanch (Admin/Manager)**

1. Dashboard kholein.
2. Chaar cards dekhein — order, revenue/outstanding, tables, staff.
3. **Low Stock Alert** dikhe to **View Inventory** dabayein aur kharidari ki list banayein.
4. **Pending Handovers** ho to har ek par **Review** dabayein aur faisla karein.
5. **Cash Reconciliation** mein koi **Shortage** ho to us cashier se baat karein.

**B. Cashier ka cash qubool karna**

1. **Pending Handovers** panel mein us cashier ka card dhoondein.
2. **Review** dabayein.
3. Cash gin kar dekh lein ke raqam sahi hai.
4. Sahi ho to **✓ Accept** dabayein. Warna **✕ Reject** dabayein aur wajah likh kar **Confirm Reject**.

**C. Manager: din ka cash Admin ko dena**

1. **Cash on Hand** panel mein **"You are holding"** dekhein.
2. **Hand over to Admin · Rs. …** dabayein.
3. Raqam likhein ya **Hand over everything** dabayein.
4. **Confirm handover** dabayein.
5. Ab Admin ke accept karne ka intezar karein — tab tak dobara nahi bhej sakte.

### Is page par aane wale error messages

| Error | Matlab | Hal |
|---|---|---|
| **Base unit is required.** | Ingredient approve karte waqt unit nahi chuni | Base Unit dropdown se unit chunein |
| **Enter a valid amount within the cash you are holding.** | Forward ki raqam ghalat ya had se zyada | Apni maujood raqam ke andar likhein |
| Handover box mein surkh patti | Kisi aur ne pehle faisla kar diya, ya shift band ho gayi | Box band karein aur list dobara dekhein |
| **Cannot reach the server…** | Server se rabta toot gaya | Section 6 dekhein |

---
