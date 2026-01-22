import React, { useState, useRef, useEffect } from 'react';
import { socket } from '../services/socket';
import { Location } from '../types';

interface SOSButtonProps {
    userId: string;
    userType: 'DRIVER' | 'PASSENGER';
    tripId?: string;
    currentLocation: Location | null;
    disabled?: boolean;
}

const HOLD_DURATION_MS = 3000; // 3 seconds to activate

const SOSButton: React.FC<SOSButtonProps> = ({
    userId,
    userType,
    tripId,
    currentLocation,
    disabled = false
}) => {
    const [isHolding, setIsHolding] = useState(false);
    const [progress, setProgress] = useState(0);
    const [isTriggered, setIsTriggered] = useState(false);
    const [showConfirmation, setShowConfirmation] = useState(false);
    const holdTimer = useRef<NodeJS.Timeout | null>(null);
    const progressTimer = useRef<NodeJS.Timeout | null>(null);

    // Cleanup timers on unmount
    useEffect(() => {
        return () => {
            if (holdTimer.current) clearTimeout(holdTimer.current);
            if (progressTimer.current) clearInterval(progressTimer.current);
        };
    }, []);

    const startHold = () => {
        if (disabled || isTriggered) return;

        setIsHolding(true);
        setProgress(0);

        // Play haptic feedback
        if (navigator.vibrate) {
            navigator.vibrate(50);
        }

        // Progress animation
        const startTime = Date.now();
        progressTimer.current = setInterval(() => {
            const elapsed = Date.now() - startTime;
            const newProgress = Math.min((elapsed / HOLD_DURATION_MS) * 100, 100);
            setProgress(newProgress);

            if (newProgress >= 100) {
                triggerSOS();
            }
        }, 50);

        // Trigger after hold duration
        holdTimer.current = setTimeout(() => {
            triggerSOS();
        }, HOLD_DURATION_MS);
    };

    const cancelHold = () => {
        setIsHolding(false);
        setProgress(0);

        if (holdTimer.current) {
            clearTimeout(holdTimer.current);
            holdTimer.current = null;
        }
        if (progressTimer.current) {
            clearInterval(progressTimer.current);
            progressTimer.current = null;
        }
    };

    const triggerSOS = () => {
        cancelHold();
        setIsTriggered(true);
        setShowConfirmation(true);

        // Vibrate pattern for SOS
        if (navigator.vibrate) {
            navigator.vibrate([200, 100, 200, 100, 200, 100, 600]);
        }

        // Play alert sound
        try {
            const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
            audio.volume = 0.5;
            audio.play().catch(() => { });
        } catch (e) { }

        // Emit SOS event to server
        socket.emit('SOS_TRIGGER', {
            userId,
            userType,
            tripId,
            location: currentLocation || { lat: 0, lng: 0 },
            timestamp: new Date().toISOString()
        });

        // Listen for acknowledgment
        socket.once('SOS_ACKNOWLEDGED', (data: { message: string }) => {
            console.log('SOS Acknowledged:', data.message);
        });

        // Auto-hide confirmation after 5 seconds
        setTimeout(() => {
            setShowConfirmation(false);
        }, 5000);
    };

    const resetSOS = () => {
        setIsTriggered(false);
        setShowConfirmation(false);
    };

    return (
        <>
            {/* SOS Button */}
            <button
                onMouseDown={startHold}
                onMouseUp={cancelHold}
                onMouseLeave={cancelHold}
                onTouchStart={startHold}
                onTouchEnd={cancelHold}
                disabled={disabled}
                className={`
          fixed bottom-24 right-4 z-[999]
          w-16 h-16 rounded-full
          flex items-center justify-center
          shadow-2xl
          transition-all duration-200
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer active:scale-95'}
          ${isTriggered
                        ? 'bg-green-500 animate-pulse'
                        : isHolding
                            ? 'bg-red-700 scale-110'
                            : 'bg-red-600 hover:bg-red-500'
                    }
        `}
                style={{
                    boxShadow: isHolding
                        ? '0 0 30px rgba(239, 68, 68, 0.6)'
                        : '0 4px 20px rgba(0, 0, 0, 0.3)'
                }}
            >
                {/* Progress Ring */}
                {isHolding && (
                    <svg className="absolute inset-0 w-full h-full -rotate-90">
                        <circle
                            cx="32"
                            cy="32"
                            r="28"
                            fill="none"
                            stroke="rgba(255,255,255,0.3)"
                            strokeWidth="4"
                        />
                        <circle
                            cx="32"
                            cy="32"
                            r="28"
                            fill="none"
                            stroke="white"
                            strokeWidth="4"
                            strokeDasharray={`${2 * Math.PI * 28}`}
                            strokeDashoffset={`${2 * Math.PI * 28 * (1 - progress / 100)}`}
                            strokeLinecap="round"
                            className="transition-all duration-100"
                        />
                    </svg>
                )}

                {/* Icon */}
                <span className="text-white font-bold text-xl relative z-10">
                    {isTriggered ? '✓' : '🆘'}
                </span>
            </button>

            {/* Hold Instruction Tooltip */}
            {!isTriggered && !isHolding && (
                <div className="fixed bottom-[110px] right-4 z-[998] bg-slate-900/90 text-white text-[10px] px-2 py-1 rounded-lg shadow-lg opacity-70">
                    กดค้าง 3 วิ
                </div>
            )}

            {/* Holding Progress Modal */}
            {isHolding && (
                <div className="fixed inset-0 z-[998] bg-red-900/30 backdrop-blur-sm flex items-center justify-center animate-in fade-in duration-150">
                    <div className="text-center text-white">
                        <div className="text-6xl mb-4 animate-pulse">🆘</div>
                        <div className="text-2xl font-bold mb-2">กำลังส่งสัญญาณฉุกเฉิน</div>
                        <div className="text-lg opacity-70">ปล่อยมือเพื่อยกเลิก</div>
                        <div className="mt-4 w-48 h-2 bg-white/20 rounded-full overflow-hidden mx-auto">
                            <div
                                className="h-full bg-white rounded-full transition-all duration-100"
                                style={{ width: `${progress}%` }}
                            />
                        </div>
                        <div className="mt-2 text-sm font-mono">{Math.ceil((HOLD_DURATION_MS * (1 - progress / 100)) / 1000)} วินาที</div>
                    </div>
                </div>
            )}

            {/* Confirmation Modal */}
            {showConfirmation && (
                <div className="fixed inset-0 z-[1000] bg-slate-900/95 backdrop-blur-md flex items-center justify-center p-6 animate-in fade-in duration-200">
                    <div className="bg-white w-full max-w-sm rounded-3xl p-8 text-center shadow-2xl animate-in slide-in-from-bottom-10 duration-300">
                        <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                            <span className="text-5xl">✅</span>
                        </div>
                        <h2 className="text-2xl font-bold text-slate-800 mb-2">ส่งสัญญาณแล้ว!</h2>
                        <p className="text-slate-500 mb-6">
                            ทีมงานได้รับแจ้งเหตุฉุกเฉินแล้ว<br />
                            กรุณาอยู่ในที่ปลอดภัยและรอการติดต่อกลับ
                        </p>

                        <div className="bg-slate-100 p-4 rounded-xl mb-6 text-left">
                            <div className="text-xs text-slate-500 uppercase font-bold mb-2">ตำแหน่งที่ส่ง</div>
                            <div className="text-sm text-slate-700 font-mono">
                                {currentLocation
                                    ? `${currentLocation.lat.toFixed(6)}, ${currentLocation.lng.toFixed(6)}`
                                    : 'ไม่สามารถระบุตำแหน่งได้'
                                }
                            </div>
                        </div>

                        <div className="space-y-3">
                            <a
                                href="tel:191"
                                className="w-full bg-red-600 hover:bg-red-500 text-white font-bold py-4 rounded-xl shadow-lg flex items-center justify-center gap-2 transition-colors"
                            >
                                📞 โทร 191 (ตำรวจ)
                            </a>
                            <button
                                onClick={resetSOS}
                                className="w-full bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold py-3 rounded-xl transition-colors"
                            >
                                ปิด
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default SOSButton;
