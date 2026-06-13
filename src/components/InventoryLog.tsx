import React, { useState, useEffect } from 'react';
import { Package, Search, Filter, ArrowDownRight, ArrowUpRight, RefreshCw } from 'lucide-react';
import { InventoryMovement, Product } from '../types';

interface InventoryLogProps {
  products: Product[];
  inventoryMovements: InventoryMovement[];
}

export const InventoryLog: React.FC<InventoryLogProps> = ({ products, inventoryMovements }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('all');

  const filteredMovements = inventoryMovements.filter(m => {
    const product = products.find(p => p.id === m.productId);
    const matchesSearch = product?.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          m.note?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          m.referenceId?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = filterType === 'all' || m.type === filterType;
    return matchesSearch && matchesType;
  });

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'Purchase': return <ArrowUpRight className="w-5 h-5 text-green-500" />;
      case 'Sale': return <ArrowDownRight className="w-5 h-5 text-blue-500" />;
      case 'Return': return <RefreshCw className="w-5 h-5 text-amber-500" />;
      default: return <Package className="w-5 h-5 text-stone-500" />;
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'Purchase': return 'شراء';
      case 'Sale': return 'بيع';
      case 'Return': return 'مرتجع';
      case 'Adjustment': return 'تسوية';
      default: return type;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-black flex items-center gap-2">
          <Package className="w-6 h-6 text-stone-400" />
          سجل حركة المخزون
        </h2>
      </div>

      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-stone-400" />
          <input
            type="text"
            placeholder="بحث برقم المرجع، اسم المنتج، أو الملاحظات..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pr-12 pl-4 py-3 bg-white border border-stone-200 rounded-2xl focus:ring-2 focus:ring-avocado-primary outline-none"
          />
        </div>
        <div className="relative min-w-[200px]">
          <Filter className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-stone-400" />
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="w-full pr-12 pl-4 py-3 bg-white border border-stone-200 rounded-2xl focus:ring-2 focus:ring-avocado-primary outline-none appearance-none"
          >
            <option value="all">جميع الحركات</option>
            <option value="Purchase">مشتريات</option>
            <option value="Sale">مبيعات</option>
            <option value="Return">مرتجعات</option>
          </select>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-stone-200 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-right">
            <thead className="bg-stone-50 border-b border-stone-200">
              <tr>
                <th className="p-4 font-bold text-stone-500 text-sm">التاريخ</th>
                <th className="p-4 font-bold text-stone-500 text-sm">نوع الحركة</th>
                <th className="p-4 font-bold text-stone-500 text-sm">المنتج</th>
                <th className="p-4 font-bold text-stone-500 text-sm">الحجم</th>
                <th className="p-4 font-bold text-stone-500 text-sm">الكمية</th>
                <th className="p-4 font-bold text-stone-500 text-sm">رقم المرجع</th>
                <th className="p-4 font-bold text-stone-500 text-sm">المستخدم</th>
                <th className="p-4 font-bold text-stone-500 text-sm">ملاحظات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {filteredMovements.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-stone-500">لا توجد حركات مطابقة للبحث</td>
                </tr>
              ) : (
                filteredMovements.map((movement) => {
                  const product = products.find(p => p.id === movement.productId);
                  return (
                    <tr key={movement.id} className="hover:bg-stone-50 transition-colors">
                      <td className="p-4 text-sm text-stone-600">
                        {new Date(movement.date).toLocaleString('ar-SA')}
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          {getTypeIcon(movement.type)}
                          <span className="font-bold text-stone-700">{getTypeLabel(movement.type)}</span>
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="font-bold text-stone-800">{product?.name || 'منتج محذوف'}</div>
                        <div className="text-xs text-stone-400">{product?.barcode}</div>
                      </td>
                      <td className="p-4">
                        {movement.size ? (
                          <span className="px-2 py-1 bg-stone-100 text-stone-600 rounded-md text-xs font-bold">
                            {movement.size}
                          </span>
                        ) : '-'}
                      </td>
                      <td className="p-4">
                        <span className={`font-bold ${movement.quantity > 0 ? 'text-green-600' : 'text-red-600'} bg-stone-100 px-3 py-1 rounded-lg`}>
                          {movement.quantity > 0 ? '+' : ''}{movement.quantity}
                        </span>
                      </td>
                      <td className="p-4 text-sm font-mono text-stone-500">{movement.referenceId}</td>
                      <td className="p-4 text-sm text-stone-600">{movement.userName || 'مستخدم غير معروف'}</td>
                      <td className="p-4 text-sm text-stone-500">{movement.note}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
