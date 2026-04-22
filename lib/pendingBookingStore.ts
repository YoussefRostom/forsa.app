export type PendingBookingState = 'processing' | 'failed';

export type PendingBookingPreview = {
  id: string;
  viewerRole: 'player' | 'parent';
  type: 'academy' | 'clinic';
  name: string;
  providerName?: string;
  status: PendingBookingState;
  createdAt: string;
  date?: string | null;
  time?: string | null;
  shift?: string | null;
  doctor?: string | null;
  service?: string | null;
  program?: string | null;
  ageGroup?: string | null;
  price?: number | null;
  city?: string | null;
  branchId?: string | null;
  branchName?: string | null;
  branchAddress?: string | null;
  pendingMessage?: string | null;
};

const PENDING_TTL_MS = 45000;
const FAILED_TTL_MS = 20000;

const pendingBookings = new Map<string, PendingBookingPreview>();
const subscribers = new Set<() => void>();

function notifySubscribers() {
  subscribers.forEach((subscriber) => {
    try {
      subscriber();
    } catch {
      // no-op: subscriber errors should not break updates for others
    }
  });
}

function scheduleCleanup(id: string, ttlMs: number) {
  setTimeout(() => {
    const exists = pendingBookings.has(id);
    if (!exists) return;
    pendingBookings.delete(id);
    notifySubscribers();
  }, ttlMs);
}

export function addPendingBooking(preview: Omit<PendingBookingPreview, 'status'>) {
  const next: PendingBookingPreview = {
    ...preview,
    status: 'processing',
  };

  pendingBookings.set(preview.id, next);
  scheduleCleanup(preview.id, PENDING_TTL_MS);
  notifySubscribers();
}

export function completePendingBooking(id: string) {
  if (!pendingBookings.has(id)) return;
  pendingBookings.delete(id);
  notifySubscribers();
}

export function failPendingBooking(id: string, message?: string) {
  const current = pendingBookings.get(id);
  if (!current) return;

  pendingBookings.set(id, {
    ...current,
    status: 'failed',
    pendingMessage: message || null,
  });
  scheduleCleanup(id, FAILED_TTL_MS);
  notifySubscribers();
}

export function getPendingBookings(viewerRole: 'player' | 'parent') {
  return Array.from(pendingBookings.values())
    .filter((booking) => booking.viewerRole === viewerRole)
    .map((booking) => ({
      ...booking,
      __pendingBooking: true,
    }));
}

export function subscribePendingBookings(listener: () => void) {
  subscribers.add(listener);
  return () => {
    subscribers.delete(listener);
  };
}
