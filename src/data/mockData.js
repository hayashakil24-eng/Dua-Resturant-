// ---------------------------------------------------------------------------
// Dua Restaurant — mock data (frontend only, no backend)
// ---------------------------------------------------------------------------

export const ROLES = ['Admin', 'Manager', 'Cashier']

export const STAFF = [
  { id: 'S01', name: 'Ali Raza', role: 'Manager', shift: 'Morning', phone: '0300-1122334', baseSalary: 60000 },
  { id: 'S02', name: 'Hamza Khan', role: 'Cashier', shift: 'Morning', phone: '0301-2233445', baseSalary: 38000 },
  { id: 'S03', name: 'Bilal Ahmed', role: 'Waiter', shift: 'Evening', phone: '0302-3344556', baseSalary: 28000 },
  { id: 'S04', name: 'Usman Tariq', role: 'Waiter', shift: 'Morning', phone: '0303-4455667', baseSalary: 28000 },
  { id: 'S05', name: 'Zain Malik', role: 'Waiter', shift: 'Evening', phone: '0304-5566778', baseSalary: 27000 },
  { id: 'S06', name: 'Fahad Iqbal', role: 'Chef', shift: 'Morning', phone: '0305-6677889', baseSalary: 55000 },
  { id: 'S07', name: 'Saad Nawaz', role: 'Waiter', shift: 'Evening', phone: '0306-7788990', baseSalary: 26000 },
  { id: 'S08', name: 'Kamran Shah', role: 'Cashier', shift: 'Evening', phone: '0307-8899001', baseSalary: 36000 },
]

export const WAITERS = STAFF.filter((s) => s.role === 'Waiter')

export const TABLES = Array.from({ length: 12 }, (_, i) => ({
  id: i + 1,
  seats: [2, 4, 6][i % 3],
}))

// Ordered category list for the Café Ali menu (POS prepends "All").
export const MENU_CATEGORIES = [
  'Coladas',
  'Slush',
  'Fresh Juice',
  'Shakes',
  'Mocktails',
  'Ice Cream',
  'Mutton Karahi',
  'Chicken Karahi',
  'Handi',
  'Pulao',
  'BBQ Special',
  'Beef BBQ',
  'Chicken BBQ',
  'Chef Special',
  'Pakistani Cuisine',
  'Breads',
  'Salads & Raita',
  'Starters',
  'Soups',
  'Kids Special',
  'Steaks',
  'Pizza',
  'Seafood',
  'Chinese',
  'Rice',
  'Pasta',
  'Burgers & Sandwiches',
  'Broast',
  'Rolls',
]

