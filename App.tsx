
import React, { useState, useEffect, useRef, ErrorInfo, ReactNode, Component } from 'react';
import MapBoard from './components/MapBoard';
import DispatchLogPanel from './components/DispatchLogPanel';
import MetricsCard from './components/MetricsCard';
import AdminQueueDashboard from './components/AdminQueueDashboard';
import AdminRateDashboard from './components/AdminRateDashboard';
import AdminInviteDashboard from './components/AdminInviteDashboard';
import AdminMarketingDashboard from './components/AdminMarketingDashboard'; // ADDED
import DriverDownloadPage from './components/DriverDownloadPage';
import PassengerApp from './components/PassengerApp';
import DriverApp from './components/DriverApp';
import LandingPage from './components/LandingPage';
import { Driver, Rider, Location, SimulationState, MatchLog, SystemMetrics } from './types';
import { TICK_RATE_MS, INITIAL_DRIVERS_COUNT, STATION_ZONES, APP_LOGO_PATH, MAP_CENTER } from './constants';
import { runDispatchCycle, moveAgents } from './services/scheduler';
import { auditFairness } from './services/geminiService';
import { socket } from './services/socket';

// Utility for random location around Bangkok
const randomLoc = (): Location => {
    // Random offset ~ 2km around center
    const rLat = (Math.random() - 0.5) * 0.04;
    const rLng = (Math.random() - 0.5) * 0.04;
    return {
        lat: MAP_CENTER.lat + rLat,
        lng: MAP_CENTER.lng + rLng,
    };
};

const USER_DRIVER_ID = 'D-USER';
const USER_RIDER_ID = 'R-USER';

// --- ROUTING HELPER ---
const getHashView = () => {
    const hash = window.location.hash;
    const cleanHash = hash.split('?')[0];
    if (cleanHash === '#driver') return 'STANDALONE_DRIVER';
    if (cleanHash === '#passenger') return 'STANDALONE_PASSENGER';
    if (cleanHash === '#landing') return 'LANDING_PAGE';
    if (cleanHash === '#download') return 'DOWNLOAD_PAGE'; // Added Download Page Route
    return 'ADMIN_SIMULATION';
};

// --- ERROR BOUNDARY ---
interface ErrorBoundaryProps {
    children?: ReactNode;
}

interface ErrorBoundaryState {
    hasError: boolean;
    error: Error | null;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
    constructor(props: ErrorBoundaryProps) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error) {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error("Uncaught error:", error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="flex flex-col items-center justify-center h-screen bg-slate-900 text-white p-6 text-center">
                    <h1 className="text-3xl font-bold text-red-500 mb-4">ระบบเกิดข้อผิดพลาด (System Error)</h1>
                    <p className="text-slate-400 mb-4">ขออภัยในความไม่สะดวก ระบบแผนที่อาจมีปัญหาในการแสดงผล</p>
                    <pre className="bg-slate-800 p-4 rounded text-left text-xs overflow-auto max-w-lg mb-6 border border-slate-700">
                        {this.state.error?.toString()}
                    </pre>
                    <button
                        onClick={() => window.location.reload()}
                        className="bg-emerald-600 hover:bg-emerald-500 px-6 py-3 rounded-lg font-bold"
                    >
                        รีโหลดหน้าเว็บ
                    </button>
                </div>
            );
        }
        return this.props.children;
    }
}

