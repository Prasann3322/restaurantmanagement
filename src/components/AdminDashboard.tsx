import React, { useState, useRef, useEffect } from 'react';
import { jsPDF } from 'jspdf';
import { 
  ChefHat, Plus, Trash2, QrCode, ExternalLink, Database, Check, X, ClipboardList, 
  Search, Calendar, TrendingUp, Users, RefreshCw, BarChart3, Clock, HelpCircle,
  BellRing, LogOut, Menu, Settings, Printer, Receipt, ChevronRight, Upload, Sparkles,
  Edit
} from 'lucide-react';
import { MenuItem, Table, Order, OrderStatus, encodeTableNumber } from '../types';
import { ChefLogo } from './ChefLogo';
import { supabase } from '../supabase';

interface AdminDashboardProps {
  menuItems: MenuItem[];
  setMenuItems: React.Dispatch<React.SetStateAction<MenuItem[]>>;
  tables: Table[];
  setTables: React.Dispatch<React.SetStateAction<Table[]>>;
  orders: Order[];
  setOrders: React.Dispatch<React.SetStateAction<Order[]>>;
  onLogout: () => void;
  onSimulateTable: (tableNum: number) => void;
  resetToSampleData: () => void;
  resetToEmptyState: () => void;
  theme: 'light' | 'dark';
  setTheme: React.Dispatch<React.SetStateAction<'light' | 'dark'>>;
}

