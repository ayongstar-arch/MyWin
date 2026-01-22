import React from 'react';
import { MatchLog } from '../types';

interface DispatchLogPanelProps {
  logs: MatchLog[];
}

const DispatchLogPanel: React.FC<DispatchLogPanelProps> = ({ logs }) => {
  return (
    <div className="flex flex-col h-full bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
      <div className="bg-slate-900 px-4 py-3 border-b border-slate-700 font-semibold text-slate-100 flex justify-between items-center">
        <span>ประวัติการจับคู่</span>
        <span className="text-xs bg-slate-700 px-2 py-1 rounded text-slate-400">สด (Live)</span>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {logs.length === 0 && (
          <div className="text-center text-slate-500 mt-10 text-sm">ยังไม่มีการจับคู่...</div>
        )}
        {logs.slice().reverse().map((log) => {
          const isSole = log.reason.includes('ยืนหนึ่ง');
          
          return (
            <div key={log.id} className={`p-3 rounded border text-xs transition-colors ${isSole ? 'bg-slate-900/50 border-slate-700/50' : 'bg-slate-800 border-slate-600'}`}>
              <div className="flex justify-between mb-1">
                <span className="text-emerald-400 font-mono">งาน #{log.id.slice(0, 4)}</span>
                <span className="text-slate-500">{new Date(log.timestamp).toLocaleTimeString()}</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-slate-300 mb-2">
                <div>รอ: <span className={log.riderWaitTime > 30 ? "text-red-400 font-bold" : "text-slate-100"}>{log.riderWaitTime} วิ</span></div>
                <div>ระยะ: <span className="text-slate-100">{log.distance} กม.</span></div>
              </div>
              
              <div className="pt-2 border-t border-slate-700/50">
                 <div className="flex justify-between items-center mb-1">
                    <span className="text-slate-400">คะแนนคิว: {log.fairnessScore}</span>
                    {isSole ? (
                        <span className="bg-blue-900/30 text-blue-300 text-[10px] px-1.5 py-0.5 rounded border border-blue-500/20">
                            ⚡ ไร้คู่แข่ง
                        </span>
                    ) : (
                        <span className="bg-amber-900/30 text-amber-300 text-[10px] px-1.5 py-0.5 rounded border border-amber-500/20">
                            🏆 ชนะโหวต
                        </span>
                    )}
                 </div>
                 <div className="italic text-slate-500 text-[10px] truncate" title={log.reason}>
                     {log.reason}
                 </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default DispatchLogPanel;