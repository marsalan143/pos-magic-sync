import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type CartItem, type Item } from '@/db';
import { useAuth } from '@/hooks/useAuth';
import { useSync } from '@/hooks/useSync';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { InvoicePrint } from '@/components/pos/InvoicePrint';
import {
  Search, Plus, Minus, Trash2, CreditCard, Banknote,
  Printer, LogOut, WifiOff, ShoppingCart, X, Receipt,
} from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';

function generateId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export default function POS() {
  const { userName, userId, companyName, logout, hasPermission } = useAuth();
  const { isOnline } = useSync();
  const [searchQuery, setSearchQuery] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [showPayment, setShowPayment] = useState(false);
  const [showInvoice, setShowInvoice] = useState(false);
  const [lastSale, setLastSale] = useState<any>(null);
  const [paymentAmounts, setPaymentAmounts] = useState<Record<string, string>>({ cash: '' });
  const [billDiscount, setBillDiscount] = useState(0);
  const searchRef = useRef<HTMLInputElement>(null);

  // Load items from IndexedDB
  const items = useLiveQuery(() => db.items.toArray(), []) || [];
  const pendingCount = useLiveQuery(
    () => db.sales.where('syncStatus').anyOf(['pending', 'failed']).count(),
    []
  ) || 0;

  // Filter items by search
  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return items.slice(0, 50);
    const q = searchQuery.toLowerCase();
    return items.filter(
      i => i.name.toLowerCase().includes(q) ||
        i.code.toLowerCase().includes(q) ||
        i.barcode?.toLowerCase().includes(q)
    ).slice(0, 50);
  }, [items, searchQuery]);

  // Keyboard shortcut: focus search
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'F2') {
        e.preventDefault();
        searchRef.current?.focus();
      }
      if (e.key === 'F9') {
        e.preventDefault();
        if (cart.length > 0) setShowPayment(true);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [cart]);

  const addToCart = useCallback((item: Item) => {
    setCart(prev => {
      const existing = prev.find(c => c.itemId === item.id);
      if (existing) {
        return prev.map(c =>
          c.itemId === item.id
            ? { ...c, quantity: c.quantity + 1, total: (c.quantity + 1) * c.price - c.discount }
            : c
        );
      }
      return [...prev, {
        id: generateId(),
        itemId: item.id,
        name: item.name,
        code: item.code,
        price: item.price,
        quantity: 1,
        discount: 0,
        total: item.price,
      }];
    });
    setSearchQuery('');
    searchRef.current?.focus();
  }, []);

  const updateQuantity = useCallback((id: string, delta: number) => {
    setCart(prev => prev.map(c => {
      if (c.id !== id) return c;
      const qty = Math.max(1, c.quantity + delta);
      return { ...c, quantity: qty, total: qty * c.price - c.discount };
    }));
  }, []);

  const removeFromCart = useCallback((id: string) => {
    setCart(prev => prev.filter(c => c.id !== id));
  }, []);

  const subtotal = cart.reduce((s, c) => s + c.total, 0);
  const tax = 0; // Tax from settings if needed
  const total = subtotal - billDiscount + tax;

  const completeSale = useCallback(async () => {
    const payments = Object.entries(paymentAmounts)
      .filter(([, v]) => parseFloat(v) > 0)
      .map(([method, amount]) => ({ method, amount: parseFloat(amount) }));

    const paidTotal = payments.reduce((s, p) => s + p.amount, 0);
    if (paidTotal < total) return;

    const saleData = {
      localId: generateId(),
      items: cart,
      subtotal,
      discount: billDiscount,
      tax,
      total,
      payments,
      userId,
      userName,
      createdAt: new Date().toISOString(),
      syncStatus: 'pending' as const,
      syncAttempts: 0,
    };

    await db.sales.add(saleData);

    // Update local stock
    for (const item of cart) {
      const stock = await db.stocks.get(item.itemId);
      if (stock) {
        await db.stocks.update(item.itemId, {
          quantity: stock.quantity - item.quantity,
          updatedAt: new Date().toISOString(),
        });
      }
    }

    setLastSale(saleData);
    setCart([]);
    setBillDiscount(0);
    setPaymentAmounts({ cash: '' });
    setShowPayment(false);
    setShowInvoice(true);

    // Auto print
    setTimeout(() => window.print(), 300);
  }, [cart, subtotal, billDiscount, tax, total, paymentAmounts, userId, userName]);

  return (
    <div className="flex h-screen flex-col bg-background no-print">
      {/* Header */}
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-border bg-pos-header px-4">
        <div className="flex items-center gap-3">
          <Receipt className="h-5 w-5 text-primary" />
          <span className="font-bold text-foreground text-sm">{companyName || 'POS'}</span>
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          {pendingCount > 0 && (
            <span className="rounded-full bg-pos-warning/15 text-pos-warning px-2 py-0.5 font-medium">
              {pendingCount} pending
            </span>
          )}
          {!isOnline && (
            <span className="flex items-center gap-1 text-destructive">
              <WifiOff className="h-3 w-3" /> Offline
            </span>
          )}
          <span className="text-foreground font-medium">{userName}</span>
          <Button variant="ghost" size="sm" onClick={logout} className="h-7 px-2 text-muted-foreground hover:text-foreground">
            <LogOut className="h-3.5 w-3.5" />
          </Button>
        </div>
      </header>

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Item search & grid */}
        <div className="flex flex-1 flex-col border-r border-border">
          {/* Search bar */}
          <div className="flex items-center gap-2 border-b border-border p-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                ref={searchRef}
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search items or scan barcode... (F2)"
                className="pl-10 bg-card border-border h-10"
                autoFocus
              />
              {searchQuery && (
                <button
                  onClick={() => { setSearchQuery(''); searchRef.current?.focus(); }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          {/* Items grid */}
          <div className="flex-1 overflow-y-auto p-3">
            {items.length === 0 ? (
              <div className="flex h-full items-center justify-center text-muted-foreground text-sm">
                <div className="text-center space-y-2">
                  <ShoppingCart className="h-10 w-10 mx-auto opacity-40" />
                  <p>No items loaded</p>
                  <p className="text-xs">Items will sync from server on login</p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
                {filteredItems.map(item => (
                  <button
                    key={item.id}
                    onClick={() => addToCart(item)}
                    className="flex flex-col items-start rounded-lg border border-border bg-card p-3 text-left transition-colors hover:bg-pos-surface-hover hover:border-primary/30 active:scale-[0.98]"
                  >
                    <span className="text-xs text-muted-foreground font-mono">{item.code}</span>
                    <span className="text-sm font-medium text-foreground mt-0.5 line-clamp-2">{item.name}</span>
                    <span className="text-sm font-bold text-primary font-mono mt-auto pt-1">
                      {item.price.toFixed(2)}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right: Cart */}
        <div className="flex w-[380px] shrink-0 flex-col bg-card">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <h2 className="font-semibold text-foreground text-sm flex items-center gap-2">
              <ShoppingCart className="h-4 w-4" />
              Cart ({cart.length})
            </h2>
            {cart.length > 0 && (
              <Button variant="ghost" size="sm" onClick={() => setCart([])} className="h-7 text-xs text-muted-foreground hover:text-destructive">
                Clear
              </Button>
            )}
          </div>

          {/* Cart items */}
          <div className="flex-1 overflow-y-auto">
            {cart.length === 0 ? (
              <div className="flex h-full items-center justify-center text-muted-foreground text-sm">
                <p>Cart is empty</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {cart.map(item => (
                  <div key={item.id} className="px-4 py-3 space-y-1">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="text-sm font-medium text-foreground">{item.name}</div>
                        <div className="text-xs text-muted-foreground font-mono">@ {item.price.toFixed(2)}</div>
                      </div>
                      <button onClick={() => removeFromCart(item.id)} className="text-muted-foreground hover:text-destructive p-1">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1">
                        <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => updateQuantity(item.id, -1)}>
                          <Minus className="h-3 w-3" />
                        </Button>
                        <span className="w-10 text-center text-sm font-mono font-semibold text-foreground">{item.quantity}</span>
                        <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => updateQuantity(item.id, 1)}>
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>
                      <span className="text-sm font-bold font-mono text-foreground">{item.total.toFixed(2)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Cart totals & pay */}
          {cart.length > 0 && (
            <div className="border-t border-border p-4 space-y-3">
              <div className="space-y-1 text-sm">
                <div className="flex justify-between text-muted-foreground">
                  <span>Subtotal</span>
                  <span className="font-mono">{subtotal.toFixed(2)}</span>
                </div>
                {billDiscount > 0 && (
                  <div className="flex justify-between text-pos-warning">
                    <span>Discount</span>
                    <span className="font-mono">-{billDiscount.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between text-lg font-bold text-foreground pt-1 border-t border-border">
                  <span>Total</span>
                  <span className="font-mono text-primary">{total.toFixed(2)}</span>
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 h-9"
                  onClick={() => {
                    const d = prompt('Enter discount amount:');
                    if (d) setBillDiscount(parseFloat(d) || 0);
                  }}
                >
                  Discount
                </Button>
                <Button
                  className="flex-1 h-9 font-semibold"
                  onClick={() => setShowPayment(true)}
                >
                  <CreditCard className="mr-1.5 h-4 w-4" />
                  Pay (F9)
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Payment Dialog */}
      <Dialog open={showPayment} onOpenChange={setShowPayment}>
        <DialogContent className="bg-card border-border max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-foreground">Payment</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="text-center">
              <div className="text-3xl font-bold font-mono text-primary">{total.toFixed(2)}</div>
              <div className="text-sm text-muted-foreground mt-1">Amount Due</div>
            </div>

            <div className="space-y-3">
              {['cash', 'card', 'upi'].map(method => (
                <div key={method} className="flex items-center gap-3">
                  <div className="flex items-center gap-2 w-16 text-sm text-foreground capitalize">
                    {method === 'cash' ? <Banknote className="h-4 w-4" /> : <CreditCard className="h-4 w-4" />}
                    {method}
                  </div>
                  <Input
                    type="number"
                    placeholder="0.00"
                    value={paymentAmounts[method] || ''}
                    onChange={e => setPaymentAmounts(prev => ({ ...prev, [method]: e.target.value }))}
                    className="bg-background border-border font-mono text-right"
                    onFocus={e => {
                      if (!paymentAmounts[method]) {
                        setPaymentAmounts(prev => ({ ...prev, [method]: total.toFixed(2) }));
                      }
                    }}
                  />
                </div>
              ))}
            </div>

            {(() => {
              const paid = Object.values(paymentAmounts).reduce((s, v) => s + (parseFloat(v) || 0), 0);
              const change = paid - total;
              return (
                <>
                  {change > 0 && (
                    <div className="text-center rounded-md bg-primary/10 border border-primary/20 p-3">
                      <div className="text-xs text-muted-foreground">Change</div>
                      <div className="text-xl font-bold font-mono text-primary">{change.toFixed(2)}</div>
                    </div>
                  )}
                  <Button
                    className="w-full h-11 font-semibold text-base"
                    disabled={paid < total}
                    onClick={completeSale}
                  >
                    <Printer className="mr-2 h-4 w-4" />
                    Complete & Print
                  </Button>
                </>
              );
            })()}
          </div>
        </DialogContent>
      </Dialog>

      {/* Invoice for printing */}
      {lastSale && (
        <div className={showInvoice ? '' : 'hidden'}>
          <InvoicePrint
            companyName={companyName}
            invoiceNo={lastSale.localId}
            date={new Date(lastSale.createdAt).toLocaleString()}
            cashier={userName}
            items={lastSale.items}
            subtotal={lastSale.subtotal}
            discount={lastSale.discount}
            tax={lastSale.tax}
            total={lastSale.total}
            payments={lastSale.payments}
            customerName={lastSale.customerName}
          />
        </div>
      )}
    </div>
  );
}
