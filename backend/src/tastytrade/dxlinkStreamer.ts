import WebSocket from 'ws';
import { getOrRefreshApiQuoteToken } from './apiQuoteToken';

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

    public async connect() {
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
                    this.handleFeedData(message.data);
                    this.state = StreamerState.STREAMING;
                }
                break;
            case StreamerState.STREAMING:
                if (message.type === 'FEED_DATA') {
                    this.handleFeedData(message.data);
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
                Quote: ['eventSymbol', 'bidPrice', 'askPrice'],
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

    private handleFeedData(data: any[]) {
        const [eventType, eventData] = data;
        if (eventType === 'Quote') {
            const [eventSymbol, bidPrice, askPrice] = eventData;
            console.log(`[DXLINK] Quote: ${eventSymbol} bid=${bidPrice}, ask=${askPrice}`);
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