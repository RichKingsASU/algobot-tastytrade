import WebSocket from 'ws';
import { getOrRefreshApiQuoteToken } from './apiQuoteToken';
import { supabase } from '../db/supabaseClient';

enum StreamerState {
    DISCONNECTED,
    CONNECTING,
    SETUP_SENT,
    AUTH_SENT,
    CHANNEL_REQUESTED,
    FEED_CONFIGURED,
    STREAMING,
    ERROR,
}

export class TastyStreamer {
    private ws: WebSocket | null = null;
    private state: StreamerState = StreamerState.DISCONNECTED;
    private keepaliveTimer: NodeJS.Timeout | null = null;
    private dxToken: string | null = null;
    private resolveDone?: () => void;
    private donePromise: Promise<void>;

    constructor() {
        this.donePromise = new Promise<void>((resolve) => {
            this.resolveDone = resolve;
        });
    }

    public async start(): Promise<void> {
        if (this.state !== StreamerState.DISCONNECTED) {
            console.log('Streamer is already connected or connecting.');
            return;
        }

        this.state = StreamerState.CONNECTING;
        console.log('Getting or refreshing API quote token...');
        const { token, dxlinkUrl } = await getOrRefreshApiQuoteToken();
        this.dxToken = token;

        console.log(`Connecting to DXLink websocket: ${dxlinkUrl}...`);
        this.ws = new WebSocket(dxlinkUrl);

        this.ws.onopen = () => this.onOpen();
        this.ws.onmessage = (event) => this.onMessage(event);
        this.ws.onerror = (error) => this.onError(error);
        this.ws.onclose = () => this.onClose();

        await this.donePromise;
    }

    private onOpen() {
        console.log('DXLink websocket connected.');
        this.sendSetup();
        this.state = StreamerState.SETUP_SENT;
    }

    private onMessage(event: { data: WebSocket.Data }) {
        const message = JSON.parse(event.data.toString());
        console.log('Received message:', message);

        switch (this.state) {
            case StreamerState.SETUP_SENT:
                if (message.type === 'SETUP' && message.channel === 0) {
                    console.log('SETUP acknowledged.');
                    this.sendAuth();
                    this.state = StreamerState.AUTH_SENT;
                }
                break;
            case StreamerState.AUTH_SENT:
                if (message.type === 'AUTH_STATE' && message.state === 'AUTHORIZED') {
                    console.log('DXLink AUTHORIZED.');
                    this.sendChannelRequest();
                    this.state = StreamerState.CHANNEL_REQUESTED;
                }
                break;
            case StreamerState.CHANNEL_REQUESTED:
                if (message.type === 'CHANNEL_OPENED' && message.channel === 1) {
                    console.log('Channel 1 opened.');
                    this.sendFeedSetup();
                } else if (message.type === 'FEED_CONFIG' && message.channel === 1) {
                    console.log('Feed configured for channel 1.');
                    this.sendFeedSubscription();
                    this.state = StreamerState.FEED_CONFIGURED;
                }
                break;
            case StreamerState.FEED_CONFIGURED:
                if (message.type === 'FEED_DATA') {
                    this.handleFeedData(message).catch(err => console.error('handleFeedData error:', err));
                    this.state = StreamerState.STREAMING;
                }
                break;
            case StreamerState.STREAMING:
                if (message.type === 'FEED_DATA') {
                    this.handleFeedData(message).catch(err => console.error('handleFeedData error:', err));
                }
                break;
        }
    }

    private onError(error: WebSocket.ErrorEvent) {
        console.error('DXLink websocket error:', error.message);
        this.state = StreamerState.ERROR;
        this.disconnect();
    }

    private onClose() {
        console.log('DXLink websocket closed.');
        this.state = StreamerState.DISCONNECTED;
        this.stopKeepalive();
        this.resolveDone?.();
    }

