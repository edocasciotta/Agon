"use client";

import { useState } from "react";

const GITHUB = "https://github.com/edocasciotta/Agon";
const RELEASES = `${GITHUB}/releases/latest`;

type Lang = "en" | "it" | "fr" | "es" | "pt" | "de" | "nl" | "pl" | "tr";

const langLabels: Record<Lang, string> = {
  en: "English", it: "Italiano", fr: "Français", es: "Español",
  pt: "Português", de: "Deutsch", nl: "Nederlands", pl: "Polski", tr: "Türkçe",
};

type Copy = {
  badge: string;
  h1: string;
  sub: string;
  source: string;
  downloadFor: (p: string) => string;
  featuresTitle: string;
  features: { title: string; desc: string }[];
  selfTitle: string;
  selfBody: string;
  archItems: string[];
  ctaTitle: string;
  ctaBody: string;
  viewGithub: string;
  releases: string;
  footerLicense: string;
  platforms: { name: string; sub: string }[];
};

const copy: Record<Lang, Copy> = {
  en: {
    badge: "Free & open source",
    h1: "Manage your studio for free. Forever.",
    sub: "Agon helps fitness studios manage classes, memberships, payments, and check-ins. Runs on your computer. No monthly fees.",
    source: "Build from source",
    downloadFor: (p) => `Download for ${p}`,
    featuresTitle: "What Agon includes",
    features: [
      { title: "Class scheduling", desc: "Timetable management, recurring classes, and configurable booking windows per class." },
      { title: "Client management", desc: "Client profiles, booking history, membership tracking, and GDPR data tools." },
      { title: "Online booking", desc: "Clients book from the mobile app. Automatic waitlist management and credit deduction." },
      { title: "Memberships & payments", desc: "Flexible membership types with Stripe integration and complete payment history." },
      { title: "Check-in", desc: "QR code, manual, or app-based check-in. Attendance tracked automatically." },
      { title: "Reports", desc: "Attendance, revenue, and retention data. Export to CSV at any time." },
    ],
    selfTitle: "No monthly fees. No data sharing.",
    selfBody: "Agon installs on your Mac or Windows PC. Your database stays on your machine — Agon never stores or accesses your studio data.",
    archItems: ["Desktop app", "Local database (SQLite)", "Secure tunnel", "Mobile app (iOS / Android)"],
    ctaTitle: "Free and open source.",
    ctaBody: "Source code is publicly available on GitHub under the MIT license. Inspect it, contribute, or deploy it yourself.",
    viewGithub: "View on GitHub", releases: "Releases", footerLicense: "MIT License",
    platforms: [{ name: "macOS", sub: "macOS 12 or later" }, { name: "Windows", sub: "Windows 10 or later" }, { name: "Linux", sub: "Ubuntu 20.04+" }],
  },
  it: {
    badge: "Gratis e open source",
    h1: "Gestisci il tuo studio gratis. Per sempre.",
    sub: "Agon aiuta le palestre a gestire corsi, iscrizioni, pagamenti e check-in. Gira sul tuo computer. Nessun abbonamento mensile.",
    source: "Build from source",
    downloadFor: (p) => `Download per ${p}`,
    featuresTitle: "Cosa include Agon",
    features: [
      { title: "Gestione corsi", desc: "Calendario lezioni, corsi ricorrenti e finestre di prenotazione configurabili per classe." },
      { title: "Gestione clienti", desc: "Profili clienti, storico prenotazioni, abbonamenti attivi e strumenti GDPR." },
      { title: "Prenotazioni online", desc: "I clienti prenotano dall'app mobile. Lista d'attesa automatica e scalare crediti." },
      { title: "Abbonamenti e pagamenti", desc: "Tipi di abbonamento flessibili con integrazione Stripe e storico pagamenti completo." },
      { title: "Check-in", desc: "Check-in via QR code, manuale o dall'app. Presenze tracciate automaticamente." },
      { title: "Report", desc: "Dati su presenze, ricavi e fidelizzazione. Export CSV in qualsiasi momento." },
    ],
    selfTitle: "Nessun costo mensile. Nessuna condivisione dei dati.",
    selfBody: "Agon si installa sul tuo Mac o PC Windows. Il database rimane sul tuo computer — Agon non archivia né accede ai dati del tuo studio.",
    archItems: ["App desktop", "Database locale (SQLite)", "Tunnel sicuro", "App mobile (iOS / Android)"],
    ctaTitle: "Gratis e open source.",
    ctaBody: "Il codice sorgente è pubblico su GitHub con licenza MIT. Puoi ispezionarlo, contribuire o fare il deploy autonomamente.",
    viewGithub: "Vedi su GitHub", releases: "Release", footerLicense: "Licenza MIT",
    platforms: [{ name: "macOS", sub: "macOS 12 o superiore" }, { name: "Windows", sub: "Windows 10 o superiore" }, { name: "Linux", sub: "Ubuntu 20.04+" }],
  },
  fr: {
    badge: "Gratuit et open source",
    h1: "Gérez votre studio gratuitement. Pour toujours.",
    sub: "Agon aide les studios de fitness à gérer les cours, abonnements, paiements et check-ins. Fonctionne sur votre ordinateur. Sans frais mensuels.",
    source: "Compiler depuis les sources",
    downloadFor: (p) => `Télécharger pour ${p}`,
    featuresTitle: "Ce qu'Agon inclut",
    features: [
      { title: "Gestion des cours", desc: "Planification des horaires, cours récurrents et fenêtres de réservation configurables par cours." },
      { title: "Gestion des clients", desc: "Profils clients, historique des réservations, suivi des abonnements et outils RGPD." },
      { title: "Réservation en ligne", desc: "Les clients réservent depuis l'application mobile. Gestion automatique des listes d'attente et déduction de crédits." },
      { title: "Abonnements & paiements", desc: "Types d'abonnements flexibles avec intégration Stripe et historique des paiements complet." },
      { title: "Check-in", desc: "Check-in par QR code, manuel ou depuis l'application. Présences enregistrées automatiquement." },
      { title: "Rapports", desc: "Données de présence, revenus et fidélisation. Export CSV à tout moment." },
    ],
    selfTitle: "Sans frais mensuels. Sans partage de données.",
    selfBody: "Agon s'installe sur votre Mac ou PC Windows. Votre base de données reste sur votre machine — Agon ne stocke ni n'accède jamais aux données de votre studio.",
    archItems: ["Application bureau", "Base de données locale (SQLite)", "Tunnel sécurisé", "Application mobile (iOS / Android)"],
    ctaTitle: "Gratuit et open source.",
    ctaBody: "Le code source est disponible publiquement sur GitHub sous licence MIT. Inspectez-le, contribuez ou déployez-le vous-même.",
    viewGithub: "Voir sur GitHub", releases: "Notes de version", footerLicense: "Licence MIT",
    platforms: [{ name: "macOS", sub: "macOS 12 ou version ultérieure" }, { name: "Windows", sub: "Windows 10 ou version ultérieure" }, { name: "Linux", sub: "Ubuntu 20.04+" }],
  },
  es: {
    badge: "Gratis y open source",
    h1: "Gestiona tu estudio gratis. Para siempre.",
    sub: "Agon ayuda a los estudios de fitness a gestionar clases, membresías, pagos y registros. Funciona en tu ordenador. Sin cuotas mensuales.",
    source: "Compilar desde el código fuente",
    downloadFor: (p) => `Descargar para ${p}`,
    featuresTitle: "Qué incluye Agon",
    features: [
      { title: "Gestión de clases", desc: "Gestión de horarios, clases recurrentes y ventanas de reserva configurables por clase." },
      { title: "Gestión de clientes", desc: "Perfiles de cliente, historial de reservas, seguimiento de membresías y herramientas RGPD." },
      { title: "Reserva online", desc: "Los clientes reservan desde la app móvil. Gestión automática de lista de espera y deducción de créditos." },
      { title: "Membresías y pagos", desc: "Tipos de membresía flexibles con integración Stripe e historial de pagos completo." },
      { title: "Check-in", desc: "Check-in por código QR, manual o desde la app. Asistencia registrada automáticamente." },
      { title: "Informes", desc: "Datos de asistencia, ingresos y retención. Exportación CSV en cualquier momento." },
    ],
    selfTitle: "Sin cuotas mensuales. Sin compartir datos.",
    selfBody: "Agon se instala en tu Mac o PC con Windows. Tu base de datos se queda en tu máquina — Agon nunca almacena ni accede a los datos de tu estudio.",
    archItems: ["Aplicación de escritorio", "Base de datos local (SQLite)", "Túnel seguro", "App móvil (iOS / Android)"],
    ctaTitle: "Gratis y de código abierto.",
    ctaBody: "El código fuente está disponible públicamente en GitHub bajo la licencia MIT. Inspéctalo, contribuye o despliégalo tú mismo.",
    viewGithub: "Ver en GitHub", releases: "Notas de versión", footerLicense: "Licencia MIT",
    platforms: [{ name: "macOS", sub: "macOS 12 o posterior" }, { name: "Windows", sub: "Windows 10 o posterior" }, { name: "Linux", sub: "Ubuntu 20.04+" }],
  },
  pt: {
    badge: "Gratuito e open source",
    h1: "Gerencie seu estúdio de graça. Para sempre.",
    sub: "Agon ajuda estúdios de fitness a gerenciar aulas, associações, pagamentos e check-ins. Roda no seu computador. Sem mensalidades.",
    source: "Compilar a partir do código-fonte",
    downloadFor: (p) => `Baixar para ${p}`,
    featuresTitle: "O que o Agon inclui",
    features: [
      { title: "Gestão de aulas", desc: "Gerenciamento de horários, aulas recorrentes e janelas de reserva configuráveis por aula." },
      { title: "Gestão de clientes", desc: "Perfis de clientes, histórico de reservas, acompanhamento de associações e ferramentas LGPD." },
      { title: "Reservas online", desc: "Clientes reservam pelo app móvel. Gerenciamento automático de lista de espera e dedução de créditos." },
      { title: "Associações e pagamentos", desc: "Tipos de associação flexíveis com integração Stripe e histórico completo de pagamentos." },
      { title: "Check-in", desc: "Check-in por QR code, manual ou pelo app. Presença registrada automaticamente." },
      { title: "Relatórios", desc: "Dados de presença, receita e retenção. Exportação CSV a qualquer momento." },
    ],
    selfTitle: "Sem mensalidades. Sem compartilhamento de dados.",
    selfBody: "Agon instala no seu Mac ou PC com Windows. Seu banco de dados fica na sua máquina — Agon nunca armazena ou acessa os dados do seu estúdio.",
    archItems: ["App desktop", "Banco de dados local (SQLite)", "Túnel seguro", "App móvel (iOS / Android)"],
    ctaTitle: "Gratuito e open source.",
    ctaBody: "O código-fonte está disponível publicamente no GitHub sob a licença MIT. Inspecione-o, contribua ou faça o deploy por conta própria.",
    viewGithub: "Ver no GitHub", releases: "Notas de versão", footerLicense: "Licença MIT",
    platforms: [{ name: "macOS", sub: "macOS 12 ou superior" }, { name: "Windows", sub: "Windows 10 ou superior" }, { name: "Linux", sub: "Ubuntu 20.04+" }],
  },
  de: {
    badge: "Kostenlos und Open Source",
    h1: "Verwalte dein Studio kostenlos. Für immer.",
    sub: "Agon hilft Fitnessstudios bei der Verwaltung von Kursen, Mitgliedschaften, Zahlungen und Check-ins. Läuft auf deinem Computer. Keine monatlichen Gebühren.",
    source: "Aus dem Quellcode erstellen",
    downloadFor: (p) => `Herunterladen für ${p}`,
    featuresTitle: "Was Agon beinhaltet",
    features: [
      { title: "Kursverwaltung", desc: "Stundenplanverwaltung, wiederkehrende Kurse und konfigurierbare Buchungsfenster pro Kurs." },
      { title: "Kundenverwaltung", desc: "Kundenprofile, Buchungshistorie, Mitgliedschaftsverfolgung und DSGVO-Tools." },
      { title: "Online-Buchung", desc: "Kunden buchen über die mobile App. Automatische Wartelistenverwaltung und Kreditabzug." },
      { title: "Mitgliedschaften & Zahlungen", desc: "Flexible Mitgliedschaftstypen mit Stripe-Integration und vollständiger Zahlungshistorie." },
      { title: "Check-in", desc: "QR-Code-, manueller oder App-basierter Check-in. Anwesenheit wird automatisch erfasst." },
      { title: "Berichte", desc: "Anwesenheits-, Umsatz- und Kundenbindungsdaten. Jederzeit CSV-Export." },
    ],
    selfTitle: "Keine monatlichen Gebühren. Keine Datenweitergabe.",
    selfBody: "Agon wird auf deinem Mac oder Windows-PC installiert. Deine Datenbank bleibt auf deiner Maschine — Agon speichert oder greift nie auf deine Studiodaten zu.",
    archItems: ["Desktop-App", "Lokale Datenbank (SQLite)", "Sicherer Tunnel", "Mobile App (iOS / Android)"],
    ctaTitle: "Kostenlos und Open Source.",
    ctaBody: "Der Quellcode ist öffentlich auf GitHub unter der MIT-Lizenz verfügbar. Inspiziere ihn, trage bei oder deploye ihn selbst.",
    viewGithub: "Auf GitHub ansehen", releases: "Versionshinweise", footerLicense: "MIT-Lizenz",
    platforms: [{ name: "macOS", sub: "macOS 12 oder neuer" }, { name: "Windows", sub: "Windows 10 oder neuer" }, { name: "Linux", sub: "Ubuntu 20.04+" }],
  },
  nl: {
    badge: "Gratis en open source",
    h1: "Beheer je studio gratis. Voor altijd.",
    sub: "Agon helpt fitnesscentra bij het beheren van lessen, abonnementen, betalingen en check-ins. Werkt op uw computer. Geen maandelijkse kosten.",
    source: "Bouwen vanuit broncode",
    downloadFor: (p) => `Downloaden voor ${p}`,
    featuresTitle: "Wat Agon bevat",
    features: [
      { title: "Lessen beheren", desc: "Roosterbeheer, terugkerende lessen en configureerbare boekingsvensters per les." },
      { title: "Klantenbeheer", desc: "Klantprofielen, boekingsgeschiedenis, abonnementsbeheer en AVG-tools." },
      { title: "Online boeken", desc: "Klanten boeken via de mobiele app. Automatisch wachtlijstbeheer en kredietaftrek." },
      { title: "Abonnementen & betalingen", desc: "Flexibele abonnementstypen met Stripe-integratie en volledige betalingsgeschiedenis." },
      { title: "Check-in", desc: "Check-in via QR-code, handmatig of via de app. Aanwezigheid automatisch bijgehouden." },
      { title: "Rapporten", desc: "Aanwezigheids-, omzet- en retentiegegevens. Exporteer naar CSV wanneer u wilt." },
    ],
    selfTitle: "Geen maandelijkse kosten. Geen gegevensdeling.",
    selfBody: "Agon wordt geïnstalleerd op uw Mac of Windows-pc. Uw database blijft op uw computer — Agon slaat uw studiogegevens nooit op en heeft er geen toegang toe.",
    archItems: ["Desktop-app", "Lokale database (SQLite)", "Beveiligde tunnel", "Mobiele app (iOS / Android)"],
    ctaTitle: "Gratis en open source.",
    ctaBody: "De broncode is openbaar beschikbaar op GitHub onder de MIT-licentie. Inspecteer het, draag bij of implementeer het zelf.",
    viewGithub: "Bekijk op GitHub", releases: "Release-notities", footerLicense: "MIT-licentie",
    platforms: [{ name: "macOS", sub: "macOS 12 of hoger" }, { name: "Windows", sub: "Windows 10 of hoger" }, { name: "Linux", sub: "Ubuntu 20.04+" }],
  },
  pl: {
    badge: "Bezpłatne i open source",
    h1: "Zarządzaj swoim studiem bezpłatnie. Na zawsze.",
    sub: "Agon pomaga studiom fitness zarządzać zajęciami, członkostwami, płatnościami i check-inami. Działa na Twoim komputerze. Bez miesięcznych opłat.",
    source: "Buduj ze źródła",
    downloadFor: (p) => `Pobierz na ${p}`,
    featuresTitle: "Co zawiera Agon",
    features: [
      { title: "Zarządzanie zajęciami", desc: "Zarządzanie harmonogramem, zajęcia cykliczne i konfigurowalne okna rezerwacji na zajęcia." },
      { title: "Zarządzanie klientami", desc: "Profile klientów, historia rezerwacji, śledzenie członkostw i narzędzia RODO." },
      { title: "Rezerwacje online", desc: "Klienci rezerwują przez aplikację mobilną. Automatyczne zarządzanie listą oczekujących i odliczanie kredytów." },
      { title: "Członkostwa i płatności", desc: "Elastyczne typy członkostw z integracją Stripe i pełną historią płatności." },
      { title: "Check-in", desc: "Check-in kodem QR, ręcznie lub przez aplikację. Frekwencja śledzona automatycznie." },
      { title: "Raporty", desc: "Dane o frekwencji, przychodach i retencji. Eksport CSV w dowolnym momencie." },
    ],
    selfTitle: "Brak miesięcznych opłat. Brak udostępniania danych.",
    selfBody: "Agon instaluje się na Twoim Macu lub komputerze z Windows. Twoja baza danych pozostaje na Twojej maszynie — Agon nigdy nie przechowuje ani nie uzyskuje dostępu do danych Twojego studia.",
    archItems: ["Aplikacja desktopowa", "Lokalna baza danych (SQLite)", "Bezpieczny tunel", "Aplikacja mobilna (iOS / Android)"],
    ctaTitle: "Bezpłatne i open source.",
    ctaBody: "Kod źródłowy jest publicznie dostępny na GitHub na licencji MIT. Możesz go sprawdzić, wnieść wkład lub wdrożyć samodzielnie.",
    viewGithub: "Zobacz na GitHub", releases: "Informacje o wydaniu", footerLicense: "Licencja MIT",
    platforms: [{ name: "macOS", sub: "macOS 12 lub nowszy" }, { name: "Windows", sub: "Windows 10 lub nowszy" }, { name: "Linux", sub: "Ubuntu 20.04+" }],
  },
  tr: {
    badge: "Ücretsiz ve açık kaynak",
    h1: "Stüdyonuzu ücretsiz yönetin. Sonsuza kadar.",
    sub: "Agon, fitness stüdyolarının dersler, üyelikler, ödemeler ve check-in'leri yönetmesine yardımcı olur. Bilgisayarınızda çalışır. Aylık ücret yok.",
    source: "Kaynaktan derle",
    downloadFor: (p) => `${p} için indirin`,
    featuresTitle: "Agon neler içerir",
    features: [
      { title: "Ders yönetimi", desc: "Ders programı yönetimi, tekrarlayan dersler ve ders başına yapılandırılabilir rezervasyon pencereleri." },
      { title: "Müşteri yönetimi", desc: "Müşteri profilleri, rezervasyon geçmişi, üyelik takibi ve KVKK araçları." },
      { title: "Online rezervasyon", desc: "Müşteriler mobil uygulamadan rezervasyon yapar. Otomatik bekleme listesi yönetimi ve kredi düşümü." },
      { title: "Üyelikler ve ödemeler", desc: "Stripe entegrasyonlu esnek üyelik türleri ve eksiksiz ödeme geçmişi." },
      { title: "Check-in", desc: "QR kod, manuel veya uygulama üzerinden check-in. Katılım otomatik olarak kaydedilir." },
      { title: "Raporlar", desc: "Katılım, gelir ve sadakat verileri. İstediğiniz zaman CSV ihracatı." },
    ],
    selfTitle: "Aylık ücret yok. Veri paylaşımı yok.",
    selfBody: "Agon Mac veya Windows PC'nize kurulur. Veritabanınız bilgisayarınızda kalır — Agon stüdyo verilerinizi asla depolamaz veya erişmez.",
    archItems: ["Masaüstü uygulaması", "Yerel veritabanı (SQLite)", "Güvenli tünel", "Mobil uygulama (iOS / Android)"],
    ctaTitle: "Ücretsiz ve açık kaynak.",
    ctaBody: "Kaynak kodu GitHub'da MIT lisansı altında kamuya açıktır. İnceleyebilir, katkıda bulunabilir veya kendiniz deploy edebilirsiniz.",
    viewGithub: "GitHub'da görüntüle", releases: "Sürüm notları", footerLicense: "MIT Lisansı",
    platforms: [{ name: "macOS", sub: "macOS 12 veya üzeri" }, { name: "Windows", sub: "Windows 10 veya üzeri" }, { name: "Linux", sub: "Ubuntu 20.04+" }],
  },
};

