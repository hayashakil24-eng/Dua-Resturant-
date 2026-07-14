// Data-value localisation (Urdu) for content that lives in mockData, not in the
// UI dictionaries — inventory/menu item names, categories and units. The real
// data is NOT modified; these maps translate values at display time and fall
// back to the original English when no translation exists (so nothing ever
// renders blank). Only applied on admin pages when the language is Urdu.

// Units ---------------------------------------------------------------------
export const UNIT_UR = {
  kg: 'کلوگرام',
  g: 'گرام',
  L: 'لیٹر',
  ml: 'ملی لیٹر',
  packs: 'پیکٹ',
  pcs: 'عدد',
  pieces: 'عدد',
}

// Categories (inventory + menu + accounting, keyed by their English value) ---
export const CATEGORY_UR = {
  // Inventory
  Grains: 'اناج',
  Pantry: 'پینٹری',
  Meat: 'گوشت',
  Vegetables: 'سبزیاں',
  Dairy: 'ڈیری',
  Beverages: 'مشروبات',
  // Menu
  Coladas: 'کولاڈا',
  Slush: 'سلش',
  'Fresh Juice': 'تازہ جوس',
  Shakes: 'شیک',
  Mocktails: 'ماک ٹیلز',
  'Ice Cream': 'آئس کریم',
  'Mutton Karahi': 'مٹن کڑاہی',
  'Chicken Karahi': 'چکن کڑاہی',
  Handi: 'ہانڈی',
  Pulao: 'پلاؤ',
  'BBQ Special': 'بی بی کیو اسپیشل',
  'Beef BBQ': 'بیف بی بی کیو',
  'Chicken BBQ': 'چکن بی بی کیو',
  'Chef Special': 'شیف اسپیشل',
  'Pakistani Cuisine': 'پاکستانی کھانے',
  Breads: 'روٹیاں',
  'Salads & Raita': 'سلاد و رائتہ',
  Starters: 'اسٹارٹرز',
  Soups: 'سوپ',
  'Kids Special': 'بچوں کا اسپیشل',
  Steaks: 'اسٹیکس',
  Pizza: 'پیزا',
  Seafood: 'سی فوڈ',
  Chinese: 'چائنیز',
  Rice: 'چاول',
  Pasta: 'پاستا',
  'Burgers & Sandwiches': 'برگر و سینڈوچ',
  Broast: 'بروسٹ',
  Rolls: 'رول',
  Special: 'خصوصی',
  // Accounting
  Sales: 'فروخت',
  Catering: 'کیٹرنگ',
  Other: 'دیگر',
  Rent: 'کرایہ',
  Utilities: 'یوٹیلیٹیز',
  Supplies: 'سامان',
  Gas: 'گیس',
  Maintenance: 'دیکھ بھال',
  Marketing: 'مارکیٹنگ',
}

