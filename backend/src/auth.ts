import { createHmac, randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import type { NextFunction, Request, Response } from 'express';
import { Role, type User } from '@prisma/client';
import { prisma } from './db.js';
import { AppError } from './errors.js';

const scrypt = promisify(scryptCallback);
const tokenLifetimeSeconds = 60 * 60 * 8;
type TokenPayload = { sub: string; exp: number; sv: number };

declare global { namespace Express { interface Request { authUser?: User } } }

function secret() {
  const value = process.env.AUTH_SECRET;
  if (!value || value.length < 24) throw new Error('AUTH_SECRET must be configured with at least 24 characters');
  return value;
}
const encode = (value: string) => Buffer.from(value).toString('base64url');
const decode = (value: string) => Buffer.from(value, 'base64url').toString('utf8');

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex');
  const hash = await scrypt(password, salt, 64) as Buffer;
  return `${salt}:${hash.toString('hex')}`;
}
export async function verifyPassword(password: string, stored: string) {
  const [salt, hash] = stored.split(':');
  if (!salt || !hash) return false;
  const derived = await scrypt(password, salt, 64) as Buffer;
  const expected = Buffer.from(hash, 'hex');
  return expected.length === derived.length && timingSafeEqual(expected, derived);
}
export function signToken(user: Pick<User, 'id' | 'sessionVersion'>) {
  const payload: TokenPayload = { sub: user.id, sv: user.sessionVersion, exp: Math.floor(Date.now() / 1000) + tokenLifetimeSeconds };
  const body = encode(JSON.stringify(payload));
  const signature = createHmac('sha256', secret()).update(body).digest('base64url');
  return `${body}.${signature}`;
}
function verifyToken(token: string): TokenPayload | null {
  const [body, signature] = token.split('.');
  if (!body || !signature) return null;
  const expected = createHmac('sha256', secret()).update(body).digest('base64url');
  const received = Buffer.from(signature); const expectedBuffer = Buffer.from(expected);
  if (received.length !== expectedBuffer.length || !timingSafeEqual(received, expectedBuffer)) return null;
  try { const payload = JSON.parse(decode(body)) as TokenPayload; return payload.exp > Math.floor(Date.now() / 1000) && payload.sub ? payload : null; } catch { return null; }
}
export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.header('authorization');
  const token = header?.startsWith('Bearer ') ? header.slice(7) : undefined;
  const payload = token ? verifyToken(token) : null;
  if (!payload) return next(new AppError(401, 'AUTHENTICATION_REQUIRED', 'Authentication is required'));
  const user = await prisma.user.findUnique({ where: { id: payload.sub } });
  if (!user || user.sessionVersion !== payload.sv) return next(new AppError(401, 'INVALID_TOKEN', 'Authentication is invalid or expired'));
  req.authUser = user; return next();
}
export const allowRoles = (...roles: Role[]) => (req: Request, _res: Response, next: NextFunction) => !req.authUser ? next(new AppError(401, 'AUTHENTICATION_REQUIRED', 'Authentication is required')) : roles.includes(req.authUser.role) ? next() : next(new AppError(403, 'PERMISSION_DENIED', "You don't have permission to perform this action"));
export const managerRoles: Role[] = [Role.ADMIN, Role.MANAGER];
export function publicUser(user: User) { const { passwordHash: _passwordHash, ...safe } = user; return safe; }
