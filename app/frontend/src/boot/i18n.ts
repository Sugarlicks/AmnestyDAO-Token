import { createI18n } from 'vue-i18n';
import { boot } from 'quasar/wrappers';
import en from '../locales/en.json';
import zhTW from '../locales/zh-TW.json';
import th from '../locales/th.json';

const i18n = createI18n({
  locale: 'en', // Default locale
  fallbackLocale: 'en', // Fallback locale
  messages: {
    en,
    'zh-TW': zhTW,
    th
  }
});

export default boot(({ app }) => {
  app.use(i18n);
});

export { i18n };
