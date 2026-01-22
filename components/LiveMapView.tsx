import React, { useEffect, useState, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import { Location } from '../types';
import { MAP_CENTER } from '../constants';

// --- CUSTOM ICONS ---
const createIcon = (emoji: string, bgColor: string, size: number = 32) => L.divIcon({
    html: `<div style="
    background: ${bgColor}; 
    width: ${size}px; 
    height: ${size}px; 
    border-radius: 50%; 
    display: flex; 
    align-items: center; 
    justify-content: center; 
    font-size: ${size * 0.5}px; 
    box-shadow: 0 4px 15px ${bgColor}80; 
    border: 3px solid white;
    animation: pulse 2s infinite;
  ">${emoji}</div>`,
    className: 'custom-marker-icon',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2]
});

const Icons = {
    MY_LOCATION: createIcon('📍', '#3b82f6', 36),
    DRIVER: createIcon('🛵', '#10b981', 40),
    PASSENGER: createIcon('🙋', '#ef4444', 36),
    DESTINATION: createIcon('🏁', '#8b5cf6', 32),
    PICKUP: createIcon('📌', '#f59e0b', 32),
};

interface LiveMapViewProps {
    myLocation: Location | null;
    counterpartLocation?: Location | null;
    pickupLocation?: Location | null;
    destinationLocation?: Location | null;
    userType: 'DRIVER' | 'PASSENGER';
    showRoute?: boolean;
    eta?: number; // in minutes
    distance?: number; // in km
    onClose?: () => void;
}

// Component to auto-fit bounds
const MapFitter: React.FC<{ points: Location[] }> = ({ points }) => {
    const map = useMap();

    useEffect(() => {
        if (points.length >= 2) {
            const bounds = L.latLngBounds(points.map(p => [p.lat, p.lng]));
            map.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });
        } else if (points.length === 1) {
            map.setView([points[0].lat, points[0].lng], 15);
        }
    }, [points, map]);

    return null;
};

// Calculate distance using Haversine formula
const calculateDistance = (a: Location, b: Location): number => {
    const R = 6371; // Radius of earth in km
    const dLat = (b.lat - a.lat) * Math.PI / 180;
    const dLng = (b.lng - a.lng) * Math.PI / 180;
    const lat1 = a.lat * Math.PI / 180;
    const lat2 = b.lat * Math.PI / 180;

    const x = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.sin(dLng / 2) * Math.sin(dLng / 2) * Math.cos(lat1) * Math.cos(lat2);
    const c = 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
    return R * c;
};

// Calculate ETA based on average speed (25 km/h for motorbike in city)
const calculateETA = (distanceKm: number): number => {
    const averageSpeedKmH = 25;
    return Math.ceil((distanceKm / averageSpeedKmH) * 60); // minutes
};

