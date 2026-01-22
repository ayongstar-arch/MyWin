import React, { useState, useEffect, useRef } from 'react';
import { socket } from '../services/socket';

interface ChatMessage {
    id: string;
    tripId: string;
    senderId: string;
    senderType: 'DRIVER' | 'PASSENGER';
    content: string;
    createdAt: string;
    isRead: boolean;
}

interface ChatModalProps {
    isOpen: boolean;
    onClose: () => void;
    tripId: string;
    myId: string;
    myType: 'DRIVER' | 'PASSENGER';
    counterpartName: string;
    counterpartAvatar?: string;
}

const ChatModal: React.FC<ChatModalProps> = ({
    isOpen,
    onClose,
    tripId,
    myId,
    myType,
    counterpartName,
    counterpartAvatar
}) => {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [inputText, setInputText] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const [isSending, setIsSending] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // Auto scroll to bottom
    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    // Join chat room and listen for messages
    useEffect(() => {
        if (!isOpen || !tripId) return;

        // Join the chat room
        socket.emit('CHAT_JOIN_ROOM', { tripId });

        // Listen for incoming messages
        const handleReceive = (message: ChatMessage) => {
            setMessages(prev => {
                // Avoid duplicates
                if (prev.find(m => m.id === message.id)) return prev;
                return [...prev, message];
            });
            setIsTyping(false);
        };

        // Listen for typing indicator
        const handleTyping = (data: { tripId: string, senderId: string }) => {
            if (data.tripId === tripId && data.senderId !== myId) {
                setIsTyping(true);
                setTimeout(() => setIsTyping(false), 3000);
            }
        };

        // Listen for chat history
        const handleHistory = (data: { tripId: string, messages: ChatMessage[] }) => {
            if (data.tripId === tripId) {
                setMessages(data.messages);
            }
        };

        socket.on('CHAT_RECEIVE', handleReceive);
        socket.on('CHAT_TYPING', handleTyping);
        socket.on('CHAT_HISTORY', handleHistory);

        // Request chat history
        socket.emit('CHAT_GET_HISTORY', { tripId });

        return () => {
            socket.off('CHAT_RECEIVE', handleReceive);
            socket.off('CHAT_TYPING', handleTyping);
            socket.off('CHAT_HISTORY', handleHistory);
            socket.emit('CHAT_LEAVE_ROOM', { tripId });
        };
    }, [isOpen, tripId, myId]);

    // Focus input when modal opens
    useEffect(() => {
        if (isOpen) {
            setTimeout(() => inputRef.current?.focus(), 100);
        }
    }, [isOpen]);

    const handleSend = () => {
        if (!inputText.trim() || isSending) return;

        setIsSending(true);

        const message = {
            tripId,
            senderId: myId,
            senderType: myType,
            content: inputText.trim(),
        };

        socket.emit('CHAT_SEND', message);

        // Optimistic update
        const optimisticMessage: ChatMessage = {
            id: `temp-${Date.now()}`,
            ...message,
            createdAt: new Date().toISOString(),
            isRead: false,
        };
        setMessages(prev => [...prev, optimisticMessage]);
        setInputText('');
        setIsSending(false);
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setInputText(e.target.value);
        // Emit typing indicator
        socket.emit('CHAT_TYPING', { tripId, senderId: myId });
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const formatTime = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
    };

    // Quick replies
    const quickReplies = myType === 'DRIVER'
        ? ['ใกล้ถึงแล้วครับ', 'รอสักครู่นะครับ', 'อยู่ตรงไหนครับ?', 'รับทราบครับ']
        : ['รอหน้าร้านค่ะ', 'ใส่เสื้อสีขาว', 'รีบหน่อยนะคะ', 'ขอบคุณค่ะ'];

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="w-full max-w-md h-[80vh] sm:h-[600px] bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-10 duration-300">
                {/* Header */}
                <div className="bg-slate-900 text-white p-4 flex items-center gap-3 shrink-0">
                    <button
                        onClick={onClose}
                        className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
                    >
                        ←
                    </button>
                    <div className="w-10 h-10 rounded-full bg-slate-700 overflow-hidden border-2 border-emerald-500">
                        {counterpartAvatar ? (
                            <img src={counterpartAvatar} className="w-full h-full object-cover" alt="" />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center text-lg">
                                {myType === 'DRIVER' ? '🙋' : '🛵'}
                            </div>
                        )}
                    </div>
                    <div className="flex-1">
                        <div className="font-bold">{counterpartName}</div>
                        <div className="text-xs text-slate-400 flex items-center gap-1">
                            <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
                            ออนไลน์
                        </div>
                    </div>
                    <div className="text-2xl">💬</div>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50">
                    {messages.length === 0 && (
                        <div className="text-center py-10 text-slate-400">
                            <div className="text-4xl mb-2">💬</div>
                            <div className="text-sm">เริ่มต้นการสนทนา</div>
                        </div>
                    )}

                    {messages.map((msg) => {
                        const isMe = msg.senderId === myId;
                        return (
                            <div
                                key={msg.id}
                                className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}
                            >
                                <div
                                    className={`max-w-[75%] px-4 py-2.5 rounded-2xl shadow-sm ${isMe
                                            ? 'bg-emerald-500 text-white rounded-br-sm'
                                            : 'bg-white text-slate-800 rounded-bl-sm border border-slate-200'
                                        }`}
                                >
                                    <div className="text-sm leading-relaxed">{msg.content}</div>
                                    <div className={`text-[10px] mt-1 ${isMe ? 'text-emerald-100' : 'text-slate-400'}`}>
                                        {formatTime(msg.createdAt)}
                                        {isMe && msg.isRead && ' ✓✓'}
                                    </div>
                                </div>
                            </div>
                        );
                    })}

                    {/* Typing Indicator */}
                    {isTyping && (
                        <div className="flex justify-start">
                            <div className="bg-white px-4 py-3 rounded-2xl rounded-bl-sm border border-slate-200 shadow-sm">
                                <div className="flex gap-1">
                                    <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                                    <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                                    <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                                </div>
                            </div>
                        </div>
                    )}

                    <div ref={messagesEndRef} />
                </div>

                {/* Quick Replies */}
                <div className="px-4 py-2 bg-white border-t border-slate-100 shrink-0">
                    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                        {quickReplies.map((reply, idx) => (
                            <button
                                key={idx}
                                onClick={() => setInputText(reply)}
                                className="shrink-0 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-full text-xs text-slate-600 font-medium transition-colors"
                            >
                                {reply}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Input */}
                <div className="p-4 bg-white border-t border-slate-200 shrink-0">
                    <div className="flex gap-2">
                        <input
                            ref={inputRef}
                            type="text"
                            value={inputText}
                            onChange={handleInputChange}
                            onKeyPress={handleKeyPress}
                            placeholder="พิมพ์ข้อความ..."
                            className="flex-1 bg-slate-100 border-none px-4 py-3 rounded-xl text-sm outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                        />
                        <button
                            onClick={handleSend}
                            disabled={!inputText.trim() || isSending}
                            className="w-12 h-12 bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-200 disabled:text-slate-400 text-white rounded-xl flex items-center justify-center shadow-lg transition-all active:scale-95"
                        >
                            {isSending ? (
                                <span className="animate-spin">⏳</span>
                            ) : (
                                <span className="text-lg">➤</span>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ChatModal;
