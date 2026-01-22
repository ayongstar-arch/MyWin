import React from 'react';
import { APP_LOGO_PATH } from '../constants';

interface DriverDownloadPageProps {
  onOpenWebApp?: () => void;
}

const DriverDownloadPage: React.FC<DriverDownloadPageProps> = ({ onOpenWebApp }) => {
  const handleDownload = () => {
    alert('เริ่มการดาวน์โหลดไฟล์: mywin-driver-v1.0.2.apk');
    // In production: window.location.href = '/download/latest.apk';
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center text-slate-900 font-sans">
      {/* Mobile Frame Container */}
      <div className="w-full max-w-md bg-white min-h-screen shadow-xl flex flex-col relative overflow-hidden">
        
        {/* Brand Background Accent */}
        <div className="absolute top-0 left-0 w-full h-64 bg-mywin-orange rounded-b-[3rem] z-0"></div>

        {/* Header Section */}
        <header className="relative z-10 pt-16 pb-6 px-6 text-center">
            {/* Logo */}
            <div className="w-28 h-28 mx-auto flex flex-col items-center justify-center shadow-2xl mb-6 rounded-3xl bg-white p-2">
                 <img src={APP_LOGO_PATH} alt="MyWin Logo" className="w-full h-full object-contain rounded-2xl" />
            </div>

            {/* SEO H1 Tag: The most important tag for AI/Search */}
            <h1 className="text-orange-100 text-lg font-bold mt-4 leading-relaxed">
                MyWin แอปเรียกวินมอเตอร์ไซค์<br/>เชื่อมต่อชุมชน
            </h1>
        </header>

        {/* Content Card */}
        <main className="relative z-10 flex-1 bg-white rounded-t-[2.5rem] mt-4 px-6 pt-10 pb-6 shadow-[-10px_-10px_30px_rgba(0,0,0,0.05)]">
            
            {/* SEO H2 Tag: Secondary Keyword Target */}
            <h2 className="text-xl font-bold text-slate-800 text-center mb-6">
                ยินดีต้อนรับพาร์ทเนอร์วิน
            </h2>

            {/* Main Action Section */}
            <div className="space-y-4">
                {/* Option 1: Web App (Instant) */}
                <button 
                    onClick={onOpenWebApp}
                    className="w-full bg-mywin-green hover:bg-emerald-600 active:bg-emerald-700 text-white text-xl font-bold py-5 rounded-2xl shadow-lg shadow-emerald-200 transition-all active:scale-95 flex items-center justify-center gap-3 relative overflow-hidden"
                    aria-label="ใช้งาน MyWin ผ่านเว็บทันที"
                >
                    <div className="absolute top-0 right-0 bg-yellow-400 text-yellow-900 text-[10px] px-2 py-1 rounded-bl-lg font-bold">
                        แนะนำ
                    </div>
                    <span>🚀</span> ใช้งานผ่านเว็บทันที
                </button>

                {/* Option 2: Android APK */}
                <button 
                    onClick={handleDownload}
                    className="w-full bg-white border-2 border-slate-100 text-slate-500 font-bold py-4 rounded-2xl active:bg-slate-50 transition-all flex items-center justify-center gap-2 hover:border-slate-300 hover:text-slate-600"
                    aria-label="ดาวน์โหลดแอป MyWin สำหรับ Android"
                >
                    <span>📥</span> ดาวน์โหลด APK (Android)
                </button>
            </div>

            {/* Info List - Structured for Readability */}
            <section className="mt-8 space-y-4 px-2">
                <div className="flex items-center gap-4 text-slate-600">
                    <div className="w-10 h-10 rounded-full bg-orange-50 flex items-center justify-center text-mywin-orange text-xl">
                        💰
                    </div>
                    <div>
                        <h3 className="font-bold text-slate-800 text-sm">รายได้ดี มีมาตรฐาน</h3>
                        <p className="text-xs text-slate-400">ระบบคิวเป็นธรรม ไม่ต้องแย่งงาน</p>
                    </div>
                </div>
                <div className="flex items-center gap-4 text-slate-600">
                    <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-mywin-blue text-xl">
                        🛡️
                    </div>
                    <div>
                        <h3 className="font-bold text-slate-800 text-sm">มั่นใจ ปลอดภัย</h3>
                        <p className="text-xs text-slate-400">มีระบบยืนยันตัวตนคนขับ</p>
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer className="mt-auto pt-10 text-center">
                <div className="inline-block px-4 py-1 bg-slate-50 rounded-full text-[10px] text-slate-400">
                    MyWin Driver System v1.0.2
                </div>
            </footer>
        </main>
      </div>
    </div>
  );
};

export default DriverDownloadPage;