const LiveMapView: React.FC<LiveMapViewProps> = ({
    myLocation,
    counterpartLocation,
    pickupLocation,
    destinationLocation,
    userType,
    showRoute = true,
    eta: propEta,
    distance: propDistance,
    onClose
}) => {
    const [currentEta, setCurrentEta] = useState<number>(0);
    const [currentDistance, setCurrentDistance] = useState<number>(0);

    // Calculate route points for polyline
    const routePoints = useMemo(() => {
        const points: [number, number][] = [];

        if (userType === 'PASSENGER') {
            // Passenger view: Driver → My Location (Pickup) → Destination
            if (counterpartLocation) points.push([counterpartLocation.lat, counterpartLocation.lng]);
            if (myLocation) points.push([myLocation.lat, myLocation.lng]);
            if (destinationLocation) points.push([destinationLocation.lat, destinationLocation.lng]);
        } else {
            // Driver view: My Location → Pickup → Destination
            if (myLocation) points.push([myLocation.lat, myLocation.lng]);
            if (pickupLocation) points.push([pickupLocation.lat, pickupLocation.lng]);
            if (destinationLocation) points.push([destinationLocation.lat, destinationLocation.lng]);
        }

        return points;
    }, [myLocation, counterpartLocation, pickupLocation, destinationLocation, userType]);

    // Calculate ETA and distance
    useEffect(() => {
        if (propEta !== undefined) {
            setCurrentEta(propEta);
        } else if (userType === 'PASSENGER' && counterpartLocation && myLocation) {
            const dist = calculateDistance(counterpartLocation, myLocation);
            setCurrentDistance(dist);
            setCurrentEta(calculateETA(dist));
        } else if (userType === 'DRIVER' && myLocation && pickupLocation) {
            const dist = calculateDistance(myLocation, pickupLocation);
            setCurrentDistance(dist);
            setCurrentEta(calculateETA(dist));
        }
    }, [myLocation, counterpartLocation, pickupLocation, propEta, userType]);

    // Collect all valid points for bounds fitting
    const allPoints = useMemo(() => {
        const points: Location[] = [];
        if (myLocation) points.push(myLocation);
        if (counterpartLocation) points.push(counterpartLocation);
        if (pickupLocation) points.push(pickupLocation);
        if (destinationLocation) points.push(destinationLocation);
        return points;
    }, [myLocation, counterpartLocation, pickupLocation, destinationLocation]);

    const center = myLocation || MAP_CENTER;

    return (
        <div className="relative w-full h-full bg-slate-900 rounded-2xl overflow-hidden shadow-2xl">
            {/* Close Button */}
            {onClose && (
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 z-[1000] w-10 h-10 bg-white/90 hover:bg-white rounded-full shadow-lg flex items-center justify-center text-slate-600 font-bold transition-all"
                >
                    ✕
                </button>
            )}

            {/* ETA Banner */}
            <div className="absolute top-4 left-4 z-[1000] bg-slate-900/95 backdrop-blur-sm px-4 py-3 rounded-2xl shadow-xl border border-slate-700">
                <div className="flex items-center gap-4">
                    <div>
                        <div className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">ถึงปลายทาง</div>
                        <div className="text-2xl font-bold text-white flex items-baseline gap-1">
                            {currentEta > 0 ? (
                                <>
                                    <span>{currentEta}</span>
                                    <span className="text-sm text-slate-400">นาที</span>
                                </>
                            ) : (
                                <span className="text-emerald-400">กำลังคำนวณ...</span>
                            )}
                        </div>
                    </div>
                    <div className="w-px h-10 bg-slate-700"></div>
                    <div>
                        <div className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">ระยะทาง</div>
                        <div className="text-lg font-bold text-slate-300">
                            {currentDistance > 0 ? `${currentDistance.toFixed(1)} กม.` : '...'}
                        </div>
                    </div>
                </div>
            </div>

            {/* Map */}
            <MapContainer
                center={[center.lat, center.lng]}
                zoom={15}
                scrollWheelZoom={true}
                style={{ height: '100%', width: '100%', background: '#0f172a' }}
                attributionControl={false}
                zoomControl={false}
            >
                {/* Dark Map Tiles */}
                <TileLayer
                    url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                />

                {/* Auto-fit bounds */}
                <MapFitter points={allPoints} />

                {/* Route Polyline */}
                {showRoute && routePoints.length >= 2 && (
                    <>
                        {/* Shadow line */}
                        <Polyline
                            positions={routePoints}
                            pathOptions={{
                                color: '#000',
                                weight: 8,
                                opacity: 0.3,
                            }}
                        />
                        {/* Main route line */}
                        <Polyline
                            positions={routePoints}
                            pathOptions={{
                                color: '#10b981',
                                weight: 5,
                                opacity: 1,
                                dashArray: '10, 10',
                                lineCap: 'round',
                            }}
                        />
                    </>
                )}

                {/* My Location Marker */}
                {myLocation && (
                    <Marker
                        position={[myLocation.lat, myLocation.lng]}
                        icon={userType === 'DRIVER' ? Icons.DRIVER : Icons.MY_LOCATION}
                    >
                        <Popup>
                            <strong>{userType === 'DRIVER' ? 'ตำแหน่งของคุณ (คนขับ)' : 'ตำแหน่งของคุณ'}</strong>
                        </Popup>
                    </Marker>
                )}

                {/* Counterpart Marker (Driver for Passenger, Rider for Driver) */}
                {counterpartLocation && (
                    <Marker
                        position={[counterpartLocation.lat, counterpartLocation.lng]}
                        icon={userType === 'PASSENGER' ? Icons.DRIVER : Icons.PASSENGER}
                    >
                        <Popup>
                            <strong>{userType === 'PASSENGER' ? 'คนขับกำลังมารับ' : 'ผู้โดยสาร'}</strong>
                        </Popup>
                    </Marker>
                )}

                {/* Pickup Marker (for Driver view) */}
                {pickupLocation && userType === 'DRIVER' && (
                    <Marker position={[pickupLocation.lat, pickupLocation.lng]} icon={Icons.PICKUP}>
                        <Popup><strong>จุดรับผู้โดยสาร</strong></Popup>
                    </Marker>
                )}

                {/* Destination Marker */}
                {destinationLocation && (
                    <Marker position={[destinationLocation.lat, destinationLocation.lng]} icon={Icons.DESTINATION}>
                        <Popup><strong>จุดหมายปลายทาง</strong></Popup>
                    </Marker>
                )}
            </MapContainer>

            {/* Bottom Status Bar */}
            <div className="absolute bottom-4 left-4 right-4 z-[1000]">
                <div className="bg-slate-900/95 backdrop-blur-sm rounded-2xl p-4 border border-slate-700 shadow-xl">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-full bg-emerald-500/20 flex items-center justify-center">
                                <span className="text-2xl">{userType === 'DRIVER' ? '🛵' : '📍'}</span>
                            </div>
                            <div>
                                <div className="text-white font-bold">
                                    {userType === 'DRIVER' ? 'กำลังเดินทางไปรับ' : 'คนขับกำลังมารับคุณ'}
                                </div>
                                <div className="text-slate-400 text-sm">
                                    {currentEta > 0 ? `อีกประมาณ ${currentEta} นาที` : 'กำลังหาตำแหน่ง...'}
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 bg-emerald-500 rounded-full animate-pulse"></div>
                            <span className="text-emerald-400 text-sm font-bold">LIVE</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* CSS for pulse animation */}
            <style>{`
        @keyframes pulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.05); opacity: 0.9; }
        }
      `}</style>
        </div>
    );
};

export default LiveMapView;
