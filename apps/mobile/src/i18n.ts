import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

const resources = {
  en: {
    translation: {
      "welcome": "Welcome back",
      "reading_history": "Reading History",
      "saved_stories": "Saved Stories",
      "explore": "Explore"
    }
  },
  es: {
    translation: {
      "welcome": "Bienvenido de nuevo",
      "reading_history": "Historial de lectura",
      "saved_stories": "Historias guardadas",
      "explore": "Explorar"
    }
  }
};

i18n.use(initReactI18next).init({
  resources,
  lng: 'en',
  fallbackLng: 'en',
  interpolation: { escapeValue: false }
});

export default i18n;