// ---------------------------------------------------------------------------
// Café Ali full menu. Items with size/type options carry a `variants` array;
// `price` is the default (from) price. Managed live via Menu Management and
// consumed by the POS. A few dishes reuse existing local images.
// ---------------------------------------------------------------------------
export const INITIAL_MENU = [
  // Coladas — Rs. 550
  { id: 'cd1', name: 'Pina Colada', category: 'Coladas', price: 550, image: '/Pina Colada.jfif', active: true },
  { id: 'cd2', name: 'Strawberry Colada', category: 'Coladas', price: 550, image: '/Strawberry Colada.jfif', active: true },
  { id: 'cd3', name: 'Blue Colada', category: 'Coladas', price: 550, image: '/Blue Colada.jfif', active: true },
  { id: 'cd4', name: 'Tropical Colada', category: 'Coladas', price: 550, image: '/Tropical Colada.jpg', active: true },

  // Slush — Rs. 350
  { id: 'sl1', name: 'Blueberry Slush', category: 'Slush', price: 350, image: '/Blueberry Slush.jfif', active: true },
  { id: 'sl2', name: 'Mint Slush', category: 'Slush', price: 350, image: '/Mint Slush.jfif', active: true },
  { id: 'sl3', name: 'Mango Slush', category: 'Slush', price: 350, image: '/Mango Slush.jfif', active: true },
  { id: 'sl4', name: 'Falsa Slush', category: 'Slush', price: 350, image: '/Falsa Slush.jfif', active: true },
  { id: 'sl5', name: 'Peach Slush', category: 'Slush', price: 350, image: '/Peach Slush.jfif', active: true },
  { id: 'sl6', name: 'Lemon Slush', category: 'Slush', price: 350, active: true },

  // Fresh Juice — Rs. 350
  { id: 'jc1', name: 'Apple Juice', category: 'Fresh Juice', price: 350, active: true },
  { id: 'jc2', name: 'Seasonal Juice', category: 'Fresh Juice', price: 350, active: true },

  // Shakes — Rs. 550
  { id: 'sk1', name: 'Icecream Shake', category: 'Shakes', price: 550, active: true },
  { id: 'sk2', name: 'Icecream Vanilla Shake', category: 'Shakes', price: 550, active: true },
  { id: 'sk3', name: 'Icecream Chocolate Shake', category: 'Shakes', price: 550, active: true },
  { id: 'sk4', name: 'Icecream Strawberry Shake', category: 'Shakes', price: 550, active: true },
  { id: 'sk5', name: 'Icecream Kitkat Shake', category: 'Shakes', price: 550, active: true },
  { id: 'sk6', name: 'Icecream Oreo Shake', category: 'Shakes', price: 550, active: true },
  { id: 'sk7', name: 'Banana Milk Shake', category: 'Shakes', price: 550, active: true },
  { id: 'sk8', name: 'Mango Milk Shake', category: 'Shakes', price: 550, active: true },
  { id: 'sk9', name: 'Dates Milk Shake', category: 'Shakes', price: 550, active: true },

  // Mocktails — Rs. 550
  { id: 'mk1', name: 'Pink Lady', category: 'Mocktails', price: 550, active: true },
  { id: 'mk2', name: 'Angle Mist', category: 'Mocktails', price: 550, active: true },
  { id: 'mk3', name: 'Strawberry Burst', category: 'Mocktails', price: 550, active: true },
  { id: 'mk4', name: 'Apple Mint', category: 'Mocktails', price: 550, active: true },
  { id: 'mk5', name: 'Blushing Berry', category: 'Mocktails', price: 550, active: true },
  { id: 'mk6', name: 'Punching Fruit', category: 'Mocktails', price: 550, active: true },
  { id: 'mk7', name: 'Flavour Lassi', category: 'Mocktails', price: 550, active: true },

  // Ice Cream
  { id: 'ic1', name: 'Two Scoops', category: 'Ice Cream', price: 350, image: '/ice cream.jfif', active: true },
  { id: 'ic2', name: 'Single Scoop', category: 'Ice Cream', price: 180, image: '/ice cream.jfif', active: true },
  { id: 'ic3', name: 'Single Scoop Premium', category: 'Ice Cream', price: 1200, active: true },
  { id: 'ic4', name: 'Special Faluda', category: 'Ice Cream', price: 500, active: true },

  // Mutton Karahi (per kg)
  { id: 'mkh1', name: 'Mutton Shahi Karahi', category: 'Mutton Karahi', price: 4999, active: true },
  { id: 'mkh2', name: 'Mutton White Karahi', category: 'Mutton Karahi', price: 5199, active: true },
  { id: 'mkh3', name: 'Mutton Peshawari Karahi', category: 'Mutton Karahi', price: 4999, active: true },
  { id: 'mkh4', name: 'Mutton Sizzling Karahi', category: 'Mutton Karahi', price: 4999, active: true },
  { id: 'mkh5', name: 'Lamb Peshawari Karahi', category: 'Mutton Karahi', price: 5499, active: true },
  { id: 'mkh6', name: 'Lamb White Karahi', category: 'Mutton Karahi', price: 5699, active: true },
  { id: 'mkh7', name: 'Lamb Brown Karahi', category: 'Mutton Karahi', price: 4999, active: true },
  { id: 'mkh8', name: 'Mutton Brown Karahi', category: 'Mutton Karahi', price: 4999, active: true },
  { id: 'mkh9', name: 'Mutton Namkee Bonles Karahi', category: 'Mutton Karahi', price: 6799, active: true },
  { id: 'mkh10', name: 'Desi Murga Karahi', category: 'Mutton Karahi', price: 4999, active: true },
  { id: 'mkh11', name: 'Prawn Karahi Red/White', category: 'Mutton Karahi', price: 4699, active: true },
  { id: 'mkh12', name: 'Batair Karahi', category: 'Mutton Karahi', price: 3699, active: true },
  { id: 'mkh13', name: 'Lamb Zaitoon Karahi', category: 'Mutton Karahi', price: 5660, active: true },
  { id: 'mkh14', name: 'Mutton Zaitoon Karahi', category: 'Mutton Karahi', price: 5560, active: true },
  { id: 'mkh15', name: 'Balochi Tikkah Karahi', category: 'Mutton Karahi', price: 2549, active: true },

  // Chicken Karahi
  { id: 'ckh1', name: 'Chicken Shahi Karahi', category: 'Chicken Karahi', price: 2699, image: '/chicken karahi.jfif', active: true },
  { id: 'ckh2', name: 'Chicken White Karahi', category: 'Chicken Karahi', price: 2699, active: true },
  { id: 'ckh3', name: 'Chicken Boneless Karahi', category: 'Chicken Karahi', price: 3799, active: true },
  { id: 'ckh4', name: 'Chicken Brown Karahi', category: 'Chicken Karahi', price: 2699, active: true },
  { id: 'ckh5', name: 'Chicken Peshawari Karahi', category: 'Chicken Karahi', price: 2699, active: true },
  { id: 'ckh6', name: 'Chicken Zaitoon Karahi', category: 'Chicken Karahi', price: 2799, active: true },

  // Handi (per kg)
  { id: 'hd1', name: 'Mutton Shahi Handi Boneless', category: 'Handi', price: 7400, active: true },
  { id: 'hd2', name: 'Mutton Paneer Handi', category: 'Handi', price: 7560, active: true },
  { id: 'hd3', name: 'Mutton Makhni Handi', category: 'Handi', price: 7399, active: true },
  { id: 'hd4', name: 'Chicken Shahi Handi', category: 'Handi', price: 3299, active: true },
  { id: 'hd5', name: 'Chicken Makhni Handi', category: 'Handi', price: 3199, active: true },
  { id: 'hd6', name: 'Chicken Tikkah Handi', category: 'Handi', price: 3299, active: true },
  { id: 'hd7', name: 'Chicken Paneer Reshmi', category: 'Handi', price: 3299, active: true },
  { id: 'hd8', name: 'Prawn Handi', category: 'Handi', price: 5999, active: true },

  // Pulao
  { id: 'pl1', name: 'Mutton Pulao', category: 'Pulao', price: 1599, active: true },
  { id: 'pl2', name: 'Chicken Pulao', category: 'Pulao', price: 740, active: true },

  // BBQ Special
  { id: 'bbq1', name: 'Mutton Chops', category: 'BBQ Special', price: 4999, active: true },
  { id: 'bbq2', name: 'Mutton Ribbs', category: 'BBQ Special', price: 4999, image: '/ribs.jfif', active: true },
  { id: 'bbq3', name: 'Mutton Leg', category: 'BBQ Special', price: 4999, active: true },
  { id: 'bbq4', name: 'Mutton Namkeen Boti', category: 'BBQ Special', price: 4999, active: true },
  { id: 'bbq5', name: 'Shahi Batair (6 Piece)', category: 'BBQ Special', price: 1499, active: true },
  { id: 'bbq6', name: 'Grilled Prawn', category: 'BBQ Special', price: 6450, active: true },
  { id: 'bbq7', name: 'Fish Grilled Namkin / Spicy', category: 'BBQ Special', price: 3260, active: true },
  { id: 'bbq8', name: 'Fish Boneless Boti', category: 'BBQ Special', price: 1299, active: true },
  { id: 'bbq9', name: 'Lamb Namkin Boti', category: 'BBQ Special', price: 4999, active: true },
  { id: 'bbq10', name: 'Chicken Grilled Chargha', category: 'BBQ Special', price: 2699, active: true },

  // Beef BBQ
  { id: 'bbf1', name: 'Afghani Seekh Boti (12 Piece)', category: 'Beef BBQ', price: 2149, active: true },
  { id: 'bbf2', name: 'Beef Bihari Kabab', category: 'Beef BBQ', price: 1199, active: true },
  { id: 'bbf3', name: 'Beef Seekh Kabab', category: 'Beef BBQ', price: 999, image: '/seekh-kabab.jfif', active: true },
  { id: 'bbf4', name: 'Beef Chullu Kabab', category: 'Beef BBQ', price: 1449, active: true },

  // Chicken BBQ
  { id: 'cbq1', name: 'Chicken Arbic Boti', category: 'Chicken BBQ', price: 2599, active: true },
  { id: 'cbq2', name: 'Chicken Milali Boti', category: 'Chicken BBQ', price: 1099, image: '/chicken-malai-boti.jfif', active: true },
  { id: 'cbq3', name: 'Chicken Behari Kabab', category: 'Chicken BBQ', price: 1049, active: true },
  { id: 'cbq4', name: 'Chicken Spicy Boti', category: 'Chicken BBQ', price: 1049, active: true },
  { id: 'cbq5', name: 'Chicken Tikkah Spicy', category: 'Chicken BBQ', price: 660, active: true },
  { id: 'cbq6', name: 'Chicken Reshmi Kabab', category: 'Chicken BBQ', price: 699, active: true },
  { id: 'cbq7', name: 'Chicken Balochi Boti', category: 'Chicken BBQ', price: 1049, active: true },
  { id: 'cbq8', name: 'Chicken Malai Tikkah', category: 'Chicken BBQ', price: 699, active: true },

  // Chef Special
  { id: 'cs1', name: 'Khaddi Kabab', category: 'Chef Special', price: 4999, active: true },
  { id: 'cs2', name: 'Dum Pukht', category: 'Chef Special', price: 4999, active: true },
  { id: 'cs3', name: 'Lamb Namkeen Boneless Boti', category: 'Chef Special', price: 7499, active: true },
  { id: 'cs4', name: 'Mutton Namkeen Boneless Boti', category: 'Chef Special', price: 7499, active: true },
  { id: 'cs5', name: 'Café Ali Special Platter Full', category: 'Chef Special', price: 11999, active: true },
  { id: 'cs6', name: 'Café Ali Special Platter Half', category: 'Chef Special', price: 6200, active: true },
  { id: 'cs7', name: 'Chicken Platter Full', category: 'Chef Special', price: 7500, active: true },
  { id: 'cs8', name: 'Chicken Platter Half', category: 'Chef Special', price: 3800, active: true },

  // Pakistani Cuisine
  { id: 'pk1', name: 'Namkeen Rosh (Lamb / Mutton)', category: 'Pakistani Cuisine', price: 1799, active: true },
  { id: 'pk2', name: 'Mutton Joint', category: 'Pakistani Cuisine', price: 1999, active: true },
  { id: 'pk3', name: 'Mutton Fry', category: 'Pakistani Cuisine', price: 999, active: true },
  { id: 'pk4', name: 'Mutton Queema', category: 'Pakistani Cuisine', price: 1299, active: true },
  { id: 'pk5', name: 'Special Chicken Biryani Double', category: 'Pakistani Cuisine', price: 700, image: '/briyani picture.jpg', active: true },
  { id: 'pk6', name: 'Special Chicken Biryani Single', category: 'Pakistani Cuisine', price: 400, image: '/briyani picture.jpg', active: true },
  { id: 'pk7', name: 'Daal Mash Fry', category: 'Pakistani Cuisine', price: 499, active: true },
  { id: 'pk8', name: 'Daal Chana Fry', category: 'Pakistani Cuisine', price: 450, active: true },
  { id: 'pk9', name: 'Anda Chana', category: 'Pakistani Cuisine', price: 449, active: true },
  { id: 'pk10', name: 'Mix Vegetable', category: 'Pakistani Cuisine', price: 599, active: true },
  { id: 'pk11', name: 'Vegetable Handi', category: 'Pakistani Cuisine', price: 849, active: true },
  { id: 'pk12', name: 'Dall Makhni', category: 'Pakistani Cuisine', price: 849, image: '/Daal-makhni.jfif', active: true },
  { id: 'pk13', name: 'Chicken Lacha', category: 'Pakistani Cuisine', price: 1199, active: true },
  { id: 'pk14', name: 'Katakat', category: 'Pakistani Cuisine', price: 1499, active: true },
  { id: 'pk15', name: 'Brain Masala', category: 'Pakistani Cuisine', price: 1199, active: true },

  // Breads
  { id: 'br1', name: 'Plain Naan', category: 'Breads', price: 80, active: true },
  { id: 'br2', name: 'Garlic Naan', category: 'Breads', price: 150, image: '/naan.jfif', active: true },
  { id: 'br3', name: 'Tandoori Paratha', category: 'Breads', price: 160, active: true },
  { id: 'br4', name: 'Roghni Naan', category: 'Breads', price: 150, active: true },
  { id: 'br5', name: 'Kandhari Naan', category: 'Breads', price: 180, active: true },
  { id: 'br6', name: 'Farmaishi Chapati', category: 'Breads', price: 70, active: true },

  // Salads & Raita
  { id: 'sd1', name: 'Rassian Salad', category: 'Salads & Raita', price: 649, active: true },
  { id: 'sd2', name: 'Fresh Green Salad', category: 'Salads & Raita', price: 199, active: true },
  { id: 'sd3', name: 'Zeera Raita Special', category: 'Salads & Raita', price: 249, active: true },

  // Starters
  { id: 'st1', name: 'Dynamite Chicken', category: 'Starters', price: 1050, active: true },
  { id: 'st2', name: 'Dynamite Prawn', category: 'Starters', price: 1299, active: true },
  { id: 'st3', name: 'Chicken Strip', category: 'Starters', price: 1050, active: true },
  { id: 'st4', name: 'Dhaka Chicken', category: 'Starters', price: 1190, active: true },
  { id: 'st5', name: 'Buffalo Wings', category: 'Starters', price: 999, active: true },
  { id: 'st6', name: 'Peri Chilli Bites', category: 'Starters', price: 850, active: true },
  { id: 'st7', name: 'Finger Fish', category: 'Starters', price: 1399, active: true },
  { id: 'st8', name: 'Dhaka Fish', category: 'Starters', price: 1299, active: true },
  { id: 'st9', name: 'Crispy Fried Prawn', category: 'Starters', price: 1299, active: true },
  { id: 'st10', name: 'Cafe Ali Starters Platter', category: 'Starters', price: 2499, active: true },

  // Soups
  { id: 'sp1', name: 'Chicken Corn Soup', category: 'Soups', price: 499, image: '/Soups.jfif', active: true },
  { id: 'sp2', name: 'Hot & Sour Soup Red / White', category: 'Soups', price: 499, active: true },
  { id: 'sp3', name: 'Creamy Mushroom Soup', category: 'Soups', price: 599, active: true },
  { id: 'sp4', name: 'Chicken Corn Soup Family Bowl', category: 'Soups', price: 890, active: true },
  { id: 'sp5', name: 'Hot & Sour Soup Family Bowl', category: 'Soups', price: 890, active: true },

  // Kids Special
  { id: 'kd1', name: 'Cheese Fries', category: 'Kids Special', price: 649, active: true },
  { id: 'kd2', name: 'French Fries', category: 'Kids Special', price: 345, image: '/Fries.jpeg', active: true },
  { id: 'kd3', name: 'Creamy Macorni', category: 'Kids Special', price: 799, active: true },
  { id: 'kd4', name: 'Kids Fish & Fries', category: 'Kids Special', price: 1049, active: true },
  { id: 'kd5', name: 'FIRE Fries', category: 'Kids Special', price: 550, active: true },
  { id: 'kd6', name: 'Crunchi Chicken', category: 'Kids Special', price: 850, active: true },

  // Steaks (Beef / Chicken)
  { id: 'stk1', name: 'Mushroom Steak', category: 'Steaks', price: 1900, active: true,
    variants: [{ label: 'Beef', price: 2399 }, { label: 'Chicken', price: 1900 }] },
  { id: 'stk2', name: 'Morracan Steak', category: 'Steaks', price: 1900, active: true,
    variants: [{ label: 'Beef', price: 2399 }, { label: 'Chicken', price: 1900 }] },
  { id: 'stk3', name: 'Tarragon Steak', category: 'Steaks', price: 1900, active: true,
    variants: [{ label: 'Beef', price: 2399 }, { label: 'Chicken', price: 1900 }] },
  { id: 'stk4', name: 'Mexicen Steak', category: 'Steaks', price: 1900, active: true,
    variants: [{ label: 'Beef', price: 2399 }, { label: 'Chicken', price: 1900 }] },

  // Pizza (Small / Medium / Large)
  { id: 'pz1', name: 'Chicken Tikka Pizza', category: 'Pizza', price: 699, active: true,
    variants: [{ label: 'Small', price: 699 }, { label: 'Medium', price: 1190 }, { label: 'Large', price: 1499 }] },
  { id: 'pz2', name: 'Chicken Malai Boti Pizza', category: 'Pizza', price: 699, active: true,
    variants: [{ label: 'Small', price: 699 }, { label: 'Medium', price: 1190 }, { label: 'Large', price: 1499 }] },
  { id: 'pz3', name: 'Chicken Fajita Pizza', category: 'Pizza', price: 699, active: true,
    variants: [{ label: 'Small', price: 699 }, { label: 'Medium', price: 1190 }, { label: 'Large', price: 1499 }] },
  { id: 'pz4', name: 'Chicken Pepperoni Pizza', category: 'Pizza', price: 699, active: true,
    variants: [{ label: 'Small', price: 699 }, { label: 'Medium', price: 1190 }, { label: 'Large', price: 1499 }] },
  { id: 'pz5', name: 'Vegetable Pizza', category: 'Pizza', price: 500, active: true,
    variants: [{ label: 'Small', price: 500 }, { label: 'Medium', price: 650 }, { label: 'Large', price: 1050 }] },

  // Seafood
  { id: 'sf1', name: 'Canton Whole Fish', category: 'Seafood', price: 2999, active: true },
  { id: 'sf2', name: 'Garlic & Pepper Fish', category: 'Seafood', price: 2149, active: true },
  { id: 'sf3', name: 'Mexicen Fish', category: 'Seafood', price: 2149, active: true },
  { id: 'sf4', name: 'Lemon Butter Fish', category: 'Seafood', price: 2299, active: true },

  // Chinese
  { id: 'ch1', name: 'Chicken Shashlik with Rice', category: 'Chinese', price: 1099, active: true },
  { id: 'ch2', name: 'Chicken Jalfrezi with Rice', category: 'Chinese', price: 1149, active: true },
  { id: 'ch3', name: 'Chicken Chilli Dry', category: 'Chinese', price: 1098, active: true },
  { id: 'ch4', name: 'Chicken Manchurian Red / White', category: 'Chinese', price: 1099, active: true },
  { id: 'ch5', name: 'Cashew Nut Chicken', category: 'Chinese', price: 1349, active: true },
  { id: 'ch6', name: 'Dragon Chicken', category: 'Chinese', price: 1099, active: true },
  { id: 'ch7', name: 'Chicken Chowmin', category: 'Chinese', price: 1099, active: true },
  { id: 'ch8', name: 'Vegetable Chowmin', category: 'Chinese', price: 899, active: true },
  { id: 'ch9', name: 'Kung Pao Chicken', category: 'Chinese', price: 1099, active: true },
  { id: 'ch10', name: 'Beef Chilli Dry', category: 'Chinese', price: 1299, active: true },

  // Rice
  { id: 'rc1', name: 'Singaporian Rice', category: 'Rice', price: 1099, active: true },
  { id: 'rc2', name: 'Chicken Fried Rice', category: 'Rice', price: 850, active: true },
  { id: 'rc3', name: 'Egg Fried Rice', category: 'Rice', price: 595, active: true },
  { id: 'rc4', name: 'Vegetable Fried Rice', category: 'Rice', price: 490, active: true },
  { id: 'rc5', name: 'Garlic Fried Rice', category: 'Rice', price: 450, active: true },
  { id: 'rc6', name: 'Plain Rice', category: 'Rice', price: 300, active: true },

  // Pasta
  { id: 'pa1', name: 'Fettuccini Al Fredo Pasta', category: 'Pasta', price: 1299, active: true },
  { id: 'pa2', name: 'Penne Arrabbiata', category: 'Pasta', price: 1399, active: true },
  { id: 'pa3', name: 'Spinach & Mozzarella Pasta', category: 'Pasta', price: 1399, active: true },
  { id: 'pa4', name: 'Penne Al Fredo', category: 'Pasta', price: 1399, active: true },

  // Burgers & Sandwiches
  { id: 'bg1', name: 'Zinger Burger with Cheese', category: 'Burgers & Sandwiches', price: 1050, active: true },
  { id: 'bg2', name: 'Chicken Burger with Cheese', category: 'Burgers & Sandwiches', price: 1050, active: true },
  { id: 'bg3', name: 'Supreme Beef Burger With Cheese', category: 'Burgers & Sandwiches', price: 1150, active: true },
  { id: 'bg4', name: 'Special Club Sandwich', category: 'Burgers & Sandwiches', price: 950, active: true },
  { id: 'bg5', name: 'Chicken Malai Club Sandwich', category: 'Burgers & Sandwiches', price: 1299, active: true },

  // Broast
  { id: 'bo1', name: 'Broast Quarter (Leg/Chest)', category: 'Broast', price: 799, active: true },
  { id: 'bo2', name: 'Broast Half (Leg/Chest)', category: 'Broast', price: 1299, active: true },

  // Rolls
  { id: 'rl1', name: 'Chicken Cheesy Roll', category: 'Rolls', price: 395, active: true },
  { id: 'rl2', name: 'Mayo Garlic Roll', category: 'Rolls', price: 349, active: true },
  { id: 'rl3', name: 'Zinger Cheesy Roll', category: 'Rolls', price: 399, active: true },
  { id: 'rl4', name: 'Vegetable Roll', category: 'Rolls', price: 249, active: true },
]

