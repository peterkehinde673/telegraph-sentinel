import { WebSocketServer, WebSocket } from 'ws';
import http from 'http';

export class SentinelWebSocketServer {
  private wss: WebSocketServer | null = null;

  public init(server: http.Server) {
    this.wss = new WebSocketServer({ server });

    this.wss.on('connection', (ws: WebSocket) => {
      ws.send(JSON.stringify({ type: 'SYSTEM', message: 'Sentinel WebSocket Connected' }));

      ws.on('message', (msg: string) => {
        try {
          const parsed = JSON.parse(msg.toString());
          if (parsed.type === 'PING') {
            ws.send(JSON.stringify({ type: 'PONG', timestamp: new Date().toISOString() }));
          }
        } catch {
          ws.send(JSON.stringify({ type: 'ERROR', message: 'Invalid payload' }));
        }
      });
    });
  }

  public broadcast(event: string, payload: any) {
    if (!this.wss) return;
    const message = JSON.stringify({ type: event, data: payload, timestamp: new Date().toISOString() });
    for (const client of this.wss.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    }
  }
}

export const wsServer = new SentinelWebSocketServer();
