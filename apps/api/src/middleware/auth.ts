import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { config } from '../config.js';

export type Role = 'ADMIN' | 'OPERATOR' | 'FIELD_REPORTER';
export type AuthUser = { id: string; email: string; role: Role };
export type AuthRequest = Request & { user?: AuthUser };

export function authenticate(req: AuthRequest, res: Response, next: NextFunction): void {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, '');
  if (!token) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }
  try {
    const claims = jwt.verify(token, config.jwtSecret);
    const parsed = jwtClaims.safeParse(claims);
    if (!parsed.success) {
      res.status(401).json({ error: 'Invalid access token claims' });
      return;
    }
    req.user = parsed.data;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired access token' });
  }
}

const jwtClaims = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  role: z.enum(['ADMIN', 'OPERATOR', 'FIELD_REPORTER']),
});

export function requireRoles(...roles: Role[]) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user || !roles.includes(req.user.role)) {
      res.status(403).json({ error: 'Insufficient permissions' });
      return;
    }
    next();
  };
}
