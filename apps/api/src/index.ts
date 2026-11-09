import { createServer } from 'node:http';
import { app } from './app.js';
import { config } from './config.js';
import { pool } from './db.js';
import { websocketService } from './services/websocket.js';

const httpServer = createServer(app);
websocketService.init(httpServer);

const server = httpServer.listen(config.port, () => {
  console.log(`MonsoonMesh API listening on port ${config.port}`);
  console.log(`WebSocket server initialized`);
});

async function shutdown(signal: string): Promise<void> {
  console.log(`${signal} received; shutting down`);
  server.close(async () => {
    await pool.end();
    process.exit(0);
  });
}
process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
