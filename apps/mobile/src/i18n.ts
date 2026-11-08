import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const APP_LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'sw', label: 'Kiswahili' },
  { code: 'sheng', label: 'Sheng' },
] as const;

export type AppLanguage = typeof APP_LANGUAGES[number]['code'];

const LANG_KEY = 'app:language';

const resources = {
  en: {
    translation: {
      "welcome": "Welcome back",
      "reading_history": "Reading History",
      "saved_stories": "Saved Stories",
      "explore": "Explore",
      "tab_home": "Home",
      "tab_explore": "Explore",
      "tab_podcasts": "Podcasts",
      "tab_library": "Library",
      "tab_profile": "Profile",
      "sec_recs": "RECOMMENDED FOR YOU",
      "sec_updated": "UPDATED FOR YOU",
      "sec_trending": "TRENDING NOW",
      "sec_spotlight": "AUTHOR SPOTLIGHT",
      "sec_collections": "COLLECTIONS",
      "sec_community": "COMMUNITY",
      "sec_latest": "LATEST UPDATES",
      "sec_search": "SEARCH RESULTS",
      "common_save": "Save",
      "common_cancel": "Cancel",
      "common_close": "Close",
      "common_share": "Share",
      "common_retry": "Try again",
      "common_loading": "Loading...",
      "auth_signin": "Sign in",
      "auth_signup": "Sign up",
      "auth_email": "Email",
      "auth_password": "Password",
    }
  },
  sw: {
    translation: {
      "welcome": "Karibu tena",
      "reading_history": "Historia ya Kusoma",
      "saved_stories": "Hadithi Zilizohifadhiwa",
      "explore": "Gundua",
      "tab_home": "Nyumbani",
      "tab_explore": "Gundua",
      "tab_podcasts": "Podikasti",
      "tab_library": "Maktaba",
      "tab_profile": "Wasifu",
      "sec_recs": "TUMEKUCHAGULIA",
      "sec_updated": "ZILIZOSASISHWA KWAKO",
      "sec_trending": "ZINAZOTRENDI SASA",
      "sec_spotlight": "MWANDISHI WA WIKI",
      "sec_collections": "KOLEKSHENI",
      "sec_community": "JAMII",
      "sec_latest": "MPYA",
      "sec_search": "MATOKEO",
      "common_save": "Hifadhi",
      "common_cancel": "Ghairi",
      "common_close": "Funga",
      "common_share": "Shiriki",
      "common_retry": "Jaribu tena",
      "common_loading": "Inapakia...",
      "auth_signin": "Ingia",
      "auth_signup": "Jisajili",
      "auth_email": "Barua pepe",
      "auth_password": "Nywila",
    }
  },
  sheng: {
    translation: {
      "welcome": "Karibu msee",
      "reading_history": "History ya Kusoma",
      "saved_stories": "Ma-story Umesave",
      "explore": "Rada",
      "tab_home": "Mtaa",
      "tab_explore": "Rada",
      "tab_podcasts": "Podikasti",
      "tab_library": "Shelf",
      "tab_profile": "Profaa",
      "sec_recs": "TUMEKU-SORT",
      "sec_updated": "FRESHI KWAKO",
      "sec_trending": "ZINABAMBA",
      "sec_spotlight": "MSEE WA WIKI",
      "sec_collections": "MAGROUP",
      "sec_community": "MBOGI",
      "sec_latest": "MPYA",
      "sec_search": "MAJIBU",
      "common_save": "Save",
      "common_cancel": "Wacha",
      "common_close": "Funga",
      "common_share": "Sambaza",
      "common_retry": "Rudia",
      "common_loading": "Inaload...",
      "auth_signin": "Ingia",
      "auth_signup": "Join",
      "auth_email": "Email",
      "auth_password": "Password",
    }
  }
};

i18n.use(initReactI18next).init({
  resources,
  lng: 'en',
  fallbackLng: 'en',
  interpolation: { escapeValue: false }
});

export const getAppLanguage = async (): Promise<AppLanguage> => {
  try {
    const saved = await AsyncStorage.getItem(LANG_KEY);
    if (saved === 'sw' || saved === 'sheng' || saved === 'en') return saved;
  } catch {}
  return 'en';
};

export const setAppLanguage = async (code: AppLanguage): Promise<void> => {
  await i18n.changeLanguage(code);
  try {
    await AsyncStorage.setItem(LANG_KEY, code);
  } catch {}
};

export const initAppLanguage = async (): Promise<void> => {
  const code = await getAppLanguage();
  if (code !== 'en') await i18n.changeLanguage(code);
};

export default i18n;
