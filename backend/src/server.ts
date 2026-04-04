import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import { errorHandler } from './middleware/errorHandler.middleware';


// Import routes
import authRoutes from './routes/auth.routes';
import userRoutes from './routes/user.routes';
import bookingRoutes from './routes/booking.routes';
import academyRoutes from './routes/academy.routes';
import adminRoutes from './routes/admin.routes';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Swagger configuration
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Forsa App API',
      version: '1.0.0',
      description: `
# Forsa App Backend API - Checkpoint 1 Complete ✅

## Overview
Complete RESTful API backend for Forsa App with authentication, user management, booking system, and admin functionality.

## Features
- ✅ JWT Authentication (Signup/Login/Refresh)
- ✅ User & Profile Management
- ✅ Booking System (All States: requested/accepted/rejected/cancelled/completed)
- ✅ Admin APIs (View users, bookings, suspend/activate)
- ✅ Role-based Access Control
- ✅ Swagger Documentation

## Authentication
Most endpoints require a JWT token in the Authorization header:
\`\`\`
Authorization: Bearer <your-jwt-token>
\`\`\`

## Booking States
- \`requested\` - Initial state when booking is created
- \`accepted\` - Provider accepted the booking
- \`rejected\` - Provider rejected the booking
- \`cancelled\` - User or provider cancelled
- \`completed\` - Booking completed

## User Roles
- \`player\` - Player user
- \`agent\` - Agent user
- \`academy\` - Academy user
- \`parent\` - Parent user
- \`clinic\` - Clinic user
- \`admin\` - Admin user (full access)
      `,
      contact: {
        name: 'Forsa Team',
      },
      license: {
        name: 'ISC',
      },
    },
    servers: [
      {
        url: process.env.API_URL || `http://localhost:${PORT}`,
        description: 'Development server',
      },
      {
        url: 'https://your-deployed-url.railway.app',
        description: 'Production server (update after deployment)',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'JWT token obtained from /api/auth/signin',
        },
      },
      schemas: {
        User: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            email: { type: 'string', format: 'email' },
            phone: { type: 'string' },
            role: { type: 'string', enum: ['player', 'agent', 'academy', 'parent', 'clinic', 'admin'] },
            status: { type: 'string', enum: ['active', 'pending', 'suspended', 'banned'] },
            profilePhoto: { type: 'string', format: 'uri' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        Booking: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            userId: { type: 'string' },
            providerId: { type: 'string' },
            bookingType: { type: 'string', enum: ['academy', 'clinic'] },
            serviceId: { type: 'string' },
            programId: { type: 'string' },
            date: { type: 'string', format: 'date' },
            time: { type: 'string' },
            status: { type: 'string', enum: ['requested', 'accepted', 'rejected', 'cancelled', 'completed'] },
            price: { type: 'number' },
            notes: { type: 'string' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        Error: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            error: {
              type: 'object',
              properties: {
                code: { type: 'string', example: 'VALIDATION_ERROR' },
                message: { type: 'string', example: 'Invalid input data' },
                details: { type: 'object' },
              },
            },
          },
        },
        Success: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            data: { type: 'object' },
            message: { type: 'string', example: 'Operation successful' },
          },
        },
      },
    },
    tags: [
      { name: 'Authentication', description: 'User authentication endpoints' },
      { name: 'Users', description: 'User profile management' },
      { name: 'Bookings', description: 'Booking management endpoints' },
      { name: 'Academy Programs', description: 'Academy program management endpoints' },
      { name: 'Admin', description: 'Admin-only endpoints' },
    ],
    security: [
      {
        bearerAuth: [],
      },
    ],
  },
  apis: ['./src/routes/*.ts', './src/controllers/*.ts'],
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(morgan('combined'));

// Swagger UI
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// API Routes
// Note: authRateLimiter is applied inside auth.routes.ts for specific endpoints to avoid blocking OTP testing
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/academy', academyRoutes);
app.use('/api/admin', adminRoutes);

// Import media routes
import mediaRoutes from './routes/media.routes';
app.use('/api/media', mediaRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: 'Route not found',
    },
  });
});

// Error handler (must be last)
app.use(errorHandler);

// Start server
app.listen(PORT, () => {
});

export default app;

