import express from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import passport from '../passport/google';
import { registerUser, loginUser, generateToken } from '../services/auth.service';

import { requireAuth, AuthedRequest } from '../middleware/auth.middleware';
const router = express.Router();

const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20 });

const registerSchema = z.object({ email: z.string().email(), password: z.string().min(6), name: z.string().optional() });
const loginSchema = z.object({ email: z.string().email(), password: z.string().min(6) });

router.post('/register', authLimiter, async (req, res, next) => {
  try {
    const parsed = registerSchema.parse(req.body);
    const result = await registerUser(parsed.email, parsed.password, parsed.name);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.post('/login', authLimiter, async (req, res, next) => {
  try {
    const parsed = loginSchema.parse(req.body);
    const result = await loginUser(parsed.email, parsed.password);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// Google OAuth
router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

router.get(
  '/google/callback',
  passport.authenticate('google', { session: false, failureRedirect: '/auth/google/failure' }),
  (req, res) => {
    // @ts-ignore
    const user = req.user as any;
    const token = generateToken(user);
    const frontend = process.env.FRONTEND_URL || 'http://localhost:3000';
    // Redirect with token as query param (in production use a safe flow)
    res.redirect(`${frontend}/auth/success?token=${token}`);
  }
);

router.get('/google/failure', (req, res) => {
  res.status(401).json({ error: 'Google authentication failed' });
});

router.get('/me', requireAuth, async (req: AuthedRequest, res) => {
  const prisma = (await import('@prisma/client')).PrismaClient ? new (await import('@prisma/client')).PrismaClient() : null;
  if (!req.userId) return res.status(401).json({ error: 'Not authenticated' });
  const user = await prisma?.user.findUnique({ where: { id: req.userId } });
  res.json({ user });
});

export default router;
