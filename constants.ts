
// --- ENVIRONMENT CONFIGURATION ---

// Robust Production Detection:
// 1. Check Node Environment (Build time/Runtime)
// 2. Check Hostname (Client side)
const isLocalhost = typeof window !== 'undefined' && (
    window.location.hostname === 'localhost' || 
    window.location.hostname === '127.0.0.1' ||
    window.location.hostname.includes('192.168.')
);

export const IS_PRODUCTION = process.env.NODE_ENV === 'production' || !isLocalhost; 

// In Production (Hostinger), Backend serves Frontend on the same origin.
// Use empty string for API_BASE_URL to make requests relative (e.g. /driver/login)
export const API_BASE_URL = IS_PRODUCTION ? '' : 'http://localhost:3000';

// For Socket.io:
// In Prod: It should connect to the same origin (window.location.origin)
// Nginx will handle the upgrade to WSS
export const SOCKET_URL = IS_PRODUCTION 
    ? (typeof window !== 'undefined' ? window.location.origin : '') 
    : 'http://localhost:3000'; // Changed ws:// to http:// for better socket.io-client compatibility

// --- GAME / SIMULATION CONSTANTS ---
export const MAX_DRIVERS = 20;
export const MAX_RIDERS = 30;
export const TICK_RATE_MS = 1000; // 1 second per tick in real time

// Fairness Formula Weights (Total should approx 1.0)
// Centralized configuration for the Dispatch Algorithm
export const FAIRNESS_WEIGHTS = {
  IDLE: 0.5,    // 50% - Priority on waiting time (First-Come-First-Serve base)
  RECENCY: 0.3, // 30% - Priority on drivers who haven't had a job recently (Anti-starvation)
  TRIPS: 0.15,  // 15% - Help drivers with fewer trips today (Equalization)
  RATING: 0.05  // 5% - Small incentive for high rating
};

export const INITIAL_DRIVERS_COUNT = 8;
export const INITIAL_RIDERS_COUNT = 5;

// Colors
export const COLOR_DRIVER_IDLE = '#10b981'; // Emerald 500
export const COLOR_DRIVER_BUSY = '#f59e0b'; // Amber 500
export const COLOR_RIDER_WAITING = '#ef4444'; // Red 500
export const COLOR_RIDER_MATCHED = '#3b82f6'; // Blue 500

// Pricing
export const PRICE_PER_RIDE_CREDITS = 2;

// Master Data: Stations (Bangkok Locations)
export const STATION_ZONES = [
  { id: 'WIN-CENTRAL-01', name: 'วินตลาดกลาง (Central)', lat: 13.7563, lng: 100.5018 }, // Phra Nakhon
  { id: 'WIN-TECH-PARK', name: 'วินหน้าตึก Tech Park', lat: 13.7650, lng: 100.5380 }, // Victory Monument area approx
  { id: 'WIN-SUBURB-A', name: 'วินหมู่บ้าน A (Suburb)', lat: 13.7200, lng: 100.5600 }, // Khlong Toei approx
];

// Default Map Center (Bangkok)
export const MAP_CENTER = { lat: 13.7500, lng: 100.5100 };

// Thai Quick Messages
export const THAI_QUICK_MESSAGES = [
  { id: 1, text: "อยู่หน้าร้านสะดวกซื้อ", icon: "🏪" },
  { id: 2, text: "รอใต้ตึก", icon: "🏢" },
  { id: 3, text: "หน้าปากซอย", icon: "🛣️" },
  { id: 4, text: "หน้า รปภ.", icon: "👮" },
  { id: 5, text: "ใส่เสื้อสีขาว", icon: "👕" },
  { id: 6, text: "มีสัมภาระ", icon: "🎒" },
  { id: 7, text: "รีบมาก", icon: "🔥" },
  { id: 8, text: "ขอรอแป๊บ", icon: "✋" },
];

// Asset Path - MyWin Official Logo
export const APP_LOGO_PATH = '/mywin_logo.png';
