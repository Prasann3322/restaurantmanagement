import { MenuItem, Table, Order } from './types';

export const INITIAL_MENU_ITEMS: MenuItem[] = [
  {
    id: 'm1',
    name: 'Special Punjabi Thali',
    price: 240.00,
    halfPrice: 140.00,
    fullPrice: 240.00,
    category: 'Thalis & Meals',
    description: 'A complete delicious meal including Shahi Paneer, Dal Makhani, Dry Veg, 2 Butter Rotis, Rice, Salad, Sweet, and papad.',
    image: 'ST',
    imageUrl: 'https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?auto=format&fit=crop&w=400&h=400&q=80'
  },
  {
    id: 'm2',
    name: 'Chinese Deluxe Combo Thali',
    price: 220.00,
    halfPrice: 130.00,
    fullPrice: 220.00,
    category: 'Thalis & Meals',
    description: 'Perfect meal combination of aromatic Veg Fried Rice, Veg Hakka Noodles, and spicy gravy Veg Manchurian.',
    image: 'CC',
    imageUrl: 'https://images.unsplash.com/photo-1512058564366-18510be2db19?auto=format&fit=crop&w=400&h=400&q=80'
  },
  {
    id: 'm3',
    name: 'Schezwan Hakka Noodles',
    price: 160.00,
    halfPrice: 95.00,
    fullPrice: 160.00,
    category: 'Chinese Dishes',
    description: 'Spicy stir-fried noodles tossed with loaded fresh vegetables, garlic, and hot Schezwan sauce.',
    image: 'SN',
    imageUrl: 'https://images.unsplash.com/photo-1585032226651-759b368d7246?auto=format&fit=crop&w=400&h=400&q=80'
  },
  {
    id: 'm4',
    name: 'Paneer Chilli Dry',
    price: 180.00,
    halfPrice: 110.00,
    fullPrice: 180.00,
    category: 'Chinese Dishes',
    description: 'Crispy paneer cubes tossed with fresh spring onions, capsicum, green chillies, and soy sauce.',
    image: 'PC',
    imageUrl: 'https://images.unsplash.com/photo-1567188040759-fb8a883dc6d8?auto=format&fit=crop&w=400&h=400&q=80'
  },
  {
    id: 'm5',
    name: 'Shahi Kadhai Paneer',
    price: 260.00,
    halfPrice: 150.00,
    fullPrice: 260.00,
    category: 'Main Course',
    description: 'Rich cottage cheese cooked with fresh ground spices, tomato gravy, capsicum, and thick cream.',
    image: 'KP',
    imageUrl: 'https://images.unsplash.com/photo-1631452180519-c014fe946bc7?auto=format&fit=crop&w=400&h=400&q=80'
  },
  {
    id: 'm6',
    name: 'Dal Makhani Handi',
    price: 190.00,
    halfPrice: 115.00,
    fullPrice: 190.00,
    category: 'Main Course',
    description: 'Slow-cooked whole black lentils and red kidney beans finished with homemade cream and butter.',
    image: 'DM',
    imageUrl: 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?auto=format&fit=crop&w=400&h=400&q=80'
  },
  {
    id: 'm7',
    name: 'Thick Mango Kesar Lassi',
    price: 90.00,
    halfPrice: 55.00,
    fullPrice: 90.00,
    category: 'Drinks & Desserts',
    description: 'Creamy cold beverage with sweet mango pulp, fresh yogurt, cardamoms, and saffron toppings.',
    image: 'ML',
    imageUrl: 'https://images.unsplash.com/photo-1571115177098-24ec4209b535?auto=format&fit=crop&w=400&h=400&q=80'
  },
  {
    id: 'm8',
    name: 'Hot Rabdi Gulab Jamun',
    price: 120.00,
    halfPrice: 70.00,
    fullPrice: 120.00,
    category: 'Drinks & Desserts',
    description: 'Two hot sweet dumplings served cooked in cow ghee and topped with chilled creamy milk Rabdi.',
    image: 'GJ',
    imageUrl: 'https://images.unsplash.com/photo-1589118949245-7d38baf380d6?auto=format&fit=crop&w=400&h=400&q=80'
  },
  {
    id: 'm9',
    name: 'Executive Everyday Thali',
    price: 200.00,
    halfPrice: 120.00,
    fullPrice: 200.00,
    category: 'Thalis & Meals',
    description: 'Balanced lunch option featuring Yellow Dal Tadka, Seasonal Mix Veg, Basmati Jeera Rice, Tawa Roti, and Sweet Curd.',
    image: 'ET',
    imageUrl: 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?auto=format&fit=crop&w=400&h=400&q=80'
  },
  {
    id: 'm10',
    name: 'Dairy Premium Thali',
    price: 290.00,
    halfPrice: 170.00,
    fullPrice: 290.00,
    category: 'Thalis & Meals',
    description: 'Our house special feast: Paneer Butter Masala, Creamy Dal Makhani, Veg Pulao, Butter Naan, Sweet Saffron Lassi, and Rasmalai.',
    image: 'PT',
    imageUrl: 'https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?auto=format&fit=crop&w=400&h=400&q=80'
  },
  {
    id: 'm11',
    name: 'Veg Manchurian Gravy',
    price: 150.00,
    halfPrice: 90.00,
    fullPrice: 150.00,
    category: 'Chinese Dishes',
    description: 'Fried vegetable dumplings drenched in deep-flavored, spicy, sweet, and tangy coriander soybean sauce gravy.',
    image: 'VM',
    imageUrl: 'https://images.unsplash.com/photo-1512058564366-18510be2db19?auto=format&fit=crop&w=400&h=400&q=80'
  },
  {
    id: 'm12',
    name: 'Chilli Garlic Wok Noodles',
    price: 165.00,
    halfPrice: 100.00,
    fullPrice: 165.00,
    category: 'Chinese Dishes',
    description: 'Stir-fried noodles loaded with minced aromatic garlic, whole red dry chillies, soy, and fresh bell peppers.',
    image: 'CG',
    imageUrl: 'https://images.unsplash.com/photo-1585032226651-759b368d7246?auto=format&fit=crop&w=400&h=400&q=80'
  },
  {
    id: 'm13',
    name: 'Crispy Veg Spring Rolls',
    price: 140.00,
    halfPrice: 85.00,
    fullPrice: 140.00,
    category: 'Chinese Dishes',
    description: 'Six golden pieces of deep-fried rolled crackers stuffed with cabbage, carrot, and onion juliennes, with hot sauce.',
    image: 'SR',
    imageUrl: 'https://images.unsplash.com/photo-1626700051175-6518c4793f4f?auto=format&fit=crop&w=400&h=400&q=80'
  },
  {
    id: 'm14',
    name: 'Paneer Butter Masala',
    price: 250.00,
    halfPrice: 145.00,
    fullPrice: 250.00,
    category: 'Main Course',
    description: 'Soft malai paneer cubes simmered in a silky tomato, cashew-nut, and butter milk gravy, rich in sweet spices.',
    image: 'PB',
    imageUrl: 'https://images.unsplash.com/photo-1631452180519-c014fe946bc7?auto=format&fit=crop&w=400&h=400&q=80'
  },
  {
    id: 'm15',
    name: 'Peshawari Chole Masala',
    price: 180.00,
    halfPrice: 110.00,
    fullPrice: 180.00,
    category: 'Main Course',
    description: 'Spiced chickpeas computed with custom spices, robust black-tea base infusion, cardamoms, ginger, and cumin keys.',
    image: 'CM',
    imageUrl: 'https://images.unsplash.com/photo-1601050690597-df056fb4ce78?auto=format&fit=crop&w=400&h=400&q=80'
  },
  {
    id: 'm16',
    name: 'Royal Shahi Malai Kofta',
    price: 230.00,
    halfPrice: 135.00,
    fullPrice: 230.00,
    category: 'Main Course',
    description: 'Delectable cottage cheese and potato logs stuffed with dry fruits, simmered in premium light sweet cashew cream gravy.',
    image: 'MK',
    imageUrl: 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?auto=format&fit=crop&w=400&h=400&q=80'
  },
  {
    id: 'm17',
    name: 'Classic Saffron Elaichi Lassi',
    price: 80.00,
    halfPrice: 50.00,
    fullPrice: 80.00,
    category: 'Drinks & Desserts',
    description: 'Chilled thick-churned sweet milk yogurt drink accented with fresh green cardamoms, rose prefix, and saffron strands.',
    image: 'CL',
    imageUrl: 'https://images.unsplash.com/photo-1572490122747-3968b75cc699?auto=format&fit=crop&w=400&h=400&q=80'
  },
  {
    id: 'm18',
    name: 'Royal Kesaria Rasmalai',
    price: 100.00,
    halfPrice: 60.00,
    fullPrice: 100.00,
    category: 'Drinks & Desserts',
    description: 'Creamy soft chenna dumplings swimming in sweet, spiced saffron-infused pistachio milk reduction.',
    image: 'RL',
    imageUrl: 'https://images.unsplash.com/photo-1589118949245-7d38baf380d6?auto=format&fit=crop&w=400&h=400&q=80'
  }
];

