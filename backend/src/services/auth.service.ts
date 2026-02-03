import { PrismaClient, User } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();

const JWT_SECRET = process.env.JWT_SECRET || 'changeme';

export type PublicUser = Omit<User, 'password'>;

export async function registerUser(email: string, password: string, name?: string) {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw new Error('Email already in use');
  const hashed = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({ data: { email, password: hashed, name } });
  const token = generateToken(user);
  return { user: sanitizeUser(user), token };
}

export async function loginUser(email: string, password: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.password) throw new Error('Invalid credentials');
  const ok = await bcrypt.compare(password, user.password);
  if (!ok) throw new Error('Invalid credentials');
  const token = generateToken(user);
  return { user: sanitizeUser(user), token };
}

export function generateToken(user: User) {
  return jwt.sign({ sub: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
}

export function verifyToken(token: string) {
  try {
    return jwt.verify(token, JWT_SECRET) as { sub: string; email: string; iat: number; exp: number };
  } catch (err) {
    return null;
  }
}

export function sanitizeUser(user: User): PublicUser {
  // remove password for public exposure
  const { password, ...rest } = user as any;
  return rest as PublicUser;
}

export async function findOrCreateGoogleUser(googleId: string, email?: string, name?: string, avatar?: string) {
  if (!googleId) throw new Error('Missing googleId');
  let user = await prisma.user.findUnique({ where: { googleId } });
  if (user) return user;
  if (email) {
    const byEmail = await prisma.user.findUnique({ where: { email } });
    if (byEmail) {
      user = await prisma.user.update({ where: { email }, data: { googleId } });
      return user;
    }
  }
  user = await prisma.user.create({ data: { googleId, email: email || `goog_${googleId}@example.com`, name, avatar } });
  return user;
}
