import { defineStore } from 'pinia';
import { i18n } from '../boot/i18n';
import { useAuthStore } from './auth';

export interface LocaleInfo {
  code: string;
  name: string;
  country?: string;
}

export const useLocaleStore = defineStore('locale', {
  state: () => ({
    currentLocale: 'en' as string,
    currentCountry: null as string | null,
    availableLocales: [
      { code: 'en', name: 'English' },
      { code: 'zh-TW', name: '繁體中文' },
      { code: 'th', name: 'ไทย' }
    ] as LocaleInfo[],
    availableCountries: [
      { code: 'aus', name: 'Australia' },
      { code: 'nz', name: 'New Zealand' },
      { code: 'tw', name: 'Taiwan' },
      { code: 'th', name: 'Thailand' }
    ] as Array<{ code: string; name: string }>
  }),

  getters: {
    currentLocaleName: (state) => {
      const locale = state.availableLocales.find(l => l.code === state.currentLocale);
      return locale?.name || 'English';
    },
    currentCountryName: (state) => {
      if (!state.currentCountry) return null;
      const country = state.availableCountries.find(c => c.code === state.currentCountry);
      return country?.name || null;
    }
  },

  actions: {
    /**
     * Set the current locale and update i18n
     */
    setLocale(locale: string) {
      if (!this.availableLocales.find(l => l.code === locale)) {
        console.warn(`Locale ${locale} not available, falling back to 'en'`);
        locale = 'en';
      }
      this.currentLocale = locale;
      // Handle both legacy mode (string) and composition mode (ref)
      const localeRef = i18n.global.locale as any;
      if (typeof localeRef === 'string') {
        // Legacy mode - assign directly
        (i18n.global as any).locale = locale;
      } else if (localeRef && typeof localeRef.value !== 'undefined') {
        // Composition mode - use .value
        localeRef.value = locale;
      } else {
        // Fallback - try direct assignment
        (i18n.global as any).locale = locale;
      }
    },

    /**
     * Set the current country
     */
    setCountry(country: string | null) {
      if (country && !this.availableCountries.find(c => c.code === country)) {
        console.warn(`Country ${country} not available`);
        return;
      }
      this.currentCountry = country;
    },

    /**
     * Detect and set locale from user profile, browser, or default
     */
    detectLocale() {
      const authStore = useAuthStore();
      
      // Priority 1: User's saved language preference
      if (authStore.user && (authStore.user as any).language) {
        this.setLocale((authStore.user as any).language);
        return;
      }

      // Priority 2: Browser language
      const browserLang = navigator.language || (navigator as any).userLanguage;
      if (browserLang) {
        // Map browser language to our supported locales
        if (browserLang.startsWith('zh')) {
          // Check if it's Traditional Chinese (Taiwan/Hong Kong)
          if (browserLang.includes('TW') || browserLang.includes('HK')) {
            this.setLocale('zh-TW');
            return;
          }
        } else if (browserLang.startsWith('th')) {
          this.setLocale('th');
          return;
        } else if (browserLang.startsWith('en')) {
          this.setLocale('en');
          return;
        }
      }

      // Priority 3: Default to English
      this.setLocale('en');
    },

    /**
     * Sync locale and country from user profile
     */
    syncFromUserProfile() {
      const authStore = useAuthStore();
      if (authStore.user) {
        const user = authStore.user as any;
        if (user.language) {
          this.setLocale(user.language);
        }
        if (user.country !== undefined) {
          this.setCountry(user.country);
        }
      }
    },

    /**
     * Get suggested language for a country
     */
    getSuggestedLanguageForCountry(country: string | null): string {
      const suggestions: Record<string, string> = {
        'aus': 'en',
        'nz': 'en',
        'tw': 'zh-TW',
        'th': 'th'
      };
      return country ? (suggestions[country] || 'en') : 'en';
    }
  },

  persist: {
    pick: ['currentLocale', 'currentCountry']
  }
});

