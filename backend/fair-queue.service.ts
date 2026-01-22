import { Injectable, Logger } from '@nestjs/common';
import Redis from 'ioredis';

// Weights config
const WEIGHTS = {
  IDLE: 0.5,
  RECENCY: 0.3,
  TRIPS: 0.15,
  RATING: 0.05
};

@Injectable()
export class FairQueueService {
  private readonly redis: Redis;
  private readonly logger = new Logger(FairQueueService.name);
  private readonly WIN_RADIUS_METERS = 500; // e.g., 500m radius

  constructor() {
    // In a real app, inject ConfigService
    this.redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
  }

  /**
   * Main entry point: Driver enters the geofence of a Win
   * Uses LUA script to ensure atomicity of checks and score calculation
   */
  async joinQueue(winId: string, driverId: string, lat: number, lng: number) {
    // Define the LUA script for atomic score calculation and insertion
    const luaScript = `
      local winId = KEYS[1]
      local driverId = KEYS[2]
      local queueKey = "win:" .. winId .. ":queue"
      
      -- 1. Check if driver is already in queue
      if redis.call("ZSCORE", queueKey, driverId) then
        return "ALREADY_QUEUED"
      end

      -- 2. Fetch Driver Stats (Hash)
      local driverKey = "driver:" .. driverId .. ":stats"
      local stats = redis.call("HMGET", driverKey, "lastTripTime", "tripsToday", "rating", "status")
      
      local lastTripTime = tonumber(stats[1]) or 0
      local tripsToday = tonumber(stats[2]) or 0
      local rating = tonumber(stats[3]) or 5.0
      local status = stats[4]

      -- 3. Strict Status Check
      if status ~= "IDLE" then
        return "NOT_AVAILABLE"
      end

      -- 4. Calculate Score
      -- Formula: (IdleTime * 0.5) + (TimeSinceLast * 0.3) + (1/Trips * 0.15) + (Rating * 0.05)
      -- Note: IdleTime is 0 at the moment of joining
      
      local currentTime = tonumber(ARGV[1])
      local timeSinceLast = (currentTime - lastTripTime) -- Seconds
      
      -- Avoid div by zero
      local tripsFactor = 1 / math.max(1, tripsToday)

      -- We store the JOIN time to calculate dynamic idle time later, 
      -- BUT ZSET needs a static score for sorting. 
      -- Strategy: We use a Base Score + Join Timestamp Logic?
      -- Simplification: We calculate score NOW. 
      -- To handle dynamic IdleTime, we would need to update scores periodically 
      -- OR use the "entry time" as the primary sort, and boost it with the other factors.
      
      -- Let's stick to the prompt's formula as a Snapshot at entry.
      -- To properly weight "IdleTime", we rely on the fact that older entries 
      -- naturally wait longer. If we want to strictly follow the formula including *accumulated* idle time:
      -- We can update the score during the 'pop' phase or run a ticker.
      
      -- Implementation: Score = FixedAttributes + (EntryTimestamp * -0.5)
      -- Why? Because (Current - Entry) * 0.5 = (Current * 0.5) - (Entry * 0.5).
      -- Current * 0.5 is constant for everyone. Sorting by -Entry * 0.5 works!
      
      local fixedScore = (timeSinceLast * ${WEIGHTS.RECENCY}) + (tripsFactor * ${WEIGHTS.TRIPS}) + (rating * ${WEIGHTS.RATING})
      
      -- ZSET sorts low to high. We want High Score.
      -- We will use ZREVRANGE.
      -- Effective Score stored = fixedScore - (currentTime * ${WEIGHTS.IDLE})
      -- This is incorrect because we want (Current - Entry). 
      -- Let's store: fixedScore - (EntryTime * 0.5)
      -- When we read: (fixedScore - Entry*0.5) + Current*0.5
      
      local entryTime = currentTime
      local finalZSetScore = fixedScore - (entryTime * ${WEIGHTS.IDLE})
      
      redis.call("ZADD", queueKey, finalZSetScore, driverId)
      redis.call("HSET", driverKey, "currentWin", winId, "joinedQueueAt", entryTime)
      
      return "OK"
    `;

    // Execute
    const nowSeconds = Math.floor(Date.now() / 1000);
    return this.redis.eval(luaScript, 2, winId, driverId, nowSeconds);
  }

  /**
   * Dispatch: Pop the best driver
   */
  async popBestDriver(winId: string): Promise<string | null> {
    const queueKey = `win:${winId}:queue`;
    
    // Get top driver (Highest Score)
    const result = await this.redis.zrevrange(queueKey, 0, 0);
    
    if (!result || result.length === 0) return null;
    
    const bestDriverId = result[0];
    
    // Atomic Pop: Verify they are still there and remove
    // (Prevent race condition where two requests pop same driver)
    const popped = await this.redis.zrem(queueKey, bestDriverId);
    
    if (popped === 1) {
       this.logger.log(`Dispatching Driver ${bestDriverId} from Win ${winId}`);
       return bestDriverId;
    } else {
       // Driver was stolen by another process in the ms between ZREVRANGE and ZREM
       return this.popBestDriver(winId); // Retry
    }
  }

  /**
   * Handle Timeout (Driver didn't accept)
   * Penalty: Re-insert but reset their "IdleTime" effectively pushing them back.
   */
  async handleTimeout(winId: string, driverId: string) {
      // Logic: Update their 'joinedQueueAt' to NOW.
      // This resets the (IdleTime * 0.5) component to 0.
      // They keep their other scores (Rating, Recency), so they are better than a fresh low-rated driver,
      // but worse than they were before.
      
      await this.joinQueue(winId, driverId, 0, 0); // Re-run logic with new timestamp
      this.logger.warn(`Driver ${driverId} timed out. Re-queued with penalty.`);
  }
}
