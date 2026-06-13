import { useState, useCallback } from 'react';

export type PrintType = 'invoice' | 'kitchen' | 'report';

export interface PrintRequest {
  type: PrintType;
  data: any;
  autoPrint?: boolean;
  settings?: {
    fontSize?: number;
    margins?: number;
    showLogo?: boolean;
    onePageMode?: boolean;
    paperSize?: 'A4' | 'Thermal';
  };
}

export function usePrint() {
  const [receiptRequest, setReceiptRequest] = useState<PrintRequest | null>(null);
  const [kitchenRequest, setKitchenRequest] = useState<PrintRequest | null>(null);

  const triggerReceiptPrint = useCallback((data: any, autoPrint: boolean = false, customSettings?: any) => {
    setReceiptRequest({
      type: 'invoice',
      data,
      autoPrint,
      settings: {
        fontSize: customSettings?.fontSize || 14,
        margins: customSettings?.margins || 5,
        showLogo: customSettings?.showLogo !== undefined ? customSettings.showLogo : true,
        onePageMode: customSettings?.onePageMode || false,
        paperSize: customSettings?.paperSize || customSettings?.invoicePaperSize || 'Thermal'
      }
    });
  }, []);

  const triggerKitchenPrint = useCallback((data: any, autoPrint: boolean = false, customSettings?: any) => {
    setKitchenRequest({
      type: 'kitchen',
      data,
      autoPrint,
      settings: {
        fontSize: customSettings?.fontSize || 14,
        margins: customSettings?.margins || 5,
        showLogo: customSettings?.showLogo !== undefined ? customSettings.showLogo : true,
        onePageMode: customSettings?.onePageMode || false,
        paperSize: customSettings?.paperSize || customSettings?.kitchenPaperSize || 'Thermal'
      }
    });
  }, []);

  const clearReceiptPrint = useCallback(() => setReceiptRequest(null), []);
  const clearKitchenPrint = useCallback(() => setKitchenRequest(null), []);

  return {
    receiptRequest,
    kitchenRequest,
    triggerReceiptPrint,
    triggerKitchenPrint,
    clearReceiptPrint,
    clearKitchenPrint
  };
}