// ---------------------------------------------------------------------------
// Kitchen inventory — stock levels for low-stock alerts (frontend only)
//   low stock  => stock <= threshold
// ---------------------------------------------------------------------------
export const INVENTORY = [
  { id: 'INV01', name: 'Flour (Atta)', category: 'Grains', stock: 2, unit: 'kg', threshold: 10 },
  { id: 'INV02', name: 'Cooking Oil', category: 'Pantry', stock: 1, unit: 'L', threshold: 8 },
  { id: 'INV03', name: 'Chicken', category: 'Meat', stock: 3, unit: 'kg', threshold: 12 },
  { id: 'INV04', name: 'Mutton', category: 'Meat', stock: 18, unit: 'kg', threshold: 10 },
  { id: 'INV05', name: 'Beef', category: 'Meat', stock: 22, unit: 'kg', threshold: 10 },
  { id: 'INV06', name: 'Basmati Rice', category: 'Grains', stock: 40, unit: 'kg', threshold: 15 },
  { id: 'INV07', name: 'Tomatoes', category: 'Vegetables', stock: 6, unit: 'kg', threshold: 8 },
  { id: 'INV08', name: 'Onions', category: 'Vegetables', stock: 30, unit: 'kg', threshold: 10 },
  { id: 'INV09', name: 'Yogurt', category: 'Dairy', stock: 9, unit: 'L', threshold: 6 },
  { id: 'INV10', name: 'Milk', category: 'Dairy', stock: 4, unit: 'L', threshold: 10 },
  { id: 'INV11', name: 'Tea Leaves', category: 'Beverages', stock: 3, unit: 'kg', threshold: 5 },
  { id: 'INV12', name: 'Sugar', category: 'Pantry', stock: 25, unit: 'kg', threshold: 10 },
  { id: 'INV13', name: 'Spice Mix', category: 'Pantry', stock: 14, unit: 'packs', threshold: 5 },
  { id: 'INV14', name: 'Soft Drinks', category: 'Beverages', stock: 18, unit: 'pcs', threshold: 20 },
  { id: 'INV15', name: 'Mineral Water', category: 'Beverages', stock: 40, unit: 'pcs', threshold: 24 },
]

