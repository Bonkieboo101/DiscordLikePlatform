import express from 'express';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';
import passport from 'passport';
import helmet from 'helmet';
import logger from './logger';

import authRoutes from './routes/auth.routes';
import workspaceRoutes from './routes/workspace.routes';
import channelRoutes from './routes/channel.routes';
import './passport/google';
import dmRoutes from './routes/dm.routes';
import uploadRoutes from './routes/upload.routes';
import { ensureUploadDir } from './services/upload.service';
import path from 'path';
import { errorHandler } from './middleware/error.middleware';

dotenv.config();

const app = express();
if (process.env.NODE_ENV === 'production') {
  app.use(helmet());
}
app.use(cors({ origin: process.env.FRONTEND_URL || '*' }));
app.use(express.json());

// simple request logging in dev
if (process.env.NODE_ENV !== 'production') {
  app.use((req, res, next) => { logger.debug(`${req.method} ${req.url}`); next(); });
}

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// global rate limiter (light)
const globalLimiter = rateLimit({ windowMs: 60 * 1000, max: 200 });
app.use(globalLimiter);

// init passport
app.use(passport.initialize());

const authLimiter = rateLimit({ windowMs: 60 * 1000, max: 10 });
app.use('/auth', authLimiter, authRoutes);
app.use('/api/workspaces', workspaceRoutes);
app.use('/api', channelRoutes);
app.use('/api', require('./routes/message.routes').default);
app.use('/api', dmRoutes);
app.use('/api', uploadRoutes);
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));
// ensure uploads dir exists
ensureUploadDir();
app.use('/api', require('./routes/user.routes').default);
app.use('/api', require('./routes/unread.routes').default);

// Serve frontend in production
if (process.env.NODE_ENV === 'production') {
  const frontendPath = path.join(__dirname, '..', '..', 'frontend', 'dist');
  app.use(express.static(frontendPath));
  app.get('*', (req, res) => {
    res.sendFile(path.join(frontendPath, 'index.html'));
  });
}

// error handler
app.use(errorHandler);

const port = Number(process.env.PORT || 4000);
const server = http.createServer(app);
const io = new SocketIOServer(server, { cors: { origin: '*' } });

import { initSocket } from './socket';

initSocket(io);

server.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`);
});
