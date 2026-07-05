import { createClient } from '@supabase/supabase-js';
import { MenuItem, Table, Order } from './types';

const supabaseUrl = (import.meta as any).env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = (import.meta as any).env.VITE_SUPABASE_ANON_KEY || '';

const isUrlValid = (url: string) => {
  return typeof url === 'string' && (url.startsWith('http://') || url.startsWith('https://'));
};

export const isSupabaseConfigured = !!(supabaseUrl && supabaseAnonKey && isUrlValid(supabaseUrl));

interface RealtimePayload {
  eventType: 'INSERT' | 'UPDATE' | 'DELETE' | 'UPSERT' | '*';
  table: string;
  new?: any;
  old?: any;
  commit_timestamp: string;
}

class RemoteSupabaseClient {
  private getBaseUrl() {
    const configured = (import.meta as any).env.VITE_API_BASE_URL || '';
    return configured.replace(/\/$/, '');
  }

  private async request(path: string, init: RequestInit = {}) {
    const response = await fetch(`${this.getBaseUrl()}${path}`, {
      headers: {
        'Content-Type': 'application/json',
        ...(init.headers || {}),
      },
      ...init,
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(text || 'Request failed');
    }

    if (response.status === 204) {
      return null;
    }

    return response.json();
  }

  from(table: string) {
    const builder = {
      select: (_columns?: string) => {
        const queryBuilder = {
          order: async (column: string, { ascending }: { ascending: boolean } = { ascending: true }) => {
            const data = await this.request(`/api/collections/${table}?orderBy=${encodeURIComponent(column)}&ascending=${ascending}`);
            return { data, error: null };
          },
          then: async (resolve: (value: { data: any; error: null }) => void) => {
            const data = await this.request(`/api/collections/${table}`);
            resolve({ data, error: null });
          },
        };
        return queryBuilder as any;
      },
      insert: async (newData: any | any[]) => {
        const data = await this.request(`/api/collections/${table}`, {
          method: 'POST',
          body: JSON.stringify(newData),
        });
        return { data, error: null };
      },
      upsert: async (upsertData: any | any[]) => {
        const data = await this.request(`/api/collections/${table}`, {
          method: 'PUT',
          body: JSON.stringify(upsertData),
        });
        return { data, error: null };
      },
      delete: () => ({
        in: async (field: string, values: any[]) => {
          await this.request(`/api/collections/${table}`, {
            method: 'DELETE',
            body: JSON.stringify({ field, values }),
          });
          return { data: null, error: null };
        },
      }),
    };

    return builder as any;
  }

  channel(name: string) {
    const listeners: Array<{ callback: (payload: RealtimePayload) => void; table: string; eventType: string }> = [];
    let eventSource: EventSource | null = null;
    let isClosed = false;

    const notifyListeners = (payload: RealtimePayload) => {
      listeners.forEach((listener) => {
        if (listener.table && listener.table !== payload.table) {
          return;
        }

        const matchesEvent = listener.eventType === '*' || listener.eventType === payload.eventType || listener.eventType === 'postgres_changes';
        if (!matchesEvent) {
          return;
        }

        listener.callback(payload);
      });
    };

    const channel = {
      on: (event: string, filter: any, callback: (payload: RealtimePayload) => void) => {
        listeners.push({
          callback,
          table: filter?.table || '',
          eventType: filter?.event || '*',
        });
        return channel;
      },
      subscribe: () => {
        if (eventSource || isClosed) {
          return { unsubscribe: () => {} };
        }

        eventSource = new EventSource(`${this.getBaseUrl()}/api/stream?channel=${encodeURIComponent(name)}`);
        const handleIncomingEvent = (event: MessageEvent | Event) => {
          try {
            const payload = JSON.parse((event as MessageEvent).data);
            notifyListeners(payload);
          } catch {
            // ignore malformed payloads
          }
        };

        eventSource.addEventListener('update', handleIncomingEvent as EventListener);
        eventSource.addEventListener('message', handleIncomingEvent as EventListener);
        eventSource.onerror = () => {
          if (eventSource?.readyState === EventSource.CLOSED) {
            eventSource?.close();
            eventSource = null;
          }
        };

        return {
          unsubscribe: () => {
            isClosed = true;
            eventSource?.close();
            eventSource = null;
          },
        };
      },
    } as any;

    return channel;
  }

  removeChannel(channel: any) {
    channel?.unsubscribe?.();
  }
}

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : new RemoteSupabaseClient() as any;

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
