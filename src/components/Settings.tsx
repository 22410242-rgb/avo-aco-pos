import React, { useState, useEffect } from 'react';
import { 
  Settings as SettingsIcon, Store, DollarSign, FileText, 
  Printer, Shield, Database, Save, Download, Upload, 
  History, Lock, User, CheckCircle2, AlertTriangle, RefreshCw
} from 'lucide-react';
import { SystemSettings, AuditLog, User as UserType } from '../types';

import { qzService } from '../services/qzService';

export interface SettingsProps {
  settings: SystemSettings;
  onUpdateSettings: (updates: Partial<SystemSettings>) => Promise<void>;
  users: UserType[];
  currentUser: UserType | null;
  onResetFinancial: () => Promise<void>;
  products: any[];
  categories: any[];
}

type SettingsTab = 'store' | 'currency' | 'invoice' | 'printer' | 'security' | 'backup' | 'maintenance';

export default function Settings({ settings, onUpdateSettings, users, currentUser, onResetFinancial, products, categories }: SettingsProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>('store');
  const [formSettings, setFormSettings] = useState<SystemSettings>(settings);
  const [isSaving, setIsSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const [showResetFinancialModal, setShowResetFinancialModal] = useState(false);
  const [resetPassword, setResetPassword] = useState('');
  const [resetError, setResetError] = useState('');
  const [isResetting, setIsResetting] = useState(false);
  const [newInvoiceNumber, setNewInvoiceNumber] = useState('');

  useEffect(() => {
    setFormSettings(settings);
  }, [settings]);

  const handleUpdateInvoiceNumber = () => {
    if (!newInvoiceNumber || isNaN(parseInt(newInvoiceNumber))) {
      alert('يرجى إدخال رقم فاتورة صحيح');
      return;
    }
    localStorage.setItem('last_global_invoice_number', (parseInt(newInvoiceNumber) - 1).toString());
    alert('تم تحديث رقم الفاتورة التالي إلى: ' + newInvoiceNumber + '\nيرجى تحديث الصفحة (Refresh) لتطبيق التغيير.');
    setNewInvoiceNumber('');
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onUpdateSettings(formSettings);
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    } catch (error) {
      console.error('Error saving settings:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleBackup = () => {
    try {
      const backupData = {
        PRODUCTS: JSON.stringify(products),
        CATEGORIES: JSON.stringify(categories),
        SETTINGS: JSON.stringify(settings),
        USERS: JSON.stringify(users),
        backupDate: new Date().toISOString()
      };

      const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `pos_backup_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Backup error:', error);
      alert('خطأ في إنشاء النسخة الاحتياطية');
    }
  };

  const handleRestore = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!confirm('هل أنت متأكد من استعادة البيانات؟ سيتم مسح جميع البيانات الحالية.')) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        
        let productsCount = 0;
        let categoriesCount = 0;

        // Note: Full restore to Firebase from the frontend requires multiple DB calls.
        // We will notify the user this might take time.
        alert('ميزة استعادة البيانات الكاملة قيد التطوير للنسخة السحابية المحدثة. نعتذر عن الإزعاج.');

      } catch (error) {
        console.error('Restore error:', error);
        alert('خطأ في قراءة ملف النسخة الاحتياطية');
      }
    };
    reader.readAsText(file);
  };

  const handlePasswordChange = (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError('كلمات المرور غير متطابقة');
      return;
    }

    // In local system, we don't have a real password change for the hardcoded admin
    // But we can simulate it or just show a message
    alert('في النسخة المحلية، يتم استخدام بيانات الدخول الثابتة (admin@pos.com / admin123)');
    setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
  };

  const tabs: { id: SettingsTab; label: string; icon: any }[] = [
    { id: 'store', label: 'المتجر', icon: Store },
    { id: 'currency', label: 'العملة', icon: DollarSign },
    { id: 'invoice', label: 'الفاتورة', icon: FileText },
    { id: 'printer', label: 'الطابعة', icon: Printer },
    { id: 'security', label: 'الأمان', icon: Shield },
    { id: 'backup', label: 'النسخ الاحتياطي', icon: Database },
    { id: 'maintenance', label: 'صيانة النظام', icon: RefreshCw }
  ];

  const handleResetFinancialClick = async () => {
    if (resetPassword !== '123456') {
      setResetError('كلمة السر غير صحيحة');
      return;
    }

    setIsResetting(true);
    await onResetFinancial();
    setIsResetting(false);
    setShowResetFinancialModal(false);
    setResetPassword('');
  };

  return (
    <div className="flex flex-col h-full bg-stone-50">
      <div className="p-4 md:p-6 border-b border-stone-200 bg-white flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-stone-900 text-white rounded-xl">
            <SettingsIcon className="w-5 h-5 md:w-6 md:h-6" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-black text-stone-900">إعدادات النظام</h1>
            <p className="text-stone-500 text-[10px] md:text-sm">تخصيص النظام والتحكم في الإعدادات العامة</p>
          </div>
        </div>
        
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 bg-avocado-btn text-white rounded-xl font-bold hover:bg-avocado-primary transition-all shadow-lg shadow-avocado-light disabled:opacity-50"
        >
          {isSaving ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
          حفظ الإعدادات
        </button>
      </div>

      <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
        {/* Sidebar Tabs */}
        <div className="w-full md:w-64 border-b md:border-b-0 md:border-l border-stone-200 bg-white p-4 flex md:flex-col gap-2 overflow-x-auto md:overflow-y-auto no-scrollbar">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-shrink-0 md:w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-all ${
                activeTab === tab.id 
                  ? 'bg-stone-900 text-white shadow-md' 
                  : 'text-stone-600 hover:bg-stone-100'
              }`}
            >
              <tab.icon className="w-5 h-5" />
              <span className="whitespace-nowrap">{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8">
          {showSuccess && (
            <div className="mb-6 p-4 bg-avocado-light border border-avocado-primary/20 text-avocado-secondary rounded-2xl flex items-center gap-3 animate-in fade-in slide-in-from-top-4">
              <CheckCircle2 className="w-5 h-5" />
              <span className="font-bold">تم حفظ الإعدادات بنجاح!</span>
            </div>
          )}

          <div className="max-w-3xl bg-white border border-stone-200 rounded-2xl md:rounded-3xl shadow-sm p-5 md:p-8">
            {activeTab === 'store' && (
              <div className="space-y-6">
                <h2 className="text-xl font-black text-stone-900 flex items-center gap-2 mb-6">
                  <Store className="w-6 h-6 text-stone-400" />
                  إعدادات المتجر
                </h2>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-stone-600">اسم المتجر</label>
                    <input
                      type="text"
                      value={formSettings.storeName || ''}
                      onChange={e => setFormSettings({ ...formSettings, storeName: e.target.value })}
                      className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-avocado-primary outline-none transition-all"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-stone-600">شعار المتجر</label>
                    <div className="flex items-center gap-4">
                      {formSettings.storeLogo && (
                        <div className="w-16 h-16 flex items-center justify-center">
                          <img src={formSettings.storeLogo} alt="Logo" className="max-w-full max-h-full object-contain" referrerPolicy="no-referrer" />
                        </div>
                      )}
                      <div className="flex-1 space-y-2">
                        <input
                          type="text"
                          value={formSettings.storeLogo || ''}
                          onChange={e => setFormSettings({ ...formSettings, storeLogo: e.target.value })}
                          className="w-full px-4 py-2 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-avocado-primary outline-none transition-all text-sm"
                          placeholder="رابط الشعار (URL)"
                        />
                        <div className="relative">
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                const reader = new FileReader();
                                reader.onloadend = () => {
                                  setFormSettings({ ...formSettings, storeLogo: reader.result as string });
                                };
                                reader.readAsDataURL(file);
                              }
                            }}
                            className="hidden"
                            id="logo-upload"
                          />
                          <label
                            htmlFor="logo-upload"
                            className="flex items-center justify-center gap-2 px-4 py-2 bg-stone-100 text-stone-700 rounded-xl hover:bg-stone-200 transition-all cursor-pointer text-sm font-bold border border-stone-200"
                          >
                            <Upload className="w-4 h-4" />
                            رفع شعار جديد
                          </label>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-stone-600">رقم الهاتف</label>
                    <input
                      type="text"
                      value={formSettings.storePhone || ''}
                      onChange={e => setFormSettings({ ...formSettings, storePhone: e.target.value })}
                      className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-avocado-primary outline-none transition-all"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-stone-600">البريد الإلكتروني</label>
                    <input
                      type="email"
                      value={formSettings.storeEmail || ''}
                      onChange={e => setFormSettings({ ...formSettings, storeEmail: e.target.value })}
                      className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-avocado-primary outline-none transition-all"
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm font-bold text-stone-600">العنوان</label>
                  <input
                    type="text"
                    value={formSettings.storeAddress || ''}
                    onChange={e => setFormSettings({ ...formSettings, storeAddress: e.target.value })}
                    className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-avocado-primary outline-none transition-all"
                  />
                </div>
              </div>
            )}

            {activeTab === 'currency' && (
              <div className="space-y-6">
                <h2 className="text-xl font-black text-stone-900 flex items-center gap-2 mb-6">
                  <DollarSign className="w-6 h-6 text-stone-400" />
                  إعدادات العملة
                </h2>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-stone-600">اسم العملة</label>
                    <select
                      value={formSettings.currency}
                      onChange={e => setFormSettings({ ...formSettings, currency: e.target.value })}
                      className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-avocado-primary outline-none transition-all"
                    >
                      <option value="ILS">شيكل إسرائيلي (ILS)</option>
                      <option value="USD">دولار أمريكي (USD)</option>
                      <option value="JOD">دينار أردني (JOD)</option>
                      <option value="EUR">يورو (EUR)</option>
                      <option value="EGP">جنيه مصري (EGP)</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-stone-600">رمز العملة</label>
                    <input
                      type="text"
                      value={formSettings.currencySymbol || ''}
                      onChange={e => setFormSettings({ ...formSettings, currencySymbol: e.target.value })}
                      className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-avocado-primary outline-none transition-all"
                      placeholder="₪"
                    />
                  </div>
                </div>
                
                <div className="p-4 bg-stone-50 rounded-2xl border border-stone-200">
                  <p className="text-sm text-stone-500">سيتم عرض هذا الرمز بجانب جميع المبالغ المالية في النظام.</p>
                </div>
              </div>
            )}

            {activeTab === 'invoice' && (
              <div className="space-y-6">
                <h2 className="text-xl font-black text-stone-900 flex items-center gap-2 mb-6">
                  <FileText className="w-6 h-6 text-stone-400" />
                  إعدادات الفاتورة
                </h2>
                
                <div className="space-y-4">
                  <label className="flex items-center gap-3 p-4 bg-stone-50 rounded-2xl border border-stone-200 cursor-pointer hover:bg-stone-100 transition-all">
                    <input
                      type="checkbox"
                      checked={formSettings.showOrderNumber}
                      onChange={e => setFormSettings({ ...formSettings, showOrderNumber: e.target.checked })}
                      className="w-5 h-5 rounded text-stone-900 focus:ring-avocado-primary"
                    />
                    <div>
                      <span className="font-bold text-stone-900">عرض رقم الطلب</span>
                      <p className="text-xs text-stone-500">إظهار رقم الطلب التسلسلي في الفاتورة</p>
                    </div>
                  </label>

                  <label className="flex items-center gap-3 p-4 bg-stone-50 rounded-2xl border border-stone-200 cursor-pointer hover:bg-stone-100 transition-all">
                    <input
                      type="checkbox"
                      checked={formSettings.showCashierName}
                      onChange={e => setFormSettings({ ...formSettings, showCashierName: e.target.checked })}
                      className="w-5 h-5 rounded text-stone-900 focus:ring-avocado-primary"
                    />
                    <div>
                      <span className="font-bold text-stone-900">عرض اسم الكاشير</span>
                      <p className="text-xs text-stone-500">إظهار اسم الموظف الذي قام بالعملية في الفاتورة</p>
                    </div>
                  </label>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-stone-600">شكل الفاتورة</label>
                  <select
                    value={formSettings.invoiceLayout}
                    onChange={e => setFormSettings({ ...formSettings, invoiceLayout: e.target.value as any })}
                    className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-avocado-primary outline-none transition-all"
                  >
                    <option value="standard">قياسي (Standard)</option>
                    <option value="compact">مختصر (Compact)</option>
                    <option value="detailed">تفصيلي (Detailed)</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-stone-600">رسالة أسفل الفاتورة</label>
                  <textarea
                    value={formSettings.invoiceFooter || ''}
                    onChange={e => setFormSettings({ ...formSettings, invoiceFooter: e.target.value })}
                    className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-avocado-primary outline-none transition-all h-24 resize-none"
                  />
                </div>

                <div className="p-4 bg-stone-100 rounded-2xl border border-stone-200 space-y-4">
                  <h3 className="font-black text-stone-900">إعادة تعيين رقم الفاتورة</h3>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      value={newInvoiceNumber}
                      onChange={e => setNewInvoiceNumber(e.target.value)}
                      placeholder="رقم الفاتورة القادم"
                      className="flex-1 px-4 py-3 bg-white border border-stone-200 rounded-xl focus:ring-2 focus:ring-avocado-primary outline-none transition-all"
                    />
                    <button
                      onClick={handleUpdateInvoiceNumber}
                      className="px-6 py-3 bg-avocado-btn text-white rounded-xl font-bold hover:bg-avocado-primary transition-all shadow-lg"
                    >
                      تحديث
                    </button>
                  </div>
                  <p className="text-xs text-stone-500">سيتم تعيين رقم الفاتورة القادم إلى القيمة المدخلة.</p>
                </div>
              </div>
            )}

            {activeTab === 'printer' && (
              <div className="space-y-8">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-black text-stone-900 flex items-center gap-2">
                    <Printer className="w-6 h-6 text-stone-400" />
                    إعدادات الطابعات المنفصلة
                  </h2>
                </div>

                <div className="grid grid-cols-1 gap-8">
                  {/* Cashier Printer */}
                  <div className="p-6 bg-stone-50 rounded-3xl border border-stone-200 space-y-4 shadow-sm">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="p-2 bg-avocado-btn text-white rounded-xl">
                        <DollarSign className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="font-black text-stone-900">طابعة الكاشير / الفواتير</h3>
                        <p className="text-xs text-stone-500">هذه الطابعة مخصصة لطباعة فواتير العملاء</p>
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-stone-600">اسم الطابعة (كما يظهر في النظام)</label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={formSettings.receiptPrinterName || ''}
                          onChange={e => setFormSettings({ ...formSettings, receiptPrinterName: e.target.value })}
                          className="flex-1 px-4 py-3 bg-white border border-stone-200 rounded-xl focus:ring-2 focus:ring-avocado-primary outline-none transition-all font-bold"
                          placeholder="مثلاً: Cashier Printer"
                        />
                        <button
                          type="button"
                          onClick={() => window.print()}
                          className="px-4 bg-stone-100 text-stone-600 rounded-xl hover:bg-stone-200 transition-all border border-stone-200 flex items-center gap-2 text-xs font-bold"
                          title="فتح قائمة طابعات الجهاز"
                        >
                          <Printer className="w-4 h-4" />
                          استكشاف
                        </button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-bold text-stone-600">حجم الورق</label>
                      <div className="grid grid-cols-2 gap-2">
                        {['Thermal', 'A4'].map(size => (
                          <button
                            key={size}
                            type="button"
                            onClick={() => setFormSettings({ ...formSettings, invoicePaperSize: size as any })}
                            className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all ${
                              formSettings.invoicePaperSize === size 
                                ? 'bg-stone-900 text-white border-stone-900 shadow-md' 
                                : 'bg-white text-stone-600 border-stone-200 hover:border-stone-400'
                            }`}
                          >
                            {size === 'Thermal' ? 'حراري 80mm' : 'A4 قياسي'}
                          </button>
                        ))}
                      </div>
                    </div>

                    <button
                      onClick={() => {
                        // Simulate a test print for cashier
                        alert(`جاري إرسال صفحة اختبار إلى: ${formSettings.receiptPrinterName}`);
                      }}
                      className="w-full py-2 bg-white text-stone-700 rounded-xl font-bold hover:bg-stone-100 transition-all border border-stone-200 text-sm"
                    >
                      اختبار طابعة الكاشير
                    </button>
                  </div>

                  {/* Kitchen Printer */}
                  <div className="p-6 bg-stone-50 rounded-3xl border border-stone-200 space-y-4 shadow-sm">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="p-2 bg-stone-900 text-white rounded-xl">
                        <Store className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="font-black text-stone-900">طابعة المطبخ / الطلبات</h3>
                        <p className="text-xs text-stone-500">هذه الطابعة مخصصة لطباعة طلبات التحضير للمطبخ</p>
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-stone-600">اسم الطابعة (كما يظهر في النظام)</label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={formSettings.kitchenPrinterName || ''}
                          onChange={e => setFormSettings({ ...formSettings, kitchenPrinterName: e.target.value })}
                          className="flex-1 px-4 py-3 bg-white border border-stone-200 rounded-xl focus:ring-2 focus:ring-avocado-primary outline-none transition-all font-bold"
                          placeholder="مثلاً: Kitchen Printer"
                        />
                        <button
                          type="button"
                          onClick={() => window.print()}
                          className="px-4 bg-stone-100 text-stone-600 rounded-xl hover:bg-stone-200 transition-all border border-stone-200 flex items-center gap-2 text-xs font-bold"
                          title="فتح قائمة طابعات الجهاز"
                        >
                          <Printer className="w-4 h-4" />
                          استكشاف
                        </button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-bold text-stone-600">حجم الورق</label>
                      <div className="grid grid-cols-2 gap-2">
                        {['Thermal', 'A4'].map(size => (
                          <button
                            key={size}
                            type="button"
                            onClick={() => setFormSettings({ ...formSettings, kitchenPaperSize: size as any })}
                            className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all ${
                              formSettings.kitchenPaperSize === size 
                                ? 'bg-stone-900 text-white border-stone-900 shadow-md' 
                                : 'bg-white text-stone-600 border-stone-200 hover:border-stone-400'
                            }`}
                          >
                            {size === 'Thermal' ? 'حراري 80mm' : 'A4 قياسي'}
                          </button>
                        ))}
                      </div>
                    </div>

                    <button
                      onClick={() => {
                        // Simulate a test print for kitchen
                        alert(`جاري إرسال صفحة اختبار إلى: ${formSettings.kitchenPrinterName}`);
                      }}
                      className="w-full py-2 bg-white text-stone-700 rounded-xl font-bold hover:bg-stone-100 transition-all border border-stone-200 text-sm"
                    >
                      اختبار طابعة المطبخ
                    </button>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-stone-500 uppercase tracking-widest px-2">إعدادات متقدمة (QZ Tray)</h3>
                  
                  <div className="p-4 bg-stone-900 text-white rounded-2xl border border-stone-800 space-y-4">
                    <label className="flex items-center justify-between cursor-pointer">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${formSettings.useQZTray ? 'bg-avocado-primary' : 'bg-stone-700'}`}>
                          <Printer className="w-4 h-4 text-white" />
                        </div>
                        <div>
                          <span className="font-bold">تفعيل QZ Tray</span>
                          <p className="text-[10px] opacity-70">للطباعة الصامتة والمباشرة بدون نوافذ المنبثقة</p>
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={formSettings.useQZTray}
                        onChange={async (e) => {
                          const checked = e.target.checked;
                          if (checked) {
                            try {
                              await qzService.connect();
                              setFormSettings({ ...formSettings, useQZTray: true });
                            } catch (err) {
                              alert('تعذر الاتصال بـ QZ Tray. تأكد من تشغيل البرنامج على جهازك.');
                            }
                          } else {
                            setFormSettings({ ...formSettings, useQZTray: false });
                          }
                        }}
                        className="w-5 h-5 rounded accent-avocado-primary"
                      />
                    </label>

                    {formSettings.useQZTray && (
                      <div className="pt-2 border-t border-white/10">
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              const printers = await qzService.findPrinters();
                              alert('الطابعات المتوفرة: \n' + printers.join('\n'));
                            } catch (err) {
                              alert('خطأ في جلب الطابعات');
                            }
                          }}
                          className="text-xs font-bold text-avocado-primary hover:underline"
                        >
                          عرض الطابعات المتصلة بـ QZ Tray
                        </button>
                      </div>
                    )}
                  </div>

                  <h3 className="text-sm font-bold text-stone-500 uppercase tracking-widest px-2">إعدادات متقدمة (Print Service)</h3>
                  
                  <div className="p-4 bg-stone-900 text-white rounded-2xl border border-stone-800 space-y-4">
                    <div className="space-y-2">
                      <label className="text-xs font-bold opacity-70">رابط خدمة الطباعة المحلية (اختياري)</label>
                      <input
                        type="text"
                        value={formSettings.printServiceUrl || ''}
                        onChange={e => setFormSettings({ ...formSettings, printServiceUrl: e.target.value })}
                        className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-xl focus:ring-2 focus:ring-avocado-primary outline-none transition-all text-sm font-mono"
                        placeholder="http://localhost:9100/print"
                      />
                      <p className="text-[10px] opacity-50">إذا كنت تستخدم برنامج وسيط للطباعة الصامتة، أدخل الرابط هنا.</p>
                    </div>
                  </div>

                  <h3 className="text-sm font-bold text-stone-500 uppercase tracking-widest px-2">خيارات الطباعة التلقائية</h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <label className="flex items-center gap-3 p-4 bg-white rounded-2xl border border-stone-200 cursor-pointer hover:bg-stone-50 transition-all">
                      <input
                        type="checkbox"
                        checked={formSettings.autoPrintAfterPayment}
                        onChange={e => setFormSettings({ ...formSettings, autoPrintAfterPayment: e.target.checked })}
                        className="w-5 h-5 rounded text-stone-900 focus:ring-avocado-primary"
                      />
                      <div>
                        <span className="font-bold text-stone-900">طباعة الفاتورة تلقائياً</span>
                        <p className="text-[10px] text-stone-500">بعد إتمام الدفع مباشرة</p>
                      </div>
                    </label>

                    <label className="flex items-center gap-3 p-4 bg-white rounded-2xl border border-stone-200 cursor-pointer hover:bg-stone-50 transition-all">
                      <input
                        type="checkbox"
                        checked={formSettings.autoKitchenPrint}
                        onChange={e => setFormSettings({ ...formSettings, autoKitchenPrint: e.target.checked })}
                        className="w-5 h-5 rounded text-stone-900 focus:ring-avocado-primary"
                      />
                      <div>
                        <span className="font-bold text-stone-900">طباعة المطبخ تلقائياً</span>
                        <p className="text-[10px] text-stone-500">إرسال الطلب للمطبخ عند الدفع</p>
                      </div>
                    </label>
                  </div>

                  <label className="flex items-center gap-3 p-4 bg-stone-900 text-white rounded-2xl border border-stone-800 cursor-pointer hover:bg-stone-800 transition-all">
                    <input
                      type="checkbox"
                      checked={formSettings.isThermalPrinter}
                      onChange={e => setFormSettings({ ...formSettings, isThermalPrinter: e.target.checked })}
                      className="w-5 h-5 rounded text-white focus:ring-avocado-primary accent-avocado-primary"
                    />
                    <div>
                      <span className="font-bold">استخدام تنسيق الطابعة الحرارية</span>
                      <p className="text-[10px] opacity-70">تحسين الخطوط والهوامش لورق 80mm</p>
                    </div>
                  </label>
                </div>
              </div>
            )}

            {activeTab === 'security' && (
              <div className="space-y-6">
                <h2 className="text-xl font-black text-stone-900 flex items-center gap-2 mb-6">
                  <Shield className="w-6 h-6 text-stone-400" />
                  الأمان وصلاحيات الوصول
                </h2>
                
                <div className="p-6 bg-stone-50 rounded-2xl border border-stone-200 space-y-4">
                  <h3 className="font-bold text-stone-900 flex items-center gap-2">
                    <Lock className="w-5 h-5 text-stone-400" />
                    تغيير كلمة المرور
                  </h3>
                  
                  <form onSubmit={handlePasswordChange} className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-stone-500">كلمة المرور الحالية</label>
                      <input
                        type="password"
                        value={passwordForm.currentPassword}
                        onChange={e => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                        className="w-full px-4 py-2 bg-white border border-stone-200 rounded-lg focus:ring-2 focus:ring-avocado-primary outline-none"
                        required
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-stone-500">كلمة المرور الجديدة</label>
                        <input
                          type="password"
                          value={passwordForm.newPassword}
                          onChange={e => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                          className="w-full px-4 py-2 bg-white border border-stone-200 rounded-lg focus:ring-2 focus:ring-avocado-primary outline-none"
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-stone-500">تأكيد كلمة المرور</label>
                        <input
                          type="password"
                          value={passwordForm.confirmPassword}
                          onChange={e => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                          className="w-full px-4 py-2 bg-white border border-stone-200 rounded-lg focus:ring-2 focus:ring-avocado-primary outline-none"
                          required
                        />
                      </div>
                    </div>
                    {passwordError && (
                      <p className="text-xs text-red-600 font-bold">{passwordError}</p>
                    )}
                    <button
                      type="submit"
                      className="px-6 py-2 bg-stone-900 text-white rounded-lg font-bold hover:bg-stone-800 transition-all"
                    >
                      تحديث كلمة المرور
                    </button>
                  </form>
                </div>

                <div className="p-6 bg-stone-50 rounded-2xl border border-stone-200 space-y-4">
                  <h3 className="font-bold text-stone-900 flex items-center gap-2">
                    <User className="w-5 h-5 text-stone-400" />
                    صلاحيات المستخدمين
                  </h3>
                  <p className="text-sm text-stone-500">
                    يمكنك إدارة المستخدمين وصلاحياتهم من خلال صفحة "إدارة المستخدمين" في القائمة الرئيسية للأدمن.
                  </p>
                </div>
              </div>
            )}

            {activeTab === 'backup' && (
              <div className="space-y-6">
                <h2 className="text-xl font-black text-stone-900 flex items-center gap-2 mb-6">
                  <Database className="w-6 h-6 text-stone-400" />
                  إدارة النسخ الاحتياطي
                </h2>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="p-6 bg-avocado-light rounded-2xl border border-avocado-primary/10 flex flex-col items-center text-center space-y-4">
                    <div className="p-4 bg-white text-avocado-primary rounded-full shadow-sm">
                      <Download className="w-8 h-8" />
                    </div>
                    <div>
                      <h3 className="font-bold text-avocado-dark">إنشاء نسخة احتياطية</h3>
                      <p className="text-xs text-avocado-secondary">تنزيل جميع بيانات النظام في ملف واحد</p>
                    </div>
                    <button
                      onClick={handleBackup}
                      className="w-full py-3 bg-avocado-btn text-white rounded-xl font-bold hover:bg-avocado-primary transition-all"
                    >
                      تنزيل النسخة
                    </button>
                  </div>

                  <div className="p-6 bg-blue-50 rounded-2xl border border-blue-100 flex flex-col items-center text-center space-y-4">
                    <div className="p-4 bg-blue-100 text-blue-600 rounded-full">
                      <Upload className="w-8 h-8" />
                    </div>
                    <div>
                      <h3 className="font-bold text-blue-900">استعادة البيانات</h3>
                      <p className="text-xs text-blue-600">رفع ملف نسخة احتياطية لاستعادة البيانات</p>
                    </div>
                    <label className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all cursor-pointer">
                      رفع واستعادة
                      <input type="file" accept=".json" onChange={handleRestore} className="hidden" />
                    </label>
                  </div>
                </div>

                <div className="p-4 bg-orange-50 rounded-2xl border border-orange-200 flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-orange-600 shrink-0 mt-0.5" />
                  <p className="text-xs text-orange-700 leading-relaxed">
                    <strong>تحذير:</strong> استعادة البيانات ستقوم بمسح جميع البيانات الحالية بشكل نهائي. يرجى التأكد من أن الملف المرفوع هو نسخة احتياطية صحيحة تم إنشاؤها من هذا النظام.
                  </p>
                </div>
              </div>
            )}

            {activeTab === 'maintenance' && (
              <div className="space-y-6">
                <h2 className="text-xl font-black text-stone-900 flex items-center gap-2 mb-6">
                  <RefreshCw className="w-6 h-6 text-stone-400" />
                  صيانة النظام وتصفير البيانات
                </h2>

                <div className="p-6 bg-red-50 rounded-2xl border border-red-100 space-y-4">
                  <div className="flex items-start gap-4">
                    <div className="p-3 bg-red-100 text-red-600 rounded-xl">
                      <AlertTriangle className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="font-bold text-red-900 text-lg">حذف البيانات المالية فقط</h3>
                      <p className="text-sm text-red-700 mt-1">
                        هذا الإجراء سيقوم بحذف جميع الفواتير، المبيعات، المرتجعات، المشتريات، المصاريف، وجلسات الكاشير.
                        <br />
                        <strong>لن يتم حذف:</strong> المنتجات، الأصناف، العملاء، الموردين، أو المستخدمين.
                      </p>
                    </div>
                  </div>

                  <div className="pt-4">
                    {!showResetFinancialModal ? (
                      <button
                        onClick={() => setShowResetFinancialModal(true)}
                        className="px-8 py-3 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition-all shadow-lg shadow-red-200"
                      >
                        بدء عملية الحذف المالي
                      </button>
                    ) : (
                      <div className="space-y-4 bg-white p-6 rounded-xl border border-red-200 animate-in fade-in zoom-in-95">
                        <div className="space-y-2">
                          <label className="text-sm font-bold text-stone-600">أدخل كلمة السر للتأكيد</label>
                          <input
                            type="password"
                            value={resetPassword}
                            onChange={e => {
                              setResetPassword(e.target.value);
                              setResetError('');
                            }}
                            className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-red-500 outline-none transition-all"
                            placeholder="******"
                          />
                          {resetError && <p className="text-xs text-red-600 font-bold">{resetError}</p>}
                        </div>
                        <div className="flex gap-3">
                          <button
                            onClick={handleResetFinancialClick}
                            disabled={isResetting}
                            className="flex-1 py-3 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition-all disabled:opacity-50"
                          >
                            {isResetting ? 'جاري الحذف...' : 'تأكيد الحذف النهائي'}
                          </button>
                          <button
                            onClick={() => {
                              setShowResetFinancialModal(false);
                              setResetPassword('');
                              setResetError('');
                            }}
                            className="flex-1 py-3 bg-stone-100 text-stone-600 rounded-xl font-bold hover:bg-stone-200 transition-all"
                          >
                            إلغاء
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="p-4 bg-stone-100 rounded-xl border border-stone-200">
                  <p className="text-xs text-stone-500 leading-relaxed">
                    <strong>ملاحظة:</strong> بعد إتمام هذه العملية، سيتم تصفير جميع التقارير المالية والداشبورد. سيتم أيضاً إعادة ضبط كميات المخزون إلى الصفر لأن حركات المخزون مرتبطة بالبيانات المالية التي سيتم حذفها.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
