import { resolveUserDisplayName } from '../lib/userDisplayName';
import { notifyAdmins } from './NotificationService';

type SignupRole = 'player' | 'parent' | 'agent' | 'academy' | 'clinic';

export async function notifyAdminsOfNewSignup(params: {
  signupUserId: string;
  role: SignupRole;
  userData: Record<string, unknown>;
}): Promise<void> {
  const displayName = resolveUserDisplayName(params.userData, 'New user');
  const roleLabel = params.role.toLowerCase();

  await notifyAdmins(
    'New account created',
    `${displayName} (${roleLabel}) just signed up successfully.`,
    'info',
    {
      notificationKind: 'signup',
      signupUserId: params.signupUserId,
      signupRole: roleLabel,
      signupDisplayName: displayName,
    }
  );
}