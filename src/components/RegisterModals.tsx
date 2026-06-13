import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, DollarSign, Clock, User, AlertTriangle, CheckCircle2, FileText, BarChart3 } from 'lucide-react';
import { RegisterSession, SystemSettings } from '../types';

interface OpenRegisterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpen: (openingCash: number, notes: string) => void;
  cashierName: string;
  settings: SystemSettings;
}

export const OpenRegisterModal: React.FC<OpenRegisterModalProps> = ({ isOpen, onClose, onOpen, cashierName, settings }) => {
  const [openingCash, setOpeningCash] = useState<string>('');
  const [notes, setNotes] = useState('');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" dir="rtl">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden border border-avocado-primary/20"
      >
        <div className="p-6 bg-avocado-dark text-white flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-avocado-primary/20 rounded-xl flex items-center justify-center">
              <DollarSign className="w-6 h-6 text-avocado-primary" />
            </div>
            <div>
              <h2 className="text-xl font-black">فتح الصندوق</h2>
              <p className="text-avocado-light/60 text-xs">بدء جلسة كاشير جديدة</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-8 space-y-6">
          <div className="flex items-center gap-4 p-4 bg-avocado-bg/30 rounded-2xl border border-avocado-primary/10">
            <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-sm">
              <User className="w-6 h-6 text-avocado-dark" />
            </div>
            <div>
              <p className="text-stone-500 text-xs">الكاشير الحالي</p>
              <p className="font-bold text-avocado-dark">{cashierName}</p>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-bold text-stone-600 block">المبلغ الابتدائي في الصندوق</label>
            <div className="relative">
              <div className="absolute right-4 top-1/2 -translate-y-1/2 text-stone-400 font-bold">
                {settings.currencySymbol}
              </div>
              <input 
                type="number"
                value={openingCash}
                onChange={(e) => setOpeningCash(e.target.value)}
                placeholder="0.00"
                className="w-full pr-12 pl-4 py-4 bg-stone-50 border border-stone-200 rounded-2xl focus:ring-2 focus:ring-avocado-primary outline-none transition-all text-2xl font-black text-avocado-dark"
                autoFocus
              />
            </div>
            <p className="text-[10px] text-stone-400">أدخل المبلغ النقدي المتوفر حالياً في الدرج</p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-bold text-stone-600 block">ملاحظات (اختياري)</label>
            <textarea 
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="أي ملاحظات حول حالة الصندوق..."
              className="w-full p-4 bg-stone-50 border border-stone-200 rounded-2xl focus:ring-2 focus:ring-avocado-primary outline-none transition-all resize-none h-24 text-sm"
            />
          </div>

          <button 
            onClick={() => onOpen(parseFloat(openingCash) || 0, notes)}
            disabled={!openingCash}
            className="w-full bg-avocado-btn text-white py-4 rounded-2xl font-bold text-lg shadow-lg shadow-avocado-primary/20 hover:bg-avocado-primary transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            فتح الصندوق وبدء العمل
          </button>
        </div>
      </motion.div>
    </div>
  );
};

interface CloseRegisterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (closingCash: number, notes: string, summary: any) => void;
  session: RegisterSession;
  summary: any;
  settings: SystemSettings;
}

