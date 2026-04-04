import * as Localization from 'expo-localization';
import { I18n } from 'i18n-js';

import ar from './ar';
import en from './en';

const i18n = new I18n({
  en,
  ar,
});

// Get the user's locale using the new expo-localization v17+ API
const locales = Localization.getLocales();
const locale = locales[0]?.languageTag || 'en';
i18n.locale = locale.includes('ar') ? 'ar' : 'en';
i18n.defaultLocale = 'en';
i18n.enableFallback = true;

export default i18n;
