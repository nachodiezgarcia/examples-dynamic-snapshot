import { getRequestListener } from '@hono/node-server';
import app from '../src/app.js';

// Vercel llama al export por defecto como handler de Node (req, res); getRequestListener adapta app.fetch.
export default getRequestListener(app.fetch);
