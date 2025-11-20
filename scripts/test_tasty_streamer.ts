import { TastyStreamer } from '../backend/src/tastytrade/dxlinkStreamer';

async function main() {
    const streamer = new TastyStreamer();
    await streamer.connect();

    // Keep the script running for a while to receive some events
    setTimeout(() => {
        console.log('Disconnecting streamer...');
        streamer.disconnect();
    }, 60000); // Run for 60 seconds
}

main().catch(console.error);
