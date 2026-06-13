import React, { useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, Printer, Settings, Type, Move, Image as ImageIcon, 
  FileText, Download, Layout, ChevronRight, ChevronLeft
} from 'lucide-react';
import { PrintRequest } from '../hooks/usePrint';
import { SystemSettings } from '../types';
import { InvoiceTemplate, KitchenTemplate } from './PrintTemplates';
import { qzService } from '../services/qzService';

interface PrintStudioProps {
  request: PrintRequest | null;
  onClose: () => void;
  systemSettings: SystemSettings;
  onSettingsChange: (settings: any) => void;
}

export const PrintStudio: React.FC<PrintStudioProps> = ({ 
  request, 
  onClose, 
  systemSettings,
  onSettingsChange
}) => {
  const previewRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (request?.autoPrint && previewRef.current) {
      // Small delay to ensure content is rendered
      const timer = setTimeout(async () => {
        await handlePrint();
        onClose();
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [request?.autoPrint]);

  if (!request) return null;

  const performPrint = async (jobs: { content: string, printerName: string, type: string }[]) => {
    // QZ Tray Silent Printing
    if (systemSettings.useQZTray) {
      try {
        for (const job of jobs) {
          const fullHtml = `
            <div dir="rtl" style="font-family: 'Cairo', sans-serif; width: 100%;">
              ${job.content}
            </div>
          `;
          await qzService.printHTML(job.printerName, fullHtml);
        }
        return;
      } catch (err) {
        console.error('QZ Tray Print Error:', err);
        if (!confirm('فشلت الطباعة عبر QZ Tray. هل تريد الطباعة اليدوية عبر المتصفح؟')) {
          return;
        }
      }
    }

    // Create Virtual Print Window (Fallback)
    const printWindow = window.open('', '_blank', 'width=800,height=900');
    if (!printWindow) {
      alert('يرجى السماح بالنوافذ المنبثقة (Popups) لتتمكن من الطباعة');
      return;
    }

    // Optional: Send to Print Service if configured
    if (systemSettings.printServiceUrl) {
      try {
        for (const job of jobs) {
          fetch(systemSettings.printServiceUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              printer: job.printerName,
              type: job.type,
              content: job.content,
              data: request.data
            })
          }).catch(err => console.error('Print Service Error:', err));
        }
      } catch (e) {}
    }

    // Combine content for browser fallback
    const separator = `<div style="page-break-after: always; break-after: page; height: 0;"></div>`;
    const finalContent = jobs.map(j => j.content).join(separator);
    const title = jobs[0].printerName;

    // HTML Assembly & Style Injection
    const html = `
      <!DOCTYPE html>
      <html dir="rtl" style="margin:0; padding:0; width:68mm;">
        <head>
          <title>${title} - ${systemSettings.storeName}</title>
          <meta charset="utf-8">
          <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;700;900&display=swap" rel="stylesheet">
          <script src="https://cdn.tailwindcss.com"></script>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;700;900&display=swap');
            body { 
              margin: 0; 
              padding: 0; 
              font-family: 'Cairo', sans-serif !important;
              background-color: white;
              width: 68mm;
              direction: rtl;
            }
            @media print {
              @page {
                margin: 0;
                size: ${request.settings?.paperSize === 'Thermal' ? '68mm auto' : 'A4'};
              }
              body { 
                margin: 0; 
                padding: 0;
                width: 68mm;
                direction: rtl;
              }
              .print-container {
                display: block !important;
                background: white !important;
                box-sizing: border-box !important;
              }
              .no-print { display: none; }
            }
            .print-container {
              display: block;
              background: white;
              box-sizing: border-box;
            }
            * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          </style>
        </head>
        <body style="margin:0; padding:0; width:68mm; direction:rtl;">
          <div class="print-container">
            ${finalContent}
          </div>
          <script>
            window.onload = () => {
              setTimeout(() => {
                window.print();
                window.close();
              }, 500);
            };
          </script>
        </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
  };

  const handlePrint = async () => {
    if (!previewRef.current) return;

    if (request.type === 'invoice') {
      const receiptContent = previewRef.current.innerHTML;
      
      await performPrint([
        { content: receiptContent, printerName: systemSettings.receiptPrinterName, type: 'invoice' },
        { content: receiptContent, printerName: systemSettings.receiptPrinterName, type: 'invoice' }
      ]);
    } else {
      const content = previewRef.current.innerHTML;
      const printerName = request.type === 'kitchen' 
        ? systemSettings.kitchenPrinterName 
        : systemSettings.receiptPrinterName;
      await performPrint([
        { content, printerName, type: request.type }
      ]);
    }

    if (!request.autoPrint) {
      onClose();
    }
  };

  const updateSetting = (key: string, value: any) => {
    onSettingsChange({
      ...request.settings,
      [key]: value
    });
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[200] flex items-center justify-center bg-stone-900/90 backdrop-blur-md p-4 md:p-8">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          className="bg-white w-full max-w-6xl h-full max-h-[90vh] rounded-3xl shadow-2xl overflow-hidden flex flex-col md:flex-row"
        >
          {/* Sidebar: Controls */}
          <div className="w-full md:w-80 bg-stone-50 border-l border-stone-200 p-6 flex flex-col gap-6 overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-black text-stone-900 flex items-center gap-2">
                <Settings className="w-5 h-5 text-stone-400" />
                خيارات الطباعة
              </h2>
              <button onClick={onClose} className="p-2 hover:bg-stone-200 rounded-full transition-all">
                <X className="w-5 h-5 text-stone-500" />
              </button>
            </div>

            <div className="space-y-6">
              {/* Paper Size */}
              <div className="space-y-3">
                <label className="text-xs font-bold text-stone-500 uppercase tracking-widest flex items-center gap-2">
                  <Layout className="w-4 h-4" />
                  حجم الورق
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {['Thermal', 'A4'].map(size => (
                    <button
                      key={size}
                      onClick={() => updateSetting('paperSize', size)}
                      className={`py-2 px-3 rounded-xl text-sm font-bold border transition-all ${
                        request.settings?.paperSize === size 
                          ? 'bg-stone-900 text-white border-stone-900 shadow-md' 
                          : 'bg-white text-stone-600 border-stone-200 hover:border-stone-400'
                      }`}
                    >
                      {size === 'Thermal' ? 'حراري 80mm' : 'A4 قياسي'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Font Size */}
              <div className="space-y-3">
                <label className="text-xs font-bold text-stone-500 uppercase tracking-widest flex items-center gap-2">
                  <Type className="w-4 h-4" />
                  حجم الخط ({request.settings?.fontSize}px)
                </label>
                <input 
                  type="range" 
                  min="10" 
                  max="24" 
                  value={request.settings?.fontSize || 14}
                  onChange={(e) => updateSetting('fontSize', parseInt(e.target.value))}
                  className="w-full accent-stone-900"
                />
              </div>

              {/* Margins */}
              <div className="space-y-3">
                <label className="text-xs font-bold text-stone-500 uppercase tracking-widest flex items-center gap-2">
                  <Move className="w-4 h-4" />
                  الهوامش ({request.settings?.margins || 20}px)
                </label>
                <input 
                  type="range" 
                  min="0" 
                  max="50" 
                  value={request.settings?.margins || 20}
                  onChange={(e) => updateSetting('margins', parseInt(e.target.value))}
                  className="w-full accent-stone-900"
                />
              </div>

              {/* Toggles */}
              <div className="space-y-3">
                <label className="flex items-center justify-between p-3 bg-white border border-stone-200 rounded-2xl cursor-pointer hover:border-stone-400 transition-all">
                  <div className="flex items-center gap-3">
                    <ImageIcon className="w-5 h-5 text-stone-400" />
                    <span className="text-sm font-bold text-stone-700">إظهار الشعار</span>
                  </div>
                  <input 
                    type="checkbox" 
                    checked={request.settings?.showLogo || false}
                    onChange={(e) => updateSetting('showLogo', e.target.checked)}
                    className="w-5 h-5 rounded accent-stone-900"
                  />
                </label>

                <label className="flex items-center justify-between p-3 bg-white border border-stone-200 rounded-2xl cursor-pointer hover:border-stone-400 transition-all">
                  <div className="flex items-center gap-3">
                    <FileText className="w-5 h-5 text-stone-400" />
                    <span className="text-sm font-bold text-stone-700">وضع صفحة واحدة</span>
                  </div>
                  <input 
                    type="checkbox" 
                    checked={request.settings?.onePageMode || false}
                    onChange={(e) => updateSetting('onePageMode', e.target.checked)}
                    className="w-5 h-5 rounded accent-stone-900"
                  />
                </label>
              </div>
            </div>

            <div className="mt-auto pt-6 border-t border-stone-200 space-y-3">
              <button
                onClick={handlePrint}
                className="w-full bg-avocado-btn text-white py-4 rounded-2xl font-black text-lg shadow-xl shadow-avocado-primary/20 hover:bg-avocado-primary transition-all flex items-center justify-center gap-3"
              >
                <Printer className="w-6 h-6" />
                طباعة الآن
              </button>
            </div>
          </div>

          {/* Main: Preview Area */}
          <div className="flex-1 bg-stone-200 p-4 md:p-12 overflow-y-auto flex justify-center items-start">
            <div className="relative">
              {/* Preview Label */}
              <div className="absolute -top-8 left-0 right-0 flex justify-center">
                <span className="bg-stone-900 text-white text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest shadow-lg">
                  معاينة مباشرة (WYSIWYG)
                </span>
              </div>

              {/* The Actual Preview Content */}
              <div 
                ref={previewRef}
                className="shadow-2xl transition-all duration-300 origin-top bg-white"
                style={{ 
                  width: request.settings?.paperSize === 'Thermal' ? '68mm' : '210mm',
                  maxWidth: '100%',
                  transform: request.settings?.paperSize === 'Thermal' ? 'none' : 'scale(0.8)',
                }}
              >
                {request.type === 'invoice' && (
                  <InvoiceTemplate 
                    data={request.data} 
                    settings={request.settings} 
                    systemSettings={systemSettings} 
                  />
                )}
                {request.type === 'kitchen' && (
                  <KitchenTemplate 
                    data={request.data} 
                    settings={request.settings} 
                    systemSettings={systemSettings} 
                  />
                )}
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