export default function AdminDashboard({
  menuItems,
  setMenuItems,
  tables,
  setTables,
  orders,
  setOrders,
  onLogout,
  onSimulateTable,
  resetToSampleData,
  resetToEmptyState,
  theme,
  setTheme
}: AdminDashboardProps) {
  const [activeTab, setActiveTab] = useState<'orders' | 'tables' | 'menu' | 'history' | 'settings'>('orders');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const [isAlertBannerDismissed, setIsAlertBannerDismissed] = useState<boolean>(() => {
    try {
      return localStorage.getItem('gd_alert_banner_dismissed') === 'true';
    } catch {
      return false;
    }
  });

  const dismissAlertBanner = () => {
    setIsAlertBannerDismissed(true);
    try {
      localStorage.setItem('gd_alert_banner_dismissed', 'true');
    } catch (e) {
      console.error(e);
    }
  };

  const [newTableNum, setNewTableNum] = useState<string>('');
  
  // Simple Form State for Menu Item
  const [isMenuFormOpen, setIsMenuFormOpen] = useState(false);
  const [formName, setFormName] = useState('');
  const [formPrice, setFormPrice] = useState('');
  const [formHalfPrice, setFormHalfPrice] = useState('');
  const [formFullPrice, setFormFullPrice] = useState('');
  const [formIsSinglePortion, setFormIsSinglePortion] = useState(false);
  const [formCategory, setFormCategory] = useState<string>('Thalis & Meals');
  const [customCategories, setCustomCategories] = useState<string[]>([]);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);

  // New States for Dish Image Upload and AI Generation
  const [imageOption, setImageOption] = useState<'upload' | 'ai'>('upload');
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string>('');
  const [aiImageUrl, setAiImageUrl] = useState<string>('');
  const [aiPrompt, setAiPrompt] = useState<string>('');
  const [isAiImageAccepted, setIsAiImageAccepted] = useState<boolean>(false);
  const [aiImageStatus, setAiImageStatus] = useState<'idle' | 'generating' | 'success' | 'error'>('idle');

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      openAlert("File Too Large", "Image size must be less than 5MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        setUploadedImageUrl(event.target.result as string);
        triggerToast("Dish image uploaded successfully!");
      }
    };
    reader.onerror = () => {
      openAlert("Upload Error", "Failed to read the image file.");
    };
    reader.readAsDataURL(file);
  };

  const handleGenerateAiImage = async () => {
    if (!formName.trim()) {
      openAlert("Dish Name Required", "Please enter a dish name first.");
      return;
    }
    setAiImageStatus('generating');
    setIsGeneratingImage(true);
    setIsAiImageAccepted(false);
    try {
      // Formulate the exact requested prompt format for the dish
      const defaultPrompt = `create a image of closeup shot of the dish ${formName.trim()} which we can use in menu`;
      const promptToUse = aiPrompt.trim() || defaultPrompt;
      
      const gImageUrl = await generateNanoBananaImage(promptToUse);
      setAiImageUrl(gImageUrl);
      setAiImageStatus('success');
      if (!aiPrompt) {
        setAiPrompt(promptToUse);
      }
    } catch (err) {
      console.error(err);
      setAiImageStatus('error');
    } finally {
      setIsGeneratingImage(false);
    }
  };

  const resetFormState = () => {
    setFormName('');
    setFormPrice('');
    setFormHalfPrice('');
    setFormFullPrice('');
    setFormIsSinglePortion(false);
    setFormCategory('Thalis & Meals');
    setNewCategoryName('');
    setFormDescription('');
    setImageOption('upload');
    setUploadedImageUrl('');
    setAiImageUrl('');
    setAiPrompt('');
    setIsAiImageAccepted(false);
    setAiImageStatus('idle');
  };

  // Practical "nano banana" image generation API proxy and local matching engine
  const generateNanoBananaImage = async (dishName: string): Promise<string> => {
    console.log(`[Nano Banana API] Requesting image generation for: "${dishName}"`);
    
    const cleanName = dishName.toLowerCase().trim();

    // 1. First Priority: Try to generate live artwork via real server-side Gemini API Integration
    try {
      const resp = await fetch('/api/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: dishName })
      });
      if (resp.ok) {
        const data = await resp.json();
        if (data.imageUrl) {
          console.log("[Nano Banana API] Real image generated successfully from Gemini model.");
          if (data.warning) {
            triggerToast(data.warning);
          }
          return data.imageUrl;
        }
      } else {
        const errorData = await resp.json().catch(() => ({}));
        console.warn("[Nano Banana API] Backend returned error (expected if key is unset), falling back to precise local lookup:", errorData.error || resp.statusText);
      }
    } catch (err) {
      console.warn("[Nano Banana API] Backend connection failed, falling back to precise local lookup:", err);
    }
    
    // 2. Second Priority: Precise local matching dictionary of high-res food mappings:
    const foodDatabase = [
      {
        keywords: ['pizza', 'cheese pizza', 'margherita', 'pepperoni', 'otc', 'paneer tikka pizza', 'chilli paneer pizza', 'cheese corn pizza', 'veg delight'],
        url: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=400&h=400&q=80'
      },
      {
        keywords: ['burger', 'hamburger', 'cheeseburger', 'veggie burger', 'paneer burger', 'cheese burger'],
        url: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=400&h=400&q=80'
      },
      {
        keywords: ['spring roll', 'spring rolls', 'roll', 'kathi roll', 'shawarma', 'wrap', 'rolls', 'veg roll', 'paneer roll'],
        url: 'https://images.unsplash.com/photo-1626700051175-6518c4793f4f?auto=format&fit=crop&w=400&h=400&q=80'
      },
      {
        keywords: ['sandwich', 'grilled sandwich', 'toastie', 'toast', 'bread', 'roti', 'naan', 'butter naan', 'tawa roti', 'tandoori roti', 'lachha paratha', 'missi roti', 'garlic bread', 'bun makkhan'],
        url: 'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?auto=format&fit=crop&w=400&h=400&q=80'
      },
      {
        keywords: ['noodles', 'noodle', 'chowmein', 'hakka noodles', 'schezwan noodles', 'ramen', 'spaghetti', 'chilli garlic noodles', 'singapore noodles', 'special noodles', 'cheese noodles'],
        url: 'https://images.unsplash.com/photo-1585032226651-759b368d7246?auto=format&fit=crop&w=400&h=400&q=80'
      },
      {
        keywords: ['momos', 'momo', 'dumpling', 'dumplings', 'dimsum', 'dim sum', 'wonton'],
        url: 'https://images.unsplash.com/photo-1563245372-f21724e3856d?auto=format&fit=crop&w=400&h=400&q=80'
      },
      {
        keywords: ['samosa', 'chaat', 'puri', 'golgappa', 'pani puri', 'bhel', 'bhalla', 'dahi bhalla', 'kachori', 'pakoda', 'snacks', 'tikkis', 'dahi', 'puri chhola', 'puri sabzi', 'matra chhola', 'tikki', 'khasta', 'aloo patty', 'paneer patty', 'veg cutlet', 'paneer cutlet', 'cheese cutlet', 'aloo paratha', 'paneer paratha', 'paratha', 'pav bhaji'],
        url: 'https://images.unsplash.com/photo-1601050690597-df056fb4ce78?auto=format&fit=crop&w=400&h=400&q=80'
      },
      {
        keywords: ['biryani', 'pulao', 'pilaf', 'pulav', 'fried rice', 'rice', 'jeera rice', 'plain rice', 'matar pulao', 'paneer pulao', 'veg biryani', 'paneer biryani'],
        url: 'https://images.unsplash.com/photo-1633945274405-b6c8069047b0?auto=format&fit=crop&w=400&h=400&q=80'
      },
      {
        keywords: ['paneer', 'shahi paneer', 'kadai paneer', 'paneer tikka', 'cottage cheese', 'tofu', 'matar paneer', 'kadhai paneer', 'handi paneer', 'paneer pasanda', 'paneer butter masala', 'khoya paneer', 'paneer do pyaza', 'paneer bhurji', 'paneer pakoda', 'cheese'],
        url: 'https://images.unsplash.com/photo-1631452180519-c014fe946bc7?auto=format&fit=crop&w=400&h=400&q=80'
      },
      {
        keywords: ['dal', 'dal makhani', 'dal tadka', 'chole', 'rajma', 'curry', 'gravy', 'masala', 'chhola masala', 'aloo dum', 'malai kofta', 'matar mushroom', 'mushroom do pyaza', 'mix veg', 'aloo jeera', 'bhindi masala', 'gobhi masala', 'thali', 'regular thali', 'economy thali', 'premium thali', 'food express thali', 'aloo gobhi', 'aloo gobi'],
        url: 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?auto=format&fit=crop&w=400&h=400&q=80'
      },
      {
        keywords: ['soup', 'manchow', 'sweet corn', 'hot and sour', 'tomato soup', 'lemon coriander', 'mushroom', 'veg manchow', 'mix soup'],
        url: 'https://images.unsplash.com/photo-1547592165-e1d17fed6005?auto=format&fit=crop&w=400&h=400&q=80'
      },
      {
        keywords: ['potato', 'chilli potato', 'chili potato', 'honey chilli potato', 'french fries', 'fries', 'potato wedges', 'potato chips', 'aloo chips', 'crispy potato'],
        url: 'https://images.unsplash.com/photo-1518013041235-14f3b29c991b?auto=format&fit=crop&w=400&h=400&q=80'
      },
      {
        keywords: ['manchurian', 'gobi manchurian', 'veg manchurian', 'wet manchurian', 'manchurian dry', 'schezwan', 'chinese', 'gobi', 'manchurian chinese', 'chinese platter'],
        url: 'https://images.unsplash.com/photo-1582576163090-09d3b6f8a969?auto=format&fit=crop&w=400&h=400&q=80'
      },
      {
        keywords: ['pasta', 'spaghetti', 'macaroni', 'penne', 'lasagna', 'white sauce pasta', 'red sauce pasta', 'masala pasta'],
        url: 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?auto=format&fit=crop&w=400&h=400&q=80'
      },
      {
        keywords: ['coffee', 'latte', 'cappuccino', 'tea', 'chai', 'cutting chai'],
        url: 'https://images.unsplash.com/photo-1541167760496-1628856ab772?auto=format&fit=crop&w=400&h=400&q=80'
      },
      {
        keywords: ['lassi', 'smoothie', 'shake', 'milkshake', 'buttermilk', 'chaas', 'sweet lassi', 'mango lassi', 'cold drink', 'mojito', 'virgin mojito', 'green apple mojito', 'orange blue mojito', 'shakes'],
        url: 'https://images.unsplash.com/photo-1572490122747-3968b75cc699?auto=format&fit=crop&w=400&h=400&q=80'
      },
      {
        keywords: ['jamun', 'gulab jamun', 'sweet', 'sweets', 'rasgulla', 'halwa', 'kheer', 'kulfi', 'dessert', 'rabri', 'ice cream', 'icecream', 'sundae', 'gelato', 'rasmalai', 'rajbhog', 'sweet curd'],
        url: 'https://images.unsplash.com/photo-1589118949245-7d38baf380d6?auto=format&fit=crop&w=400&h=400&q=80'
      },
      {
        keywords: ['salad', 'healthy', 'greens', 'fruit bowl'],
        url: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=400&h=400&q=80'
      }
    ];

    // Check if any of our precision database keywords are directly contained in the dish name.
    for (const entry of foodDatabase) {
      if (entry.keywords.some(keyword => cleanName.includes(keyword))) {
        return entry.url;
      }
    }

    // 3. Fallback: High-definition gourmet restaurant food presets based on name hashing (never city landscapes)
    const foodFallbackPresets = [
      'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=400&h=400&q=80',
      'https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?auto=format&fit=crop&w=400&h=400&q=80',
      'https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?auto=format&fit=crop&w=400&h=400&q=80',
      'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?auto=format&fit=crop&w=400&h=400&q=80',
      'https://images.unsplash.com/photo-1565958011703-44f9829ba187?auto=format&fit=crop&w=400&h=400&q=80'
    ];

    let hash = 0;
    for (let i = 0; i < dishName.length; i++) {
      hash = dishName.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % foodFallbackPresets.length;
    return foodFallbackPresets[index];
  };

  // Order History Tracker Filter States
  const [historySearch, setHistorySearch] = useState('');
  const [historyGrouping, setHistoryGrouping] = useState<'sequence' | 'table'>('sequence');
  const [historyTimeframe, setHistoryTimeframe] = useState<'today' | 'week' | 'month' | 'year'>('today');
  const [selectedHistoryOrderId, setSelectedHistoryOrderId] = useState<string | null>(null);

  // Sync selection to first matching record dynamically when filters or list updates
  useEffect(() => {
    if (activeTab === 'history') {
      const matchingLogs = orders.filter(o => {
        const matchesSearch = 
          o.tableNumber.toString().includes(historySearch) ||
          o.id.toLowerCase().includes(historySearch.toLowerCase()) ||
          o.items.some(it => it.name.toLowerCase().includes(historySearch.toLowerCase()));
        if (!matchesSearch) return false;

        const orderDate = new Date(o.createdAt);
        const now = new Date();
        const diffMs = now.getTime() - orderDate.getTime();
        const diffDays = diffMs / (1000 * 60 * 60 * 24);

        if (historyTimeframe === 'today') {
          return diffDays <= 1;
        } else if (historyTimeframe === 'week') {
          return diffDays <= 7;
        } else if (historyTimeframe === 'month') {
          return diffDays <= 30;
        } else {
          return diffDays <= 365;
        }
      });

      if (!selectedHistoryOrderId && matchingLogs.length > 0) {
        setSelectedHistoryOrderId(matchingLogs[0].id);
      } else if (selectedHistoryOrderId && !matchingLogs.some(o => o.id === selectedHistoryOrderId)) {
        setSelectedHistoryOrderId(matchingLogs.length > 0 ? matchingLogs[0].id : null);
      }
    }
  }, [activeTab, orders, historySearch, historyTimeframe, selectedHistoryOrderId]);

  // Interactive Table Modal Billing State
  const [selectedTableForBilling, setSelectedTableForBilling] = useState<number | null>(null);

  // States for manual bill editing
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [editSearchItem, setEditSearchItem] = useState<string>('');
  const [selectedMenuItemId, setSelectedMenuItemId] = useState<string>('');
  const [selectedPortion, setSelectedPortion] = useState<'half' | 'full'>('full');
  const [itemQuantity, setItemQuantity] = useState<number>(1);
  const [itemNotes, setItemNotes] = useState<string>('');

  const [customItemName, setCustomItemName] = useState<string>('');
  const [customItemPrice, setCustomItemPrice] = useState<string>('');

  const handleStartEditOrder = (order: Order) => {
    // Deep clone to avoid direct state mutation
    const cloned = JSON.parse(JSON.stringify(order));
    setEditingOrder(cloned);
    setEditSearchItem('');
    setSelectedMenuItemId('');
    setSelectedPortion('full');
    setItemQuantity(1);
    setItemNotes('');
    setCustomItemName('');
    setCustomItemPrice('');
  };

  const handleRemoveItemFromEdit = (itemId: string) => {
    if (!editingOrder) return;
    const updatedItems = editingOrder.items.filter(it => it.id !== itemId);
    const updatedTotal = updatedItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    setEditingOrder({
      ...editingOrder,
      items: updatedItems,
      totalAmount: updatedTotal
    });
  };

  const handleUpdateItemQtyInEdit = (itemId: string, newQty: number) => {
    if (!editingOrder || newQty <= 0) return;
    const updatedItems = editingOrder.items.map(it => {
      if (it.id === itemId) {
        return { ...it, quantity: newQty };
      }
      return it;
    });
    const updatedTotal = updatedItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    setEditingOrder({
      ...editingOrder,
      items: updatedItems,
      totalAmount: updatedTotal
    });
  };

  const handleAddMenuItemToEdit = () => {
    if (!editingOrder || !selectedMenuItemId) return;
    const item = menuItems.find(m => m.id === selectedMenuItemId);
    if (!item) return;

    let price = item.price;
    if (!item.isSinglePortion) {
      price = selectedPortion === 'half' ? (item.halfPrice || item.price) : (item.fullPrice || item.price);
    }

    // Check if item with same ID and portion already exists to increment qty
    const existingIndex = editingOrder.items.findIndex(
      it => it.menuItemId === item.id && it.portion === (item.isSinglePortion ? undefined : selectedPortion)
    );

    let updatedItems;
    if (existingIndex > -1) {
      updatedItems = editingOrder.items.map((it, idx) => {
        if (idx === existingIndex) {
          return { ...it, quantity: it.quantity + itemQuantity };
        }
        return it;
      });
    } else {
      const newItem = {
        id: `edit-item-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        menuItemId: item.id,
        name: item.name,
        price: price,
        quantity: itemQuantity,
        notes: itemNotes,
        portion: item.isSinglePortion ? undefined : selectedPortion
      };
      updatedItems = [...editingOrder.items, newItem];
    }

    const updatedTotal = updatedItems.reduce((sum, i) => sum + (i.price * i.quantity), 0);
    setEditingOrder({
      ...editingOrder,
      items: updatedItems,
      totalAmount: updatedTotal
    });

    // Reset input fields
    setSelectedMenuItemId('');
    setItemQuantity(1);
    setItemNotes('');
    triggerToast(`Added ${item.name} to editing order.`);
  };

  const handleAddCustomItemToEdit = () => {
    if (!editingOrder || !customItemName.trim()) {
      openAlert("Missing Details", "Please enter a valid product name.");
      return;
    }
    const price = parseFloat(customItemPrice);
    if (isNaN(price) || price < 0) {
      openAlert("Invalid Price", "Please enter a valid price.");
      return;
    }

    const newItem = {
      id: `custom-item-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      menuItemId: 'custom-unlisted',
      name: customItemName.trim(),
      price: price,
      quantity: 1,
      notes: 'Manually Added Custom Product'
    };

    const updatedItems = [...editingOrder.items, newItem];
    const updatedTotal = updatedItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    setEditingOrder({
      ...editingOrder,
      items: updatedItems,
      totalAmount: updatedTotal
    });

    setCustomItemName('');
    setCustomItemPrice('');
    triggerToast(`Added custom "${newItem.name}" to editing order.`);
  };

  const handleSaveEditedOrder = () => {
    if (!editingOrder) return;
    const finalTotal = editingOrder.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const finalized = {
      ...editingOrder,
      totalAmount: finalTotal
    };

    setOrders(prev => prev.map(o => o.id === finalized.id ? finalized : o));
    setEditingOrder(null);
    triggerToast("Order ticket and billing amount updated successfully!");
  };

  // States and Handlers for Direct Order Creation (Counter / Manager's Table)
  const [createOrderModalOpen, setCreateOrderModalOpen] = useState(false);
  const [createOrderTableNumber, setCreateOrderTableNumber] = useState(0); // 0 = Manager's Table / Counter
  const [createOrderCustomerName, setCreateOrderCustomerName] = useState('');
  const [createOrderIsParcel, setCreateOrderIsParcel] = useState(false);
  const [createOrderItems, setCreateOrderItems] = useState<any[]>([]);
  const [createOrderSearchItem, setCreateOrderSearchItem] = useState('');
  const [createOrderSelectedMenuItemId, setCreateOrderSelectedMenuItemId] = useState('');
  const [createOrderSelectedPortion, setCreateOrderSelectedPortion] = useState<'half' | 'full'>('full');
  const [createOrderItemQuantity, setCreateOrderItemQuantity] = useState(1);
  const [createOrderItemNotes, setCreateOrderItemNotes] = useState('');
  const [createOrderCustomItemName, setCreateOrderCustomItemName] = useState('');
  const [createOrderCustomItemPrice, setCreateOrderCustomItemPrice] = useState('');

  const handleOpenCreateOrderModal = () => {
    setCreateOrderModalOpen(true);
    setCreateOrderTableNumber(0); // Default to Manager's Table / Counter (Table 0)
    setCreateOrderCustomerName('');
    setCreateOrderIsParcel(false);
    setCreateOrderItems([]);
    setCreateOrderSearchItem('');
    setCreateOrderSelectedMenuItemId('');
    setCreateOrderSelectedPortion('full');
    setCreateOrderItemQuantity(1);
    setCreateOrderItemNotes('');
    setCreateOrderCustomItemName('');
    setCreateOrderCustomItemPrice('');
  };

  const handleAddItemToCreateOrder = () => {
    if (!createOrderSelectedMenuItemId) return;
    const item = menuItems.find(m => m.id === createOrderSelectedMenuItemId);
    if (!item) return;

    let price = item.price;
    if (!item.isSinglePortion) {
      price = createOrderSelectedPortion === 'half' ? (item.halfPrice || item.price) : (item.fullPrice || item.price);
    }

    // Check if item with same ID and portion already exists to increment qty
    const existingIndex = createOrderItems.findIndex(
      it => it.menuItemId === item.id && it.portion === (item.isSinglePortion ? undefined : createOrderSelectedPortion)
    );

    if (existingIndex > -1) {
      setCreateOrderItems(prev => prev.map((it, idx) => {
        if (idx === existingIndex) {
          return { ...it, quantity: it.quantity + createOrderItemQuantity };
        }
        return it;
      }));
    } else {
      const newItem = {
        id: `create-item-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        menuItemId: item.id,
        name: item.name,
        price: price,
        quantity: createOrderItemQuantity,
        notes: createOrderItemNotes,
        portion: item.isSinglePortion ? undefined : createOrderSelectedPortion
      };
      setCreateOrderItems(prev => [...prev, newItem]);
    }

    // Reset fields
    setCreateOrderSelectedMenuItemId('');
    setCreateOrderItemQuantity(1);
    setCreateOrderItemNotes('');
    setCreateOrderSearchItem('');
    triggerToast(`Added ${item.name} to direct bill.`);
  };

  const handleAddCustomItemToCreateOrder = () => {
    if (!createOrderCustomItemName.trim()) {
      openAlert("Missing Details", "Please enter a valid product name.");
      return;
    }
    const price = parseFloat(createOrderCustomItemPrice);
    if (isNaN(price) || price < 0) {
      openAlert("Invalid Price", "Please enter a valid price.");
      return;
    }

    const newItem = {
      id: `custom-item-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      menuItemId: 'custom-unlisted',
      name: createOrderCustomItemName.trim(),
      price: price,
      quantity: 1,
      notes: 'Manually Added Custom Product'
    };

    setCreateOrderItems(prev => [...prev, newItem]);
    setCreateOrderCustomItemName('');
    setCreateOrderCustomItemPrice('');
    triggerToast(`Added custom "${newItem.name}" to direct bill.`);
  };

  const handleRemoveItemFromCreateOrder = (itemId: string) => {
    setCreateOrderItems(prev => prev.filter(it => it.id !== itemId));
  };

  const handleUpdateItemQtyInCreateOrder = (itemId: string, newQty: number) => {
    if (newQty <= 0) return;
    setCreateOrderItems(prev => prev.map(it => {
      if (it.id === itemId) {
        return { ...it, quantity: newQty };
      }
      return it;
    }));
  };

  const handleSaveCreatedOrder = (initialStatus: 'pending' | 'preparing' | 'completed' = 'preparing') => {
    if (createOrderItems.length === 0) {
      openAlert("Empty Order", "Please add at least one item to create a bill.");
      return;
    }

    const totalAmount = createOrderItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const newId = `ord-${Date.now().toString().slice(-4)}${Math.floor(Math.random() * 10)}`;

    const newOrder: Order = {
      id: newId,
      tableNumber: createOrderTableNumber,
      customerName: createOrderCustomerName.trim() || undefined,
      isParcel: createOrderIsParcel,
      items: createOrderItems,
      totalAmount: totalAmount,
      status: initialStatus,
      createdAt: new Date().toISOString()
    };

    setOrders(prev => [newOrder, ...prev]);
    void supabase.from('orders').upsert(newOrder as any);
    setCreateOrderModalOpen(false);
    triggerToast(`Created new direct bill for ${createOrderTableNumber === 0 ? "Counter" : `Table ${createOrderTableNumber}`}!`);
  };

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Custom confirmation modal state to avoid iframe blocks on window.confirm
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmText: string;
    cancelText: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    confirmText: 'Confirm',
    cancelText: 'Cancel',
    onConfirm: () => {}
  });

  // Custom alert modal state to avoid iframe blocks on window.alert
  const [alertModal, setAlertModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
  }>({
    isOpen: false,
    title: '',
    message: ''
  });

  const [notificationPermission, setNotificationPermission] = useState<string>(
    'Notification' in window ? Notification.permission : 'unsupported'
  );

  useEffect(() => {
    if ('Notification' in window) {
      setNotificationPermission(Notification.permission);
    }
  }, []);

  const requestNotificationPermissionAndTest = () => {
    if (!('Notification' in window)) {
      triggerToast("Browser notifications are not supported by this device.");
      return;
    }

    triggerToast("Requesting browser notifications permission...");
    Notification.requestPermission().then(permission => {
      setNotificationPermission(permission);
      if (permission === 'granted') {
        dismissAlertBanner();
        triggerToast("Notification permission successfully granted!");
        new Notification("Good Good Dairy 🔔 Approved!", {
          body: "Great! Beautiful push notifications are now integrated and active.",
          requireInteraction: false
        });
      } else if (permission === 'denied') {
        triggerToast("Permissions were denied. Enable them in your browser site settings.");
      }
    });
  };

  const sendTestNotification = () => {
    // Play our pleasant kitchen beep sound
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
      playBeep(523.25, now, 0.4);      // C5
      playBeep(659.25, now + 0.1, 0.4); // E5
      playBeep(783.99, now + 0.2, 0.6); // G5
    } catch {}

    if (!('Notification' in window)) {
      triggerToast("Browser notifications are not supported on this browser.");
      return;
    }

    if (Notification.permission === 'granted') {
      new Notification("Good Good Dairy 🔔 Connection Tested", {
        body: "Live kitchen sync: Sample incoming dining table ticket simulated.",
        requireInteraction: false
      });
      triggerToast("Test broadcast fired to notification center!");
    } else {
      requestNotificationPermissionAndTest();
    }
  };

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  const openConfirm = (title: string, message: string, onConfirm: () => void, confirmText = "Confirm", cancelText = "Cancel") => {
    setConfirmModal({
      isOpen: true,
      title,
      message,
      confirmText,
      cancelText,
      onConfirm: () => {
        onConfirm();
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  const openAlert = (title: string, message: string) => {
    setAlertModal({
      isOpen: true,
      title,
      message
    });
  };

  // Extract initials automatically for a dish to avoid using emojis
  const generateInitials = (title: string): string => {
    const words = title.trim().split(/\s+/);
    if (words.length >= 2) {
      return (words[0][0] + words[1][0]).toUpperCase();
    }
    return title.slice(0, 2).toUpperCase();
  };

  // Filter Active orders for columns (excluding completed ones)
  const activeOrdersCount = orders.filter(o => o.status !== 'completed').length;
  
  // All active preparing or pending orders
  const queuedOrders = orders.filter(o => o.status === 'pending');
  const preparingOrders = orders.filter(o => o.status === 'preparing');
  const servedOrders = orders.filter(o => o.status === 'served');

  const updateOrderStatus = async (orderId: string, nextStatus: OrderStatus) => {
    const updated = orders.map(ord => ord.id === orderId ? { ...ord, status: nextStatus } : ord);
    setOrders(updated);
    const target = updated.find(ord => ord.id === orderId);
    if (target) {
      await supabase.from('orders').upsert(target as any);
    }
    triggerToast(`Order status updated to ${nextStatus.toUpperCase()}`);
  };

  const deleteOrder = (orderId: string) => {
    openConfirm(
      "Confirm Order Cancellation",
      `Are you sure you want to permanently delete order ticket #${orderId.slice(4)}? This cannot be undone.`,
      async () => {
        const remaining = orders.filter(o => o.id !== orderId);
        setOrders(remaining);
        await supabase.from('orders').delete().in('id', [orderId]);
        triggerToast("Order has been deleted.");
      },
      "Yes, Delete Ticket",
      "Keep Order"
    );
  };

  const handleAddTable = (e: React.FormEvent) => {
    e.preventDefault();
    const num = parseInt(newTableNum);
    if (!num || isNaN(num) || num <= 0) {
      openAlert("Invalid Desk Entry", "Please enter a valid table number (positive integer).");
      return;
    }
    if (tables.some(t => t.number === num)) {
      openAlert("Desk Already Exists", `Table Desk ${num} is already registered.`);
      return;
    }
    const newTable: Table = {
      id: `table-${Date.now()}`,
      number: num,
      status: 'ready'
    };
    void setTables((prev: Table[]) => [...prev, newTable].sort((a: Table, b: Table) => a.number - b.number));
    setNewTableNum('');
    triggerToast(`Table ${num} added.`);
  };

  const handleDeleteTable = (tableId: string, tableNum: number) => {
    openConfirm(
      "Delete Dining Desk?",
      `Are you sure you want to delete Table No. ${tableNum}? This will remove its registered QR Code configuration.`,
      () => {
        void setTables((prev: Table[]) => prev.filter((t: Table) => t.id !== tableId));
        triggerToast(`Table ${tableNum} removed.`);
      },
      "Yes, Delete Table",
      "Cancel"
    );
  };

  const handleCreateMenuItem = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsedPrice = parseFloat(formPrice);
    if (!formName.trim() || isNaN(parsedPrice) || parsedPrice <= 0) {
      openAlert("Invalid Inputs", "A valid product name and positive price (₹) are required.");
      return;
    }

    let parsedHalfPrice: number | undefined = undefined;
    let parsedFullPrice: number | undefined = undefined;

    if (!formIsSinglePortion) {
      parsedHalfPrice = formHalfPrice ? parseFloat(formHalfPrice) : Math.round(parsedPrice * 0.5);
      parsedFullPrice = formFullPrice ? parseFloat(formFullPrice) : parsedPrice;

      if ((formHalfPrice && (isNaN(parsedHalfPrice) || parsedHalfPrice <= 0)) || (formFullPrice && (isNaN(parsedFullPrice) || parsedFullPrice <= 0))) {
        openAlert("Invalid Inputs", "Please enter positive half and full plate prices.");
        return;
      }
    }

    let finalCategory = formCategory;
    if (formCategory === '__NEW__') {
      const trimmed = newCategoryName.trim();
      if (!trimmed) {
        openAlert("Category Required", "Please enter a name for the new cuisine group, or select an existing one.");
        return;
      }
      finalCategory = trimmed;
      if (!customCategories.includes(trimmed)) {
        setCustomCategories(prev => [...prev, trimmed]);
      }
    }

    setIsGeneratingImage(true);
    triggerToast("Registering dish...");

    try {
      const finalImageUrl = uploadedImageUrl;

      const itemInitials = generateInitials(formName);
      const newItem: MenuItem = {
        id: `menu-${Date.now()}`,
        name: formName.trim(),
        price: formIsSinglePortion ? parsedPrice : (parsedFullPrice ?? parsedPrice), // If single, use the base price
        halfPrice: formIsSinglePortion ? undefined : parsedHalfPrice,
        fullPrice: formIsSinglePortion ? undefined : parsedFullPrice,
        isSinglePortion: formIsSinglePortion,
        category: finalCategory,
        description: '', // completely omitted description
        image: itemInitials,
        imageUrl: finalImageUrl
      };

      await setMenuItems((prev: MenuItem[]) => [...prev, newItem]);
      resetFormState();
      setIsMenuFormOpen(false);
      triggerToast(`"${newItem.name}" registration complete!`);
    } catch (err) {
      console.error(err);
      triggerToast("Error processing dish image or saving. Try again.");
    } finally {
      setIsGeneratingImage(false);
    }
  };

  const handleDeleteMenuItem = (id: string, name: string) => {
    openConfirm(
      "Delete Menu Item",
      `Are you sure you want to permanently delete "${name}" from the menu?`,
      () => {
        void setMenuItems((prev: MenuItem[]) => prev.filter((item: MenuItem) => item.id !== id));
        triggerToast(`"${name}" deleted.`);
      },
      "Yes, Delete Item",
      "Cancel"
    );
  };

  // Calculations for billing a specific table
  const tableActiveOrders = selectedTableForBilling !== null
    ? orders.filter(o => o.tableNumber === selectedTableForBilling && o.status !== 'completed')
    : [];

  const tableGrandTotal = tableActiveOrders.reduce((sum, ord) => sum + ord.totalAmount, 0);

  const handleSettleTableInvoice = () => {
    if (selectedTableForBilling === null) return;
    openConfirm(
      "Settle & Direct Close Orders",
      `Are you sure you want to mark all active orders for Table ${selectedTableForBilling} as paid and complete? Total billing is ₹${tableGrandTotal.toFixed(2)}.`,
      () => {
        setOrders(prev => prev.map(ord => {
          if (ord.tableNumber === selectedTableForBilling && ord.status !== 'completed') {
            return { ...ord, status: 'completed' as const };
          }
          return ord;
        }));
        triggerToast(`Table ${selectedTableForBilling} bills settled successfully.`);
        setSelectedTableForBilling(null);
      },
      "Yes, Collect Bill & Clear Desk",
      "Cancel"
    );
  };

  const downloadQRBadge = (tableNum: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = 300;
    canvas.height = 380;

    // Red, Yellow and White palette in generated Badge PDF
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, 300, 380);
    ctx.strokeStyle = '#B91C1C'; // Red Border
    ctx.lineWidth = 10;
    ctx.strokeRect(5, 5, 290, 370);

    ctx.fillStyle = '#B91C1C'; // Crimson header band
    ctx.fillRect(10, 10, 280, 70);

    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = 'center';
    ctx.font = 'bold 18px "Space Grotesk", sans-serif';
    ctx.fillText("GOOD GOOD DAIRY", 150, 38);
    ctx.font = 'bold 11px "Inter", sans-serif';
    ctx.fillStyle = '#FBBF24'; // Golden Yellow accent text
    ctx.fillText(`TABLE ${tableNum} - ORDER HERE`, 150, 58);

    const publicOrigin = window.location.origin.replace('-dev-', '-pre-');
    const url = `${publicOrigin}?table=${encodeTableNumber(tableNum)}`;
    const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(url)}`;
    
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      ctx.drawImage(img, 70, 95, 160, 160);
      
      ctx.fillStyle = '#111827';
      ctx.font = 'bold 12px "Inter", sans-serif';
      ctx.fillText("SCAN WITH SMARTPHONE", 150, 290);
      ctx.fillStyle = '#B91C1C';
      ctx.font = 'bold 11px "Inter", sans-serif';
      ctx.fillText("Scan Menu & Order Food Online", 150, 310);
      ctx.fillStyle = '#4B5563';
      ctx.font = '500 10px "Inter", sans-serif';
      ctx.fillText("Self-Serve Ordering Desk • Auto Cook Queue", 150, 330);

      const link = document.createElement('a');
      link.download = `GoodGoodDairy_Table${tableNum}_QR_Badge.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    };
    img.src = qrApiUrl;
  };

  // State trigger alerts
  const handleTriggerResetToSample = () => {
    openConfirm(
      "Reset Database to Presets",
      "Reset the entire menu registry, tables database, and orders history back to default sample records? Active entries will be replaced.",
      () => {
        resetToSampleData();
        triggerToast("Database restored to default presets.");
      },
      "Yes, Restore Presets",
      "Cancel"
    );
  };

  const handleTriggerPruneState = () => {
    openConfirm(
      "Prune Entire System Database",
      "Are you sure you want to delete all menu items, dining desks, and order logs? This action is irreversible.",
      () => {
        resetToEmptyState();
        triggerToast("All database tables pruned successfully.");
      },
      "Yes, Delete All",
      "Cancel"
    );
  };

  const handlePrintReceipt = (invoiceOrder: Order) => {
    // Generate beautiful thermal-styled receipt PDF using jsPDF
    const itemHeight = invoiceOrder.items.length * 7;
    const totalHeight = 120 + itemHeight; // Auto-calculated height based on items
    
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: [80, Math.max(140, totalHeight)]
    });

    // Logo & Header styling
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(13);
    pdf.setTextColor(185, 28, 28); // #b91c1c
    pdf.text('GOOD GOOD DAIRY', 40, 12, { align: 'center' });

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8);
    pdf.setTextColor(71, 85, 105);
    pdf.text('Gourmet Diner Order Hub', 40, 16, { align: 'center' });

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(8);
    pdf.setTextColor(100, 116, 139);
    pdf.text('--- TAX INVOICE RECEIPT ---', 40, 21, { align: 'center' });

    // Divider Line
    pdf.setLineWidth(0.2);
    pdf.setDrawColor(203, 213, 225);
    pdf.line(8, 24, 72, 24);

    // Meta Fields
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8);
    pdf.setTextColor(15, 23, 42);
    
    let y = 29;
    const drawRow = (label: string, value: string) => {
      pdf.setFont('helvetica', 'normal');
      pdf.text(label, 8, y);
      pdf.setFont('helvetica', 'bold');
      pdf.text(value, 72, y, { align: 'right' });
      y += 4.5;
    };

    drawRow('Receipt ID:', `#${invoiceOrder.id.toUpperCase()}`);
    drawRow('Table / Desk:', `Desk No. ${invoiceOrder.tableNumber}`);
    drawRow('Date & Time:', `${new Date(invoiceOrder.createdAt).toLocaleDateString()} ${new Date(invoiceOrder.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`);
    if (invoiceOrder.customerName) {
      drawRow('Guest Name:', invoiceOrder.customerName);
    }
    drawRow('Status:', invoiceOrder.status.toUpperCase());

    // Divider Line before items
    pdf.line(8, y, 72, y);
    y += 4.5;

    // Header for columns
    pdf.setFont('helvetica', 'bold');
    pdf.text('Item Description', 8, y);
    pdf.text('Qty', 50, y, { align: 'center' });
    pdf.text('Amount', 72, y, { align: 'right' });
    
    y += 3;
    pdf.line(8, y, 72, y);
    y += 5;

    // Item Records
    pdf.setFont('helvetica', 'normal');
    invoiceOrder.items.forEach(it => {
      // Handle wrapping or truncation for long names
      const truncatedName = it.name.length > 20 ? it.name.substring(0, 18) + '..' : it.name;
      pdf.text(truncatedName, 8, y);
      pdf.text(`x${it.quantity}`, 50, y, { align: 'center' });
      pdf.text(`Rs. ${(it.price * it.quantity).toFixed(2)}`, 72, y, { align: 'right' });
      y += 4.5;
      
      if (it.notes) {
        pdf.setFont('helvetica', 'oblique');
        pdf.setFontSize(7);
        pdf.setTextColor(100, 116, 139);
        pdf.text(`* ${it.notes}`, 10, y);
        pdf.setFontSize(8);
        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(15, 23, 42);
        y += 4;
      }
    });

    // Divider Line before summary calculation
    pdf.line(8, y, 72, y);
    y += 5;

    const packingCharge = invoiceOrder.totalAmount > 40 ? 20.00 : 0.00;
    const netSubtotal = (invoiceOrder.totalAmount - packingCharge) / 1.05;
    const cgst = netSubtotal * 0.025;
    const sgst = netSubtotal * 0.025;

    const drawCalcRow = (label: string, value: number) => {
      pdf.setFont('helvetica', 'normal');
      pdf.text(label, 8, y);
      pdf.text(`Rs. ${value.toFixed(2)}`, 72, y, { align: 'right' });
      y += 4.5;
    };

    drawCalcRow('Subtotal:', netSubtotal);
    drawCalcRow('Packaging Charge:', packingCharge);
    drawCalcRow('CGST (2.5%):', cgst);
    drawCalcRow('SGST (2.5%):', sgst);

    // Double line or styled rect for Grand Total
    y += 1;
    pdf.rect(8, y, 64, 8);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(9);
    pdf.text('GRAND TOTAL:', 11, y + 5.5);
    pdf.text(`Rs. ${invoiceOrder.totalAmount.toFixed(2)}`, 69, y + 5.5, { align: 'right' });
    y += 14;

    // Footer lines
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(7);
    pdf.setTextColor(71, 85, 105);
    pdf.text('Thank you for dining at Good Good Dairy!', 40, y, { align: 'center' });
    pdf.setFont('helvetica', 'bold');
    pdf.text('--- TRANSACTION SUCCESSFUL ---', 40, y + 4, { align: 'center' });

    // Save PDF directly to trigger automatic download
    pdf.save(`receipt-${invoiceOrder.id}.pdf`);
    triggerToast(`Receipt PDF for order #${invoiceOrder.id.slice(4)} downloaded successfully!`);
  };

  const handlePrintReport = (timeframe: 'today' | 'week' | 'month' | 'year', filteredOrders: Order[]) => {
    // Generate high-resolution business PDF report using jsPDF
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const completedOrders = filteredOrders.filter(o => o.status === 'completed');
    const totalRevenue = completedOrders.reduce((sum, o) => sum + o.totalAmount, 0);
    const totalItemsSold = filteredOrders.reduce(
      (sum, o) => sum + o.items.reduce((iSum, it) => iSum + it.quantity, 0), 0
    );
    const avgTicketSize = filteredOrders.length > 0 ? (totalRevenue / filteredOrders.length) : 0;

    const timeframeLabel = timeframe === 'today' ? 'Today' : timeframe === 'week' ? 'Last 7 Days' : timeframe === 'month' ? 'Last 30 Days' : 'Last 365 Days';

    // Header Branding Section
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(22);
    pdf.setTextColor(185, 28, 28); // #b91c1c
    pdf.text('GOOD GOOD DAIRY', 105, 22, { align: 'center' });

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(11);
    pdf.setTextColor(71, 85, 105);
    pdf.text(`${timeframeLabel.toUpperCase()} SALES & ORDER RECORD REPORT`, 105, 29, { align: 'center' });

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8);
    pdf.setTextColor(148, 163, 184);
    pdf.text(`Generated on: ${new Date().toLocaleString()}`, 105, 34, { align: 'center' });

    // Line separator
    pdf.setLineWidth(0.4);
    pdf.setDrawColor(185, 28, 28);
    pdf.line(15, 38, 195, 38);

    // Dynamic stats cards grid
    const cardWidth = 41;
    const cardHeight = 18;
    const startX = 15;
    const cardY = 44;

    const drawCard = (idx: number, label: string, val: string) => {
      const cx = startX + idx * 45;
      pdf.setFillColor(248, 250, 252); // light off-white bg
      pdf.setDrawColor(226, 232, 240); // borders
      pdf.setLineWidth(0.25);
      pdf.roundedRect(cx, cardY, cardWidth, cardHeight, 2, 2, 'FD');

      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(7);
      pdf.setTextColor(100, 116, 139);
      pdf.text(label, cx + cardWidth / 2, cardY + 5.5, { align: 'center' });

      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(11);
      pdf.setTextColor(15, 23, 42);
      pdf.text(val, cx + cardWidth / 2, cardY + 13, { align: 'center' });
    };

    drawCard(0, 'TOTAL VOLUME', `${filteredOrders.length} Invoices`);
    drawCard(1, 'GROSS REVENUE', `Rs. ${totalRevenue.toFixed(2)}`);
    drawCard(2, 'AVG TICKET SIZE', `Rs. ${avgTicketSize.toFixed(2)}`);
    drawCard(3, 'ITEMS PREPARED', `${totalItemsSold} Portions`);

    // Ledger Title
    let y = 72;
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(11);
    pdf.setTextColor(15, 23, 42);
    pdf.text('Detailed Transaction Ledger Feed', 15, y);

    y += 3;
    pdf.setLineWidth(0.3);
    pdf.setDrawColor(203, 213, 225);
    pdf.line(15, y, 195, y);
    y += 5;

    // Table Column Headers
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(8);
    pdf.setTextColor(71, 85, 105);
    pdf.text('Ticket ID', 17, y);
    pdf.text('Desk / Table', 45, y);
    pdf.text('Date / Time Stamp', 90, y);
    pdf.text('Order Status', 150, y);
    pdf.text('Total Amt', 193, y, { align: 'right' });

    y += 2.5;
    pdf.setLineWidth(0.2);
    pdf.setDrawColor(148, 163, 184);
    pdf.line(15, y, 195, y);
    y += 5;

    // Table Content Rows
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8);
    pdf.setTextColor(51, 65, 85);

    filteredOrders.forEach((o, index) => {
      // Handle pagination beautifully
      if (y > 275) {
        pdf.addPage();
        y = 20;

        // Draw header repeat
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(8);
        pdf.setTextColor(71, 85, 105);
        pdf.text('Ticket ID', 17, y);
        pdf.text('Desk / Table', 45, y);
        pdf.text('Date / Time Stamp', 90, y);
        pdf.text('Order Status', 150, y);
        pdf.text('Total Amt', 193, y, { align: 'right' });

        y += 2.5;
        pdf.setLineWidth(0.2);
        pdf.setDrawColor(148, 163, 184);
        pdf.line(15, y, 195, y);
        y += 5;
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(8);
        pdf.setTextColor(51, 65, 85);
      }

      // Zebra striping layout
      if (index % 2 === 0) {
        pdf.setFillColor(248, 250, 252);
        pdf.rect(15, y - 4, 180, 5.5, 'F');
      }

      pdf.setFont('helvetica', 'bold');
      pdf.text(`#${o.id.toUpperCase()}`, 17, y);
      pdf.setFont('helvetica', 'normal');
      pdf.text(`Desk #${o.tableNumber} ${o.isParcel ? '(Parcel)' : ''}`, 45, y);

      const dateStr = `${new Date(o.createdAt).toLocaleDateString()} ${new Date(o.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
      pdf.text(dateStr, 90, y);

      // Colored status pill representation
      if (o.status === 'completed') {
        pdf.setTextColor(5, 150, 105); // green
      } else if (o.status === 'preparing') {
        pdf.setTextColor(220, 38, 38); // red
      } else {
        pdf.setTextColor(217, 119, 6); // amber
      }
      pdf.setFont('helvetica', 'bold');
      pdf.text(o.status.toUpperCase(), 150, y);

      pdf.setTextColor(51, 65, 85);
      pdf.setFont('helvetica', 'normal');
      pdf.text(`Rs. ${o.totalAmount.toFixed(2)}`, 193, y, { align: 'right' });

      y += 5.5;
    });

    if (filteredOrders.length === 0) {
      pdf.setFont('helvetica', 'italic');
      pdf.setTextColor(148, 163, 184);
      pdf.text('No ledger transaction records found for this timeframe.', 105, y + 10, { align: 'center' });
    }

    // Save direct download PDF
    const fileLabel = timeframeLabel.toLowerCase().replace(/ /g, '-');
    pdf.save(`sales-report-${fileLabel}.pdf`);
    triggerToast(`${timeframeLabel} Sales Report downloaded as a PDF successfully!`);
  };

  // Order History Filter Engine
  const filteredHistoryOrders = orders.filter(order => {
    const matchesSearch = 
      order.tableNumber.toString().includes(historySearch) ||
      order.id.toLowerCase().includes(historySearch.toLowerCase()) ||
      order.items.some(it => it.name.toLowerCase().includes(historySearch.toLowerCase()));

    if (!matchesSearch) return false;

    // Timeframe filter logic
    const orderDate = new Date(order.createdAt);
    const now = new Date();
    const diffMs = now.getTime() - orderDate.getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);

    if (historyTimeframe === 'today') {
      return diffDays <= 1; // past 24 hrs
    } else if (historyTimeframe === 'week') {
      return diffDays <= 7; // past 7 days
    } else if (historyTimeframe === 'month') {
      return diffDays <= 30; // past 30 days
    } else {
      return diffDays <= 365; // past 365 days
    }
  });

  // Calculate stats for selected history slice
  const historyCompletedOrders = filteredHistoryOrders.filter(o => o.status === 'completed');
  const historyActiveOrdersCount = filteredHistoryOrders.filter(o => o.status !== 'completed').length;
  const historyTotalRevenue = historyCompletedOrders.reduce((sum, o) => sum + o.totalAmount, 0);
  const historyTotalItemsSold = filteredHistoryOrders.reduce(
    (sum, o) => sum + o.items.reduce((iSum, it) => iSum + it.quantity, 0), 0
  );
  const averageTicketSize = filteredHistoryOrders.length > 0 ? (filteredHistoryOrders.reduce((sum, o) => sum + o.totalAmount, 0) / filteredHistoryOrders.length) : 0;

  return (
    <div className="min-h-screen bg-[#FFFDF9] dark:bg-slate-950 flex flex-col font-sans text-gray-850 dark:text-gray-100 transition-colors duration-200">
      <canvas ref={canvasRef} className="hidden" />

      {toastMessage && (
        <div className="fixed top-4 right-4 bg-gray-900 border border-yellow-400 text-white px-4 py-2.5 rounded-xl shadow-xl z-50 flex items-center space-x-2 text-xs font-semibold animate-fadeIn">
          <Check className="h-4 w-4 text-yellow-450" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* HEADER WITH BRANDING AND LOGO (Red & Yellow/Gold Theme) */}
      <header className="bg-white dark:bg-slate-900 border-b border-[#D9D9E0] dark:border-slate-800 sticky top-0 z-30 px-6 py-4 flex items-center justify-between shadow-xs">
        <div className="flex items-center space-x-3">
          {/* Logo Placeholder - Palette Red & Yellow */}
          <ChefLogo size={38} className="rounded-full shadow-xs bg-[#4c1d3f] border border-yellow-400 shrink-0" />
          <div>
            <h1 className="text-base font-black text-gray-950 dark:text-white tracking-tight">Good Good Dairy</h1>
            <p className="text-[10px] text-red-750 dark:text-red-400 font-extrabold uppercase tracking-widest font-mono">Kitchen Console & Billing</p>
          </div>
        </div>

        <div className="flex items-center space-x-4">
          <button 
            type="button"
            onClick={() => setIsSidebarOpen(true)}
            aria-label="Open Desks and Signout Sidebar"
            className="p-2 text-gray-700 dark:text-gray-300 hover:text-red-700 dark:hover:text-red-400 bg-[#FFFDF9] dark:bg-slate-800 hover:bg-red-50 dark:hover:bg-slate-850 rounded-lg border border-[#D9D9E0] dark:border-slate-800 transition cursor-pointer flex items-center justify-center shadow-2xs"
          >
            <Menu className="h-4 w-4" />
          </button>
        </div>
      </header>

      {/* MAIN CONTAINER */}
      <main className="max-w-6xl mx-auto w-full px-4 md:px-6 py-6 flex-grow flex flex-col gap-6">
        
        {/* SUB NAVIGATION TAB RAIL */}
        {['orders', 'menu', 'history'].includes(activeTab) && (
          <div className="flex flex-wrap items-center gap-3 font-mono scrolling-touch pb-3 border-b border-gray-200 dark:border-slate-800">
            <button
              onClick={() => setActiveTab('orders')}
              className={`px-5 py-3.5 text-xs sm:text-sm font-black uppercase tracking-wider rounded-xl border-2 transition-all duration-200 select-none cursor-pointer whitespace-nowrap shadow-xs active:scale-95 ${
                activeTab === 'orders'
                  ? 'border-red-700 bg-red-700 text-white font-black scale-102 shadow-md ring-4 ring-red-700/15'
                  : 'border-red-200 dark:border-red-900/30 bg-red-50/30 dark:bg-red-950/10 text-red-800 dark:text-red-400 hover:bg-red-50 hover:border-red-450 dark:hover:bg-red-950/20'
              }`}
            >
              Current Orders ({activeOrdersCount})
            </button>

            <button
              onClick={() => setActiveTab('menu')}
              className={`px-5 py-3.5 text-xs sm:text-sm font-black uppercase tracking-wider rounded-xl border-2 transition-all duration-200 select-none cursor-pointer whitespace-nowrap shadow-xs active:scale-95 ${
                activeTab === 'menu'
                  ? 'border-amber-600 bg-amber-600 text-white font-black scale-102 shadow-md ring-4 ring-amber-600/15'
                  : 'border-amber-200 dark:border-amber-900/30 bg-amber-50/30 dark:bg-amber-950/10 text-amber-800 dark:text-amber-400 hover:bg-amber-50 hover:border-amber-450 dark:hover:bg-amber-950/20'
              }`}
            >
              Manage Food Menu ({menuItems.length})
            </button>

            <button
              onClick={() => setActiveTab('history')}
              className={`px-5 py-3.5 text-xs sm:text-sm font-black uppercase tracking-wider rounded-xl border-2 transition-all duration-200 select-none cursor-pointer whitespace-nowrap shadow-xs active:scale-95 ${
                activeTab === 'history'
                  ? 'border-blue-600 bg-blue-600 text-white font-black scale-102 shadow-md ring-4 ring-blue-600/15'
                  : 'border-blue-200 dark:border-blue-900/30 bg-blue-50/30 dark:bg-blue-950/10 text-blue-800 dark:text-blue-400 hover:bg-blue-50 hover:border-blue-450 dark:hover:bg-blue-950/20'
              }`}
            >
              Past Orders History ({orders.length})
            </button>

            <button
              onClick={handleOpenCreateOrderModal}
              className="md:ml-auto px-5 py-3.5 text-xs sm:text-sm font-black uppercase tracking-wider rounded-xl border-2 border-emerald-650 bg-emerald-600 dark:bg-emerald-700 text-white hover:bg-emerald-700 dark:hover:bg-emerald-800 transition-all duration-200 select-none cursor-pointer whitespace-nowrap shadow-xs active:scale-95 flex items-center justify-center gap-1.5 ring-4 ring-emerald-600/10"
              title="Create a Direct Counter / Manager Table Bill"
            >
              <Plus className="h-4 w-4 text-yellow-300" />
              Direct Counter Bill
            </button>
          </div>
        )}

        {/* 1. ORDERS QUEUE */}
        {activeTab === 'orders' && (
          <div className="space-y-6">
            
            {/* INCOMING PUSH & AUDIO CONTROL PANEL */}
            {!isAlertBannerDismissed && notificationPermission !== 'granted' && (
              <div className="relative bg-gradient-to-r from-red-50 to-orange-50 border border-red-150 p-4 rounded-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-2xs">
                {/* Dismiss Icon */}
                <button
                  type="button"
                  onClick={dismissAlertBanner}
                  className="absolute top-2 right-2 p-1 text-gray-400 hover:text-red-700 hover:bg-red-100/60 rounded-lg transition"
                  title="Dismiss alert banner"
                >
                  <X className="h-4 w-4" />
                </button>

                <div className="flex items-start gap-3">
                  <div className="bg-red-750 text-yellow-300 p-2.5 rounded-lg border border-yellow-300/40 shrink-0">
                    <BellRing className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-xs font-black text-gray-900 uppercase tracking-wide">Sound & Screen Alerts</h3>
                    <p className="text-[10px] text-gray-500 mt-0.5 leading-relaxed max-w-xl pr-5">
                      This screen automatically displays new customer orders in real-time. Turn on screen alerts below so you don't miss new orders.
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center gap-2 w-full md:w-auto shrink-0 z-10">
                  <button
                    type="button"
                    onClick={requestNotificationPermissionAndTest}
                    className="w-full md:w-auto px-4 py-2 bg-red-700 hover:bg-red-800 text-white font-bold text-xs rounded-lg transition-all cursor-pointer shadow-2xs flex items-center justify-center gap-1.5"
                  >
                    Turn On Sound Alerts
                  </button>
                  <button
                    type="button"
                    onClick={sendTestNotification}
                    className="w-full md:w-auto px-4 py-2 bg-white hover:bg-gray-50 text-gray-700 font-bold border border-[#D9D9E0] text-xs rounded-lg transition-all cursor-pointer shadow-2xs flex items-center justify-center gap-1.5"
                  >
                    Test Ringing Sound
                  </button>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* QUEUED ORDERS COLUMN */}
              <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-[#D9D9E0] dark:border-slate-800 shadow-3xs">
                <div className="flex items-center justify-between pb-3 mb-4 border-b border-gray-100 dark:border-slate-800">
                  <span className="text-xs font-black text-amber-600 dark:text-amber-405 flex items-center gap-1.5 uppercase tracking-wide">
                    Queued Orders ({queuedOrders.length})
                  </span>
                </div>

                <div className="space-y-3.5">
                  {queuedOrders.map(order => (
                    <div key={order.id} className="bg-[#FFFDF9] dark:bg-slate-950 rounded-xl p-4 border border-[#CACECE] dark:border-slate-800 hover:shadow-xs transition">
                      <div className="flex justify-between items-center mb-2.5 pb-2 border-b border-gray-200/60 dark:border-slate-850">
                        {/* Table Invoice Trigger */}
                        <button
                          type="button"
                          onClick={() => setSelectedTableForBilling(order.tableNumber)}
                          className="text-xs font-extrabold bg-amber-50 dark:bg-amber-950/20 text-amber-850 dark:text-amber-400 border border-amber-200 dark:border-amber-900/40 px-2 py-0.5 rounded hover:bg-amber-100 dark:hover:bg-amber-955/20 transition inline-flex items-center gap-1 cursor-pointer"
                          title="Click to view table combined items"
                        >
                          Table {order.tableNumber} {order.isParcel ? "🥡 [Parcel]" : ""}
                        </button>
                        <span className="text-[10px] text-gray-400 font-bold uppercase font-mono">#{order.id.slice(4)}</span>
                      </div>

                      {order.customerName && (
                        <div className="mb-2.5 text-[11px] font-bold text-gray-600 dark:text-slate-350 bg-red-50/50 dark:bg-red-955/10 px-2 py-1 rounded border border-red-100/50 dark:border-red-950/20">
                          Customer: <span className="text-red-700 dark:text-red-400 font-black">{order.customerName}</span>
                        </div>
                      )}

                      <div className="space-y-1.5 text-xs">
                        {order.items.map(it => (
                          <div key={it.id} className="flex justify-between text-gray-950 dark:text-slate-200 font-bold">
                            <span>{it.quantity}x {it.name}{it.portion ? ` (${it.portion === 'half' ? 'Half' : 'Full'})` : ''}</span>
                            <span className="text-gray-500 dark:text-slate-450 text-[10px] font-mono">₹{(it.price * it.quantity).toFixed(2)}</span>
                          </div>
                        ))}
                      </div>

                      {order.items.some(it => it.notes) && (
                        <div className="mt-2 bg-yellow-50 dark:bg-amber-950/25 border border-yellow-250 dark:border-amber-900/40 text-[10px] text-yellow-800 dark:text-amber-400 p-2 rounded leading-tight">
                          <strong>Note:</strong> {order.items.map(it => it.notes).filter(Boolean).join(' | ')}
                         </div>
                      )}

                      <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-200/60 dark:border-slate-850">
                        <div>
                          <span className="text-[9px] text-gray-400 block font-bold uppercase leading-none">Order Total</span>
                          <span className="text-xs font-black text-gray-900 dark:text-white">₹{order.totalAmount.toFixed(2)}</span>
                        </div>
                        <div className="flex space-x-1.5">
                          <button
                            type="button"
                            onClick={() => deleteOrder(order.id)}
                            className="p-1.5 bg-red-50 dark:bg-red-950/25 text-red-700 dark:text-red-400 hover:text-white hover:bg-red-700 rounded-lg transition cursor-pointer"
                            title="Delete Order"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleStartEditOrder(order)}
                            className="p-1.5 bg-blue-50 dark:bg-blue-950/25 text-blue-700 dark:text-blue-400 hover:text-white hover:bg-blue-750 border border-blue-200 dark:border-blue-900/30 rounded-lg transition cursor-pointer flex items-center justify-center"
                            title="Edit Bill / Add Manual Items"
                          >
                            <Edit className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => updateOrderStatus(order.id, 'preparing')}
                            className="px-3 py-1.5 bg-amber-600 hover:bg-amber-750 text-white text-[11px] font-black uppercase rounded-lg transition cursor-pointer shadow-3xs"
                          >
                            Accept ✓
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                  {queuedOrders.length === 0 && (
                    <div className="text-center py-8 text-xs text-gray-400 dark:text-slate-500 font-bold italic">No pending queued orders.</div>
                  )}
                </div>
              </div>

              {/* COOKING/PREPARING QUEUE */}
              <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-[#D9D9E0] dark:border-slate-800 shadow-3xs">
                <div className="flex items-center justify-between pb-3 mb-4 border-b border-gray-100 dark:border-slate-800">
                  <span className="text-xs font-black text-red-700 dark:text-red-400 flex items-center gap-1.5 uppercase tracking-wide">
                    Cooking & Preparing ({preparingOrders.length})
                  </span>
                </div>

                <div className="space-y-3.5">
                  {preparingOrders.map(order => (
                    <div key={order.id} className="bg-[#FFFDF9] dark:bg-slate-950 rounded-xl p-4 border border-[#D9D9E0] dark:border-slate-800 hover:shadow-xs transition">
                      <div className="flex justify-between items-center mb-2.5 pb-2 border-b border-gray-200/60 dark:border-slate-850">
                        {/* Table Invoice Trigger */}
                        <button
                          type="button"
                          onClick={() => setSelectedTableForBilling(order.tableNumber)}
                          className="text-xs font-extrabold bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-900/30 px-2 py-0.5 rounded hover:bg-red-100 dark:hover:bg-red-955/20 transition inline-flex items-center gap-1 cursor-pointer"
                          title="Click to view table combined items"
                        >
                          Table {order.tableNumber} {order.isParcel ? "🥡 [Parcel]" : ""}
                        </button>
                        <span className="text-[10px] text-gray-400 font-bold uppercase font-mono">#{order.id.slice(4)}</span>
                      </div>

                      {order.customerName && (
                        <div className="mb-2.5 text-[11px] font-bold text-gray-600 dark:text-slate-350 bg-red-50/50 dark:bg-red-955/10 px-2 py-1 rounded border border-red-100/50 dark:border-red-950/20">
                          Customer: <span className="text-red-700 dark:text-red-400 font-black">{order.customerName}</span>
                        </div>
                      )}

                      <div className="space-y-1.5 text-xs">
                        {order.items.map(it => (
                          <div key={it.id} className="flex justify-between text-gray-950 dark:text-slate-200 font-semibold">
                            <span>{it.quantity}x {it.name}{it.portion ? ` (${it.portion === 'half' ? 'Half' : 'Full'})` : ''}</span>
                            <span className="text-gray-400 dark:text-slate-450 text-[10px] font-mono">₹{(it.price * it.quantity).toFixed(2)}</span>
                          </div>
                        ))}
                      </div>

                      {order.items.some(it => it.notes) && (
                        <div className="mt-2 bg-yellow-50 dark:bg-amber-950/25 border border-yellow-250 dark:border-amber-900/40 text-[10px] text-yellow-800 dark:text-amber-400 p-2 rounded leading-tight">
                          <strong>Note:</strong> {order.items.map(it => it.notes).filter(Boolean).join(' | ')}
                        </div>
                      )}

                      <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-200/60 dark:border-slate-850">
                        <div>
                          <span className="text-[9px] text-gray-400 block font-bold uppercase leading-none">Order Total</span>
                          <span className="text-xs font-black text-gray-900 dark:text-white">₹{order.totalAmount.toFixed(2)}</span>
                        </div>
                        <div className="flex space-x-1.5">
                          <button
                            type="button"
                            onClick={() => deleteOrder(order.id)}
                            className="p-1.5 bg-red-50 dark:bg-red-950/25 text-red-700 dark:text-red-450 hover:text-white hover:bg-red-700 rounded-lg transition cursor-pointer"
                            title="Delete Order"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleStartEditOrder(order)}
                            className="p-1.5 bg-blue-50 dark:bg-blue-950/25 text-blue-700 dark:text-blue-400 hover:text-white hover:bg-blue-750 border border-blue-200 dark:border-blue-900/30 rounded-lg transition cursor-pointer flex items-center justify-center"
                            title="Edit Bill / Add Manual Items"
                          >
                            <Edit className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => updateOrderStatus(order.id, 'served')}
                            className="px-3 py-1.5 bg-red-700 hover:bg-red-800 text-white text-[11px] font-bold rounded-lg transition cursor-pointer"
                          >
                            Mark Served ✓
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                  {preparingOrders.length === 0 && (
                    <div className="text-center py-8 text-xs text-gray-400 dark:text-slate-500 italic">No meals currently preparing.</div>
                  )}
                </div>
              </div>

              {/* SERVED / LIVE AT TABLES COLUMN */}
              <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-[#D9D9E0] dark:border-slate-800 shadow-3xs">
                <div className="flex items-center justify-between pb-3 mb-4 border-b border-gray-100 dark:border-slate-800">
                  <span className="text-xs font-extrabold text-emerald-800 dark:text-emerald-450 flex items-center gap-1.5 uppercase tracking-wide">
                    Served & Dining ({servedOrders.length})
                  </span>
                </div>

                <div className="space-y-3.5">
                  {servedOrders.map(order => (
                     <div key={order.id} className="bg-white dark:bg-slate-950 rounded-xl p-4 border border-[#D9D9E0] dark:border-slate-800 hover:shadow-xs transition">
                      <div className="flex justify-between items-center mb-2.5 pb-2 border-b border-gray-200/60 dark:border-slate-850">
                        <button
                          type="button"
                          onClick={() => setSelectedTableForBilling(order.tableNumber)}
                          className="text-xs font-extrabold bg-emerald-50 dark:bg-emerald-950/20 text-emerald-800 dark:text-emerald-450 border border-emerald-250 dark:border-emerald-900/30 px-2 py-0.5 rounded hover:bg-emerald-100 dark:hover:bg-emerald-950/40 transition inline-flex items-center gap-1 cursor-pointer"
                          title="Click to view total invoice for Table"
                        >
                          Table {order.tableNumber} {order.isParcel ? "🥡 [Parcel]" : ""}
                        </button>
                        <span className="text-[10px] text-gray-400 font-bold uppercase font-mono">#{order.id.slice(4)}</span>
                      </div>

                      {order.customerName && (
                        <div className="mb-2.5 text-[11px] font-bold text-gray-600 dark:text-slate-350 bg-red-50/50 dark:bg-red-955/10 px-2 py-1 rounded border border-red-100/50 dark:border-red-950/20">
                          Customer: <span className="text-red-700 dark:text-red-400 font-black">{order.customerName}</span>
                        </div>
                      )}

                      <div className="space-y-1.5 text-xs mb-3">
                        {order.items.map(it => (
                          <div key={it.id} className="flex justify-between text-gray-950 dark:text-slate-200 font-semibold">
                            <span>{it.quantity}x {it.name}{it.portion ? ` (${it.portion === 'half' ? 'Half' : 'Full'})` : ''}</span>
                            <span className="text-gray-500 text-[10px] font-mono">₹{(it.price * it.quantity).toFixed(2)}</span>
                          </div>
                        ))}
                      </div>

                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => deleteOrder(order.id)}
                          className="p-2 bg-red-50 dark:bg-red-950/25 text-red-700 dark:text-red-450 hover:text-white hover:bg-red-700 border border-red-250 dark:border-red-900/35 rounded-lg transition overflow-hidden shrink-0 cursor-pointer flex items-center justify-center font-bold"
                          title="Delete Order"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleStartEditOrder(order)}
                          className="p-2 bg-blue-50 dark:bg-blue-950/25 text-blue-700 dark:text-blue-400 hover:text-white hover:bg-blue-750 border border-blue-250 dark:border-blue-900/35 rounded-lg transition overflow-hidden shrink-0 cursor-pointer flex items-center justify-center font-bold"
                          title="Edit Bill / Add Manual Items"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => updateOrderStatus(order.id, 'completed')}
                          className="flex-grow py-2 bg-emerald-700 hover:bg-emerald-850 text-white text-xs font-bold rounded-lg transition uppercase tracking-wider cursor-pointer"
                        >
                          Complete Bill & Close ✓
                        </button>
                      </div>
                    </div>
                  ))}
                  {servedOrders.length === 0 && (
                    <div className="text-center py-8 text-xs text-gray-400 dark:text-slate-505 italic">No served food active at tables.</div>
                  )}
                </div>
              </div>

            </div>
          </div>
        )}



        {/* 2. TABLE REGISTER & QR MANAGER */}
        {activeTab === 'tables' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between pb-2 border-b border-[#D9D9E0] dark:border-slate-800">
              <button
                type="button"
                onClick={() => setActiveTab('orders')}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-white dark:bg-slate-900 border border-[#D9D9E0] dark:border-slate-800 hover:bg-gray-50 dark:hover:bg-slate-800 text-gray-700 dark:text-gray-200 text-xs font-bold rounded-xl transition cursor-pointer"
              >
                ← Back to Orders Page
              </button>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-[#D9D9E0] dark:border-slate-800 p-5 rounded-2xl">
              <h2 className="text-sm font-extrabold text-gray-950 dark:text-gray-100 mb-1 font-serif font-bold">Add Restaurant Tables & QR Codes</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-4 max-w-2xl leading-relaxed">
                Add your restaurant tables below to make print-outs for them. When a customer scans the code on a table with their mobile phone, they can view the food menu and order directly.
              </p>
              
              <form onSubmit={handleAddTable} className="flex max-w-sm gap-2">
                <input
                  type="number"
                  required
                  value={newTableNum}
                  onChange={e => setNewTableNum(e.target.value)}
                  placeholder="Enter Table Number, e.g. 5"
                  className="px-3.5 py-2 text-xs font-medium border border-[#D9D9E0] dark:border-slate-700 rounded-xl focus:outline-none focus:ring-1 focus:ring-red-700 w-full bg-[#FFFDF9] dark:bg-slate-800 dark:text-white"
                />
                <button
                  type="submit"
                  className="px-4 py-2 bg-red-700 hover:bg-red-800 text-white font-bold text-xs rounded-xl transition whitespace-nowrap cursor-pointer"
                >
                  Create Table Code
                </button>
              </form>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {tables.map(table => {
                const publicOrigin = window.location.origin.replace('-dev-', '-pre-');
                const tableUrl = `${publicOrigin}?table=${encodeTableNumber(table.number)}`;
                const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(tableUrl)}`;
                const hasActiveOrder = orders.some(o => o.tableNumber === table.number && o.status !== 'completed');

                return (
                  <div key={table.id} className="bg-white dark:bg-slate-900 border border-[#D9D9E0] dark:border-slate-800 p-4 rounded-xl flex flex-col justify-between shadow-xs">
                    <div>
                      <div className="flex justify-between items-center mb-3">
                        <button
                          type="button"
                          onClick={() => setSelectedTableForBilling(table.number)}
                          className="text-sm font-extrabold text-gray-950 dark:text-white hover:text-red-700 transition text-left cursor-pointer"
                        >
                          Table {table.number}
                        </button>
                        <span className={`h-2.5 w-2.5 rounded-full ${hasActiveOrder ? 'bg-red-700 animate-pulse' : 'bg-gray-200 dark:bg-slate-700'}`} />
                      </div>

                      <div className="flex justify-center bg-[#FFFDF9] dark:bg-slate-850 rounded-lg p-3 border border-gray-100 dark:border-slate-800 mb-4 cursor-pointer relative group">
                        <img 
                          src={qrUrl} 
                          alt="Desk QR" 
                          className="h-28 w-28 object-contain bg-white rounded-md p-1"
                          referrerPolicy="no-referrer"
                        />
                        <div className="absolute inset-0 bg-red-950/90 rounded-lg opacity-0 group-hover:opacity-100 transition duration-150 flex flex-col items-center justify-center p-2">
                          <button
                            type="button"
                            onClick={() => onSimulateTable(table.number)}
                            className="bg-red-700 text-white font-bold text-[10px] px-3 py-1.5 rounded-lg hover:bg-red-650 transition inline-flex items-center gap-1 cursor-pointer"
                          >
                            Try Scanning (Order Food)
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <button
                        onClick={() => downloadQRBadge(table.number)}
                        className="w-full py-2 bg-yellow-50 dark:bg-amber-950/30 hover:bg-yellow-100 text-yellow-850 dark:text-amber-300 border border-yellow-250 dark:border-amber-900 font-bold text-[10px] rounded-lg transition cursor-pointer"
                      >
                        Download QR Sticker (PDF)
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteTable(table.id, table.number)}
                        className="w-full flex items-center justify-center gap-1 py-1 text-gray-400 dark:text-gray-500 hover:text-red-700 dark:hover:text-red-400 text-xs text-center cursor-pointer transition"
                        title="Delete table configuration"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        <span className="text-[10px] uppercase font-bold tracking-wide">Delete Desk</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}



        {/* 3. MENU MANAGER */}
        {activeTab === 'menu' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-md font-extrabold text-gray-950 font-serif font-bold">Restaurant Menu Items</h2>
                <p className="text-xs text-gray-400">Add, view, and remove food items from your restaurant menu.</p>
              </div>

              <button
                type="button"
                onClick={() => {
                  if (isMenuFormOpen) {
                    resetFormState();
                    setIsMenuFormOpen(false);
                  } else {
                    setIsMenuFormOpen(true);
                  }
                }}
                className="px-3.5 py-2 bg-red-700 hover:bg-red-800 text-white font-bold text-xs rounded-xl transition cursor-pointer"
              >
                {isMenuFormOpen ? "Cancel" : "Add New Dish"}
              </button>
            </div>

            {isMenuFormOpen && (
              <form onSubmit={handleCreateMenuItem} className="bg-white p-5 rounded-xl border border-[#D9D9E0] grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-xl animate-slideUp">
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Dish Title</label>
                  <input
                    type="text"
                    required
                    value={formName}
                    onChange={e => setFormName(e.target.value)}
                    placeholder="e.g. Schezwan Hakka Noodles"
                    className="w-full px-3 py-2 border border-[#D9D9E0] bg-[#FFFDF9] rounded-lg text-xs"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Base Price (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={formPrice}
                    onChange={e => setFormPrice(e.target.value)}
                    placeholder="e.g. 150.00"
                    className="w-full px-3 py-2 border border-[#D9D9E0] bg-[#FFFDF9] rounded-lg text-xs"
                  />
                </div>

                <div className="flex items-center space-x-2.5 py-1.5 px-3 bg-[#FFFDF9] dark:bg-slate-900 rounded-xl border border-gray-200/60 dark:border-slate-800 md:col-span-2">
                  <input
                    type="checkbox"
                    id="isSinglePortion"
                    checked={formIsSinglePortion}
                    onChange={e => setFormIsSinglePortion(e.target.checked)}
                    className="h-4 w-4 rounded text-red-700 focus:ring-red-500 border-gray-300 cursor-pointer"
                  />
                  <label htmlFor="isSinglePortion" className="text-xs font-bold text-gray-700 dark:text-slate-300 cursor-pointer select-none">
                    Single Serving Only (No Half/Full options)
                  </label>
                </div>

                {!formIsSinglePortion && (
                  <>
                    <div>
                      <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Half Plate Price (₹) - Optional</label>
                      <input
                        type="number"
                        step="0.01"
                        value={formHalfPrice}
                        onChange={e => setFormHalfPrice(e.target.value)}
                        placeholder="Defaults to 50% of base price"
                        className="w-full px-3 py-2 border border-[#D9D9E0] bg-[#FFFDF9] rounded-lg text-xs"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Full Plate Price (₹) - Optional</label>
                      <input
                        type="number"
                        step="0.01"
                        value={formFullPrice}
                        onChange={e => setFormFullPrice(e.target.value)}
                        placeholder="Defaults to base price"
                        className="w-full px-3 py-2 border border-[#D9D9E0] bg-[#FFFDF9] rounded-lg text-xs"
                      />
                    </div>
                  </>
                )}

                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Cuisine Group</label>
                  <select
                    value={formCategory}
                    onChange={e => setFormCategory(e.target.value)}
                    className="w-full px-3 py-2 border border-[#D9D9E0] bg-[#FFFDF9] rounded-lg text-xs"
                  >
                    {Array.from(new Set([
                      'Thalis & Meals',
                      'Chinese Dishes',
                      'Main Course',
                      'Drinks & Desserts',
                      ...customCategories,
                      ...menuItems.map(item => item.category).filter(Boolean)
                    ])).map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                    <option value="__NEW__" className="font-semibold text-red-700">+ Add New Cuisine Group...</option>
                  </select>

                  {formCategory === '__NEW__' && (
                    <div className="mt-2 flex gap-2">
                      <input
                        type="text"
                        value={newCategoryName}
                        onChange={e => setNewCategoryName(e.target.value)}
                        placeholder="Enter new group name..."
                        className="flex-1 px-3 py-2 border border-[#D9D9E0] bg-[#FFFDF9] rounded-lg text-xs focus:ring-1 focus:ring-red-700 focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const trimmed = newCategoryName.trim();
                          if (trimmed) {
                            if (!customCategories.includes(trimmed)) {
                              setCustomCategories(prev => [...prev, trimmed]);
                            }
                            setFormCategory(trimmed);
                            setNewCategoryName('');
                          } else {
                            setFormCategory('Thalis & Meals');
                          }
                        }}
                        className="px-3 py-1.5 bg-red-700 hover:bg-red-800 text-white font-bold text-xs rounded-lg transition"
                      >
                        Add
                      </button>
                    </div>
                  )}
                </div>

                <div className="sm:col-span-2 border-t border-[#D9D9E0] pt-4 mt-2">
                  <label className="block text-[10px] font-bold text-gray-400 uppercase mb-2">Dish Image</label>
                  <div className="border border-dashed border-[#D9D9E0] bg-[#FFFDF9] rounded-lg p-4 text-center">
                    {uploadedImageUrl ? (
                      <div className="relative inline-block">
                        <img
                          src={uploadedImageUrl}
                          alt="Uploaded Preview"
                          className="w-32 h-32 object-cover rounded-lg border border-gray-200 shadow-sm mx-auto"
                        />
                        <button
                          type="button"
                          onClick={() => setUploadedImageUrl('')}
                          className="absolute -top-2 -right-2 bg-red-600 hover:bg-red-700 text-white rounded-full p-1 shadow-md transition cursor-pointer"
                        >
                          <X className="h-3 w-3" />
                        </button>
                        <p className="text-[10px] text-green-600 font-semibold mt-2">Image uploaded successfully</p>
                      </div>
                    ) : (
                      <label className="cursor-pointer block py-4">
                        <Upload className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                        <span className="text-xs text-gray-600 font-medium block">Click to upload dish image</span>
                        <span className="text-[10px] text-gray-400 block mt-1">PNG, JPG or JPEG (Max 5MB)</span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleImageUpload}
                          className="hidden"
                        />
                      </label>
                    )}
                  </div>
                </div>

                <div className="sm:col-span-2 pt-2">
                  <button
                    type="submit"
                    disabled={isGeneratingImage}
                    className="w-full py-2 bg-red-700 hover:bg-red-800 disabled:bg-red-400 text-white font-bold text-xs uppercase tracking-wider rounded-lg transition cursor-pointer flex items-center justify-center gap-2"
                  >
                    {isGeneratingImage ? "Saving..." : "Save Dish"}
                  </button>
                </div>
              </form>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {menuItems.map(item => (
                <div key={item.id} className="bg-white p-4 rounded-xl border border-[#D9D9E0] flex items-center gap-4">
                  <div className="w-12 h-12 flex items-center justify-center rounded-lg bg-red-50 text-red-700 border border-red-150 font-extrabold text-xs tracking-wider shrink-0 overflow-hidden">
                    {item.imageUrl ? (
                      <img
                        src={item.imageUrl}
                        alt={item.name}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      item.image || generateInitials(item.name)
                    )}
                  </div>
                  <div className="flex-grow min-w-0">
                    <div className="flex justify-between items-start">
                      <h4 className="font-bold text-xs text-gray-900 truncate">{item.name}</h4>
                      <span className="text-xs font-bold text-red-700 shrink-0 ml-1">₹{item.price.toFixed(2)}</span>
                    </div>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-[9px] uppercase font-bold text-gray-400 tracking-wider">{item.category}</span>
                      <div className="text-[10px] text-gray-500 font-bold space-x-1.5 font-mono shrink-0">
                        {item.isSinglePortion ? (
                          <span className="text-gray-400 bg-gray-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-[9px] uppercase tracking-wider font-sans font-bold">Base Price Only</span>
                        ) : (
                          <>
                            <span>Half: ₹{(item.halfPrice ?? Math.round(item.price * 0.5)).toFixed(0)}</span>
                            <span>Full: ₹{(item.fullPrice ?? item.price).toFixed(0)}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDeleteMenuItem(item.id, item.name)}
                    className="text-gray-300 hover:text-red-700 p-1.5 transition shrink-0 cursor-pointer text-right"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
            
            {/* Database controls in Red & Saffron Yellow */}
            <div className="pt-6 border-t border-[#D9D9E0] flex gap-4">
              <button
                type="button"
                onClick={handleTriggerResetToSample}
                className="px-3 py-2 text-[10px] font-mono font-bold bg-white text-gray-500 hover:text-red-700 hover:border-red-300 border border-[#D9D9E0] rounded-lg transition cursor-pointer"
              >
                Reset Menu to Multi-Cuisine Presets
              </button>
            </div>
          </div>
        )}

        {/* 4. ORDER TRACKER HISTORY REDESIGN - INTERACTIVE GOURMET LEDGER */}
        {activeTab === 'history' && (
          <div className="space-y-6 animate-fadeIn pb-12">
            
            {/* Header description */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-3 border-b border-[#D9D9E0] dark:border-slate-800">
              <div>
                <h2 className="text-sm font-extrabold text-gray-950 dark:text-gray-100 font-serif uppercase tracking-wider">Dynamic POS Order Ledger</h2>
                <p className="text-[11px] text-gray-500 dark:text-gray-400">Review real-time transaction archives, audit desk matrices, and inspect thermal checkout invoices.</p>
              </div>
              <button
                type="button"
                onClick={() => setActiveTab('orders')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-slate-900 border border-[#D9D9E0] dark:border-slate-800 hover:bg-gray-50 dark:hover:bg-slate-800 text-gray-750 dark:text-gray-200 text-xs font-bold rounded-xl transition cursor-pointer hover:shadow-2xs select-none"
              >
                ← Back to Live Kitchen
              </button>
            </div>

            {/* Premium Stats Bento Grid - Dynamically updates on filter */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-[#CACECE] dark:border-slate-800 flex items-center space-x-3.5 shadow-2xs hover:shadow-xs transition">
                <div className="p-2.5 rounded-lg bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-400 shrink-0">
                  <TrendingUp className="h-4.5 w-4.5" />
                </div>
                <div className="min-w-0">
                  <span className="block text-[10px] uppercase font-bold text-gray-600 dark:text-gray-300 leading-none mb-1.5 truncate tracking-wider">Gross sales (archive)</span>
                  <span className="text-sm font-black text-[#111827] dark:text-white font-mono">₹{historyTotalRevenue.toFixed(2)}</span>
                </div>
              </div>

              <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-[#CACECE] dark:border-slate-800 flex items-center space-x-3.5 shadow-2xs hover:shadow-xs transition">
                <div className="p-2.5 rounded-lg bg-yellow-50 dark:bg-amber-950/20 text-yellow-600 dark:text-amber-450 shrink-0">
                  <ClipboardList className="h-4.5 w-4.5" />
                </div>
                <div className="min-w-0">
                  <span className="block text-[10px] uppercase font-bold text-gray-600 dark:text-gray-300 leading-none mb-1.5 truncate tracking-wider">Ticket volume</span>
                  <span className="text-sm font-black text-[#111827] dark:text-white font-mono">{filteredHistoryOrders.length} Invoices</span>
                </div>
              </div>

              <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-[#CACECE] dark:border-slate-800 flex items-center space-x-3.5 shadow-2xs hover:shadow-xs transition">
                <div className="p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-450 shrink-0">
                  <Receipt className="h-4.5 w-4.5" />
                </div>
                <div className="min-w-0">
                  <span className="block text-[10px] uppercase font-bold text-gray-600 dark:text-gray-300 leading-none mb-1.5 truncate tracking-wider">Avg ticket size</span>
                  <span className="text-sm font-black text-[#111827] dark:text-white font-mono">₹{averageTicketSize.toFixed(2)}</span>
                </div>
              </div>

              <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-[#CACECE] dark:border-slate-800 flex items-center space-x-3.5 shadow-2xs hover:shadow-xs transition">
                <div className="p-2.5 rounded-lg bg-blue-50 dark:bg-blue-950/20 text-blue-700 dark:text-blue-400 shrink-0">
                  <Users className="h-4.5 w-4.5" />
                </div>
                <div className="min-w-0">
                  <span className="block text-[10px] uppercase font-bold text-gray-600 dark:text-gray-300 leading-none mb-1.5 truncate tracking-wider">Servings prepared</span>
                  <span className="text-sm font-black text-[#111827] dark:text-white font-mono">{historyTotalItemsSold} Portions</span>
                </div>
              </div>
            </div>

            {/* Main Interactive Workspace Area */}
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
              
              {/* Left Side: Index & Filtering Feed (7/12 Width) */}
              <div className="xl:col-span-7 space-y-4">
                
                {/* Advanced Search & Filtering Controls */}
                <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-[#D9D9E0] dark:border-slate-800 flex flex-col md:flex-row gap-3 items-center justify-between shadow-2xs">
                  
                  {/* Ledger Search Input */}
                  <div className="relative w-full md:max-w-xs">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400">
                      <Search className="h-3.5 w-3.5" />
                    </span>
                    <input
                      type="text"
                      value={historySearch}
                      onChange={e => setHistorySearch(e.target.value)}
                      placeholder="Search dish, table or ticket ID..."
                      className="w-full pl-9 pr-3 py-2 bg-[#FFFDF9] dark:bg-slate-800 border border-[#D9D9E0] dark:border-slate-700 rounded-xl text-xs dark:text-white focus:outline-none focus:ring-1 focus:ring-red-650"
                    />
                  </div>

                  {/* Filter Selectors */}
                  <div className="flex flex-wrap gap-2.5 items-center w-full md:w-auto justify-end">
                    {/* Timeframe Filter */}
                    <div className="flex bg-gray-100 dark:bg-slate-800 rounded-xl p-0.5 border border-[#D9D9E0] dark:border-slate-700 w-fit">
                      <button
                        type="button"
                        onClick={() => setHistoryTimeframe('today')}
                        className={`px-2.5 py-1 text-[9px] uppercase tracking-wider font-extrabold rounded-lg transition-all ${
                          historyTimeframe === 'today'
                            ? 'bg-white dark:bg-slate-900 text-red-700 dark:text-red-400 shadow-3xs'
                            : 'text-gray-450 dark:text-gray-500 hover:text-gray-900 dark:hover:text-gray-300'
                        }`}
                      >
                        Today
                      </button>
                      <button
                        type="button"
                        onClick={() => setHistoryTimeframe('week')}
                        className={`px-2.5 py-1 text-[9px] uppercase tracking-wider font-extrabold rounded-lg transition-all ${
                          historyTimeframe === 'week'
                            ? 'bg-white dark:bg-slate-900 text-red-700 dark:text-red-400 shadow-3xs'
                            : 'text-gray-450 dark:text-gray-500 hover:text-gray-900 dark:hover:text-gray-300'
                        }`}
                      >
                        Week
                      </button>
                      <button
                        type="button"
                        onClick={() => setHistoryTimeframe('month')}
                        className={`px-2 py-1 text-[9px] uppercase tracking-wider font-extrabold rounded-lg transition-all ${
                          historyTimeframe === 'month'
                            ? 'bg-white dark:bg-slate-900 text-red-700 dark:text-red-400 shadow-3xs'
                            : 'text-gray-450 dark:text-gray-500 hover:text-gray-900 dark:hover:text-gray-300'
                        }`}
                      >
                        1 Month
                      </button>
                      <button
                        type="button"
                        onClick={() => setHistoryTimeframe('year')}
                        className={`px-2 py-1 text-[9px] uppercase tracking-wider font-extrabold rounded-lg transition-all ${
                          historyTimeframe === 'year'
                            ? 'bg-white dark:bg-slate-900 text-red-700 dark:text-red-400 shadow-3xs'
                            : 'text-gray-450 dark:text-gray-500 hover:text-gray-900 dark:hover:text-gray-300'
                        }`}
                      >
                        1 Year
                      </button>
                    </div>

                    {/* Print Report Trigger Button */}
                    <button
                      type="button"
                      onClick={() => handlePrintReport(historyTimeframe, filteredHistoryOrders)}
                      className="inline-flex items-center gap-1.5 px-3 py-2 bg-red-700 hover:bg-red-800 dark:bg-red-800 dark:hover:bg-red-900 text-white text-[10px] font-black uppercase tracking-wider rounded-xl shadow-3xs transition cursor-pointer active:scale-95 border border-red-750 shrink-0"
                    >
                      <Printer className="h-3 w-3" />
                      <span>Print {historyTimeframe === 'today' ? 'Today' : historyTimeframe === 'week' ? 'Week' : historyTimeframe === 'month' ? '1-Month' : '1-Year'} Report</span>
                    </button>

                    {/* Grouping Toggle */}
                    <div className="flex bg-gray-100 dark:bg-slate-800 rounded-xl p-0.5 border border-[#D9D9E0] dark:border-slate-700 w-fit">
                      <button
                        type="button"
                        onClick={() => setHistoryGrouping('sequence')}
                        className={`px-3 py-1 text-[9px] uppercase tracking-wider font-extrabold rounded-lg transition-all ${
                          historyGrouping === 'sequence'
                            ? 'bg-white dark:bg-slate-900 text-red-700 dark:text-red-400 shadow-3xs'
                            : 'text-gray-450 dark:text-gray-500 hover:text-gray-900 dark:hover:text-gray-300'
                        }`}
                      >
                        Ledger List
                      </button>
                      <button
                        type="button"
                        onClick={() => setHistoryGrouping('table')}
                        className={`px-3 py-1 text-[9px] uppercase tracking-wider font-extrabold rounded-lg transition-all ${
                          historyGrouping === 'table'
                            ? 'bg-white dark:bg-slate-900 text-red-700 dark:text-red-400 shadow-3xs'
                            : 'text-gray-450 dark:text-gray-500 hover:text-gray-900 dark:hover:text-gray-300'
                        }`}
                      >
                        Table Matrix
                      </button>
                    </div>
                  </div>

                </div>

                {/* Ledger Listing View */}
                {historyGrouping === 'sequence' ? (
                  <div className="space-y-2.5 max-h-[660px] overflow-y-auto pr-1">
                    {filteredHistoryOrders.map((order, idx) => {
                      const isActive = selectedHistoryOrderId === order.id;
                      return (
                        <div 
                          key={order.id} 
                          onClick={() => setSelectedHistoryOrderId(order.id)}
                          className={`bg-white dark:bg-slate-900 rounded-xl p-3.5 border transition-all duration-200 cursor-pointer text-left flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 relative ${
                            isActive 
                              ? 'border-red-700 dark:border-red-650 bg-amber-50/10 dark:bg-red-950/5 ring-1 ring-red-700 shadow-2xs scale-[1.005]' 
                              : 'border-[#D9D9E0] dark:border-slate-800/80 hover:border-gray-300 dark:hover:border-slate-700 hover:shadow-3xs'
                          }`}
                        >
                          {/* Active Indicators */}
                          {isActive && (
                            <span className="absolute left-0 top-0 bottom-0 w-1 bg-red-700 rounded-l-xl" />
                          )}

                          <div className="flex items-center gap-3 min-w-0">
                            {/* Sequence Badge */}
                            <div className={`h-7 w-7 rounded-full flex items-center justify-center font-mono font-bold text-[10px] shrink-0 ${
                              isActive 
                                ? 'bg-red-700 text-white' 
                                : 'bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-gray-400'
                            }`}>
                              #{filteredHistoryOrders.length - idx}
                            </div>

                            {/* Ticket Details */}
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-xs font-black text-gray-950 dark:text-white uppercase tracking-wider">
                                  #{order.id}
                                </span>
                                <span className="text-[10px] bg-red-1050 dark:bg-red-950/40 text-red-750 dark:text-red-400 font-extrabold px-1.5 py-0.5 rounded">
                                  Table {order.tableNumber}
                                </span>
                                <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded ${
                                  order.status === 'completed'
                                    ? 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-800 dark:text-emerald-400'
                                    : 'bg-amber-50 dark:bg-amber-950/20 text-amber-800 dark:text-amber-400'
                                }`}>
                                  {order.status === 'completed' ? 'Paid' : order.status}
                                </span>
                              </div>
                              <div className="text-[11px] text-gray-600 dark:text-slate-400 font-bold mt-1">
                                {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {new Date(order.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                              </div>
                            </div>
                          </div>

                          {/* Order dishes previews */}
                          <div className="text-[12px] text-gray-900 dark:text-slate-200 font-bold truncate max-w-xs sm:text-right">
                            {order.items.map(it => `${it.quantity}x ${it.name}`).join(', ')}
                          </div>

                          {/* Quick Right Chevron / Total price */}
                          <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
                            <span className="text-xs sm:text-sm font-black text-gray-950 dark:text-white font-mono">
                              ₹{order.totalAmount.toFixed(2)}
                            </span>
                            <ChevronRight className={`h-3.5 w-3.5 text-gray-650 dark:text-slate-400 transition-transform ${isActive ? 'translate-x-0.5 text-red-700' : ''}`} />
                          </div>
                        </div>
                      );
                    })}

                    {filteredHistoryOrders.length === 0 && (
                      <div className="text-center py-16 text-xs text-gray-400 italic bg-white dark:bg-slate-900 rounded-2xl border border-[#D9D9E0] dark:border-slate-800">No active transaction logs fit current filters.</div>
                    )}
                  </div>
                ) : (
                  /* Desk Grouping Mode Redesign */
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[660px] overflow-y-auto pr-1">
                    {tables.map(tbl => {
                      const tableTickets = filteredHistoryOrders.filter(o => o.tableNumber === tbl.number);
                      const tableRevenue = tableTickets
                        .filter(o => o.status === 'completed')
                        .reduce((sum, o) => sum + o.totalAmount, 0);

                      return (
                        <div key={tbl.id} className="bg-white dark:bg-slate-900 rounded-2xl border border-[#D9D9E0] dark:border-slate-800 p-4 shadow-2xs hover:shadow-xs transition flex flex-col justify-between text-left">
                          <div>
                            <div className="flex justify-between items-center pb-2 border-b border-gray-150 dark:border-slate-800 mb-3">
                              <div>
                                <h4 className="font-extrabold text-xs text-gray-950 dark:text-white font-serif uppercase tracking-wider">Dining Desk #{tbl.number}</h4>
                                <span className="text-[9px] text-gray-400">Logs archive</span>
                              </div>
                              <span className="text-[10px] bg-red-50 dark:bg-red-950/20 text-red-750 dark:text-red-400 font-extrabold px-2 py-0.5 rounded border border-red-200/20">
                                ₹{tableRevenue.toFixed(0)} Sales
                              </span>
                            </div>

                            {/* Aggregated mini list */}
                            <div className="space-y-2 max-h-48 overflow-y-auto pr-0.5">
                              {tableTickets.map((tc, index) => (
                                <div 
                                  key={tc.id}
                                  onClick={() => setSelectedHistoryOrderId(tc.id)}
                                  className={`p-2 rounded-lg text-xs transition cursor-pointer flex justify-between items-center ${
                                    selectedHistoryOrderId === tc.id 
                                      ? 'bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/40 text-red-900 dark:text-red-300'
                                      : 'bg-gray-50 dark:bg-slate-950 border border-transparent hover:bg-gray-100 dark:hover:bg-slate-800/50'
                                  }`}
                                >
                                  <div>
                                    <span className="font-bold block text-[10px]">#Seq {tableTickets.length - index} • Ticket #{tc.id}</span>
                                    <span className="text-[9px] text-gray-405 truncate block max-w-[140px]">
                                      {tc.items.map(it => `${it.quantity}x ${it.name}`).join(', ')}
                                    </span>
                                  </div>
                                  <span className="font-bold text-gray-950 dark:text-white font-mono">₹{tc.totalAmount.toFixed(0)}</span>
                                </div>
                              ))}

                              {tableTickets.length === 0 && (
                                <div className="text-center py-6 text-[10px] text-gray-400 italic">No tickets recorded on Table {tbl.number}.</div>
                              )}
                            </div>
                          </div>

                          <div className="bg-gray-50 dark:bg-slate-950 px-2.5 py-2 rounded-xl text-[10px] uppercase font-bold text-gray-400 dark:text-gray-500 mt-4 flex justify-between">
                            <span>Total tickets</span>
                            <span className="text-gray-900 dark:text-white font-mono">{tableTickets.length} served</span>
                          </div>
                        </div>
                      );
                    })}

                    {tables.length === 0 && (
                      <div className="col-span-full text-center py-12 text-xs text-gray-400 italic">No active dining desks registered in the system.</div>
                    )}
                  </div>
                )}
                
              </div>

              {/* Right Side: Retro Thermal Receipt Drawer (5/12 Width) */}
              <div className="xl:col-span-5 h-full">
                {(() => {
                  const invoiceOrder = orders.find(o => o.id === selectedHistoryOrderId);
                  
                  if (!invoiceOrder) {
                    return (
                      <div className="bg-white dark:bg-slate-900 border border-[#D9D9E0] dark:border-slate-800 rounded-2xl p-12 text-center text-gray-400 italic shadow-2xs h-full flex flex-col justify-center items-center">
                        <Receipt className="h-8 w-8 text-gray-300 dark:text-gray-650 mb-3" />
                        <span>Select any transaction record from the ledger feed to generate its thermal POS invoice receipt here.</span>
                      </div>
                    );
                  }

                  // Precise backtrack math back to Grand Total
                  const grandTotal = invoiceOrder.totalAmount;
                  const packingChargeObj = grandTotal > 40 ? 20.00 : 0.00;
                  const totalAfterTaxes = grandTotal - packingChargeObj;
                  const netTaxSubtotal = totalAfterTaxes / 1.05;
                  const cgstVal = netTaxSubtotal * 0.025;
                  const sgstVal = netTaxSubtotal * 0.025;

                  return (
                    <div className="space-y-4 animate-slideIn">
                      {/* Thermal Paper Slip Frame */}
                      <div className="bg-[#FFFFFE] dark:bg-slate-950 border-2 border-dashed border-[#C0C0C8] dark:border-slate-850 hover:shadow-md transition duration-200 rounded-2xl p-6 relative overflow-hidden font-sans text-left text-gray-900 dark:text-gray-200">
                        
                        {/* Dot-matrix style aesthetic cuts at the top */}
                        <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-b from-[#ECEBE8] to-transparent dark:from-slate-900/10 opacity-60" />

                        {/* Thermal Header */}
                        <div className="text-center space-y-1 mb-5">
                          <div className="font-extrabold text-sm uppercase tracking-widest text-red-700 dark:text-red-400 font-serif leading-none flex flex-col items-center justify-center">
                            <span className="text-[12px] font-black tracking-widest leading-none">GOOD GOOD DAIRY</span>
                            <span className="text-[10px] leading-tight font-sans tracking-wide text-gray-400 dark:text-gray-500 font-bold mt-1">Gourmet Diner Order Hub</span>
                          </div>
                          <span className="text-[9px] uppercase tracking-wider font-extrabold text-gray-400 dark:text-gray-550 block pt-1">--- TAX INVOICE RECEIPT ---</span>
                        </div>

                        {/* Thermal Meta details */}
                        <div className="grid grid-cols-2 gap-y-1 text-[10px] border-b border-dashed border-[#D9D9E0] dark:border-slate-800 pb-3 mb-4 text-gray-550 dark:text-gray-400 font-medium">
                          <div>Ticket Sequence: <span className="font-extrabold text-gray-950 dark:text-white font-mono">#{invoiceOrder.id}</span></div>
                          <div className="text-right">Table Desk: <span className="font-extrabold text-gray-950 dark:text-white font-mono">Desk #{invoiceOrder.tableNumber}</span></div>
                          <div>Date: <span className="font-mono">{new Date(invoiceOrder.createdAt).toLocaleDateString([], { month: '2-digit', day: '2-digit', year: 'numeric' })}</span></div>
                          <div className="text-right">Time: <span className="font-mono">{new Date(invoiceOrder.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span></div>
                          <div>Register Terminal: <span className="font-mono">#03-WEB</span></div>
                          <div className="text-right">State: <span className="font-extrabold text-emerald-700 dark:text-emerald-450 uppercase">{invoiceOrder.status}</span></div>
                        </div>

                        {/* Itemized Table header */}
                        <div className="grid grid-cols-12 text-[9px] uppercase font-bold text-gray-400 dark:text-gray-500 mb-2 font-mono">
                          <div className="col-span-7">Description</div>
                          <div className="col-span-2 text-center font-mono">Qty</div>
                          <div className="col-span-3 text-right font-mono">Amount</div>
                        </div>

                        {/* Itemized items rows */}
                        <div className="space-y-2 border-b border-dashed border-[#D9D9E0] dark:border-slate-800 pb-3 mb-4 max-h-56 overflow-y-auto pr-0.5">
                          {invoiceOrder.items.map(it => (
                            <div key={it.id} className="text-xs">
                              <div className="grid grid-cols-12 items-start font-medium leading-tight">
                                <div className="col-span-7 font-semibold text-gray-800 dark:text-gray-300 leading-snug">{it.name}</div>
                                <div className="col-span-2 text-center font-mono text-gray-650 dark:text-gray-400">x{it.quantity}</div>
                                <div className="col-span-3 text-right font-mono font-bold text-gray-900 dark:text-gray-200">₹{(it.price * it.quantity).toFixed(2)}</div>
                              </div>
                              {it.notes && (
                                <div className="text-[9px] text-amber-800 dark:text-amber-550 leading-none italic mt-0.5 pl-2 border-l border-amber-200">
                                  Notes: {it.notes}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>

                        {/* Balance sheet calculations */}
                        <div className="space-y-1 text-[11px] border-b border-dashed border-[#D9D9E0] dark:border-slate-800 pb-3 mb-4 font-mono">
                          <div className="flex justify-between text-gray-500 dark:text-gray-450">
                            <span>Subtotal (Net):</span>
                            <span>₹{netTaxSubtotal.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between text-gray-500 dark:text-gray-450">
                            <span>Packaging Charges Option:</span>
                            <span>₹{packingChargeObj.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between text-gray-400 dark:text-gray-550">
                            <span>CGST (2.5%):</span>
                            <span>₹{cgstVal.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between text-gray-400 dark:text-gray-550">
                            <span>SGST (2.5%):</span>
                            <span>₹{sgstVal.toFixed(2)}</span>
                          </div>
                        </div>

                        {/* Retro total cost box */}
                        <div className="flex justify-between items-center py-2.5 px-3 bg-red-50/50 dark:bg-slate-900 rounded-xl border border-red-100/50 dark:border-slate-800/80 mb-6">
                          <span className="text-xs uppercase tracking-wider font-extrabold text-red-700 dark:text-red-400">Grand Total Invoice</span>
                          <span className="text-base font-black text-red-700 dark:text-red-400 font-mono">₹{grandTotal.toFixed(2)}</span>
                        </div>

                        {/* Bottom Greeting */}
                        <div className="text-center text-[10px] text-gray-400 dark:text-gray-550 space-y-0.5 leading-relaxed font-serif italic mb-6">
                          <div>Thank you for dining at Good Good Dairy!</div>
                          <div>Excellence in Pure Organic Cuisines.</div>
                          <div className="font-sans font-bold uppercase tracking-wider text-[8px] pt-1.5 not-italic text-emerald-700 dark:text-emerald-455">--- TRANSACTION SUCCESSFUL ---</div>
                        </div>

                        {/* Print Receipt Trigger Button */}
                        <button
                          type="button"
                          onClick={() => handlePrintReceipt(invoiceOrder)}
                          className="w-full py-2.5 bg-red-700 hover:bg-red-800 dark:bg-red-800 dark:hover:bg-red-900 text-white font-black text-xs uppercase tracking-wider rounded-xl transition flex items-center justify-center space-x-1.5 cursor-pointer active:scale-98 shadow-sm"
                        >
                          <Printer className="h-4 w-4" />
                          <span>Print POS Receipt</span>
                        </button>
                        
                      </div>
                    </div>
                  );
                })()}
              </div>

            </div>

          </div>
        )}

        {/* 5. CONFIGURATION & PREFERENCES SETTINGS PAGE */}
        {activeTab === 'settings' && (
          <div className="space-y-6 max-w-2xl mx-auto w-full animate-fadeIn">
            <div className="flex items-center justify-between pb-2 border-b border-[#D9D9E0] dark:border-slate-800">
              <button
                type="button"
                onClick={() => setActiveTab('orders')}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-white dark:bg-slate-900 border border-[#D9D9E0] dark:border-slate-800 hover:bg-gray-50 dark:hover:bg-slate-800 text-gray-700 dark:text-gray-200 text-xs font-bold rounded-xl transition cursor-pointer"
              >
                ← Back to Orders Page
              </button>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-[#D9D9E0] dark:border-slate-800 p-6 rounded-2xl shadow-xs">
              <h2 className="text-sm font-extrabold text-gray-950 dark:text-gray-100 mb-1 font-serif font-bold">Sound & Layout Options</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-6">Choose how the dashboard looks and plays sound alerts here.</p>

              <div className="space-y-6">
                {/* Notification Setting */}
                <div className="pb-6 border-b border-[#D9D9E0] dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="max-w-md">
                    <span className="text-xs font-extrabold text-gray-900 dark:text-gray-100 block font-serif">Alert Bell and Sounds</span>
                    <span className="text-xs text-gray-500 dark:text-gray-450 font-medium">Ring a loud bell sound when a customer submits a new food order.</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (notificationPermission === 'granted') {
                        sendTestNotification();
                      } else {
                        requestNotificationPermissionAndTest();
                      }
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-red-50 dark:bg-red-950/20 hover:bg-red-100 dark:hover:bg-red-950/40 border border-red-200 dark:border-red-900/60 rounded-xl text-xs font-bold text-red-700 dark:text-red-400 cursor-pointer transition select-none"
                  >
                    <BellRing className={`h-4 w-4 ${notificationPermission === 'granted' ? 'text-red-700 animate-pulse' : 'text-gray-400'}`} />
                    <span>{notificationPermission === 'granted' ? 'Bell Is Active (Test)' : 'Turn On Alert Bell'}</span>
                  </button>
                </div>

                {/* Theme Mode Setting */}
                <div className="pb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="max-w-md">
                    <span className="text-xs font-extrabold text-gray-900 dark:text-gray-100 block font-serif">Screen Color</span>
                    <span className="text-xs text-gray-500 dark:text-gray-450 font-medium">Choose "Light Screen" for bright colors, or "Dark Screen" for a dark background. (Default is Light Screen)</span>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => setTheme('light')}
                      className={`py-2 px-4 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 border cursor-pointer select-none ${
                        theme === 'light'
                          ? 'bg-red-700 text-white border-red-700 font-extrabold shadow-sm'
                          : 'bg-gray-50 dark:bg-slate-800 text-gray-650 dark:text-gray-400 border-gray-200 dark:border-slate-700'
                      }`}
                    >
                      🌞 Light Screen
                    </button>
                    <button
                      type="button"
                      onClick={() => setTheme('dark')}
                      className={`py-2 px-4 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 border cursor-pointer select-none ${
                        theme === 'dark'
                          ? 'bg-red-700 text-white border-red-700 font-extrabold shadow-sm'
                          : 'bg-gray-50 dark:bg-slate-800 text-gray-650 dark:text-gray-400 border-gray-200 dark:border-slate-700'
                      }`}
                    >
                      🌙 Dark Screen
                    </button>
                  </div>
                </div>

              </div>
            </div>
          </div>
        )}

      </main>

      {/* 🧾 DIRECT ORDER / BILL CREATION MODAL OVERLAY */}
      {createOrderModalOpen && (
        <div id="create-order-overlay" className="fixed inset-0 z-50 bg-black/65 flex items-center justify-center p-4 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-[#D9D9E0] dark:border-slate-800 flex flex-col max-h-[92vh] text-gray-900 dark:text-white">
            
            {/* Header */}
            <div className="flex justify-between items-center pb-3 border-b border-gray-200 dark:border-slate-800 mb-4 shrink-0">
              <div>
                <span className="text-[10px] font-black tracking-widest text-emerald-600 dark:text-emerald-400 block uppercase font-mono">Counter Operations</span>
                <h3 className="font-extrabold text-gray-950 dark:text-white text-lg font-serif">
                  Create Direct Order / Bill
                </h3>
                <p className="text-[11px] text-gray-400">Add walk-in orders directly from the manager's console table</p>
              </div>
              <button 
                onClick={() => setCreateOrderModalOpen(false)}
                className="bg-gray-100 dark:bg-slate-800 text-gray-400 hover:text-gray-900 dark:hover:text-white rounded-full p-1.5 cursor-pointer hover:bg-gray-200 dark:hover:bg-slate-700 transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Scrollable Form Content */}
            <div className="overflow-y-auto flex-grow space-y-5 pr-1.5 scrollbar-thin">
              
              {/* SECTION 0: DESK & CUSTOMER METADATA */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-gray-50 dark:bg-slate-950/45 p-4 rounded-xl border border-gray-150 dark:border-slate-800">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-gray-500 dark:text-slate-400 uppercase">Desk / Table Number</label>
                  <select
                    value={createOrderTableNumber}
                    onChange={(e) => setCreateOrderTableNumber(parseInt(e.target.value) || 0)}
                    className="w-full text-xs px-2.5 py-1.5 border border-gray-300 dark:border-slate-800 rounded-lg focus:outline-none focus:ring-1 focus:ring-red-500 bg-white dark:bg-slate-950 text-gray-900 dark:text-white font-bold"
                  >
                    <option value={0}>🛎️ Manager's Table / Counter</option>
                    {tables.map(t => (
                      <option key={t.id} value={t.number}>🪑 Table {t.number}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-gray-500 dark:text-slate-400 uppercase">Customer Name (Optional)</label>
                  <input
                    type="text"
                    placeholder="Walk-in Guest, Prasann..."
                    value={createOrderCustomerName}
                    onChange={(e) => setCreateOrderCustomerName(e.target.value)}
                    className="w-full text-xs px-2.5 py-1.5 border border-gray-300 dark:border-slate-800 rounded-lg focus:outline-none focus:ring-1 focus:ring-red-500 bg-white dark:bg-slate-950 text-gray-900 dark:text-white font-semibold"
                  />
                </div>

                <div className="flex flex-col justify-end pb-1">
                  <label className="flex items-center space-x-2.5 bg-white dark:bg-slate-900 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-slate-800 cursor-pointer hover:bg-gray-100 dark:hover:bg-slate-800 transition h-[33px]">
                    <input
                      type="checkbox"
                      checked={createOrderIsParcel}
                      onChange={(e) => setCreateOrderIsParcel(e.target.checked)}
                      className="accent-emerald-600 rounded text-emerald-600 cursor-pointer h-4 w-4"
                    />
                    <span className="text-xs font-bold text-gray-700 dark:text-slate-300 uppercase tracking-wide">📦 Parcel / Takeaway</span>
                  </label>
                </div>
              </div>

              {/* SECTION 1: ADD ITEMS FROM MENU */}
              <div className="border-t border-gray-150 dark:border-slate-800 pt-4 space-y-3">
                <span className="text-[10px] font-black text-gray-500 dark:text-slate-400 uppercase tracking-wider block">Add Items from Food Menu</span>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Menu search input */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-extrabold text-gray-500 dark:text-slate-400 uppercase">Type Food Name to Search</label>
                    <input
                      type="text"
                      placeholder="Search menu items..."
                      value={createOrderSearchItem}
                      onChange={e => setCreateOrderSearchItem(e.target.value)}
                      className="w-full text-xs px-2.5 py-1.5 border border-gray-300 dark:border-slate-800 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 bg-white dark:bg-slate-950 text-gray-900 dark:text-white"
                    />
                    <div className="max-h-[150px] overflow-y-auto border border-gray-200 dark:border-slate-800/80 rounded-lg p-1 space-y-1 bg-gray-50 dark:bg-slate-950/40">
                      {menuItems.filter(item => item.name.toLowerCase().includes(createOrderSearchItem.toLowerCase())).slice(0, 15).map(item => (
                        <div
                          key={item.id}
                          className={`flex items-center justify-between p-1 rounded transition border ${createOrderSelectedMenuItemId === item.id ? 'bg-emerald-500/10 border-emerald-500' : 'border-transparent hover:bg-gray-150 dark:hover:bg-slate-900'}`}
                        >
                          <button
                            type="button"
                            onClick={() => {
                              setCreateOrderSelectedMenuItemId(item.id);
                              setCreateOrderSelectedPortion('full');
                              setCreateOrderItemQuantity(1);
                              setCreateOrderItemNotes('');
                            }}
                            className="flex-grow text-left px-2 py-1 text-[11px] font-bold text-gray-750 dark:text-slate-300"
                          >
                            <span className="block font-black text-gray-950 dark:text-white text-xs leading-tight">{item.name}</span>
                            {item.isSinglePortion ? (
                              <span className="font-mono text-[10px] text-gray-500 dark:text-slate-400">₹{item.price.toFixed(2)}</span>
                            ) : (
                              <span className="font-mono text-[9px] text-gray-500 dark:text-slate-400 block mt-0.5">
                                Half: ₹{(item.halfPrice ?? Math.round(item.price * 0.5)).toFixed(0)} | Full: ₹{(item.fullPrice ?? item.price).toFixed(0)}
                              </span>
                            )}
                          </button>

                          {!item.isSinglePortion ? (
                            <div className="flex gap-1 shrink-0">
                              <button
                                type="button"
                                onClick={() => {
                                  const price = item.halfPrice ?? Math.round(item.price * 0.5);
                                  const existingIndex = createOrderItems.findIndex(
                                    it => it.menuItemId === item.id && it.portion === 'half'
                                  );
                                  if (existingIndex > -1) {
                                    setCreateOrderItems(prev => prev.map((it, idx) => {
                                      if (idx === existingIndex) {
                                        return { ...it, quantity: it.quantity + 1 };
                                      }
                                      return it;
                                    }));
                                  } else {
                                    const newItem = {
                                      id: `create-item-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
                                      menuItemId: item.id,
                                      name: item.name,
                                      price: price,
                                      quantity: 1,
                                      notes: '',
                                      portion: 'half' as const
                                    };
                                    setCreateOrderItems(prev => [...prev, newItem]);
                                  }
                                  triggerToast(`Added ${item.name} (Half) to direct bill!`);
                                }}
                                className="px-2 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded text-[10px] font-black uppercase tracking-wider transition cursor-pointer"
                                title="Quick Add Half Portion"
                              >
                                + Half
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  const price = item.fullPrice ?? item.price;
                                  const existingIndex = createOrderItems.findIndex(
                                    it => it.menuItemId === item.id && it.portion === 'full'
                                  );
                                  if (existingIndex > -1) {
                                    setCreateOrderItems(prev => prev.map((it, idx) => {
                                      if (idx === existingIndex) {
                                        return { ...it, quantity: it.quantity + 1 };
                                      }
                                      return it;
                                    }));
                                  } else {
                                    const newItem = {
                                      id: `create-item-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
                                      menuItemId: item.id,
                                      name: item.name,
                                      price: price,
                                      quantity: 1,
                                      notes: '',
                                      portion: 'full' as const
                                    };
                                    setCreateOrderItems(prev => [...prev, newItem]);
                                  }
                                  triggerToast(`Added ${item.name} (Full) to direct bill!`);
                                }}
                                className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[10px] font-black uppercase tracking-wider transition cursor-pointer"
                                title="Quick Add Full Portion"
                              >
                                + Full
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                const price = item.price;
                                const existingIndex = createOrderItems.findIndex(
                                  it => it.menuItemId === item.id && !it.portion
                                );
                                if (existingIndex > -1) {
                                  setCreateOrderItems(prev => prev.map((it, idx) => {
                                    if (idx === existingIndex) {
                                      return { ...it, quantity: it.quantity + 1 };
                                    }
                                    return it;
                                  }));
                                } else {
                                  const newItem = {
                                    id: `create-item-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
                                    menuItemId: item.id,
                                    name: item.name,
                                    price: price,
                                    quantity: 1,
                                    notes: '',
                                    portion: undefined
                                  };
                                  setCreateOrderItems(prev => [...prev, newItem]);
                                }
                                triggerToast(`Added ${item.name} to direct bill!`);
                              }}
                              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[10px] font-black uppercase tracking-wider shrink-0 transition cursor-pointer"
                              title="Quick Add 1 Qty"
                            >
                              + Add
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Config portion & quantity */}
                  <div className="space-y-2 text-xs flex flex-col justify-between">
                    {createOrderSelectedMenuItemId ? (() => {
                      const selectedItem = menuItems.find(m => m.id === createOrderSelectedMenuItemId);
                      if (!selectedItem) return null;
                      return (
                        <div className="space-y-2 bg-gray-50 dark:bg-slate-950/40 p-3 rounded-lg border border-gray-200 dark:border-slate-800/60 flex-grow flex flex-col justify-between">
                          <div className="space-y-1.5">
                            <span className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 block uppercase font-serif">Selected: {selectedItem.name}</span>
                            
                            {!selectedItem.isSinglePortion && (
                              <div className="flex gap-1.5 mt-1">
                                <button
                                  type="button"
                                  onClick={() => setCreateOrderSelectedPortion('half')}
                                  className={`flex-1 py-1 rounded text-[10px] font-bold border transition ${createOrderSelectedPortion === 'half' ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-500 text-emerald-700 dark:text-emerald-400' : 'border-gray-200 dark:border-slate-800 hover:bg-gray-100 dark:hover:bg-slate-900 text-gray-500'}`}
                                >
                                  Half (₹{selectedItem.halfPrice?.toFixed(2)})
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setCreateOrderSelectedPortion('full')}
                                  className={`flex-1 py-1 rounded text-[10px] font-bold border transition ${createOrderSelectedPortion === 'full' ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-500 text-emerald-700 dark:text-emerald-400' : 'border-gray-200 dark:border-slate-800 hover:bg-gray-100 dark:hover:bg-slate-900 text-gray-500'}`}
                                >
                                  Full (₹{selectedItem.fullPrice?.toFixed(2)})
                                </button>
                              </div>
                            )}

                            <div className="flex items-center justify-between gap-2 mt-1">
                              <span className="text-[10px] font-bold text-gray-500">Quantity:</span>
                              <div className="flex items-center space-x-1.5 bg-white dark:bg-slate-900 rounded-md border border-gray-200 dark:border-slate-800 p-0.5">
                                <button
                                  type="button"
                                  onClick={() => setCreateOrderItemQuantity(prev => Math.max(1, prev - 1))}
                                  className="px-2 py-0.5 hover:bg-gray-100 dark:hover:bg-slate-800 font-bold"
                                >
                                  -
                                </button>
                                <span className="font-bold font-mono px-1.5">{createOrderItemQuantity}</span>
                                <button
                                  type="button"
                                  onClick={() => setCreateOrderItemQuantity(prev => prev + 1)}
                                  className="px-2 py-0.5 hover:bg-gray-100 dark:hover:bg-slate-800 font-bold"
                                >
                                  +
                                </button>
                              </div>
                            </div>

                            <input
                              type="text"
                              placeholder="Special instruction notes..."
                              value={createOrderItemNotes}
                              onChange={e => setCreateOrderItemNotes(e.target.value)}
                              className="w-full text-[11px] px-2 py-1 mt-1 border border-gray-200 dark:border-slate-800 rounded bg-white dark:bg-slate-950 text-gray-900 dark:text-white"
                            />
                          </div>

                          <button
                            type="button"
                            onClick={handleAddItemToCreateOrder}
                            className="w-full mt-2 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold uppercase rounded-lg transition"
                          >
                            + Add to Bill List
                          </button>
                        </div>
                      );
                    })() : (
                      <div className="flex-grow flex items-center justify-center border border-dashed border-gray-200 dark:border-slate-800 rounded-lg p-4 text-center text-gray-400 italic">
                        Select a food item on the left to configure portion & quantity
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* SECTION 2: ADD CUSTOM UNLISTED PRODUCT */}
              <div className="border-t border-gray-150 dark:border-slate-800 pt-4 space-y-2">
                <span className="text-[10px] font-black text-gray-500 dark:text-slate-400 uppercase tracking-wider block">
                  Add Custom Unlisted Item (e.g. Cold Drink, Candy, Ice-Cream)
                </span>
                
                <div className="bg-gray-50 dark:bg-slate-950/30 p-3 rounded-xl border border-gray-200 dark:border-slate-800 flex flex-col md:flex-row gap-3 items-end">
                  <div className="flex-grow w-full md:w-auto space-y-1">
                    <label className="text-[10px] font-bold text-gray-500 dark:text-slate-400 block uppercase">Product Title</label>
                    <input
                      type="text"
                      placeholder="e.g. Amul Vanilla Ice Cream"
                      value={createOrderCustomItemName}
                      onChange={e => setCreateOrderCustomItemName(e.target.value)}
                      className="w-full text-xs px-2.5 py-1.5 border border-gray-300 dark:border-slate-800 rounded-lg bg-white dark:bg-slate-950 text-gray-900 dark:text-white"
                    />
                  </div>
                  
                  <div className="w-full md:w-[130px] space-y-1">
                    <label className="text-[10px] font-bold text-gray-500 dark:text-slate-400 block uppercase">Price Amount (₹)</label>
                    <input
                      type="number"
                      placeholder="e.g. 40"
                      value={createOrderCustomItemPrice}
                      onChange={e => setCreateOrderCustomItemPrice(e.target.value)}
                      className="w-full text-xs px-2.5 py-1.5 border border-gray-300 dark:border-slate-800 rounded-lg bg-white dark:bg-slate-950 text-gray-900 dark:text-white"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={handleAddCustomItemToCreateOrder}
                    className="w-full md:w-auto px-4 py-1.5 bg-gray-900 hover:bg-black dark:bg-slate-800 dark:hover:bg-slate-700 text-white text-xs font-bold rounded-lg transition shrink-0 h-[32px] flex items-center justify-center uppercase tracking-wide cursor-pointer"
                  >
                    + Add Product
                  </button>
                </div>
              </div>

              {/* SECTION 3: CURRENT BILL PREVIEW ITEMS */}
              <div className="border-t border-gray-150 dark:border-slate-800 pt-4 space-y-2.5">
                <span className="text-[10px] font-black text-gray-500 dark:text-slate-400 uppercase tracking-wider block">Items Added to the Bill</span>
                <div className="bg-[#FFFDF9] dark:bg-slate-950 rounded-xl p-3 border border-[#D9D9E0] dark:border-slate-800/80 space-y-2 max-h-[160px] overflow-y-auto">
                  {createOrderItems.length > 0 ? (
                    createOrderItems.map((it) => (
                      <div key={it.id} className="flex justify-between items-center text-xs pb-2 border-b border-dashed border-gray-200 dark:border-slate-850 last:border-0 last:pb-0">
                        <div className="space-y-0.5">
                          <span className="font-bold text-gray-950 dark:text-white block">
                            {it.name}{it.portion ? ` (${it.portion === 'half' ? 'Half' : 'Full'})` : ''}
                          </span>
                          <span className="text-[10px] text-gray-500 dark:text-slate-400 font-mono">
                            ₹{it.price.toFixed(2)} each {it.notes && `| Note: ${it.notes}`}
                          </span>
                        </div>
                        
                        <div className="flex items-center space-x-3 shrink-0">
                          <div className="flex items-center space-x-1.5 bg-gray-150/80 dark:bg-slate-900 rounded-lg px-1.5 py-1 border border-gray-250 dark:border-slate-800">
                            <button
                              type="button"
                              onClick={() => handleUpdateItemQtyInCreateOrder(it.id, it.quantity - 1)}
                              className="text-xs font-black px-1.5 hover:text-red-700 dark:hover:text-red-400 cursor-pointer text-gray-500"
                            >
                              -
                            </button>
                            <span className="font-black text-gray-900 dark:text-white w-4 text-center font-mono text-[11px]">
                              {it.quantity}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleUpdateItemQtyInCreateOrder(it.id, it.quantity + 1)}
                              className="text-xs font-black px-1.5 hover:text-emerald-600 cursor-pointer text-gray-500"
                            >
                              +
                            </button>
                          </div>
                          
                          <button
                            type="button"
                            onClick={() => handleRemoveItemFromCreateOrder(it.id)}
                            className="p-1 text-red-650 hover:text-red-850 dark:text-red-450 bg-red-50 dark:bg-red-950/20 hover:bg-red-100 rounded transition"
                            title="Remove item"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-6 text-xs text-gray-400 italic">
                      No items have been added to this bill yet.
                    </div>
                  )}
                </div>
              </div>

            </div>

            {/* Footer containing Total and Actions */}
            <div className="border-t border-[#D9D9E0] dark:border-slate-800 pt-4 mt-4 space-y-4 shrink-0">
              <div className="flex justify-between items-center bg-yellow-50/55 dark:bg-amber-950/15 p-3 rounded-xl border border-yellow-200 dark:border-amber-900/40">
                <div>
                  <span className="text-[10px] block font-black text-red-750 dark:text-red-400 uppercase leading-none">Bill Total Amount</span>
                  <span className="text-[11px] text-gray-500 dark:text-slate-400">Walk-in immediate direct invoice</span>
                </div>
                <span className="text-xl font-black text-red-800 dark:text-red-400 font-mono">
                  ₹{createOrderItems.reduce((sum, item) => sum + (item.price * item.quantity), 0).toFixed(2)}
                </span>
              </div>

              <div className="flex flex-col sm:flex-row gap-2">
                <button
                  type="button"
                  onClick={() => setCreateOrderModalOpen(false)}
                  className="py-2.5 px-4 bg-gray-100 hover:bg-gray-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-gray-750 dark:text-slate-300 font-bold text-xs rounded-xl transition cursor-pointer"
                >
                  Close & Dismiss
                </button>
                
                <button
                  type="button"
                  onClick={() => handleSaveCreatedOrder('pending')}
                  className="py-2.5 px-4 bg-amber-600 hover:bg-amber-700 text-white font-extrabold text-xs uppercase tracking-wide rounded-xl transition cursor-pointer flex-1"
                >
                  Pending Order
                </button>

                <button
                  type="button"
                  onClick={() => handleSaveCreatedOrder('preparing')}
                  className="py-2.5 px-4 bg-red-700 hover:bg-red-800 text-white font-extrabold text-xs uppercase tracking-wide rounded-xl transition cursor-pointer flex-1"
                >
                  Send to Kitchen (Preparing)
                </button>

                <button
                  type="button"
                  onClick={() => handleSaveCreatedOrder('completed')}
                  className="py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs uppercase tracking-wide rounded-xl transition cursor-pointer flex-1 shadow-md hover:shadow-lg"
                >
                  Mark Completed (Paid)
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* ✏️ EDIT ORDER & BILL MODAL OVERLAY */}
      {editingOrder !== null && (
        <div id="edit-order-bill-overlay" className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-[#D9D9E0] dark:border-slate-800 flex flex-col max-h-[90vh] animate-slideUp text-gray-900 dark:text-white">
            
            {/* Header */}
            <div className="flex justify-between items-center pb-3 border-b border-gray-200 dark:border-slate-800 mb-4 shrink-0">
              <div>
                <span className="text-[10px] font-black tracking-widest text-red-700 dark:text-red-400 block uppercase">Manual Billing & Adjustments</span>
                <h3 className="font-extrabold text-gray-900 dark:text-white text-md font-serif">
                  Modify Table {editingOrder.tableNumber} Bill
                </h3>
                <p className="text-[10px] text-gray-400 font-mono">Ticket ID: #{editingOrder.id}</p>
              </div>
              <button 
                onClick={() => setEditingOrder(null)}
                className="bg-gray-100 dark:bg-slate-800 text-gray-400 hover:text-gray-900 dark:hover:text-white rounded-full p-1.5 cursor-pointer hover:bg-gray-200 dark:hover:bg-slate-700 transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Scrollable Form Content */}
            <div className="overflow-y-auto flex-grow space-y-5 pr-1.5 scrollbar-thin">
              
              {/* SECTION 1: CURRENT BILL ITEMS */}
              <div className="space-y-2.5">
                <span className="text-[10px] font-black text-gray-500 dark:text-slate-400 uppercase tracking-wider block">Current Bill Items</span>
                <div className="bg-[#FFFDF9] dark:bg-slate-950 rounded-xl p-3 border border-[#D9D9E0] dark:border-slate-800/80 space-y-2">
                  {editingOrder.items.length > 0 ? (
                    editingOrder.items.map((it) => (
                      <div key={it.id} className="flex justify-between items-center text-xs pb-2 border-b border-dashed border-gray-200 dark:border-slate-800 last:border-0 last:pb-0">
                        <div className="space-y-0.5">
                          <span className="font-bold text-gray-950 dark:text-white block">
                            {it.name}{it.portion ? ` (${it.portion === 'half' ? 'Half' : 'Full'})` : ''}
                          </span>
                          <span className="text-[10px] text-gray-500 dark:text-slate-400 font-mono">
                            ₹{it.price.toFixed(2)} each {it.notes && `| Note: ${it.notes}`}
                          </span>
                        </div>
                        
                        <div className="flex items-center space-x-3 shrink-0">
                          <div className="flex items-center space-x-1.5 bg-gray-150/80 dark:bg-slate-900 rounded-lg px-1.5 py-1 border border-gray-200/50 dark:border-slate-800">
                            <button
                              type="button"
                              onClick={() => handleUpdateItemQtyInEdit(it.id, it.quantity - 1)}
                              className="text-xs font-black px-1.5 hover:text-red-700 dark:hover:text-red-400 cursor-pointer text-gray-500"
                            >
                              -
                            </button>
                            <span className="font-black text-gray-900 dark:text-white w-4 text-center font-mono text-[11px]">
                              {it.quantity}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleUpdateItemQtyInEdit(it.id, it.quantity + 1)}
                              className="text-xs font-black px-1.5 hover:text-emerald-600 cursor-pointer text-gray-500"
                            >
                              +
                            </button>
                          </div>
                          
                          <button
                            type="button"
                            onClick={() => handleRemoveItemFromEdit(it.id)}
                            className="p-1 text-red-650 hover:text-red-800 dark:text-red-400 bg-red-50 dark:bg-red-950/20 hover:bg-red-100 rounded transition"
                            title="Remove from bill"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-6 text-xs text-gray-400 italic">
                      Bill is empty. Use the tools below to add products.
                    </div>
                  )}
                </div>
              </div>

              {/* SECTION 2: ADD ITEMS FROM MENU */}
              <div className="border-t border-gray-150 dark:border-slate-800 pt-4 space-y-3">
                <span className="text-[10px] font-black text-gray-500 dark:text-slate-400 uppercase tracking-wider block">Add Items from Menu</span>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  {/* Select menu item searching */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-extrabold text-gray-600 dark:text-slate-400 uppercase">Search Menu</label>
                    <input
                      type="text"
                      placeholder="Type product name..."
                      value={editSearchItem}
                      onChange={e => setEditSearchItem(e.target.value)}
                      className="w-full text-xs px-2.5 py-1.5 border border-gray-300 dark:border-slate-800 rounded-lg focus:outline-none focus:ring-1 focus:ring-red-500 bg-white dark:bg-slate-950 text-gray-900 dark:text-white"
                    />
                    <div className="max-h-[110px] overflow-y-auto border border-gray-200 dark:border-slate-800/80 rounded-lg p-1 space-y-1 bg-gray-50 dark:bg-slate-950/40">
                      {menuItems.filter(item => item.name.toLowerCase().includes(editSearchItem.toLowerCase())).slice(0, 15).map(item => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => {
                            setSelectedMenuItemId(item.id);
                            setEditSearchItem(item.name);
                          }}
                          className={`w-full text-left px-2 py-1 rounded text-[11px] font-bold transition flex justify-between items-center ${selectedMenuItemId === item.id ? 'bg-red-700 text-white' : 'hover:bg-gray-200 dark:hover:bg-slate-900 text-gray-700 dark:text-slate-350'}`}
                        >
                          <span>{item.name}</span>
                          <span className="font-mono text-[10px] opacity-80">₹{item.price.toFixed(2)}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Quantity and Portion configs */}
                  <div className="space-y-2 text-xs flex flex-col justify-between">
                    {selectedMenuItemId ? (() => {
                      const selectedItem = menuItems.find(m => m.id === selectedMenuItemId);
                      if (!selectedItem) return null;
                      return (
                        <div className="space-y-2 bg-gray-50 dark:bg-slate-950/40 p-2.5 rounded-lg border border-gray-200 dark:border-slate-800/60 flex-grow flex flex-col justify-between">
                          <div className="space-y-1.5">
                            <span className="text-[10px] font-black text-red-700 dark:text-red-400 block uppercase font-serif">Configure: {selectedItem.name}</span>
                            
                            {!selectedItem.isSinglePortion && (
                              <div className="flex gap-1.5 mt-1">
                                <button
                                  type="button"
                                  onClick={() => setSelectedPortion('half')}
                                  className={`flex-1 py-1 rounded text-[10px] font-bold border transition ${selectedPortion === 'half' ? 'bg-red-50 dark:bg-red-950/30 border-red-500 text-red-700 dark:text-red-400' : 'border-gray-200 dark:border-slate-800 hover:bg-gray-100 dark:hover:bg-slate-900 text-gray-500'}`}
                                >
                                  Half (₹{selectedItem.halfPrice?.toFixed(2)})
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setSelectedPortion('full')}
                                  className={`flex-1 py-1 rounded text-[10px] font-bold border transition ${selectedPortion === 'full' ? 'bg-red-50 dark:bg-red-950/30 border-red-500 text-red-700 dark:text-red-400' : 'border-gray-200 dark:border-slate-800 hover:bg-gray-100 dark:hover:bg-slate-900 text-gray-500'}`}
                                >
                                  Full (₹{selectedItem.fullPrice?.toFixed(2)})
                                </button>
                              </div>
                            )}

                            <div className="flex items-center justify-between gap-2 mt-1">
                              <span className="text-[10px] font-bold text-gray-500">Quantity:</span>
                              <div className="flex items-center space-x-1.5 bg-white dark:bg-slate-900 rounded-md border border-gray-200 dark:border-slate-800 p-0.5">
                                <button
                                  type="button"
                                  onClick={() => setItemQuantity(prev => Math.max(1, prev - 1))}
                                  className="px-1.5 py-0.5 hover:bg-gray-100 dark:hover:bg-slate-800 font-bold"
                                >
                                  -
                                </button>
                                <span className="font-bold font-mono px-1">{itemQuantity}</span>
                                <button
                                  type="button"
                                  onClick={() => setItemQuantity(prev => prev + 1)}
                                  className="px-1.5 py-0.5 hover:bg-gray-100 dark:hover:bg-slate-800 font-bold"
                                >
                                  +
                                </button>
                              </div>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={handleAddMenuItemToEdit}
                            className="w-full mt-2 py-1.5 bg-red-700 hover:bg-red-800 text-white text-[11px] font-bold uppercase rounded-lg transition"
                          >
                            + Add to Ticket Bill
                          </button>
                        </div>
                      );
                    })() : (
                      <div className="flex-grow flex items-center justify-center border border-dashed border-gray-200 dark:border-slate-800 rounded-lg p-4 text-center text-gray-400 italic">
                        Select a menu item on the left to configure portion & quantity
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* SECTION 3: ADD CUSTOM UNLISTED PRODUCT */}
              <div className="border-t border-gray-150 dark:border-slate-800 pt-4 space-y-2.5">
                <span className="text-[10px] font-black text-gray-500 dark:text-slate-400 uppercase tracking-wider block">
                  Add Custom Unlisted Item (e.g. Chocolate, Cold Drink)
                </span>
                
                <div className="bg-gray-50 dark:bg-slate-950/30 p-3 rounded-xl border border-[#D9D9E0] dark:border-slate-850 flex flex-col md:flex-row gap-3 items-end">
                  <div className="flex-grow w-full md:w-auto space-y-1">
                    <label className="text-[10px] font-bold text-gray-500 dark:text-slate-400 block uppercase">Product Name</label>
                    <input
                      type="text"
                      placeholder="e.g. Dairy Milk Chocolate"
                      value={customItemName}
                      onChange={e => setCustomItemName(e.target.value)}
                      className="w-full text-xs px-2.5 py-1.5 border border-gray-300 dark:border-slate-800 rounded-lg bg-white dark:bg-slate-950 text-gray-900 dark:text-white"
                    />
                  </div>
                  
                  <div className="w-full md:w-[130px] space-y-1">
                    <label className="text-[10px] font-bold text-gray-500 dark:text-slate-400 block uppercase">Price Amount (₹)</label>
                    <input
                      type="number"
                      placeholder="e.g. 50"
                      value={customItemPrice}
                      onChange={e => setCustomItemPrice(e.target.value)}
                      className="w-full text-xs px-2.5 py-1.5 border border-gray-300 dark:border-slate-800 rounded-lg bg-white dark:bg-slate-950 text-gray-900 dark:text-white"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={handleAddCustomItemToEdit}
                    className="w-full md:w-auto px-4 py-1.5 bg-gray-900 hover:bg-black dark:bg-slate-800 dark:hover:bg-slate-700 text-white text-xs font-bold rounded-lg transition shrink-0 h-[32px] flex items-center justify-center uppercase tracking-wide cursor-pointer"
                  >
                    + Add Product
                  </button>
                </div>
              </div>

            </div>

            {/* Footer containing Total and Actions */}
            <div className="border-t border-[#D9D9E0] dark:border-slate-800 pt-4 mt-4 space-y-4 shrink-0">
              <div className="flex justify-between items-center bg-yellow-50/55 dark:bg-amber-950/15 p-3.5 rounded-xl border border-yellow-200 dark:border-amber-900/40">
                <div>
                  <span className="text-[10px] block font-black text-red-700 dark:text-red-400 uppercase leading-none">Live Updated Bill Total</span>
                  <span className="text-[11px] text-gray-500 dark:text-slate-400">Includes all manual changes</span>
                </div>
                <span className="text-xl font-black text-red-800 dark:text-red-400 font-mono">
                  ₹{editingOrder.totalAmount.toFixed(2)}
                </span>
              </div>

              <div className="flex gap-2.5">
                <button
                  onClick={() => setEditingOrder(null)}
                  className="w-1/3 py-2.5 bg-gray-100 hover:bg-gray-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-gray-700 dark:text-slate-350 font-bold text-xs rounded-xl transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveEditedOrder}
                  className="flex-grow py-2.5 bg-red-700 hover:bg-red-800 text-white font-extrabold text-xs uppercase tracking-wider rounded-xl shadow-sm hover:shadow transition cursor-pointer"
                >
                  Save & Update Ticket Bill (₹{editingOrder.totalAmount.toFixed(2)})
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* COMBINED BILLING TRANS-MODAL */}
      {selectedTableForBilling !== null && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-[#D9D9E0] flex flex-col max-h-[85vh] animate-slideUp">
            
            <div className="flex justify-between items-center pb-3 border-b border-gray-200 mb-4">
              <div>
                <span className="text-[10px] font-black tracking-widest text-red-700 block text-red-750">INVOICE GATEWAY</span>
                <h3 className="font-extrabold text-[#111827] text-md font-serif">Table {selectedTableForBilling} Transactions</h3>
              </div>
              <button 
                onClick={() => setSelectedTableForBilling(null)}
                className="bg-gray-100 text-gray-400 hover:text-gray-900 rounded-full p-1.5 cursor-pointer hover:bg-gray-200 transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="overflow-y-auto flex-grow space-y-4 pr-1">
              {tableActiveOrders.length > 0 ? (
                tableActiveOrders.map((ord, idx) => (
                  <div key={ord.id} className="bg-[#FFFDF9] rounded-xl p-4 border border-[#D9D9E0] relative">
                    <div className="flex justify-between items-center pb-2 mb-2 border-b border-gray-200/50">
                      <span className="text-[10px] font-bold text-red-700 bg-red-50 border border-red-200 px-2 py-0.5 rounded">
                        Ticket {idx + 1}
                      </span>
                      <div className="flex items-center space-x-2">
                        <span className="text-[9px] text-gray-400 font-mono">#{ord.id}</span>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedTableForBilling(null);
                            deleteOrder(ord.id);
                          }}
                          className="text-red-750 hover:text-red-900 p-1 bg-white hover:bg-red-50 border border-red-150 rounded transition"
                          title="Delete specific order"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="space-y-1">
                      {ord.items.map(it => (
                        <div key={it.id} className="flex justify-between text-xs text-gray-800">
                          <span>{it.quantity}x {it.name}</span>
                          <span className="font-mono text-gray-500">₹{(it.price * it.quantity).toFixed(2)}</span>
                        </div>
                      ))}
                    </div>

                    <div className="flex justify-between items-baseline mt-3 pt-2 border-t border-gray-200/50">
                      <span className="text-[10px] uppercase font-bold text-gray-400">Status: {ord.status.toUpperCase()}</span>
                      <span className="text-xs font-bold text-gray-900">Total: ₹{ord.totalAmount.toFixed(2)}</span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-12 text-xs text-gray-400 font-medium">
                  No active orders recorded for Table {selectedTableForBilling} currently.
                </div>
              )}
            </div>

            {tableActiveOrders.length > 0 && (
              <div className="border-t border-[#D9D9E0] pt-4 mt-4 space-y-4">
                <div className="flex justify-between items-center bg-yellow-50/50 p-3 rounded-lg border border-yellow-200">
                  <div>
                    <span className="text-[10px] block font-extrabold text-red-750 uppercase leading-none text-red-700">Combined Table Bill</span>
                    <span className="text-[11px] text-gray-500">All Live Cooking & Served Batches</span>
                  </div>
                  <span className="text-lg font-black text-red-800 font-mono">₹{tableGrandTotal.toFixed(2)}</span>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => setSelectedTableForBilling(null)}
                    className="w-1/3 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs rounded-xl transition cursor-pointer"
                  >
                    Keep Open
                  </button>
                  <button
                    onClick={handleSettleTableInvoice}
                    className="flex-grow py-2.5 bg-red-700 hover:bg-red-800 text-white font-extrabold text-xs uppercase tracking-wider rounded-xl shadow-sm hover:shadow transition cursor-pointer font-sans"
                  >
                    Close & Clear Paid Table Orders (₹{tableGrandTotal.toFixed(2)})
                  </button>
                </div>
              </div>
            )}

          </div>
        </div>
      )}

      {/* SLIDING SIDEBAR DRAWER (SIGN OUT, SETTINGS & NAVIGATION) */}
      {isSidebarOpen && (
        <>
          {/* Backdrop overlay */}
          <div 
            className="fixed inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-xs z-[400] animate-fadeIn"
            onClick={() => setIsSidebarOpen(false)}
          />
          {/* Sidebar Drawer Panel */}
          <div 
            className="fixed top-0 right-0 h-full w-full max-w-sm bg-white dark:bg-slate-900 shadow-2xl z-[500] flex flex-col animate-slideLeft border-l border-[#D9D9E0] dark:border-slate-800 overflow-hidden"
          >
            {/* Drawer Header */}
            <div className="p-5 border-b border-[#D9D9E0] dark:border-slate-800 flex items-center justify-between bg-white dark:bg-slate-900 shrink-0">
              <div className="flex items-center space-x-2">
                <Menu className="h-5 w-5 text-red-700" />
                <div>
                  <h2 className="text-xs font-black text-gray-900 dark:text-white uppercase tracking-wider font-serif">Options Menu</h2>
                  <p className="text-[9px] text-gray-400 font-bold uppercase tracking-widest font-mono">Quick Options</p>
                </div>
              </div>
              <button 
                type="button"
                onClick={() => setIsSidebarOpen(false)}
                className="p-1 px-2.5 rounded-lg text-gray-400 hover:text-gray-950 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-slate-800 transition cursor-pointer font-bold duration-155 text-xs flex items-center gap-1 border border-transparent hover:border-gray-200 dark:hover:border-slate-700"
              >
                <X className="h-4 w-4" />
                Close
              </button>
            </div>

            {/* Drawer Scrollable Content */}
            <div className="flex-grow flex flex-col justify-between p-6 bg-[#FFFDF9] dark:bg-slate-950 h-full overflow-y-auto">
              
              {/* Stack containing the Navigation Buttons which handles Table QR Registers and Settings */}
              <div className="space-y-4">
                <span className="text-[10px] font-black text-gray-450 dark:text-gray-500 uppercase tracking-widest block mb-2 font-mono">My Pages</span>
                
                {/* 1. TABLE QR REGISTER SECTION PAGE LINK */}
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('tables');
                    setIsSidebarOpen(false);
                  }}
                  className="w-full flex items-center justify-between p-4 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 hover:border-red-300 dark:hover:border-slate-700 hover:bg-red-50/10 dark:hover:bg-slate-800 rounded-xl transition cursor-pointer group shadow-3xs"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-lg bg-red-550/10 dark:bg-red-950/20 text-red-700 dark:text-red-400">
                      <QrCode className="h-4.5 w-4.5" />
                    </div>
                    <div className="text-left">
                      <span className="text-xs font-black text-gray-900 dark:text-gray-150 block uppercase tracking-wide">Table QR Codes</span>
                      <span className="text-[9px] text-gray-400 block tracking-normal font-medium capitalize">Create table stickers for customers</span>
                    </div>
                  </div>
                  <span className="text-gray-300 dark:text-gray-600 group-hover:text-red-700 dark:group-hover:text-red-400 transition-colors">→</span>
                </button>

                {/* 2. SETTINGS PAGE LINK */}
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('settings');
                    setIsSidebarOpen(false);
                  }}
                  className="w-full flex items-center justify-between p-4 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 hover:border-red-300 dark:hover:border-slate-700 hover:bg-red-50/10 dark:hover:bg-slate-800 rounded-xl transition cursor-pointer group shadow-3xs"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-lg bg-red-550/10 dark:bg-red-950/20 text-red-700 dark:text-red-400">
                      <Settings className="h-4.5 w-4.5" />
                    </div>
                    <div className="text-left">
                      <span className="text-xs font-black text-gray-900 dark:text-gray-150 block uppercase tracking-wide">Display & Sounds</span>
                      <span className="text-[9px] text-gray-400 block tracking-normal font-medium capitalize">Sound options and page colors</span>
                    </div>
                  </div>
                  <span className="text-gray-300 dark:text-gray-600 group-hover:text-red-700 dark:group-hover:text-red-400 transition-colors">→</span>
                </button>
              </div>

              {/* 3. SESSION / LOGOUT CONTAINER (STATIONARY AT THE BOTTOM OF SIDEBAR) */}
              <div className="mt-8 pt-6 border-t border-gray-150 dark:border-slate-800/80">
                <button 
                  onClick={() => {
                    openConfirm(
                      "Sign Out Session?",
                      "Are you sure you want to log out of the admin console?",
                      () => {
                        setIsSidebarOpen(false);
                        onLogout();
                      },
                      "Yes, Logout",
                      "Cancel"
                    );
                  }}
                  className="w-full py-3 px-3.5 bg-red-100 dark:bg-red-950/20 hover:bg-red-200 dark:hover:bg-red-950/40 border border-red-200 dark:border-red-900/40 text-red-700 dark:text-red-400 font-extrabold text-xs uppercase tracking-wider rounded-xl transition cursor-pointer flex items-center justify-center gap-2 shadow-3xs"
                >
                  <LogOut className="h-4 w-4" />
                  Logout
                </button>
              </div>

            </div>
          </div>
        </>
      )}

      {/* CUSTOM CONFIRM DIALOG OVERLAY (Iframe Sandbox compliant) */}
      {confirmModal.isOpen && (
        <div id="custom-confirm-modal-overlay" className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-[9999] animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-red-50 flex flex-col items-center text-center">
            {/* Warning graphic */}
            <div className="h-12 w-12 rounded-full bg-red-50 border border-red-200 flex items-center justify-center text-red-700 mb-4 animate-bounce">
              <HelpCircle className="h-6 w-6" />
            </div>
            
            <h3 className="font-extrabold text-gray-950 font-serif text-md mb-2">{confirmModal.title}</h3>
            <p className="text-xs text-gray-500 mb-6 leading-relaxed px-1">{confirmModal.message}</p>
            
            <div className="flex space-x-2.5 w-full">
              <button
                type="button"
                onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
                className="w-1/2 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-650 text-xs font-bold rounded-xl transition cursor-pointer"
              >
                {confirmModal.cancelText}
              </button>
              <button
                type="button"
                onClick={confirmModal.onConfirm}
                className="w-1/2 py-2.5 bg-red-700 hover:bg-red-800 text-white text-xs font-bold rounded-xl transition cursor-pointer"
              >
                {confirmModal.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CUSTOM ALERT DIALOG OVERLAY */}
      {alertModal.isOpen && (
        <div id="custom-alert-modal-overlay" className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-[9999] animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-yellow-104 flex flex-col items-center text-center">
            <div className="h-11 w-11 rounded-full bg-yellow-50 border border-yellow-250 flex items-center justify-center text-yellow-600 mb-4 text-base font-black">
              !
            </div>
            <h3 className="font-extrabold text-gray-950 font-serif text-md mb-2">{alertModal.title}</h3>
            <p className="text-xs text-gray-500 mb-6 leading-relaxed px-1">{alertModal.message}</p>
            <button
              onClick={() => setAlertModal(prev => ({ ...prev, isOpen: false }))}
              className="w-full py-2.5 bg-red-700 hover:bg-red-800 text-white text-xs font-bold rounded-xl transition cursor-pointer"
            >
              Okay, Understood
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
