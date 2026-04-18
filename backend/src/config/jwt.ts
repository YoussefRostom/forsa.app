import './env';

function getRequiredSecret(name: 'JWT_SECRET' | 'JWT_REFRESH_SECRET'): string {
  const value = process.env[name]?.trim();
  if (value) {
    return value;
  }

  if (process.env.NODE_ENV === 'test') {
    return `test-${name.toLowerCase()}`;
  }

  throw new Error(`[jwt] Missing required environment variable: ${name}`);
}

export const jwtConfig = {
  secret: getRequiredSecret('JWT_SECRET'),
  expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  refreshSecret: getRequiredSecret('JWT_REFRESH_SECRET'),
  refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d',
};

