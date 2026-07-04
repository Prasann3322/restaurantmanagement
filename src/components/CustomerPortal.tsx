import React, { useState, useMemo, useEffect } from 'react';
import { 
  ShoppingBag, Search, X, PlusCircle, MinusCircle, 
  ChevronRight, CheckCircle2, Utensils, ChefHat, Pizza, 
  Coffee, Soup, Cookie, Flame, Sparkles, Package, User
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { MenuItem, OrderItem, Order, OrderStatus } from '../types';
import { ChefLogo } from './ChefLogo';

interface CustomerPortalProps {
  tableNumber: number;
  menuItems: MenuItem[];
  orders: Order[];
  onPlaceOrder: (items: OrderItem[], notes: string, isParcel: boolean, customerName?: string) => void;
  onNavigateHome: () => void;
}

export default function CustomerPortal({
  tableNumber,
  menuItems,
  orders,
  onPlaceOrder,
  onNavigateHome
}: CustomerPortalProps) {
  // Navigation & Search State
  const [showIntro, setShowIntro] = useState<boolean>(true);
  const [showNamePrompt, setShowNamePrompt] = useState<boolean>(false);
  const [customerName, setCustomerName] = useState<string>('');
  const [tempName, setTempName] = useState<string>('');
  
  const [activeCategory, setActiveCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Cart State local to current customer session
  const [cart, setCart] = useState<OrderItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState<boolean>(false);
  const [isParcel, setIsParcel] = useState<boolean>(false);
  const [portionSelectorItem, setPortionSelectorItem] = useState<MenuItem | null>(null);
  
  // Single simple note textbox field at submission time
  const [kitchenNotes, setKitchenNotes] = useState<string>('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2000);
  };

  // Find all active orders placed by this table in the current database
  const activeTableOrders = useMemo(() => {
    return orders.filter(o => o.tableNumber === tableNumber && o.status !== 'completed');
  }, [orders, tableNumber]);

  // Session Recovery & Real-Time Sync Effect
  useEffect(() => {
    const savedName = localStorage.getItem(`customer_name_table_${tableNumber}`);
    
    if (activeTableOrders.length > 0) {
      // Order is active and not yet completed/paid
      const nameToUse = savedName || activeTableOrders[0].customerName || '';
      if (nameToUse) {
        setCustomerName(nameToUse);
        setTempName(nameToUse);
        setShowIntro(false);
        setShowNamePrompt(false);
        if (!savedName) {
          localStorage.setItem(`customer_name_table_${tableNumber}`, nameToUse);
        }
      }
    } else {
      // There are no active orders! All orders are completed and paid (or none placed yet)
      // This means we clear the saved name and ask for a new name to start a fresh customer session
      if (savedName) {
        localStorage.removeItem(`customer_name_table_${tableNumber}`);
        setCustomerName('');
        setTempName('');
        setShowIntro(true);
        setShowNamePrompt(false);
      }
    }
  }, [orders, tableNumber]);

  // Filter Categories
  const filteredMenuItems = useMemo(() => {
    return menuItems.filter(item => {
      const matchCat = activeCategory === 'All' || item.category === activeCategory;
      const matchSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          item.description.toLowerCase().includes(searchQuery.toLowerCase());
      return matchCat && matchSearch;
    });
  }, [menuItems, activeCategory, searchQuery]);

  // Total Quantity in sticky badge
  const totalCartQty = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.quantity, 0);
  }, [cart]);

  // Total Price in Cart
  const totalCartPrice = useMemo(() => {
    return cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  }, [cart]);

  // When clicking "Add", open the full/half selection options unless it is single-portion only
  const handleDirectAddToCart = (item: MenuItem) => {
    if (item.isSinglePortion) {
      setCart(prev => {
        const existing = prev.find(x => x.menuItemId === item.id && !x.portion);
        if (existing) {
          return prev.map(x => (x.menuItemId === item.id && !x.portion) ? { ...x, quantity: x.quantity + 1 } : x);
        } else {
          const newItem: OrderItem = {
            id: `cartitem-${Date.now()}-${Math.random().toString(36).substr(2, 3)}`,
            menuItemId: item.id,
            name: item.name,
            price: item.price,
            quantity: 1,
            notes: ''
          };
          return [...prev, newItem];
        }
      });
      triggerToast(`Added "${item.name}" to basket`);
    } else {
      setPortionSelectorItem(item);
    }
  };

  // Add the specific portion selection to cart
  const handleAddPortionToCart = (item: MenuItem, portion: 'half' | 'full') => {
    const selectedPrice = portion === 'half' 
      ? (item.halfPrice ?? Math.round(item.price * 0.5)) 
      : (item.fullPrice ?? item.price);
      
    setCart(prev => {
      const existing = prev.find(x => x.menuItemId === item.id && x.portion === portion);
      if (existing) {
        return prev.map(x => (x.menuItemId === item.id && x.portion === portion) ? { ...x, quantity: x.quantity + 1 } : x);
      } else {
        const newItem: OrderItem = {
          id: `cartitem-${Date.now()}-${Math.random().toString(36).substr(2, 3)}`,
          menuItemId: item.id,
          name: item.name,
          price: selectedPrice,
          quantity: 1,
          notes: '',
          portion: portion
        };
        return [...prev, newItem];
      }
    });

    triggerToast(`Added "${item.name} (${portion === 'half' ? 'Half' : 'Full'})" to basket`);
    setPortionSelectorItem(null);
  };

  // Update a cart item's portion (and pricing) directly from the basket drawer
  const updateCartItemPortion = (cartItemId: string, nextPortion: 'half' | 'full') => {
    setCart(prev => {
      const targetItem = prev.find(it => it.id === cartItemId);
      if (!targetItem) return prev;
      
      const menuItem = menuItems.find(m => m.id === targetItem.menuItemId);
      if (!menuItem) return prev;
      
      const newPrice = nextPortion === 'half' 
        ? (menuItem.halfPrice ?? Math.round(menuItem.price * 0.5)) 
        : (menuItem.fullPrice ?? menuItem.price);
      
      // If there is another item in the cart with the same menuItemId and portion, combine them
      const sibling = prev.find(it => it.id !== cartItemId && it.menuItemId === targetItem.menuItemId && it.portion === nextPortion);
      if (sibling) {
        return prev.map(it => {
          if (it.id === sibling.id) {
            return { ...it, quantity: it.quantity + targetItem.quantity };
          }
          return it;
        }).filter(it => it.id !== cartItemId);
      }
      
      return prev.map(it => it.id === cartItemId ? { ...it, portion: nextPortion, price: newPrice } : it);
    });
  };

  const adjustCartQty = (cartItemId: string, change: number) => {
    setCart(prev => prev.map(item => {
      if (item.id === cartItemId) {
        const nextQty = item.quantity + change;
        return nextQty > 0 ? { ...item, quantity: nextQty } : item;
      }
      return item;
    }));
  };

  const handleRemoveFromCart = (cartItemId: string) => {
    setCart(prev => prev.filter(item => item.id !== cartItemId));
  };

  const handleSubmitOrder = () => {
    if (cart.length === 0) return;
    
    // Add kitchen notes to all items if provided
    const itemsWithNotes = cart.map(it => ({
      ...it,
      notes: kitchenNotes.trim() ? `${kitchenNotes.trim()}` : ''
    }));

    onPlaceOrder(itemsWithNotes, kitchenNotes, isParcel, customerName);
    setCart([]);
    setKitchenNotes('');
    setIsParcel(false);
    setIsCartOpen(false);
    triggerToast("Your delicious food order has been placed!");
  };

  const getStatusBadge = (status: OrderStatus) => {
    switch(status) {
      case 'pending':
        return { label: 'In Queue', color: 'bg-yellow-50 text-yellow-800 border border-yellow-200' };
      case 'preparing':
        return { label: 'Preparing / Cooking', color: 'bg-red-50 text-red-700 border border-red-200 animate-pulse' };
      case 'served':
        return { label: 'Served on Table ✓', color: 'bg-emerald-50 text-emerald-800 border border-emerald-250' };
      default:
        return { label: 'Paid & Closed', color: 'bg-gray-100 text-gray-700' };
    }
  };

  return (
    <div className="min-h-screen bg-[#FFFDF9] flex flex-col select-none relative max-w-md mx-auto shadow-2xl border-l border-r border-[#D9D9E0]">
      
      {toastMessage && (
        <div className="fixed bottom-24 left-1/2 transform -translate-x-1/2 bg-gray-900 border border-yellow-405 text-white px-4 py-2.5 rounded-full text-xs font-semibold z-50 flex items-center space-x-1.5 shadow-xl">
          <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      <AnimatePresence mode="wait">
        {showIntro && !showNamePrompt ? (
          <motion.div
            key="intro-screen"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.4, ease: "easeInOut" }}
            className="flex-grow flex flex-col justify-between p-6 relative overflow-hidden bg-[#FFFDF9]"
          >
            {/* Colorful Cloud Type Gradient Blobs */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
              <motion.div 
                animate={{
                  x: [0, 20, -15, 0],
                  y: [0, -30, 20, 0],
                  scale: [1, 1.15, 0.9, 1],
                }}
                transition={{
                  duration: 16,
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
                className="absolute top-[-25%] left-[-20%] w-[110%] h-[75%] rounded-full bg-gradient-to-br from-red-200/50 via-rose-200/40 to-transparent blur-3xl"
              />
              <motion.div 
                animate={{
                  x: [0, -25, 15, 0],
                  y: [0, 20, -30, 0],
                  scale: [1, 0.85, 1.15, 1],
                }}
                transition={{
                  duration: 20,
                  repeat: Infinity,
                  ease: "easeInOut",
                  delay: 2
                }}
                className="absolute bottom-[-20%] right-[-15%] w-[110%] h-[75%] rounded-full bg-gradient-to-tr from-yellow-200/50 via-amber-200/40 to-transparent blur-3xl"
              />
              <motion.div 
                animate={{
                  x: [0, 15, -20, 0],
                  y: [0, 25, -15, 0],
                }}
                transition={{
                  duration: 24,
                  repeat: Infinity,
                  ease: "easeInOut",
                  delay: 4
                }}
                className="absolute top-[25%] right-[-15%] w-[80%] h-[55%] rounded-full bg-gradient-to-l from-orange-200/45 via-red-150/30 to-transparent blur-3xl"
              />
              <motion.div 
                animate={{
                  x: [0, -20, 20, 0],
                  y: [0, -15, 25, 0],
                }}
                transition={{
                  duration: 28,
                  repeat: Infinity,
                  ease: "easeInOut",
                  delay: 6
                }}
                className="absolute top-[35%] left-[-15%] w-[70%] h-[60%] rounded-full bg-gradient-to-r from-emerald-100/30 via-yellow-100/30 to-transparent blur-2xl"
              />
            </div>

            {/* Top Service Indication (Removed Exit button) */}
            <div className="flex justify-end items-center z-10 w-full">
              <div className="flex items-center space-x-1.5 bg-emerald-50 border border-emerald-200/60 px-2.5 py-1 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[9px] font-black text-emerald-800 uppercase tracking-widest font-mono">Live Service</span>
              </div>
            </div>

            {/* Ambient Animated Food Icons (The requested Food Elements) */}
            <div className="absolute inset-x-0 top-24 bottom-48 pointer-events-none">
              
              {/* Thali Bowl (Soup) */}
              <motion.div 
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 130, damping: 11, delay: 0.4 }}
                className="absolute top-[10%] left-[6%] z-10"
              >
                <motion.div 
                  className="bg-white/95 rounded-2xl p-2.5 border border-red-100 shadow-md flex items-center gap-1.5"
                  animate={{
                    y: [0, -10, 0],
                    rotate: [0, 4, -4, 0]
                  }}
                  transition={{
                    duration: 4.5,
                    repeat: Infinity,
                    ease: "easeInOut"
                  }}
                >
                  <div className="p-1 bg-red-50 rounded-lg text-red-600">
                    <Soup className="h-4 w-4" />
                  </div>
                  <span className="text-[10px] font-black text-gray-800 whitespace-nowrap">Punjabi Thali</span>
                </motion.div>
              </motion.div>

              {/* Chinese Sizzler */}
              <motion.div 
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 130, damping: 11, delay: 0.55 }}
                className="absolute top-[18%] right-[6%] z-10"
              >
                <motion.div 
                  className="bg-white/95 rounded-2xl p-2.5 border border-amber-100 shadow-md flex items-center gap-1.5"
                  animate={{
                    y: [0, -12, 0],
                    rotate: [0, -3, 3, 0]
                  }}
                  transition={{
                    duration: 5.2,
                    repeat: Infinity,
                    ease: "easeInOut"
                  }}
                >
                  <div className="p-1 bg-amber-50 rounded-lg text-amber-600">
                    <Flame className="h-4 w-4" />
                  </div>
                  <span className="text-[10px] font-black text-gray-800 whitespace-nowrap">Wok Specials</span>
                </motion.div>
              </motion.div>

              {/* Creamy Lassi */}
              <motion.div 
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 130, damping: 11, delay: 0.7 }}
                className="absolute top-[55%] left-[4%] z-10"
              >
                <motion.div 
                  className="bg-white/95 rounded-2xl p-2.5 border border-yellow-100 shadow-md flex items-center gap-1.5"
                  animate={{
                    y: [0, -8, 0],
                    rotate: [0, 5, -5, 0]
                  }}
                  transition={{
                    duration: 3.8,
                    repeat: Infinity,
                    ease: "easeInOut"
                  }}
                >
                  <div className="p-1 bg-yellow-50 rounded-lg text-amber-700">
                    <Coffee className="h-4 w-4" />
                  </div>
                  <span className="text-[10px] font-black text-gray-800 whitespace-nowrap">Creamy Lassi</span>
                </motion.div>
              </motion.div>

              {/* Sweet Desi Ghee Dessert */}
              <motion.div 
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 130, damping: 11, delay: 0.85 }}
                className="absolute top-[62%] right-[4%] z-10"
              >
                <motion.div 
                  className="bg-white/95 rounded-2xl p-2.5 border border-red-100 shadow-md flex items-center gap-1.5"
                  animate={{
                    y: [0, -11, 0],
                    rotate: [0, -5, 5, 0]
                  }}
                  transition={{
                    duration: 4.8,
                    repeat: Infinity,
                    ease: "easeInOut"
                  }}
                >
                  <div className="p-1 bg-red-50 rounded-lg text-red-600">
                    <Cookie className="h-4 w-4" />
                  </div>
                  <span className="text-[10px] font-black text-gray-800 whitespace-nowrap">Pure Desserts</span>
                </motion.div>
              </motion.div>

              {/* Subtle visual sparkles */}
              <motion.div
                className="absolute top-[38%] left-[15%] text-amber-400 opacity-60"
                animate={{ scale: [1, 1.4, 1], rotate: 360 }}
                transition={{ duration: 3, repeat: Infinity }}
              >
                <Sparkles className="h-3 w-3" />
              </motion.div>
              <motion.div
                className="absolute top-[44%] right-[20%] text-amber-400 opacity-60"
                animate={{ scale: [1.2, 0.8, 1.2], rotate: -360 }}
                transition={{ duration: 4, repeat: Infinity, delay: 1 }}
              >
                <Sparkles className="h-4 w-4" />
              </motion.div>
            </div>

            {/* Central Brand and Floating Logo Section */}
            <div className="flex-grow flex flex-col items-center justify-center text-center space-y-6 z-10 my-auto">
              
              {/* Double Ring Spinning Golden Thali Grid */}
              <motion.div 
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 110, damping: 14, delay: 0.15 }}
                className="relative flex items-center justify-center"
              >
                <motion.div 
                  className="absolute w-44 h-44 rounded-full border-2 border-dashed border-red-200/85"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
                />
                <motion.div 
                  className="absolute w-38 h-38 rounded-full border-2 border-dashed border-yellow-500/35"
                  animate={{ rotate: -360 }}
                  transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                />
                
                {/* Main Logo Card */}
                <motion.div 
                  className="w-32 h-32 rounded-full shadow-2xl relative overflow-hidden flex items-center justify-center bg-[#4c1d3f]"
                  animate={{ 
                    y: [0, -6, 0]
                  }}
                  transition={{
                    duration: 3.5,
                    repeat: Infinity,
                    ease: "easeInOut"
                  }}
                >
                  <ChefLogo size={128} />
                </motion.div>
              </motion.div>

              {/* Float & Fade-In Restaurant Title */}
              <div className="space-y-2 mt-4 max-w-xs">
                <motion.span 
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ type: "spring", stiffness: 120, damping: 11, delay: 0.3 }}
                  className="text-xs uppercase tracking-widest font-black text-red-800 font-mono block"
                >
                  Indulge in Premium Taste
                </motion.span>
                
                <motion.div
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ type: "spring", stiffness: 120, damping: 12, delay: 0.45 }}
                >
                  <h1 className="text-4xl font-extrabold tracking-tight font-display text-red-900">
                    Good Good
                  </h1>
                  <h2 className="text-3xl font-black italic tracking-wide font-serif text-yellow-600 mt-0.5">
                    Dairy
                  </h2>
                </motion.div>

                <motion.div 
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ type: "spring", stiffness: 100, damping: 10, delay: 0.55 }}
                  className="h-1 w-16 bg-gradient-to-r from-red-600 via-yellow-500 to-red-600 mx-auto rounded-full mt-2"
                />
              </div>

              {/* Highlights badge */}
              <motion.div
                initial={{ opacity: 0, scale: 0, y: 30 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ type: "spring", stiffness: 100, damping: 13, delay: 0.75 }}
                style={{ marginTop: '80px' }}
                className="bg-white/80 border border-gray-200/90 rounded-2xl p-4 w-full text-left space-y-2.5 shadow-2xs"
              >
                <div className="flex items-center space-x-2 text-red-800 font-bold text-xs truncate">
                  <ChefHat className="h-4 w-4" />
                  <span>Why dine with us?</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[10px] font-bold text-gray-700">
                  <div className="flex items-center gap-1.5">
                    <span className="text-red-700">✓</span> No Preservatives
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-red-700">✓</span> 100% Desi Ghee
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-red-700">✓</span> Fresh Prep Today
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-red-700">✓</span> High-tech Kitchen
                  </div>
                </div>
              </motion.div>
            </div>

            {/* Bottom Action / Desk Details & Order Entrance Button */}
            <div className="space-y-4 z-10 w-full mt-auto pb-10">
              
              {/* Desk License Details */}
              <motion.div 
                initial={{ opacity: 0, scale: 0, y: 30 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ type: "spring", stiffness: 100, damping: 14, delay: 0.85 }}
                className="bg-[#FFFDF9]/95 backdrop-blur-xs border-2 border-amber-205/90 rounded-2xl px-4 py-3 shadow-md flex justify-between items-center text-left"
              >
                <div>
                  <span className="text-[10px] text-gray-400 font-black tracking-widest block uppercase font-mono leading-none">Dining Spot</span>
                  <span className="text-base font-black text-red-900 font-display mt-0.5 block">Desk No. {tableNumber}</span>
                </div>
                <span className="text-[11px] font-black text-amber-800 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200/50 uppercase font-mono tracking-widest">
                  Live QR Scan
                </span>
              </motion.div>

              {/* Pulsing Glow Call to Action button */}
              <motion.div
                initial={{ opacity: 0, scale: 0, y: 30 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ type: "spring", stiffness: 100, damping: 15, delay: 0.95 }}
                className="relative"
              >
                {/* Pulsing halo */}
                <span className="absolute -inset-1 rounded-2xl bg-red-700/20 blur-md animate-pulse" />
                
                <motion.button
                  onClick={() => {
                    setShowNamePrompt(true);
                  }}
                  whileHover={{ scale: 1.02, y: -1 }}
                  whileTap={{ scale: 0.98 }}
                  style={{ marginTop: '20px', paddingLeft: '1px' }}
                  className="w-full relative py-4 bg-gradient-to-r from-red-700 via-red-850 to-red-900 hover:from-red-800 hover:to-red-955 text-[#FFFDF9] font-black text-xs uppercase tracking-widest rounded-2xl shadow-lg border border-red-650 transition flex items-center justify-center space-x-2.5 overflow-hidden group cursor-pointer animate-[bounce_2s_infinite_ease-in-out_alternate]"
                >
                  <Utensils className="h-4 w-4 animate-bounce group-hover:scale-110 transition-transform text-yellow-300" />
                  <span className="text-yellow-50">Browse Menu & Order Food</span>
                  <ChevronRight className="h-4 w-4 text-yellow-300 group-hover:translate-x-1 transition-transform" />
                </motion.button>
              </motion.div>
            </div>
          </motion.div>
        ) : showIntro && showNamePrompt ? (
          <motion.div
            key="name-prompt-screen"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, y: -40, scale: 0.96 }}
            transition={{ duration: 0.4, ease: "easeInOut" }}
            className="flex-grow flex flex-col justify-center items-center p-6 relative overflow-hidden bg-[#FFFDF9]"
          >
            {/* Premium floating desk tag positioned at the very top of the page */}
            <div className="absolute top-6 left-0 right-0 flex justify-center z-20">
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ type: "spring", stiffness: 100, damping: 15, delay: 0.15 }}
                className="inline-flex items-center space-x-1.5 bg-amber-50/85 border border-amber-200/50 rounded-full px-3.5 py-1 text-[10px] font-black uppercase tracking-widest text-amber-800 font-mono shadow-3xs"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-red-650 animate-ping" />
                <span>Desk No. {tableNumber}</span>
                <span className="text-amber-300">•</span>
                <span>Live QR Session</span>
              </motion.div>
            </div>

            {/* Background Blob Animations for Visual Continuity */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
              <div className="absolute top-[-25%] left-[-20%] w-[110%] h-[75%] rounded-full bg-gradient-to-br from-red-200/40 via-rose-200/30 to-transparent blur-3xl" />
              <div className="absolute bottom-[-20%] right-[-15%] w-[110%] h-[75%] rounded-full bg-gradient-to-tr from-yellow-200/40 via-amber-200/30 to-transparent blur-3xl" />
            </div>

            {/* Drifting Floating Food Badges */}
            <motion.div
              className="absolute top-[8%] left-[6%] bg-amber-50/80 border border-amber-200/30 p-2.5 rounded-2xl shadow-3xs text-amber-600 pointer-events-none z-0"
              animate={{ y: [0, -12, 0], rotate: [0, 15, -15, 0] }}
              transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
            >
              <Pizza className="h-5 w-5" />
            </motion.div>

            <motion.div
              className="absolute top-[10%] right-[6%] bg-rose-50/80 border border-rose-200/30 p-2.5 rounded-2xl shadow-3xs text-red-600 pointer-events-none z-0"
              animate={{ y: [0, 12, 0], rotate: [0, -15, 15, 0] }}
              transition={{ duration: 7, repeat: Infinity, ease: "easeInOut", delay: 1 }}
            >
              <Coffee className="h-5 w-5" />
            </motion.div>

            <motion.div
              className="absolute top-[38%] left-[4%] bg-yellow-50/80 border border-yellow-200/30 p-2 rounded-xl shadow-3xs text-yellow-600 pointer-events-none z-0"
              animate={{ x: [0, 6, 0], y: [0, -6, 0], rotate: [0, 12, -12, 0] }}
              transition={{ duration: 8, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
            >
              <Cookie className="h-4.5 w-4.5" />
            </motion.div>

            <motion.div
              className="absolute top-[42%] right-[4%] bg-red-50/80 border border-red-200/30 p-2 rounded-xl shadow-3xs text-red-700 pointer-events-none z-0"
              animate={{ y: [0, -10, 0], rotate: [0, 10, -10, 0] }}
              transition={{ duration: 5.5, repeat: Infinity, ease: "easeInOut", delay: 0.2 }}
            >
              <ChefHat className="h-4.5 w-4.5" />
            </motion.div>

            <motion.div
              className="absolute bottom-[14%] left-[8%] bg-orange-50/80 border border-orange-200/30 p-2.5 rounded-2xl shadow-3xs text-orange-600 pointer-events-none z-0"
              animate={{ y: [0, 14, 0], rotate: [0, -20, 20, 0] }}
              transition={{ duration: 7.5, repeat: Infinity, ease: "easeInOut", delay: 1.5 }}
            >
              <Soup className="h-5 w-5" />
            </motion.div>

            <motion.div
              className="absolute bottom-[10%] right-[8%] bg-amber-50/80 border border-amber-200/30 p-2.5 rounded-2xl shadow-3xs text-amber-700 pointer-events-none z-0"
              animate={{ y: [0, -12, 0], rotate: [0, 25, -25, 0] }}
              transition={{ duration: 6.5, repeat: Infinity, ease: "easeInOut", delay: 2 }}
            >
              <Utensils className="h-5 w-5" />
            </motion.div>

            {/* Drifting Floating Sparkles to mirror the main entry page */}
            <motion.div
              className="absolute top-[20%] right-[22%] text-amber-500 opacity-70 pointer-events-none"
              animate={{ scale: [1, 1.3, 1], rotate: 360, y: [0, -6, 0] }}
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
            >
              <Sparkles className="h-4.5 w-4.5 text-amber-400" />
            </motion.div>
            <motion.div
              className="absolute bottom-[24%] left-[22%] text-red-500 opacity-60 pointer-events-none"
              animate={{ scale: [1.2, 0.8, 1.2], rotate: -360, y: [0, 6, 0] }}
              transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 1 }}
            >
              <Sparkles className="h-3.5 w-3.5 text-red-400" />
            </motion.div>
            <motion.div
              className="absolute top-[32%] left-[16%] text-yellow-500 opacity-50 pointer-events-none"
              animate={{ scale: [0.8, 1.2, 0.8], rotate: 180 }}
              transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
            >
              <Sparkles className="h-3 w-3 text-yellow-400" />
            </motion.div>

            <div className="w-full max-w-sm z-10 space-y-6 text-center">
              {/* Header Icon Card with double spinning ring system */}
              <motion.div 
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 120, damping: 14, delay: 0.2 }}
                className="relative flex items-center justify-center h-32"
              >
                {/* Rotating dashed red ring */}
                <motion.div 
                  className="absolute w-28 h-28 rounded-full border border-dashed border-red-300/60"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
                />
                
                {/* Rotating dotted golden/amber ring */}
                <motion.div 
                  className="absolute w-24 h-24 rounded-full border border-dotted border-yellow-500/40"
                  animate={{ rotate: -360 }}
                  transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
                />

                {/* Pulsing inner background glow */}
                <motion.div 
                  className="absolute w-20 h-20 rounded-full bg-red-100/40 -z-10"
                  animate={{ scale: [1, 1.15, 1], opacity: [0.6, 0.3, 0.6] }}
                  transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                />

                {/* Central Profile Avatar Card */}
                <motion.div 
                  className="h-20 w-20 bg-white rounded-full border-4 border-white flex items-center justify-center shadow-lg overflow-hidden relative z-10"
                  animate={{ y: [0, -4, 0] }}
                  transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut" }}
                >
                  <div className="absolute inset-0 bg-gradient-to-tr from-red-100 to-amber-50 opacity-80" />
                  <User className="h-9 w-9 text-red-700 z-10" />
                </motion.div>
              </motion.div>

              {/* Title */}
              <div className="space-y-3">
                <motion.h3 
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ type: "spring", stiffness: 100, damping: 15, delay: 0.3 }}
                  className="text-2xl font-black text-gray-950 font-display tracking-tight"
                >
                  Your Good Good Name!!
                </motion.h3>
              </div>

              {/* Beautiful Input Card with drop shadow and hover transitions */}
              <motion.form 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ type: "spring", stiffness: 100, damping: 16, delay: 0.4 }}
                onSubmit={(e) => {
                  e.preventDefault();
                  if (tempName.trim().length >= 2) {
                    const trimmed = tempName.trim();
                    localStorage.setItem(`customer_name_table_${tableNumber}`, trimmed);
                    setCustomerName(trimmed);
                    setShowNamePrompt(false);
                    setShowIntro(false);
                    triggerToast(`Welcome, ${trimmed}! Grab some delicious food.`);
                  }
                }}
                className="bg-gradient-to-br from-[#FFFDF9]/95 via-amber-50/80 to-[#FFFDF9]/95 border border-amber-200/60 rounded-2xl p-6 shadow-lg h-[230px] flex flex-col justify-between text-left relative overflow-hidden group backdrop-blur-xs"
              >
                {/* Ambient thin border line decoration inside card */}
                <div className="absolute top-0 inset-x-0 h-[3px] bg-gradient-to-r from-red-600 via-yellow-500 to-red-600" />

                <div className="mt-[20px] ml-0">
                  <label htmlFor="customer-name-input" className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 font-mono">
                    Enter Your Name
                  </label>
                  <div className="relative">
                     <input
                      id="customer-name-input"
                      type="text"
                      maxLength={30}
                      value={tempName}
                      onChange={(e) => setTempName(e.target.value)}
                      placeholder="good good dairy"
                      required
                      autoFocus
                      className="w-full bg-[#FFFDF9] border border-[#C6C6CD] focus:border-red-700 focus:ring-4 focus:ring-red-700/10 rounded-xl px-4 py-3.5 text-sm font-black text-gray-950 shadow-3xs placeholder-gray-400 focus:outline-none transition-all duration-200"
                    />
                  </div>
                </div>

                {/* Submit button with hover/tap animations */}
                <motion.button
                  type="submit"
                  disabled={tempName.trim().length < 2}
                  whileHover={tempName.trim().length >= 2 ? { scale: 1.01 } : {}}
                  whileTap={tempName.trim().length >= 2 ? { scale: 0.99 } : {}}
                  className={`w-full py-4 rounded-xl font-black text-xs uppercase tracking-widest shadow-md transition-all duration-200 flex items-center justify-center space-x-2 border cursor-pointer ${
                    tempName.trim().length >= 2
                      ? "bg-gradient-to-r from-red-700 via-red-800 to-red-900 border-red-850 text-white hover:shadow-lg hover:shadow-red-700/10"
                      : "bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed"
                  }`}
                >
                  <span>Let's Browse Menu 🍽️</span>
                  <ChevronRight className="h-4 w-4" />
                </motion.button>
              </motion.form>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="menu-content"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
            className="flex-grow flex flex-col bg-[#FFFDF9] overflow-hidden"
          >
            {/* COMPACT CLEAN GUEST HEADER */}
            <header className="bg-gradient-to-br from-red-700 via-red-800 to-red-900 text-white px-5 py-5 rounded-b-2xl shadow-sm shrink-0 border-b border-[#D9D9E0] relative overflow-hidden">
              <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:12px_12px] pointer-events-none" />
              <div className="flex items-center gap-2 mb-1.5 balance">
                <ChefLogo size={32} className="rounded-full shadow-md shrink-0 ring-2 ring-yellow-400" />
                <div className="flex flex-col text-left">
                  <span className="text-[10px] uppercase font-black tracking-widest text-[#FFFDF9] font-mono block opacity-90 leading-none">
                    Good Good Dairy • Table Service
                  </span>
                  {customerName && (
                    <span className="text-[11px] font-black text-yellow-300 uppercase tracking-wider font-sans mt-0.5">
                      Guest: {customerName}
                    </span>
                  )}
                </div>
              </div>
              <h2 className="text-2xl font-black tracking-tight font-display text-[#FFFDF9] mt-1">
                Dining Desk No. {tableNumber}
              </h2>
            </header>

            {/* CORE CONTAINER */}
            <div className="flex-grow overflow-y-auto px-4 py-4 pb-28 space-y-4">

              {/* COMPACT SEARCH */}
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-gray-500">
                  <Search className="h-4 w-4" />
                </span>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search our delicious multi-cuisine menu..."
                  className="w-full bg-white border border-[#C6C6CD] rounded-xl py-2.5 pl-9 pr-4 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-red-700/20 focus:border-red-700 text-gray-950 shadow-2xs placeholder-gray-500"
                />
              </div>

              {/* LIVE TRACKER FOR CURRENT ACTIVE CUSTOMER SESSIONS */}
              {activeTableOrders.length > 0 && (
                <div className="bg-yellow-50/45 rounded-xl p-4 border border-yellow-250 space-y-2.5">
                  <span className="text-[10px] font-black text-red-800 tracking-wider uppercase block">
                    Active Kitchen Tickets
                  </span>
                  <div className="space-y-2">
                    {activeTableOrders.map(ord => {
                      const badge = getStatusBadge(ord.status);
                      const itemsText = ord.items.map(it => {
                        const portionText = it.portion ? ` (${it.portion === 'half' ? 'Half' : 'Full'})` : '';
                        return `${it.quantity}x ${it.name}${portionText}`;
                      }).join(', ');

                      return (
                        <div key={ord.id} className="bg-white p-3 rounded-lg border border-[#D9D9E0] text-[11px] flex justify-between items-center shadow-3xs gap-2">
                          <div className="flex items-center gap-1.5 min-w-0 flex-grow">
                            {ord.isParcel && <Package className="h-3.5 w-3.5 text-red-700 shrink-0" />}
                            <span className="font-extrabold text-gray-900 truncate" title={itemsText}>
                              {ord.isParcel && <span className="text-red-750 font-black mr-1">[Parcel]</span>}
                              {itemsText}
                            </span>
                          </div>
                          <span className={`px-2.5 py-1 rounded-md text-[10px] font-black tracking-wide shrink-0 ${badge.color}`}>
                            {badge.label}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* HORIZONTAL FILTER CATEGORY SELECTOR */}
              <div className="flex items-center space-x-2 overflow-x-auto no-scrollbar py-1 scrollbar-thin">
                {Array.from(new Set([
                  'All',
                  'Thalis & Meals',
                  'Chinese Dishes',
                  'Main Course',
                  'Drinks & Desserts',
                  ...menuItems.map(item => item.category).filter(Boolean)
                ])).map(cat => {
                  const isSel = activeCategory === cat;
                  return (
                    <button
                      key={cat}
                      onClick={() => setActiveCategory(cat)}
                      className={`px-4 py-2 text-xs font-black rounded-xl border transition-all duration-150 cursor-pointer whitespace-nowrap ${
                        isSel 
                          ? 'bg-red-700 text-white border-red-700 font-extrabold shadow-sm scale-102 ring-2 ring-red-700/10' 
                          : 'bg-white text-gray-700 border-[#D2D2D8] hover:text-red-700 hover:border-red-700'
                      }`}
                    >
                      {cat}
                    </button>
                  );
                })}
              </div>

              {/* MINIMAL MENU CARDS */}
              <div className="space-y-3">
                {filteredMenuItems.map((item, index) => (
                  <div 
                    key={item.id} 
                    className="bg-white rounded-2xl p-4 border border-[#E4E4EC] flex items-start gap-3.5 shadow-3xs hover:border-red-200 transition-all duration-150 hover:shadow-2xs"
                  >
                    <div className="w-14 h-14 flex items-center justify-center rounded-xl bg-red-50 text-red-700 border border-red-100 font-extrabold text-sm shrink-0 font-mono overflow-hidden shadow-3xs">
                      {item.imageUrl ? (
                        <img
                          src={item.imageUrl}
                          alt={item.name}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        item.image || item.name.slice(0, 2).toUpperCase()
                      )}
                    </div>
                    <div className="flex-grow min-w-0">
                      <div className="flex justify-between items-start gap-1">
                        <h4 className="text-xs sm:text-sm font-black text-gray-950 leading-snug break-words">{item.name}</h4>
                        <div className="flex flex-col items-end shrink-0 select-none">
                          {item.isSinglePortion ? (
                            <>
                              <span className="text-xs sm:text-sm font-black text-red-750 font-mono whitespace-nowrap">
                                ₹{item.price.toFixed(2)}
                              </span>
                              <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider block mt-0.5">
                                Base Price
                              </span>
                            </>
                          ) : (
                            <>
                              <span className="text-xs sm:text-sm font-black text-red-750 font-mono whitespace-nowrap">
                                ₹{(item.halfPrice ?? Math.round(item.price * 0.5)).toFixed(2)}
                              </span>
                              <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider block mt-0.5">
                                Half Plate
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                      <p className="text-[11px] text-gray-650 mt-1.5 leading-relaxed font-semibold pr-1 break-words">
                        {item.description}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDirectAddToCart(item)}
                      className="py-1.5 px-3.5 bg-red-700 hover:bg-red-850 text-white text-xs font-black uppercase tracking-wide rounded-xl transition shrink-0 self-center cursor-pointer shadow-3xs hover:shadow-2xs active:scale-95"
                    >
                      Add
                    </button>
                  </div>
                ))}

                {filteredMenuItems.length === 0 && (
                  <div className="text-center py-12 text-xs text-gray-500 font-bold italic">No delicious product matches found.</div>
                )}
              </div>

            </div>

            {/* STICKY BOTTOM BAR BUCKET BAR */}
            {totalCartQty > 0 && (
              <div 
                onClick={() => setIsCartOpen(true)}
                className="fixed bottom-4 left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] max-w-[416px] bg-red-700 hover:bg-red-850 text-white px-4 py-3 rounded-xl shadow-lg flex items-center justify-between z-[40] transition cursor-pointer active:scale-95 border-t border-red-650 font-sans"
              >
                <div className="flex items-center space-x-2">
                  <ShoppingBag className="h-4 w-4 text-[#FEF08A]" />
                  <span className="text-xs font-bold">{totalCartQty} {totalCartQty === 1 ? 'item' : 'items'} in basket</span>
                </div>
                <span className="text-xs font-extrabold text-[#FEF08A] flex items-center gap-1">
                  Review Order (₹{totalCartPrice.toFixed(2)}) <ChevronRight className="h-3.5 w-3.5" />
                </span>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* BASKET DRAWER PREPARATION */}
      {isCartOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-end justify-center">
          <div className="bg-white rounded-t-xl max-w-sm w-full p-5 shadow-2xl flex flex-col max-h-[80vh] animate-slideUp border-t border-[#B4B4B9]">
            
            <div className="flex justify-between items-center pb-3 border-b border-gray-200 mb-3">
              <span className="font-black text-sm text-gray-950 uppercase tracking-wider block font-display">
                Direct Dining Basket
              </span>
              <button 
                onClick={() => setIsCartOpen(false)}
                className="bg-gray-100 hover:bg-gray-200 text-gray-600 hover:text-gray-950 rounded-full p-1.5 cursor-pointer focus:outline-none transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="overflow-y-auto flex-grow space-y-2.5 pr-1 py-1">
              {cart.map(item => (
                <div key={item.id} className="bg-[#FFFDF9] border border-[#CACECE] rounded-xl p-3.5 flex flex-col gap-2 shadow-3xs">
                  <div className="flex justify-between items-center">
                    <div>
                      <h5 className="text-xs font-black text-gray-950">
                        {item.name} {item.portion ? `(${item.portion === 'half' ? 'Half' : 'Full'})` : ''}
                      </h5>
                      <span className="text-[11px] text-gray-650 font-bold block mt-0.5">₹{item.price.toFixed(2)} each</span>
                    </div>

                    <div className="flex items-center space-x-2 shrink-0">
                      <button 
                        onClick={() => adjustCartQty(item.id, -1)}
                        className="text-gray-500 hover:text-red-750 transition-colors cursor-pointer"
                      >
                        <MinusCircle className="h-5 w-5" />
                      </button>
                      <span className="text-xs font-black text-gray-950 w-5 text-center">{item.quantity}</span>
                      <button 
                        onClick={() => adjustCartQty(item.id, 1)}
                        className="text-gray-500 hover:text-red-750 transition-colors cursor-pointer"
                      >
                        <PlusCircle className="h-5 w-5" />
                      </button>
                      <button
                        onClick={() => handleRemoveFromCart(item.id)}
                        className="text-gray-400 hover:text-red-750 pl-1.5 transition-colors cursor-pointer"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  
                  {/* Inline Portion Selector for this cart item */}
                  {!(menuItems.find(m => m.id === item.menuItemId)?.isSinglePortion) && (
                    <div className="flex items-center justify-between border-t border-gray-100 pt-2 mt-1">
                      <span className="text-[10px] uppercase font-bold text-gray-400">Portion Size:</span>
                      <div className="inline-flex rounded-lg bg-gray-100 p-0.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => updateCartItemPortion(item.id, 'half')}
                          className={`px-3 py-1 text-[10px] font-black rounded-md transition-all cursor-pointer ${
                            item.portion === 'half'
                              ? 'bg-red-700 text-white shadow-3xs'
                              : 'text-gray-500 hover:text-gray-950'
                          }`}
                        >
                          Half Plate
                        </button>
                        <button
                          type="button"
                          onClick={() => updateCartItemPortion(item.id, 'full')}
                          className={`px-3 py-1 text-[10px] font-black rounded-md transition-all cursor-pointer ${
                            item.portion === 'full'
                              ? 'bg-red-700 text-white shadow-3xs'
                              : 'text-gray-500 hover:text-gray-950'
                          }`}
                        >
                          Full Plate
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="border-t border-gray-200 pt-4 mt-3 space-y-4">
              {/* Parcel / Takeaway Option */}
              <div className="bg-red-50/50 border border-red-100 rounded-xl p-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4 text-red-700 shrink-0" />
                  <div>
                    <span className="text-xs font-black text-gray-900 block">Make this Order as Parcel</span>
                    <span className="text-[10px] font-bold text-gray-500 block">Pack securely for takeaway</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsParcel(!isParcel)}
                  className={`px-3 py-1.5 text-[11px] font-black rounded-lg transition-all border cursor-pointer ${
                    isParcel
                      ? 'bg-red-700 border-red-750 text-white font-black shadow-3xs'
                      : 'bg-white border-[#CACECE] text-gray-600 hover:border-red-700 hover:text-red-700'
                  }`}
                >
                  {isParcel ? "Parcel Selected" : "Select Parcel"}
                </button>
              </div>

              <div>
                <label className="block text-[11px] font-black text-gray-700 uppercase tracking-wider mb-1.5">Pre-order / Prep Notes (optional)</label>
                <input
                  type="text"
                  value={kitchenNotes}
                  onChange={e => setKitchenNotes(e.target.value)}
                  placeholder="e.g. Extra sweet, mild spice, no ice..."
                  className="w-full bg-[#FFFDF9] border border-[#C0C0C6] rounded-xl px-3 py-2 text-xs font-semibold text-gray-950 focus:outline-none focus:ring-2 focus:ring-red-700/20 focus:border-red-700 placeholder-gray-500 shadow-3xs"
                />
              </div>

              <div className="flex justify-between items-center text-xs font-bold border-t border-gray-200 pt-3">
                <span className="text-gray-750 font-extrabold tracking-wide uppercase">Subtotal Accumulated:</span>
                <span className="text-base font-black text-red-750 font-mono">₹{totalCartPrice.toFixed(2)}</span>
              </div>

              <button
                onClick={handleSubmitOrder}
                className="w-full py-3 bg-red-700 hover:bg-red-800 text-white font-black text-xs uppercase tracking-widest rounded-xl shadow-md transition-all cursor-pointer hover:shadow-lg active:scale-99"
              >
                Send Order to Kitchen ✓
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Portion Selector Modal / Drawer */}
      {portionSelectorItem && (
        <div className="fixed inset-0 z-[60] bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl flex flex-col border border-[#B4B4B9] animate-slideUp">
            <div className="flex justify-between items-start mb-3">
              <div>
                <span className="text-[10px] uppercase font-black tracking-widest text-red-750 font-mono">
                  Select Plate Size
                </span>
                <h4 className="text-sm font-black text-gray-950 mt-0.5 leading-snug">
                  {portionSelectorItem.name}
                </h4>
              </div>
              <button
                onClick={() => setPortionSelectorItem(null)}
                className="bg-gray-150 hover:bg-gray-200 text-gray-500 p-1.5 rounded-full transition cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            
            <p className="text-[11px] text-gray-550 mb-4 font-semibold leading-relaxed">
              {portionSelectorItem.description || "Enjoy our delicious house recipe, crafted with care and fresh dairy ingredients."}
            </p>
            
             <div className="grid grid-cols-2 gap-3.5 mb-4">
              {/* Half Plate Option */}
              <button
                type="button"
                onClick={() => handleAddPortionToCart(portionSelectorItem, 'half')}
                className="p-3.5 bg-red-700 hover:bg-red-800 text-white rounded-xl transition flex flex-col items-center justify-center gap-1 cursor-pointer active:scale-98 shadow-3xs text-center"
              >
                <span className="text-[10px] uppercase font-black text-yellow-300 font-mono tracking-wider">
                  Half Plate
                </span>
                <span className="text-sm font-black">
                  ₹{(portionSelectorItem.halfPrice ?? Math.round(portionSelectorItem.price * 0.5)).toFixed(2)}
                </span>
              </button>
              
              {/* Full Plate Option */}
              <button
                type="button"
                onClick={() => handleAddPortionToCart(portionSelectorItem, 'full')}
                className="p-3.5 bg-[#FFFDF9] hover:bg-red-50 border border-[#CACECE] hover:border-red-300 text-gray-900 rounded-xl transition flex flex-col items-center justify-center gap-1 cursor-pointer active:scale-98 group shadow-3xs text-center"
              >
                <span className="text-[10px] uppercase font-black text-gray-400 group-hover:text-red-700 font-mono tracking-wider">
                  Full Plate
                </span>
                <span className="text-sm font-black text-gray-900 group-hover:text-red-800">
                  ₹{(portionSelectorItem.fullPrice ?? portionSelectorItem.price).toFixed(2)}
                </span>
              </button>
            </div>
            
            <button
              onClick={() => setPortionSelectorItem(null)}
              className="py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-black uppercase tracking-wider rounded-xl transition cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
