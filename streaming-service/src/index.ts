import { WebSocketServer } from 'ws';

const wss = new WebSocketServer({ port: 8080 });

wss.on('connection', function connection(ws) {
  console.log('Client connected');

  ws.on('message', function message(data) {
    console.log('received: %s', data);
  });

  ws.on('close', () => {
    console.log('Client disconnected');
  });

  // Send a message every second
  const interval = setInterval(() => {
    ws.send(JSON.stringify({ message: 'This is a message from the server' }));
  }, 1000);

  ws.on('close', () => {
    clearInterval(interval);
  });
});

console.log('WebSocket server started on port 8080');
