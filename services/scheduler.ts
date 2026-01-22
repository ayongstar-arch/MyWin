
import { Driver, Rider, Location, MatchLog, EntityStatus } from '../types';
import { FAIRNESS_WEIGHTS } from '../constants';

const WIN_RADIUS_KM = 3.0; // Increased radius for real map testing

// Haversine Formula for Real Distance (Km)
export const calculateDistance = (a: Location, b: Location): number => {
    const R = 6371; // Radius of the earth in km
    const dLat = deg2rad(b.lat - a.lat);
    const dLng = deg2rad(b.lng - a.lng);
    const lat1 = deg2rad(a.lat);
    const lat2 = deg2rad(b.lat);

    const x = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.sin(dLng/2) * Math.sin(dLng/2) * Math.cos(lat1) * Math.cos(lat2); 
    const c = 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1-x)); 
    return R * c; // Distance in km
};

function deg2rad(deg: number) {
  return deg * (Math.PI/180);
}

/**
 * Calculates the Priority Score based on the Fairness Formula.
 * Uses centralized weights from constants.ts
 */
export const calculateFairnessScore = (driver: Driver, currentTime: number): number => {
  const idleTimeSec = Math.max(0, (currentTime - driver.joinedQueueTime) / 1000);
  const timeSinceLastTripSec = Math.max(0, (currentTime - driver.lastTripTime) / 1000);
  const tripsFactor = 1 / Math.max(1, driver.totalTrips);

  const wIdle = FAIRNESS_WEIGHTS.IDLE;
  const wRecency = FAIRNESS_WEIGHTS.RECENCY;
  const wTrips = FAIRNESS_WEIGHTS.TRIPS;
  const wRating = FAIRNESS_WEIGHTS.RATING;

  const score = 
    (idleTimeSec * wIdle) +
    (timeSinceLastTripSec * wRecency) +
    (tripsFactor * wTrips * 100) + 
    (driver.rating * wRating * 10);

  return score;
};

export interface MatchResult {
  updatedDrivers: Driver[];
  updatedRiders: Rider[];
  newLogs: MatchLog[];
}

export const runDispatchCycle = (
  drivers: Driver[],
  riders: Rider[],
  currentTime: number
): MatchResult => {
  const availableDrivers = drivers.filter(d => d.status === 'IDLE');
  const pendingRiders = riders.filter(r => r.status === 'IDLE');
  
  pendingRiders.sort((a, b) => b.waitTime - a.waitTime);

  const nextDrivers = [...drivers];
  const nextRiders = [...riders];
  const newLogs: MatchLog[] = [];

  const matchedDriverIds = new Set<string>();
  const matchedRiderIds = new Set<string>();

  for (const rider of pendingRiders) {
    if (matchedRiderIds.has(rider.id)) continue;

    let candidates = availableDrivers.filter(d => !matchedDriverIds.has(d.id));

    if (rider.targetWinId) {
        candidates = candidates.filter(d => d.winId === rider.targetWinId);
    } else {
        candidates = candidates.filter(d => {
            const dist = calculateDistance(d.location, rider.location);
            return dist <= WIN_RADIUS_KM;
        });
    }

    if (candidates.length === 0) continue;

    const scoredCandidates = candidates.map(d => ({
      driver: d,
      score: calculateFairnessScore(d, currentTime),
      dist: calculateDistance(d.location, rider.location)
    }));

    // Sort by Score Descending
    scoredCandidates.sort((a, b) => b.score - a.score);

    const match = scoredCandidates[0];
    const winner = match.driver;

    matchedRiderIds.add(rider.id);
    matchedDriverIds.add(winner.id);

    const driverIdx = nextDrivers.findIndex(d => d.id === winner.id);
    const riderIdx = nextRiders.findIndex(r => r.id === rider.id);

    if (driverIdx !== -1 && riderIdx !== -1) {
      nextDrivers[driverIdx] = {
        ...nextDrivers[driverIdx],
        status: 'MATCHED',
        matchedRiderId: rider.id
      };
      
      nextRiders[riderIdx] = {
        ...nextRiders[riderIdx],
        status: 'MATCHED'
      };

      const stationLabel = winner.winId ? `[${winner.winId}]` : '';
      
      // LOGIC UPDATE: Identify match type (Sole vs Competitive)
      const isSoleCandidate = candidates.length === 1;
      const competitionLabel = isSoleCandidate ? '(ยืนหนึ่ง)' : `(ชนะ ${candidates.length-1} คู่แข่ง)`;

      newLogs.push({
        id: crypto.randomUUID(),
        timestamp: currentTime,
        riderId: rider.id,
        driverId: winner.id,
        distance: parseFloat(match.dist.toFixed(2)),
        riderWaitTime: rider.waitTime,
        fairnessScore: parseFloat(match.score.toFixed(2)),
        // Embed reasoning
        reason: `${stationLabel} ${competitionLabel} Idle:${((currentTime - winner.joinedQueueTime)/1000).toFixed(0)}s`
      });
    }
  }

  return {
    updatedDrivers: nextDrivers,
    updatedRiders: nextRiders,
    newLogs
  };
};

export const moveAgents = (drivers: Driver[], riders: Rider[]): { drivers: Driver[], riders: Rider[] } => {
  const now = Date.now();
  const SPEED_FACTOR = 0.00003; // Lat/Lng movement per tick (approx 3m per tick)

  const nextDrivers = drivers.map(d => {
    // Handling Matched/Moving
    if (d.status === 'MATCHED' && d.matchedRiderId) {
      const rider = riders.find(r => r.id === d.matchedRiderId);
      if (rider) {
        const dest = rider.destination;
        const dLat = dest.lat - d.location.lat;
        const dLng = dest.lng - d.location.lng;
        const dist = Math.sqrt(dLat*dLat + dLng*dLng);
        
        if (dist < 0.0005) { // ~50 meters tolerance
          // Trip Completed
          return { 
            ...d, 
            location: dest, 
            status: 'IDLE' as EntityStatus, 
            matchedRiderId: undefined, 
            totalTrips: d.totalTrips + 1, 
            earnings: d.earnings + 20,
            lastTripTime: now,      
            joinedQueueTime: now    
          };
        } else {
          // Move towards destination
          const ratio = Math.min(1, SPEED_FACTOR * 5 / dist); // Move faster when on trip
          const moveLat = dLat * ratio;
          const moveLng = dLng * ratio;
          return { ...d, location: { lat: d.location.lat + moveLat, lng: d.location.lng + moveLng } };
        }
      }
    }
    // Random idle movement (Brownian motion)
    if (d.status === 'IDLE') {
        const moveLat = (Math.random() - 0.5) * SPEED_FACTOR;
        const moveLng = (Math.random() - 0.5) * SPEED_FACTOR;
        return { 
            ...d, 
            location: { 
                lat: d.location.lat + moveLat, 
                lng: d.location.lng + moveLng 
            } 
        };
    }
    return d;
  });

  const nextRiders = riders.map(r => {
      if (r.status === 'MATCHED') return r;
      return { ...r, waitTime: r.waitTime + 1, priorityScore: Math.pow(r.waitTime + 1, 1.5) };
  });

  return { drivers: nextDrivers, riders: nextRiders };
};