const App: React.FC = () => {
    const [appMode, setAppMode] = useState<'ADMIN_SIMULATION' | 'STANDALONE_DRIVER' | 'STANDALONE_PASSENGER' | 'LANDING_PAGE' | 'DOWNLOAD_PAGE'>(getHashView());
    const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false);
    const [loginForm, setLoginForm] = useState({ username: '', password: '' });
    const [loginError, setLoginError] = useState('');
    const [currentView, setCurrentView] = useState<'SIMULATION' | 'ADMIN' | 'DEMO_APPS' | 'DOWNLOAD'>('SIMULATION');
    const [adminSubView, setAdminSubView] = useState<'QUEUE' | 'RATES' | 'INVITES' | 'MARKETING'>('QUEUE'); // ADDED MARKETING
    const [demoScale, setDemoScale] = useState(0.75);
    const [simState, setSimState] = useState<SimulationState>(SimulationState.PAUSED);
    const [drivers, setDrivers] = useState<Driver[]>([]);
    const [riders, setRiders] = useState<Rider[]>([]);
    const [logs, setLogs] = useState<MatchLog[]>([]);
    const [metrics, setMetrics] = useState<SystemMetrics>({
        averageWaitTime: 0,
        activeDrivers: 0,
        pendingRiders: 0,
        totalCompletedTrips: 0,
        efficiencyIndex: 100,
    });
    const [aiAudit, setAiAudit] = useState<{ analysis: string; score: number } | null>(null);
    const [isAuditing, setIsAuditing] = useState(false);
    const [autoAddRiders, setAutoAddRiders] = useState(false);

    const [demoDriverData, setDemoDriverData] = useState<Driver | undefined>(undefined);
    const [demoRiderData, setDemoRiderData] = useState<Rider | undefined>(undefined);

    const driversRef = useRef(drivers);
    const ridersRef = useRef(riders);
    const stateRef = useRef(simState);

    useEffect(() => { driversRef.current = drivers; }, [drivers]);
    useEffect(() => { ridersRef.current = riders; }, [riders]);
    useEffect(() => { stateRef.current = simState; }, [simState]);

    useEffect(() => {
        const handleHashChange = () => {
            setAppMode(getHashView());
        };
        window.addEventListener('hashchange', handleHashChange);
        return () => window.removeEventListener('hashchange', handleHashChange);
    }, []);

    // --- OAUTH CALLBACK HANDLER ---
    useEffect(() => {
        if (window.location.hash.startsWith('#oauth_callback')) {
            const hash = window.location.hash;
            const queryPart = hash.split('?')[1];
            if (queryPart) {
                const params = new URLSearchParams(queryPart);
                const token = params.get('token');
                const type = params.get('type');

                if (token && type) {
                    if (type === 'PASSENGER') {
                        localStorage.setItem('mywin_token', token);
                        window.location.hash = '#passenger';
                    }
                    if (type === 'DRIVER') {
                        localStorage.setItem('mywin_driver_token', token);
                        window.location.hash = '#driver';
                    }
                    setTimeout(() => window.location.reload(), 100);
                }
            }
        }
    }, []);

    // --- REAL-TIME SOCKET LOGIC ---
    useEffect(() => {
        if (appMode !== 'ADMIN_SIMULATION') return;

        socket.on('DRIVER_UPDATE_STATUS', (data: { id: string, status: string, location?: Location }) => {
            setDrivers(prev => {
                const exists = prev.find(d => d.id === data.id);
                if (data.status === 'OFFLINE') {
                    return prev.filter(d => d.id !== data.id);
                }
                if (exists) {
                    // Update location if provided, else keep old
                    const newLoc = data.location || exists.location;
                    return prev.map(d => d.id === data.id ? { ...d, status: data.status as any, location: newLoc } : d);
                } else {
                    const newDriver: Driver = {
                        id: data.id,
                        location: data.location || MAP_CENTER,
                        status: 'IDLE',
                        earnings: 0,
                        totalTrips: 0,
                        rating: 5.0,
                        lastTripTime: Date.now(),
                        joinedQueueTime: Date.now(),
                        winId: 'WIN-CENTRAL-01'
                    };
                    return [...prev, newDriver];
                }
            });
        });

        socket.on('TRIP_ACCEPT', (data: { driverId: string, tripId: string }) => {
            setDrivers(prev => prev.map(d => {
                if (d.id === data.driverId) {
                    return { ...d, status: 'EN_ROUTE', matchedRiderId: undefined };
                }
                return d;
            }));
        });

        socket.on('DRIVER_REJECT_JOB', (data: { driverId: string, riderId: string }) => {
            setDrivers(prev => prev.map(d => {
                if (d.id === data.driverId) {
                    return { ...d, status: 'IDLE', matchedRiderId: undefined, lastTripTime: Date.now() };
                }
                return d;
            }));
            setRiders(prev => prev.map(r => r.id === data.riderId ? { ...r, status: 'IDLE' } : r));
        });

        socket.on('TRIP_COMPLETE', (data: { driverId: string }) => {
            setDrivers(prev => prev.map(d => {
                if (d.id === data.driverId) {
                    return { ...d, status: 'IDLE', matchedRiderId: undefined, lastTripTime: Date.now() };
                }
                return d;
            }));
            setRiders(prev => {
                const driver = driversRef.current.find(d => d.id === data.driverId);
                if (driver && driver.matchedRiderId) {
                    return prev.filter(r => r.id !== driver.matchedRiderId);
                }
                return prev;
            });
        });

        socket.on('RIDE_REQUEST', (data: { riderId: string, location: Location, message: string, targetWinId?: string }) => {
            const newRider: Rider = {
                id: data.riderId,
                location: data.location,
                destination: randomLoc(),
                requestTime: Date.now(),
                waitTime: 0,
                status: 'IDLE',
                priorityScore: 100,
                message: data.message,
                targetWinId: data.targetWinId
            };
            setRiders(prev => {
                const clean = prev.filter(r => r.id !== data.riderId);
                return [...clean, newRider];
            });
            setSimState(SimulationState.RUNNING);
        });

        socket.on('RIDE_CANCEL', (data: { riderId: string }) => {
            setRiders(prev => prev.filter(r => r.id !== data.riderId));
            setDrivers(prev => prev.map(d => d.matchedRiderId === data.riderId ? { ...d, status: 'IDLE', matchedRiderId: undefined } : d));
        });

        return () => {
            if (appMode === 'ADMIN_SIMULATION') socket.removeAllListeners();
        };
    }, [appMode]);

    useEffect(() => {
        if (appMode !== 'ADMIN_SIMULATION') return;

        const userDriver = drivers.find(d => d.id === USER_DRIVER_ID);
        const userRider = riders.find(r => r.id === USER_RIDER_ID);

        setDemoDriverData(userDriver);
        setDemoRiderData(userRider);

        socket.emit('SYNC_CLIENT_STATE', { driver: userDriver, rider: userRider });

        if (userDriver?.status === 'MATCHED' && userDriver.matchedRiderId) {
            const rider = riders.find(r => r.id === userDriver.matchedRiderId);
            if (rider) {
                socket.emit(`JOB_OFFER:${USER_DRIVER_ID}`, {
                    riderId: rider.id,
                    pickupLocation: rider.location,
                    message: rider.message
                });
            }
        }
    }, [drivers, riders, appMode]);

    useEffect(() => {
        if (appMode === 'ADMIN_SIMULATION') return;
        socket.on('SYNC_CLIENT_STATE', (data: { driver: Driver, rider: Rider }) => {
            setDemoDriverData(data.driver);
            setDemoRiderData(data.rider);
        });
        return () => { socket.removeAllListeners('SYNC_CLIENT_STATE'); }
    }, [appMode]);


    // --- Initialization ---
    useEffect(() => {
        if (appMode !== 'ADMIN_SIMULATION') return;
        if (drivers.length > 0) return;

        const initialDrivers: Driver[] = Array.from({ length: INITIAL_DRIVERS_COUNT }).map((_, i) => {
            const station = STATION_ZONES[Math.floor(Math.random() * STATION_ZONES.length)];
            // Spawn near station
            return {
                id: `D-${i + 100}`,
                location: {
                    lat: station.lat + (Math.random() * 0.002 - 0.001),
                    lng: station.lng + (Math.random() * 0.002 - 0.001)
                },
                status: 'IDLE',
                earnings: 0,
                winId: station.id,
                totalTrips: Math.floor(Math.random() * 20),
                rating: 3.5 + (Math.random() * 1.5),
                lastTripTime: Date.now() - (Math.floor(Math.random() * 3600 * 1000)),
                joinedQueueTime: Date.now()
            };
        });
        setDrivers(initialDrivers);
    }, [appMode]);

    const addRider = async () => {
        const newRider: Rider = {
            id: `R-${Math.floor(Math.random() * 10000)}`,
            location: randomLoc(),
            destination: randomLoc(),
            requestTime: Date.now(),
            waitTime: 0,
            status: 'IDLE',
            priorityScore: 0
        };
        setRiders(prev => [...prev, newRider]);
    };

    const addDriver = () => {
        const station = STATION_ZONES[0];
        const newDriver: Driver = {
            id: `D-${Math.floor(Math.random() * 10000)}`,
            location: {
                lat: station.lat + (Math.random() * 0.002 - 0.001),
                lng: station.lng + (Math.random() * 0.002 - 0.001)
            },
            status: 'IDLE',
            earnings: 0,
            totalTrips: 0,
            rating: 5.0,
            lastTripTime: Date.now(),
            joinedQueueTime: Date.now(),
            winId: 'WIN-CENTRAL-01'
        };
        setDrivers(prev => [...prev, newDriver]);
    };

    const handleAdminOverride = (driverId: string, reason: string) => {
        setDrivers(prevDrivers => prevDrivers.map(d => {
            if (d.id === driverId) {
                return {
                    ...d,
                    joinedQueueTime: Date.now() - (1000 * 60 * 60 * 24),
                    lastTripTime: Date.now() - (1000 * 60 * 60 * 24),
                };
            }
            return d;
        }));
    };

    const handleAdminLogin = (e: React.FormEvent) => {
        e.preventDefault();
        if (loginForm.username === 'admin' && loginForm.password === '1234') {
            setIsAdminLoggedIn(true);
            setLoginError('');
        } else {
            setLoginError('ชื่อผู้ใช้งานหรือรหัสผ่านไม่ถูกต้อง');
        }
    };

    const performAudit = async () => {
        if (logs.length === 0) return;
        setIsAuditing(true);
        const result = await auditFairness(logs, metrics);
        setAiAudit(result);
        setIsAuditing(false);
    };

    useEffect(() => {
        if (appMode !== 'ADMIN_SIMULATION') return;

        const tick = () => {
            if (stateRef.current === SimulationState.PAUSED) return;

            const currentDrivers = driversRef.current;
            const currentRiders = ridersRef.current;

            const { drivers: movedDrivers, riders: movedRiders } = moveAgents(currentDrivers, currentRiders);
            const { updatedDrivers, updatedRiders, newLogs } = runDispatchCycle(movedDrivers, movedRiders, Date.now());

            const activeRiders = updatedRiders.filter(r => {
                if (r.status === 'MATCHED') {
                    const assignedDriver = updatedDrivers.find(d => d.matchedRiderId === r.id);
                    return !!assignedDriver;
                }
                return true;
            });

            const totalWait = activeRiders.reduce((acc, r) => acc + r.waitTime, 0);
            const avgWait = activeRiders.length > 0 ? totalWait / activeRiders.length : 0;

            setMetrics(prev => ({
                averageWaitTime: avgWait,
                activeDrivers: updatedDrivers.filter(d => d.status === 'MATCHED' || d.status === 'EN_ROUTE').length,
                pendingRiders: activeRiders.filter(r => r.status === 'IDLE').length,
                totalCompletedTrips: prev.totalCompletedTrips + (currentRiders.length - activeRiders.length),
                efficiencyIndex: 100 - (avgWait / 10)
            }));

            setDrivers(updatedDrivers);
            setRiders(activeRiders);
            if (newLogs.length > 0) {
                setLogs(prev => [...prev, ...newLogs].slice(-50));
            }

            if (autoAddRiders && Math.random() > 0.7) {
                addRider();
            }
        };

        const intervalId = setInterval(tick, TICK_RATE_MS);
        return () => clearInterval(intervalId);
    }, [autoAddRiders, appMode]);

    const userDriverMatchedRider = demoDriverData?.matchedRiderId
        ? (appMode === 'ADMIN_SIMULATION' ? riders.find(r => r.id === demoDriverData.matchedRiderId) : demoRiderData)
        : undefined;

    // --- Views Logic ---

    if (appMode === 'LANDING_PAGE') return <LandingPage />;

    // ADDED: Download Page View
    if (appMode === 'DOWNLOAD_PAGE') return (
        <DriverDownloadPage onOpenWebApp={() => { window.location.hash = '#driver'; window.location.reload(); }} />
    );

    if (appMode === 'STANDALONE_DRIVER') return (
        <div className="w-full h-screen bg-slate-100 flex items-center justify-center">
            <div className="w-full h-full md:max-w-[480px] md:h-[90vh] md:rounded-[3rem] md:shadow-2xl md:border-8 md:border-slate-800 overflow-hidden bg-white relative">
                <div className="hidden md:block absolute top-0 left-1/2 -translate-x-1/2 w-40 h-7 bg-slate-800 rounded-b-3xl z-50"></div>
                <DriverApp driverData={demoDriverData} matchedRider={userDriverMatchedRider} />
            </div>
        </div>
    );
    if (appMode === 'STANDALONE_PASSENGER') return (
        <div className="w-full h-screen bg-slate-100 flex items-center justify-center">
            <div className="w-full h-full md:max-w-[480px] md:h-[90vh] md:rounded-[3rem] md:shadow-2xl md:border-8 md:border-slate-800 overflow-hidden bg-white relative">
                <div className="hidden md:block absolute top-0 left-1/2 -translate-x-1/2 w-40 h-7 bg-slate-800 rounded-b-3xl z-50"></div>
                <PassengerApp riderData={demoRiderData} />
            </div>
        </div>
    );

    if (!isAdminLoggedIn) {
        // Login Screen
        return (
            <div className="flex items-center justify-center min-h-screen bg-slate-950 font-sans">
                <div className="w-full max-w-md p-8 bg-slate-900 rounded-2xl shadow-2xl border border-slate-800">
                    <h1 className="text-2xl font-bold text-white mb-6 text-center">MyWin Admin</h1>
                    <form onSubmit={handleAdminLogin} className="space-y-4">
                        <input type="text" value={loginForm.username} onChange={e => setLoginForm({ ...loginForm, username: e.target.value })} className="w-full bg-slate-950 border border-slate-700 text-white px-4 py-3 rounded-xl" placeholder="admin" />
                        <input type="password" value={loginForm.password} onChange={e => setLoginForm({ ...loginForm, password: e.target.value })} className="w-full bg-slate-950 border border-slate-700 text-white px-4 py-3 rounded-xl" placeholder="••••" />
                        {loginError && <div className="text-red-400 text-xs text-center">{loginError}</div>}
                        <button type="submit" className="w-full bg-mywin-green text-white font-bold py-3 rounded-xl">เข้าสู่ระบบ</button>
                    </form>
                </div>
            </div>
        );
    }

    // Admin Dashboard
    return (
        <ErrorBoundary>
            <div className="flex h-screen bg-slate-950 text-slate-200 font-sans overflow-hidden">
                {/* Sidebar */}
                <div className="w-80 flex flex-col border-r border-slate-800 bg-slate-900 p-4 gap-4 z-10 shadow-xl shrink-0">
                    {/* ... Sidebar Controls (Same as before) ... */}
                    <div className="flex items-center gap-3 mb-2">
                        <img src={APP_LOGO_PATH} alt="MyWin" className="w-8 h-8 rounded-lg" />
                        <span className="font-bold">MyWin Admin</span>
                    </div>
                    <div className="flex bg-slate-800 p-1 rounded-lg">
                        <button onClick={() => setCurrentView('SIMULATION')} className={`flex-1 py-1 text-xs font-bold rounded ${currentView === 'SIMULATION' ? 'bg-slate-700 text-white' : 'text-slate-400'}`}>จำลองระบบ</button>
                        <button onClick={() => setCurrentView('ADMIN')} className={`flex-1 py-1 text-xs font-bold rounded ${currentView === 'ADMIN' ? 'bg-slate-700 text-white' : 'text-slate-400'}`}>ผู้ดูแล</button>
                        <button onClick={() => setCurrentView('DEMO_APPS')} className={`flex-1 py-1 text-xs font-bold rounded ${currentView === 'DEMO_APPS' ? 'bg-mywin-green text-white' : 'text-slate-400'}`}>Apps</button>
                    </div>

                    {currentView === 'SIMULATION' && (
                        <>
                            <div className="grid grid-cols-2 gap-2">
                                <MetricsCard label="รอเฉลี่ย" value={`${metrics.averageWaitTime.toFixed(0)}วิ`} />
                                <MetricsCard label="รอรถ" value={metrics.pendingRiders} />
                            </div>
                            <div className="bg-slate-800 p-4 rounded-lg space-y-3">
                                <button onClick={() => setSimState(s => s === SimulationState.RUNNING ? SimulationState.PAUSED : SimulationState.RUNNING)} className={`w-full py-2 rounded font-bold ${simState === SimulationState.RUNNING ? 'bg-amber-600' : 'bg-mywin-green'}`}>
                                    {simState === SimulationState.RUNNING ? 'หยุด' : 'เริ่ม'}
                                </button>
                                <div className="flex gap-2">
                                    <button onClick={addRider} className="flex-1 bg-slate-700 py-1 rounded text-xs">+ Rider</button>
                                    <button onClick={addDriver} className="flex-1 bg-slate-700 py-1 rounded text-xs">+ Driver</button>
                                </div>
                            </div>
                        </>
                    )}

                    {/* ADDED: ADMIN MENU CONTROLS */}
                    {currentView === 'ADMIN' && (
                        <div className="space-y-2 mt-4 animate-in slide-in-from-left-4 fade-in duration-300">
                            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">เมนูผู้ดูแล (Admin Menu)</div>

                            <button
                                onClick={() => setAdminSubView('QUEUE')}
                                className={`w-full text-left px-4 py-3 rounded-xl flex items-center gap-3 transition-all ${adminSubView === 'QUEUE' ? 'bg-emerald-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-800'}`}
                            >
                                <span className="text-lg">📋</span>
                                <div className="text-sm font-bold">ตรวจสอบคิว</div>
                            </button>

                            <button
                                onClick={() => setAdminSubView('RATES')}
                                className={`w-full text-left px-4 py-3 rounded-xl flex items-center gap-3 transition-all ${adminSubView === 'RATES' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-800'}`}
                            >
                                <span className="text-lg">🏷️</span>
                                <div className="text-sm font-bold">โปรโมชัน & ราคา</div>
                            </button>

                            <button
                                onClick={() => setAdminSubView('INVITES')}
                                className={`w-full text-left px-4 py-3 rounded-xl flex items-center gap-3 transition-all ${adminSubView === 'INVITES' ? 'bg-amber-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-800'}`}
                            >
                                <span className="text-lg">🎫</span>
                                <div className="text-sm font-bold">จัดการรหัสเชิญ</div>
                            </button>

                            {/* NEW MARKETING MENU */}
                            <button
                                onClick={() => setAdminSubView('MARKETING')}
                                className={`w-full text-left px-4 py-3 rounded-xl flex items-center gap-3 transition-all ${adminSubView === 'MARKETING' ? 'bg-purple-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-800'}`}
                            >
                                <span className="text-lg">🎨</span>
                                <div className="text-sm font-bold">สร้างสื่อโฆษณา</div>
                            </button>
                        </div>
                    )}
                </div>

                {/* Content */}
                {currentView === 'SIMULATION' ? (
                    <div className="flex-1 flex-col relative flex">
                        <div className="flex-1 bg-slate-950 relative">
                            {/* Map Board takes full space */}
                            <MapBoard drivers={drivers} riders={riders} />
                        </div>
                        <div className="absolute top-4 right-4 w-80 h-[calc(100%-2rem)] z-[500]">
                            <DispatchLogPanel logs={logs} />
                        </div>
                    </div>
                ) : currentView === 'DEMO_APPS' ? (
                    <div className="flex-1 bg-slate-900 overflow-auto flex items-center justify-center p-8 gap-8">
                        <div className="w-[375px] h-[750px] bg-white rounded-[3rem] border-8 border-slate-800 overflow-hidden shadow-2xl relative">
                            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-6 bg-slate-800 rounded-b-2xl z-50"></div>
                            <div className="w-full h-full overflow-y-auto">
                                <DriverApp driverData={demoDriverData} matchedRider={userDriverMatchedRider} />
                            </div>
                        </div>
                        <div className="w-[375px] h-[750px] bg-white rounded-[3rem] border-8 border-slate-800 overflow-hidden shadow-2xl relative">
                            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-6 bg-slate-800 rounded-b-2xl z-50"></div>
                            <div className="w-full h-full overflow-y-auto">
                                <PassengerApp riderData={demoRiderData} />
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="flex-1 bg-slate-950">
                        {adminSubView === 'QUEUE' && <AdminQueueDashboard drivers={drivers} onOverrideQueue={handleAdminOverride} />}
                        {adminSubView === 'RATES' && <AdminRateDashboard />}
                        {adminSubView === 'INVITES' && <AdminInviteDashboard />}
                        {adminSubView === 'MARKETING' && <AdminMarketingDashboard />}
                    </div>
                )}
            </div>
        </ErrorBoundary>
    );
};

export default App;
