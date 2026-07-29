<!-- PAGE BREAK -->

## 4.15 Attendance

**Route:** `/attendance` · Sidebar: **People › Attendance**

### Ye page kis kaam ka hai

Aaj ki **hazri** — kaun aaya, kitne baje aaya, der se to nahi aaya, aur kaun chala gaya. Hazri asal mein **biometric machine** (fingerprint/face) se aati hai aur is page par **badli nahi ja sakti**. Sirf jab machine kharab ho ya band ho, tab Admin/Manager **Manual Override** se waqt daal sakte hain — aur wo entry hamesha "Manual Entry" ka nishan aur record chhorti hai.

**Kaun access kar sakta hai:** ✅ Admin, Manager · ❌ Cashier, Kitchen
**Manual Override:** ✅ Admin, Manager

**[Screenshot: attendance]**

### 4.15.1 Ooper ke chaar cards

| # | Card | Kya batata hai |
|---|---|---|
| 1 | **On Duty** | Abhi kitne log duty par hain (Present + Late dono) |
| 2 | **Late Today** | Kitne log grace period ke baad aaye |
| 3 | **Checked Out** | Kitne apni shift poori kar ke ja chuke |
| 4 | **Absent** | Kitne aaj tak check-in nahi huay |

### 4.15.2 Hazri ki table

| Column | Kya batata hai |
|---|---|
| **Staff** | Naam aur naam ke pehle haroof ka circle |
| **Role** | Job title (Waiter, Chef, Manager…) |
| **Shift** | Morning ya Evening |
| **Check-in** | Aane ka waqt — **sirf padhne ke liye** |
| **Check-out** | Jane ka waqt — **sirf padhne ke liye** |
| **Status** | **Present / Late / Checked Out / Absent** ka badge. Late par neeche kitni der ki taakheer hui |
| **Source** | **Machine Verified** (sabz) ya **Manual Entry** (amber) |
| **Action** | **Override** ka button |

> ⚠️ **Check-in / Check-out ke khane sirf padhne ke liye hain.** Yahan seedha likha nahi ja sakta — ye machine ka data hai. Badalne ke liye **Override** hi ek rasta hai, aur wo record chhorta hai.

| # | Element | Type | Kya karta hai | Kaun dekhta hai |
|---|---|---|---|---|
| 1 | **✏️ Override** | Button | Manual entry ka box kholta hai | Admin, Manager |
| 2 | **Machine Verified** | Badge (sabz) | Hazri machine se aayi hai | Sab |
| 3 | **Manual Entry** | Badge (amber) | Hazri haath se daali gayi hai | Sab |

> **"Late" ka faisla khud hota hai:** system check-in ka waqt shift ke shuru hone ke waqt (+ grace period) se milata hai. Isliye record mein "Present" likha ho tab bhi der se aane par **Late** dikh jata hai.

### 4.15.3 "Manual Override" ka box

| # | Element | Type | Kya karta hai | Validation / Notes |
|---|---|---|---|---|
| 1 | Amber warning | Note | *"For emergency use only (e.g. machine malfunction). This entry is logged to the audit trail and marked Manual Entry."* | ⚠️ Sirf emergency ke liye |
| 2 | **Check-in** | Time picker | Aane ka waqt | Aaj ki tareekh par lagta hai |
| 3 | **Check-out** | Time picker | Jane ka waqt | — |
| 4 | **Reason \*** | Dropdown | Wajah kyun manual entry kar rahe hain | **Zaroori.** Options: Machine Malfunction · Machine Offline (No Internet) · Employee Forgot to Punch · Fingerprint Not Recognized · Correction (Wrong Machine Entry) · Other |
| 5 | **Notes (optional)** | Textarea | Tafseel | Misal: "Biometric reader was offline all morning" |
| 6 | **Save Manual Entry** | Button (gold) | ⚠️ Hazri mehfooz karta hai | Record par "Manual Entry" ka nishan lag jata hai aur audit trail mein darj hota hai |
| 7 | **Cancel** / ✕ | Button / Icon | Box band | Escape se bhi |

