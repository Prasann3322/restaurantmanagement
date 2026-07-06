import React, { useState, useEffect, useRef } from 'react';
import { 
  ChefHat, LogIn, QrCode, ClipboardList, ShieldCheck, X, Eye, EyeOff, AlertCircle
} from 'lucide-react';
import { MenuItem, Table, Order, OrderItem, AppView, encodeTableNumber, decodeTableNumber } from './types';
import { INITIAL_MENU_ITEMS, INITIAL_TABLES, INITIAL_ORDERS } from './mockData';
import AdminDashboard from './components/AdminDashboard';
import CustomerPortal from './components/CustomerPortal';
import { ChefLogo } from './components/ChefLogo';
import { 
  supabase, 
  isSupabaseConfigured,
  mapDbMenuItemToClient, 
  mapClientMenuItemToDb, 
  mapDbOrderToClient, 
  mapClientOrderToDb, 
  mapDbTableToClient, 
  mapClientTableToDb 
} from './supabase';

// Double beep/chime chord using HTML5 Web Audio API (highly responsive, no external assets needed)
const playIncomingOrderSound = () => {
  try {
    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const playBeep = (freq: number, startTime: number, duration: number) => {
      const osc = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      
      osc.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, startTime);
      
      gainNode.gain.setValueAtTime(0, startTime);
      gainNode.gain.linearRampToValueAtTime(0.18, startTime + 0.05);
      gainNode.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
      
      osc.start(startTime);
      osc.stop(startTime + duration);
    };
    
    const now = audioCtx.currentTime;
    // Harmonious major notification chime group (C5 -> E5 -> G5)
    playBeep(523.25, now, 0.4);      // C5
    playBeep(659.25, now + 0.1, 0.4); // E5
    playBeep(783.99, now + 0.2, 0.6); // G5
  } catch (err) {
    console.warn("[Sound System] Web Audio API blocked or not supported on this device:", err);
  }
};

