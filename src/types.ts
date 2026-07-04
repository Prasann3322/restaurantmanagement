export interface MenuItem {
  id: string;
  name: string;
  price: number;
  category: string;
  description: string;
  image: string; // Initials or short code representing the dish
  imageUrl?: string;
  halfPrice?: number;
  fullPrice?: number;
  isSinglePortion?: boolean;
}

export interface Table {
  id: string;
  number: number;
  status: 'ordered' | 'serving' | 'ready';
}

export type OrderStatus = 'pending' | 'preparing' | 'served' | 'completed';

export interface OrderItem {
  id: string; // unique cart item id
  menuItemId: string;
  name: string;
  price: number;
  quantity: number;
  notes: string;
  portion?: 'half' | 'full';
}

export interface Order {
  id: string;
  tableNumber: number;
  items: OrderItem[];
  totalAmount: number;
  status: OrderStatus;
  createdAt: string; // Timestamp ISO-8601
  isParcel?: boolean;
  customerName?: string;
}

export type AppView = 'admin-login' | 'admin-dashboard' | 'customer';

// Secure Table Code Obfuscation to prevent direct URL access / tampering
export function encodeTableNumber(num: number): string {
  const masked = num * 1993 + 12345;
  return masked.toString(36).toUpperCase();
}

export function decodeTableNumber(code: string): number | null {
  if (!code) return null;
  try {
    const cleaned = code.trim().toUpperCase();
    
    // 1. Try to decode as our masked format first
    const parsed = parseInt(cleaned, 36);
    if (!isNaN(parsed)) {
      const remainder = (parsed - 12345) % 1993;
      if (remainder === 0) {
        const num = (parsed - 12345) / 1993;
        if (num > 0 && num <= 1000) return num;
      }
    }
    
    // 2. Fallback to plain positive integer to ensure compatibility for QR code scans
    if (/^\d+$/.test(cleaned)) {
      const num = parseInt(cleaned, 10);
      if (num > 0 && num <= 1000) return num;
    }
    
    return null;
  } catch {
    return null;
  }
}