**Errors:**

| Error | Matlab |
|---|---|
| **A reason is mandatory for a manual entry.** | Wajah nahi chuni |
| **Enter at least a check-in or check-out time.** | Dono waqt khali chhor diye |
| **Check-out cannot be earlier than check-in.** | Jane ka waqt aane se pehle ka likh diya |

### 4.15.4 Manual Override History

Page ke neeche. Sirf tab dikhta hai jab kam se kam ek manual entry hui ho.

| # | Element | Kya batata hai |
|---|---|---|
| 1 | Har entry (amber patti) | Staff ka naam, **Reason**, **Notes**, aur "In ‹waqt› · Out ‹waqt›" |
| 2 | Daayein taraf | **By: ‹kis ne ki›** aur kab ki |

> Ye Admin ke liye nigrani ka zariya hai — koi manual entry chhup kar nahi ho sakti.

### Ye kaam kaise karein

**A. Rozana hazri dekhna**

1. **Attendance** page kholein.
2. Chaar cards se andaza lagayein: kitne duty par, kitne late, kitne ghair-hazir.
3. Table mein **Late** wale logon ke saath taakheer ki miqdaar likhi hoti hai.

**B. Machine kharab hone par hazri daalna**

1. Us shaks ki row par **✏️ Override** dabayein.
2. **Check-in** (aur zaroorat ho to **Check-out**) ka waqt daalein.
3. **Reason** chunein — misal "Machine Malfunction".
4. Notes mein tafseel likhein.
5. **Save Manual Entry** dabayein.

> ℹ️ **Agar sab log "Absent" dikh rahe hain**, to iska matlab hai ke aaj machine se koi record nahi aaya. Ye system ki kharabi nahi — sach mein "koi data nahi" hai. Machine ka connection Settings page se jaanchein.

---

<!-- PAGE BREAK -->

## 4.16 Employees

**Route:** `/employees` · Sidebar: **People › Employees**

### Ye page kis kaam ka hai

Poore staff ka record — naam, role, shift, phone, tankhwah aur attendance machine ka ID. Yahin se naya employee darj hota hai, purane ka record badalta hai, aur jo ab kaam nahi karta use **band (inactive)** kiya jata hai.

**Kaun access kar sakta hai:** ✅ Admin, Manager · ❌ Cashier, Kitchen
**Delete karna:** ✅ **Sirf Admin**

> ⚠️ **Ahem farq:** Employee ka record **login account nahi hai**. Yahan employee banane se wo shaks app mein login **nahi** kar sakta. Login dene ke liye Admin ko **Settings › Login Passwords › Create Login** istemal karna parta hai (Section 2.5), ya wo shaks khud signup kare aur Admin **Approvals** se manzoori de.

**[Screenshot: employees]**

### 4.16.1 Ooper ke controls aur cards

| # | Element | Type | Kya karta hai | Notes |
|---|---|---|---|---|
| 1 | **+ Add Employee** | Button (gold) | Naya employee darj karne ka form | 4.16.3 |
| 2 | **Total Staff** | Stat card | Kul kitne record hain (band walay bhi) | — |
| 3 | **Active** | Stat card | Kitne kaam kar rahe hain | — |
| 4 | **Waiters** | Stat card | Kitne active waiter hain | — |
| 5 | **Kitchen** | Stat card | Kitne active **Chef** hain | Ye card **Chef** role ke logon ki ginti hai |
| 6 | **Search name, role or phone…** | Search input | Naam, role ya phone se dhoondta hai | — |

### 4.16.2 Employees ki table

| Column | Kya batata hai |
|---|---|
| **Name** | Naam, email (agar ho), aur **Machine ID:** (agar ho) |
| **Role** | Rangeen badge — Manager (neela), Cashier (sabz), Waiter (sunehri), Chef (jamni), Kitchen (amber) |
| **Shift** | Morning / Evening |
| **Phone** | Number ya "—" |
| **Base Salary** | Maheene ki bunyadi tankhwah |
| **Status** | Toggle switch — Active / Inactive |
| **Actions** | Edit aur (Admin ke liye) Delete |

