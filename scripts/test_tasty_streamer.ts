import { runForever } from '../backend/src/tastytrade/dxlinkStreamer';

async function main() {
    await runForever();
}

main().catch((err) => {
    console.error('Fatal DXLink error in runForever:', err);
    process.exit(1);
});
