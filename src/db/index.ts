import Dexie, { type Table } from 'dexie';

export interface LicenseRecord {
  id?: number;
  licenseKey: string;
  deviceName: string;
  branchCode?: string;
  token: string;
  companyName: string;
  branchName?: string;
  activatedAt: string;
}

export interface UserSession {
  id?: number;
  userId: number;
  username: string;
  name: string;
  role: string;
  permissions: string[];
  token: string;
  passwordHash: string;
  lastLogin: string;
}

export interface Setting {
  key: string;
  value: string;
}

export interface Item {
  id: number;
  name: string;
  code: string;
  barcode?: string;
  price: number;
  category?: string;
  unit?: string;
  taxRate?: number;
  dynamicFields?: Record<string, unknown>;
  updatedAt: string;
}

export interface Stock {
  itemId: number;
  quantity: number;
  updatedAt: string;
}

export interface Customer {
  id: number;
  name: string;
  phone?: string;
  email?: string;
  address?: string;
}

export interface ProductSchema {
  id?: number;
  mode: string; // roll | kg | pieces
  fields: Array<{
    name: string;
    label: string;
    type: string;
    options?: string[];
    required?: boolean;
  }>;
}

export interface CartItem {
  id: string;
  itemId: number;
  name: string;
  code: string;
  price: number;
  quantity: number;
  discount: number;
  dynamicFields?: Record<string, unknown>;
  total: number;
}

export interface Sale {
  id?: number;
  localId: string;
  items: CartItem[];
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  payments: Array<{ method: string; amount: number }>;
  customerId?: number;
  customerName?: string;
  userId: number;
  userName: string;
  createdAt: string;
  syncStatus: 'pending' | 'synced' | 'failed';
  syncAttempts: number;
  serverId?: number;
}

class POSDatabase extends Dexie {
  license!: Table<LicenseRecord>;
  sessions!: Table<UserSession>;
  settings!: Table<Setting>;
  items!: Table<Item>;
  stocks!: Table<Stock>;
  customers!: Table<Customer>;
  productSchema!: Table<ProductSchema>;
  sales!: Table<Sale>;

  constructor() {
    super('pos-terminal');
    this.version(1).stores({
      license: '++id',
      sessions: '++id, userId, username',
      settings: 'key',
      items: 'id, name, code, barcode, category',
      stocks: 'itemId',
      customers: 'id, name, phone',
      productSchema: '++id',
      sales: '++id, localId, syncStatus, createdAt',
    });
  }
}

export const db = new POSDatabase();