export default function App() {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    try {
      return (localStorage.getItem('gd_theme') as 'light' | 'dark') || 'light';
    } catch {
      return 'light';
    }
  });

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('gd_theme', theme);
  }, [theme]);

  useEffect(() => {
    menuItemsRef.current = menuItems;
  }, [menuItems]);

  useEffect(() => {
    tablesRef.current = tables;
  }, [tables]);

  useEffect(() => {
    ordersRef.current = orders;
  }, [orders]);

  // Global persistent states (Synced to Supabase with Live Synchronization)
  const [menuItems, setMenuItems] = useState<MenuItem[]>(INITIAL_MENU_ITEMS);
  const [tables, setTables] = useState<Table[]>(INITIAL_TABLES);
  const [orders, setOrders] = useState<Order[]>(INITIAL_ORDERS);

  const menuItemsRef = useRef<MenuItem[]>(menuItems);
  const tablesRef = useRef<Table[]>(tables);
  const ordersRef = useRef<Order[]>(orders);
  
  // Track tables we have initiated registration for to avoid duplicate concurrent writes
  const registeredTablesRef = useRef<Set<number>>(new Set());


  // Track previous orders to find new customer-added additions
  const prevOrdersRef = useRef<Order[]>(orders);

  // Navigation states
  const [currentView, setCurrentView] = useState<AppView>('admin-login');
  const [adminLoggedIn, setAdminLoggedIn] = useState<boolean>(false);
  const [simulatedTableNumber, setSimulatedTableNumber] = useState<number>(3);

  // Login form states
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  // Clean custom alert overlay to prevent sandboxed iframe blocks
  const [customAlert, setCustomAlert] = useState<{ isOpen: boolean; title: string; message: string }>({
    isOpen: false,
    title: '',
    message: ''
  });

  const triggerAlert = (title: string, message: string) => {
    setCustomAlert({ isOpen: true, title, message });
  };

  // Seeding function if database is empty
  const seedDatabaseIfNeeded = async (menuItemsEmpty: boolean, tablesEmpty: boolean, ordersEmpty: boolean) => {
    try {
      if (menuItemsEmpty) {
        console.log("Seeding menu_items...");
        const dbItems = INITIAL_MENU_ITEMS.map(mapClientMenuItemToDb);
        const { error } = await supabase.from('menu_items').insert(dbItems);
        if (error) console.error("Error seeding menu_items:", error);
      }
      if (tablesEmpty) {
        console.log("Seeding tables...");
        const dbTables = INITIAL_TABLES.map(t => mapClientTableToDb(t));
        const { error } = await supabase.from('tables').insert(dbTables);
        if (error) console.error("Error seeding tables:", error);
      }
      if (ordersEmpty) {
        console.log("Seeding orders...");
        const dbOrders = INITIAL_ORDERS.map(mapClientOrderToDb);
        const { error } = await supabase.from('orders').insert(dbOrders);
        if (error) console.error("Error seeding orders:", error);
      }
    } catch (err) {
      console.error("Error seeding Supabase database:", err);
    }
  };

  // Fetch all data initially
  const fetchAllData = async () => {
    try {
      const { data: dbMenuItems, error: errMenu } = await supabase.from('menu_items').select('*');
      if (!errMenu && dbMenuItems) {
        setMenuItems(dbMenuItems.map(mapDbMenuItemToClient));
      }

      const { data: dbTables, error: errTables } = await supabase.from('tables').select('*');
      if (!errTables && dbTables) {
        setTables(dbTables.map(mapDbTableToClient).sort((a: Table, b: Table) => a.number - b.number));
      }

      const { data: dbOrders, error: errOrders } = await supabase.from('orders').select('*').order('created_at', { ascending: false });
      if (!errOrders && dbOrders) {
        setOrders(dbOrders.map(mapDbOrderToClient));
      }

      const menuEmpty = !errMenu && (!dbMenuItems || dbMenuItems.length === 0);
      const tablesEmpty = !errTables && (!dbTables || dbTables.length === 0);
      const ordersEmpty = !errOrders && (!dbOrders || dbOrders.length === 0);

      if (menuEmpty || tablesEmpty || ordersEmpty) {
        await seedDatabaseIfNeeded(menuEmpty, tablesEmpty, ordersEmpty);
        // Refetch after seeding
        const { data: m } = await supabase.from('menu_items').select('*');
        if (m) setMenuItems(m.map(mapDbMenuItemToClient));
        const { data: t } = await supabase.from('tables').select('*');
        if (t) setTables(t.map(mapDbTableToClient).sort((a: Table, b: Table) => a.number - b.number));
        const { data: o } = await supabase.from('orders').select('*').order('created_at', { ascending: false });
        if (o) setOrders(o.map(mapDbOrderToClient));
      }
    } catch (err) {
      console.error("Error loading Supabase data:", err);
    }
  };

  // Real-time synchronization of menuItems, tables, and orders via server-sent events
  useEffect(() => {
    fetchAllData();

    const channel = supabase
      .channel('schema-db-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, async (payload: any) => {
        console.log('Realtime Order Change received:', payload);
        try {
          const { data: dbOrders, error } = await supabase
            .from('orders')
            .select('*')
            .order('created_at', { ascending: false });
          if (!error && dbOrders) {
            const mapped = dbOrders.map(mapDbOrderToClient);
            setOrders(mapped);

            if (payload.eventType === 'INSERT' || payload.eventType === 'UPSERT') {
              const mappedNewOrder = payload.new ? mapDbOrderToClient(payload.new) : mapped[0];
              playIncomingOrderSound();
              triggerBrowserNotification(mappedNewOrder);
            }
          }
        } catch (err) {
          console.error('Error handling realtime order update:', err);
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'menu_items' }, async () => {
        try {
          const { data, error } = await supabase.from('menu_items').select('*');
          if (!error && data) {
            setMenuItems(data.map(mapDbMenuItemToClient));
          }
        } catch (err) {
          console.error('Error handling realtime menu update:', err);
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tables' }, async () => {
        try {
          const { data, error } = await supabase.from('tables').select('*');
          if (!error && data) {
            setTables(data.map(mapDbTableToClient).sort((a: Table, b: Table) => a.number - b.number));
          }
        } catch (err) {
          console.error('Error handling realtime table update:', err);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Sync state modifications dynamically to Supabase
  const supabaseSetMenuItems = async (
    value: MenuItem[] | ((prev: MenuItem[]) => MenuItem[])
  ) => {
    const previousMenuItems = menuItemsRef.current;
    const nextMenuItems = typeof value === 'function'
      ? value(previousMenuItems)
      : value;

    setMenuItems(nextMenuItems);

    try {
      const nextIds = nextMenuItems.map(m => m.id);
      const itemsToDelete = previousMenuItems.filter(item => !nextIds.includes(item.id));
      if (itemsToDelete.length > 0) {
        await supabase.from('menu_items').delete().in('id', itemsToDelete.map(m => m.id));
      }
      if (nextMenuItems.length > 0) {
        await supabase.from('menu_items').upsert(nextMenuItems.map(mapClientMenuItemToDb));
      } else {
        await supabase.from('menu_items').delete().in('id', previousMenuItems.map(m => m.id));
      }
    } catch (err) {
      console.error("Error writing menu_items to Supabase:", err);
    }
  };

  const supabaseSetTables = async (
    value: Table[] | ((prev: Table[]) => Table[])
  ) => {
    const previousTables = tablesRef.current;
    const nextTables = typeof value === 'function'
      ? value(previousTables)
      : value;

    setTables(nextTables);

    try {
      const nextNumbers = nextTables.map(t => t.number);
      const tablesToDelete = previousTables.filter(t => !nextNumbers.includes(t.number));
      if (tablesToDelete.length > 0) {
        await supabase.from('tables').delete().in('table_number', tablesToDelete.map(t => t.number));
      }
      if (nextTables.length > 0) {
        await supabase.from('tables').upsert(nextTables.map(t => mapClientTableToDb(t)));
      } else {
        await supabase.from('tables').delete().in('table_number', previousTables.map(t => t.number));
      }
    } catch (err) {
      console.error("Error writing tables to Supabase:", err);
    }
  };

  const supabaseSetOrders = async (
    value: Order[] | ((prev: Order[]) => Order[])
  ) => {
    const previousOrders = ordersRef.current;
    const nextOrders = typeof value === 'function'
      ? value(previousOrders)
      : value;

    setOrders(nextOrders);

    try {
      const nextIds = nextOrders.map(o => o.id);
      const ordersToDelete = previousOrders.filter(o => !nextIds.includes(o.id));
      if (ordersToDelete.length > 0) {
        await supabase.from('orders').delete().in('id', ordersToDelete.map(o => o.id));
      }
      if (nextOrders.length > 0) {
        await supabase.from('orders').upsert(nextOrders.map(mapClientOrderToDb));
      } else {
        await supabase.from('orders').delete().in('id', previousOrders.map(o => o.id));
      }
    } catch (err) {
      console.error("Error writing orders to Supabase:", err);
    }
  };

  // Standard OS-level browser Push Notification trigger
  const triggerBrowserNotification = (order: Order) => {
    if (!('Notification' in window)) return;
    
    if (Notification.permission === 'granted') {
      const itemsText = order.items.map(it => `${it.quantity}x ${it.name}`).join(', ');
      
      const notification = new Notification(`Good Good Dairy 🥛 - New Dining Table Ticket! 🔔`, {
        body: `Table ${order.tableNumber} ordered ₹${order.totalAmount.toFixed(0)} worth of items: ${itemsText}.`,
        tag: `new-order-${order.id}`,
        requireInteraction: true
      });
      
      notification.onclick = () => {
        window.focus();
        setAdminLoggedIn(true);
        setCurrentView('admin-dashboard');
        notification.close();
      };
    }
  };

  // Watch orders array changes to detect new incoming customer creations
  useEffect(() => {
    const prevIds = new Set(prevOrdersRef.current.map(o => o.id));
    const newArrivals = orders.filter(o => !prevIds.has(o.id));
    prevOrdersRef.current = orders;

    if (newArrivals.length > 0) {
      const activeNewArrivals = newArrivals.filter(o => {
        const orderTime = new Date(o.createdAt).getTime();
        const timeDiff = Math.abs(Date.now() - orderTime);
        return timeDiff < 12000;
      });

      if (activeNewArrivals.length > 0) {
        activeNewArrivals.forEach(order => {
          playIncomingOrderSound();
          triggerBrowserNotification(order);
        });
      }
    }
  }, [orders]);

  // Handle browser URL parameters to trigger QR Scans (e.g. ?table=3, /table/3, or /customer)
  useEffect(() => {
    const handleUrlParams = async () => {
      const params = new URLSearchParams(window.location.search);
      let tableParam = params.get('table');
      
      // Also check pathname for route compatibility (/table/:id or /customer)
      const path = window.location.pathname;
      if (!tableParam) {
        const tableMatch = path.match(/^\/table\/([a-zA-Z0-9]+)/i);
        if (tableMatch) {
          tableParam = tableMatch[1];
        } else if (path.startsWith('/customer')) {
          // Default to table 3 if none specified for generic customer route
          tableParam = '3';
        }
      }

      if (tableParam) {
        const tableNum = decodeTableNumber(tableParam);
        if (tableNum !== null && tableNum > 0) {
          if (!tables.some(t => t.number === tableNum) && !registeredTablesRef.current.has(tableNum)) {
            registeredTablesRef.current.add(tableNum);
            const newTable: Table = { id: `table-id-auto-${Date.now()}`, number: tableNum, status: 'ready' };
            setTables(prev => [...prev, newTable].sort((a,b) => a.number - b.number));

            try {
              await supabase.from('tables').upsert(mapClientTableToDb(newTable));
            } catch (err) {
              console.error("Error auto-registering table in Supabase:", err);
            }
          }
          setSimulatedTableNumber(tableNum);
          setCurrentView('customer');
        } else {
          triggerAlert(
            "Access Restricted 🔒",
            "Direct table number input is not allowed to prevent unauthorized table access. Please scan the official table QR code to connect securely."
          );
          const newUrl = `${window.location.protocol}//${window.location.host}${window.location.pathname}`;
          window.history.replaceState({}, '', newUrl);
          setCurrentView('admin-login');
        }
      } else {
        // No table parameter! Check if admin is logged in
        setCurrentView(adminLoggedIn ? 'admin-dashboard' : 'admin-login');
      }
    };
    handleUrlParams();
    window.addEventListener('popstate', handleUrlParams);
    return () => window.removeEventListener('popstate', handleUrlParams);
  }, [tables, adminLoggedIn]);

  const resetToSampleData = async () => {
    await supabaseSetMenuItems(INITIAL_MENU_ITEMS);
    await supabaseSetTables(INITIAL_TABLES);
    await supabaseSetOrders(INITIAL_ORDERS);
  };

  const resetToEmptyState = async () => {
    await supabaseSetMenuItems([]);
    await supabaseSetTables([]);
    await supabaseSetOrders([]);
  };

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    if (password === 'admin123' || password === 'dairy123') {
      setAdminLoggedIn(true);
      setCurrentView('admin-dashboard');
      setPassword('');
    } else {
      setLoginError('Invalid Password. Please try again.');
    }
  };

  const handleCustomerPlaceOrder = async (cartItems: OrderItem[], mainNotes: string, isParcel: boolean = false, customerName?: string) => {
    const newOrder: Order = {
      id: `ord-${Math.floor(Date.now() / 10000) % 1000}-${Math.floor(Math.random() * 90) + 10}`,
      tableNumber: simulatedTableNumber,
      items: cartItems,
      totalAmount: cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0),
      status: 'pending',
      createdAt: new Date().toISOString(),
      isParcel: isParcel,
      customerName: customerName
    };
    
    setOrders(prev => [newOrder, ...prev]);

    try {
      await supabase.from('orders').insert(mapClientOrderToDb(newOrder));
    } catch (err) {
      console.error("Error inserting order to Supabase:", err);
    }
  };

  const handleSimulateTableRouteState = async (tableNumber: number) => {
    if (!tables.some(t => t.number === tableNumber) && !registeredTablesRef.current.has(tableNumber)) {
      registeredTablesRef.current.add(tableNumber);
      const newTable: Table = { id: `table-id-gen-${Date.now()}`, number: tableNumber, status: 'ready' };
      setTables(prev => [...prev, newTable].sort((a,b) => a.number - b.number));

      try {
        await supabase.from('tables').upsert(mapClientTableToDb(newTable));
      } catch (err) {
        console.error("Error registering table in Supabase:", err);
      }
    }
    setSimulatedTableNumber(tableNumber);
    setCurrentView('customer');
    
    const secureCode = encodeTableNumber(tableNumber);
    const newUrl = `${window.location.protocol}//${window.location.host}${window.location.pathname}?table=${secureCode}`;
    window.history.pushState({ path: newUrl }, '', newUrl);
  };

  const exitCustomerPortal = () => {
    // Clear url query params
    const newUrl = `${window.location.protocol}//${window.location.host}${window.location.pathname}`;
    window.history.pushState({ path: newUrl }, '', newUrl);
    
    if (adminLoggedIn) {
      setCurrentView('admin-dashboard');
    } else {
      setCurrentView('admin-login');
    }
  };

  return (
    <div id="application-container" className="min-h-screen bg-[#FFFDF9] text-gray-800 font-sans selection:bg-yellow-250 relative">

      {/* 🖥️ VIEW DISPATCHER */}
      <div id="app-view-dispatcher" className="relative">

        {/* VIEW 1: ADMIN LOGIN SCREEN */}
        {currentView === 'admin-login' && (
          <div id="owner-login-viewport" className="min-h-screen flex flex-col justify-center items-center py-16 px-4 sm:px-6 lg:px-8 bg-[#FFFDF9] dark:bg-slate-950 font-sans">
            <div className="max-w-md w-full text-center space-y-8 animate-fadeIn">
              
              {/* BRAND LOGO & RESTAURANT NAME */}
              <div className="flex flex-col items-center">
                {/* Clean beautiful logo */}
                <ChefLogo size={96} className="rounded-full shadow-lg transform hover:scale-105 transition-transform duration-300 bg-[#4c1d3f] border-4 border-yellow-400" />
                
                <h1 className="text-3xl font-black text-gray-950 dark:text-white tracking-tight mt-5 uppercase">
                  Good Good Dairy
                </h1>
                <p className="text-[11px] uppercase tracking-widest text-red-750 dark:text-red-400 font-black font-mono mt-1">
                  Kitchen Console & Billing
                </p>
              </div>

              {/* CARD BLOCK */}
              <div className="bg-white dark:bg-slate-900 border border-[#E2E2E8] dark:border-slate-800 shadow-xl rounded-3xl p-8 sm:p-10 text-left space-y-6 relative">
                
                {loginError && (
                  <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/40 text-red-850 dark:text-red-405 rounded-2xl px-4 py-3.5 text-xs flex items-start space-x-2 animate-shake">
                    <AlertCircle className="h-4.5 w-4.5 shrink-0 text-red-750" />
                    <span className="font-bold leading-relaxed">{loginError}</span>
                  </div>
                )}

                <form onSubmit={handleLoginSubmit} className="space-y-6">
                  {/* Password Input Block */}
                  <div>
                    <label className="block text-xs font-black text-gray-700 dark:text-slate-300 uppercase tracking-widest mb-2 font-mono">
                      Enter Security passkey
                    </label>
                    <div className="relative">
                      <input
  type={showPassword ? 'text' : 'password'}
  required
  value={password}
  onChange={e => setPassword(e.target.value)}
  placeholder="••••••••"
  className="w-full px-4 py-3.5 bg-[#FFFDF9] dark:bg-slate-950 border-2 border-[#DCDCE2] dark:border-slate-800 rounded-2xl font-bold text-sm tracking-widest text-gray-950 dark:text-white pr-12 focus:outline-none focus:ring-4 focus:ring-red-700/10 focus:border-red-700 transition-all placeholder:text-gray-400"
/>

                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-500 hover:text-gray-800 dark:hover:text-white cursor-pointer transition-colors"
                      >
                        {showPassword ? <EyeOff className="h-4.5 w-4.5" /> : <Eye className="h-4.5 w-4.5" />}
                      </button>
                    </div>
                  </div>

                  {/* Submit Button */}
                  <button
                    type="submit"
                    className="w-full py-4 bg-red-700 hover:bg-red-800 text-white font-black text-xs uppercase tracking-widest rounded-2xl shadow-md transition-all cursor-pointer hover:shadow-lg active:scale-99 hover:translate-y-[-1px]"
                  >
                    Authorize Access ✓
                  </button>
                </form>

              </div>

            </div>
          </div>
        )}

        {/* VIEW 2: ACTIVE ADMIN MONITOR DASHBOARD */}
        {currentView === 'admin-dashboard' && (
          <AdminDashboard
            menuItems={menuItems}
            setMenuItems={supabaseSetMenuItems}
            tables={tables}
            setTables={supabaseSetTables}
            orders={orders}
            setOrders={supabaseSetOrders}
            onLogout={() => {
              setAdminLoggedIn(false);
              setCurrentView('admin-login');
            }}
            onSimulateTable={handleSimulateTableRouteState}
            resetToSampleData={resetToSampleData}
            resetToEmptyState={resetToEmptyState}
            theme={theme}
            setTheme={setTheme}
          />
        )}

        {/* VIEW 3: CUSTOMER BRAND QR ORDERING PORTAL */}
        {currentView === 'customer' && (
          <CustomerPortal
            tableNumber={simulatedTableNumber}
            menuItems={menuItems}
            orders={orders}
            onPlaceOrder={handleCustomerPlaceOrder}
            onNavigateHome={exitCustomerPortal}
          />
        )}



      </div>

      {/* CUSTOM APP-LEVEL ALERT DIALOG Overlay */}
      {customAlert.isOpen && (
        <div id="custom-app-alert-overlay" className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-[9999] animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-red-50 flex flex-col items-center text-center">
            {/* Logo Badge Icon */}
            <div className="h-12 w-12 rounded-full bg-yellow-50 border border-yellow-305 flex items-center justify-center text-red-650 mb-4 text-lg font-bold">
              !
            </div>
            <h3 className="font-extrabold text-gray-950 font-serif text-md mb-2">{customAlert.title}</h3>
            <p className="text-xs text-gray-500 leading-relaxed mb-6">{customAlert.message}</p>
            <button
              onClick={() => setCustomAlert({ isOpen: false, title: '', message: '' })}
              className="w-full py-2.5 bg-red-700 hover:bg-red-800 text-white text-xs font-bold rounded-xl transition"
            >
              Okay, I Understood
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
