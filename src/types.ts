export type UserRole = 'Admin' | 'Manager' | 'Cashier';

export interface User {
  id: string;
  name: string;
  email: string;
  password?: string;
  role: UserRole;
  createdAt: string;
  isHidden?: boolean;
}

export interface Category {
  id: string;
  name: string;
  icon: string;
}

export interface Product {
  id: string;
  name: string;
  price: number; // Base price or default price
  hasSizes?: boolean;
  prices?: {
    S?: number;
    M?: number;
    L?: number;
  };
  purchasePrice: number;
  image: string;
  barcode: string;
  category: string;
  stock: number;
  minStock: number;
  status: 'available' | 'unavailable';
  salesCount?: number;
  itemType?: 'sellable' | 'internal';
}

export interface OrderItem extends Product {
  quantity: number;
  size?: 'S' | 'M' | 'L';
  note?: string;
  discount?: number;
  manualPrice?: number;
}

export type PaymentMethod = 'Cash' | 'Card' | 'Split' | 'Wallet';

export interface PaymentDetail {
  method: PaymentMethod;
  amount: number;
}

export type InvoiceStatus = 'Paid' | 'Refunded' | 'Partially Refunded' | 'Cancelled' | 'Held';

export interface RefundItem {
  productId: string;
  quantity: number;
  reason: string;
  date: string;
}

export interface Invoice {
  id: string;
  orderNumber: string;
  date: string;
  items: OrderItem[];
  subtotal: number;
  discount: number;
  total: number;
  paymentMethod: PaymentMethod;
  payments: PaymentDetail[];
  cashierName: string;
  cashierId: string;
  customerName?: string;
  cashPaid?: number;
  change?: number;
  status: InvoiceStatus;
  refundedItems?: RefundItem[];
  refundReason?: string;
  refundDate?: string;
  sessionId?: string;
}

export interface HeldOrder {
  id: string;
  items: OrderItem[];
  date: string;
  customerName?: string;
  userId: string;
}

export interface Supplier {
  id: string;
  name: string;
  phone: string;
  email: string;
  address: string;
  notes: string;
  initialBalance: number;
  balance: number;
  createdAt: string;
}

export type SupplierTransactionType = 'Payment' | 'Receipt' | 'Purchase';

export interface SupplierTransaction {
  id: string;
  supplierId: string;
  type: SupplierTransactionType;
  amount: number;
  date: string;
  notes: string;
  userId: string;
  userName?: string;
}

export interface PurchaseItem {
  productId: string;
  productName?: string;
  quantity: number;
  purchasePrice: number;
  size?: string;
}

export interface Purchase {
  id: string;
  invoiceNumber: string;
  supplierId: string;
  supplierName?: string;
  date: string;
  items: PurchaseItem[];
  total: number;
  notes: string;
  userId: string;
  userName?: string;
}

export type ExpenseCategory = 'إيجار' | 'كهرباء' | 'إنترنت' | 'رواتب' | 'صيانة' | 'مشتريات صغيرة' | 'أخرى';

export interface Expense {
  id: string;
  title: string;
  category: ExpenseCategory;
  amount: number;
  date: string;
  userId: string;
  userName?: string;
  notes?: string;
  createdAt: string;
}

export interface InventoryMovement {
  id: string;
  productId: string;
  productName?: string;
  type: 'Purchase' | 'Sale' | 'Return' | 'Adjustment' | 'Transfer';
  quantity: number;
  referenceId: string;
  size?: string;
  date: string;
  note: string;
  userId: string;
  userName?: string;
}

export interface SystemSettings {
  storeName: string;
  storeLogo: string;
  storePhone: string;
  storeEmail: string;
  storeAddress: string;
  invoiceFooter: string;
  currency: string;
  currencySymbol: string;
  autoPrintAfterPayment: boolean;
  showOrderNumber: boolean;
  showCashierName: boolean;
  invoiceLayout: 'standard' | 'compact' | 'detailed';
  kitchenPrinterName: string;
  receiptPrinterName: string;
  isThermalPrinter: boolean;
  autoKitchenPrint: boolean;
  printServiceUrl?: string;
  invoicePaperSize: 'A4' | 'Thermal';
  kitchenPaperSize: 'A4' | 'Thermal';
  useQZTray: boolean;
  lastOrderNumber?: number;
}

export interface AuditLog {
  id: string;
  userId: string;
  userName: string;
  action: string;
  details: string;
  timestamp: string;
  ipAddress?: string;
}

export interface RegisterSession {
  id: string;
  userId: string;
  userName: string;
  openingTime: string;
  closingTime?: string;
  openingCash: number;
  closingCash?: number;
  expectedCash?: number;
  difference?: number;
  status: 'Open' | 'Closed';
  notes?: string;
}