export const INITIAL_TABLES: Table[] = [
  { id: 't1', number: 1, status: 'ready' },
  { id: 't2', number: 2, status: 'ready' },
  { id: 't3', number: 3, status: 'ready' },
  { id: 't4', number: 4, status: 'ready' },
  { id: 't5', number: 5, status: 'ready' }
];

export const INITIAL_ORDERS: Order[] = [
  {
    id: 'ord-101',
    tableNumber: 3,
    items: [
      {
        id: 'orditem-1',
        menuItemId: 'm1',
        name: 'Special Punjabi Thali',
        price: 240.00,
        quantity: 1,
        notes: 'Less spicy, extra roti butter'
      },
      {
        id: 'orditem-2',
        menuItemId: 'm7',
        name: 'Thick Mango Kesar Lassi',
        price: 90.00,
        quantity: 2,
        notes: 'Chilled'
      }
    ],
    totalAmount: 420.00,
    status: 'preparing',
    createdAt: new Date(Date.now() - 12 * 60 * 1000).toISOString()
  },
  {
    id: 'ord-102',
    tableNumber: 5,
    items: [
      {
        id: 'orditem-3',
        menuItemId: 'm3',
        name: 'Schezwan Hakka Noodles',
        price: 160.00,
        quantity: 1,
        notes: 'Make it spicy and dry'
      }
    ],
    totalAmount: 160.00,
    status: 'preparing',
    createdAt: new Date(Date.now() - 4 * 60 * 1000).toISOString()
  }
];
