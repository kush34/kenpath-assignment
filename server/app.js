import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'node:url';
import { errorHandler } from './middlewares/errorHandler.js';
import authRouter from './routers/authRouter.js';
import readingRouter from './routers/readingRouter.js';
import reportRouter from './routers/reportRouter.js';
import doctorRouter from './routers/doctorRouter.js';

const app = express();

app.use(cors({ origin: process.env.CLIENT_ORIGIN?.split(',').map(value => value.trim()) || 'http://localhost:5173' }));
app.use(express.json({ limit: '32kb' }));

app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));
app.use('/api/auth', authRouter);
app.use('/api/readings', readingRouter);
app.use('/api/reports', reportRouter);
app.use('/api/doctor', doctorRouter);

app.use(express.static(fileURLToPath(new URL('../client/dist/', import.meta.url))));
app.use(errorHandler);

export default app;
