import { Server as HTTPServer } from 'node:http';
import { Server, Socket } from 'socket.io';
import { config } from '../config.js';
import { logger } from '../logger.js';

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

class WebSocketService {
  private io: Server | null = null;
  private connectedUsers: Map<string, Set<string>> = new Map(); // userId -> socket IDs

  init(httpServer: HTTPServer): Server {
    this.io = new Server(httpServer, {
      cors: {
        origin: config.webOrigin,
        credentials: true,
      },
      transports: ['websocket', 'polling'],
      pingInterval: 25_000,
      pingTimeout: 10_000,
    });

    this.io.on('connection', (socket: Socket) => {
      logger.info('WebSocket client connected', { socketId: socket.id });

      // Handle user joining (after authentication)
      socket.on('join', (userId: string) => {
        this.handleUserJoin(socket, userId);
      });

      // Handle incident updates subscription
      socket.on('subscribe:incidents', () => {
        socket.join('incidents');
        logger.debug('Client subscribed to incidents', { socketId: socket.id });
      });

      // Handle risk map subscription
      socket.on('subscribe:risk-map', () => {
        socket.join('risk-map');
        logger.debug('Client subscribed to risk-map', { socketId: socket.id });
      });

      // Handle reconnection
      socket.on('reconnect', () => {
        logger.info('WebSocket client reconnected', { socketId: socket.id });
      });

      socket.on('disconnect', (reason: string) => {
        logger.info('WebSocket client disconnected', { socketId: socket.id, reason });
        this.handleUserDisconnect(socket);
      });

      socket.on('error', (error: unknown) => {
        logger.error('WebSocket error', {
          socketId: socket.id,
          error: error instanceof Error ? error.message : String(error),
        });
      });
    });

    logger.info('WebSocket server initialized');
    return this.io;
  }

  private handleUserJoin(socket: Socket, userId: string): void {
    socket.join(`user:${userId}`);

    if (!this.connectedUsers.has(userId)) {
      this.connectedUsers.set(userId, new Set());
    }
    this.connectedUsers.get(userId)!.add(socket.id);

    logger.debug('User joined WebSocket room', { userId, socketId: socket.id });
  }

  private handleUserDisconnect(socket: Socket): void {
    // Find and remove user association
    for (const [userId, socketIds] of this.connectedUsers.entries()) {
      if (socketIds.has(socket.id)) {
        socketIds.delete(socket.id);
        if (socketIds.size === 0) {
          this.connectedUsers.delete(userId);
        }
        logger.debug('User disconnected from WebSocket', { userId, socketId: socket.id });
      }
    }
  }

  /**
   * Broadcast incident status update to all connected clients
   */
  broadcastIncidentUpdate(update: IncidentUpdate): void {
    if (!this.io) {
      logger.warn('WebSocket server not initialized');
      return;
    }

    this.io.to('incidents').emit('incident:updated', update);
    logger.debug('Broadcast incident update', { incidentId: update.id, status: update.status });
  }

  /**
   * Send notification to specific user
   */
  notifyUser(userId: string, event: string, data: unknown): void {
    if (!this.io) {
      logger.warn('WebSocket server not initialized');
      return;
    }

    this.io.to(`user:${userId}`).emit(event, data);
    logger.debug('Notify user', { userId, event });
  }

  /**
   * Broadcast risk map updates
   */
  broadcastRiskUpdate(update: RiskUpdate): void {
    if (!this.io) {
      logger.warn('WebSocket server not initialized');
      return;
    }

    this.io.to('risk-map').emit('risk:updated', update);
    logger.debug('Broadcast risk update', { zoneId: update.zoneId, riskScore: update.riskScore });
  }

  /**
   * Get number of connected users
   */
  getConnectedUsersCount(): number {
    return this.connectedUsers.size;
  }

  /**
   * Get number of active connections
   */
  getConnectionCount(): number {
    return this.io?.engine.clientsCount ?? 0;
  }
}

export const websocketService = new WebSocketService();
