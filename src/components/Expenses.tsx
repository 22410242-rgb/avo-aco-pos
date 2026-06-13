import React, { useState, useRef } from 'react';
import { Plus, Edit2, Trash2, Search, Filter, Calendar, User as UserIcon, Tag, FileText, DollarSign, Download } from 'lucide-react';
import { Expense, ExpenseCategory, User, SystemSettings } from '../types';
import { db } from '../firebase';
import { doc, setDoc, deleteDoc } from 'firebase/firestore';

interface ExpensesProps {
  expenses: Expense[];
  setExpenses: React.Dispatch<React.SetStateAction<Expense[]>>;
  currentUser: User | null;
  users: User[];
  settings: SystemSettings;
}

const EXPENSE_CATEGORIES: ExpenseCategory[] = [
  'إيجار', 'كهرباء', 'إنترنت', 'رواتب', 'صيانة', 'مشتريات صغيرة', 'أخرى'
];

export function Expenses({ expenses, setExpenses, currentUser, users, settings }: ExpensesProps) {
  const expensesRef = useRef<HTMLDivElement>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [showToast, setShowToast] = useState<string | null>(null);

  // Filters
  const [filterDate, setFilterDate] = useState('');
  const [filterUser, setFilterUser] = useState('');
  const [filterCategory, setFilterCategory] = useState('');

  const [formData, setFormData] = useState({
    title: '',
    category: 'أخرى' as ExpenseCategory,
    amount: '',
    date: new Date().toISOString().split('T')[0],
    notes: ''
  });

  const filteredExpenses = expenses.filter(e => {
    const matchesSearch = e.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          (e.notes && e.notes.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesDate = filterDate ? e.date.startsWith(filterDate) : true;
    const matchesUser = filterUser ? e.userId === filterUser : true;
    const matchesCategory = filterCategory ? e.category === filterCategory : true;
    
    return matchesSearch && matchesDate && matchesUser && matchesCategory;
  });

  const totalFilteredAmount = filteredExpenses.reduce((sum, e) => sum + e.amount, 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;

    try {
      if (editingExpense) {
        const updatedExpense: Expense = {
          ...editingExpense,
          ...formData,
          amount: parseFloat(formData.amount)
        };
        await setDoc(doc(db, 'expenses', editingExpense.id), updatedExpense);
        setShowToast('تم تحديث المصروف بنجاح');
      } else {
        const id = Date.now().toString();
        const newExpense: Expense = {
          id,
          ...formData,
          amount: parseFloat(formData.amount),
          userId: currentUser.id,
          createdAt: new Date().toISOString()
        };
        await setDoc(doc(db, 'expenses', id), newExpense);
        setShowToast('تمت إضافة المصروف بنجاح');
      }
      
      setIsModalOpen(false);
      setEditingExpense(null);
      setFormData({
        title: '',
        category: 'أخرى',
        amount: '',
        date: new Date().toISOString().split('T')[0],
        notes: ''
      });
    } catch (error) {
      console.error("Error saving expense:", error);
      setShowToast('حدث خطأ أثناء حفظ المصروف');
    }
    setTimeout(() => setShowToast(null), 3000);
  };

  const handleDelete = async (id: string) => {
    if (confirm('هل أنت متأكد من حذف هذا المصروف؟')) {
      try {
        await deleteDoc(doc(db, 'expenses', id));
        setShowToast('تم حذف المصروف بنجاح');
      } catch (error) {
        console.error("Error deleting expense:", error);
        setShowToast('حدث خطأ أثناء حذف المصروف');
      }
      setTimeout(() => setShowToast(null), 3000);
    }
  };

  const openEditModal = (expense: Expense) => {
    setEditingExpense(expense);
    setFormData({
      title: expense.title,
      category: expense.category,
      amount: expense.amount.toString(),
      date: expense.date,
      notes: expense.notes || ''
    });
    setIsModalOpen(true);
  };

  const getUserName = (userId: string) => {
    return users.find(u => u.id === userId)?.name || 'مستخدم غير معروف';
  };

  return (
    <div className="p-6 max-w-7xl mx-auto" dir="rtl" ref={expensesRef}>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800">إدارة المصروفات</h1>
        <button
          onClick={() => {
            setEditingExpense(null);
            setFormData({
              title: '',
              category: 'أخرى',
              amount: '',
              date: new Date().toISOString().split('T')[0],
              notes: ''
            });
            setIsModalOpen(true);
          }}
          className="bg-avocado-btn text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-avocado-primary transition-colors"
        >
          <Plus size={20} />
          <span>إضافة مصروف</span>
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="بحث في المصروفات..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-4 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-avocado-primary focus:border-avocado-primary"
            />
          </div>
          
          <div className="relative">
            <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="date"
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
              className="w-full pl-4 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-avocado-primary focus:border-avocado-primary"
            />
          </div>

          <div className="relative">
            <Tag className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="w-full pl-4 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-avocado-primary focus:border-avocado-primary appearance-none"
            >
              <option value="">جميع التصنيفات</option>
              {EXPENSE_CATEGORIES.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          <div className="relative">
            <UserIcon className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <select
              value={filterUser}
              onChange={(e) => setFilterUser(e.target.value)}
              className="w-full pl-4 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-avocado-primary focus:border-avocado-primary appearance-none"
            >
              <option value="">جميع المستخدمين</option>
              {users
                .filter(u => u.email !== 'mohammadalmasri950@gmail.com')
                .map(user => (
                <option key={user.id} value={user.id}>{user.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Summary */}
      <div className="bg-avocado-light p-4 rounded-xl border border-avocado-primary/10 mb-6 flex items-center justify-between print:hidden">
        <div>
          <h3 className="text-avocado-secondary font-medium">إجمالي المصروفات المعروضة</h3>
          <p className="text-2xl font-bold text-avocado-primary mt-1">{(totalFilteredAmount || 0).toFixed(2)} {settings.currencySymbol}</p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => {
              const data = filteredExpenses.map(e => ({
                'التاريخ': new Date(e.date).toLocaleDateString('ar-EG'),
                'العنوان': e.title,
                'التصنيف': e.category,
                'المبلغ': (e.amount || 0).toFixed(2),
                'المستخدم': getUserName(e.userId),
                'ملاحظات': e.notes || ''
              }));
              
              if (data.length === 0) return;
              const headers = Object.keys(data[0]).join(',');
              const rows = data.map(obj => Object.values(obj).map(val => `"${val}"`).join(',')).join('\n');
              const csv = `${headers}\n${rows}`;
              const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
              const link = document.createElement('a');
              link.href = URL.createObjectURL(blob);
              link.download = `expenses_report_${new Date().toISOString().split('T')[0]}.csv`;
              link.click();
            }} 
            className="flex items-center gap-2 px-4 py-2 bg-white text-avocado-primary rounded-full hover:bg-avocado-primary/5 font-bold transition-all border border-avocado-primary/10 shadow-sm"
          >
            <Download className="w-4 h-4" />
            تصدير Excel
          </button>
        </div>
      </div>

      {/* Expenses List */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="p-4 font-semibold text-gray-600">التاريخ</th>
                <th className="p-4 font-semibold text-gray-600">العنوان</th>
                <th className="p-4 font-semibold text-gray-600">التصنيف</th>
                <th className="p-4 font-semibold text-gray-600">المبلغ</th>
                <th className="p-4 font-semibold text-gray-600">المستخدم</th>
                <th className="p-4 font-semibold text-gray-600">ملاحظات</th>
                <th className="p-4 font-semibold text-gray-600 text-center">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredExpenses.map((expense) => (
                <tr key={expense.id} className="hover:bg-gray-50 transition-colors">
                  <td className="p-4 text-gray-800 whitespace-nowrap">{expense.date}</td>
                  <td className="p-4 text-gray-800 font-medium">{expense.title}</td>
                  <td className="p-4">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                      {expense.category}
                    </span>
                  </td>
                  <td className="p-4 text-gray-800 font-bold text-red-600">{(expense.amount || 0).toFixed(2)} {settings.currencySymbol}</td>
                  <td className="p-4 text-gray-600">{getUserName(expense.userId)}</td>
                  <td className="p-4 text-gray-500 text-sm max-w-xs truncate" title={expense.notes}>{expense.notes || '-'}</td>
                  <td className="p-4">
                    <div className="flex justify-center gap-2">
                      <button
                        onClick={() => openEditModal(expense)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="تعديل"
                      >
                        <Edit2 size={18} />
                      </button>
                      <button
                        onClick={() => handleDelete(expense.id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="حذف"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredExpenses.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-gray-500">
                    لا توجد مصروفات مطابقة للبحث
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-xl">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h2 className="text-xl font-bold text-gray-800">
                {editingExpense ? 'تعديل مصروف' : 'إضافة مصروف جديد'}
              </h2>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  عنوان المصروف *
                </label>
                <input
                  type="text"
                  required
                  value={formData.title}
                  onChange={(e) => setFormData({...formData, title: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-avocado-primary focus:border-avocado-primary"
                  placeholder="مثال: فاتورة كهرباء شهر 3"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    المبلغ *
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      required
                      min="0.01"
                      step="0.01"
                      value={formData.amount}
                      onChange={(e) => setFormData({...formData, amount: e.target.value})}
                      className="w-full pl-8 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-avocado-primary focus:border-avocado-primary"
                    />
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">{settings.currencySymbol}</span>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    التاريخ *
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.date}
                    onChange={(e) => setFormData({...formData, date: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-avocado-primary focus:border-avocado-primary"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  التصنيف *
                </label>
                <select
                  required
                  value={formData.category}
                  onChange={(e) => setFormData({...formData, category: e.target.value as ExpenseCategory})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-avocado-primary focus:border-avocado-primary appearance-none"
                >
                  {EXPENSE_CATEGORIES.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  ملاحظات
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({...formData, notes: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-avocado-primary focus:border-avocado-primary h-24 resize-none"
                  placeholder="أي تفاصيل إضافية..."
                />
              </div>

              <div className="pt-4 flex gap-3">
                <button
                  type="submit"
                  className="flex-1 bg-avocado-btn text-white py-2 rounded-lg hover:bg-avocado-primary transition-colors font-medium"
                >
                  {editingExpense ? 'حفظ التعديلات' : 'إضافة المصروف'}
                </button>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 bg-gray-100 text-gray-700 py-2 rounded-lg hover:bg-gray-200 transition-colors font-medium"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {showToast && (
        <div className="fixed bottom-4 left-4 bg-gray-800 text-white px-6 py-3 rounded-lg shadow-lg z-50 animate-fade-in">
          {showToast}
        </div>
      )}
    </div>
  );
}
