
import React, { useState, useEffect } from 'react';
import { GoogleGenAI } from "@google/genai";

const DEFAULT_PROMPT = "A high-resolution photograph of the MyWin app logo, exactly as shown in Logo mywin.png, displayed prominently on the screen of a modern smartphone. The orange square icon with the white motorcycle graphic and the dark blue 'MyWin' text are centered against a clean, white app interface background. The smartphone is held in a hand, showing the realistic context of the logo in use.";

const AdminMarketingDashboard: React.FC = () => {
  const [prompt, setPrompt] = useState(DEFAULT_PROMPT);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasApiKey, setHasApiKey] = useState(false);

  useEffect(() => {
    checkApiKey();
  }, []);

  const checkApiKey = async () => {
    // @ts-ignore
    if (window.aistudio && window.aistudio.hasSelectedApiKey) {
      // @ts-ignore
      const has = await window.aistudio.hasSelectedApiKey();
      setHasApiKey(has);
    } else {
        // Fallback for dev environment without the overlay extension
        setHasApiKey(!!process.env.API_KEY);
    }
  };

  const handleSelectKey = async () => {
    try {
      // @ts-ignore
      if (window.aistudio && window.aistudio.openSelectKey) {
        // @ts-ignore
        await window.aistudio.openSelectKey();
        setHasApiKey(true);
      } else {
          alert("AI Studio overlay not found. Ensure you are running in the correct environment.");
      }
    } catch (e) {
      console.error(e);
      setError("Failed to select API Key");
    }
  };

  const handleGenerate = async () => {
    setIsLoading(true);
    setError(null);
    setGeneratedImage(null);

    try {
      // Re-initialize to ensure we pick up the selected key if applicable
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      const response = await ai.models.generateContent({
        model: 'gemini-3-pro-image-preview',
        contents: {
          parts: [{ text: prompt }],
        },
        config: {
          imageConfig: {
            aspectRatio: "16:9", // Cinematic look for marketing
            imageSize: "1K"
          }
        },
      });

      if (response.candidates?.[0]?.content?.parts) {
        for (const part of response.candidates[0].content.parts) {
          if (part.inlineData) {
            const base64String = part.inlineData.data;
            setGeneratedImage(`data:image/png;base64,${base64String}`);
            break;
          }
        }
      } else {
          throw new Error("No image data received from model.");
      }

    } catch (err: any) {
      console.error("Generation Error:", err);
      setError(err.message || "Failed to generate image. Please check your API Key and Quota.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownload = () => {
      if (!generatedImage) return;
      const link = document.createElement('a');
      link.href = generatedImage;
      link.download = `mywin-marketing-${Date.now()}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
  };

  return (
    <div className="flex-1 bg-slate-950 p-6 flex flex-col h-full overflow-hidden font-sans text-slate-200">
      <header className="mb-6">
        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <span>🎨</span> Marketing Asset Generator
        </h2>
        <p className="text-slate-500 text-sm">สร้างรูปภาพโฆษณาด้วย AI (Gemini Imagen)</p>
      </header>

      {!hasApiKey ? (
          <div className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-slate-800 rounded-2xl bg-slate-900/50">
              <div className="text-4xl mb-4">🔑</div>
              <h3 className="text-xl font-bold text-white mb-2">Authentication Required</h3>
              <p className="text-slate-400 mb-6 max-w-md text-center">
                  ในการใช้งานโมเดลสร้างภาพคุณภาพสูง (Gemini 3 Pro Image), จำเป็นต้องใช้ API Key จากบัญชีที่มีสิทธิ์เข้าถึง (Paid/Preview)
              </p>
              <button 
                onClick={handleSelectKey}
                className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-xl font-bold shadow-lg"
              >
                  Select API Key / Login
              </button>
              <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noreferrer" className="mt-4 text-xs text-slate-500 hover:underline">
                  เรียนรู้เพิ่มเติมเกี่ยวกับ Billing
              </a>
          </div>
      ) : (
          <div className="flex flex-col lg:flex-row gap-6 h-full overflow-hidden">
              {/* Controls */}
              <div className="w-full lg:w-1/3 flex flex-col gap-4">
                  <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 flex-1 flex flex-col">
                      <label className="text-xs font-bold text-slate-400 uppercase mb-2">Prompt Description</label>
                      <textarea 
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        className="w-full flex-1 bg-slate-950 border border-slate-700 rounded-lg p-3 text-slate-200 text-sm focus:border-emerald-500 outline-none resize-none leading-relaxed"
                        placeholder="Describe the image you want to generate..."
                      />
                      <div className="mt-4 flex flex-col gap-2">
                          <button 
                            onClick={handleGenerate}
                            disabled={isLoading}
                            className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold py-4 rounded-xl shadow-lg disabled:opacity-50 flex items-center justify-center gap-2"
                          >
                              {isLoading ? (
                                  <>
                                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                    กำลังสร้างภาพ...
                                  </>
                              ) : (
                                  <><span>✨</span> Generate Image</>
                              )}
                          </button>
                          {error && (
                              <div className="p-3 bg-red-900/20 border border-red-900/50 rounded-lg text-red-400 text-xs mt-2">
                                  {error}
                              </div>
                          )}
                      </div>
                  </div>
              </div>

              {/* Preview */}
              <div className="flex-1 bg-slate-900 rounded-xl border border-slate-800 flex items-center justify-center relative overflow-hidden group">
                  {generatedImage ? (
                      <>
                        <img src={generatedImage} alt="Generated Asset" className="max-w-full max-h-full object-contain shadow-2xl" />
                        <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button 
                                onClick={handleDownload}
                                className="bg-white text-slate-900 px-4 py-2 rounded-lg font-bold text-sm shadow-xl flex items-center gap-2"
                            >
                                📥 Download
                            </button>
                        </div>
                      </>
                  ) : (
                      <div className="text-center text-slate-600">
                          <div className="text-6xl mb-4 opacity-20">🖼️</div>
                          <p className="text-sm">ภาพที่สร้างจะปรากฏที่นี่</p>
                      </div>
                  )}
                  
                  {/* Loading Overlay */}
                  {isLoading && (
                      <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm flex flex-col items-center justify-center z-10">
                          <div className="w-16 h-16 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin mb-4"></div>
                          <p className="text-indigo-400 font-bold animate-pulse">AI กำลังวาดภาพ...</p>
                      </div>
                  )}
              </div>
          </div>
      )}
    </div>
  );
};

export default AdminMarketingDashboard;
