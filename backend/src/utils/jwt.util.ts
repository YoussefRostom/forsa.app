import jwt from 'jsonwebtoken';
import { jwtConfig } from '../config/jwt';
import { JwtPayload } from '../types';

export function generateToken(payload: Omit<JwtPayload, 'iat' | 'exp'>): string {
  return jwt.sign(payload, jwtConfig.secret, {
    expiresIn: jwtConfig.expiresIn,
  } as any);
}

export function generateRefreshToken(payload: Omit<JwtPayload, 'iat' | 'exp'>): string {
  return jwt.sign(payload, jwtConfig.refreshSecret, {
    expiresIn: jwtConfig.refreshExpiresIn,
  } as any);
}

export function verifyToken(token: string): JwtPayload {
  try {
    return jwt.verify(token, jwtConfig.secret) as JwtPayload;
  } catch (error) {
    throw new Error('Invalid or expired token');
  }
}

export function verifyRefreshToken(token: string): JwtPayload {
  try {
    return jwt.verify(token, jwtConfig.refreshSecret) as JwtPayload;
  } catch (error) {
    throw new Error('Invalid or expired refresh token');
  }
}

