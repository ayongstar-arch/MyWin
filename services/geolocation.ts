import { Location } from '../types';

export const getCurrentPosition = (): Promise<Location> => {
    return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
            console.warn('Geolocation not supported');
            resolve({ lat: 13.7563, lng: 100.5018 }); // Default Bangkok
            return;
        }
        navigator.geolocation.getCurrentPosition(
            (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
            (err) => {
                console.warn('GPS Error', err);
                resolve({ lat: 13.7563, lng: 100.5018 }); // Fallback to Default
            },
            { enableHighAccuracy: true, timeout: 5000 }
        );
    });
};

export const watchPosition = (cb: (loc: Location) => void): number => {
    if (!navigator.geolocation) return -1;
    return navigator.geolocation.watchPosition(
        (pos) => cb({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        (err) => console.warn('GPS Watch Error', err),
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
    );
};

export const clearWatch = (id: number) => {
    if (!navigator.geolocation) return;
    navigator.geolocation.clearWatch(id);
};