| # | Element | Type | Kya karta hai | Notes |
|---|---|---|---|---|
| 1 | **Status** toggle | Toggle switch | Employee ko chalu/band karta hai | ⚠️ Foran asar, koi tasdeeq nahi. **Inactive** hone par wo shaks payroll aur attendance dono se nikal jata hai. Row halki ho jati hai |
| 2 | ✏️ (edit) | Icon button | Record badalne ka form | — |
| 3 | 🗑 (trash) | Icon button | ⚠️ **Record foran delete kar deta hai** | **Sirf Admin.** Ye foran hota hai — dabane se pehle tasdeeq kar lein. Behtar tareeqa: delete ki jagah **Status toggle band** kar dein, taake record aur purana hisab dono mehfooz rahein |
| 4 | **Load more · 20/34** | Button | Agle 20 record | — |
| 5 | **No employees match your search.** | Empty state | Search se kuch nahi mila | — |

### 4.16.3 "Add Employee" / "Edit Employee" ka form

| # | Element | Type | Kya karta hai | Validation / Notes |
|---|---|---|---|---|
| 1 | **Full name \*** | Text input | Poora naam | **Zaroori.** Misal: "Ahmed Ali" |
| 2 | **Role \*** | Dropdown | Job title | **Manager · Cashier · Waiter · Chef · Kitchen**. Default: Waiter. ⚠️ Ye job title hai — app ka **login role isse alag** hai |
| 3 | **Shift** | Dropdown | **Morning** ya **Evening** | Default: Morning |
| 4 | **Phone** | Phone input | Rabta number | Ikhtiyari — **lekin agar likhein to poore 11 digits** hone chahiyein (0300-1234567). Adhoora number qubool nahi hota |
| 5 | **Base salary (Rs.)** | Number input | Maheene ki bunyadi tankhwah | Payroll ka hisab isi se lagta hai. Default: 0 |
| 6 | **Email (optional)** | Text input | Email | Ikhtiyari |
| 7 | **Attendance Machine ID (optional)** | Text input | Biometric machine par is shaks ka ID | ⚠️ Ye **zaroori hai** agar machine ki hazri is shaks se jorni hai. Machine par jo ID enroll hua hai wohi likhein |
| 8 | **Active (counts in payroll & attendance)** | Checkbox | Chalu record | Default: tick |
| 9 | **✓ Add Employee** / **✓ Save Changes** | Button (gold) | Record mehfooz karta hai | Naam aur sahi phone bagair band rehta hai |
| 10 | **Cancel** / ✕ | Button / Icon | Box band | Escape se bhi |

**Error:** *"Phone number must be exactly 11 digits."*

### Ye kaam kaise karein

**A. Naya employee darj karna**

1. **+ Add Employee** dabayein.
2. **Full name** aur **Role** chunein.
3. **Shift**, **Phone** aur **Base salary** bharein.
4. Agar biometric machine hai to **Attendance Machine ID** zaroor likhein — warna uski hazri system se nahi jurregi.
5. **✓ Add Employee** dabayein.
6. Agar isay app mein login bhi chahiye, to Admin **Settings › Login Passwords** se uska login banaye.

**B. Employee ka jana (resign / nikala gaya)**

1. Us ki row dhoondein.
2. **Status** toggle band kar dein.
3. Ab wo payroll aur attendance dono se nikal jayega, lekin uska purana record aur hisab mehfooz rahega.
   > ⚠️ **Delete na karein** — delete karne se record hi khatam ho jata hai.

**C. Tankhwah badalna**

1. ✏️ dabayein.
2. **Base salary (Rs.)** badlein.
3. **✓ Save Changes** dabayein.

---

<!-- PAGE BREAK -->

## 4.17 Payroll

**Route:** `/payroll` · Sidebar: **People › Payroll**

### Ye page kis kaam ka hai

