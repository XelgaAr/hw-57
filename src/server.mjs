import { createServer } from 'node:http';
import { handleRequest } from './app.mjs';

const port = Number(process.env.PORT ?? 3000);
if (!Number.isInteger(port) || port < 0 || port > 65535)
  throw new RangeError('PORT must be an integer from 0 to 65535');
const server = createServer({ requestTimeout: 15000, headersTimeout: 10000 }, handleRequest);
await new Promise((resolve, reject) => server.once('error', reject).listen(port, process.env.HOST, resolve));
console.log(`HTTP server: http://localhost:${server.address().port}`);
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.once(signal, () => {
    server.close();
    setTimeout(() => server.closeAllConnections(), 5000).unref();
  });
}
export { server };