// ---------------------------------------------------------------------------
// Recipe map — approximate ingredient usage per one unit of a menu item.
// Ingredient names match INVENTORY above, so Reports can estimate stock used
// from the day's/month's orders. Frontend estimate only (no auto-deduction).
// ---------------------------------------------------------------------------
export const RECIPE_MAP = {
  M01: [{ name: 'Chicken', qty: 0.25, unit: 'kg' }],
  M02: [{ name: 'Beef', qty: 0.2, unit: 'kg' }],
  M03: [{ name: 'Beef', qty: 0.4, unit: 'kg' }],
  M04: [
    { name: 'Chicken', qty: 0.5, unit: 'kg' },
    { name: 'Tomatoes', qty: 0.15, unit: 'kg' },
    { name: 'Onions', qty: 0.1, unit: 'kg' },
  ],
  M05: [
    { name: 'Basmati Rice', qty: 0.2, unit: 'kg' },
    { name: 'Mutton', qty: 0.2, unit: 'kg' },
  ],
  M06: [
    { name: 'Chicken', qty: 0.35, unit: 'kg' },
    { name: 'Yogurt', qty: 0.05, unit: 'L' },
  ],
  M07: [{ name: 'Onions', qty: 0.05, unit: 'kg' }],
  M08: [
    { name: 'Chicken', qty: 0.05, unit: 'kg' },
    { name: 'Flour (Atta)', qty: 0.05, unit: 'kg' },
  ],
  M09: [{ name: 'Cooking Oil', qty: 0.1, unit: 'L' }],
  M10: [{ name: 'Chicken', qty: 0.1, unit: 'kg' }],
  M11: [{ name: 'Flour (Atta)', qty: 0.12, unit: 'kg' }],
  M12: [{ name: 'Sugar', qty: 0.02, unit: 'kg' }],
  M13: [
    { name: 'Milk', qty: 0.15, unit: 'L' },
    { name: 'Tea Leaves', qty: 0.01, unit: 'kg' },
    { name: 'Sugar', qty: 0.02, unit: 'kg' },
  ],
  M14: [{ name: 'Soft Drinks', qty: 1, unit: 'pcs' }],
  M15: [{ name: 'Mineral Water', qty: 1, unit: 'pcs' }],
  M16: [
    { name: 'Sugar', qty: 0.05, unit: 'kg' },
    { name: 'Milk', qty: 0.05, unit: 'L' },
  ],
  M17: [
    { name: 'Milk', qty: 0.2, unit: 'L' },
    { name: 'Sugar', qty: 0.05, unit: 'kg' },
    { name: 'Basmati Rice', qty: 0.03, unit: 'kg' },
  ],
  M18: [
    { name: 'Milk', qty: 0.1, unit: 'L' },
    { name: 'Sugar', qty: 0.03, unit: 'kg' },
  ],
}