Har maheene ki **tankhwah ka hisab** — hazri ke hisab se banti hai, aur us mein se maheene ke dauran diye gaye **advance** kaat liye jate hain. Har staff ka apna card hota hai jis par attendance, calculated salary, advances aur **net salary** likhi hoti hai.

**Kaun access kar sakta hai:** ✅ Admin, Manager · ❌ Cashier, Kitchen

**[Screenshot: payroll]**

> **Hisab ke usool:**
> - **Sunday** chhutti hai — wo "working day" mein nahi ginta.
> - Tankhwah **hazir dinon ke tanasub** se banti hai, poori maheene ki nahi.
> - Maheene ke dauran diye gaye **advance** net salary se kaat liye jate hain.
>
> Tankhwah dene se pehle har staff ka **📅 Details** calendar dekh lein — usi se pata chalta hai ke ginti kaise bani.

### 4.17.1 Ooper ke controls aur cards

| # | Element | Type | Kya karta hai | Notes |
|---|---|---|---|---|
| 1 | Maheene ka dropdown | Dropdown | Kaunsa maheena dekhna hai | **Pichhle 6 maheene** dikhte hain. Default: mojooda maheena |
| 2 | **Staff on Payroll** | Stat card | Kitne active staff hain | Sirf **Active** staff ginte hain |
| 3 | **Avg Attendance** | Stat card | Ausatan hazri (%) | "Present / working days" |
| 4 | **Total Payroll** | Stat card | Kul tankhwah, advances kaatne ke baad | "Net, after advances" |
| 5 | Sabz tasdeeqi patti | Message | *"Payroll for ‹maheena› confirmed — total Rs. …"* | Save karne ke baad. Maheena badalne par gayab |

### 4.17.2 Staff ka payroll card

| # | Element | Kya batata hai |
|---|---|---|
| 1 | Naam + role + sunehri badge | Staff ka naam aur uski **base salary** |
| 2 | **Attendance ‹X›/‹Y› days** | Kitne din hazir raha / kitne working days thay, aur sabz patti (bar) |
| 3 | **Calculated** | Hazri ke hisab se banne wali tankhwah |
| 4 | **Advances** | Is maheene diye gaye advance (surkh mein, minus ke saath) |
| 5 | **Net salary** | Aakhri raqam jo deni hai (bara sunehri number) |
| 6 | **📅 Details** | Button — hazri ka calendar kholta hai (4.17.3) |
| 7 | **Edit** | Button — advance dalne ka box kholta hai (4.17.4) |

**Hisab ka formula:**

```
Calculated salary = (Base salary ÷ Working days) × Present days
Net salary        = Calculated salary − Total advances
```
*(Net kabhi minus nahi hota — kam se kam 0 rehta hai.)*

### 4.17.3 "Details" — hazri ka calendar

| # | Element | Type | Kya batata hai |
|---|---|---|---|
| 1 | Staff ka naam + role + maheena | Heading | — |
| 2 | Maheene ka calendar | Grid | Har din ka rang: 🟢 **sabz = Present** · 🔴 **surkh = Absent** · ⚪ **khaakistari = Day off (Sunday)** · dotted border = aane wala din |
| 3 | Rang ki wazahat (legend) | Legend | **Present (‹X›)**, **Absent (‹Y›)**, **Day off** |
| 4 | ✕ (close) | Icon | Box band (Escape se bhi) |

> Ye calendar **sirf dekhne ke liye** hai — yahan se kuch badla nahi ja sakta.

### 4.17.4 "Salary & Advances" ka box

