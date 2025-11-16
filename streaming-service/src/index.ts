import WebSocket, { RawData } from 'ws';
import http from 'http';
import fetch from 'node-fetch';

const TASTYTRADE_API_BASE = 'https://api.tastyworks.com'; // Hardcoded for now
const ACCESS_TOKEN = 'YOUR_ACCESS_TOKEN'; // Hardcoded placeholder

const wssClients = new Map<string, { ws: WebSocket, symbol: string }>();
let upstreamWS: WebSocket | null = null;

interface DxLinkTokenResponse {
  data: {
    'dxlink-url': string;
    token: string;
  }
}

async function getDxLinkUrlAndToken() {
  const response = await fetch(`${TASTYTRADE_API_BASE}/api-quote-tokens`, {
    headers: {
      'Authorization': `Bearer ${ACCESS_TOKEN}`
    }
  });
  const data = await response.json() as DxLinkTokenResponse;
  return {
    dxlinkUrl: data.data['dxlink-url'],
    token: data.data.token
  };
}

async function connectUpstream() {
  try {
    const { dxlinkUrl, token } = await getDxLinkUrlAndToken();
    upstreamWS = new WebSocket(dxlinkUrl);

    upstreamWS.on('open', () => {
      console.log('[Upstream] connected');
      // Authenticate with DXLink
      const authMsg = { type: 'AUTH', channel: 0, token: token };
      if (upstreamWS) {
        upstreamWS.send(JSON.stringify(authMsg));
      }
    });

    upstreamWS.on('message', (msg: RawData) => handleUpstreamMessage(JSON.parse(msg.toString())));
    upstreamWS.on('close', () => {
      console.log('[Upstream] disconnected — reconnecting');
      setTimeout(connectUpstream, 3000);
    });
  } catch (error) {
    console.error('Error connecting to upstream:', error);
    setTimeout(connectUpstream, 3000);
  }
}
connectUpstream();

interface UpstreamMessage {
  symbol: string;
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

function handleUpstreamMessage(msg: UpstreamMessage) {
  // Example: msg = { symbol: 'SPY', time: 1699999999999, open: ..., high: ..., low: ..., close: ..., volume: ... }
  const symbol = msg.symbol;
  for (const [uid, clientObj] of wssClients.entries()) {
    if (clientObj.symbol === symbol) {
      clientObj.ws.send(JSON.stringify(msg));
    }
  }
}

const server = http.createServer();
const wss = new WebSocket.Server({ server });

wss.on('connection', (ws, req) => {
  ws.on('message', (data: RawData) => {
    const obj = JSON.parse(data.toString());
    if (obj.action === 'subscribe' && obj.symbol) {
      wssClients.set(obj.uid, { ws, symbol: obj.symbol });
      // send subscribe request upstream
      if (upstreamWS) {
        // This needs to follow the DXLink protocol
        const feedSetup = { type: 'FEED_SETUP', channel: 3, acceptDataFormat: 'COMPACT' };
        const feedSubscription = { type: 'FEED_SUBSCRIPTION', channel: 3, add: [{ type: 'Quote', symbol: obj.symbol }] };
        upstreamWS.send(JSON.stringify(feedSetup));
        upstreamWS.send(JSON.stringify(feedSubscription));
      }
      console.log(`[Streamer] subscribed ${obj.uid} → ${obj.symbol}`);
    }
    if (obj.action === 'unsubscribe' && obj.uid) {
      const client = wssClients.get(obj.uid);
      if (client) {
        if (upstreamWS) {
          const feedUnsubscription = { type: 'FEED_SUBSCRIPTION', channel: 3, remove: [{ type: 'Quote', symbol: client.symbol }] };
          upstreamWS.send(JSON.stringify(feedUnsubscription));
        }
        wssClients.delete(obj.uid);
        console.log(`[Streamer] unsubscribed ${obj.uid}`);
      }
    }
  });
});

server.listen(8080, () => console.log('Streamer listening on 8080'));