const today = new Date()
const t = (h, m) => {
  const d = new Date(today)
  d.setHours(h, m, 0, 0)
  return d.toISOString()
}

export const INITIAL_ORDERS = [
  {
    id: 'ORD-1041',
    table: 5,
    waiter: 'Bilal Ahmed',
    items: [
      { id: 'M04', name: 'Chicken Karahi', price: 1650, qty: 1 },
      { id: 'M11', name: 'Garlic Naan', price: 90, qty: 4 },
      { id: 'M13', name: 'Kashmiri Chai', price: 300, qty: 2 },
    ],
    payment: 'Paid',
    method: 'Card',
    kitchen: 'Ready',
    createdAt: t(12, 15),
  },
  {
    id: 'ORD-1042',
    table: 2,
    waiter: 'Usman Tariq',
    items: [
      { id: 'M05', name: 'Mutton Biryani', price: 950, qty: 2 },
      { id: 'M12', name: 'Fresh Lime', price: 250, qty: 2 },
    ],
    payment: 'Unpaid',
    method: '—',
    kitchen: 'Pending',
    createdAt: t(13, 5),
  },
  {
    id: 'ORD-1043',
    table: 8,
    waiter: 'Zain Malik',
    items: [
      { id: 'M01', name: 'Chicken Malai Boti', price: 850, qty: 2 },
      { id: 'M02', name: 'Seekh Kebab', price: 650, qty: 1 },
      { id: 'M09', name: 'Fries', price: 350, qty: 1 },
      { id: 'M14', name: 'Soft Drink', price: 150, qty: 3 },
    ],
    payment: 'Paid',
    method: 'Cash',
    kitchen: 'Pending',
    createdAt: t(13, 40),
  },
  {
    id: 'ORD-1044',
    table: 11,
    waiter: 'Saad Nawaz',
    items: [
      { id: 'M06', name: 'Butter Chicken', price: 1250, qty: 1 },
      { id: 'M11', name: 'Garlic Naan', price: 90, qty: 3 },
      { id: 'M16', name: 'Gulab Jamun', price: 320, qty: 2 },
    ],
    payment: 'Paid',
    method: 'Card',
    kitchen: 'Ready',
    createdAt: t(14, 20),
  },
  {
    id: 'ORD-1045',
    table: 3,
    waiter: 'Bilal Ahmed',
    items: [
      { id: 'M03', name: 'Beef Ribs', price: 1450, qty: 1 },
      { id: 'M15', name: 'Mineral Water', price: 80, qty: 2 },
    ],
    payment: 'Unpaid',
    method: '—',
    kitchen: 'Pending',
    createdAt: t(14, 55),
  },
]

