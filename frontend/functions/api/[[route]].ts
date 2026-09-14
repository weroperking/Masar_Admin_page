import { handle } from 'hono/cloudflare-pages';
import app from '../../../backend/src/index';

const handler = handle(app);

// Export all Cloudflare Pages Functions method handlers
export const onRequest = handler;
export const onRequestGet = handler;
export const onRequestPost = handler;
export const onRequestPut = handler;
export const onRequestDelete = handler;
export const onRequestPatch = handler;
export const onRequestOptions = handler;
export const onRequestHead = handler;
