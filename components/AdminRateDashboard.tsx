import React, { useState, useMemo } from 'react';

type AdminTab = 'MANAGE' | 'CREATE' | 'PERFORMANCE' | 'AI_ANALYST' | 'FINANCE' | 'ACCOUNTING';
type ReportPeriod = 'DAILY' | 'MONTHLY' | 'YEARLY';

interface PromotionRule {
  id: string;
  name: string;
  type: 'TOPUP_BONUS' | 'RIDE_DISCOUNT';
  description: string;
  active: boolean;
  startDate?: string;
  endDate?: string;
  maxTotalUsage: number;
  currentTotalUsage: number;
  stats: {
    usersCount: number;
    totalPointsGiven: number;
    estimatedRevenueGenerated: number;
  };
}

interface AIAnalysisResult {
    promoId: string;
    roiPercent: number;
    status: 'GREEN' | 'YELLOW' | 'RED';
    reason: string;
    suggestion: string;
}

interface PaymentMethod {
    id: string;
    type: 'BANK' | 'PROMPTPAY' | 'QR';
    providerName: string; 
    accountName: string;
    accountNumber: string;
    qrImage?: string;
    isActive: boolean;
}

// Accounting Types
interface AccountingTxn {
    id: string;
    timestamp: string;
    userId: string;
    amount: number;
    pointsGiven: number;
    channel: 'PROMPTPAY' | 'BANK_TRANSFER' | 'CREDIT_CARD';
    status: 'RECONCILED' | 'PENDING' | 'FAILED';
    referenceNo: string;
}

const AdminRateDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<AdminTab>('ACCOUNTING');
  
  // Accounting State
  const [reportPeriod, setReportPeriod] = useState<ReportPeriod>('DAILY');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]); // YYYY-MM-DD
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString()); // YYYY

  // Mock Data Generators
  const getMockData = () => {
      // 1. Generate KPIs & Chart Data based on Period
      let kpi = { revenue: 0, txns: 0, growth: 0 };
      let chartData: { label: string, value: number, height: number }[] = [];
      let tableData: any[] = [];
      let tableColumns: string[] = [];

      if (reportPeriod === 'DAILY') {
          // Daily: View Hourly Trend & Individual Transactions
          kpi = { revenue: 12500, txns: 85, growth: 12 };
          const hours = ['08:00', '10:00', '12:00', '14:00', '16:00', '18:00', '20:00'];
          chartData = hours.map(h => {
              const val = Math.floor(Math.random() * 5000);
              return { label: h, value: val, height: (val/5000)*100 };
          });
          
          tableColumns = ['เวลา (Time)', 'เลขที่เอกสาร (Ref)', 'ผู้ใช้งาน (User)', 'ช่องทาง', 'ยอดเงิน (THB)', 'สถานะ'];
          // Mock Transactions
          tableData = Array.from({length: 10}).map((_, i) => ({
              id: `TXN-${Date.now()-i*10000}`,
              col1: `${10+i}:30`, // Time
              col2: `INV-2024-${100+i}`, // Ref
              col3: `081-xxx-xx${i}${i}`, // User
              col4: i % 2 === 0 ? 'PROMPTPAY' : 'BANK', // Channel
              col5: (Math.random() * 500).toFixed(2), // Amount
              status: i === 0 ? 'PENDING' : 'RECONCILED'
          }));

      } else if (reportPeriod === 'MONTHLY') {
          // Monthly: View Daily Trend & Daily Aggregates
          kpi = { revenue: 450000, txns: 2400, growth: 5.4 };
          const days = ['1', '5', '10', '15', '20', '25', '30'];
          chartData = days.map(d => {
              const val = Math.floor(Math.random() * 20000);
              return { label: d, value: val, height: (val/20000)*100 };
          });

          tableColumns = ['วันที่ (Date)', 'รายการทั้งหมด (Txns)', 'PromptPay', 'Bank Transfer', 'ยอดรวมสุทธิ (Net Revenue)', 'สถานะปิดยอด'];
          // Mock Daily Rows
          tableData = Array.from({length: 15}).map((_, i) => {
              const day = i + 1;
              const revenue = 10000 + Math.random() * 5000;
              return {
                  id: `DAY-${day}`,
                  col1: `${day}/${selectedMonth.split('-')[1]}`, // Date
                  col2: Math.floor(50 + Math.random() * 50), // Total Txns
                  col3: '60%', // PP
                  col4: '40%', // Bank
                  col5: revenue.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2}),
                  status: 'CLOSED'
              };
          });

      } else {
          // Yearly: View Monthly Trend & Monthly Aggregates
          kpi = { revenue: 5400000, txns: 28000, growth: 15 };
          const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul'];
          chartData = months.map(m => {
              const val = Math.floor(Math.random() * 500000);
              return { label: m, value: val, height: (val/500000)*100 };
          });

          tableColumns = ['เดือน (Month)', 'รายการ (Txns)', 'New Users', 'Refunds', 'รายได้รวม (Revenue)', 'Audit'];
          tableData = months.map((m, i) => ({
              id: `M-${i}`,
              col1: m,
              col2: (2000 + Math.random()*500).toFixed(0),
              col3: `+${(Math.random()*100).toFixed(0)}`,
              col4: `${(Math.random()*5).toFixed(0)} รายการ`,
              col5: (400000 + Math.random()*100000).toLocaleString(),
              status: 'AUDITED'
          }));
      }

      return { kpi, chartData, tableData, tableColumns };
  };

  const reportData = useMemo(() => getMockData(), [reportPeriod, selectedDate, selectedMonth, selectedYear]);

  // Promotions State (Existing)
  const [promotions, setPromotions] = useState<PromotionRule[]>([
    {
      id: 'P1',
      name: 'เติม 50 แถม 10',
      type: 'TOPUP_BONUS',
      description: 'Top-up 50 THB get 10 Points',
      active: true,
      startDate: '2025-01-01',
      endDate: '2025-01-31',
      maxTotalUsage: 1000,
      currentTotalUsage: 124,
      stats: { usersCount: 124, totalPointsGiven: 1240, estimatedRevenueGenerated: 6200 }
    },
    {
      id: 'P2',
      name: 'ฟรี 3 ครั้งแรก',
      type: 'RIDE_DISCOUNT',
      description: 'First 3 Rides Free for new users',
      active: true,
      maxTotalUsage: 500,
      currentTotalUsage: 135,
      stats: { usersCount: 45, totalPointsGiven: 170, estimatedRevenueGenerated: 0 }
    }
  ]);

  // Payment Methods State (Existing)
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([
      { id: 'PM-1', type: 'PROMPTPAY', providerName: 'PromptPay', accountName: 'บจก. มายวิน เทคโนโลยี', accountNumber: '081-234-5678', isActive: true },
      { id: 'PM-2', type: 'BANK', providerName: 'Kasikorn Bank (KBANK)', accountName: 'บจก. มายวิน เทคโนโลยี', accountNumber: '123-4-56789-0', isActive: true }
  ]);
  const [newPayment, setNewPayment] = useState<Partial<PaymentMethod>>({ type: 'BANK', providerName: '', accountName: '', accountNumber: '', isActive: true });

  // AI State
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiResults, setAiResults] = useState<AIAnalysisResult[] | null>(null);

  // Create Form State
  const [newPromo, setNewPromo] = useState({
    name: '',
    type: 'TOPUP_BONUS' as 'TOPUP_BONUS' | 'RIDE_DISCOUNT',
    minAmount: 50,
    bonus: 10,
    isFree: false,
    limitPerUser: 1,
    maxTotalUsage: 100, 
    startDate: new Date().toISOString().split('T')[0],
    endDate: '',
    startTime: '',
    endTime: '',
    areaId: ''
  });

  const estimatedMaxCost = newPromo.type === 'TOPUP_BONUS' 
     ? newPromo.bonus * newPromo.maxTotalUsage
     : (newPromo.isFree ? 2 * newPromo.maxTotalUsage : 0);

  const togglePromo = (id: string) => {
    setPromotions(prev => prev.map(p => p.id === id ? { ...p, active: !p.active } : p));
  };

  const handleCreate = () => {
      const p: PromotionRule = {
          id: `P${Date.now()}`,
          name: newPromo.name || 'Untitled',
          type: newPromo.type,
          description: newPromo.type === 'TOPUP_BONUS' ? `เติม ${newPromo.minAmount} แถม ${newPromo.bonus}` : 'ส่วนลดพิเศษ',
          active: true,
          startDate: newPromo.startDate,
          endDate: newPromo.endDate,
          maxTotalUsage: newPromo.maxTotalUsage,
          currentTotalUsage: 0,
          stats: { usersCount: 0, totalPointsGiven: 0, estimatedRevenueGenerated: 0 }
      };
      setPromotions([...promotions, p]);
      setActiveTab('MANAGE');
  };

  const handleAddPayment = () => {
      if (!newPayment.accountNumber || !newPayment.accountName) return;
      const method: PaymentMethod = {
          id: `PM-${Date.now()}`,
          type: newPayment.type || 'BANK',
          providerName: newPayment.providerName || 'Bank',
          accountName: newPayment.accountName!,
          accountNumber: newPayment.accountNumber!,
          qrImage: newPayment.qrImage,
          isActive: true
      };
      setPaymentMethods([...paymentMethods, method]);
      setNewPayment({ type: 'BANK', providerName: '', accountName: '', accountNumber: '', isActive: true });
  };

  const togglePayment = (id: string) => {
      setPaymentMethods(prev => prev.map(p => p.id === id ? { ...p, isActive: !p.isActive } : p));
  };

  const handleDeletePayment = (id: string) => {
      if (confirm('คุณต้องการลบช่องทางการชำระเงินนี้ใช่หรือไม่?')) {
          setPaymentMethods(prev => prev.filter(p => p.id !== id));
      }
  };

  const runAIAnalysis = async () => {
      setIsAnalyzing(true);
      setTimeout(() => {
          const results: AIAnalysisResult[] = promotions.map(p => {
              const cost = p.stats.totalPointsGiven;
              const rev = p.stats.estimatedRevenueGenerated;
              const roi = cost > 0 ? ((rev - cost) / cost) * 100 : 0;
              let status: 'GREEN' | 'YELLOW' | 'RED' = 'YELLOW';
              let reason = '';
              let suggestion = '';

              if (roi > 30) {
                  status = 'GREEN';
                  reason = 'ผลตอบรับดีมาก ลูกค้าเติมเงินคุ้มค่าต้นทุน';
                  suggestion = 'ควรทำต่อ หรือขยายเวลาโปรโมชัน';
              } else if (roi < 0) {
                  status = 'RED';
                  reason = 'ต้นทุนสูงเกินรายได้ที่เพิ่มขึ้น ลูกค้าใช้แล้วไม่กลับมาซ้ำ';
                  suggestion = 'ควรหยุดโปรโมชันทันที';
              } else {
                  reason = 'ได้ผลปานกลาง แต่ยังไม่คุ้มทุนชัดเจน';
                  suggestion = 'ควรปรับลดแต้มแจก หรือจำกัดเฉพาะกลุ่ม';
              }
              return { promoId: p.id, roiPercent: roi, status, reason, suggestion };
          });
          setAiResults(results);
          setIsAnalyzing(false);
      }, 1500);
  };

  // --- RENDERERS ---

  const renderAccountingReport = () => {
      const { kpi, chartData, tableData, tableColumns } = reportData;

      return (
          <div className="space-y-6 animate-in slide-in-from-right duration-300">
              {/* Header & Controls */}
              <div className="flex flex-col md:flex-row justify-between items-end md:items-center gap-4">
                  <div>
                      <h3 className="text-xl font-bold text-white">รายงานสรุปยอดบัญชี (Accounting Report)</h3>
                      <p className="text-xs text-slate-400">ตรวจสอบรายได้และการกระทบยอดตามมาตรฐานบัญชี</p>
                  </div>
                  
                  <div className="flex flex-col items-end gap-2">
                      <div className="flex bg-slate-900 p-1 rounded-lg border border-slate-700">
                          <button onClick={() => setReportPeriod('DAILY')} className={`px-4 py-1.5 rounded text-xs font-bold transition-all ${reportPeriod === 'DAILY' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-slate-200'}`}>รายวัน</button>
                          <button onClick={() => setReportPeriod('MONTHLY')} className={`px-4 py-1.5 rounded text-xs font-bold transition-all ${reportPeriod === 'MONTHLY' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-slate-200'}`}>รายเดือน</button>
                          <button onClick={() => setReportPeriod('YEARLY')} className={`px-4 py-1.5 rounded text-xs font-bold transition-all ${reportPeriod === 'YEARLY' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-slate-200'}`}>รายปี</button>
                      </div>
                      
                      <div className="flex gap-2">
                          {reportPeriod === 'DAILY' && <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} className="bg-slate-800 border border-slate-600 text-white text-xs p-2 rounded-lg outline-none focus:border-emerald-500" />}
                          {reportPeriod === 'MONTHLY' && <input type="month" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} className="bg-slate-800 border border-slate-600 text-white text-xs p-2 rounded-lg outline-none focus:border-emerald-500" />}
                          {reportPeriod === 'YEARLY' && (
                              <select value={selectedYear} onChange={e => setSelectedYear(e.target.value)} className="bg-slate-800 border border-slate-600 text-white text-xs p-2 rounded-lg outline-none focus:border-emerald-500">
                                  {[2023, 2024, 2025].map(y => <option key={y} value={y}>{y}</option>)}
                              </select>
                          )}
                          <button className="bg-emerald-700 hover:bg-emerald-600 text-white px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-2 shadow-lg">
                              📥 Export
                          </button>
                      </div>
                  </div>
              </div>

              {/* KPI Cards */}
              <div className="grid grid-cols-3 gap-4">
                  <div className="bg-slate-800 p-4 rounded-xl border border-slate-700">
                      <div className="text-xs text-slate-400 font-bold uppercase mb-1">
                          {reportPeriod === 'DAILY' ? 'รายรับวันนี้ (Daily Revenue)' : reportPeriod === 'MONTHLY' ? 'รายรับเดือนนี้ (Monthly Revenue)' : 'รายรับปีนี้ (Yearly Revenue)'}
                      </div>
                      <div className="text-3xl font-bold text-emerald-400">฿{kpi.revenue.toLocaleString()}</div>
                      <div className="text-[10px] text-emerald-500/80 mt-1">▲ +{kpi.growth}% Growth</div>
                  </div>
                  <div className="bg-slate-800 p-4 rounded-xl border border-slate-700">
                      <div className="text-xs text-slate-400 font-bold uppercase mb-1">จำนวนรายการ (Transactions)</div>
                      <div className="text-3xl font-bold text-white">{kpi.txns.toLocaleString()}</div>
                      <div className="text-[10px] text-slate-500 mt-1">เฉลี่ย ฿{(kpi.revenue/kpi.txns || 0).toFixed(0)} ต่อรายการ</div>
                  </div>
                  <div className="bg-slate-800 p-4 rounded-xl border border-slate-700">
                      <div className="text-xs text-slate-400 font-bold uppercase mb-1">สถานะปิดบัญชี (Audit Status)</div>
                      <div className="text-2xl font-bold text-blue-400 mt-1">{reportPeriod === 'DAILY' ? 'OPEN' : 'AUDITED'}</div>
                      <div className="text-[10px] text-slate-500 mt-1">
                          {reportPeriod === 'DAILY' ? 'รอตรวจสอบสิ้นวัน' : 'ตรวจสอบเรียบร้อย'}
                      </div>
                  </div>
              </div>

              {/* Dynamic Chart */}
              <div className="bg-slate-800 p-6 rounded-xl border border-slate-700">
                  <h4 className="font-bold text-white mb-4 text-sm flex justify-between">
                      <span>แนวโน้มรายได้ ({reportPeriod})</span>
                      <span className="text-xs text-slate-500 font-normal">หน่วย: THB</span>
                  </h4>
                  <div className="h-40 flex items-end gap-4 justify-between px-2">
                      {chartData.map((d, i) => (
                          <div key={i} className="flex-1 flex flex-col items-center gap-2 group cursor-pointer">
                              <div className="relative w-full h-full flex items-end justify-center">
                                  {/* Tooltip */}
                                  <div className="absolute -top-8 bg-slate-900 text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10 border border-slate-600 shadow-lg">
                                      {d.label}: ฿{d.value.toLocaleString()}
                                  </div>
                                  <div className="w-full bg-emerald-900/50 rounded-t-sm relative overflow-hidden h-full">
                                      <div className="absolute bottom-0 w-full bg-emerald-500 hover:bg-emerald-400 transition-all duration-500" style={{ height: `${d.height}%` }}></div>
                                  </div>
                              </div>
                              <span className="text-[10px] text-slate-500 font-mono">{d.label}</span>
                          </div>
                      ))}
                  </div>
              </div>

              {/* Dynamic Table */}
              <div className="bg-slate-900 border border-slate-700 rounded-xl overflow-hidden shadow-lg">
                  <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-800/50">
                      <h4 className="font-bold text-slate-200 text-sm">รายละเอียด (Details)</h4>
                      <button className="text-xs text-mywin-blue hover:underline">ดูทั้งหมด</button>
                  </div>
                  <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm text-slate-400">
                          <thead className="bg-slate-950 text-xs uppercase font-semibold text-slate-500 sticky top-0">
                              <tr>
                                  {tableColumns.map((col, idx) => (
                                      <th key={idx} className={`p-4 ${idx >= 4 ? 'text-right' : ''}`}>{col}</th>
                                  ))}
                              </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-800">
                              {tableData.map((row) => (
                                  <tr key={row.id} className="hover:bg-slate-800/30 transition-colors">
                                      <td className="p-4 font-mono text-xs text-slate-300">{row.col1}</td>
                                      <td className="p-4 text-xs font-bold">{row.col2}</td>
                                      <td className="p-4 text-xs">{row.col3}</td>
                                      <td className="p-4 text-xs">
                                          {reportPeriod === 'DAILY' ? (
                                              <span className={`text-[10px] px-2 py-1 rounded font-bold border ${row.col4 === 'PROMPTPAY' ? 'bg-blue-900/20 border-blue-800 text-blue-400' : 'bg-green-900/20 border-green-800 text-green-400'}`}>
                                                  {row.col4}
                                              </span>
                                          ) : row.col4}
                                      </td>
                                      <td className="p-4 text-right font-bold text-white">{row.col5}</td>
                                      <td className="p-4 text-right">
                                          {row.status === 'RECONCILED' || row.status === 'AUDITED' || row.status === 'CLOSED' ? 
                                              <span className="text-emerald-500 text-[10px] font-bold">✔ OK</span> : 
                                              <span className="text-amber-500 text-[10px] font-bold">● Pending</span>
                                          }
                                      </td>
                                  </tr>
                              ))}
                          </tbody>
                      </table>
                  </div>
              </div>
          </div>
      );
  };

  const renderManage = () => (
    <div className="space-y-4">
      {promotions.map(p => {
         const usagePercent = p.maxTotalUsage > 0 ? (p.currentTotalUsage / p.maxTotalUsage) * 100 : 0;
         const isExpired = p.endDate && new Date(p.endDate) < new Date();
         
         return (
            <div key={p.id} className={`bg-slate-800 p-4 rounded-xl border ${p.active && !isExpired ? 'border-emerald-500/30' : 'border-slate-700 opacity-75'}`}>
              <div className="flex justify-between items-start mb-2">
                <div>
                  <div className="flex items-center gap-2">
                     <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${p.type === 'TOPUP_BONUS' ? 'bg-blue-900 text-blue-200' : 'bg-purple-900 text-purple-200'}`}>
                       {p.type === 'TOPUP_BONUS' ? 'เติมเงิน' : 'ส่วนลด'}
                     </span>
                     <h3 className="font-bold text-lg text-white">{p.name}</h3>
                     {isExpired && <span className="bg-slate-700 text-slate-400 text-[10px] px-2 py-0.5 rounded">หมดอายุ</span>}
                     {!p.active && <span className="bg-red-900/50 text-red-400 text-[10px] px-2 py-0.5 rounded">STOPPED</span>}
                  </div>
                  <p className="text-slate-400 text-sm mt-1">{p.description}</p>
                </div>
                
                <button 
                  onClick={() => togglePromo(p.id)}
                  className={`px-3 py-1.5 rounded-lg font-bold text-xs transition-all ${p.active ? 'bg-slate-700 text-slate-300 hover:bg-red-900 hover:text-red-300' : 'bg-emerald-600 text-white'}`}
                >
                  {p.active ? 'ปิด (Stop)' : 'เปิด (Activate)'}
                </button>
              </div>

              {/* Usage Bar */}
              <div className="mt-3">
                 <div className="flex justify-between text-xs text-slate-500 mb-1">
                    <span>ใช้งานไป: {p.currentTotalUsage.toLocaleString()} คน</span>
                    <span>Limit: {p.maxTotalUsage.toLocaleString()}</span>
                 </div>
                 <div className="w-full h-2 bg-slate-700 rounded-full overflow-hidden">
                    <div 
                        className={`h-full ${usagePercent > 90 ? 'bg-red-500' : 'bg-emerald-500'}`} 
                        style={{ width: `${Math.min(100, usagePercent)}%` }} 
                    />
                 </div>
              </div>
            </div>
         );
      })}
      
      <div className="p-8 text-center border-2 border-dashed border-slate-700 rounded-xl">
         <button onClick={() => setActiveTab('CREATE')} className="text-emerald-500 font-bold hover:underline">
             + สร้างโปรโมชันใหม่
         </button>
      </div>
    </div>
  );

  const renderCreate = () => (
    <div className="bg-slate-800 p-6 rounded-xl border border-slate-700">
      <h3 className="text-xl font-bold text-white mb-6">สร้างโปรโมชันใหม่</h3>
      
      <div className="grid grid-cols-2 gap-6">
        {/* Left Column: Basics */}
        <div className="space-y-4">
             <div>
                <label className="block text-xs font-bold text-slate-400 mb-1">ชื่อแคมเปญ</label>
                <input value={newPromo.name} onChange={e => setNewPromo({...newPromo, name: e.target.value})} className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-white" placeholder="เช่น โปรเปิดเทอม" />
             </div>
             
             <div>
                <label className="block text-xs font-bold text-slate-400 mb-1">ประเภท</label>
                <select 
                    value={newPromo.type} 
                    onChange={e => setNewPromo({...newPromo, type: e.target.value as any})}
                    className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-white"
                >
                    <option value="TOPUP_BONUS">Top-up Bonus (เติมเงินแถมแต้ม)</option>
                    <option value="RIDE_DISCOUNT">Ride Discount (ส่วนลด/นั่งฟรี)</option>
                </select>
             </div>

             {/* Dynamic Fields based on Type */}
             {newPromo.type === 'TOPUP_BONUS' ? (
                <div className="bg-blue-900/20 p-3 rounded border border-blue-900/50 grid grid-cols-2 gap-2">
                    <div>
                        <label className="text-xs text-blue-300">เติมขั้นต่ำ (บาท)</label>
                        <input type="number" value={newPromo.minAmount} onChange={e => setNewPromo({...newPromo, minAmount: +e.target.value})} className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-white" />
                    </div>
                    <div>
                        <label className="text-xs text-blue-300">แถมแต้ม (Points)</label>
                        <input type="number" value={newPromo.bonus} onChange={e => setNewPromo({...newPromo, bonus: +e.target.value})} className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-white" />
                    </div>
                </div>
             ) : (
                <div className="bg-purple-900/20 p-3 rounded border border-purple-900/50">
                    <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={newPromo.isFree} onChange={e => setNewPromo({...newPromo, isFree: e.target.checked})} className="rounded bg-slate-900 border-slate-600 text-purple-500" />
                        <span className="text-sm text-purple-200 font-bold">แจกนั่งฟรี (Free Ride)</span>
                    </label>
                </div>
             )}
        </div>

        {/* Right Column: Limits & Time */}
        <div className="space-y-4">
             <div className="grid grid-cols-2 gap-2">
                <div>
                   <label className="block text-xs font-bold text-slate-400 mb-1">เริ่มวันที่</label>
                   <input type="date" value={newPromo.startDate} onChange={e => setNewPromo({...newPromo, startDate: e.target.value})} className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-white text-sm" />
                </div>
                <div>
                   <label className="block text-xs font-bold text-slate-400 mb-1">สิ้นสุดวันที่</label>
                   <input type="date" value={newPromo.endDate} onChange={e => setNewPromo({...newPromo, endDate: e.target.value})} className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-white text-sm" />
                </div>
             </div>

             <div>
                <label className="block text-xs font-bold text-slate-400 mb-1">จำกัดจำนวนคน (Total Limit) <span className="text-red-500">*จำเป็น</span></label>
                <input type="number" value={newPromo.maxTotalUsage} onChange={e => setNewPromo({...newPromo, maxTotalUsage: +e.target.value})} className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-white" />
                <p className="text-[10px] text-slate-500 mt-1">ระบบจะปิดโปรอัตโนมัติเมื่อครบจำนวน</p>
             </div>

             <div>
                <label className="block text-xs font-bold text-slate-400 mb-1">จำกัดต่อคน (Per User)</label>
                <input type="number" value={newPromo.limitPerUser} onChange={e => setNewPromo({...newPromo, limitPerUser: +e.target.value})} className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-white" />
             </div>
        </div>
      </div>

      {/* Footer: Cost Estimation */}
      <div className="mt-6 bg-slate-900 p-4 rounded-xl border border-slate-700 flex justify-between items-center">
          <div>
              <div className="text-xs text-slate-400 font-bold uppercase">Estimated Max Cost</div>
              <div className="text-2xl font-bold text-red-400">
                  {estimatedMaxCost.toLocaleString()} <span className="text-sm font-normal text-slate-500">Points Liability</span>
              </div>
              <div className="text-[10px] text-slate-600">คำนวณจาก Limit รวมสูงสุด</div>
          </div>
          <div className="flex gap-2">
              <button onClick={() => setActiveTab('MANAGE')} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm text-white">ยกเลิก</button>
              <button onClick={handleCreate} className="px-6 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-sm text-white font-bold shadow-lg shadow-emerald-900/20">บันทึกโปรโมชัน</button>
          </div>
      </div>
    </div>
  );

  const renderPerformance = () => (
    <div className="space-y-6">
       <div className="grid grid-cols-2 gap-4">
          <div className="bg-slate-800 p-4 rounded-xl border border-slate-700">
             <div className="text-xs text-slate-500 font-bold uppercase">Total Budget Spent</div>
             <div className="text-2xl font-bold text-red-400">
                {promotions.reduce((acc, p) => acc + p.stats.totalPointsGiven, 0).toLocaleString()} <span className="text-sm text-slate-500">pts</span>
             </div>
          </div>
          <div className="bg-slate-800 p-4 rounded-xl border border-slate-700">
             <div className="text-xs text-slate-500 font-bold uppercase">Lift Revenue</div>
             <div className="text-2xl font-bold text-emerald-400">
                +{promotions.reduce((acc, p) => acc + p.stats.estimatedRevenueGenerated, 0).toLocaleString()} <span className="text-sm text-slate-500">THB</span>
             </div>
          </div>
       </div>

       <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
           <table className="w-full text-left text-sm text-slate-300">
             <thead className="bg-slate-900 text-slate-500 font-bold text-xs uppercase">
               <tr>
                 <th className="p-4">Campaign</th>
                 <th className="p-4 text-right">Users</th>
                 <th className="p-4 text-right">Cost</th>
                 <th className="p-4 text-right">Revenue</th>
                 <th className="p-4 text-right">Status</th>
               </tr>
             </thead>
             <tbody className="divide-y divide-slate-700/50">
               {promotions.map(p => (
                   <tr key={p.id} className="hover:bg-slate-700/20">
                       <td className="p-4 font-bold">{p.name}</td>
                       <td className="p-4 text-right">{p.stats.usersCount}</td>
                       <td className="p-4 text-right text-red-400">-{p.stats.totalPointsGiven}</td>
                       <td className="p-4 text-right text-emerald-400">+{p.stats.estimatedRevenueGenerated}</td>
                       <td className="p-4 text-right">
                           <span className={`text-[10px] px-2 py-1 rounded font-bold ${p.active ? 'bg-emerald-900 text-emerald-400' : 'bg-slate-700 text-slate-400'}`}>
                               {p.active ? 'Running' : 'Stopped'}
                           </span>
                       </td>
                   </tr>
               ))}
             </tbody>
           </table>
       </div>
    </div>
  );

  const renderFinance = () => (
      <div className="space-y-6">
        <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
            <div className="p-4 bg-slate-900 border-b border-slate-700 flex justify-between items-center">
                <div>
                    <h3 className="font-bold text-white">บัญชีรับเงิน (Payment Accounts)</h3>
                    <p className="text-xs text-slate-500">ข้อมูลนี้จะถูกแสดงให้ผู้โดยสารเห็นในหน้าเติมเงิน</p>
                </div>
                <div className="bg-emerald-900/30 text-emerald-400 px-3 py-1 rounded-full text-xs font-bold border border-emerald-900/50">
                    Active: {paymentMethods.filter(p => p.isActive).length}
                </div>
            </div>
            <div className="p-4 grid gap-4">
                {paymentMethods.map(pm => (
                    <div key={pm.id} className="flex items-center justify-between bg-slate-900/50 p-4 rounded-lg border border-slate-700">
                        <div className="flex items-center gap-4">
                            <div className={`w-12 h-12 rounded-full flex items-center justify-center text-xl font-bold border-2 ${pm.type === 'PROMPTPAY' ? 'bg-blue-900/20 border-blue-500 text-blue-400' : 'bg-green-900/20 border-green-500 text-green-400'}`}>
                                {pm.type === 'PROMPTPAY' ? 'PP' : 'BK'}
                            </div>
                            <div>
                                <div className="font-bold text-slate-200 text-lg">{pm.providerName}</div>
                                <div className="text-sm text-slate-400 font-mono">{pm.accountNumber}</div>
                                <div className="text-xs text-slate-500">{pm.accountName}</div>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                             {pm.qrImage && <span className="text-xs bg-slate-700 text-white px-2 py-1 rounded">มี QR Code</span>}
                             
                             <button 
                                onClick={() => togglePayment(pm.id)} 
                                className={`px-3 py-1.5 rounded text-xs font-bold transition-colors ${pm.isActive ? 'bg-emerald-600 text-white hover:bg-red-600' : 'bg-slate-700 text-slate-300 hover:bg-emerald-600'}`}
                             >
                                 {pm.isActive ? 'เปิดใช้งานอยู่' : 'ปิดใช้งาน'}
                             </button>
                             <button onClick={() => handleDeletePayment(pm.id)} className="p-2 text-slate-500 hover:text-red-400 transition-colors">
                                 🗑️
                             </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>

        <div className="bg-slate-800 p-6 rounded-xl border border-slate-700">
            <h3 className="font-bold text-white mb-4 flex items-center gap-2">
                <span>➕</span> เพิ่มบัญชีใหม่
            </h3>
            <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                    <label className="text-xs text-slate-400 font-bold block mb-1">ประเภท (Type)</label>
                    <select 
                        value={newPayment.type}
                        onChange={e => setNewPayment({...newPayment, type: e.target.value as any})}
                        className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-white outline-none focus:border-emerald-500"
                    >
                        <option value="BANK">บัญชีธนาคาร (Bank Account)</option>
                        <option value="PROMPTPAY">พร้อมเพย์ (PromptPay)</option>
                    </select>
                </div>
                <div>
                    <label className="text-xs text-slate-400 font-bold block mb-1">ชื่อธนาคาร / ผู้ให้บริการ</label>
                    <input 
                        value={newPayment.providerName}
                        onChange={e => setNewPayment({...newPayment, providerName: e.target.value})}
                        placeholder="เช่น KBANK, SCB, TrueMoney"
                        className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-white outline-none focus:border-emerald-500"
                    />
                </div>
                <div>
                    <label className="text-xs text-slate-400 font-bold block mb-1">เลขที่บัญชี / เบอร์โทร / PromptPay ID</label>
                    <input 
                        value={newPayment.accountNumber}
                        onChange={e => setNewPayment({...newPayment, accountNumber: e.target.value})}
                        placeholder="xxx-x-xxxxx-x"
                        className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-white outline-none focus:border-emerald-500 font-mono"
                    />
                </div>
                <div>
                    <label className="text-xs text-slate-400 font-bold block mb-1">ชื่อบัญชี (Account Name)</label>
                    <input 
                        value={newPayment.accountName}
                        onChange={e => setNewPayment({...newPayment, accountName: e.target.value})}
                        placeholder="เช่น บจก. มายวิน เทคโนโลยี"
                        className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-white outline-none focus:border-emerald-500"
                    />
                </div>
                <div className="col-span-2">
                    <label className="text-xs text-slate-400 font-bold block mb-1">QR Code (Optional)</label>
                    <div className="border-2 border-dashed border-slate-600 rounded-lg p-4 text-center hover:bg-slate-700/50 cursor-pointer transition-colors" onClick={() => alert('จำลองการอัปโหลดรูปภาพ')}>
                        <span className="text-2xl block mb-1">📷</span>
                        <span className="text-xs text-slate-500">คลิกเพื่ออัปโหลดรูป QR Code</span>
                    </div>
                </div>
            </div>
            <div className="flex justify-end">
                <button 
                    onClick={handleAddPayment} 
                    disabled={!newPayment.accountNumber || !newPayment.accountName}
                    className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-2 px-6 rounded-lg shadow-lg flex items-center gap-2"
                >
                    บันทึกข้อมูล
                </button>
            </div>
        </div>
      </div>
  );

  return (
    <div className="flex-1 bg-slate-950 p-6 flex flex-col h-full overflow-hidden font-sans text-slate-200">
      <header className="mb-6 flex justify-between items-end">
           <div>
                <h2 className="text-2xl font-bold text-white">จัดการราคา & โปรโมชัน & การเงิน</h2>
                <p className="text-slate-500 text-sm">Pricing, Promotion & Financial Management</p>
           </div>
           <div className="flex bg-slate-900 p-1 rounded-lg border border-slate-800">
               <button 
                 onClick={() => setActiveTab('ACCOUNTING')}
                 className={`px-4 py-2 rounded text-xs font-bold ${activeTab === 'ACCOUNTING' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
               >
                   รายงานบัญชี (Accounting)
               </button>
               <button 
                 onClick={() => setActiveTab('FINANCE')}
                 className={`px-4 py-2 rounded text-xs font-bold ${activeTab === 'FINANCE' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
               >
                   ตั้งค่าการเงิน
               </button>
               <button 
                 onClick={() => setActiveTab('MANAGE')}
                 className={`px-4 py-2 rounded text-xs font-bold ${activeTab === 'MANAGE' ? 'bg-emerald-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
               >
                   จัดการโปรฯ
               </button>
               <button 
                 onClick={() => setActiveTab('PERFORMANCE')}
                 className={`px-4 py-2 rounded text-xs font-bold ${activeTab === 'PERFORMANCE' ? 'bg-slate-700 text-white shadow' : 'text-slate-400 hover:text-white'}`}
               >
                   รายงานผล
               </button>
               <button 
                 onClick={() => setActiveTab('AI_ANALYST')}
                 className={`px-4 py-2 rounded text-xs font-bold flex items-center gap-1 ${activeTab === 'AI_ANALYST' ? 'bg-purple-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
               >
                   <span>✨</span> AI Analyst
               </button>
           </div>
      </header>

      <div className="flex-1 overflow-y-auto pr-2">
          {activeTab === 'ACCOUNTING' && renderAccountingReport()}
          {activeTab === 'FINANCE' && renderFinance()}
          {activeTab === 'MANAGE' && renderManage()}
          {activeTab === 'CREATE' && renderCreate()}
          {activeTab === 'PERFORMANCE' && renderPerformance()}
          {activeTab === 'AI_ANALYST' && (
              <div className="text-center py-20">
                  <div className="text-4xl mb-4">🤖</div>
                  <h3 className="text-xl font-bold text-white">AI Analyst Dashboard</h3>
                  <p className="text-slate-400 mb-6">วิเคราะห์ความคุ้มค่าของโปรโมชันด้วย Gemini AI</p>
                  <button onClick={runAIAnalysis} disabled={isAnalyzing} className="bg-purple-600 hover:bg-purple-500 px-6 py-3 rounded-xl font-bold text-white shadow-lg shadow-purple-900/50">
                      {isAnalyzing ? 'กำลังวิเคราะห์...' : 'เริ่มวิเคราะห์ข้อมูล'}
                  </button>
                  {aiResults && (
                      <div className="mt-8 grid gap-4 max-w-2xl mx-auto text-left">
                          {aiResults.map((res, idx) => (
                              <div key={idx} className="bg-slate-800 p-4 rounded-xl border border-slate-700">
                                  <div className="flex justify-between font-bold mb-2">
                                      <span className="text-white">Promo: {promotions.find(p=>p.id===res.promoId)?.name}</span>
                                      <span className={res.status === 'GREEN' ? 'text-emerald-400' : res.status === 'RED' ? 'text-red-400' : 'text-yellow-400'}>{res.status} ({res.roiPercent.toFixed(1)}% ROI)</span>
                                  </div>
                                  <div className="text-sm text-slate-400 mb-1">เหตุผล: {res.reason}</div>
                                  <div className="text-sm text-indigo-400">ข้อเสนอแนะ: {res.suggestion}</div>
                              </div>
                          ))}
                      </div>
                  )}
              </div>
          )}
      </div>
    </div>
  );
};

export default AdminRateDashboard;