export const CloseRegisterModal: React.FC<CloseRegisterModalProps> = ({ isOpen, onClose, onConfirm, session, summary, settings }) => {
  const [closingCash, setClosingCash] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [viewMode, setViewMode] = useState<'detailed' | 'simple'>('detailed');

  useEffect(() => {
    if (isOpen && session) {
      // Summary is now passed as a prop
    }
  }, [isOpen, session]);

  if (!isOpen) return null;

  const expectedCash = session.openingCash + (summary?.cashSales || 0) - (summary?.cashRefunds || 0);
  const difference = (parseFloat(closingCash) || 0) - expectedCash;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" dir="rtl">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden border border-avocado-primary/20 flex flex-col md:flex-row"
      >
        {/* Left Side: Summary */}
        <div className="w-full md:w-1/2 bg-avocado-dark p-8 text-white relative">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-avocado-primary/20 rounded-xl flex items-center justify-center">
                <BarChart3 className="w-6 h-6 text-avocado-primary" />
              </div>
              <h2 className="text-xl font-black">ملخص الجلسة</h2>
            </div>
            <div className="flex bg-white/10 p-1 rounded-lg">
              <button 
                onClick={() => setViewMode('detailed')}
                className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all ${viewMode === 'detailed' ? 'bg-avocado-primary text-white' : 'text-white/50 hover:text-white'}`}
              >
                تفصيلي
              </button>
              <button 
                onClick={() => setViewMode('simple')}
                className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all ${viewMode === 'simple' ? 'bg-avocado-primary text-white' : 'text-white/50 hover:text-white'}`}
              >
                ملخص
              </button>
            </div>
          </div>

          {!summary ? (
            <div className="flex flex-col items-center justify-center h-64 gap-4">
              <div className="w-10 h-10 border-4 border-avocado-primary/30 border-t-avocado-primary rounded-full animate-spin" />
              <p className="text-avocado-light/60 text-sm">جاري حساب البيانات...</p>
            </div>
          ) : (
            <div className="space-y-4">
              {viewMode === 'detailed' ? (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-white/5 rounded-2xl border border-white/10">
                      <p className="text-avocado-light/50 text-[10px] uppercase font-bold mb-1">المبلغ الابتدائي</p>
                      <p className="text-xl font-black">{(session.openingCash || 0).toFixed(2)} {settings.currencySymbol}</p>
                    </div>
                    <div className="p-4 bg-white/5 rounded-2xl border border-white/10">
                      <p className="text-avocado-light/50 text-[10px] uppercase font-bold mb-1">عدد الفواتير</p>
                      <p className="text-xl font-black">{summary.invoiceCount}</p>
                    </div>
                  </div>

                  <div className="p-4 bg-white/5 rounded-2xl border border-white/10 space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-avocado-light/60 text-sm">مبيعات نقدية</span>
                      <span className="font-bold">{(summary.cashSales || 0).toFixed(2)} {settings.currencySymbol}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-avocado-light/60 text-sm">مبيعات بطاقة</span>
                      <span className="font-bold">{(summary.cardSales || 0).toFixed(2)} {settings.currencySymbol}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-avocado-light/60 text-sm">مبيعات أخرى</span>
                      <span className="font-bold">{(summary.mixedSales || 0).toFixed(2)} {settings.currencySymbol}</span>
                    </div>
                    <div className="pt-2 border-t border-white/10 flex justify-between items-center text-avocado-primary">
                      <span className="font-bold">إجمالي المبيعات</span>
                      <span className="text-xl font-black">{(summary.totalSales || 0).toFixed(2)} {settings.currencySymbol}</span>
                    </div>
                  </div>

                  <div className="p-4 bg-red-500/10 rounded-2xl border border-red-500/20 flex justify-between items-center">
                    <span className="text-red-400 text-sm">إجمالي المرتجعات</span>
                    <span className="text-red-400 font-bold">-{(summary.refunds || 0).toFixed(2)} {settings.currencySymbol}</span>
                  </div>
                </>
              ) : (
                <div className="space-y-6 py-8">
                  <div className="text-center p-6 bg-white/5 rounded-3xl border border-white/10">
                    <p className="text-avocado-light/50 text-xs font-bold uppercase mb-2">صافي المبيعات</p>
                    <p className="text-4xl font-black text-white">
                      {(summary.totalSales - summary.refunds).toFixed(2)} {settings.currencySymbol}
                    </p>
                    <p className="text-[10px] text-avocado-light/30 mt-2">(إجمالي المبيعات - إجمالي المرتجعات)</p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-white/5 rounded-2xl border border-white/10 text-center">
                      <p className="text-avocado-light/50 text-[10px] font-bold mb-1">المبيعات</p>
                      <p className="text-lg font-black">{summary.totalSales.toFixed(2)}</p>
                    </div>
                    <div className="p-4 bg-white/5 rounded-2xl border border-white/10 text-center">
                      <p className="text-red-400/50 text-[10px] font-bold mb-1">المرتجعات</p>
                      <p className="text-lg font-black text-red-400">{summary.refunds.toFixed(2)}</p>
                    </div>
                  </div>
                </div>
              )}

              <div className="p-6 bg-avocado-primary/20 rounded-2xl border border-avocado-primary/30 text-center">
                <p className="text-avocado-light/60 text-xs mb-1">المبلغ المتوقع في الصندوق (نقدي)</p>
                <p className="text-3xl font-black text-avocado-primary">{(expectedCash || 0).toFixed(2)} {settings.currencySymbol}</p>
              </div>
            </div>
          )}
        </div>

        {/* Right Side: Closing Form */}
        <div className="w-full md:w-1/2 p-8 flex flex-col">
          <div className="flex justify-between items-center mb-8">
            <h2 className="text-xl font-black text-avocado-dark">إغلاق الصندوق</h2>
            <button onClick={onClose} className="p-2 hover:bg-stone-100 rounded-full transition-colors">
              <X className="w-6 h-6 text-stone-400" />
            </button>
          </div>

          <div className="flex-1 space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-bold text-stone-600 block">المبلغ الفعلي في الصندوق</label>
              <div className="relative">
                <div className="absolute right-4 top-1/2 -translate-y-1/2 text-stone-400 font-bold">
                  {settings.currencySymbol}
                </div>
                <input 
                  type="number"
                  value={closingCash}
                  onChange={(e) => setClosingCash(e.target.value)}
                  placeholder="0.00"
                  className="w-full pr-12 pl-4 py-4 bg-stone-50 border border-stone-200 rounded-2xl focus:ring-2 focus:ring-avocado-primary outline-none transition-all text-2xl font-black text-avocado-dark"
                  autoFocus
                />
              </div>
            </div>

            <div className={`p-4 rounded-2xl border flex items-center gap-4 transition-all ${
              difference === 0 ? 'bg-green-50 border-green-200 text-green-700' :
              difference > 0 ? 'bg-blue-50 border-blue-200 text-blue-700' :
              'bg-red-50 border-red-200 text-red-700'
            }`}>
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                difference === 0 ? 'bg-green-500/20' :
                difference > 0 ? 'bg-blue-500/20' :
                'bg-red-500/20'
              }`}>
                {difference === 0 ? <CheckCircle2 className="w-6 h-6" /> : <AlertTriangle className="w-6 h-6" />}
              </div>
              <div>
                <p className="text-[10px] uppercase font-bold opacity-70">الفرق في الصندوق</p>
                <p className="text-xl font-black">{(difference || 0).toFixed(2)} {settings.currencySymbol}</p>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-bold text-stone-600 block">ملاحظات الإغلاق</label>
              <textarea 
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="أي ملاحظات حول العجز أو الزيادة..."
                className="w-full p-4 bg-stone-50 border border-stone-200 rounded-2xl focus:ring-2 focus:ring-avocado-primary outline-none transition-all resize-none h-24 text-sm"
              />
            </div>
          </div>

          <button 
            onClick={() => onConfirm(parseFloat(closingCash) || 0, notes, summary)}
            disabled={!closingCash || !summary}
            className="w-full bg-avocado-dark text-white py-4 rounded-2xl font-bold text-lg shadow-lg hover:bg-black transition-all active:scale-[0.98] mt-8 disabled:opacity-50"
          >
            تأكيد الإغلاق وإنهاء الشفت
          </button>
        </div>
      </motion.div>
    </div>
  );
};
