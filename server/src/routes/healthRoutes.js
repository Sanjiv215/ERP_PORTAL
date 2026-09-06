import { Router } from 'express';
import { pool } from '../db/pool.js';

export const healthRouter = Router();

healthRouter.get('/health', async (_req, res) => {
  try {
    const startTime = Date.now();
    await pool.query('SELECT 1');
    const latencyMs = Date.now() - startTime;

    res.status(200).json({
      status: 'ok',
      service: 'contractoros-api',
      database: 'connected',
      dbLatencyMs: latencyMs,
      uptime: Math.floor(process.uptime()),
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(503).json({
      status: 'degraded',
      service: 'contractoros-api',
      database: 'disconnected',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});
