import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

import translationAR from "./locales/ar.json";
import translationEN from "./locales/en.json"; // تم تصحيح حرف الـ E هنا

const resources = {
  ar: { translation: translationAR },
  en: { translation: translationEN },
};

i18n
  .use(LanguageDetector) // لاكتشاف لغة المتصفح
  .use(initReactI18next) // لربطها بـ React
  .init({
    resources,
    fallbackLng: "ar", // تم تصحيح الكلمة هنا
    interpolation: {
      escapeValue: false,
    },
  });

export default i18n;
