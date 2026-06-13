import React, { useState } from 'react';
import { Plus, Edit2, Trash2, Search, Building2, Phone, MapPin, ArrowUpRight, ArrowDownLeft, History, DollarSign, X } from 'lucide-react';
import { Supplier, SupplierTransaction, User } from '../types';
import { db } from '../firebase';
import { collection, doc, setDoc, deleteDoc } from 'firebase/firestore';

interface SuppliersProps {
  suppliers: Supplier[];
  setSuppliers: React.Dispatch<React.SetStateAction<Supplier[]>>;
  transactions: SupplierTransaction[];
  setTransactions: React.Dispatch<React.SetStateAction<SupplierTransaction[]>>;
  currentUser: User | null;
}

export function Suppliers({ suppliers, setSuppliers, transactions, setTransactions, currentUser }: SuppliersProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isTransactionModalOpen, setIsTransactionModalOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [showToast, setShowToast] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    address: '',
    notes: '',
    initialBalance: '0'
  });

  const [transactionData, setTransactionData] = useState({
    type: 'Payment' as 'Payment' | 'Receipt',
    amount: '',
    notes: ''
  });

  const filteredSuppliers = suppliers.filter(s => 
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (s.phone && s.phone.includes(searchTerm))
  );

  const calculateBalance = (supplierId: string, initialBalance: number) => {
    const supplierTransactions = transactions.filter(t => t.supplierId === supplierId);
    const transactionSum = supplierTransactions.reduce((sum, t) => {
      if (t.type === 'Payment') return sum - t.amount;
      if (t.type === 'Receipt') return sum + t.amount;
      if (t.type === 'Purchase') return sum + t.amount;
      return sum;
    }, 0);
    return initialBalance + transactionSum;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const initialBal = parseFloat(formData.initialBalance) || 0;
    
    try {
      if (editingSupplier) {
        const updatedSupplier: Supplier = { 
          ...editingSupplier, 
          ...formData, 
          initialBalance: initialBal,
          balance: calculateBalance(editingSupplier.id, initialBal)
        };
        await setDoc(doc(db, 'suppliers', editingSupplier.id), updatedSupplier);
        setShowToast('تم تحديث بيانات المورد بنجاح');
      } else {
        const id = Date.now().toString();
        const newSupplier: Supplier = {
          id,
          name: formData.name,
          phone: formData.phone,
          email: formData.email,
          address: formData.address,
          notes: formData.notes,
          initialBalance: initialBal,
          balance: initialBal,
          createdAt: new Date().toISOString()
        };
        await setDoc(doc(db, 'suppliers', id), newSupplier);
        setShowToast('تمت إضافة المورد بنجاح');
      }
      
      setIsModalOpen(false);
      setEditingSupplier(null);
      setFormData({ name: '', phone: '', email: '', address: '', notes: '', initialBalance: '0' });
    } catch (error) {
      console.error("Error saving supplier:", error);
      setShowToast('حدث خطأ أثناء حفظ البيانات');
    }
    setTimeout(() => setShowToast(null), 3000);
  };

  const handleTransactionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSupplier) return;

    const amount = parseFloat(transactionData.amount);
    if (isNaN(amount) || amount <= 0) return;

    try {
      const transactionId = Date.now().toString();
      const newTransaction: SupplierTransaction = {
        id: transactionId,
        supplierId: selectedSupplier.id,
        type: transactionData.type,
        amount,
        date: new Date().toISOString(),
        notes: transactionData.notes,
        userId: currentUser?.id || 'unknown',
        userName: currentUser?.name || 'غير معروف'
      };

      await setDoc(doc(db, 'supplierTransactions', transactionId), newTransaction);
      
      const newBalance = selectedSupplier.balance + (transactionData.type === 'Receipt' ? amount : -amount);
      await setDoc(doc(db, 'suppliers', selectedSupplier.id), { ...selectedSupplier, balance: newBalance });

      setIsTransactionModalOpen(false);
      setTransactionData({ type: 'Payment', amount: '', notes: '' });
      setShowToast('تم تسجيل العملية بنجاح');
    } catch (error) {
      console.error("Error saving transaction:", error);
      setShowToast('حدث خطأ أثناء تسجيل العملية');
    }
    setTimeout(() => setShowToast(null), 3000);
  };

  const handleDelete = async (id: string) => {
    if (confirm('هل أنت متأكد من حذف هذا المورد؟')) {
      try {
        await deleteDoc(doc(db, 'suppliers', id));
        setShowToast('تم حذف المورد بنجاح');
      } catch (error) {
        console.error("Error deleting supplier:", error);
        setShowToast('حدث خطأ أثناء الحذف');
      }
      setTimeout(() => setShowToast(null), 3000);
    }
  };

  const openEditModal = (supplier: Supplier) => {
    setEditingSupplier(supplier);
    setFormData({
      name: supplier.name,
      phone: supplier.phone || '',
      email: supplier.email || '',
      address: supplier.address || '',
      notes: supplier.notes || '',
      initialBalance: (supplier.initialBalance || 0).toString()
    });
    setIsModalOpen(true);
  };

  const openTransactionModal = (supplier: Supplier, type: 'Payment' | 'Receipt') => {
    setSelectedSupplier(supplier);
    setTransactionData({ ...transactionData, type });
    setIsTransactionModalOpen(true);
  };

  const openHistoryModal = (supplier: Supplier) => {
    setSelectedSupplier(supplier);
    setIsHistoryModalOpen(true);
  };

  return (
    <div className="space-y-6">
      {showToast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 bg-stone-800 text-white px-6 py-3 rounded-2xl shadow-2xl z-50 animate-fade-in">
          {showToast}
        </div>
      )}

      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-black text-stone-800 flex items-center gap-3">
          <Building2 className="w-8 h-8 text-avocado-primary" />
          إدارة الموردين
        </h2>
        <button 
          onClick={() => {
            setEditingSupplier(null);
            setFormData({ name: '', phone: '', email: '', address: '', notes: '', initialBalance: '0' });
            setIsModalOpen(true);
          }}
          className="bg-avocado-btn text-white px-6 py-3 rounded-2xl font-bold flex items-center gap-2 hover:bg-avocado-primary transition-all shadow-lg shadow-avocado-light"
        >
          <Plus className="w-5 h-5" />
          إضافة مورد
        </button>
      </div>

      <div className="bg-white rounded-3xl p-6 shadow-sm border border-stone-100">
        <div className="relative mb-6">
          <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-stone-400" />
          <input 
            type="text"
            placeholder="البحث عن مورد (الاسم، رقم الهاتف)..."
            className="w-full bg-stone-50 border-none rounded-2xl py-4 pr-12 pl-4 outline-none focus:ring-2 focus:ring-avocado-primary transition-all"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredSuppliers.map(supplier => (
            <div key={supplier.id} className="bg-stone-50 rounded-3xl p-6 border border-stone-100 hover:border-avocado-primary/20 transition-all group">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-lg font-black text-stone-800">{supplier.name}</h3>
                  <div className={`text-sm font-bold mt-1 ${supplier.balance > 0 ? 'text-red-500' : supplier.balance < 0 ? 'text-green-600' : 'text-stone-400'}`}>
                    الرصيد: {Math.abs(supplier.balance).toFixed(2)} {supplier.balance > 0 ? '(له)' : supplier.balance < 0 ? '(عليه)' : ''}
                  </div>
                </div>
                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => openEditModal(supplier)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-xl transition-colors">
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button onClick={() => handleDelete(supplier.id)} className="p-2 text-red-600 hover:bg-red-50 rounded-xl transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              
              <div className="space-y-3 text-sm text-stone-600 mb-6">
                {supplier.phone && (
                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4 text-stone-400" />
                    <span dir="ltr">{supplier.phone}</span>
                  </div>
                )}
                {supplier.address && (
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-stone-400" />
                    <span>{supplier.address}</span>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-3 gap-2">
                <button 
                  onClick={() => openTransactionModal(supplier, 'Payment')}
                  className="flex flex-col items-center gap-1 p-2 bg-red-50 text-red-600 rounded-xl hover:bg-red-100 transition-colors"
                  title="صرف للمورد"
                >
                  <ArrowUpRight className="w-4 h-4" />
                  <span className="text-[10px] font-bold">صرف</span>
                </button>
                <button 
                  onClick={() => openTransactionModal(supplier, 'Receipt')}
                  className="flex flex-col items-center gap-1 p-2 bg-green-50 text-green-600 rounded-xl hover:bg-green-100 transition-colors"
                  title="قبض من المورد"
                >
                  <ArrowDownLeft className="w-4 h-4" />
                  <span className="text-[10px] font-bold">قبض</span>
                </button>
                <button 
                  onClick={() => openHistoryModal(supplier)}
                  className="flex flex-col items-center gap-1 p-2 bg-stone-100 text-stone-600 rounded-xl hover:bg-stone-200 transition-colors"
                  title="سجل العمليات"
                >
                  <History className="w-4 h-4" />
                  <span className="text-[10px] font-bold">سجل</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Supplier Form Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-stone-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="p-6 border-b border-stone-100 flex justify-between items-center bg-stone-50">
              <h3 className="text-xl font-black text-stone-800">
                {editingSupplier ? 'تعديل بيانات المورد' : 'إضافة مورد جديد'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-stone-200 rounded-full transition-colors">
                <X className="w-5 h-5 text-stone-500" />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[70vh] overflow-y-auto no-scrollbar">
              <div>
                <label className="block text-sm font-bold text-stone-700 mb-2">اسم المورد *</label>
                <input 
                  type="text"
                  required
                  className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-avocado-primary"
                  value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-stone-700 mb-2">رقم الهاتف</label>
                  <input 
                    type="tel"
                    dir="ltr"
                    className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-avocado-primary text-right"
                    value={formData.phone}
                    onChange={e => setFormData({...formData, phone: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-stone-700 mb-2">الرصيد الافتتاحي</label>
                  <input 
                    type="number"
                    step="0.01"
                    className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-avocado-primary"
                    value={formData.initialBalance}
                    onChange={e => setFormData({...formData, initialBalance: e.target.value})}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-stone-700 mb-2">البريد الإلكتروني</label>
                <input 
                  type="email"
                  dir="ltr"
                  className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-avocado-primary text-right"
                  value={formData.email}
                  onChange={e => setFormData({...formData, email: e.target.value})}
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-stone-700 mb-2">العنوان</label>
                <input 
                  type="text"
                  className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-avocado-primary"
                  value={formData.address}
                  onChange={e => setFormData({...formData, address: e.target.value})}
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-stone-700 mb-2">ملاحظات</label>
                <textarea 
                  className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-avocado-primary resize-none h-24"
                  value={formData.notes}
                  onChange={e => setFormData({...formData, notes: e.target.value})}
                ></textarea>
              </div>

              <div className="flex gap-3 pt-4">
                <button 
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 px-4 py-3 bg-stone-100 text-stone-700 rounded-xl font-bold hover:bg-stone-200 transition-all"
                >
                  إلغاء
                </button>
                <button 
                  type="submit"
                  className="flex-1 px-4 py-3 bg-avocado-btn text-white rounded-xl font-bold hover:bg-avocado-primary transition-all shadow-lg shadow-avocado-light"
                >
                  {editingSupplier ? 'حفظ التعديلات' : 'إضافة المورد'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Transaction Modal */}
      {isTransactionModalOpen && selectedSupplier && (
        <div className="fixed inset-0 bg-stone-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="p-6 border-b border-stone-100 flex justify-between items-center bg-stone-50">
              <h3 className="text-xl font-black text-stone-800">
                {transactionData.type === 'Payment' ? 'صرف للمورد' : 'قبض من المورد'}
              </h3>
              <button onClick={() => setIsTransactionModalOpen(false)} className="p-2 hover:bg-stone-200 rounded-full transition-colors">
                <X className="w-5 h-5 text-stone-500" />
              </button>
            </div>
            
            <form onSubmit={handleTransactionSubmit} className="p-6 space-y-4">
              <div className="bg-stone-50 p-4 rounded-2xl border border-stone-100 mb-4">
                <div className="text-sm text-stone-500 mb-1">المورد:</div>
                <div className="font-black text-stone-800">{selectedSupplier.name}</div>
              </div>

              <div>
                <label className="block text-sm font-bold text-stone-700 mb-2">المبلغ *</label>
                <div className="relative">
                  <DollarSign className="absolute right-4 top-1/2 -translate-y-1/2 text-stone-400 w-5 h-5" />
                  <input 
                    type="number"
                    step="0.01"
                    required
                    autoFocus
                    className="w-full bg-stone-50 border border-stone-200 rounded-xl pr-12 pl-4 py-4 text-2xl font-black outline-none focus:ring-2 focus:ring-avocado-primary"
                    value={transactionData.amount}
                    onChange={e => setTransactionData({...transactionData, amount: e.target.value})}
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-stone-700 mb-2">ملاحظات / رقم السند</label>
                <input 
                  type="text"
                  className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-avocado-primary"
                  value={transactionData.notes}
                  onChange={e => setTransactionData({...transactionData, notes: e.target.value})}
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button 
                  type="button"
                  onClick={() => setIsTransactionModalOpen(false)}
                  className="flex-1 px-4 py-3 bg-stone-100 text-stone-700 rounded-xl font-bold hover:bg-stone-200 transition-all"
                >
                  إلغاء
                </button>
                <button 
                  type="submit"
                  className={`flex-1 px-4 py-3 text-white rounded-xl font-bold transition-all shadow-lg ${
                    transactionData.type === 'Payment' ? 'bg-red-500 hover:bg-red-600 shadow-red-100' : 'bg-green-500 hover:bg-green-600 shadow-green-100'
                  }`}
                >
                  تأكيد العملية
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* History Modal */}
      {isHistoryModalOpen && selectedSupplier && (
        <div className="fixed inset-0 bg-stone-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-stone-100 flex justify-between items-center bg-stone-50">
              <div>
                <h3 className="text-xl font-black text-stone-800">سجل عمليات المورد</h3>
                <p className="text-sm text-stone-500">{selectedSupplier.name}</p>
              </div>
              <button onClick={() => setIsHistoryModalOpen(false)} className="p-2 hover:bg-stone-200 rounded-full transition-colors">
                <X className="w-5 h-5 text-stone-500" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 space-y-4 no-scrollbar">
              <div className="bg-stone-50 p-4 rounded-2xl border border-stone-100 flex justify-between items-center">
                <span className="font-bold text-stone-600">الرصيد الافتتاحي</span>
                <span className="font-black text-stone-800">{(selectedSupplier.initialBalance || 0).toFixed(2)}</span>
              </div>

              {transactions.filter(t => t.supplierId === selectedSupplier.id).length > 0 ? (
                <div className="space-y-3">
                  {transactions
                    .filter(t => t.supplierId === selectedSupplier.id)
                    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                    .map(t => (
                      <div key={t.id} className="bg-white p-4 rounded-2xl border border-stone-100 flex justify-between items-center hover:border-stone-200 transition-all">
                        <div className="flex items-center gap-4">
                          <div className={`p-2 rounded-xl ${
                            t.type === 'Payment' ? 'bg-red-50 text-red-600' : 
                            t.type === 'Receipt' ? 'bg-green-50 text-green-600' : 
                            'bg-blue-50 text-blue-600'
                          }`}>
                            {t.type === 'Payment' ? <ArrowUpRight className="w-5 h-5" /> : 
                             t.type === 'Receipt' ? <ArrowDownLeft className="w-5 h-5" /> : 
                             <Building2 className="w-5 h-5" />}
                          </div>
                          <div>
                            <div className="font-bold text-stone-800">
                              {t.type === 'Payment' ? 'صرف' : t.type === 'Receipt' ? 'قبض' : 'مشتريات'}
                              {t.notes && <span className="text-stone-400 font-normal mr-2 text-xs">- {t.notes}</span>}
                            </div>
                            <div className="text-[10px] text-stone-400">
                              {new Date(t.date).toLocaleString('ar-EG')} • بواسطة: {t.userName}
                            </div>
                          </div>
                        </div>
                        <div className={`font-black text-lg ${
                          t.type === 'Payment' ? 'text-red-600' : 
                          t.type === 'Receipt' ? 'text-green-600' : 
                          'text-blue-600'
                        }`}>
                          {t.type === 'Payment' ? '-' : '+'}{t.amount.toFixed(2)}
                        </div>
                      </div>
                    ))}
                </div>
              ) : (
                <div className="text-center py-12 text-stone-300">لا توجد عمليات مسجلة لهذا المورد</div>
              )}
            </div>

            <div className="p-6 border-t border-stone-100 bg-stone-50 flex justify-between items-center">
              <span className="font-bold text-stone-600">إجمالي الرصيد الحالي:</span>
              <span className={`text-2xl font-black ${selectedSupplier.balance > 0 ? 'text-red-600' : selectedSupplier.balance < 0 ? 'text-green-600' : 'text-stone-800'}`}>
                {Math.abs(selectedSupplier.balance).toFixed(2)} {selectedSupplier.balance > 0 ? '(له)' : selectedSupplier.balance < 0 ? '(عليه)' : ''}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
