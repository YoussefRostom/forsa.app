import i18n from '../locales/i18n';

// Validation utility functions

const getTranslatedText = (key: string, fallback: string, options?: Record<string, string | number>) => {
  const translated = String(i18n.t(key, options));
  return translated && translated !== key ? translated : fallback;
};

const localizeFieldName = (fieldName: string): string => {
  const normalized = (fieldName || '').trim().toLowerCase();
  const fieldKeyMap: Record<string, string> = {
    'first name': 'first_name',
    'last name': 'last_name',
    'parent name': 'parent_name',
    'phone number': 'phone',
    phone: 'phone',
    password: 'password',
    city: 'city',
    address: 'address',
    position: 'position',
    'clinic name': 'clinic_name',
    'academy name': 'academy_name',
    email: 'email_address',
    'email address': 'email_address',
  };

  const key = fieldKeyMap[normalized];
  if (!key) {
    return fieldName;
  }

  const translated = String(i18n.t(key));
  return translated && translated !== key ? translated : fieldName;
};

/**
 * Normalize phone for Firebase Auth email generation (generic, any country).
 * Use the same function for both signup and signin so login with phone works.
 * - Strips all non-digits only. No country-specific rules (0, +92, etc.).
 * - Same digit sequence with any formatting (spaces, dashes, +, parentheses) → same account.
 * - User can sign up and sign in with e.g. "0300 123 4567" or "+92 300 1234567"; as long as
 *   the digit sequence is the same, the generated email matches.
 */
export function normalizePhoneForAuth(phone: string): string {
  return phone.replace(/\D/g, '');
}

/**
 * Robust normalization for Auth IDs.
 * Simply extracts all digits to create a unique identifier.
 * This works for any country as long as the user enters the same digits.
 */
export function normalizePhoneForTwilio(phone: string): string {
  // We keep the name "normalizePhoneForTwilio" for now to avoid 
  // breaking existing imports, but the logic is now country-agnostic.
  if (!phone) return "";

  // Extract only digits
  const digits = phone.replace(/\D/g, "");

  // Return consistent digit string. 
  // (e.g., "0300..." stays "0300...", "+92300..." stays "92300...")
  return digits;
}

export const validateEmail = (email: string): string | null => {
  if (!email) {
    return getTranslatedText('validationEmailRequired', 'Email is required');
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return getTranslatedText('validationValidEmail', 'Please enter a valid email address');
  }
  return null;
};

export const validatePhone = (phone: string): string | null => {
  if (!phone) {
    return getTranslatedText('validationPhoneRequired', 'Phone number is required');
  }
  // Remove spaces, dashes, parentheses, and other formatting characters
  const cleaned = phone.replace(/[\s\-\(\)\.]/g, '');

  // Check if it contains only digits and optional + at the start
  // International phone numbers can start with + (country code)
  // Minimum 7 digits, maximum 15 digits (ITU-T E.164 standard)
  const phoneRegex = /^\+?[0-9]{7,15}$/;

  if (!phoneRegex.test(cleaned)) {
    // More specific error messages
    if (cleaned.length < 7) {
      return getTranslatedText('validationPhoneMin', 'Phone number must be at least 7 digits');
    }
    if (cleaned.length > 15) {
      return getTranslatedText('validationPhoneMax', 'Phone number must be at most 15 digits');
    }
    if (!/^\+?[0-9]+$/.test(cleaned)) {
      return getTranslatedText('validationPhoneFormat', 'Phone number can only contain digits and optional + at the start');
    }
    return getTranslatedText('validationValidPhone', 'Please enter a valid phone number');
  }
  return null;
};

export const validatePassword = (password: string): string | null => {
  if (!password) {
    return getTranslatedText('validationPasswordRequired', 'Password is required');
  }
  if (password.length < 6) {
    return getTranslatedText('validationPasswordMin', 'Password must be at least 6 characters');
  }
  if (password.length > 50) {
    return getTranslatedText('validationPasswordMax', 'Password must be less than 50 characters');
  }
  // Optional: Add more password strength checks
  // if (!/[A-Z]/.test(password)) {
  //   return 'Password must contain at least one uppercase letter';
  // }
  // if (!/[0-9]/.test(password)) {
  //   return 'Password must contain at least one number';
  // }
  return null;
};

export const validateName = (name: string, fieldName: string = 'Name'): string | null => {
  const localizedFieldName = localizeFieldName(fieldName);

  if (!name || name.trim().length === 0) {
    return getTranslatedText('validationRequired', `${localizedFieldName} is required`, { field: localizedFieldName });
  }
  if (name.trim().length < 2) {
    return getTranslatedText('validationMinChars', `${localizedFieldName} must be at least 2 characters`, { field: localizedFieldName });
  }
  if (name.trim().length > 50) {
    return getTranslatedText('validationMaxChars', `${localizedFieldName} must be less than 50 characters`, { field: localizedFieldName });
  }
  // Allow Latin and Arabic letters, spaces, hyphens, and apostrophes.
  const nameRegex = /^[\p{L}\s'-]+$/u;
  if (!nameRegex.test(name.trim())) {
    return getTranslatedText('validationNameCharacters', `${localizedFieldName} can only contain letters, spaces, hyphens, and apostrophes`, { field: localizedFieldName });
  }
  return null;
};

export const validateDOB = (day: string, month: string, year: string): string | null => {
  if (!day || !month || !year) {
    return getTranslatedText('validationDobRequired', 'Date of birth is required');
  }
  const dayNum = parseInt(day, 10);
  const monthNum = parseInt(month, 10);
  const yearNum = parseInt(year, 10);

  if (isNaN(dayNum) || isNaN(monthNum) || isNaN(yearNum)) {
    return getTranslatedText('validationValidDate', 'Please enter a valid date');
  }

  // Check if date is valid
  const date = new Date(yearNum, monthNum - 1, dayNum);
  if (
    date.getFullYear() !== yearNum ||
    date.getMonth() !== monthNum - 1 ||
    date.getDate() !== dayNum
  ) {
    return getTranslatedText('validationValidDate', 'Please enter a valid date');
  }

  // Check if age is reasonable (between 5 and 100 years)
  const today = new Date();
  const age = today.getFullYear() - yearNum;
  if (age < 5 || age > 100) {
    return getTranslatedText('validationValidDob', 'Please enter a valid date of birth');
  }

  return null;
};

export const validateRequired = (value: string, fieldName: string): string | null => {
  if (!value || value.trim().length === 0) {
    const localizedFieldName = localizeFieldName(fieldName);
    return getTranslatedText('validationRequired', `${localizedFieldName} is required`, { field: localizedFieldName });
  }
  return null;
};

export const validateCity = (city: string): string | null => {
  if (!city || city.trim().length === 0) {
    return getTranslatedText('validationCityRequired', 'City is required');
  }
  return null;
};

export const validateAddress = (address: string): string | null => {
  if (!address || address.trim().length === 0) {
    return getTranslatedText('validationAddressRequired', 'Address is required');
  }
  if (address.trim().length < 5) {
    return getTranslatedText('validationAddressMin', 'Address must be at least 5 characters');
  }
  return null;
};

