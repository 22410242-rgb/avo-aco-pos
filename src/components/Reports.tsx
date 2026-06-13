import React, { useState, useMemo, useRef } from 'react';
import { 
  BarChart3, DollarSign, Package, RotateCcw, FileText, 
  Calendar, User, Tag, CreditCard, Download, Filter,
  TrendingUp, TrendingDown, AlertTriangle, CheckCircle2
} from 'lucide-react';
import { Invoice, Product, User as UserType, Category, Purchase, Expense, SystemSettings } from '../types';

interface ReportsProps {
  invoices: Invoice[];
  products: Product[];
  users: UserType[];
  categories: Category[];
  purchases?: Purchase[];
  expenses?: Expense[];
  settings: SystemSettings;
}

type ReportType = 'dashboard' | 'sales' | 'products' | 'cashiers' | 'inventory' | 'purchases' | 'expenses';

export default function Reports({ invoices, products, users, categories, purchases = [], expenses = [], settings }: ReportsProps) {
  const [activeReport, setActiveReport] = useState<ReportType>('dashboard');
  const reportRef = useRef<HTMLDivElement>(null);
  
  // Filters
  const [dateFilter, setDateFilter] = useState<'today' | 'week' | 'month' | 'year' | 'all' | 'custom'>('today');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [cashierFilter, setCashierFilter] = useState('all');
  const [productFilter, setProductFilter] = useState('all');
  const [paymentFilter, setPaymentFilter] = useState('all');
  const [supplierFilter, setSupplierFilter] = useState('all');

  // Filtered Invoices based on global filters
  const filteredInvoices = useMemo(() => {
    return invoices.filter(inv => {
      // Date Filter
      const invDate = new Date(inv.date);
      const today = new Date();
      
      let dateMatch = true;
      if (dateFilter === 'today') {
        dateMatch = invDate.toDateString() === today.toDateString();
      } else if (dateFilter === 'week') {
        const lastWeek = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
        dateMatch = invDate >= lastWeek;
      } else if (dateFilter === 'month') {
        const lastMonth = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
        dateMatch = invDate >= lastMonth;
      } else if (dateFilter === 'year') {
        dateMatch = invDate.getFullYear() === today.getFullYear();
      } else if (dateFilter === 'all') {
        dateMatch = true;
      } else if (dateFilter === 'custom' && customStartDate && customEndDate) {
        const start = new Date(customStartDate);
        const end = new Date(customEndDate);
        end.setHours(23, 59, 59, 999);
        dateMatch = invDate >= start && invDate <= end;
      }

      // Cashier Filter
      const cashierMatch = cashierFilter === 'all' || inv.cashierId === cashierFilter;

      // Payment Filter
      const paymentMatch = paymentFilter === 'all' || inv.paymentMethod === paymentFilter;

      // Product Filter
      let productMatch = true;
      if (productFilter !== 'all') {
        productMatch = inv.items.some(item => item.id === productFilter);
      }

      return dateMatch && cashierMatch && paymentMatch && productMatch;
    });
  }, [invoices, dateFilter, customStartDate, customEndDate, cashierFilter, paymentFilter, productFilter]);

  const filteredPurchases = useMemo(() => {
    return purchases.filter(p => {
      const pDate = new Date(p.date);
      const today = new Date();
      
      let dateMatch = true;
      if (dateFilter === 'today') {
        dateMatch = pDate.toDateString() === today.toDateString();
      } else if (dateFilter === 'week') {
        const lastWeek = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
        dateMatch = pDate >= lastWeek;
      } else if (dateFilter === 'month') {
        const lastMonth = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
        dateMatch = pDate >= lastMonth;
      } else if (dateFilter === 'year') {
        dateMatch = pDate.getFullYear() === today.getFullYear();
      } else if (dateFilter === 'all') {
        dateMatch = true;
      } else if (dateFilter === 'custom' && customStartDate && customEndDate) {
        const start = new Date(customStartDate);
        const end = new Date(customEndDate);
        end.setHours(23, 59, 59, 999);
        dateMatch = pDate >= start && pDate <= end;
      }

      const supplierMatch = supplierFilter === 'all' || p.supplierId === supplierFilter;

      return dateMatch && supplierMatch;
    });
  }, [purchases, dateFilter, customStartDate, customEndDate, supplierFilter]);

  const filteredExpenses = useMemo(() => {
    return expenses.filter(e => {
      const eDate = new Date(e.date);
      const today = new Date();
      
      let dateMatch = true;
      if (dateFilter === 'today') {
        dateMatch = eDate.toDateString() === today.toDateString();
      } else if (dateFilter === 'week') {
        const lastWeek = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
        dateMatch = eDate >= lastWeek;
      } else if (dateFilter === 'month') {
        const lastMonth = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
        dateMatch = eDate >= lastMonth;
      } else if (dateFilter === 'year') {
        dateMatch = eDate.getFullYear() === today.getFullYear();
      } else if (dateFilter === 'all') {
        dateMatch = true;
      } else if (dateFilter === 'custom' && customStartDate && customEndDate) {
        const start = new Date(customStartDate);
        const end = new Date(customEndDate);
        end.setHours(23, 59, 59, 999);
        dateMatch = eDate >= start && eDate <= end;
      }

      return dateMatch;
    });
  }, [expenses, dateFilter, customStartDate, customEndDate]);

  // Calculations
  let grossSales = 0;
  let posReturns = 0;
  let totalProfit = 0;
  let productsSold = 0;
  let returnedItemsCount = 0;
  let totalExpenses = filteredExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);

  filteredInvoices.filter(i => i.status !== 'Cancelled' && i.status !== 'Held').forEach(inv => {
    let invGross = 0;
    let invReturns = 0;
    let invProfit = 0;

    let invDate;
    try {
      invDate = inv.date ? new Date(inv.date) : null;
    } catch (e) {
      invDate = null;
    }

    inv.items.forEach(item => {
      const originalProduct = products.find(p => p.id === item.id);
      const cost = originalProduct ? originalProduct.purchasePrice : 0;
      const itemPrice = (item.manualPrice != null ? item.manualPrice : item.price) || 0;
      const itemTotal = (itemPrice * item.quantity) - (item.discount || 0);
      const itemProfit = itemTotal - (cost * item.quantity);

      if (item.quantity > 0) {
        invGross += itemTotal;
        invProfit += itemProfit;
        productsSold += item.quantity;
      } else {
        invReturns += Math.abs(itemTotal);
        invProfit += itemProfit; // itemProfit is negative, which reduces totalProfit
        returnedItemsCount += Math.abs(item.quantity);
      }
    });

    // Apply global discount
    if ((inv.discount || 0) > 0) {
      if (invGross > 0) {
        invGross -= (inv.discount || 0);
        invProfit -= (inv.discount || 0);
      } else {
        invReturns += (inv.discount || 0);
        invProfit -= (inv.discount || 0);
      }
    }

    grossSales += invGross;
    posReturns += invReturns;
    totalProfit += invProfit;

    // Add refunded items (from Invoice Management)
    (inv.refundedItems || []).forEach(ri => {
      const item = inv.items.find(it => it.id === ri.productId);
      const originalProduct = products.find(p => p.id === ri.productId);
      const cost = originalProduct ? originalProduct.purchasePrice : 0;
      const itemPrice = item ? ((item.manualPrice != null ? item.manualPrice : item.price) || 0) : 0;
      
      const refundAmount = itemPrice * ri.quantity;
      const refundProfitLoss = refundAmount - (cost * ri.quantity);

      posReturns += refundAmount;
      totalProfit -= refundProfitLoss;
      returnedItemsCount += ri.quantity;
    });
  });

  const totalReturns = posReturns;
  const netSales = grossSales - totalReturns;
  const netProfit = totalProfit - totalExpenses;

  // Product Performance
  const productPerformance = useMemo(() => {
    const perf: Record<string, { id: string, name: string, size?: string, sold: number, revenue: number, returned: number }> = {};
    
    filteredInvoices.forEach(inv => {
      if (inv.status !== 'Cancelled' && inv.status !== 'Held') {
        inv.items.forEach(item => {
          const key = item.id + (item.size || '');
          if (!perf[key]) {
            perf[key] = { id: item.id, name: item.name, size: item.size, sold: 0, revenue: 0, returned: 0 };
          }
          
          const itemPrice = (item.manualPrice != null ? item.manualPrice : item.price) || 0;
          if (item.quantity > 0) {
            perf[key].sold += item.quantity;
            perf[key].revenue += (itemPrice * item.quantity);
          } else {
            perf[key].returned += Math.abs(item.quantity);
            perf[key].revenue -= Math.abs(itemPrice * item.quantity);
          }
        });
      }
      
      (inv.refundedItems || []).forEach(ri => {
        const item = inv.items.find(i => i.id === ri.productId);
        const size = item?.size;
        const key = ri.productId + (size || '');
        
        if (!perf[key]) {
          const originalProduct = products.find(p => p.id === ri.productId);
          perf[key] = { id: ri.productId, name: originalProduct?.name || 'Unknown', size: size, sold: 0, revenue: 0, returned: 0 };
        }
        
        perf[key].returned += ri.quantity;
        if (item) {
          const itemPrice = (item.manualPrice != null ? item.manualPrice : item.price) || 0;
          perf[key].revenue -= (itemPrice * ri.quantity);
        }
      });
    });

    return Object.values(perf).sort((a, b) => b.sold - a.sold);
  }, [filteredInvoices, products]);

  // Cashier Performance
  const cashierPerformance = useMemo(() => {
    const perf: Record<string, { name: string, invoices: number, gross: number, returns: number, net: number }> = {};
    
    users.filter(u => u.role === 'Cashier').forEach(u => {
      perf[u.id] = { name: u.name, invoices: 0, gross: 0, returns: 0, net: 0 };
    });

    filteredInvoices.forEach(inv => {
      if (perf[inv.cashierId]) {
        perf[inv.cashierId].invoices += 1;
        if (inv.status !== 'Cancelled' && inv.status !== 'Held') {
          let invGross = 0;
          let invReturns = 0;

          inv.items.forEach(item => {
            const itemPrice = (item.manualPrice != null ? item.manualPrice : item.price) || 0;
            const itemTotal = (itemPrice * item.quantity) - (item.discount || 0);
            if (item.quantity > 0) {
              invGross += itemTotal;
            } else {
              invReturns += Math.abs(itemTotal);
            }
          });

          if ((inv.discount || 0) > 0) {
            if (invGross > 0) invGross -= (inv.discount || 0);
            else invReturns += (inv.discount || 0);
          }

          perf[inv.cashierId].gross += invGross;
          perf[inv.cashierId].returns += invReturns;
        }
        
        const refundAmount = (inv.refundedItems || []).reduce((s, ri) => {
          const item = inv.items.find(it => it.id === ri.productId);
          const itemPrice = item ? ((item.manualPrice != null ? item.manualPrice : item.price) || 0) : 0;
          return s + (itemPrice * ri.quantity);
        }, 0);
        
        perf[inv.cashierId].returns += refundAmount;
        perf[inv.cashierId].net = perf[inv.cashierId].gross - perf[inv.cashierId].returns;
      }
    });

    return Object.values(perf).sort((a, b) => b.net - a.net);
  }, [filteredInvoices, users]);

  const handleExportCSV = () => {
    let data: any[] = [];
    let filename = 'report';

    if (activeReport === 'dashboard') {
      data = [
        { 'إجمالي المبيعات': (grossSales || 0).toFixed(2), 'صافي المبيعات': (netSales || 0).toFixed(2), 'إجمالي الأرباح': (totalProfit || 0).toFixed(2), 'عدد الفواتير': filteredInvoices.length, 'المنتجات المباعة': productsSold, 'المرتجعات': returnedItemsCount }
      ];
      filename = 'dashboard_summary';
    } else if (activeReport === 'sales') {
      data = filteredInvoices.map(inv => ({
        'رقم الفاتورة': inv.orderNumber,
        'التاريخ والوقت': new Date(inv.date).toLocaleString('ar-EG'),
        'الكاشير': inv.cashierName,
        'طريقة الدفع': inv.paymentMethod,
        'الإجمالي': (inv.total || 0).toFixed(2),
        'الحالة': inv.status === 'Paid' ? 'مدفوع' : inv.status === 'Cancelled' ? 'ملغي' : inv.status === 'Refunded' ? 'مسترجع' : 'مسترجع جزئياً'
      }));
      filename = 'sales_report';
    } else if (activeReport === 'products') {
      data = productPerformance.map(p => ({
        'المنتج': p.name,
        'الكمية المباعة': p.sold,
        'المرتجعات': p.returned,
        'إجمالي الإيرادات': (p.revenue || 0).toFixed(2)
      }));
      filename = 'products_report';
    } else if (activeReport === 'cashiers') {
      data = cashierPerformance.map(c => ({
        'الكاشير': c.name,
        'عدد الفواتير': c.invoices,
        'إجمالي المبيعات': (c.gross || 0).toFixed(2),
        'المرتجعات': (c.returns || 0).toFixed(2),
        'صافي المبيعات': (c.net || 0).toFixed(2),
        'متوسط الفاتورة': c.invoices > 0 ? ((c.net / c.invoices) || 0).toFixed(2) : '0.00'
      }));
      filename = 'cashiers_report';
    } else if (activeReport === 'inventory') {
      data = products.map(p => ({
        'المنتج': p.name,
        'التصنيف': p.category,
        'الكمية المتوفرة': p.stock,
        'الحد الأدنى': p.minStock,
        'الحالة': p.stock === 0 ? 'نفد' : p.stock <= p.minStock ? 'منخفض' : 'متوفر'
      }));
      filename = 'inventory_report';
    } else if (activeReport === 'purchases') {
      data = filteredPurchases.map(p => ({
        'رقم الفاتورة': p.invoiceNumber,
        'التاريخ': new Date(p.date).toLocaleDateString('ar-EG'),
        'المورد': p.supplierName,
        'الإجمالي': (p.total || 0).toFixed(2),
        'المستخدم': p.userName
      }));
      filename = 'purchases_report';
    } else if (activeReport === 'expenses') {
      data = filteredExpenses.map(e => ({
        'التاريخ': new Date(e.date).toLocaleDateString('ar-EG'),
        'العنوان': e.title,
        'التصنيف': e.category,
        'المبلغ': (e.amount || 0).toFixed(2),
        'المستخدم': users.find(u => u.id === e.userId)?.name || 'غير معروف',
        'ملاحظات': e.notes || ''
      }));
      filename = 'expenses_report';
    }

    if (data.length === 0) return;
    const headers = Object.keys(data[0]).join(',');
    const rows = data.map(obj => Object.values(obj).map(val => `"${val}"`).join(',')).join('\n');
    const csv = `${headers}\n${rows}`;
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${filename}.csv`;
    link.click();
  };

  return (
    <div className="space-y-6" ref={reportRef}>
      {/* Header & Navigation */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 print-hidden">
        <h2 className="text-2xl font-black text-stone-800 flex items-center gap-2">
          <BarChart3 className="w-7 h-7 text-avocado-primary" />
          التقارير والإحصائيات
        </h2>
        
        <div className="flex flex-wrap gap-2">
          <button onClick={handleExportCSV} className="flex items-center gap-2 px-4 py-2 bg-avocado-light text-avocado-primary rounded-full hover:bg-avocado-primary/20 font-bold transition-all">
            <Download className="w-4 h-4" />
            تصدير Excel
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-sm print-hidden">
        <div className="flex items-center gap-2 mb-4 text-stone-800 font-bold">
          <Filter className="w-5 h-5 text-avocado-primary" />
          خيارات الفلترة
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-bold text-stone-500 mb-1">الفترة الزمنية</label>
            <select 
              value={dateFilter} 
              onChange={(e) => setDateFilter(e.target.value as any)}
              className="w-full p-2.5 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-avocado-primary outline-none"
            >
              <option value="today">اليوم</option>
              <option value="week">آخر 7 أيام</option>
              <option value="month">آخر 30 يوم</option>
              <option value="year">هذا العام</option>
              <option value="all">الكل</option>
              <option value="custom">تخصيص...</option>
            </select>
          </div>
          
          {dateFilter === 'custom' && (
            <>
              <div>
                <label className="block text-xs font-bold text-stone-500 mb-1">من تاريخ</label>
                <input 
                  type="date" 
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="w-full p-2.5 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-avocado-primary outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-stone-500 mb-1">إلى تاريخ</label>
                <input 
                  type="date" 
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="w-full p-2.5 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-avocado-primary outline-none"
                />
              </div>
            </>
          )}

          <div>
            <label className="block text-xs font-bold text-stone-500 mb-1">الكاشير</label>
            <select 
              value={cashierFilter} 
              onChange={(e) => setCashierFilter(e.target.value)}
              className="w-full p-2.5 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-avocado-primary outline-none"
            >
              <option value="all">الجميع</option>
              {users.filter(u => u.role === 'Cashier').map(u => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-stone-500 mb-1">طريقة الدفع</label>
            <select 
              value={paymentFilter} 
              onChange={(e) => setPaymentFilter(e.target.value)}
              className="w-full p-2.5 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-avocado-primary outline-none"
            >
              <option value="all">الجميع</option>
              <option value="Cash">نقدي</option>
              <option value="Card">بطاقة</option>
              <option value="Wallet">محفظة</option>
              <option value="Split">مقسم</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-stone-500 mb-1">المنتج</label>
            <select 
              value={productFilter} 
              onChange={(e) => setProductFilter(e.target.value)}
              className="w-full p-2.5 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-avocado-primary outline-none"
            >
              <option value="all">الجميع</option>
              {products.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-stone-500 mb-1">المورد (للمشتريات)</label>
            <select 
              value={supplierFilter} 
              onChange={(e) => setSupplierFilter(e.target.value)}
              className="w-full p-2.5 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-avocado-primary outline-none"
            >
              <option value="all">الجميع</option>
              {Array.from(new Set(purchases.map(p => p.supplierId))).map(id => {
                const supplier = purchases.find(p => p.supplierId === id);
                return supplier ? <option key={id} value={id}>{supplier.supplierName}</option> : null;
              })}
            </select>
          </div>
        </div>
      </div>

      {/* Report Tabs */}
      <div className="flex overflow-x-auto pb-2 gap-2 print-hidden">
        {[
          { id: 'dashboard', label: 'ملخص الأداء', icon: BarChart3 },
          { id: 'sales', label: 'تقرير المبيعات', icon: DollarSign },
          { id: 'products', label: 'أداء المنتجات', icon: Package },
          { id: 'cashiers', label: 'أداء الكاشيرية', icon: User },
          { id: 'inventory', label: 'حالة المخزون', icon: AlertTriangle },
          { id: 'purchases', label: 'سجل المشتريات', icon: FileText },
          { id: 'expenses', label: 'سجل المصروفات', icon: DollarSign },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveReport(tab.id as ReportType)}
            className={`flex items-center gap-2 px-5 py-3 rounded-xl font-bold whitespace-nowrap transition-all ${
              activeReport === tab.id 
                ? 'bg-stone-900 text-white shadow-md' 
                : 'bg-white text-stone-600 hover:bg-stone-100 border border-stone-200'
            }`}
          >
            <tab.icon className="w-5 h-5" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Report Content */}
      <div className="bg-white rounded-3xl border border-stone-200 shadow-sm p-6 print:border-none print:shadow-none print:p-0">
        
        {/* Dashboard View */}
        {activeReport === 'dashboard' && (
          <div className="space-y-8">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              <div className="bg-avocado-light p-4 md:p-5 rounded-2xl border border-avocado-primary/10">
                <div className="text-avocado-primary text-[10px] md:text-xs font-bold mb-1">إجمالي المبيعات</div>
                <div className="text-xl md:text-2xl font-black text-avocado-secondary">{(grossSales || 0).toFixed(2)} {settings.currencySymbol}</div>
              </div>
              <div className="bg-blue-50 p-4 md:p-5 rounded-2xl border border-blue-100">
                <div className="text-blue-600 text-[10px] md:text-xs font-bold mb-1">صافي المبيعات</div>
                <div className="text-xl md:text-2xl font-black text-blue-900">{(netSales || 0).toFixed(2)} {settings.currencySymbol}</div>
              </div>
              <div className="bg-purple-50 p-4 md:p-5 rounded-2xl border border-purple-100">
                <div className="text-purple-600 text-[10px] md:text-xs font-bold mb-1">إجمالي الأرباح</div>
                <div className="text-xl md:text-2xl font-black text-purple-900">{(totalProfit || 0).toFixed(2)} {settings.currencySymbol}</div>
              </div>
              <div className="bg-red-50 p-4 md:p-5 rounded-2xl border border-red-100">
                <div className="text-red-600 text-[10px] md:text-xs font-bold mb-1">إجمالي المصروفات</div>
                <div className="text-xl md:text-2xl font-black text-red-900">{(totalExpenses || 0).toFixed(2)} {settings.currencySymbol}</div>
              </div>
              <div className="bg-avocado-light p-4 md:p-5 rounded-2xl border border-avocado-primary/10">
                <div className="text-avocado-primary text-[10px] md:text-xs font-bold mb-1">صافي الأرباح</div>
                <div className="text-xl md:text-2xl font-black text-avocado-secondary">{(netProfit || 0).toFixed(2)} {settings.currencySymbol}</div>
              </div>
              <div className="bg-stone-50 p-4 md:p-5 rounded-2xl border border-stone-200">
                <div className="text-stone-500 text-[10px] md:text-xs font-bold mb-1">عدد الفواتير</div>
                <div className="text-xl md:text-2xl font-black text-stone-900">{filteredInvoices.length}</div>
              </div>
              <div className="bg-orange-50 p-4 md:p-5 rounded-2xl border border-orange-100">
                <div className="text-orange-600 text-[10px] md:text-xs font-bold mb-1">المنتجات المباعة</div>
                <div className="text-xl md:text-2xl font-black text-orange-900">{productsSold}</div>
              </div>
              <div className="bg-red-50 p-4 md:p-5 rounded-2xl border border-red-100">
                <div className="text-red-600 text-[10px] md:text-xs font-bold mb-1">المرتجعات</div>
                <div className="text-xl md:text-2xl font-black text-red-900">{returnedItemsCount}</div>
              </div>
              <div className="bg-teal-50 p-4 md:p-5 rounded-2xl border border-teal-100">
                <div className="text-teal-600 text-[10px] md:text-xs font-bold mb-1">إجمالي المشتريات</div>
                <div className="text-xl md:text-2xl font-black text-teal-900">
                  {filteredPurchases.reduce((sum, p) => sum + (p.total || 0), 0).toFixed(2)} {settings.currencySymbol}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div>
                <h3 className="text-lg font-black mb-4 flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-avocado-primary" />
                  أفضل المنتجات مبيعاً
                </h3>
                <div className="space-y-3">
                  {productPerformance.slice(0, 5).map((p, i) => (
                    <div key={i} className="flex items-center justify-between p-3 bg-stone-50 rounded-xl">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-avocado-light text-avocado-primary flex items-center justify-center font-bold text-sm">
                          {i + 1}
                        </div>
                        <div className="font-bold text-stone-800">
                          {p.name}
                          {p.size && <span className="mr-2 text-xs bg-stone-200 px-1.5 py-0.5 rounded text-stone-600 font-bold">{p.size}</span>}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-black text-stone-900">{p.sold} وحدة</div>
                        <div className="text-xs text-stone-500">{(p.revenue || 0).toFixed(2)} {settings.currencySymbol}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-lg font-black mb-4 flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-orange-500" />
                  تنبيهات المخزون
                </h3>
                <div className="space-y-3">
                  {products.filter(p => p.stock <= p.minStock).slice(0, 5).map((p, i) => (
                    <div key={i} className={`flex items-center justify-between p-3 rounded-xl border ${p.stock === 0 ? 'bg-red-50 border-red-100' : 'bg-orange-50 border-orange-100'}`}>
                      <div className="flex items-center gap-3">
                        <Package className={`w-5 h-5 ${p.stock === 0 ? 'text-red-500' : 'text-orange-500'}`} />
                        <div className="font-bold text-stone-800">{p.name}</div>
                      </div>
                      <div className={`font-black ${p.stock === 0 ? 'text-red-600' : 'text-orange-600'}`}>
                        {p.stock === 0 ? 'نفد من المخزون' : `متبقي ${p.stock}`}
                      </div>
                    </div>
                  ))}
                  {products.filter(p => p.stock <= p.minStock).length === 0 && (
                    <div className="p-6 text-center text-stone-500 bg-stone-50 rounded-xl border border-stone-100">
                      <CheckCircle2 className="w-8 h-8 text-avocado-primary mx-auto mb-2" />
                      جميع المنتجات متوفرة بكميات جيدة
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Sales Report View */}
        {activeReport === 'sales' && (
          <div>
            <h3 className="text-lg font-black mb-6">تفاصيل المبيعات</h3>
            <div className="overflow-x-auto no-scrollbar">
              <table className="w-full text-right min-w-[800px]">
                <thead className="bg-stone-50 border-b border-stone-200">
                  <tr>
                    <th className="p-4 font-bold text-stone-500 text-sm">رقم الفاتورة</th>
                    <th className="p-4 font-bold text-stone-500 text-sm">التاريخ والوقت</th>
                    <th className="p-4 font-bold text-stone-500 text-sm">الكاشير</th>
                    <th className="p-4 font-bold text-stone-500 text-sm">طريقة الدفع</th>
                    <th className="p-4 font-bold text-stone-500 text-sm">الإجمالي</th>
                    <th className="p-4 font-bold text-stone-500 text-sm">الحالة</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {filteredInvoices.map(inv => (
                    <tr key={inv.id} className="hover:bg-stone-50 transition-colors">
                      <td className="p-4 font-bold text-stone-700">{inv.orderNumber}</td>
                      <td className="p-4 text-stone-600">
                        {(() => {
                          try {
                            return inv.date ? new Date(inv.date).toLocaleString('ar-EG') : 'بدون تاريخ';
                          } catch (e) {
                            return 'تاريخ غير صالح';
                          }
                        })()}
                      </td>
                      <td className="p-4 text-stone-600">{inv.cashierName}</td>
                      <td className="p-4 text-stone-600">{inv.paymentMethod}</td>
                      <td className="p-4 font-black text-stone-900">{(inv.total || 0).toFixed(2)} {settings.currencySymbol}</td>
                      <td className="p-4">
                        <span className={`px-2 py-1 rounded-lg text-xs font-bold ${
                          inv.status === 'Paid' ? 'bg-avocado-light text-avocado-secondary' :
                          inv.status === 'Cancelled' ? 'bg-red-100 text-red-700' :
                          'bg-orange-100 text-orange-700'
                        }`}>
                          {inv.status === 'Paid' ? 'مدفوع' : 
                           inv.status === 'Cancelled' ? 'ملغي' : 
                           inv.status === 'Refunded' ? 'مسترجع' : 'مسترجع جزئياً'}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {filteredInvoices.length === 0 && (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-stone-500">لا توجد مبيعات في هذه الفترة</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Products Report View */}
        {activeReport === 'products' && (
          <div>
            <h3 className="text-lg font-black mb-6">أداء المنتجات</h3>
            <div className="overflow-x-auto no-scrollbar">
              <table className="w-full text-right min-w-[800px]">
                <thead className="bg-stone-50 border-b border-stone-200">
                  <tr>
                    <th className="p-4 font-bold text-stone-500 text-sm">المنتج</th>
                    <th className="p-4 font-bold text-stone-500 text-sm">الحجم</th>
                    <th className="p-4 font-bold text-stone-500 text-sm">الكمية المباعة</th>
                    <th className="p-4 font-bold text-stone-500 text-sm">المرتجعات</th>
                    <th className="p-4 font-bold text-stone-500 text-sm">إجمالي الإيرادات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {productPerformance.map((p, i) => (
                    <tr key={i} className="hover:bg-stone-50 transition-colors">
                      <td className="p-4 font-bold text-stone-700">{p.name}</td>
                      <td className="p-4">
                        {p.size ? (
                          <span className="px-2 py-1 bg-stone-100 text-stone-600 rounded-md text-xs font-bold">
                            {p.size}
                          </span>
                        ) : '-'}
                      </td>
                      <td className="p-4 font-black text-avocado-primary">{p.sold}</td>
                      <td className="p-4 font-bold text-red-500">{p.returned}</td>
                      <td className="p-4 font-black text-stone-900">{(p.revenue || 0).toFixed(2)} {settings.currencySymbol}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Cashiers Report View */}
        {activeReport === 'cashiers' && (
          <div>
            <h3 className="text-lg font-black mb-6">أداء الكاشيرية</h3>
            <div className="overflow-x-auto no-scrollbar">
              <table className="w-full text-right min-w-[800px]">
                <thead className="bg-stone-50 border-b border-stone-200">
                  <tr>
                    <th className="p-4 font-bold text-stone-500 text-sm">الكاشير</th>
                    <th className="p-4 font-bold text-stone-500 text-sm">عدد الفواتير</th>
                    <th className="p-4 font-bold text-stone-500 text-sm">إجمالي المبيعات</th>
                    <th className="p-4 font-bold text-stone-500 text-sm">المرتجعات</th>
                    <th className="p-4 font-bold text-stone-500 text-sm">صافي المبيعات</th>
                    <th className="p-4 font-bold text-stone-500 text-sm">متوسط الفاتورة</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {cashierPerformance.map((c, i) => (
                    <tr key={i} className="hover:bg-stone-50 transition-colors">
                      <td className="p-4 font-bold text-stone-700">{c.name}</td>
                      <td className="p-4 font-bold text-stone-600">{c.invoices}</td>
                      <td className="p-4 font-bold text-stone-900">{(c.gross || 0).toFixed(2)} {settings.currencySymbol}</td>
                      <td className="p-4 font-bold text-red-500">{(c.returns || 0).toFixed(2)} {settings.currencySymbol}</td>
                      <td className="p-4 font-black text-avocado-primary">{(c.net || 0).toFixed(2)} {settings.currencySymbol}</td>
                      <td className="p-4 font-bold text-blue-600">
                        {c.invoices > 0 ? ((c.net / c.invoices) || 0).toFixed(2) : '0.00'} {settings.currencySymbol}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Inventory Report View */}
        {activeReport === 'inventory' && (
          <div>
            <h3 className="text-lg font-black mb-6">تقرير المخزون</h3>
            <div className="overflow-x-auto no-scrollbar">
              <table className="w-full text-right min-w-[800px]">
                <thead className="bg-stone-50 border-b border-stone-200">
                  <tr>
                    <th className="p-4 font-bold text-stone-500 text-sm">المنتج</th>
                    <th className="p-4 font-bold text-stone-500 text-sm">التصنيف</th>
                    <th className="p-4 font-bold text-stone-500 text-sm">الكمية المتوفرة</th>
                    <th className="p-4 font-bold text-stone-500 text-sm">الحد الأدنى</th>
                    <th className="p-4 font-bold text-stone-500 text-sm">الحالة</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {products.map((p, i) => (
                    <tr key={i} className="hover:bg-stone-50 transition-colors">
                      <td className="p-4 font-bold text-stone-700">{p.name}</td>
                      <td className="p-4 text-stone-600">{p.category}</td>
                      <td className="p-4 font-black text-stone-900">{p.stock}</td>
                      <td className="p-4 text-stone-500">{p.minStock}</td>
                      <td className="p-4">
                        <span className={`px-2 py-1 rounded-lg text-xs font-bold ${
                          p.stock === 0 ? 'bg-red-100 text-red-700' :
                          p.stock <= p.minStock ? 'bg-orange-100 text-orange-700' :
                          'bg-avocado-light text-avocado-secondary'
                        }`}>
                          {p.stock === 0 ? 'نفد' : 
                           p.stock <= p.minStock ? 'منخفض' : 'متوفر'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Purchases Report View */}
        {activeReport === 'purchases' && (
          <div>
            <h3 className="text-lg font-black mb-6">سجل المشتريات</h3>
            <div className="overflow-x-auto no-scrollbar">
              <table className="w-full text-right min-w-[800px]">
                <thead className="bg-stone-50 border-b border-stone-200">
                  <tr>
                    <th className="p-4 font-bold text-stone-500 text-sm">رقم الفاتورة</th>
                    <th className="p-4 font-bold text-stone-500 text-sm">التاريخ</th>
                    <th className="p-4 font-bold text-stone-500 text-sm">المورد</th>
                    <th className="p-4 font-bold text-stone-500 text-sm">الإجمالي</th>
                    <th className="p-4 font-bold text-stone-500 text-sm">المستخدم</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {filteredPurchases.map((p, i) => (
                    <tr key={i} className="hover:bg-stone-50 transition-colors">
                      <td className="p-4 font-bold text-stone-700">{p.invoiceNumber}</td>
                      <td className="p-4 text-stone-600">{new Date(p.date).toLocaleDateString('ar-EG')}</td>
                      <td className="p-4 font-bold text-stone-900">{p.supplierName}</td>
                      <td className="p-4 font-black text-avocado-primary">{(p.total || 0).toFixed(2)} {settings.currencySymbol}</td>
                      <td className="p-4 text-stone-500">{p.userName}</td>
                    </tr>
                  ))}
                  {filteredPurchases.length === 0 && (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-stone-500 font-bold">
                        لا توجد فواتير مشتريات
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Expenses Report View */}
        {activeReport === 'expenses' && (
          <div>
            <h3 className="text-lg font-black mb-6">سجل المصروفات</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-right">
                <thead className="bg-stone-50 border-b border-stone-200">
                  <tr>
                    <th className="p-4 font-bold text-stone-500 text-sm">التاريخ</th>
                    <th className="p-4 font-bold text-stone-500 text-sm">العنوان</th>
                    <th className="p-4 font-bold text-stone-500 text-sm">التصنيف</th>
                    <th className="p-4 font-bold text-stone-500 text-sm">المبلغ</th>
                    <th className="p-4 font-bold text-stone-500 text-sm">المستخدم</th>
                    <th className="p-4 font-bold text-stone-500 text-sm">ملاحظات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {filteredExpenses.map((e, i) => (
                    <tr key={i} className="hover:bg-stone-50 transition-colors">
                      <td className="p-4 text-stone-600">{new Date(e.date).toLocaleDateString('ar-EG')}</td>
                      <td className="p-4 font-bold text-stone-900">{e.title}</td>
                      <td className="p-4">
                        <span className="px-2 py-1 bg-stone-100 text-stone-600 rounded-lg text-xs font-bold">
                          {e.category}
                        </span>
                      </td>
                      <td className="p-4 font-black text-red-600">{(e.amount || 0).toFixed(2)} {settings.currencySymbol}</td>
                      <td className="p-4 text-stone-500">{users.find(u => u.id === e.userId)?.name || 'غير معروف'}</td>
                      <td className="p-4 text-stone-500 text-sm truncate max-w-xs" title={e.notes}>{e.notes || '-'}</td>
                    </tr>
                  ))}
                  {filteredExpenses.length === 0 && (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-stone-500 font-bold">
                        لا توجد مصروفات مسجلة
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
