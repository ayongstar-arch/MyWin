import { Injectable, Logger } from '@nestjs/common';
import { PromotionRule, CreatePromotionDto } from './dtos';
import { GoogleGenAI, Type } from "@google/genai";

@Injectable()
export class PromotionService {
  private readonly logger = new Logger(PromotionService.name);
  private ai: GoogleGenAI;

  constructor() {
    this.ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  }

  // In-memory DB
  private promotions: PromotionRule[] = [
    {
      id: 'PROMO-TOPUP-50',
      name: 'Top-up 50 get 10',
      type: 'TOPUP_BONUS',
      description: 'เติม 50 บาท รับฟรี 10 แต้ม',
      condition: { minTopupAmount: 50 },
      benefit: { bonusPoints: 10 },
      active: true,
      maxUsagePerUser: 0, 
      maxTotalUsage: 1000,
      currentTotalUsage: 124,
      startDate: new Date().toISOString(),
      stats: { usersCount: 124, totalPointsGiven: 1240, estimatedRevenueGenerated: 6200 }
    },
    {
      id: 'PROMO-NEW-USER',
      name: 'First 3 Rides Free',
      type: 'RIDE_DISCOUNT',
      description: 'นั่งฟรี 3 ครั้งแรก',
      condition: { maxPriorRides: 3 },
      benefit: { isFree: true },
      active: true,
      maxUsagePerUser: 3, 
      maxTotalUsage: 500,
      currentTotalUsage: 135, // 45 users * 3 rides approx
      stats: { usersCount: 45, totalPointsGiven: 270, estimatedRevenueGenerated: 200 } // Low revenue impact vs cost
    }
  ];

  // Abuse Prevention Tracking: Map<UserId, Map<PromoId, UsageCount>>
  private usageLogs: Map<string, Map<string, number>> = new Map();

  getAllPromotions() {
    return this.promotions;
  }

  createPromotion(dto: CreatePromotionDto) {
    const newRule: PromotionRule = {
      id: `PROMO-${Date.now()}`,
      name: dto.name,
      type: dto.type,
      description: dto.type === 'TOPUP_BONUS' 
        ? `เติม ${dto.minTopupAmount} รับ ${dto.bonusPoints}` 
        : (dto.isFreeRide ? 'นั่งฟรี' : 'ส่วนลดค่ารถ'),
      condition: {
        minTopupAmount: dto.minTopupAmount,
        startTime: dto.startTime,
        endTime: dto.endTime,
        allowedAreaIds: dto.allowedAreaIds
      },
      benefit: {
        bonusPoints: dto.bonusPoints,
        isFree: dto.isFreeRide
      },
      active: true,
      maxUsagePerUser: dto.maxUsagePerUser || 0,
      maxTotalUsage: dto.maxTotalUsage || 0,
      currentTotalUsage: 0,
      startDate: dto.startDate,
      endDate: dto.endDate,
      stats: { usersCount: 0, totalPointsGiven: 0, estimatedRevenueGenerated: 0 }
    };
    this.promotions.push(newRule);
    return newRule;
  }

  togglePromotion(id: string) {
    const promo = this.promotions.find(p => p.id === id);
    if (promo) {
      promo.active = !promo.active;
      this.logger.log(`Promotion ${promo.name} is now ${promo.active ? 'ACTIVE' : 'INACTIVE'}`);
    }
    return promo;
  }

  // --- Helpers ---

  private isPromoActive(p: PromotionRule): boolean {
    if (!p.active) return false;
    const now = new Date();
    if (p.startDate && new Date(p.startDate) > now) return false;
    if (p.endDate && new Date(p.endDate) < now) return false;
    
    // Check Global Limit
    if (p.maxTotalUsage > 0 && p.currentTotalUsage >= p.maxTotalUsage) {
        return false; // Quota Exceeded
    }

    return true;
  }

  private checkUsageLimit(passengerId: string, promoId: string, limit: number): boolean {
    if (limit <= 0) return true; // Unlimited
    const userLog = this.usageLogs.get(passengerId);
    if (!userLog) return true;
    const count = userLog.get(promoId) || 0;
    return count < limit;
  }

  // --- Engine Logic ---

  evaluateTopup(passengerId: string, amount: number): { rule: PromotionRule | null, bonus: number } {
    const rules = this.promotions.filter(p => 
      this.isPromoActive(p) && 
      p.type === 'TOPUP_BONUS' && 
      p.condition.minTopupAmount !== undefined && 
      amount >= p.condition.minTopupAmount &&
      this.checkUsageLimit(passengerId, p.id, p.maxUsagePerUser || 0)
    );

    // Sort by highest bonus
    rules.sort((a, b) => (b.benefit.bonusPoints || 0) - (a.benefit.bonusPoints || 0));

    if (rules.length > 0) {
      const best = rules[0];
      return { rule: best, bonus: best.benefit.bonusPoints || 0 };
    }

    return { rule: null, bonus: 0 };
  }