    private send(message: any) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(message));
        }
    }

    private sendSetup() {
        console.log('Sending SETUP message...');
        this.send({
            type: 'SETUP',
            channel: 0,
            keepaliveTimeout: 60,
            acceptKeepaliveTimeout: 60,
            version: '0.1-js/1.0.0-beta.3',
        });
    }

    private sendAuth() {
        console.log('Sending AUTH message...');
        this.send({
            type: 'AUTH',
            channel: 0,
            token: this.dxToken,
        });
    }

    private sendChannelRequest() {
        console.log('Sending CHANNEL_REQUEST message...');
        this.send({
            type: 'CHANNEL_REQUEST',
            channel: 1,
            service: 'FEED',
            parameters: { contract: 'AUTO' },
        });
    }

    private sendFeedSetup() {
        console.log('Sending FEED_SETUP message...');
        this.send({
            type: 'FEED_SETUP',
            channel: 1,
            acceptAggregationPeriod: 1,
            acceptDataFormat: 'COMPACT',
            acceptEventFields: {
                Quote: ['eventSymbol', 'bidPrice', 'askPrice', 'bidSize', 'askSize', 'time'],
            },
        });
    }

    private sendFeedSubscription() {
        console.log('Sending FEED_SUBSCRIPTION message...');
        this.send({
            type: 'FEED_SUBSCRIPTION',
            channel: 1,
            reset: true,
            add: [{ type: 'Quote', symbol: 'AAPL' }, { type: 'Quote', symbol: 'TSLA' }],
        });
    }

    private async handleFeedData(msg: any) {
        const rows: any[] = [];
        const [eventType, payload] = msg.data;

        if (eventType !== 'Quote') return;

        const fieldsPerQuote = 6; // As defined in acceptEventFields
        for (let i = 0; i < payload.length; i += fieldsPerQuote) {
            const quoteData = payload.slice(i, i + fieldsPerQuote);
            const [
                symbol,
                bidPrice,
                askPrice,
                bidSize,
                askSize,
                ts
            ] = quoteData;

            rows.push({
                event_type: eventType,
                symbol,
                bid_price: bidPrice,
                ask_price: askPrice,
                bid_size: bidSize,
                ask_size: askSize,
                received_at: new Date(ts),
                raw_payload: msg
            });
        }

        if (rows.length === 0) return;

        const { error } = await supabase
            .from('tastytrade_quotes')
            .insert(rows);

        if (error) {
            console.error('Error inserting quotes into tastytrade_quotes:', error);
        }
    }

    private startKeepalive() {
        this.keepaliveTimer = setInterval(() => {
            this.send({ type: 'KEEPALIVE', channel: 0 });
        }, 30000);
    }

    private stopKeepalive() {
        if (this.keepaliveTimer) {
            clearInterval(this.keepaliveTimer);
            this.keepaliveTimer = null;
        }
    }

    public disconnect() {
        if (this.ws) {
            this.ws.close();
        }
    }
}

export async function runForever() {
    const maxBackoffMs = 60_000; // 60 seconds cap
    let backoffMs = 1_000;       // start at 1 second

    // eslint-disable-next-line no-constant-condition
    while (true) {
        const startTs = Date.now();
        try {
            console.log('[DXLINK] Starting streamer cycle...');
            const streamer = new TastyStreamer();
            await streamer.start();  // returns when socket closes
            console.log('[DXLINK] Streamer cycle ended normally.');
        } catch (err) {
            console.error('[DXLINK] Streamer error, will reconnect:', err);
        }

        const runtimeMs = Date.now() - startTs;

        // If it successfully ran for at least 5 minutes, reset backoff (avoid huge delay after long stable runs)
        if (runtimeMs > 5 * 60_000) {
            backoffMs = 1_000;
        }

        console.log(`[DXLINK] Sleeping for ${backoffMs}ms before reconnect...`);
        await new Promise((r) => setTimeout(r, backoffMs));

        // Exponential backoff with cap
        backoffMs = Math.min(backoffMs * 2, maxBackoffMs);
    }
}
