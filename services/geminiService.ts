import { GoogleGenAI, Type } from "@google/genai";
import { MatchLog, SystemMetrics } from "../types";

export const auditFairness = async (
  logs: MatchLog[],
  metrics: SystemMetrics
): Promise<{ analysis: string; score: number }> => {
  if (!process.env.API_KEY) {
    return {
      analysis: "ไม่พบ API Key ไม่สามารถทำการตรวจสอบด้วย AI ได้",
      score: 0
    };
  }

  const recentLogs = logs.slice(0, 10); // Analyze last 10 matches for latency reasons

  const prompt = `
    Act as a Neutral Fair-Dispatch Auditor for a Thai ride-hailing platform (Win Motorbike).
    Review the following system metrics and recent dispatch logs.
    
    System Metrics:
    - Avg Wait Time: ${metrics.averageWaitTime.toFixed(1)}s
    - Efficiency Index: ${metrics.efficiencyIndex.toFixed(1)}
    
    Recent Dispatch Logs (Sample):
    ${JSON.stringify(recentLogs.map(l => ({
      wait: l.riderWaitTime,
      dist: l.distance,
      score: l.fairnessScore
    })))}

    Evaluate if the system is preventing starvation (long wait times) effectively.
    Is the trade-off between efficiency (distance) and fairness (wait time) balanced?
    
    **IMPORTANT:** Provide the analysis in THAI LANGUAGE (ภาษาไทย).
    Provide a concise 1-paragraph analysis and a fairness score out of 100.
  `;

  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            analysis: { type: Type.STRING },
            score: { type: Type.NUMBER },
          }
        }
      }
    });

    const jsonText = response.text;
    if (!jsonText) throw new Error("Empty response");
    
    return JSON.parse(jsonText);
  } catch (error) {
    console.error("Gemini Audit Error:", error);
    return {
      analysis: "การตรวจสอบล้มเหลวเนื่องจากปัญหาทางเทคนิค",
      score: 50
    };
  }
};

export const generateRiderPersona = async (): Promise<{ name: string; destinationType: string }> => {
    if (!process.env.API_KEY) return { name: "Simulated User", destinationType: "Random Location" };

    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: "Generate a realistic Southeast Asian rider persona name (first name only) and a short destination type (e.g., 'Night Market', 'Tech Park'). JSON format.",
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        name: { type: Type.STRING },
                        destinationType: { type: Type.STRING }
                    }
                }
            }
        });
        return JSON.parse(response.text || "{}");
    } catch (e) {
        return { name: "Rider", destinationType: "General" };
    }
}