// ─── Icons ─────────────────────────────────────────────────────────────────────

function GithubIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.02 10.02 0 0 0 22 12.017C22 6.484 17.522 2 12 2z" />
    </svg>
  );
}

function AppleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
    </svg>
  );
}

function WindowsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M3 5.5L10.5 4.5V11.5H3V5.5ZM11.5 4.35L21 3V11.5H11.5V4.35ZM3 12.5H10.5V19.5L3 18.5V12.5ZM11.5 12.5H21V21L11.5 19.65V12.5Z" />
    </svg>
  );
}

function TerminalIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="4 17 10 11 4 5" /><line x1="12" y1="19" x2="20" y2="19" />
    </svg>
  );
}

function platformIcon(name: string) {
  const cls = "w-4 h-4 flex-shrink-0";
  if (name === "macOS") return <AppleIcon className={cls} />;
  if (name === "Windows") return <WindowsIcon className={cls} />;
  return <TerminalIcon className={cls} />;
}

const featureIcons = [
  <svg key="cal" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
  <svg key="usr" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  <svg key="tkt" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path d="M15 5v2M15 11v2M15 17v2M5 5h14a2 2 0 0 1 2 2v3a2 2 0 0 0 0 4v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-3a2 2 0 0 0 0-4V7a2 2 0 0 1 2-2z"/></svg>,
  <svg key="cc" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>,
  <svg key="chk" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>,
  <svg key="bar" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>,
];

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function Home() {
  const [lang, setLang] = useState<Lang>("en");
  const t = copy[lang];

  return (
    <main className="min-h-screen bg-white text-zinc-900">

      {/* ── Nav ── */}
      <nav className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm border-b border-zinc-100">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          <span className="font-bold text-base tracking-tight">Agon</span>
          <div className="flex items-center gap-4">
            <select
              value={lang}
              onChange={(e) => setLang(e.target.value as Lang)}
              className="text-xs font-medium border border-zinc-200 rounded px-2 py-1.5 bg-white text-zinc-700 cursor-pointer hover:border-zinc-400 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1"
            >
              {(Object.entries(langLabels) as [Lang, string][]).map(([code, label]) => (
                <option key={code} value={code}>{label}</option>
              ))}
            </select>
            <a
              href={GITHUB}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-900 transition-colors"
            >
              <GithubIcon className="w-4 h-4" />
              GitHub
            </a>
          </div>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="max-w-5xl mx-auto px-6 pt-20 pb-20 text-center">
        <span className="inline-block text-xs font-semibold text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full mb-6">
          {t.badge}
        </span>
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-zinc-900 mb-5 max-w-2xl mx-auto">
          {t.h1}
        </h1>
        <p className="text-lg text-zinc-500 max-w-xl mx-auto mb-10 leading-relaxed">
          {t.sub}
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center flex-wrap">
          {t.platforms.map(({ name, sub }) => (
            <a
              key={name}
              href={RELEASES}
              target="_blank"
              rel="noopener noreferrer"
              className="group inline-flex items-center gap-3 px-5 py-3 border border-zinc-300 rounded-lg bg-white hover:border-indigo-500 hover:bg-indigo-50 transition-colors text-sm"
            >
              <span className="text-zinc-400 group-hover:text-indigo-500 transition-colors">
                {platformIcon(name)}
              </span>
              <div className="text-left">
                <div className="font-semibold text-zinc-800 leading-none">{t.downloadFor(name)}</div>
                <div className="text-xs text-zinc-400 mt-0.5">{sub}</div>
              </div>
            </a>
          ))}
        </div>
        <p className="mt-5 text-sm text-zinc-400">
          <a href={GITHUB} target="_blank" rel="noopener noreferrer" className="hover:text-zinc-600 underline underline-offset-2 transition-colors">
            {t.source} ↗
          </a>
        </p>
      </section>

      {/* ── Features ── */}
      <section className="bg-zinc-50 border-t border-zinc-100">
        <div className="max-w-5xl mx-auto px-6 py-20">
          <h2 className="text-2xl font-bold text-zinc-900 mb-10">{t.featuresTitle}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {t.features.map((f, i) => (
              <div key={f.title} className="bg-white border border-zinc-200 rounded-xl p-5">
                <div className="text-indigo-600 mb-3">{featureIcons[i]}</div>
                <h3 className="font-semibold text-zinc-900 mb-1">{f.title}</h3>
                <p className="text-sm text-zinc-500 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Self-hosted ── */}
      <section className="border-t border-zinc-100">
        <div className="max-w-5xl mx-auto px-6 py-20 grid md:grid-cols-2 gap-16 items-center">
          <div>
            <h2 className="text-2xl font-bold text-zinc-900 mb-4">{t.selfTitle}</h2>
            <p className="text-zinc-500 leading-relaxed">{t.selfBody}</p>
          </div>
          <div className="space-y-2 font-mono text-sm">
            {t.archItems.map((item, i) => (
              <div key={item} className="flex items-center gap-3">
                <div className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border w-full ${i === 0 ? "border-indigo-200 bg-indigo-50 text-indigo-700" : i === t.archItems.length - 1 ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-zinc-200 bg-white text-zinc-600"}`}>
                  {i > 0 && <span className="text-zinc-300 text-xs">↳</span>}
                  {item}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="bg-zinc-50 border-t border-zinc-100">
        <div className="max-w-5xl mx-auto px-6 py-20">
          <h2 className="text-2xl font-bold text-zinc-900 mb-3">{t.ctaTitle}</h2>
          <p className="text-zinc-500 mb-8 max-w-xl leading-relaxed">{t.ctaBody}</p>
          <div className="flex flex-wrap gap-3">
            <a href={GITHUB} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 px-5 py-2.5 bg-zinc-900 text-white text-sm font-semibold rounded-lg hover:bg-zinc-700 transition-colors">
              <GithubIcon className="w-4 h-4" />{t.viewGithub}
            </a>
            <a href={`${GITHUB}/releases`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 px-5 py-2.5 border border-zinc-300 text-zinc-700 text-sm font-semibold rounded-lg hover:border-zinc-400 hover:bg-zinc-50 transition-colors">
              {t.releases} ↗
            </a>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-zinc-100 py-8 px-6">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-zinc-400">
          <span>© {new Date().getFullYear()} Agon. {t.footerLicense}.</span>
          <div className="flex items-center gap-5">
            <a href={GITHUB} target="_blank" rel="noopener noreferrer" className="hover:text-zinc-600 transition-colors">GitHub</a>
            <a href={`${GITHUB}/releases`} target="_blank" rel="noopener noreferrer" className="hover:text-zinc-600 transition-colors">Releases</a>
            <a href={`${GITHUB}/blob/main/LICENSE`} target="_blank" rel="noopener noreferrer" className="hover:text-zinc-600 transition-colors">License</a>
          </div>
        </div>
      </footer>

    </main>
  );
}
