import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import { requestIdMiddleware } from './middleware/requestId.js';
import { authRouter } from './routes/auth.js';
import { materiauxRouter } from './routes/materiaux.js';
import { produitsRouter } from './routes/produits.js';
import { clientsRouter } from './routes/clients.js';
import { operateursRouter } from './routes/operateurs.js';
import { machinesRouter } from './routes/machines.js';
import { operationTypesRouter } from './routes/operationTypes.js';
import { ofRouter } from './routes/of.js';
import { dashboardRouter } from './routes/dashboard.js';
import { blRouter } from './routes/bl.js';
import { qualiteRouter } from './routes/qualite.js';
import { daRouter } from './routes/da.js';
import { bcRouter } from './routes/bc.js';
import { brRouter } from './routes/br.js';
import { faRouter, maintRouter, reportsRouter, activityRouter } from './routes/purchasing.js';
import { analyticsRouter, planningRouter, fournisseursRouter } from './routes/analytics.js';
import { settingsRouter } from './routes/settings.js';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 8000;

// ─── Middleware ─────────────────────────────────────────────────

app.use(helmet());
app.use(requestIdMiddleware);
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
  exposedHeaders: ['X-Request-ID', 'X-RateLimit-Limit', 'X-RateLimit-Remaining', 'Retry-After'],
}));
app.use(express.json());
app.use(cookieParser());

// Security headers
app.use((_req: Request, res: Response, next: NextFunction) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000');
  }
  next();
});

// ─── Public Endpoints ───────────────────────────────────────────

app.get('/', (_req: Request, res: Response) => {
  res.status(200).json({
    name: 'SOFEM MES API',
    version: '6.0.0',
  });
});

app.get('/api/health', (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: '6.0.0',
    environment: process.env.NODE_ENV || 'development',
  });
});

// ─── Routes ─────────────────────────────────────────────────────

app.use('/api/auth', authRouter);
app.use('/api/materiaux', materiauxRouter);
app.use('/api/produits', produitsRouter);
app.use('/api/clients', clientsRouter);
app.use('/api/operateurs', operateursRouter);
app.use('/api/machines', machinesRouter);
app.use('/api/operation-types', operationTypesRouter);
app.use('/api/of', ofRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/bl', blRouter);
app.use('/api/qualite', qualiteRouter);
app.use('/api/achats/da', daRouter);
app.use('/api/achats/bc', bcRouter);
app.use('/api/achats/br', brRouter);
app.use('/api/achats/fa', faRouter);
app.use('/api/maintenance', maintRouter);
app.use('/api/rapports', reportsRouter);
app.use('/api/notifications', activityRouter);
app.use('/api/analytics', analyticsRouter);
app.use('/api/planning', planningRouter);
app.use('/api/fournisseurs', fournisseursRouter);
app.use('/api/settings', settingsRouter);

// ─── Error Handling ─────────────────────────────────────────────

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong',
    },
  });
});

app.use((_req: Request, res: Response) => {
  res.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: 'Endpoint not found',
    },
  });
});

// ─── Start Server ───────────────────────────────────────────────

if (process.env.NODE_ENV !== 'test' && !process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`🚀 SOFEM MES Backend running on http://localhost:${PORT}`);
    console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🔗 Health: http://localhost:${PORT}/api/health`);
    console.log(`🔐 Auth:    http://localhost:${PORT}/api/auth/login`);
  });
}

export default app;