// Attendance status per staff for today
export const INITIAL_ATTENDANCE = {
  S01: { checkIn: t(9, 2), checkOut: null, status: 'Present' },
  S02: { checkIn: t(9, 15), checkOut: null, status: 'Present' },
  S03: { checkIn: t(16, 0), checkOut: null, status: 'Present' },
  S04: { checkIn: t(8, 58), checkOut: t(15, 0), status: 'Checked Out' },
  S05: { checkIn: null, checkOut: null, status: 'Absent' },
  S06: { checkIn: t(9, 30), checkOut: null, status: 'Present' },
  S07: { checkIn: t(16, 10), checkOut: null, status: 'Late' },
  S08: { checkIn: null, checkOut: null, status: 'Absent' },
}

// ---------------------------------------------------------------------------
// Accounting ledger — income & expense transactions (frontend only).
// Seeded across the last 6 months so the P&L chart has a trend. Staff payroll
// is NOT seeded here — it's pulled live from utils/payroll.js so Accounting,
// Payroll and the Dashboard always agree.
// ---------------------------------------------------------------------------
export const INCOME_CATEGORIES = ['Sales', 'Catering', 'Other']
export const EXPENSE_CATEGORIES = [
  'Rent',
  'Utilities',
  'Supplies',
  'Gas',
  'Maintenance',
  'Marketing',
  'Other',
]

