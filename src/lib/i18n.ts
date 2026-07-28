export const LOCALES = ["en", "es", "fr", "pt", "ar"] as const;
export type Locale = (typeof LOCALES)[number];

export const LOCALE_LABELS: Record<Locale, string> = {
  en: "English",
  es: "Español",
  fr: "Français",
  pt: "Português",
  ar: "العربية"
};

export const RTL_LOCALES: Locale[] = ["ar"];

type Dict = Record<string, string>;

export const TRANSLATIONS: Record<Locale, Dict> = {
  en: {
    home: "Home",
    explore: "Explore",
    communities: "Communities",
    bots: "Bots",
    premium: "Premium",
    meetTheDevs: "Meet the Devs",
    wallet: "Wallet",
    messages: "Messages",
    notifications: "Notifications",
    settings: "Settings",
    signOut: "Sign out",
    logIn: "Log in",
    join: "Join",
    search: "Search users, projects, bots, communities…",
    publishProject: "Publish project",
    whatAreYouBuilding: "What are you building today?",
    post: "Post",
    noPostsYet: "No posts yet. Be the first to share what you're building.",
    loadMore: "Load more"
  },
  es: {
    home: "Inicio",
    explore: "Explorar",
    communities: "Comunidades",
    bots: "Bots",
    premium: "Premium",
    meetTheDevs: "Conoce al equipo",
    wallet: "Billetera",
    messages: "Mensajes",
    notifications: "Notificaciones",
    settings: "Configuración",
    signOut: "Cerrar sesión",
    logIn: "Iniciar sesión",
    join: "Unirse",
    search: "Buscar usuarios, proyectos, bots, comunidades…",
    publishProject: "Publicar proyecto",
    whatAreYouBuilding: "¿Qué estás construyendo hoy?",
    post: "Publicar",
    noPostsYet: "Aún no hay publicaciones. Sé el primero en compartir.",
    loadMore: "Cargar más"
  },
  fr: {
    home: "Accueil",
    explore: "Explorer",
    communities: "Communautés",
    bots: "Bots",
    premium: "Premium",
    meetTheDevs: "L'équipe",
    wallet: "Portefeuille",
    messages: "Messages",
    notifications: "Notifications",
    settings: "Paramètres",
    signOut: "Se déconnecter",
    logIn: "Se connecter",
    join: "Rejoindre",
    search: "Rechercher utilisateurs, projets, bots, communautés…",
    publishProject: "Publier un projet",
    whatAreYouBuilding: "Que construisez-vous aujourd'hui ?",
    post: "Publier",
    noPostsYet: "Pas encore de publications. Soyez le premier.",
    loadMore: "Charger plus"
  },
  pt: {
    home: "Início",
    explore: "Explorar",
    communities: "Comunidades",
    bots: "Bots",
    premium: "Premium",
    meetTheDevs: "Conheça a equipe",
    wallet: "Carteira",
    messages: "Mensagens",
    notifications: "Notificações",
    settings: "Configurações",
    signOut: "Sair",
    logIn: "Entrar",
    join: "Participar",
    search: "Buscar usuários, projetos, bots, comunidades…",
    publishProject: "Publicar projeto",
    whatAreYouBuilding: "O que você está construindo hoje?",
    post: "Publicar",
    noPostsYet: "Ainda não há publicações. Seja o primeiro.",
    loadMore: "Carregar mais"
  },
  ar: {
    home: "الرئيسية",
    explore: "استكشاف",
    communities: "المجتمعات",
    bots: "الروبوتات",
    premium: "بريميوم",
    meetTheDevs: "تعرف على الفريق",
    wallet: "المحفظة",
    messages: "الرسائل",
    notifications: "الإشعارات",
    settings: "الإعدادات",
    signOut: "تسجيل الخروج",
    logIn: "تسجيل الدخول",
    join: "انضمام",
    search: "ابحث عن مستخدمين، مشاريع، بوتات، مجتمعات…",
    publishProject: "نشر مشروع",
    whatAreYouBuilding: "ماذا تبني اليوم؟",
    post: "نشر",
    noPostsYet: "لا توجد منشورات بعد. كن أول من يشارك.",
    loadMore: "تحميل المزيد"
  }
};

export function translate(locale: Locale, key: string): string {
  return TRANSLATIONS[locale]?.[key] ?? TRANSLATIONS.en[key] ?? key;
}