| # | Element | Type | Kya karta hai | Validation / Notes |
|---|---|---|---|---|
| 1 | **Base salary (locked)** | Info | Bunyadi tankhwah | ⚠️ Yahan se badal nahi sakti — **Employees** page se badalti hai |
| 2 | **Present days** | Info | ‹hazir› / ‹working days› | — |
| 3 | **Calculated salary** | Info | Hazri ke hisab se tankhwah | — |
| 4 | **Advances this month** | List | Is maheene ke saare advance — raqam, tareekh aur wajah | Khali ho to: "No advances recorded this month." |
| 5 | **pending** / **recovered** | Badge | **pending** (amber) = abhi kaata nahi gaya · **recovered** (sabz) = kaat liya gaya | — |
| 6 | 🗑 (trash) | Icon button | Advance hata deta hai | ⚠️ Sirf **pending** advance hat sakta hai. Jo "recovered" ho gaya, wo nahi |
| 7 | **Amount** | Number input | Naya advance kitna | 0 se zyada |
| 8 | **Reason (optional)** | Text input | Wajah | Ikhtiyari |
| 9 | Sunehri hint | Note | *"This advance will be added when you press Done"* | ⚠️ **Koi alag "Add" button nahi hai.** Sirf tab dikhta hai jab amount likha ho |
| 10 | **Total advances** | Info | Kul advance (surkh, minus ke saath) | — |
| 11 | **Final salary** | Info | Aakhri raqam (bara sunehri) | — |
| 12 | **✓ Done** | Button | ⚠️ Likha hua advance darj karta hai **aur** is staff ke advances "recovered" kar deta hai, phir box band | — |
| 13 | ✕ (close) | Icon | Box band **bina** likha hua advance darj kiye | Escape se bhi |

> ⚠️ **Advance dalne ke do tareeqe:**
> - **Enter** dabayein — advance darj ho jata hai aur box **khula rehta hai**, taake aap aur advance daal sakein.
> - **Done** dabayein — likha hua advance darj hota hai aur box band ho jata hai.
>
> ⚠️ **Done sirf band nahi karta** — wo is staff ke tamam pending advances ko **"recovered"** bhi kar deta hai, yani "kaat liya gaya". Ye faisla wapas nahi hota (recovered advance delete nahi hota).

### 4.17.5 Neeche ka total aur confirm

| # | Element | Type | Kya karta hai | Notes |
|---|---|---|---|---|
| 1 | **Total payroll · ‹maheena›** | Figure | Kul dene wali raqam | — |
| 2 | **✓ Save & Confirm Payroll** | Button (gold) | ⚠️ **Poore maheene ke** tamam pending advances ko "recovered" kar deta hai | Sabz tasdeeqi patti aa jati hai. ⚠️ Ye button advances ko "kaat liya gaya" nishan lagata hai. Tankhwah ki **asal adaigi alag se Accounting** page par kharche ke taur par darj karein |

### Ye kaam kaise karein

**A. Kisi ko advance dena**

1. Maheena chunein (aam tor par mojooda).
2. Us staff ke card par **Edit** dabayein.
3. **Amount** aur (chahein to) **Reason** likhein.
4. Aur advance dena ho to **Enter** dabayein aur agla likhein.
5. **✓ Done** dabayein.
6. Card par **Advances** aur **Net salary** foran badal jayenge.

**B. Maheene ke aakhir mein tankhwah nikalna**

1. Maheene ka dropdown se sahi maheena chunein.
2. Har card par **Net salary** dekhein — yahi dene wali raqam hai.
3. Shak ho to **📅 Details** se us shaks ka hazri calendar dekh lein.
4. Sab theek ho to neeche **✓ Save & Confirm Payroll** dabayein.
5. Tankhwah ki asal adaigi **Accounting** page par kharche ke taur par darj karein.

**C. Ghalti se dala hua advance hatana**

1. Us staff ke card par **Edit** dabayein.
2. Us advance ki patti par 🗑 dabayein.
3. ⚠️ Agar us par **recovered** ka badge hai to hat nahi sakta — us surat mein Admin se rabta karein.

### Is page par aane wale error messages

| Error | Matlab | Hal |
|---|---|---|
| Advance dalte waqt surkh patti | Server ne raqam qubool nahi ki | Raqam check karein (0 se zyada honi chahiye) aur dobara koshish karein |
| **Cannot reach the server…** | Server se rabta toot gaya | Section 6 dekhein |

---
