import React, { useEffect, useState } from 'react';
import { APP_LOGO_PATH } from '../constants';
import InstallPwaPrompt from './InstallPwaPrompt';

const LandingPage: React.FC = () => {
  const [referrer, setReferrer] = useState<string | null>(null);

  useEffect(() => {
      // Simple parse for ref param (e.g., #landing?ref=D-123 or just ?ref=D-123 in standard url)
      // Since we use hash routing mostly, we check both
      const urlParams = new URLSearchParams(window.location.search);
      let ref = urlParams.get('ref');
      
      // Also check hash string if params are embedded there (e.g. #landing?ref=...)
      if (!ref && window.location.hash.includes('?')) {
          const hashParams = new URLSearchParams(window.location.hash.split('?')[1]);
          ref = hashParams.get('ref');
      }

      if (ref) {
          setReferrer(ref);
      }
  }, []);

  const openPassenger = () => {
    window.location.hash = '#passenger';
    window.location.reload(); 
  };

  const openDriver = () => {
    window.location.hash = '#driver';
    window.location.reload();
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6 font-sans relative overflow-hidden">
      {/* Background Ambience */}
      <div className="absolute top-0 left-0 w-full h-1/2 bg-gradient-to-b from-slate-800 to-slate-900 z-0"></div>
      <div className="absolute top-[-20%] right-[-20%] w-96 h-96 bg-mywin-orange/10 rounded-full blur-3xl"></div>
      <div className="absolute bottom-[-20%] left-[-20%] w-96 h-96 bg-mywin-green/10 rounded-full blur-3xl"></div>

      <div className="relative z-10 w-full max-w-md bg-white/5 backdrop-blur-xl border border-white/10 p-8 rounded-3xl shadow-2xl mb-16">
        
        {/* Header */}
        <div className="text-center mb-8">
            <div className="w-24 h-24 mx-auto mb-6 bg-white rounded-3xl p-2 shadow-lg shadow-orange-500/20">
                <img src={APP_LOGO_PATH} alt="MyWin" className="w-full h-full object-contain rounded-2xl" />
            </div>
            
            {referrer ? (
                <div className="bg-emerald-900/30 border border-emerald-500/30 rounded-xl p-3 mb-4 animate-in slide-in-from-top-4">
                    <div className="text-xs text-emerald-400 font-bold uppercase tracking-wide mb-1">คำเชิญพิเศษจาก</div>
                    <div className="text-white font-bold text-lg flex items-center justify-center gap-2">
                        <span className="text-2xl">🛵</span> พี่วินรหัส {referrer}
                    </div>
                </div>
            ) : (
                <>
                    <h1 className="text-3xl font-bold text-white mb-2">ยินดีต้อนรับสู่ MyWin</h1>
                    <p className="text-slate-400 text-sm">แอปเรียกวินมอเตอร์ไซค์ ดูแลโดยชุมชน</p>
                </>
            )}
        </div>

        {/* Action Buttons */}
        <div className="space-y-4">
            <button 
                onClick={openPassenger}
                className="w-full group relative overflow-hidden bg-white hover:bg-slate-50 text-slate-900 p-6 rounded-2xl shadow-lg transition-all active:scale-95 text-left flex items-center justify-between"
            >
                <div className="relative z-10">
                    <div className="text-xs font-bold text-mywin-blue uppercase tracking-wider mb-1">สำหรับผู้ใช้งาน</div>
                    <div className="text-xl font-bold">🙋‍♂️ เรียกวินมอเตอร์ไซค์</div>
                </div>
                <div className="text-3xl group-hover:translate-x-1 transition-transform">→</div>
                <div className="absolute right-0 bottom-0 opacity-10 text-6xl rotate-12 -mr-4 -mb-4">🛵</div>
            </button>

            <button 
                onClick={openDriver}
                className="w-full group relative overflow-hidden bg-slate-800 hover:bg-slate-750 text-white p-6 rounded-2xl shadow-lg border border-slate-700 transition-all active:scale-95 text-left flex items-center justify-between"
            >
                <div className="relative z-10">
                    <div className="text-xs font-bold text-mywin-green uppercase tracking-wider mb-1">สำหรับพี่วิน</div>
                    <div className="text-xl font-bold">👷 รับงาน / ลงทะเบียน</div>
                </div>
                <div className="text-3xl text-slate-500 group-hover:text-white group-hover:translate-x-1 transition-all">→</div>
                 <div className="absolute right-0 bottom-0 opacity-10 text-6xl rotate-12 -mr-4 -mb-4">🛡️</div>
            </button>
        </div>

        {/* Footer Info */}
        <div className="mt-10 text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-800/50 border border-slate-700/50">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <span className="text-[10px] text-slate-400">ระบบออนไลน์พร้อมให้บริการ</span>
            </div>
            <p className="text-[10px] text-slate-600 mt-4">
                © 2024 MyWin Community Project<br/>
                เรียกง่าย • ปลอดภัย • ไม่เอาเปรียบ
            </p>
        </div>
      </div>

      {/* Install PWA Prompt */}
      <InstallPwaPrompt />
    </div>
  );
};

export default LandingPage;