// Item names ----------------------------------------------------------------
// Inventory (all 15) + the desi/Pakistani menu dishes. Western / brand items
// (Pina Colada, Oreo, KitKat, Pizza, Pasta, etc.) are intentionally left to
// fall back to English — that is how they read on a real Pakistani menu.
export const NAME_UR = {
  // Inventory
  'Flour (Atta)': 'آٹا',
  'Cooking Oil': 'کوکنگ آئل',
  Chicken: 'چکن',
  Mutton: 'مٹن',
  Beef: 'بیف',
  'Basmati Rice': 'باسمتی چاول',
  Tomatoes: 'ٹماٹر',
  Onions: 'پیاز',
  Yogurt: 'دہی',
  Milk: 'دودھ',
  'Tea Leaves': 'چائے کی پتی',
  Sugar: 'چینی',
  'Spice Mix': 'مسالہ مکس',
  'Soft Drinks': 'کولڈ ڈرنکس',
  'Mineral Water': 'منرل واٹر',

  // Menu — Karahi
  'Mutton Shahi Karahi': 'مٹن شاہی کڑاہی',
  'Mutton White Karahi': 'مٹن وائٹ کڑاہی',
  'Mutton Peshawari Karahi': 'مٹن پشاوری کڑاہی',
  'Mutton Sizzling Karahi': 'مٹن سزلنگ کڑاہی',
  'Lamb Peshawari Karahi': 'لیمب پشاوری کڑاہی',
  'Lamb White Karahi': 'لیمب وائٹ کڑاہی',
  'Lamb Brown Karahi': 'لیمب براؤن کڑاہی',
  'Mutton Brown Karahi': 'مٹن براؤن کڑاہی',
  'Mutton Namkee Bonles Karahi': 'مٹن نمکین بونلیس کڑاہی',
  'Desi Murga Karahi': 'دیسی مرغا کڑاہی',
  'Prawn Karahi Red/White': 'پراؤن کڑاہی ریڈ/وائٹ',
  'Batair Karahi': 'بٹیر کڑاہی',
  'Lamb Zaitoon Karahi': 'لیمب زیتون کڑاہی',
  'Mutton Zaitoon Karahi': 'مٹن زیتون کڑاہی',
  'Balochi Tikkah Karahi': 'بلوچی تکہ کڑاہی',
  'Chicken Shahi Karahi': 'چکن شاہی کڑاہی',
  'Chicken White Karahi': 'چکن وائٹ کڑاہی',
  'Chicken Boneless Karahi': 'چکن بونلیس کڑاہی',
  'Chicken Brown Karahi': 'چکن براؤن کڑاہی',
  'Chicken Peshawari Karahi': 'چکن پشاوری کڑاہی',
  'Chicken Zaitoon Karahi': 'چکن زیتون کڑاہی',

  // Handi
  'Mutton Shahi Handi Boneless': 'مٹن شاہی ہانڈی بونلیس',
  'Mutton Paneer Handi': 'مٹن پنیر ہانڈی',
  'Mutton Makhni Handi': 'مٹن مکھنی ہانڈی',
  'Chicken Shahi Handi': 'چکن شاہی ہانڈی',
  'Chicken Makhni Handi': 'چکن مکھنی ہانڈی',
  'Chicken Tikkah Handi': 'چکن تکہ ہانڈی',
  'Chicken Paneer Reshmi': 'چکن پنیر ریشمی',
  'Prawn Handi': 'پراؤن ہانڈی',

  // Pulao / rice desi
  'Mutton Pulao': 'مٹن پلاؤ',
  'Chicken Pulao': 'چکن پلاؤ',
  'Special Chicken Biryani Double': 'اسپیشل چکن بریانی ڈبل',
  'Special Chicken Biryani Single': 'اسپیشل چکن بریانی سنگل',

  // BBQ / desi grill
  'Mutton Chops': 'مٹن چاپس',
  'Mutton Ribbs': 'مٹن ربز',
  'Mutton Leg': 'مٹن ران',
  'Mutton Namkeen Boti': 'مٹن نمکین بوٹی',
  'Shahi Batair (6 Piece)': 'شاہی بٹیر (۶ عدد)',
  'Grilled Prawn': 'گرلڈ پراؤن',
  'Fish Grilled Namkin / Spicy': 'فش گرلڈ نمکین / اسپائسی',
  'Fish Boneless Boti': 'فش بونلیس بوٹی',
  'Lamb Namkin Boti': 'لیمب نمکین بوٹی',
  'Chicken Grilled Chargha': 'چکن گرلڈ چرغہ',
  'Afghani Seekh Boti (12 Piece)': 'افغانی سیخ بوٹی (۱۲ عدد)',
  'Beef Bihari Kabab': 'بیف بہاری کباب',
  'Beef Seekh Kabab': 'بیف سیخ کباب',
  'Beef Chullu Kabab': 'بیف چھلو کباب',
  'Chicken Arbic Boti': 'چکن عربک بوٹی',
  'Chicken Milali Boti': 'چکن ملائی بوٹی',
  'Chicken Behari Kabab': 'چکن بہاری کباب',
  'Chicken Spicy Boti': 'چکن اسپائسی بوٹی',
  'Chicken Tikkah Spicy': 'چکن تکہ اسپائسی',
  'Chicken Reshmi Kabab': 'چکن ریشمی کباب',
  'Chicken Balochi Boti': 'چکن بلوچی بوٹی',
  'Chicken Malai Tikkah': 'چکن ملائی تکہ',
  'Khaddi Kabab': 'کھڈی کباب',
  'Dum Pukht': 'دم پخت',
  'Lamb Namkeen Boneless Boti': 'لیمب نمکین بونلیس بوٹی',
  'Mutton Namkeen Boneless Boti': 'مٹن نمکین بونلیس بوٹی',

  // Chef special / platters
  'Cafe Ali Special Platter Full': 'کیفے علی اسپیشل پلیٹر فل',
  'Cafe Ali Special Platter Half': 'کیفے علی اسپیشل پلیٹر ہاف',
  'Chicken Platter Full': 'چکن پلیٹر فل',
  'Chicken Platter Half': 'چکن پلیٹر ہاف',
  'Namkeen Rosh (Lamb / Mutton)': 'نمکین روش (لیمب / مٹن)',
  'Mutton Joint': 'مٹن جوائنٹ',
  'Mutton Fry': 'مٹن فرائی',
  'Mutton Queema': 'مٹن قیمہ',

  // Pakistani cuisine / daal / veg
  'Daal Mash Fry': 'دال ماش فرائی',
  'Daal Chana Fry': 'دال چنا فرائی',
  'Anda Chana': 'انڈا چنا',
  'Mix Vegetable': 'مکس سبزی',
  'Vegetable Handi': 'سبزی ہانڈی',
  'Dall Makhni': 'دال مکھنی',
  'Chicken Lacha': 'چکن لچھا',
  Katakat: 'کٹاکٹ',
  'Brain Masala': 'مغز مسالہ',

  // Breads
  'Plain Naan': 'سادہ نان',
  'Garlic Naan': 'گارلک نان',
  'Tandoori Paratha': 'تندوری پراٹھا',
  'Roghni Naan': 'روغنی نان',
  'Kandhari Naan': 'قندھاری نان',
  'Farmaishi Chapati': 'فرمائشی چپاتی',

  // Salads & raita
  'Rassian Salad': 'رشین سلاد',
  'Fresh Green Salad': 'تازہ گرین سلاد',
  'Zeera Raita Special': 'زیرہ رائتہ اسپیشل',

  // Rice (chinese/continental)
  'Singaporian Rice': 'سنگاپوری چاول',
  'Chicken Fried Rice': 'چکن فرائیڈ رائس',
  'Egg Fried Rice': 'ایگ فرائیڈ رائس',
  'Vegetable Fried Rice': 'ویجیٹیبل فرائیڈ رائس',
  'Garlic Fried Rice': 'گارلک فرائیڈ رائس',
  'Plain Rice': 'سادہ چاول',
}

// Helpers -------------------------------------------------------------------
const pick = (map, value, lang) =>
  lang === 'ur' && value != null && map[value] ? map[value] : value

export const unitLabel = (unit, lang) => pick(UNIT_UR, unit, lang)
export const categoryLabel = (cat, lang) => pick(CATEGORY_UR, cat, lang)
export const itemNameLabel = (name, lang) => pick(NAME_UR, name, lang)
