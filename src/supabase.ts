import { createClient } from '@supabase/supabase-js';
import { MenuItem, Table, Order } from './types';

const supabaseUrl = (import.meta as any).env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = (import.meta as any).env.VITE_SUPABASE_ANON_KEY || '';

const isUrlValid = (url: string) => {
  return typeof url === 'string' && (url.startsWith('http://') || url.startsWith('https://'));
};

export const isSupabaseConfigured = !!(supabaseUrl && supabaseAnonKey && isUrlValid(supabaseUrl));

// Define Mock Supabase Client to handle local preview gracefully without crashing when credentials are unset
class MockSupabaseClient {
  private getStorage(table: string): any[] {
    const raw = localStorage.getItem(`mock_sb_${table}`);
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const pkField = table === 'tables' ? 'table_number' : 'id';
        const seen = new Set();
        const deduped = parsed.filter(item => {
          if (!item) return false;
          const key = item[pkField];
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
        if (deduped.length !== parsed.length) {
          localStorage.setItem(`mock_sb_${table}`, JSON.stringify(deduped));
        }
        return deduped;
      }
    } catch (e) {
      console.error(e);
    }
    return [];
  }

  private setStorage(table: string, data: any[]) {
    localStorage.setItem(`mock_sb_${table}`, JSON.stringify(data));
  }

  from(table: string) {
    const self = this;
    let data = this.getStorage(table);

    const builder = {
      select: (columns?: string) => {
        const queryBuilder = {
          order: (column: string, { ascending }: { ascending: boolean } = { ascending: true }) => {
            const sorted = [...data].sort((a, b) => {
              const valA = a[column];
              const valB = b[column];
              if (valA < valB) return ascending ? -1 : 1;
              if (valA > valB) return ascending ? 1 : -1;
              return 0;
            });
            return Promise.resolve({ data: sorted, error: null });
          },
          then: (resolve: any) => resolve({ data, error: null }),
        };
        return queryBuilder as any;
      },
      insert: (newData: any | any[]) => {
        const toAdd = Array.isArray(newData) ? newData : [newData];
        const pkField = table === 'tables' ? 'table_number' : 'id';
        const filteredToAdd = toAdd.filter(item => !data.some(existing => existing[pkField] === item[pkField]));
        data = [...data, ...filteredToAdd];
        self.setStorage(table, data);
        return Promise.resolve({ data: filteredToAdd, error: null });
      },
      upsert: (upsertData: any | any[]) => {
        const toUpsert = Array.isArray(upsertData) ? upsertData : [upsertData];
        const current = [...data];
        toUpsert.forEach(item => {
          // Identify key fields: table_number for tables, id for orders and menu_items
          const pkField = table === 'tables' ? 'table_number' : 'id';
          const index = current.findIndex(c => c[pkField] === item[pkField]);
          if (index > -1) {
            current[index] = { ...current[index], ...item };
          } else {
            current.push(item);
          }
        });
        self.setStorage(table, current);
        return Promise.resolve({ data: toUpsert, error: null });
      },
      delete: () => {
        return {
          in: (field: string, values: any[]) => {
            const filtered = data.filter(item => !values.includes(item[field]));
            self.setStorage(table, filtered);
            return Promise.resolve({ data: null, error: null });
          }
        } as any;
      }
    };
    return builder as any;
  }

  channel(name: string) {
    return {
      on: (event: string, filter: any, callback: (payload: any) => void) => {
        // No-op for realtime subscriptions in local mode
        return this.channel(name);
      },
      subscribe: () => {
        return { unsubscribe: () => {} };
      }
    } as any;
  }

  removeChannel(channel: any) {
    // No-op
  }
}

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : new MockSupabaseClient() as any;

// --- TRANSFORMERS ---


// MenuItem mapping
export function mapDbMenuItemToClient(dbItem: any): MenuItem {
  return {
    id: dbItem.id,
    name: dbItem.product_name || '',
    price: Number(dbItem.display_price) || 0,
    category: dbItem.category || '',
    description: '', // description is blank or can default
    image: dbItem.product_name ? dbItem.product_name.substring(0, 2).toUpperCase() : 'FD',
    imageUrl: dbItem.image_url || undefined,
    isSinglePortion: dbItem.isSinglePortion ?? true,
    halfPrice: dbItem.halfPrice !== null && dbItem.halfPrice !== undefined ? Number(dbItem.halfPrice) : undefined,
    fullPrice: dbItem.fullPrice !== null && dbItem.fullPrice !== undefined ? Number(dbItem.fullPrice) : undefined,
  };
}

export function mapClientMenuItemToDb(item: MenuItem): any {
  return {
    id: item.id,
    product_name: item.name,
    display_price: item.price,
    category: item.category,
    image_url: item.imageUrl || null,
    isSinglePortion: item.isSinglePortion ?? true,
    halfPrice: item.halfPrice !== undefined ? item.halfPrice : null,
    fullPrice: item.fullPrice !== undefined ? item.fullPrice : null,
  };
}

// Order mapping (packs custom fields customerName and isParcel securely into the items array JSONB block)
export function mapDbOrderToClient(dbOrder: any): Order {
  const dbItems = dbOrder.items || [];
  const items = dbItems.filter((i: any) => i.id !== '__metadata__');
  const metadata = dbItems.find((i: any) => i.id === '__metadata__');

  return {
    id: dbOrder.id,
    tableNumber: dbOrder.table_number,
    items: items,
    totalAmount: Number(dbOrder.total_amount) || 0,
    status: dbOrder.status || 'pending',
    createdAt: dbOrder.created_at || new Date().toISOString(),
    customerName: metadata ? metadata.name : undefined,
    isParcel: metadata ? metadata.notes === 'true' : undefined,
  };
}

export function mapClientOrderToDb(order: Order): any {
  const dbItems = [...order.items];
  if (order.customerName || order.isParcel) {
    dbItems.push({
      id: '__metadata__',
      menuItemId: '',
      name: order.customerName || '',
      price: 0,
      quantity: 0,
      notes: order.isParcel ? 'true' : 'false'
    } as any);
  }

  return {
    id: order.id,
    table_number: order.tableNumber,
    items: dbItems,
    total_amount: order.totalAmount,
    status: order.status,
    created_at: order.createdAt || new Date().toISOString()
  };
}

// Table mapping
export function mapDbTableToClient(dbTable: any): Table {
  return {
    id: `table-id-${dbTable.table_number}`,
    number: dbTable.table_number,
    status: (dbTable.status as 'ordered' | 'serving' | 'ready') || 'ready',
  };
}

export function mapClientTableToDb(table: Table, currentOrderId?: string): any {
  return {
    table_number: table.number,
    status: table.status,
    current_order_id: currentOrderId || null,
  };
}
