import React from 'react';
import { SystemSettings } from '../types';

interface TemplateProps {
  data: any;
  settings: any;
  systemSettings: SystemSettings;
}

export const InvoiceTemplate: React.FC<TemplateProps> = ({ data, settings, systemSettings }) => {
  const baseFontSize = settings.paperSize === 'Thermal' ? 12 : settings.fontSize;
  
  return (
    <div 
      id="print-document"
      className="print-container"
      style={{ 
        padding: settings.paperSize === 'Thermal' ? '6mm 0' : '10mm',
        fontSize: settings.paperSize === 'Thermal' ? '12px' : `${baseFontSize}px`,
        fontFamily: "'Cairo', sans-serif",
        direction: 'rtl',
        backgroundColor: 'white',
        color: 'black',
        width: settings.paperSize === 'Thermal' ? '68mm' : '210mm',
        maxWidth: settings.paperSize === 'Thermal' ? '68mm' : '100%',
        margin: settings.paperSize === 'Thermal' ? '0 auto' : '0',
        boxSizing: 'border-box',
        overflow: 'hidden',
        lineHeight: '1.4'
      }}
    >
      {/* Store Name & Info */}
      <div className="text-center mb-6">
        <h1 className="text-xl font-black leading-tight uppercase text-black tracking-wider">
          {systemSettings.storeName}
        </h1>
        {systemSettings.storeAddress && (
          <p className="text-[10px] font-bold mt-1">{systemSettings.storeAddress}</p>
        )}
        {systemSettings.storePhone && (
          <p className="text-[12px] font-black mt-1">هاتف: {systemSettings.storePhone}</p>
        )}
      </div>

      {/* Invoice Number */}
      <div className="text-center mb-6 border-t border-b border-black border-dashed py-3">
        <p className="text-xs font-bold text-black mb-1">فاتورة رقم</p>
        <p className="text-2xl font-black text-black">
          #{data.orderNumber || data.id?.substring(0, 8)}
        </p>
      </div>

      {/* Date and Time */}
      <div className="text-center mb-6">
        <p className="text-xs font-bold text-black mb-1">التاريخ والوقت</p>
        <div className="text-base font-black text-black flex flex-col items-center leading-tight">
          <span>{new Date(data.date || data.timestamp || Date.now()).toLocaleDateString('ar-EG')}</span>
          <span>{new Date(data.date || data.timestamp || Date.now()).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}</span>
        </div>
      </div>

      {/* Simple Items List */}
      <div className="mb-6 px-2">
        <div className="space-y-2">
          {data.items.map((item: any, index: number) => (
            <div key={index} className="flex flex-col text-sm font-bold text-black border-b border-stone-100 pb-1">
              <div className="flex items-baseline gap-2">
                <span className="flex-1">{item.name} {item.size ? `(${item.size})` : ''}</span>
                <span className="font-black">{(item.quantity * (item.price || 0)).toFixed(2)}</span>
              </div>
              <div className="text-[11px] font-bold text-black mt-0.5">
                {item.quantity} × {(item.price || 0).toFixed(2)} {systemSettings.currencySymbol}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Total Amount - Large */}
      <div className="text-center mb-8 bg-stone-100 py-4 rounded-xl border-2 border-black">
        <p className="text-sm font-bold text-black mb-1">المبلغ الإجمالي</p>
        <div className="flex justify-center items-baseline gap-2">
          <span className="text-3xl font-black font-mono">{(data.total || 0).toFixed(2)}</span>
          <span className="text-lg font-black">{systemSettings.currencySymbol}</span>
        </div>
      </div>

      {/* Footer */}
      <div className="text-center mt-4">
        <p className="text-sm font-black italic mb-2">
          {systemSettings.invoiceFooter || 'شكراً لزيارتكم!'}
        </p>
        <div className="border-t border-black border-dotted pt-2">
          <p className="text-[10px] font-bold opacity-70">{systemSettings.storeName}</p>
        </div>
      </div>
    </div>
  );
};

export const KitchenTemplate: React.FC<TemplateProps> = ({ data }) => {
  return (
    <div 
      id="print-document"
      className="print-container"
      style={{ 
        padding: '4mm 0', 
        fontSize: '16px',
        fontFamily: "'Cairo', sans-serif",
        direction: 'rtl',
        backgroundColor: 'white',
        color: 'black',
        width: '68mm',
        maxWidth: '68mm',
        margin: '0 auto',
        boxSizing: 'border-box',
        lineHeight: '1.3'
      }}
    >
      <div className="text-center border-b-2 border-black pb-2 mb-3">
        <h1 className="text-xl font-black">طلب مطبخ</h1>
        <p className="text-2xl font-black mt-1">#{data.orderNumber}</p>
        <div className="flex justify-between text-[10px] mt-1.5 font-bold">
          <span>الوقت: {new Date(data.date || data.timestamp || Date.now()).toLocaleTimeString('ar-EG')}</span>
          <span>الكاشير: {data.cashierName}</span>
        </div>
      </div>

      <div className="space-y-3">
        {data.items.map((item: any, index: number) => (
          <div key={index} className="border-b border-black border-dotted pb-2">
            <div className="text-lg font-black leading-tight">
              {item.quantity} × {item.name}
            </div>
            {item.size && (
              <div className="text-sm font-bold mt-0.5">الحجم: {item.size}</div>
            )}
            {item.note && (
              <div className="mt-1.5 p-1.5 bg-black text-white text-xs font-black">
                ملاحظة: {item.note}
              </div>
            )}
          </div>
        ))}
      </div>

      {data.notes && (
        <div className="mt-4 p-2 border-2 border-black">
          <p className="font-black text-sm mb-0.5 underline">ملاحظات عامة:</p>
          <p className="font-bold text-xs">{data.notes}</p>
        </div>
      )}
      
      <div className="text-center mt-6 pt-3 border-t border-dashed border-black">
        <p className="text-[10px] font-black italic">نهاية طلب المطبخ</p>
      </div>
    </div>
  );
};
