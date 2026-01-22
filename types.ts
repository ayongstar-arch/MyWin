export type EntityStatus = 'IDLE' | 'MATCHED' | 'EN_ROUTE' | 'COMPLETED';

export interface Location {
  lat: number;
  lng: number;
}

export interface Driver {
  id: string;
  location: Location;
  status: EntityStatus;
  earnings: number;
  totalTrips: number;
  matchedRiderId?: string;
  
  // Station Affiliation
  winId?: string; // The specific station this driver belongs/queues at

  // Fairness Attributes
  rating: number;           // 1.0 - 5.0
  lastTripTime: number;     // Timestamp (ms)
  joinedQueueTime: number;  // Timestamp (ms) - resets when status becomes IDLE

  // External Integrations
  isLineConnected?: boolean; // True if driver has linked LINE Notify
}

export interface Rider {
  id: string;
  location: Location;
  destination: Location;
  requestTime: number; // Timestamp
  waitTime: number; // Seconds waiting
  status: EntityStatus;
  priorityScore: number; // Calculated fairness score
  message?: string; // Quick Message from Passenger
  targetWinId?: string; // OPTIONAL: If rider selects a specific station
}

export interface MatchLog {
  id: string;
  timestamp: number;
  riderId: string;
  driverId: string;
  distance: number;
  riderWaitTime: number;
  fairnessScore: number;
  reason: string;
}

export interface SystemMetrics {
  averageWaitTime: number;
  activeDrivers: number;
  pendingRiders: number;
  totalCompletedTrips: number;
  efficiencyIndex: number; // 0-100 score
}

export enum SimulationState {
  PAUSED,
  RUNNING,
}