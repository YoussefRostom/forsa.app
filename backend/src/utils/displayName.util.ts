function firstNonEmpty(candidates: unknown[]): string | null {
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate.trim();
    }
  }

  return null;
}

export function resolveUserDisplayName(data: any, fallback: string | null = null): string | null {
  const fullName = [data?.firstName, data?.lastName].filter(Boolean).join(' ').trim();

  return (
    firstNonEmpty([
      data?.username,
      data?.displayName,
      data?.name,
      data?.academyName,
      data?.clinicName,
      data?.parentName,
      data?.playerName,
      data?.agentName,
      fullName,
    ]) || fallback
  );
}

export function resolveBookingCustomerName(booking: any, fallback: string | null = null): string | null {
  return (
    firstNonEmpty([
      booking?.username,
      booking?.displayName,
      booking?.customerName,
      booking?.playerName,
      booking?.parentName,
      booking?.academyName,
      booking?.agentName,
      booking?.userName,
    ]) || fallback
  );
}
