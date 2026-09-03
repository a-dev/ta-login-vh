import type { Server } from 'node:http';
import type { Express } from 'express';

export function startServer(app: Express, port: number): Promise<Server> {
  return new Promise((resolve, reject) => {
    const server = app.listen(port);

    server.once('error', reject);
    server.once('listening', () => {
      server.removeListener('error', reject);
      resolve(server);
    });
  });
}

// Gracefully closes the server, allowing in-flight requests to complete
export function closeServer(server: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((error) => (error === undefined ? resolve() : reject(error)));
    server.closeIdleConnections();
  });
}

// Forcefully closes all connections,  mid-request including
export function forceCloseConnections(server: Server): void {
  server.closeAllConnections();
}
