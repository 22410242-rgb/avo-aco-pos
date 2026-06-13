import React, { useState, useEffect, useRef } from 'react';
import { Plus, Search, ShoppingCart, Calendar, Building2, FileText, ChevronDown, Trash2, Download } from 'lucide-react';
import { Product, Supplier, Purchase, PurchaseItem, User, SystemSettings, InventoryMovement, SupplierTransaction } from '../types';
import { db } from '../firebase';
import { collection, doc, setDoc, deleteDoc, onSnapshot, query, orderBy } from 'firebase/firestore';

interface PurchasesProps {
  products: Product[];
  setProducts: React.Dispatch<React.SetStateAction<Product[]>>;
  setInventoryMovements: React.Dispatch<React.SetStateAction<InventoryMovement[]>>;
  currentUser: User | null;
  settings: SystemSettings;
}

export function Purchases({ products, setProducts, setInventoryMovements, currentUser, settings }: PurchasesProps) {
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const purchasesRef = useRef<HTMLDivElement>(null);
  const purchaseDetailsRef = useRef<HTMLDivElement>(null);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [view, setView] = useState<'list' | 'create'>('list');
  const [searchTerm, setSearchTerm] = useState('');
  const [showToast, setShowToast] = useState<string | null>(null);

  // Create Purchase State
  const [selectedSupplier, setSelectedSupplier] = useState<string>('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().split('T')[0]);
  const [purchaseNotes, setPurchaseNotes] = useState('');
  const [purchaseItems, setPurchaseItems] = useState<PurchaseItem[]>([]);
  const [productSearch, setProductSearch] = useState('');

  const [selectedPurchase, setSelectedPurchase] = useState<Purchase | null>(null);
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [newProductForm, setNewProductForm] = useState({
    name: '',
    barcode: '',
    purchasePrice: 0,
    price: 0,
    stock: 0,
    minStock: 5,
    category: '',
    itemType: 'sellable' as 'sellable' | 'internal'
  });

  useEffect(() => {
    const unsubPurchases = onSnapshot(query(collection(db, 'purchases'), orderBy('date', 'desc')), (snapshot) => {
      const purchasesList = snapshot.docs.map(doc => doc.data() as Purchase);
      setPurchases(purchasesList);
    });

    const unsubSuppliers = onSnapshot(collection(db, 'suppliers'), (snapshot) => {
      const suppliersList = snapshot.docs.map(doc => doc.data() as Supplier);
      setSuppliers(suppliersList);
    });

    // Load draft if exists
    const savedDraft = localStorage.getItem('pos_purchase_draft');
    if (savedDraft) {
      const draft = JSON.parse(savedDraft);
      setSelectedSupplier(draft.selectedSupplier || '');
      setInvoiceNumber(draft.invoiceNumber || '');
      setPurchaseDate(draft.purchaseDate || new Date().toISOString().split('T')[0]);
      setPurchaseNotes(draft.purchaseNotes || '');
      setPurchaseItems(draft.purchaseItems || []);
    } else {
      // Generate new invoice number if no draft
      const lastInvoice = localStorage.getItem('last_invoice_number') || '0';
      setInvoiceNumber((parseInt(lastInvoice) + 1).toString());
    }

    return () => {
      unsubPurchases();
      unsubSuppliers();
    };
  }, []);

  // Save draft to localStorage
  useEffect(() => {
    if (view === 'create') {
      const draft = {
        selectedSupplier,
        invoiceNumber,
        purchaseDate,
        purchaseNotes,
        purchaseItems
      };
      localStorage.setItem('pos_purchase_draft', JSON.stringify(draft));
    }
  }, [selectedSupplier, invoiceNumber, purchaseDate, purchaseNotes, purchaseItems, view]);

  const filteredPurchases = purchases.filter(p => 
    p.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.supplierName?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
    p.barcode.includes(productSearch)
  );

  const handleAddProduct = (product: Product) => {
    setPurchaseItems(prev => {
      const existingItem = prev.find(item => item.productId === product.id);
      if (existingItem) {
        return prev.map(item => 
          item.productId === product.id 
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      } else {
        return [...prev, {
          productId: product.id,
          productName: product.name,
          quantity: 1,
          purchasePrice: product.purchasePrice || 0
        }];
      }
    });
    setProductSearch('');
    setShowToast(`تم إضافة ${product.name} للفاتورة`);
    setTimeout(() => setShowToast(null), 3000);
  };

  const handleUpdateItem = (productId: string, field: 'quantity' | 'purchasePrice', value: number) => {
    setPurchaseItems(prev => prev.map(item => 
      item.productId === productId 
        ? { ...item, [field]: Math.max(0, value) }
        : item
    ));
  };

  const handleRemoveItem = (productId: string) => {
    setPurchaseItems(prev => prev.filter(item => item.productId !== productId));
  };

  const calculateTotal = () => {
    return purchaseItems.reduce((sum, item) => sum + (item.quantity * item.purchasePrice), 0);
  };

  const handleSubmitPurchase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSupplier) {
      setShowToast('يرجى اختيار المورد');
      setTimeout(() => setShowToast(null), 3000);
      return;
    }
    if (purchaseItems.length === 0) {
      setShowToast('يرجى إضافة منتجات للفاتورة');
      setTimeout(() => setShowToast(null), 3000);
      return;
    }
    if (!invoiceNumber) {
      setShowToast('يرجى إدخال رقم الفاتورة');
      setTimeout(() => setShowToast(null), 3000);
      return;
    }

    try {
      const supplier = suppliers.find(s => s.id === selectedSupplier);
      const totalAmount = calculateTotal();
      const purchaseId = Date.now().toString();
      const newPurchase: Purchase = {
        id: purchaseId,
        invoiceNumber,
        supplierId: selectedSupplier,
        supplierName: supplier?.name || 'مورد غير معروف',
        date: new Date(purchaseDate).toISOString(),
        total: totalAmount,
        notes: purchaseNotes,
        userId: currentUser?.id || 'unknown',
        userName: currentUser?.name || 'مستخدم غير معروف',
        items: purchaseItems
      };

      // 1. Save Purchase to Firestore
      await setDoc(doc(db, 'purchases', purchaseId), newPurchase);

      // 2. Record supplier transaction in Firestore
      const transactionId = Date.now().toString();
      const newSupplierTransaction: SupplierTransaction = {
        id: transactionId,
        supplierId: selectedSupplier,
        type: 'Purchase',
        amount: totalAmount,
        date: new Date(purchaseDate).toISOString(),
        notes: `فاتورة شراء رقم: ${invoiceNumber}`,
        userId: currentUser?.id || 'unknown',
        userName: currentUser?.name || 'مستخدم غير معروف'
      };
      await setDoc(doc(db, 'supplierTransactions', transactionId), newSupplierTransaction);

      // 3. Update supplier balance in Firestore
      if (supplier) {
        const updatedSupplier = { ...supplier, balance: (supplier.balance || 0) + totalAmount };
        await setDoc(doc(db, 'suppliers', selectedSupplier), updatedSupplier);
      }

      // 4. Update products stock and purchase price in Firestore
      const updateProductPromises = purchaseItems.map(async (item) => {
        const product = products.find(p => p.id === item.productId);
        if (product) {
          const updatedProduct = {
            ...product,
            stock: (product.stock || 0) + item.quantity,
            purchasePrice: item.purchasePrice
          };
          await setDoc(doc(db, 'products', product.id), updatedProduct);
        }
      });
      await Promise.all(updateProductPromises);

      // 5. Record inventory movements in Firestore
      const movementPromises = purchaseItems.map(async (item) => {
        const movementId = Date.now().toString() + Math.random().toString(36).substr(2, 9);
        const newMovement: InventoryMovement = {
          id: movementId,
          productId: item.productId,
          productName: item.productName,
          type: 'Purchase',
          quantity: item.quantity,
          date: new Date().toISOString(),
          note: `شراء من مورد: ${supplier?.name || 'مورد غير معروف'}`,
          referenceId: invoiceNumber,
          size: item.size,
          userId: currentUser?.id || 'unknown',
          userName: currentUser?.name || 'مستخدم غير معروف'
        };
        await setDoc(doc(db, 'inventoryMovements', movementId), newMovement);
      });
      await Promise.all(movementPromises);

      // Update last invoice number locally
      localStorage.setItem('last_invoice_number', invoiceNumber);

      setShowToast('تم حفظ فاتورة المشتريات بنجاح');
      setView('list');
      
      // Reset form and clear draft
      setSelectedSupplier('');
      setInvoiceNumber('');
      setPurchaseDate(new Date().toISOString().split('T')[0]);
      setPurchaseNotes('');
      setPurchaseItems([]);
      localStorage.removeItem('pos_purchase_draft');
    } catch (error) {
      console.error("Error saving purchase:", error);
      setShowToast('حدث خطأ أثناء حفظ فاتورة المشتريات');
    }
    
    setTimeout(() => setShowToast(null), 3000);
  };

  return (
    <div className="space-y-6" ref={purchasesRef}>
      {showToast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 bg-stone-800 text-white px-6 py-3 rounded-2xl shadow-2xl z-50 animate-fade-in">
          {showToast}
        </div>
      )}

      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-black text-stone-800 flex items-center gap-3">
          <ShoppingCart className="w-8 h-8 text-avocado-primary" />
          المشتريات
        </h2>
        {view === 'list' ? (
          <button 
            onClick={() => setView('create')}
            className="bg-avocado-btn text-white px-6 py-3 rounded-2xl font-bold flex items-center gap-2 hover:bg-avocado-primary transition-all shadow-lg shadow-avocado-light"
          >
            <Plus className="w-5 h-5" />
            فاتورة شراء جديدة
          </button>
        ) : (
          <button 
            onClick={() => setView('list')}
            className="bg-stone-200 text-stone-700 px-6 py-3 rounded-2xl font-bold flex items-center gap-2 hover:bg-stone-300 transition-all"
          >
            العودة للسجل
          </button>
        )}
      </div>

      {view === 'list' && (
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-stone-100">
          <div className="relative mb-6">
            <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-stone-400" />
            <input 
              type="text"
              placeholder="البحث برقم الفاتورة أو اسم المورد..."
              className="w-full bg-stone-50 border-none rounded-2xl py-4 pr-12 pl-4 outline-none focus:ring-2 focus:ring-avocado-primary transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="flex justify-end gap-2 mb-6 print-hidden">
            <button 
              onClick={() => {
                const data = filteredPurchases.map(p => ({
                  'التاريخ': new Date(p.date).toLocaleDateString('ar-EG'),
                  'رقم الفاتورة': p.invoiceNumber,
                  'المورد': p.supplierName,
                  'عدد المنتجات': p.items.length,
                  'الإجمالي': (p.total || 0).toFixed(2),
                  'المستخدم': p.userName
                }));
                
                if (data.length === 0) return;
                const headers = Object.keys(data[0]).join(',');
                const rows = data.map(obj => Object.values(obj).map(val => `"${val}"`).join(',')).join('\n');
                const csv = `${headers}\n${rows}`;
                const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
                const link = document.createElement('a');
                link.href = URL.createObjectURL(blob);
                link.download = `purchases_report_${new Date().toISOString().split('T')[0]}.csv`;
                link.click();
              }} 
              className="flex items-center gap-2 px-4 py-2 bg-avocado-light text-avocado-primary rounded-full hover:bg-avocado-primary/20 font-bold transition-all"
            >
              <Download className="w-4 h-4" />
              تصدير Excel
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right">
              <thead className="bg-stone-50 border-b border-stone-200">
                <tr>
                  <th className="p-4 font-bold text-stone-500 text-sm">التاريخ</th>
                  <th className="p-4 font-bold text-stone-500 text-sm">رقم الفاتورة</th>
                  <th className="p-4 font-bold text-stone-500 text-sm">المورد</th>
                  <th className="p-4 font-bold text-stone-500 text-sm">المنتجات</th>
                  <th className="p-4 font-bold text-stone-500 text-sm">الإجمالي</th>
                  <th className="p-4 font-bold text-stone-500 text-sm">المستخدم</th>
                  <th className="p-4 font-bold text-stone-500 text-sm text-center">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {filteredPurchases.map(purchase => (
                  <tr key={purchase.id} className="hover:bg-stone-50/50 transition-colors">
                    <td className="p-4 text-stone-500 text-sm">{new Date(purchase.date).toLocaleDateString('ar-EG')}</td>
                    <td className="p-4 font-bold text-stone-700">{purchase.invoiceNumber}</td>
                    <td className="p-4 font-bold text-avocado-primary">{purchase.supplierName}</td>
                    <td className="p-4 text-stone-600 text-sm">
                      {purchase.items.length} منتجات
                      <div className="text-xs text-stone-400 mt-1">
                        إجمالي القطع: {purchase.items.reduce((sum, item) => sum + item.quantity, 0)}
                      </div>
                    </td>
                    <td className="p-4 font-black text-avocado-primary">{(purchase.total || 0).toFixed(2)} {settings.currencySymbol}</td>
                    <td className="p-4 text-stone-500 text-sm">{purchase.userName}</td>
                    <td className="p-4">
                      <div className="flex justify-center">
                        <button 
                          onClick={() => setSelectedPurchase(purchase)}
                          className="p-2 text-stone-400 hover:text-avocado-primary hover:bg-avocado-light rounded-xl transition-all"
                          title="عرض التفاصيل"
                        >
                          <FileText className="w-5 h-5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredPurchases.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-12 text-center text-stone-400">لا توجد فواتير مشتريات</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {view === 'create' && (
        <form onSubmit={handleSubmitPurchase} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-stone-100">
              <h3 className="text-lg font-black text-stone-800 mb-4 flex items-center gap-2">
                <FileText className="w-5 h-5 text-avocado-primary" />
                تفاصيل الفاتورة
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-stone-700 mb-2">المورد *</label>
                  <div className="relative">
                    <select 
                      required
                      className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-3 appearance-none outline-none focus:ring-2 focus:ring-avocado-primary"
                      value={selectedSupplier}
                      onChange={(e) => setSelectedSupplier(e.target.value)}
                    >
                      <option value="">اختر المورد...</option>
                      {suppliers.map(s => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400 pointer-events-none" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-bold text-stone-700 mb-2">رقم الفاتورة *</label>
                  <input 
                    type="text"
                    required
                    className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-avocado-primary"
                    value={invoiceNumber}
                    onChange={(e) => setInvoiceNumber(e.target.value)}
                    placeholder="مثال: INV-2024-001"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-stone-700 mb-2">التاريخ *</label>
                  <input 
                    type="date"
                    required
                    className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-avocado-primary"
                    value={purchaseDate}
                    onChange={(e) => setPurchaseDate(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-stone-700 mb-2">ملاحظات</label>
                  <input 
                    type="text"
                    className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-avocado-primary"
                    value={purchaseNotes}
                    onChange={(e) => setPurchaseNotes(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-3xl p-6 shadow-sm border border-stone-100">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-black text-stone-800 flex items-center gap-2">
                  <ShoppingCart className="w-5 h-5 text-avocado-primary" />
                  المنتجات
                </h3>
                <button 
                  type="button"
                  onClick={() => setIsProductModalOpen(true)}
                  className="text-avocado-primary text-sm font-bold flex items-center gap-1 hover:underline"
                >
                  <Plus className="w-4 h-4" />
                  منتج جديد
                </button>
              </div>
              
              <div className="relative mb-6">
                <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-stone-400" />
                <input 
                  type="text"
                  placeholder="البحث عن منتج لإضافته (الاسم، الباركود)..."
                  className="w-full bg-stone-50 border border-stone-200 rounded-xl py-3 pr-12 pl-4 outline-none focus:ring-2 focus:ring-avocado-primary transition-all"
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                />
                {productSearch && (
                  <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-stone-200 rounded-xl shadow-xl z-10 max-h-60 overflow-y-auto">
                    {filteredProducts.map(product => (
                      <button
                        key={product.id}
                        type="button"
                        onClick={() => handleAddProduct(product)}
                        className="w-full text-right px-4 py-3 hover:bg-stone-50 border-b border-stone-100 last:border-0 flex justify-between items-center"
                      >
                        <span className="font-bold text-stone-700">{product.name}</span>
                        <span className="text-xs text-stone-400">{product.barcode}</span>
                      </button>
                    ))}
                    {filteredProducts.length === 0 && (
                      <div className="px-4 py-3 text-stone-500 text-center text-sm">لا توجد نتائج</div>
                    )}
                  </div>
                )}
              </div>

              <div className="space-y-3">
                {purchaseItems.map((item, index) => (
                  <div key={item.productId} className="flex items-center gap-4 bg-stone-50 p-4 rounded-2xl border border-stone-100">
                    <div className="w-8 h-8 bg-avocado-light text-avocado-primary rounded-full flex items-center justify-center font-bold text-sm shrink-0">
                      {index + 1}
                    </div>
                    <div className="flex-1">
                      <h4 className="font-bold text-stone-800">{item.productName}</h4>
                    </div>
                    <div className="w-24">
                      <label className="block text-[10px] font-bold text-stone-500 mb-1">الكمية</label>
                      <input 
                        type="number"
                        min="1"
                        className="w-full bg-white border border-stone-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-avocado-primary text-center font-bold"
                        value={item.quantity}
                        onChange={(e) => handleUpdateItem(item.productId, 'quantity', parseInt(e.target.value) || 0)}
                      />
                    </div>
                    <div className="w-32">
                      <label className="block text-[10px] font-bold text-stone-500 mb-1">سعر الشراء ({settings.currencySymbol})</label>
                      <input 
                        type="number"
                        min="0"
                        step="0.01"
                        className="w-full bg-white border border-stone-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-avocado-primary text-center font-bold text-avocado-primary"
                        value={item.purchasePrice}
                        onChange={(e) => handleUpdateItem(item.productId, 'purchasePrice', parseFloat(e.target.value) || 0)}
                      />
                    </div>
                    <div className="w-24 text-left">
                      <label className="block text-[10px] font-bold text-stone-500 mb-1">الإجمالي</label>
                      <div className="font-black text-stone-700 py-2">
                        {(item.quantity * (item.purchasePrice || 0)).toFixed(2)} {settings.currencySymbol}
                      </div>
                    </div>
                    <button 
                      type="button"
                      onClick={() => handleRemoveItem(item.productId)}
                      className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors mt-5 shrink-0"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                ))}
                {purchaseItems.length === 0 && (
                  <div className="text-center py-12 text-stone-400 bg-stone-50 rounded-2xl border border-dashed border-stone-200">
                    لم يتم إضافة منتجات للفاتورة بعد
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="lg:col-span-1">
            <div className="bg-stone-800 rounded-3xl p-6 text-white sticky top-6 shadow-xl">
              <h3 className="text-lg font-black mb-6 text-stone-300">ملخص الفاتورة</h3>
              
              <div className="space-y-4 mb-8">
                <div className="flex justify-between items-center text-stone-400">
                  <span>عدد المنتجات:</span>
                  <span className="font-bold text-white">{purchaseItems.length}</span>
                </div>
                <div className="flex justify-between items-center text-stone-400">
                  <span>إجمالي القطع:</span>
                  <span className="font-bold text-white">{purchaseItems.reduce((sum, item) => sum + item.quantity, 0)}</span>
                </div>
                <div className="pt-4 border-t border-stone-700">
                  <div className="flex justify-between items-center">
                    <span className="text-lg text-stone-300">الإجمالي:</span>
                    <span className="text-3xl font-black text-avocado-primary">{(calculateTotal() || 0).toFixed(2)} {settings.currencySymbol}</span>
                  </div>
                </div>
              </div>

              <button 
                type="submit"
                className="w-full bg-avocado-btn text-white py-4 rounded-2xl font-black text-lg hover:bg-avocado-primary transition-all shadow-lg shadow-avocado-light flex items-center justify-center gap-2"
              >
                <ShoppingCart className="w-6 h-6" />
                حفظ فاتورة الشراء
              </button>
            </div>
          </div>
        </form>
      )}
      {/* View Purchase Details Modal */}
      {selectedPurchase && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-stone-100 flex justify-between items-center bg-stone-50">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-avocado-light text-avocado-primary rounded-xl">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-xl font-black">تفاصيل فاتورة الشراء {selectedPurchase.invoiceNumber}</h2>
                  <p className="text-xs text-stone-500">{new Date(selectedPurchase.date).toLocaleString('ar-EG')}</p>
                </div>
              </div>
              <button onClick={() => setSelectedPurchase(null)} className="p-2 hover:bg-stone-200 rounded-full transition-colors">
                <Plus className="w-6 h-6 rotate-45" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-8" ref={purchaseDetailsRef}>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-6 mb-8">
                <div className="bg-stone-50 p-4 rounded-2xl border border-stone-100">
                  <div className="text-[10px] text-stone-400 uppercase font-bold mb-1">المورد</div>
                  <div className="font-bold text-avocado-primary">{selectedPurchase.supplierName}</div>
                </div>
                <div className="bg-stone-50 p-4 rounded-2xl border border-stone-100">
                  <div className="text-[10px] text-stone-400 uppercase font-bold mb-1">المستخدم</div>
                  <div className="font-bold text-stone-700">{selectedPurchase.userName}</div>
                </div>
                <div className="bg-stone-50 p-4 rounded-2xl border border-stone-100">
                  <div className="text-[10px] text-stone-400 uppercase font-bold mb-1">الإجمالي</div>
                  <div className="font-black text-avocado-primary">{(selectedPurchase.total || 0).toFixed(2)} {settings.currencySymbol}</div>
                </div>
              </div>

              {selectedPurchase.notes && (
                <div className="mb-8 p-4 bg-stone-50 rounded-2xl border border-stone-100">
                  <div className="text-[10px] text-stone-400 uppercase font-bold mb-1">ملاحظات</div>
                  <div className="text-stone-700">{selectedPurchase.notes}</div>
                </div>
              )}

              <div className="border border-stone-100 rounded-2xl overflow-hidden">
                <table className="w-full text-right">
                  <thead className="bg-stone-50 text-xs font-bold text-stone-500">
                    <tr>
                      <th className="p-3">المنتج</th>
                      <th className="p-3">الكمية</th>
                      <th className="p-3">سعر الشراء</th>
                      <th className="p-3">الإجمالي</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-50">
                    {selectedPurchase.items.map((item, idx) => (
                      <tr key={idx}>
                        <td className="p-3 text-sm font-bold">{item.productName}</td>
                        <td className="p-3 text-sm">{item.quantity}</td>
                        <td className="p-3 text-sm">{(item.purchasePrice || 0).toFixed(2)} {settings.currencySymbol}</td>
                        <td className="p-3 text-sm font-bold">{((item.purchasePrice || 0) * item.quantity).toFixed(2)} {settings.currencySymbol}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="p-6 bg-stone-50 border-t border-stone-100 flex gap-3">
              <button 
                onClick={() => setSelectedPurchase(null)}
                className="flex-1 bg-stone-200 text-stone-700 py-3 rounded-xl font-bold hover:bg-stone-300 transition-all"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Product Modal */}
      {isProductModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl">
            <form onSubmit={(e) => {
              e.preventDefault();
              const productData: Product = {
                id: Date.now().toString(),
                ...newProductForm,
                image: 'https://picsum.photos/seed/product/400/400',
                status: 'available'
              } as Product;

              setProducts(prev => {
                const updatedProducts = [...prev, productData];
                // Also add to current purchase items
                handleAddProduct(productData);
                return updatedProducts;
              });
              setIsProductModalOpen(false);
              setNewProductForm({
                name: '',
                barcode: '',
                purchasePrice: 0,
                price: 0,
                stock: 0,
                minStock: 5,
                category: '',
                itemType: 'sellable'
              });
            }} className="p-8">
              <div className="flex justify-between items-center mb-8">
                <h2 className="text-2xl font-black">إضافة منتج جديد</h2>
                <button type="button" onClick={() => setIsProductModalOpen(false)} className="p-2 hover:bg-stone-100 rounded-full">
                  <Plus className="w-6 h-6 rotate-45" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-stone-500 mb-2">اسم المنتج</label>
                  <input 
                    name="name" 
                    required 
                    value={newProductForm.name}
                    onChange={(e) => setNewProductForm({ ...newProductForm, name: e.target.value })}
                    className="w-full p-3 bg-stone-50 border border-stone-200 rounded-xl outline-none focus:ring-2 focus:ring-avocado-primary" 
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-stone-500 mb-2">الباركود</label>
                  <input 
                    name="barcode" 
                    required 
                    value={newProductForm.barcode}
                    onChange={(e) => setNewProductForm({ ...newProductForm, barcode: e.target.value })}
                    className="w-full p-3 bg-stone-50 border border-stone-200 rounded-xl outline-none focus:ring-2 focus:ring-avocado-primary" 
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-stone-500 mb-2">سعر الشراء ({settings.currencySymbol})</label>
                    <input 
                      name="purchasePrice" 
                      type="number" 
                      step="0.01" 
                      required 
                      value={newProductForm.purchasePrice || ''}
                      onChange={(e) => setNewProductForm({ ...newProductForm, purchasePrice: parseFloat(e.target.value) || 0 })}
                      className="w-full p-3 bg-stone-50 border border-stone-200 rounded-xl outline-none focus:ring-2 focus:ring-avocado-primary" 
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-stone-500 mb-2">سعر البيع ({settings.currencySymbol})</label>
                    <input 
                      name="price" 
                      type="number" 
                      step="0.01" 
                      required 
                      value={newProductForm.price || ''}
                      onChange={(e) => setNewProductForm({ ...newProductForm, price: parseFloat(e.target.value) || 0 })}
                      className="w-full p-3 bg-stone-50 border border-stone-200 rounded-xl outline-none focus:ring-2 focus:ring-avocado-primary" 
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-stone-500 mb-2">المخزون الحالي</label>
                    <input 
                      name="stock" 
                      type="number" 
                      value={newProductForm.stock || ''}
                      onChange={(e) => setNewProductForm({ ...newProductForm, stock: parseInt(e.target.value) || 0 })}
                      required 
                      className="w-full p-3 bg-stone-50 border border-stone-200 rounded-xl outline-none focus:ring-2 focus:ring-avocado-primary" 
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-stone-500 mb-2">حد التنبيه</label>
                    <input 
                      name="minStock" 
                      type="number" 
                      value={newProductForm.minStock || ''}
                      onChange={(e) => setNewProductForm({ ...newProductForm, minStock: parseInt(e.target.value) || 0 })}
                      required 
                      className="w-full p-3 bg-stone-50 border border-stone-200 rounded-xl outline-none focus:ring-2 focus:ring-avocado-primary" 
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-bold text-stone-500 mb-2">نوع الصنف</label>
                  <select
                    name="itemType"
                    value={newProductForm.itemType}
                    onChange={(e) => setNewProductForm({ ...newProductForm, itemType: e.target.value as 'sellable' | 'internal' })}
                    className="w-full p-3 bg-stone-50 border border-stone-200 rounded-xl outline-none focus:ring-2 focus:ring-avocado-primary"
                  >
                    <option value="sellable">صنف يباع في الكاشير</option>
                    <option value="internal">عنصر مخزون داخلي (لا يباع)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-stone-500 mb-2">التصنيف</label>
                  <input 
                    name="category" 
                    required 
                    value={newProductForm.category}
                    onChange={(e) => setNewProductForm({ ...newProductForm, category: e.target.value })}
                    className="w-full p-3 bg-stone-50 border border-stone-200 rounded-xl outline-none focus:ring-2 focus:ring-avocado-primary" 
                    placeholder="مثال: مشروبات" 
                  />
                </div>
              </div>

              <div className="mt-8 flex gap-4">
                <button type="submit" className="flex-1 bg-avocado-btn text-white py-3 rounded-xl font-black hover:bg-avocado-primary transition-all">حفظ المنتج</button>
                <button type="button" onClick={() => setIsProductModalOpen(false)} className="flex-1 bg-stone-100 text-stone-600 py-3 rounded-xl font-black hover:bg-stone-200 transition-all">إلغاء</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
