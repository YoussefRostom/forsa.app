import { Request, Response, NextFunction } from 'express';
import { db } from '../config/firebase';
import { sendSuccess, sendError } from '../utils/response.util';
import { createNotificationForUser } from '../utils/notification.util';
import { AccountStatus } from '../types';
import { z } from 'zod';

const updateUserStatusSchema = z.object({
  status: z.nativeEnum(AccountStatus),
});

/**
 * @swagger
 * /api/admin/users:
 *   get:
 *     summary: List all users (Admin only)
 */
export async function listUsers(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { role, status, page = '1', limit = '20' } = req.query;
    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const offset = (pageNum - 1) * limitNum;

    let query: any = db.collection('users');

    if (role) {
      query = query.where('role', '==', role);
    }

    if (status) {
      query = query.where('status', '==', status);
    }

    // Get total count
    const totalSnapshot = await query.get();
    const total = totalSnapshot.size;

    // Get paginated results
    const snapshot = await query
      .orderBy('createdAt', 'desc')
      .limit(limitNum)
      .offset(offset)
      .get();

    const users = snapshot.docs.map((doc: any) => {
      const data = doc.data();
      return {
        id: doc.id,
        email: data.email,
        phone: data.phone,
        role: data.role,
        status: data.status,
        profilePhoto: data.profilePhoto,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
      };
    });

    sendSuccess(
      res,
      {
        users,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum),
        },
      },
      'Users retrieved successfully'
    );
  } catch (error) {
    next(error);
  }
}

/**
 * @swagger
 * /api/admin/users/{id}:
 *   get:
 *     summary: Get user by ID (Admin only)
 */
export async function getUserById(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const userDoc = await db.collection('users').doc(id).get();

    if (!userDoc.exists) {
      sendError(res, 'NOT_FOUND', 'User not found', null, 404);
      return;
    }

    const userData = userDoc.data();

    // Get role-specific profile if exists
    let profile = null;
    const role = userData?.role;
    if (role) {
      const profileCollection = `${role}s`;
      const profileDoc = await db.collection(profileCollection).doc(id).get();
      if (profileDoc.exists) {
        profile = profileDoc.data();
      }
    }

    sendSuccess(
      res,
      {
        id: userDoc.id,
        email: userData?.email,
        phone: userData?.phone,
        role: userData?.role,
        status: userData?.status,
        profilePhoto: userData?.profilePhoto,
        createdAt: userData?.createdAt,
        updatedAt: userData?.updatedAt,
        profile,
      },
      'User retrieved successfully'
    );
  } catch (error) {
    next(error);
  }
}

/**
 * @swagger
 * /api/admin/users/{id}/status:
 *   put:
 *     summary: Update user status (Admin only)
 */
export async function updateUserStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const validatedData = updateUserStatusSchema.parse(req.body);
    const { status } = validatedData;

    const userDoc = await db.collection('users').doc(id).get();

    if (!userDoc.exists) {
      sendError(res, 'NOT_FOUND', 'User not found', null, 404);
      return;
    }

    // Update user status
    await db.collection('users').doc(id).update({
      status,
      updatedAt: new Date(),
    });

    // If suspending, also sign out from Firebase Auth
    if (status === AccountStatus.SUSPENDED || status === AccountStatus.BANNED) {
      const { auth } = await import('../config/firebase');
      try {
        await auth.revokeRefreshTokens(id);
      } catch (error) {
        console.error('Error revoking tokens:', error);
      }
      // Notify user that account was suspended/banned
      createNotificationForUser({
        userId: id,
        title: 'Account suspended',
        body: status === AccountStatus.BANNED ? 'Your account has been banned.' : 'Your account has been suspended. Please contact support.',
        type: 'system',
        data: { action: 'suspended', status },
        createdBy: req.user?.userId,
      }).catch((err) => console.error('Suspend notification failed:', err));
    } else if (status === AccountStatus.ACTIVE) {
      // Notify user that account was reactivated
      createNotificationForUser({
        userId: id,
        title: 'Account reactivated',
        body: 'Your account has been reactivated. You can sign in again.',
        type: 'system',
        data: { action: 'activated', status },
        createdBy: req.user?.userId,
      }).catch((err) => console.error('Activate notification failed:', err));
    }

    const updatedDoc = await db.collection('users').doc(id).get();

    sendSuccess(
      res,
      {
        id: updatedDoc.id,
        ...updatedDoc.data(),
      },
      'User status updated successfully'
    );
  } catch (error: any) {
    if (error.name === 'ZodError') {
      sendError(res, 'VALIDATION_ERROR', 'Invalid input data', error.errors, 400);
      return;
    }
    next(error);
  }
}

