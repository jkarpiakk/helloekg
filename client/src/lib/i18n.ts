import type { Locale, I18nKeys } from "@/types";

/* ───────── Liczebniki (polska odmiana) ─────────
 * 1 → one, 2–4 (poza 12–14) → few, reszta (0, 5–21, 25…) → many.
 *   plural(n, "pytanie", "pytania", "pytań")
 *   countLabel(3, "pytanie", "pytania", "pytań") → "3 pytania"
 */
export function plural(n: number, one: string, few: string, many: string): string {
  const abs = Math.abs(Math.trunc(n));
  if (abs === 1) return one;
  const d = abs % 10;
  const dd = abs % 100;
  return d >= 2 && d <= 4 && (dd < 12 || dd > 14) ? few : many;
}

/** Liczba + odmieniony rzeczownik: „1 pytanie”, „3 pytania”, „12 pytań” */
export const countLabel = (n: number, one: string, few: string, many: string) => `${n} ${plural(n, one, few, many)}`;

/** „1 pytanie”, „2 pytania”, „5 pytań” */
export const pytania = (n: number) => countLabel(n, "pytanie", "pytania", "pytań");

/** Kolejka powtórki: „1 pytanie czeka”, „3 pytania czekają”, „12 pytań czeka” */
export const pytaniaCzekaja = (n: number) =>
  `${n} ${plural(n, "pytanie czeka", "pytania czekają", "pytań czeka")}`;

// Polish translations (active)
const plTranslations: I18nKeys = {
  common: {
    loading: "Ładowanie...",
    error: "Wystąpił błąd",
    success: "Sukces",
    save: "Zapisz",
    cancel: "Anuluj",
    delete: "Usuń",
    edit: "Edytuj",
    view: "Zobacz",
    back: "Wróć",
    next: "Następne",
    previous: "Poprzednie",
    continue: "Kontynuuj",
    close: "Zamknij",
    confirm: "Potwierdź",
    yes: "Tak",
    no: "Nie",
    search: "Szukaj",
    filter: "Filtruj",
    sort: "Sortuj",
    upload: "Prześlij",
    download: "Pobierz",
  },
  nav: {
    home: "Strona główna",
    blog: "Blog",
    courses: "Kurs",
    pricing: "Cennik",
    about: "O nas",
    dashboard: "Postęp",
    quiz: "Powtórka",
    progress: "Postęp",
    certificates: "Certyfikaty",
    admin: "Administracja",
    logout: "Wyloguj",
  },
  auth: {
    login: "Zaloguj się",
    register: "Zarejestruj się",
    logout: "Wyloguj",
    email: "Adres e-mail",
    password: "Hasło",
    confirmPassword: "Potwierdź hasło",
    firstName: "Imię",
    lastName: "Nazwisko",
    profession: "Zawód",
    forgotPassword: "Zapomniałeś hasła?",
    resetPassword: "Resetuj hasło",
    verifyEmail: "Zweryfikuj e-mail",
    termsAccepted: "Akceptuję regulamin",
    privacyAccepted: "Akceptuję politykę prywatności",
    marketingConsent: "Wyrażam zgodę na marketing",
    loginTitle: "Zaloguj się do EKG Academy",
    registerTitle: "Dołącz do EKG Academy",
    loginButton: "Zaloguj się",
    registerButton: "Utwórz konto",
    alreadyHaveAccount: "Masz już konto?",
    dontHaveAccount: "Nie masz konta?",
  },
  hero: {
    badge: "Dla studentów medycyny i profesjonalistów",
    title: {
      line1: "Ucz się EKG",
      line2: "jak z dobrym mentorem"
    },
    subtitle: "Pytanie po pytaniu, z natychmiastowym, prostym wyjaśnieniem. Metoda Feynmanna + active recall.",
    cta: {
      start: "Rozpocznij naukę",
      learn: "Jak to działa"
    },
    stats: {
      students: "2,500+ studentów",
      certificates: "1,200+ certyfikatów",
      rating: "4.9/5 ocena"
    }
  },
  how: {
    title: "Jak to działa",
    subtitle: "Prosty, skuteczny proces nauki EKG w trzech krokach",
    step1: {
      title: "1. Zarejestruj się",
      description: "Wybierz plan dostępu i załóż konto. Weryfikacja e-mail w kilka sekund."
    },
    step2: {
      title: "2. Rozwiązuj quiz",
      description: "Odpowiadaj na pytania i otrzymuj natychmiastowe wyjaśnienia w prostym języku."
    },
    step3: {
      title: "3. Odbierz certyfikat",
      description: "Uzyskaj certyfikat z unikalnym ID i publiczną weryfikacją - idealny do CV."
    }
  },
  pricing: {
    title: "Wybierz swój plan",
    subtitle: "Jednorazowa płatność, pełen dostęp przez wybrany okres",
    popular: "Najpopularniejszy",
    plan1: {
      title: "Plan Miesięczny",
      duration: "1 miesiąc dostępu",
    },
    plan2: {
      title: "Plan Kwartalny", 
      duration: "3 miesiące dostępu",
      savings: "Oszczędź 80 zł"
    },
    plan3: {
      title: "Plan Roczny",
      duration: "12 miesięcy dostępu", 
      savings: "Oszczędź 551 zł"
    },
    features: {
      quiz: "Pełny dostęp do quizów",
      explanations: "Natychmiastowe wyjaśnienia",
      progress: "Śledzenie postępów",
      certificate: "Certyfikat ukończenia",
      priority: "Priorytetowe wsparcie",
      updates: "Dostęp do nowych treści"
    },
    cta: "Wybierz plan",
    payment: {
      title: "Bezpieczne płatności przez:"
    }
  },
  quiz: {
    question: "Pytanie",
    of: "z",
    selectAnswer: "Wybierz odpowiedź",
    correct: "Prawidłowa odpowiedź!",
    incorrect: "Nieprawidłowa odpowiedź",
    explanation: "Wyjaśnienie:",
    nextQuestion: "Następne pytanie",
    previousQuestion: "Poprzednie pytanie",
    markForReview: "Oznacz do powtórki",
    showExplanation: "Pokaż wyjaśnienie",
    timeSpent: "Czas:",
    enlargeImage: "Kliknij aby powiększyć",
    exitQuiz: "Opuść quiz",
    confirmExit: "Czy na pewno chcesz opuścić quiz? Postęp zostanie zapisany.",
  },
  dashboard: {
    welcome: "Witaj ponownie",
    continueWhere: "Kontynuuj swoją naukę EKG tam, gdzie skończyłeś",
    overallProgress: "Ogólny postęp",
    accuracy: "Skuteczność odpowiedzi",
    streak: "Dni z rzędu",
    weakAreas: "Słabe obszary",
    continue: "Kontynuuj",
    review: "Powtórz błędy",
    lastActivity: "Ostatnia aktywność:",
    hoursAgo: "godzin temu",
    strengthenKnowledge: "Utrwal trudne zagadnienia",
    moduleProgress: "Postęp w modułach",
    completed: "ukończonych",
    questions: "pytań",
    locked: "Zablokowany",
    unlockRequirement: "Ukończ moduł",
  },
  admin: {
    panel: "Panel Administracyjny",
    manageContent: "Zarządzaj treścią i użytkownikami",
    questions: "Pytania",
    users: "Użytkownicy", 
    analytics: "Analityka",
    settings: "Ustawienia",
    questionManagement: "Zarządzanie pytaniami",
    newQuestion: "Nowe pytanie",
    importCsv: "Import CSV",
    status: "Status",
    module: "Moduł",
    difficulty: "Trudność",
    all: "Wszystkie",
    draft: "Draft",
    review: "Review", 
    published: "Published",
    easy: "Łatwe",
    medium: "Średnie",
    hard: "Trudne",
    searchQuestion: "Szukaj pytania...",
    successRate: "Skuteczność",
    created: "Utworzone",
    actions: "Akcje",
    approve: "Zatwierdź",
    reject: "Odrzuć",
    showing: "Pokazano",
    resultsOf: "z",
    results: "pytań"
  },
  support: {
    contact: "Kontakt",
    subject: "Temat",
    message: "Wiadomość",
    send: "Wyślij",
    faq: "FAQ",
    help: "Pomoc",
    tickets: "Zgłoszenia",
    priority: "Priorytet",
    open: "Otwarte",
    closed: "Zamknięte",
    low: "Niski",
    high: "Wysoki"
  }
};

