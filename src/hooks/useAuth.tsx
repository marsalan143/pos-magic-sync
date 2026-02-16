import React, { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { db } from '@/db';
import api from '@/lib/api';

interface AuthState {
  isLicensed: boolean;
  isLoggedIn: boolean;
  isLoading: boolean;
  userName: string;
  userId: number;
  userRole: string;
  permissions: string[];
  companyName: string;
}

interface AuthContextType extends AuthState {
  activateLicense: (key: string, deviceName: string, branchCode?: string) => Promise<void>;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  hasPermission: (perm: string) => boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    isLicensed: false,
    isLoggedIn: false,
    isLoading: true,
    userName: '',
    userId: 0,
    userRole: '',
    permissions: [],
    companyName: '',
  });

  // Check existing license and session on mount
  useEffect(() => {
    (async () => {
      const license = await db.license.toCollection().first();
      const session = await db.sessions.toCollection().last();
      setState(prev => ({
        ...prev,
        isLicensed: !!license,
        isLoggedIn: !!session,
        companyName: license?.companyName || '',
        userName: session?.name || '',
        userId: session?.userId || 0,
        userRole: session?.role || '',
        permissions: session?.permissions || [],
        isLoading: false,
      }));
    })();
  }, []);

  const activateLicense = useCallback(async (key: string, deviceName: string, branchCode?: string) => {
    const res = await api.post('/api/license/activate', {
      license_key: key,
      device_name: deviceName,
      branch_code: branchCode,
    });

    const { token, company, branch, api_url } = res.data;

    await db.license.clear();
    await db.license.add({
      licenseKey: key,
      deviceName,
      branchCode,
      token,
      companyName: company?.name || 'My Business',
      branchName: branch?.name,
      activatedAt: new Date().toISOString(),
    });

    if (api_url) {
      await db.settings.put({ key: 'api_base_url', value: api_url });
      api.defaults.baseURL = api_url;
    }

    setState(prev => ({
      ...prev,
      isLicensed: true,
      companyName: company?.name || 'My Business',
    }));
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    let userData: any;

    if (navigator.onLine) {
      const res = await api.post('/api/login', { username, password });
      userData = res.data;

      // Store for offline login
      await db.sessions.clear();
      await db.sessions.add({
        userId: userData.user.id,
        username,
        name: userData.user.name,
        role: userData.user.role,
        permissions: userData.user.permissions || [],
        token: userData.token,
        passwordHash: btoa(password), // Simple encoding for offline - server handles real auth
        lastLogin: new Date().toISOString(),
      });

      // Bootstrap data
      try {
        const bootstrap = await api.get('/api/bootstrap');
        const data = bootstrap.data;
        if (data.items) {
          await db.items.clear();
          await db.items.bulkAdd(data.items);
        }
        if (data.stocks) {
          await db.stocks.clear();
          await db.stocks.bulkAdd(data.stocks);
        }
        if (data.customers) {
          await db.customers.clear();
          await db.customers.bulkAdd(data.customers);
        }
        if (data.settings) {
          for (const [k, v] of Object.entries(data.settings)) {
            await db.settings.put({ key: k, value: String(v) });
          }
        }
        if (data.product_schema) {
          await db.productSchema.clear();
          await db.productSchema.add(data.product_schema);
        }
      } catch {
        // Bootstrap failed but login succeeded - can work with existing data
      }
    } else {
      // Offline login
      const session = await db.sessions.where('username').equals(username).first();
      if (!session || atob(session.passwordHash) !== password) {
        throw new Error('Invalid offline credentials');
      }
      userData = {
        user: {
          id: session.userId,
          name: session.name,
          role: session.role,
          permissions: session.permissions,
        },
        token: session.token,
      };
    }

    setState(prev => ({
      ...prev,
      isLoggedIn: true,
      userName: userData.user.name,
      userId: userData.user.id,
      userRole: userData.user.role,
      permissions: userData.user.permissions || [],
    }));
  }, []);

  const logout = useCallback(() => {
    setState(prev => ({
      ...prev,
      isLoggedIn: false,
      userName: '',
      userId: 0,
      userRole: '',
      permissions: [],
    }));
  }, []);

  const hasPermission = useCallback((perm: string) => {
    return state.permissions.includes(perm) || state.userRole === 'admin';
  }, [state.permissions, state.userRole]);

  return (
    <AuthContext.Provider value={{ ...state, activateLicense, login, logout, hasPermission }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
