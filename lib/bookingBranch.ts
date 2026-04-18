const asText = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

const toKey = (value: unknown): string =>
  asText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

export type BookingBranchOption = {
  id: string;
  name: string;
  address: string;
  city: string;
  district: string;
};

export function normalizeBookingBranches(locations: any[] | null | undefined): BookingBranchOption[] {
  if (!Array.isArray(locations)) {
    return [];
  }

  return locations
    .map((location, index) => {
      const name = asText(location?.name) || asText(location?.label) || asText(location?.title) || `Branch ${index + 1}`;
      const address = asText(location?.address);
      const city = asText(location?.city);
      const district = asText(location?.district);
      const fallbackId = [name, address, city, district].map(toKey).filter(Boolean).join('-') || `branch-${index + 1}`;

      return {
        id: asText(location?.id) || asText(location?.branchId) || fallbackId,
        name,
        address,
        city,
        district,
      };
    })
    .filter((branch) => Boolean(branch.name || branch.address || branch.city || branch.district));
}

export function getBranchAddressLine(branch: Partial<BookingBranchOption> | null | undefined): string {
  return [asText(branch?.address), asText(branch?.district), asText(branch?.city)].filter(Boolean).join(', ');
}

export function getBranchSummary(branch: Partial<BookingBranchOption> | null | undefined): string {
  const name = asText(branch?.name);
  const address = getBranchAddressLine(branch);
  return [name, address].filter(Boolean).join(' · ');
}

export function buildBookingBranchPayload(branch: Partial<BookingBranchOption> | null | undefined) {
  return {
    branchId: asText(branch?.id) || null,
    branchName: asText(branch?.name) || null,
    branchAddress: getBranchAddressLine(branch) || null,
  };
}

export function formatBookingBranch(booking: {
  branchName?: string | null;
  branchAddress?: string | null;
} | null | undefined): string {
  const branchName = asText(booking?.branchName);
  const branchAddress = asText(booking?.branchAddress);

  if (branchName && branchAddress) {
    return `${branchName} - ${branchAddress}`;
  }

  return branchName || branchAddress;
}

export function recordMatchesBranch(
  record: { branchId?: string | null; branchName?: string | null; branchAddress?: string | null } | null | undefined,
  branch: Partial<BookingBranchOption> | null | undefined,
): boolean {
  if (!record || !branch) {
    return false;
  }

  const recordBranchId = toKey(record.branchId);
  const branchId = toKey(branch.id);
  if (recordBranchId && branchId) {
    return recordBranchId === branchId;
  }

  const recordBranchName = toKey(record.branchName);
  const branchName = toKey(branch.name);
  if (recordBranchName && branchName && recordBranchName === branchName) {
    return true;
  }

  const recordBranchAddress = toKey(record.branchAddress);
  const branchAddress = toKey(getBranchAddressLine(branch));
  return Boolean(recordBranchAddress && branchAddress && recordBranchAddress === branchAddress);
}

export function resolveRecordBranch<T extends { branchId?: string | null; branchName?: string | null; branchAddress?: string | null }>(
  record: T | null | undefined,
  branches: BookingBranchOption[] | null | undefined,
): BookingBranchOption | null {
  if (!record || !Array.isArray(branches) || branches.length === 0) {
    return null;
  }

  return branches.find((branch) => recordMatchesBranch(record, branch)) || null;
}