// English translations (placeholder for future)
const enTranslations: I18nKeys = {
  common: {
    loading: "Loading...",
    error: "An error occurred",
    success: "Success",
    // ... other translations would be added here
  },
  nav: {
    home: "Home",
    courses: "Courses", 
    pricing: "Pricing",
    about: "About",
    // ... etc
  }
  // ... rest of translations
};

// Spanish translations (placeholder for future) 
const esTranslations: I18nKeys = {
  common: {
    loading: "Cargando...",
    error: "Ocurrió un error",
    success: "Éxito",
    // ... other translations would be added here
  },
  nav: {
    home: "Inicio", 
    courses: "Cursos",
    pricing: "Precios",
    about: "Acerca de",
    // ... etc
  }
  // ... rest of translations
};

const translations: Record<Locale, I18nKeys> = {
  pl: plTranslations,
  en: enTranslations,
  es: esTranslations,
};

class I18nService {
  private currentLocale: Locale = 'pl';

  setLocale(locale: Locale) {
    this.currentLocale = locale;
  }

  getLocale(): Locale {
    return this.currentLocale;
  }

  t(key: string, params?: Record<string, string | number>): string {
    const keys = key.split('.');
    let translation: any = translations[this.currentLocale];

    for (const k of keys) {
      translation = translation?.[k];
    }

    if (typeof translation !== 'string') {
      console.warn(`Translation not found for key: ${key}`);
      return key;
    }

    // Simple parameter substitution
    if (params) {
      return translation.replace(/\{\{(\w+)\}\}/g, (match: string, paramKey: string) => {
        return params[paramKey]?.toString() ?? match;
      });
    }

    return translation;
  }

  // Check if locale is available
  isLocaleAvailable(locale: Locale): boolean {
    return Object.keys(translations).includes(locale);
  }

  // Get available locales
  getAvailableLocales(): Locale[] {
    return Object.keys(translations) as Locale[];
  }
}

export const i18n = new I18nService();

// Hook for React components
export function useTranslation() {
  return {
    t: i18n.t.bind(i18n),
    locale: i18n.getLocale(),
    setLocale: i18n.setLocale.bind(i18n),
    availableLocales: i18n.getAvailableLocales(),
  };
}
