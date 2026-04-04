import swaggerJsdoc from 'swagger-jsdoc';
import dotenv from 'dotenv';

// Ensure environment variables are loaded when this module is imported
dotenv.config();

const PORT = process.env.PORT || 3000;

const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Forsa App API',
      version: '1.0.0',
      description: 'Forsa App Backend API – Checkpoint 1 \n\nAuthentication:\nSignin / Signup supports:\n- Email + Password\n- Phone + Password\n\nJWT must be sent as:\nAuthorization: Bearer <token>\n',
    },
    servers: [
      {
        url: process.env.API_URL || `http://localhost:${PORT}`,
        description: 'Development Server',
      },
    ],
    components: {
      schemas: {
        /* -------------------- AUTH SCHEMAS -------------------- */
        SignInRequest: {
          oneOf: [
            {
              type: 'object',
              required: ['email', 'password'],
              properties: {
                email: { type: 'string', format: 'email' },
                password: { type: 'string' },
              },
            },
            {
              type: 'object',
              required: ['phone', 'password'],
              properties: {
                phone: { type: 'string' },
                password: { type: 'string' },
              },
            },
          ],
        },

        /* -------------------- USER -------------------- */
        User: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            email: { type: 'string', nullable: true },
            phone: { type: 'string', nullable: true },
            role: {
              type: 'string',
              enum: ['player', 'agent', 'academy', 'parent', 'clinic', 'admin'],
            },
            status: {
              type: 'string',
              enum: ['active', 'pending', 'suspended'],
            },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },

        /* -------------------- BOOKING -------------------- */
        Booking: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            userId: { type: 'string' },
            providerId: { type: 'string' },
            status: {
              type: 'string',
              enum: ['requested', 'accepted', 'rejected', 'cancelled', 'completed'],
            },
            date: { type: 'string' },
            time: { type: 'string' },
            price: { type: 'number' },
          },
        },
      },
    },
    tags: [
      { name: 'Authentication' },
      { name: 'Users' },
      { name: 'Bookings' },
      { name: 'Admin' },
    ],
  },
  apis: ['./src/routes/*.ts'],
};

export default swaggerJsdoc(swaggerOptions);
