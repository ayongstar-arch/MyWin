
import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class MapService {
  private readonly logger = new Logger(MapService.name);

  constructor() {}

  // Calculate Estimated Distance (Haversine * Traffic Factor)
  // Google Maps API is removed to align with "No Cost" concept and reduce API expenses.
  async getRoutingInfo(originLat: number, originLng: number, destLat: number, destLng: number) {
        const dist = this.haversine(originLat, originLng, destLat, destLng);
        
        // Win Motorcycle Heuristic:
        // Straight line distance * 1.4 (Road factor for winding roads/soi)
        const estimatedDist = dist * 1.4;
        
        return {
            distanceKm: estimatedDist, 
            durationMins: Math.ceil(estimatedDist * 3) // Approx 20km/h speed in city (3 mins per km)
        };
  }

  private haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Radius of the earth in km
    const dLat = this.deg2rad(lat2 - lat1);
    const dLon = this.deg2rad(lon2 - lon1);
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(this.deg2rad(lat1)) * Math.cos(this.deg2rad(lat2)) * 
      Math.sin(dLon/2) * Math.sin(dLon/2); 
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
    return R * c; 
  }

  private deg2rad(deg: number): number {
    return deg * (Math.PI/180);
  }
}
