'use client';

import React, { useState, useMemo } from 'react';
import type { Employee } from '@/lib/types';
import { useAppContext } from '@/context/app-provider';
import { 
  Truck, 
  Plus, 
  Trash2, 
  Package, 
  CheckCircle2, 
  Clock, 
  FileSpreadsheet, 
  Printer, 
  UserCheck, 
  Layers,
  MapPin
} from 'lucide-react';
import { format } from 'date-fns';

interface AdminLogisticsModuleProps {
  employees: Employee[];
}

export function AdminLogisticsModule({ employees }: AdminLogisticsModuleProps) {
  const [shipments, setShipments] = useState<Array<{
    id: string;
    cargoTitle: string;
    supplier: string;
    driverName: string;
    truckPlate: string;
    destinationWarehouse: string;
    unloadingTeam: string[];
    date: string;
    status: 'in_progress' | 'completed' | 'pending';
    itemCount: number;
    notes: string;
  }>>(() => {
    try {
      const saved = localStorage.getItem('ashley_unloading_shipments');
      if (saved) return JSON.parse(saved);
    } catch {}
    return [
      {
        id: 'ship_1',
        cargoTitle: 'باری تەختە و مەتریاڵی ئەڵمانی (MDF)',
        supplier: 'کۆمپانیای بازرگانی جیهان',
        driverName: 'کاک هێمن شۆفێر',
        truckPlate: 'سلێمانی ٢٣٤٥٦ / باری',
        destinationWarehouse: 'کارگەی سەرەکی ئاشڵی',
        unloadingTeam: ['ئەحمەد', 'کاردۆ', 'عومەر'],
        date: format(new Date(), 'yyyy-MM-dd'),
        status: 'completed',
        itemCount: 450,
        notes: 'بە سەرکەوتوویی لە کۆگای تەختە داگیرا',
      }
    ];
  });

  const [showAddModal, setShowAddModal] = useState(false);
  const [cargoTitle, setCargoTitle] = useState('');
  const [supplier, setSupplier] = useState('');
  const [driverName, setDriverName] = useState('');
  const [truckPlate, setTruckPlate] = useState('');
  const [destinationWarehouse, setDestinationWarehouse] = useState('کارگەی سەرەکی ئاشڵی');
  const [selectedCrew, setSelectedCrew] = useState<string[]>([]);
  const [itemCount, setItemCount] = useState('100');
  const [status, setStatus] = useState<'in_progress' | 'completed' | 'pending'>('in_progress');
  const [notes, setNotes] = useState('');

  const activeEmployees = useMemo(() => {
    return employees.filter(e => e.status !== 'resigned' && e.isActive !== false);
  }, [employees]);

  const saveShipments = (newShipments: any[]) => {
    setShipments(newShipments);
    if (typeof window !== 'undefined') {
      localStorage.setItem('ashley_unloading_shipments', JSON.stringify(newShipments));
    }
  };

  const handleAddShipment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cargoTitle.trim()) return alert('تکایە ناونیشانی بار بنووسە');

    const newShip = {
      id: 'ship_' + Date.now(),
      cargoTitle: cargoTitle.trim(),
      supplier: supplier.trim() || 'ئاشڵی ئینتەرناشناڵ',
      driverName: driverName.trim() || 'شۆفێری کۆمپانیا',
      truckPlate: truckPlate.trim() || 'سلێمانی - باری',
      destinationWarehouse,
      unloadingTeam: selectedCrew.length > 0 ? selectedCrew : ['کارمەندانی کارگە'],
      date: format(new Date(), 'yyyy-MM-dd'),
      status,
      itemCount: parseInt(itemCount, 10) || 0,
      notes: notes.trim(),
    };

    const updated = [newShip, ...shipments];
    saveShipments(updated);
    setShowAddModal(false);
    setCargoTitle('');
    setSupplier('');
    setDriverName('');
    setTruckPlate('');
    setNotes('');
    alert(`🎉 باری (${newShip.cargoTitle}) بە سەرکەوتوویی تۆمارکرا!`);
  };

  const handleDelete = (id: string) => {
    if (confirm('ئایا دڵنیایت لە سڕینەوەی ئەم تۆمارەی بارداگرتن؟')) {
      const updated = shipments.filter(s => s.id !== id);
      saveShipments(updated);
    }
  };

  const handleToggleStatus = (id: string) => {
    const updated = shipments.map(s => {
      if (s.id === id) {
        const nextStatus = s.status === 'completed' ? 'in_progress' : 'completed';
        return { ...s, status: nextStatus as any };
      }
      return s;
    });
    saveShipments(updated);
  };

  return (
    <div className="space-y-4 text-xs font-bold text-slate-900 dir-rtl" dir="rtl">
      
      {/* Header & Controls */}
      <div className="flex flex-wrap items-center justify-between gap-2 p-2 bg-slate-100 border border-slate-300 rounded">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAddModal(true)}
            className="btn-classic-primary text-xs flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>تۆمارکردنی باری نوێ (New Cargo / Unloading)</span>
          </button>
        </div>

        <div className="flex items-center gap-2 font-mono text-[11px] text-slate-600">
          <span>کۆی بارەکانی تۆمارکراو: <span className="text-blue-900 font-black">{shipments.length}</span></span>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div className="panel-classic p-2 text-center bg-blue-50 border-blue-200">
          <span className="text-[10px] text-blue-900 block font-bold">کۆی بارەکان</span>
          <p className="text-base font-black text-blue-950 font-mono mt-0.5">{shipments.length} بار</p>
        </div>
        <div className="panel-classic p-2 text-center bg-emerald-50 border-emerald-200">
          <span className="text-[10px] text-emerald-900 block font-bold">داگیراو و تەواوبوو</span>
          <p className="text-base font-black text-emerald-950 font-mono mt-0.5">
            {shipments.filter(s => s.status === 'completed').length} بار
          </p>
        </div>
        <div className="panel-classic p-2 text-center bg-amber-50 border-amber-200">
          <span className="text-[10px] text-amber-900 block font-bold">لە کاتی داگرتندا</span>
          <p className="text-base font-black text-amber-950 font-mono mt-0.5">
            {shipments.filter(s => s.status === 'in_progress').length} بار
          </p>
        </div>
        <div className="panel-classic p-2 text-center bg-purple-50 border-purple-200">
          <span className="text-[10px] text-purple-900 block font-bold">کۆی کاڵای داگیراو</span>
          <p className="text-base font-black text-purple-950 font-mono mt-0.5">
            {shipments.reduce((acc, curr) => acc + (curr.itemCount || 0), 0).toLocaleString()} پارچە
          </p>
        </div>
      </div>

      {/* Shipments Table */}
      <div className="border border-slate-400 bg-white rounded overflow-x-auto shadow-sm">
        <table className="w-full text-right text-xs border-collapse">
          <thead>
            <tr className="bg-slate-200 border-b border-slate-400 text-slate-900 font-black">
              <th className="p-2 border-l border-slate-300 w-10 text-center">#</th>
              <th className="p-2 border-l border-slate-300">ناونیشانی بار و دابینکەر</th>
              <th className="p-2 border-l border-slate-300">شۆفێر و ژمارەی ئۆتۆمبێل</th>
              <th className="p-2 border-l border-slate-300">کۆگا / دەستەی داگرتن</th>
              <th className="p-2 border-l border-slate-300 text-center">ژمارەی کاڵا</th>
              <th className="p-2 border-l border-slate-300 text-center">حاڵەت</th>
              <th className="p-2 text-center w-16">کردار</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-300 font-bold">
            {shipments.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-6 text-center text-slate-500 font-bold">
                  هیچ بارێکی نوێ تۆمار نەکراوە.
                </td>
              </tr>
            ) : (
              shipments.map((s, idx) => (
                <tr key={s.id} className="hover:bg-slate-50">
                  <td className="p-2 border-l border-slate-200 text-center font-mono text-slate-500">{idx + 1}</td>
                  <td className="p-2 border-l border-slate-200">
                    <span className="font-black text-slate-900 block">{s.cargoTitle}</span>
                    <span className="text-[10px] text-slate-500 block font-normal">{s.supplier} ({s.date})</span>
                  </td>
                  <td className="p-2 border-l border-slate-200">
                    <span className="text-slate-900 block">{s.driverName}</span>
                    <span className="text-[10px] text-blue-900 block font-mono font-bold">{s.truckPlate}</span>
                  </td>
                  <td className="p-2 border-l border-slate-200">
                    <span className="text-emerald-950 font-black block flex items-center gap-1 text-[11px]">
                      <MapPin className="w-3 h-3 text-emerald-700" /> {s.destinationWarehouse}
                    </span>
                    <span className="text-[10px] text-slate-600 block">
                      دەستە: {Array.isArray(s.unloadingTeam) ? s.unloadingTeam.join(', ') : s.unloadingTeam}
                    </span>
                  </td>
                  <td className="p-2 border-l border-slate-200 text-center font-mono font-black text-blue-950">
                    {s.itemCount.toLocaleString()}
                  </td>
                  <td className="p-2 border-l border-slate-200 text-center">
                    <button
                      onClick={() => handleToggleStatus(s.id)}
                      className={`px-2 py-0.5 rounded text-[10px] font-black cursor-pointer border ${
                        s.status === 'completed'
                          ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                          : 'bg-amber-100 text-amber-950 border-amber-300 animate-pulse'
                      }`}
                    >
                      {s.status === 'completed' ? '✓ داگیرا / تەواو بوو' : '⏳ لە داگرتندایە'}
                    </button>
                  </td>
                  <td className="p-2 text-center">
                    <button onClick={() => handleDelete(s.id)} className="text-rose-700 hover:text-rose-950 p-1">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Add Shipment Modal Dialog */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4" dir="rtl">
          <div className="bg-slate-200 border-2 border-t-white border-l-white border-b-slate-600 border-r-slate-600 max-w-lg w-full shadow-2xl p-1 text-slate-900 font-sans">
            <div className="bg-blue-900 text-white p-1.5 px-3 flex items-center justify-between text-xs font-bold font-mono">
              <span className="flex items-center gap-1.5">
                <Truck className="w-3.5 h-3.5 text-blue-300" />
                <span>تۆمارکردنی باری نوێ بۆ داگرتن (Cargo Unloading Entry)</span>
              </span>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="w-4 h-3.5 bg-rose-800 text-white flex items-center justify-center border border-rose-600 font-mono text-[10px]"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddShipment} className="p-4 space-y-3 text-xs font-bold">
              <div>
                <label className="block text-slate-800 mb-1">ناونیشانی بار:</label>
                <input
                  type="text"
                  required
                  value={cargoTitle}
                  onChange={(e) => setCargoTitle(e.target.value)}
                  placeholder="بۆ نموونە: باری ئیسفەنج و خام"
                  className="input-classic w-full font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-800 mb-1">دابینکەر / کۆمپانیا:</label>
                  <input
                    type="text"
                    value={supplier}
                    onChange={(e) => setSupplier(e.target.value)}
                    placeholder="کۆمپانیای دابینکەر..."
                    className="input-classic w-full"
                  />
                </div>
                <div>
                  <label className="block text-slate-800 mb-1">کۆگای مەبەست:</label>
                  <select
                    value={destinationWarehouse}
                    onChange={(e) => setDestinationWarehouse(e.target.value)}
                    className="input-classic w-full font-bold"
                  >
                    <option value="کارگەی سەرەکی ئاشڵی">کارگەی سەرەکی ئاشڵی</option>
                    <option value="کۆگای کەلوپەل و تەختە">کۆگای کەلوپەل و تەختە</option>
                    <option value="لقی هەوانە">لقی هەوانە</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-800 mb-1">ناوی شۆفێر:</label>
                  <input
                    type="text"
                    value={driverName}
                    onChange={(e) => setDriverName(e.target.value)}
                    placeholder="ناوی شۆفێر..."
                    className="input-classic w-full font-bold"
                  />
                </div>
                <div>
                  <label className="block text-slate-800 mb-1">ژمارەی تابلۆی بارهەڵگر:</label>
                  <input
                    type="text"
                    value={truckPlate}
                    onChange={(e) => setTruckPlate(e.target.value)}
                    placeholder="سلێمانی ٤٥٦٧ / باری"
                    className="input-classic w-full font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-800 mb-1">ژمارەی کاڵا / پارچە:</label>
                  <input
                    type="number"
                    value={itemCount}
                    onChange={(e) => setItemCount(e.target.value)}
                    className="input-classic w-full font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block text-slate-800 mb-1">حاڵەتی ئێستا:</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as any)}
                    className="input-classic w-full font-bold"
                  >
                    <option value="in_progress">لە کاتی داگرتندایە</option>
                    <option value="completed">داگیرا و تەواو بوو</option>
                    <option value="pending">چاوەڕوانکراوە</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-800 mb-1">تێبینی زیاتر:</label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="تێبینی لەسەر کوالێتی بار..."
                  className="input-classic w-full"
                />
              </div>

              <div className="p-2 border-t border-slate-300 flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="btn-classic text-xs"
                >
                  پاشگەزبوونەوە
                </button>
                <button
                  type="submit"
                  className="btn-classic-primary text-xs flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>پاشەکەوتکردنی بار</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
