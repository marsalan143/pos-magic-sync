import { useEffect, useRef, useCallback } from 'react';
import { db } from '@/db';
import api from '@/lib/api';
import { useOnlineStatus } from './useOnlineStatus';

export function useSync() {
  const isOnline = useOnlineStatus();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const syncingRef = useRef(false);

  const syncNow = useCallback(async () => {
    if (syncingRef.current || !navigator.onLine) return;
    syncingRef.current = true;

    try {
      const pendingSales = await db.sales
        .where('syncStatus')
        .anyOf(['pending', 'failed'])
        .toArray();

      if (pendingSales.length === 0) {
        syncingRef.current = false;
        return;
      }

      const response = await api.post('/api/sync', {
        sales: pendingSales.map(s => ({
          localId: s.localId,
          items: s.items,
          subtotal: s.subtotal,
          discount: s.discount,
          tax: s.tax,
          total: s.total,
          payments: s.payments,
          customerId: s.customerId,
          userId: s.userId,
          createdAt: s.createdAt,
        })),
      });

      const { synced, updatedStock } = response.data;

      // Mark synced sales
      if (synced && Array.isArray(synced)) {
        for (const s of synced) {
          const sale = await db.sales.where('localId').equals(s.localId).first();
          if (sale?.id) {
            await db.sales.update(sale.id, {
              syncStatus: 'synced',
              serverId: s.serverId,
            });
          }
        }
      }

      // Update local stock
      if (updatedStock && Array.isArray(updatedStock)) {
        for (const stock of updatedStock) {
          await db.stocks.put({
            itemId: stock.itemId,
            quantity: stock.quantity,
            updatedAt: new Date().toISOString(),
          });
        }
      }
    } catch (err) {
      // Mark failed sales with incremented attempts
      const pendingSales = await db.sales
        .where('syncStatus')
        .equals('pending')
        .toArray();
      for (const sale of pendingSales) {
        if (sale.id) {
          await db.sales.update(sale.id, {
            syncStatus: 'failed',
            syncAttempts: (sale.syncAttempts || 0) + 1,
          });
        }
      }
    } finally {
      syncingRef.current = false;
    }
  }, []);

  useEffect(() => {
    if (isOnline) {
      syncNow();
      intervalRef.current = setInterval(syncNow, 20000);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isOnline, syncNow]);

  return { syncNow, isOnline };
}
