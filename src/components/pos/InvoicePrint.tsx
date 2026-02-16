import { type CartItem } from '@/db';

interface InvoicePrintProps {
  companyName: string;
  branchName?: string;
  invoiceNo: string;
  date: string;
  cashier: string;
  items: CartItem[];
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  payments: Array<{ method: string; amount: number }>;
  customerName?: string;
}

export function InvoicePrint({
  companyName, branchName, invoiceNo, date, cashier,
  items, subtotal, discount, tax, total, payments, customerName,
}: InvoicePrintProps) {
  return (
    <div className="print-invoice p-2 text-xs leading-relaxed font-mono">
      {/* Header */}
      <div className="text-center mb-2">
        <div className="text-sm font-bold">{companyName}</div>
        {branchName && <div>{branchName}</div>}
        <div className="border-b border-dashed border-black my-1" />
      </div>

      {/* Meta */}
      <div className="mb-2">
        <div>Invoice: {invoiceNo}</div>
        <div>Date: {date}</div>
        <div>Cashier: {cashier}</div>
        {customerName && <div>Customer: {customerName}</div>}
      </div>

      <div className="border-b border-dashed border-black my-1" />

      {/* Items */}
      <table className="w-full mb-1">
        <thead>
          <tr className="text-left">
            <th className="font-semibold">Item</th>
            <th className="font-semibold text-right">Qty</th>
            <th className="font-semibold text-right">Price</th>
            <th className="font-semibold text-right">Total</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id}>
              <td className="pr-1">{item.name}</td>
              <td className="text-right">{item.quantity}</td>
              <td className="text-right">{item.price.toFixed(2)}</td>
              <td className="text-right">{item.total.toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="border-b border-dashed border-black my-1" />

      {/* Totals */}
      <div className="space-y-0.5">
        <div className="flex justify-between">
          <span>Subtotal:</span>
          <span>{subtotal.toFixed(2)}</span>
        </div>
        {discount > 0 && (
          <div className="flex justify-between">
            <span>Discount:</span>
            <span>-{discount.toFixed(2)}</span>
          </div>
        )}
        {tax > 0 && (
          <div className="flex justify-between">
            <span>Tax:</span>
            <span>{tax.toFixed(2)}</span>
          </div>
        )}
        <div className="flex justify-between font-bold text-sm">
          <span>TOTAL:</span>
          <span>{total.toFixed(2)}</span>
        </div>
      </div>

      <div className="border-b border-dashed border-black my-1" />

      {/* Payments */}
      <div className="space-y-0.5">
        {payments.map((p, i) => (
          <div key={i} className="flex justify-between">
            <span>{p.method}:</span>
            <span>{p.amount.toFixed(2)}</span>
          </div>
        ))}
      </div>

      <div className="border-b border-dashed border-black my-1" />

      <div className="text-center mt-2">
        <div>Thank you for your purchase!</div>
      </div>
    </div>
  );
}
