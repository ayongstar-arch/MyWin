import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { Driver, Rider } from '../types';
import { MAP_CENTER } from '../constants';

// --- CUSTOM ICONS ---
const createIcon = (emoji: string, bgColor: string) => L.divIcon({
  html: `<div style="background:${bgColor}; width:24px; height:24px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:14px; box-shadow: 0 0 10px ${bgColor}; border: 2px solid white;">${emoji}</div>`,
  className: 'custom-marker-icon',
  iconSize: [24, 24],
  iconAnchor: [12, 12]
});

const Icons = {
    DRIVER_IDLE: createIcon('🛵', '#10b981'),
    DRIVER_BUSY: createIcon('🛵', '#f59e0b'),
    RIDER_WAITING: createIcon('🙋', '#ef4444'),
    RIDER_MATCHED: createIcon('😌', '#3b82f6'),
    STATION: createIcon('🏁', '#6366f1'),
};

interface MapBoardProps {
  drivers: Driver[];
  riders: Rider[];
}

const MapUpdater: React.FC<{ center: {lat: number, lng: number} }> = ({ center }) => {
    const map = useMap();
    // Optional: Auto-pan logic here if needed
    return null;
}

const MapBoard: React.FC<MapBoardProps> = ({ drivers, riders }) => {
  return (
    <div className="bg-slate-900 border border-slate-700 rounded-lg overflow-hidden shadow-2xl relative h-full w-full z-0">
      <MapContainer 
        center={[MAP_CENTER.lat, MAP_CENTER.lng]} 
        zoom={13} 
        scrollWheelZoom={true} 
        style={{ height: "100%", width: "100%", background: '#0f172a' }}
        attributionControl={false}
      >
        {/* Dark Matter Tiles (Professional Look) */}
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
        />

        {/* DRIVERS */}
        {drivers.map(driver => {
            // Safety Check: Ensure valid coordinates to prevent crash
            if (!driver.location || typeof driver.location.lat !== 'number' || typeof driver.location.lng !== 'number') return null;
            
            return (
                <Marker 
                    key={driver.id} 
                    position={[driver.location.lat, driver.location.lng]} 
                    icon={driver.status === 'IDLE' ? Icons.DRIVER_IDLE : Icons.DRIVER_BUSY}
                >
                    <Popup className="text-black">
                        <strong>Driver: {driver.id}</strong><br/>
                        Status: {driver.status}<br/>
                        Win: {driver.winId}
                    </Popup>
                </Marker>
            );
        })}

        {/* RIDERS */}
        {riders.map(rider => {
            // Safety Check
            if (!rider.location || typeof rider.location.lat !== 'number' || typeof rider.location.lng !== 'number') return null;

            return (
                <Marker 
                    key={rider.id} 
                    position={[rider.location.lat, rider.location.lng]} 
                    icon={rider.status === 'IDLE' ? Icons.RIDER_WAITING : Icons.RIDER_MATCHED}
                >
                    <Popup className="text-black">
                        <strong>Rider: {rider.id}</strong><br/>
                        Wait: {rider.waitTime}s
                    </Popup>
                </Marker>
            );
        })}

      </MapContainer>
      
      {/* Legend Overlay */}
      <div className="absolute top-2 right-2 bg-slate-900/90 p-2 rounded border border-slate-700 text-xs text-slate-300 z-[1000]">
        <div className="flex items-center gap-2 mb-1"><span className="w-2 h-2 rounded-full bg-emerald-500"></span> วิน (ว่าง)</div>
        <div className="flex items-center gap-2 mb-1"><span className="w-2 h-2 rounded-full bg-amber-500"></span> วิน (รับงาน)</div>
        <div className="flex items-center gap-2 mb-1"><span className="w-2 h-2 rounded-full bg-red-500"></span> ผู้โดยสาร (รอ)</div>
        <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-blue-500"></span> ผู้โดยสาร (ได้รถ)</div>
      </div>
    </div>
  );
};

export default MapBoard;