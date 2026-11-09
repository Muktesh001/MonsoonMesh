import { useEffect, useRef, useCallback } from 'react';
import { io, type Socket } from 'socket.io-client';

export interface UseWebSocketOptions {
  url?: string;
  autoConnect?: boolean;
  reconnection?: boolean;
  reconnectionDelay?: number;
  reconnectionDelayMax?: number;
  reconnectionAttempts?: number;
}

export interface IncidentUpdate {
  id: string;
  status: string;
  title: string;
  severity: string;
  category: string;
  updatedAt: string;
  change?: {
    field: string;
    oldValue: unknown;
    newValue: unknown;
  };
}

export interface RiskUpdate {
  zoneId: string;
  riskScore: number;
  severity: string;
  timestamp: string;
}

/**
 * Hook to manage WebSocket connection and subscriptions
 */
export function useWebSocket(options: UseWebSocketOptions = {}) {
  const socketRef = useRef<Socket | null>(null);
  const isConnectedRef = useRef(false);

  const {
    url = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:4000',
    autoConnect = true,
    reconnection = true,
    reconnectionDelay = 1000,
    reconnectionDelayMax = 5000,
    reconnectionAttempts = 10,
  } = options;

  // Initialize socket connection
  useEffect(() => {
    if (!autoConnect || socketRef.current) return;

    socketRef.current = io(url, {
      transports: ['websocket', 'polling'],
      reconnection,
      reconnectionDelay,
      reconnectionDelayMax,
      reconnectionAttempts,
    });

    socketRef.current.on('connect', () => {
      console.log('WebSocket connected');
      isConnectedRef.current = true;
    });

    socketRef.current.on('disconnect', (reason: string) => {
      console.log('WebSocket disconnected:', reason);
      isConnectedRef.current = false;
    });

    socketRef.current.on('error', (error: unknown) => {
      console.error('WebSocket error:', error);
    });

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
        isConnectedRef.current = false;
      }
    };
  }, [url, autoConnect, reconnection, reconnectionDelay, reconnectionDelayMax, reconnectionAttempts]);

  /**
   * Subscribe to incident updates
   */
  const subscribeToIncidents = useCallback((callback: (update: IncidentUpdate) => void) => {
    if (!socketRef.current) return () => {};

    socketRef.current.emit('subscribe:incidents');
    socketRef.current.on('incident:updated', callback);

    return () => {
      if (socketRef.current) {
        socketRef.current.off('incident:updated', callback);
      }
    };
  }, []);

  /**
   * Subscribe to risk map updates
   */
  const subscribeToRiskMap = useCallback((callback: (update: RiskUpdate) => void) => {
    if (!socketRef.current) return () => {};

    socketRef.current.emit('subscribe:risk-map');
    socketRef.current.on('risk:updated', callback);

    return () => {
      if (socketRef.current) {
        socketRef.current.off('risk:updated', callback);
      }
    };
  }, []);

  /**
   * Join a user-specific room
   */
  const joinUser = useCallback((userId: string) => {
    if (!socketRef.current) return;
    socketRef.current.emit('join', userId);
  }, []);

  /**
   * Subscribe to user notifications
   */
  const subscribeToNotifications = useCallback((callback: (event: string, data: unknown) => void) => {
    if (!socketRef.current) return () => {};

    const handleNotification = (event: string, data: unknown) => {
      callback(event, data);
    };

    socketRef.current.onAny(handleNotification);

    return () => {
      if (socketRef.current) {
        socketRef.current.offAny(handleNotification);
      }
    };
  }, []);

  /**
   * Get connection status
   */
  const isConnected = useCallback(() => isConnectedRef.current, []);

  /**
   * Manually connect
   */
  const connect = useCallback(() => {
    if (socketRef.current && !socketRef.current.connected) {
      socketRef.current.connect();
    }
  }, []);

  /**
   * Manually disconnect
   */
  const disconnect = useCallback(() => {
    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.disconnect();
    }
  }, []);

  return {
    socket: socketRef.current,
    isConnected,
    subscribeToIncidents,
    subscribeToRiskMap,
    joinUser,
    subscribeToNotifications,
    connect,
    disconnect,
  };
}
