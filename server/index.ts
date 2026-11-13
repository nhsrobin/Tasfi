import express, { type NextFunction, type Request, type Response } from 'express';
import http from 'http';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import cors from 'cors';
import { apiRouter } from './routes.ts';
import { setupLiveWebSocket } from './websocket.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Root directory is one level up from server/
const rootDir = path.resolve(__dirname, '..');

function resolveServerPort(): number {
  const args = process.argv.slice(2);
  const portIndex = args.indexOf('--port');
  const cliPort = (portIndex !== -1 && args[portIndex + 1]) ? parseInt(args[portIndex + 1], 10) : NaN;
  if (!Number.isNaN(cliPort) && cliPort > 0) return cliPort;

  const npmPort = process.env.npm_config_port ? parseInt(process.env.npm_config_port, 10) : NaN;
  if (!Number.isNaN(npmPort) && npmPort > 0) return npmPort;

  // In production (e.g., Render / Cloud Run), honor process.env.PORT.
  // In local/dev preview containers where PORT=8080 may belong to an upstream proxy, default to 3000.
  if (process.env.NODE_ENV === 'production' && process.env.PORT) {
    const envPort = parseInt(process.env.PORT, 10);
    if (!Number.isNaN(envPort) && envPort > 0) return envPort;
  }

  return 3000;
}

export async function createTasfiServer() {
  const app = express();
  const port = resolveServerPort();

  // Universal CORS Configuration:
  // Allows requests from Vercel (https://*.vercel.app), Render, Capacitor mobile apps
  // (capacitor://localhost, http://localhost), and custom domains without blocks.
  app.use(cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      return callback(null, true);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
  }));

  // JSON Body Parser with 10MB limit for image attachments or audio inputs
  app.use(express.json({ limit: '10mb' }));

  // Register All Modular API Routes under /api
  app.use('/api', apiRouter);

  // Optional Headless Mode: If process.env.API_ONLY === 'true', skip serving frontend
  const isApiOnly = process.env.API_ONLY === 'true';

  if (!isApiOnly) {
    if (process.env.NODE_ENV !== 'production') {
      // Initialize Vite asynchronously so HTTP port binding is never delayed on cold starts
      let viteMiddlewares: ((req: Request, res: Response, next: NextFunction) => void) | null = null;
      const viteReadyPromise = (async () => {
        try {
          const { createServer } = await import('vite');
          const vite = await createServer({
            root: rootDir,
            server: { middlewareMode: true, hmr: process.env.DISABLE_HMR !== 'true' },
            appType: 'spa',
          });
          viteMiddlewares = vite.middlewares;
        } catch (viteErr) {
          console.warn('[Vite Middleware Notice]:', viteErr);
        }
      })();

      app.use(async (req: Request, res: Response, next: NextFunction) => {
        if (!viteMiddlewares) {
          await viteReadyPromise;
        }
        if (viteMiddlewares) {
          return viteMiddlewares(req, res, next);
        }
        next();
      });
    } else {
      const distPath = path.resolve(rootDir, 'dist');
      if (fs.existsSync(distPath)) {
        app.use(express.static(distPath));
        app.use((_req, res) => {
          res.sendFile(path.resolve(distPath, 'index.html'));
        });
      }
    }
  }

  // Create HTTP server to attach both Express and Live WebSocket server
  const httpServer = http.createServer(app);
  httpServer.on('error', (err) => {
    console.error('[Tasfi HTTP Server Error]:', err);
  });
  setupLiveWebSocket(httpServer);

  return { app, httpServer, port };
}

// Start Server automatically if executed as the main entry point
async function run() {
  const { httpServer, port } = await createTasfiServer();
  httpServer.listen(port, '0.0.0.0', () => {
    console.log(`[Tasfi Universal Backend] Running on http://0.0.0.0:${port} (mode: ${process.env.NODE_ENV || 'development'})`);
  });
}

run().catch((err) => {
  console.error('[Tasfi Server Failed to Start]:', err);
  process.exit(1);
});
