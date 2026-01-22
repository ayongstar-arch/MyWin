
import { EventEmitter } from 'events';
import { io, Socket } from 'socket.io-client';
import { SOCKET_URL, IS_PRODUCTION } from '../constants';

export interface ISocketService {
  on(event: string, listener: (...args: any[]) => void): this;
  off(event: string, listener: (...args: any[]) => void): this;
  emit(event: string, ...args: any[]): boolean;
  removeAllListeners(event?: string): this;
  disconnect?(): void;
}

/**
 * MOCK SOCKET SERVICE
 * Used for in-browser simulation (Local Development Mode without Backend)
 */
class MockSocketService extends EventEmitter implements ISocketService {
  private channel: BroadcastChannel;

  constructor() {
    super();
    // Use BroadcastChannel to talk between tabs/windows
    this.channel = new BroadcastChannel('mywin_cluster_channel');
    
    // Listen to messages from other tabs
    this.channel.onmessage = (ev) => {
       const { event, args } = ev.data;
       super.emit(event, ...args);
    };
  }

  public on(event: string, listener: (...args: any[]) => void): this {
    super.on(event, listener);
    return this;
  }

  public off(event: string, listener: (...args: any[]) => void): this {
    super.removeListener(event, listener);
    return this;
  }

  public removeAllListeners(event?: string): this {
    super.removeAllListeners(event);
    return this;
  }

  public emit(event: string, ...args: any[]): boolean {
    // Broadcast to OTHER tabs
    setTimeout(() => {
        super.emit(event, ...args); // Emit to self
        this.channel.postMessage({ event, args }); // Emit to others
    }, 50); 
    return true;
  }
}

/**
 * REAL SOCKET SERVICE
 * Connects to the NestJS Backend via WebSocket
 */
class RealSocketService extends EventEmitter implements ISocketService {
    private socket: Socket;

    constructor() {
        super();
        
        // Auto-configure transports based on environment
        // In Prod: polling + websocket (better for firewalls/proxies initially)
        // In Local: websocket only (faster dev)
        this.socket = io(SOCKET_URL, {
            transports: IS_PRODUCTION ? ['polling', 'websocket'] : ['websocket'],
            autoConnect: true,
            reconnection: true,
            reconnectionAttempts: 10,
            reconnectionDelay: 1000,
            // Hostinger often uses Nginx reverse proxy, path might need adjustment if default doesn't work,
            // but default '/socket.io/' usually works fine with standard NestJS setup.
        });

        this.socket.on('connect', () => {
            console.log(`[Socket] Connected to Real Backend (${IS_PRODUCTION ? 'PROD' : 'DEV'})`);
            super.emit('connect');
        });

        this.socket.on('connect_error', (err) => {
            console.warn('[Socket] Connection Error:', err.message);
        });

        this.socket.on('disconnect', () => {
            console.log('[Socket] Disconnected');
            super.emit('disconnect');
        });

        // Proxy all incoming events from Server to Local Emitter
        this.socket.onAny((event, ...args) => {
            super.emit(event, ...args);
        });
    }

    public on(event: string, listener: (...args: any[]) => void): this {
      super.on(event, listener);
      return this;
    }
  
    public off(event: string, listener: (...args: any[]) => void): this {
      super.removeListener(event, listener);
      return this;
    }
  
    public removeAllListeners(event?: string): this {
      super.removeAllListeners(event);
      return this;
    }

    public emit(event: string, ...args: any[]): boolean {
        this.socket.emit(event, ...args);
        return true;
    }

    public disconnect() {
        this.socket.disconnect();
    }
}

// FACTORY: Choose based on Environment
// If IS_PRODUCTION is true (Auto-detected), we ALWAYS use the Real Socket.
// If Local, we default to Mock for UI testing, UNLESS we explicitly want to connect to local backend (you can toggle this logic).
export const socket: ISocketService = IS_PRODUCTION ? new RealSocketService() : new MockSocketService();
