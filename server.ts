/**
 * Tasfi AI - Universal Server Entry Point
 * The backend server logic is fully modularized inside the /server directory.
 * This entry file delegates execution to /server/index.js for compatibility with
 * Node, Docker, Cloud Run, Render, and Vercel/Capacitor setups.
 */

import './server/index.ts';

export * from './server/keyPool.ts';
export * from './server/prompts.ts';
export * from './server/chatService.ts';
export * from './server/voiceService.ts';
export * from './server/memoryService.ts';
export * from './server/websocket.ts';
export * from './server/routes.ts';
export * from './server/index.ts';