  evaluateRide(passengerId: string, priorRidesCount: number, currentHour: number, areaId?: string): { rule: PromotionRule | null, discount: number, isFree: boolean } {
    const rules = this.promotions.filter(p => this.isPromoActive(p) && p.type === 'RIDE_DISCOUNT');
    
    // 1. Check New User / Free Ride
    const bestRule = rules.find(p => {
       // A. Check Constraints
       if (!this.checkUsageLimit(passengerId, p.id, p.maxUsagePerUser || 0)) return false;

       // B. Check Time
       if (p.condition.startTime && p.condition.endTime) {
           const startH = parseInt(p.condition.startTime.split(':')[0]);
           const endH = parseInt(p.condition.endTime.split(':')[0]);
           if (currentHour < startH || currentHour >= endH) return false;
       }

       // C. Check Area (If promo is area-restricted)
       if (p.condition.allowedAreaIds && p.condition.allowedAreaIds.length > 0) {
           if (!areaId || !p.condition.allowedAreaIds.includes(areaId)) return false;
       }

       // D. Check Conditions
       if (p.condition.maxPriorRides !== undefined) {
           if (priorRidesCount >= p.condition.maxPriorRides) return false;
       }

       return true;
    });

    if (bestRule) {
      const discount = bestRule.benefit.discountAmount || 0;
      const isFree = !!bestRule.benefit.isFree;
      return { rule: bestRule, discount, isFree };
    }

    return { rule: null, discount: 0, isFree: false };
  }

  logUsage(promoId: string, benefitAmount: number, revenueGenerated: number = 0) {
    const promo = this.promotions.find(p => p.id === promoId);
    if (promo) {
      promo.stats.usersCount++;
      promo.stats.totalPointsGiven += benefitAmount;
      promo.stats.estimatedRevenueGenerated += revenueGenerated;
      promo.currentTotalUsage++;
      
      // Auto-close if limit reached
      if (promo.maxTotalUsage > 0 && promo.currentTotalUsage >= promo.maxTotalUsage) {
          this.logger.warn(`Promotion ${promo.name} reached global limit (${promo.maxTotalUsage}).`);
      }
    }
  }

  // --- AI Analysis ---

  async analyzePromotions() {
    if (!process.env.API_KEY) {
       return { error: "API Key missing" };
    }

    const promoData = this.promotions.map(p => ({
        id: p.id,
        name: p.name,
        type: p.type,
        cost_points: p.stats.totalPointsGiven,
        incremental_revenue_baht: p.stats.estimatedRevenueGenerated,
        users: p.stats.usersCount
    }));

    const prompt = `
      Act as an AI Promotion Analyst for a Thai ride-hailing platform.
      Analyze the following promotion performance data.
      
      Data: ${JSON.stringify(promoData)}

      Task:
      1. Calculate ROI = (incremental_revenue_baht - cost_points) / cost_points
         (Assume 1 Point Cost = 1 Baht liability)
      2. Determine status:
         - GREEN (CONTINUE): ROI > 30%
         - YELLOW (ADJUST): ROI between 0% and 30%
         - RED (STOP): ROI < 0%
      3. Provide a short reason and a suggestion in THAI Language.
      
      Return JSON format only.
    `;

    try {
        const response = await this.ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            promoId: { type: Type.STRING },
                            roiPercent: { type: Type.NUMBER },
                            status: { type: Type.STRING, enum: ["GREEN", "YELLOW", "RED"] },
                            reason: { type: Type.STRING },
                            suggestion: { type: Type.STRING }
                        }
                    }
                }
            }
        });

        return JSON.parse(response.text || "[]");
    } catch (e) {
        this.logger.error("AI Analysis Failed", e);
        // Fallback mock response for demo stability
        return promoData.map(p => ({
            promoId: p.id,
            roiPercent: p.cost_points > 0 ? ((p.incremental_revenue_baht - p.cost_points)/p.cost_points)*100 : 0,
            status: "YELLOW",
            reason: "ระบบ AI ขัดข้องชั่วคราว (Fallback Mode)",
            suggestion: "โปรดตรวจสอบด้วยตนเอง"
        }));
    }
  }

  // --- Simulation / ROI ---
  
  getSimulationReport() {
    return this.promotions.map(p => {
      const cost = p.stats.totalPointsGiven; // 1 Point = 1 Baht (approx cost)
      const revenue = p.stats.estimatedRevenueGenerated;
      const profit = revenue - cost;
      const roi = cost > 0 ? (profit / cost) * 100 : 0;
      const costPerUser = p.stats.usersCount > 0 ? cost / p.stats.usersCount : 0;
      
      return {
        id: p.id,
        name: p.name,
        usage: p.stats.usersCount,
        cost,
        revenue,
        profit,
        roi,
        costPerUser,
        status: this.isPromoActive(p) ? 'ACTIVE' : 'STOPPED'
      };
    });
  }
}