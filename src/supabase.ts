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

type StoreTable = 'menu_items' | 'tables' | 'orders';
type LocalStore = Record<StoreTable, any[]>;

const LOCAL_STORE_KEY = 'gd_restaurant_local_store_v1';

class RemoteSupabaseClient {
  private createEmptyStore(): LocalStore {
    return { menu_items: [], tables: [], orders: [] };
  }

  private getLocalStore(): LocalStore {
    if (typeof window === 'undefined') {
      return this.createEmptyStore();
    }

    try {
      const parsed = JSON.parse(window.localStorage.getItem(LOCAL_STORE_KEY) || '{}');
      return {
        menu_items: Array.isArray(parsed.menu_items) ? parsed.menu_items : [],
        tables: Array.isArray(parsed.tables) ? parsed.tables : [],
        orders: Array.isArray(parsed.orders) ? parsed.orders : [],
      };
    } catch {
      return this.createEmptyStore();
    }
  }

  private setLocalStore(store: LocalStore) {
    if (typeof window === 'undefined') {
      return;
    }

    window.localStorage.setItem(LOCAL_STORE_KEY, JSON.stringify(store));
  }

  private handleLocalRequest(path: string, init: RequestInit = {}) {
    const match = path.match(/^\/api\/collections\/([^?]+)/);
    const table = match?.[1] as StoreTable | undefined;
    if (!table || !['menu_items', 'tables', 'orders'].includes(table)) {
      throw new Error(`Local fallback cannot handle request: ${path}`);
    }

    const store = this.getLocalStore();
    const method = (init.method || 'GET').toUpperCase();
    const url = new URL(path, 'http://local-fallback');
    const pkField = table === 'tables' ? 'table_number' : 'id';

    if (method === 'GET') {
      let rows = [...store[table]];
      const orderBy = url.searchParams.get('orderBy');
      const ascending = url.searchParams.get('ascending') !== 'false';
      if (orderBy) {
        rows = rows.sort((a, b) => {
          const left = a?.[orderBy];
          const right = b?.[orderBy];
          if (left < right) return ascending ? -1 : 1;
          if (left > right) return ascending ? 1 : -1;
          return 0;
        });
      }
      return rows;
    }

    const body = typeof init.body === 'string' ? JSON.parse(init.body || '{}') : init.body;

    if (method === 'POST') {
      const incoming = Array.isArray(body) ? body : [body];
      const filtered = incoming.filter((item: any) => !store[table].some((current: any) => current[pkField] === item[pkField]));
      store[table] = [...store[table], ...filtered];
      this.setLocalStore(store);
      return filtered;
    }

    if (method === 'PUT') {
      const incoming = Array.isArray(body) ? body : [body];
      const rows = [...store[table]];
      incoming.forEach((item: any) => {
        const index = rows.findIndex((entry: any) => entry[pkField] === item[pkField]);
        if (index >= 0) {
          rows[index] = { ...rows[index], ...item };
        } else {
          rows.push(item);
        }
      });
      store[table] = rows;
      this.setLocalStore(store);
      return incoming;
    }

    if (method === 'DELETE') {
      const { field = pkField, values = [] } = body || {};
      store[table] = store[table].filter((item: any) => !values.includes(item[field]));
      this.setLocalStore(store);
      return { success: true };
    }

    throw new Error(`Unsupported local fallback method: ${method}`);
  }

  private getBaseUrlCandidates() {
    const configured = (import.meta as any).env.VITE_API_BASE_URL || '';
    const candidates = new Set<string>();

    if (configured) {
      candidates.add(configured.replace(/\/$/, ''));
    }

    if (typeof window !== 'undefined' && window.location?.origin) {
      candidates.add(window.location.origin);
    }

    if (typeof window !== 'undefined' && window.location?.hostname) {
      const host = window.location.hostname;
      candidates.add(`http://${host}:3000`);
      candidates.add(`http://${host}:3102`);
      candidates.add(`http://127.0.0.1:3000`);
      candidates.add(`http://127.0.0.1:3102`);
      candidates.add(`http://localhost:3000`);
      candidates.add(`http://localhost:3102`);
    }

    return Array.from(candidates).filter(Boolean);
  }

  private async request(path: string, init: RequestInit = {}) {
    const candidateBases = this.getBaseUrlCandidates();
    const errors: string[] = [];

    for (const baseUrl of candidateBases) {
      try {
        const response = await fetch(`${baseUrl}${path}`, {
          headers: {
            'Content-Type': 'application/json',
            ...(init.headers || {}),
          },
          ...init,
        });

        if (response.ok) {
          if (response.status === 204) {
            return null;
          }
          return response.json();
        }

        const text = await response.text();
        errors.push(`${baseUrl}${path}: ${text || response.statusText}`);
      } catch (error) {
        errors.push(`${baseUrl}${path}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    try {
      return this.handleLocalRequest(path, init);
    } catch (fallbackError) {
      errors.push(fallbackError instanceof Error ? fallbackError.message : String(fallbackError));
      throw new Error(errors.join(' | '));
    }
  }

  from(table: string) {
    const builder = {
      select: (_columns?: string) => {
        const buildQueryBuilder = (path: string) => {
          const promise = this.request(path)
            .then((data: any) => ({ data, error: null }))
            .catch((error: Error) => ({ data: null, error }));

          const queryBuilder = {
            order: (column: string, { ascending }: { ascending?: boolean } = {}) => {
              const normalizedAscending = ascending !== false;
              const orderPath = `${path}${path.includes('?') ? '&' : '?'}orderBy=${encodeURIComponent(column)}&ascending=${normalizedAscending}`;
              return buildQueryBuilder(orderPath);
            },
            then: promise.then.bind(promise),
            catch: promise.catch.bind(promise),
            finally: promise.finally.bind(promise),
          };

          return queryBuilder as any;
        };

        return buildQueryBuilder(`/api/collections/${table}`);
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
    let retryTimer: number | undefined;

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

        const baseUrls = this.getBaseUrlCandidates();
        let baseIndex = 0;

        const handleIncomingEvent = (event: MessageEvent | Event) => {
          try {
            const payload = JSON.parse((event as MessageEvent).data);
            notifyListeners(payload);
          } catch {
            // ignore malformed payloads
          }
        };

        const connect = () => {
          if (isClosed || eventSource || baseIndex >= baseUrls.length) {
            return;
          }

          eventSource = new EventSource(`${baseUrls[baseIndex]}/api/stream?channel=${encodeURIComponent(name)}`);
          eventSource.addEventListener('update', handleIncomingEvent as EventListener);
          eventSource.addEventListener('message', handleIncomingEvent as EventListener);
          eventSource.onerror = () => {
            eventSource?.close();
            eventSource = null;
            baseIndex += 1;

            if (!isClosed && baseIndex < baseUrls.length) {
              retryTimer = window.setTimeout(connect, 250);
            }
          };
        };

        connect();

        return {
          unsubscribe: () => {
            isClosed = true;
            if (retryTimer !== undefined) {
              window.clearTimeout(retryTimer);
            }
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
