import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { rateLimit } from 'express-rate-limit';
import { env } from './config/env.js';
import { authRouter } from './routes/authRoutes.js';
import { healthRouter } from './routes/healthRoutes.js';
import { tenantRouter } from './routes/tenantRoutes.js';
import { userRouter } from './routes/userRoutes.js';
import { employeeRouter } from './routes/employeeRoutes.js';
import { projectRouter } from './routes/projectRoutes.js';
import { attendanceRouter } from './routes/attendanceRoutes.js';
import { payrollRouter } from './routes/payrollRoutes.js';
import { plRouter } from './routes/plRoutes.js';
import { billingRouter } from './routes/billingRoutes.js';
import { meetingRouter } from './routes/meetingRoutes.js';
import { sessionRouter } from './routes/sessionRoutes.js';
import { transactionRouter } from './routes/transactionRoutes.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { ensureSchemaExtensions } from './db/autoMigrate.js';

export function createApp() {
  ensureSchemaExtensions().catch((e) => console.warn('Schema extension notice:', e.message));
  const app = express();

  // Enable trust proxy for Render, Vercel, and reverse proxies
  app.set('trust proxy', 1);

  // E6-04: Security headers — hardened CSP, no-sniff, referrer policy, permissions policy
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          fontSrc: ["'self'", 'https://fonts.gstatic.com'],
          imgSrc: ["'self'", 'data:'],
          connectSrc: ["'self'"],
          frameSrc: ["'none'"],
          objectSrc: ["'none'"],
          upgradeInsecureRequests: env.NODE_ENV === 'production' ? [] : null
        }
      },
      hsts: {
        maxAge: 63072000, // 2 years — required for HSTS preload submission
        includeSubDomains: true,
        preload: true
      },
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
      xContentTypeOptions: true,
      permittedCrossDomainPolicies: { permittedPolicies: 'none' },
      crossOriginEmbedderPolicy: false // keep off; API is consumed cross-origin by the SPA
    })
  );

  // E6-04b: Permissions-Policy — disable powerful browser features not used by this API
  app.use((_req, res, next) => {
    res.setHeader(
      'Permissions-Policy',
      'camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()'
    );
    next();
  });
  const allowedOrigins = env.CLIENT_ORIGIN.split(',').map((o) => o.trim().replace(/\/+$/, '')).filter(Boolean);

  app.use(
    cors({
      origin: (origin, callback) => {
        // Allow requests with no origin (like mobile apps, curl, server-to-server, webhooks)
        if (!origin) return callback(null, true);

        if (allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
          return callback(null, true);
        }

        // Allow Vercel preview branch deployments if configured with vercel domain
        if (/^https:\/\/[a-zA-Z0-9_-]+\.vercel\.app$/.test(origin)) {
          return callback(null, true);
        }

        callback(new Error(`CORS policy does not allow access from origin: ${origin}`), false);
      },
      credentials: true
    })
  );
  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());

  // E6-02: General API rate limit (100 req/min per IP) — auth routes have their own stricter limit
  const apiLimiter = rateLimit({
    windowMs: 60 * 1000,
    limit: 100,
    standardHeaders: true,
    legacyHeaders: false,
    validate: { xForwardedForHeader: false },
    skip: (req) => req.path === '/health' // health endpoint not rate-limited
  });
  app.use('/api/v1', apiLimiter);

  app.use('/api/v1', healthRouter);
  app.use('/api/v1/auth', authRouter);
  app.use('/api/v1/users', userRouter);
  app.use('/api/v1/platform/tenants', tenantRouter);
  app.use('/api/v1/employees', employeeRouter);
  app.use('/api/v1/projects', projectRouter);
  app.use('/api/v1/attendance', attendanceRouter);
  app.use('/api/v1/payroll', payrollRouter);
  app.use('/api/v1/pl', plRouter);
  app.use('/api/v1/billing', billingRouter);
  app.use('/api/v1/meetings', meetingRouter);
  app.use('/api/v1/sessions', sessionRouter);
  app.use('/api/v1/transactions', transactionRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
