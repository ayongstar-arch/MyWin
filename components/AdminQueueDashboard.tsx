
import React, { useState, useMemo } from 'react';
import { Driver } from '../types';
import { STATION_ZONES, FAIRNESS_WEIGHTS } from '../constants';
import { calculateFairnessScore } from '../services/scheduler';

interface AdminQueueDashboardProps {
  drivers: Driver[];
  onOverrideQueue: (driverId: string, reason: string) => void;
}

const AdminQueueDashboard: React.FC<AdminQueueDashboardProps> = ({ drivers, onOverrideQueue }) => {
  const [selectedWin, setSelectedWin] = useState('WIN-CENTRAL-01');
  
  // Override Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedDriver, setSelectedDriver] = useState<string | null>(null);
  const [overrideReason, setOverrideReason] = useState('');

  // Transform Real Driver Data into Queue Data
  const queueData = useMemo(() => {
    const currentTime = Date.now();
    
    // 1. Filter drivers belonging to the selected Win AND are IDLE (Queued)
    // Note: In real app, we might also show BUSY drivers at the bottom list
    const relevantDrivers = drivers.filter(d => d.winId === selectedWin);

    // 2. Map to display format and calculate real score
    const mapped = relevantDrivers.map(d => {
       const score = calculateFairnessScore(d, currentTime);
       const waitTimeMinutes = Math.floor((currentTime - d.joinedQueueTime) / 60000);
       
       // Generate Tags dynamically based on real attributes
       const tags = [];
       if (d.rating >= 4.8) tags.push('ดาวรุ่ง (Top Rated)');
       if (d.totalTrips > 15) tags.push('ขยัน (High Trips)');
       if (d.status !== 'IDLE') tags.push(d.status);

       return {
         ...d,
         realScore: score,
         waitTimeMinutes,
         tags
       };
    });

    // 3. Sort by Score Descending (Highest Score = Rank 1)
    // Busy drivers go to bottom
    mapped.sort((a, b) => {
        if (a.status !== 'IDLE' && b.status === 'IDLE') return 1;
        if (a.status === 'IDLE' && b.status !== 'IDLE') return -1;
        return b.realScore - a.realScore;
    });

    return mapped.map((item, index) => ({
        ...item,
        rank: index + 1
    }));

  }, [drivers, selectedWin]); // Re-calculate whenever simulation updates drivers

  const handleOpenOverride = (driverId: string) => {
    setSelectedDriver(driverId);
    setOverrideReason('');
    setIsModalOpen(true);
  };

  const submitOverride = () => {
    if (!selectedDriver) return;
    onOverrideQueue(selectedDriver, overrideReason);
    setIsModalOpen(false);
  };

  return (
    <div className="flex-1 bg-slate-950 p-6 flex flex-col h-full overflow-hidden font-sans">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-100">ระบบตรวจสอบคิว (Queue Monitor)</h2>
          <p className="text-emerald-400 text-sm flex items-center gap-2">
             <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
             เชื่อมต่อข้อมูลจริง (Live Simulation)
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
             <div className="text-xs text-slate-500">จำนวนคิว</div>
             <div className="text-sm font-mono text-white">{queueData.filter(d => d.status === 'IDLE').length} คัน</div>
          </div>
          <select 
            value={selectedWin}
            onChange={(e) => setSelectedWin(e.target.value)}
            className="bg-slate-800 border border-slate-700 text-slate-200 rounded px-3 py-2 text-sm focus:outline-none focus:border-emerald-500"
          >
            {STATION_ZONES.map(station => (
                <option key={station.id} value={station.id}>วิน: {station.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Table Container */}
      <div className="flex-1 bg-slate-900 border border-slate-800 rounded-lg overflow-hidden flex flex-col shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-400">
            <thead className="bg-slate-800 text-slate-200 uppercase text-xs font-semibold tracking-wider">
              <tr>
                <th className="px-6 py-3">อันดับ</th>
                <th className="px-6 py-3">รหัสคนขับ</th>
                <th className="px-6 py-3">สถานะ</th>
                <th className="px-6 py-3">คะแนน (Score)</th>
                <th className="px-6 py-3">เวลารอ</th>
                <th className="px-6 py-3">ข้อมูลเชิงลึก</th>
                <th className="px-6 py-3 text-right">จัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {queueData.length === 0 ? (
                  <tr>
                      <td colSpan={7} className="px-6 py-10 text-center text-slate-500">
                          ไม่พบคนขับในวินนี้ (อาจกำลังวิ่งรับงาน หรือยังไม่ล็อกอิน)
                      </td>
                  </tr>
              ) : (
                queueData.map((item) => (
                    <tr key={item.id} className={`transition-colors ${item.status === 'IDLE' ? 'hover:bg-slate-800/50' : 'bg-slate-900/30 opacity-60'}`}>
                    <td className="px-6 py-4 font-medium text-slate-200">
                        {item.status === 'IDLE' ? `#${item.rank}` : '-'}
                    </td>
                    <td className="px-6 py-4 font-mono text-emerald-400">
                        {item.id}
                    </td>
                    <td className="px-6 py-4">
                        <span className={`text-[10px] px-2 py-1 rounded font-bold ${
                            item.status === 'IDLE' ? 'bg-emerald-900/50 text-emerald-400' :
                            item.status === 'MATCHED' ? 'bg-blue-900/50 text-blue-400' :
                            'bg-amber-900/50 text-amber-400'
                        }`}>
                            {item.status}
                        </span>
                    </td>
                    <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                        <span className={`font-bold ${item.realScore > 50 ? 'text-white' : 'text-slate-400'}`}>
                            {item.realScore.toFixed(2)}
                        </span>
                        {/* Visual Bar relative to 100 max score */}
                        <div className="w-16 h-1 bg-slate-700 rounded-full overflow-hidden">
                            <div 
                                className="h-full bg-emerald-500" 
                                style={{ width: `${Math.min(100, item.realScore)}%` }} 
                            />
                        </div>
                        </div>
                    </td>
                    <td className="px-6 py-4 text-slate-300">
                        {item.status === 'IDLE' ? `${item.waitTimeMinutes} นาที` : '-'}
                    </td>
                    <td className="px-6 py-4">
                        {item.tags.map(tag => (
                        <span key={tag} className="inline-block bg-indigo-900/50 text-indigo-300 text-[10px] px-2 py-0.5 rounded border border-indigo-700/50 mr-1">
                            {tag}
                        </span>
                        ))}
                    </td>
                    <td className="px-6 py-4 text-right">
                        {item.status === 'IDLE' && item.rank > 1 && (
                        <button 
                            onClick={() => handleOpenOverride(item.id)}
                            className="text-amber-500 hover:text-amber-400 font-medium text-xs border border-amber-500/30 hover:bg-amber-500/10 px-3 py-1.5 rounded transition"
                        >
                            ลัดคิว
                        </button>
                        )}
                    </td>
                    </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        
        {/* Fairness Algorithm Legend */}
        <div className="p-4 bg-slate-900 border-t border-slate-800 text-xs text-slate-500 flex gap-6 justify-end">
            <div>Algorithm Weights:</div>
            <div className="flex items-center gap-1"><span className="w-2 h-2 bg-emerald-500 rounded-full"></span> Wait Time: {(FAIRNESS_WEIGHTS.IDLE * 100).toFixed(0)}%</div>
            <div className="flex items-center gap-1"><span className="w-2 h-2 bg-blue-500 rounded-full"></span> Recency: {(FAIRNESS_WEIGHTS.RECENCY * 100).toFixed(0)}%</div>
            <div className="flex items-center gap-1"><span className="w-2 h-2 bg-amber-500 rounded-full"></span> Trip Eq: {(FAIRNESS_WEIGHTS.TRIPS * 100).toFixed(0)}%</div>
            <div className="flex items-center gap-1"><span className="w-2 h-2 bg-yellow-500 rounded-full"></span> Rating: {(FAIRNESS_WEIGHTS.RATING * 100).toFixed(0)}%</div>
        </div>
      </div>

      {/* Override Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 p-6 rounded-lg w-96 shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-2">ปรับลำดับคิวพิเศษ (Override)</h3>
            <p className="text-slate-400 text-sm mb-4">
              คุณกำลังจะย้ายคนขับ <span className="text-emerald-400 font-mono">{selectedDriver}</span> ขึ้นเป็นอันดับ 1 ของคิวทันที
            </p>
            
            <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">เหตุผล (จำเป็น)</label>
            <textarea 
              value={overrideReason}
              onChange={(e) => setOverrideReason(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-slate-200 text-sm focus:border-amber-500 focus:outline-none mb-4"
              rows={3}
              placeholder="เช่น ชดเชยงานที่แล้ว, แก้ไขปัญหาระบบ..."
            />

            <div className="flex justify-end gap-2">
              <button 
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 text-slate-400 hover:text-white text-sm"
              >
                ยกเลิก
              </button>
              <button 
                onClick={submitOverride}
                disabled={!overrideReason.trim()}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-bold rounded"
              >
                ยืนยันการลัดคิว
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminQueueDashboard;
