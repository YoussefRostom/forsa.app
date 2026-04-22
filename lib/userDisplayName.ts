type AnyRecord = Record<string, any>;

function firstNonEmpty(values: Array<any>): string {
  for (const value of values) {
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed) {
        return trimmed;
      }
    }
  }

  return '';
}

export function buildPersonDisplayName(firstName?: string | null, lastName?: string | null): string {
  return [firstName, lastName]
    .filter((value) => typeof value === 'string' && value.trim().length > 0)
    .join(' ')
    .trim();
}

export function resolveUserDisplayName(userData: AnyRecord | null | undefined, fallback = 'Unknown'): string {
  if (!userData) {
    return fallback;
  }

  const fullName = buildPersonDisplayName(userData.firstName, userData.lastName);
  const displayName = firstNonEmpty([
    userData.username,
    userData.displayName,
    userData.name,
    userData.academyName,
    userData.clinicName,
    userData.parentName,
    userData.playerName,
    userData.agentName,
    fullName,
  ]);

  return displayName || fallback;
}