const _now = new Date()
const txnDate = (monthsAgo, day) =>
  new Date(_now.getFullYear(), _now.getMonth() - monthsAgo, day).toISOString()

export const INITIAL_TRANSACTIONS = (() => {
  const list = []
  let id = 100
  for (let m = 5; m >= 0; m--) {
    const current = m === 0
    const saleDay = current ? Math.min(_now.getDate(), 6) : 15
    const supplyDay = current ? Math.min(_now.getDate(), 5) : 10

    list.push({
      id: `TXN-${id++}`,
      type: 'income',
      category: 'Sales',
      description: current ? 'Counter sales (month to date)' : 'Monthly counter sales',
      amount: current ? 620000 : 760000 + (5 - m) * 18000,
      date: txnDate(m, saleDay),
    })
    if (!current && m % 2 === 0) {
      list.push({
        id: `TXN-${id++}`,
        type: 'income',
        category: 'Catering',
        description: 'Event catering order',
        amount: 150000,
        date: txnDate(m, 20),
      })
    }
    list.push({
      id: `TXN-${id++}`,
      type: 'expense',
      category: 'Rent',
      description: 'Shop rent',
      amount: 120000,
      date: txnDate(m, 1),
    })
    list.push({
      id: `TXN-${id++}`,
      type: 'expense',
      category: 'Utilities',
      description: 'Electricity & gas',
      amount: 45000 + m * 1500,
      date: txnDate(m, 4),
    })
    list.push({
      id: `TXN-${id++}`,
      type: 'expense',
      category: 'Supplies',
      description: 'Groceries & meat',
      amount: 190000 + (5 - m) * 8000,
      date: txnDate(m, supplyDay),
    })
  }
  return list
})()

export const TAX_RATE = 0.05 // 5% GST
export const CURRENCY = 'Rs.'