/**
 * @swagger
 * /api/admin/bookings:
 *   get:
 *     summary: List all bookings (Admin only)
 */
export async function listAllBookings(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { status, type, page = '1', limit = '20' } = req.query;
    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const offset = (pageNum - 1) * limitNum;

    let query: any = db.collection('bookings');

    if (status) {
      query = query.where('status', '==', status);
    }

    if (type) {
      query = query.where('bookingType', '==', type);
    }

    // Get total count
    const totalSnapshot = await query.get();
    const total = totalSnapshot.size;

    // Get paginated results
    const snapshot = await query
      .orderBy('createdAt', 'desc')
      .limit(limitNum)
      .offset(offset)
      .get();

    const bookings = await Promise.all(snapshot.docs.map(async (doc: any) => {
      const data = doc.data();
      let customerName = data.customerName || data.playerName;

      // If customerName is missing, try to fetch it from the users collection
      if (!customerName && (data.userId || data.playerId || data.parentId || data.uid)) {
        try {
          const userId = data.userId || data.playerId || data.parentId || data.uid;
          const userDoc = await db.collection('users').doc(userId).get();
          if (userDoc.exists) {
            const userData = userDoc.data();
            customerName = userData?.name || `${userData?.firstName || ''} ${userData?.lastName || ''}`.trim();
          }
        } catch (err) {
          console.error('Error fetching user name for booking:', doc.id, err);
        }
      }

      return {
        id: doc.id,
        ...data,
        customerName: customerName || 'Unknown Player',
      };
    }));

    sendSuccess(
      res,
      {
        bookings,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum),
        },
      },
      'Bookings retrieved successfully'
    );
  } catch (error) {
    next(error);
  }
}

/**
 * @swagger
 * /api/admin/bookings/{id}:
 *   get:
 *     summary: Get booking by ID (Admin only)
 */
export async function getBookingById(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const bookingDoc = await db.collection('bookings').doc(id).get();

    if (!bookingDoc.exists) {
      sendError(res, 'NOT_FOUND', 'Booking not found', null, 404);
      return;
    }

    const bookingData = bookingDoc.data();
    let customerName = bookingData?.customerName || bookingData?.playerName;

    if (!customerName && (bookingData?.userId || bookingData?.playerId || bookingData?.parentId || bookingData?.uid)) {
      try {
        const userId = bookingData.userId || bookingData.playerId || bookingData.parentId || bookingData.uid;
        const userDoc = await db.collection('users').doc(userId).get();
        if (userDoc.exists) {
          const userData = userDoc.data();
          customerName = userData?.name || `${userData?.firstName || ''} ${userData?.lastName || ''}`.trim();
        }
      } catch (err) {
        console.error('Error fetching user name for booking:', id, err);
      }
    }

    sendSuccess(
      res,
      {
        id: bookingDoc.id,
        ...bookingData,
        customerName: customerName || 'Unknown Player',
      },
      'Booking retrieved successfully'
    );
  } catch (error) {
    next(error);
  }
}

/**
 * Record an admin-to-user message in backend and notify the user
 */
export async function createAdminMessage(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id: userId } = req.params;
    const { content } = req.body;

    if (!content || typeof content !== 'string' || !content.trim()) {
      sendError(res, 'VALIDATION_ERROR', 'Message content is required', null, 400);
      return;
    }

    // Create a backend record for admin messages
    const adminId = req.user?.userId || null;
    const payload = {
      adminId,
      userId,
      content: content.trim(),
      createdAt: new Date(),
    };

    const docRef = await db.collection('admin_messages').add(payload as any);

    // Also create a notification for the user (so they see it in-app)
    await createNotificationForUser({
      userId,
      title: 'Message from Admin',
      body: content.trim().slice(0, 200),
      type: 'info',
      data: { adminMessageId: docRef.id },
      createdBy: adminId,
    });

    sendSuccess(res, { id: docRef.id, ...payload }, 'Admin message recorded');
  } catch (error) {
    next(error);
  }
}

/**
 * Get admin messages for a specific user
 */
export async function getAdminMessages(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id: userId } = req.params;
    const snapshot = await db.collection('admin_messages').where('userId', '==', userId).orderBy('createdAt', 'desc').get();
    const messages = snapshot.docs.map((d: any) => ({ id: d.id, ...(d.data() as any) }));
    sendSuccess(res, { messages }, 'Admin messages retrieved');
  } catch (error) {
    next(error);
  }
}

