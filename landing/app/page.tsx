const GITHUB = "https://github.com/edocasciotta/Agon";
const RELEASES = `${GITHUB}/releases/latest`;

// ─── Icons ────────────────────────────────────────────────────────────────────

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
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="4 17 10 11 4 5" />
      <line x1="12" y1="19" x2="20" y2="19" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

function UsersIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function TicketIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 5v2M15 11v2M15 17v2M5 5h14a2 2 0 0 1 2 2v3a2 2 0 0 0 0 4v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-3a2 2 0 0 0 0-4V7a2 2 0 0 1 2-2z" />
    </svg>
  );
}

function CreditCardIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <rect x="1" y="4" width="22" height="16" rx="2" />
      <line x1="1" y1="10" x2="23" y2="10" />
    </svg>
  );
}

function ChartIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  );
}

function PhoneIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <rect x="5" y="2" width="14" height="20" rx="2" />
      <line x1="12" y1="18" x2="12.01" y2="18" strokeWidth={2} />
    </svg>
  );
}

// ─── Data ─────────────────────────────────────────────────────────────────────

const features = [
  {
    title: "Class Scheduling",
    desc: "Calendar view, recurring classes, custom class types, and per-class booking windows.",
    Icon: CalendarIcon,
  },
  {
    title: "Client Management",
    desc: "Full client profiles, booking history, membership tracking, and GDPR-compliant data tools.",
    Icon: UsersIcon,
  },
  {
    title: "Booking Engine",
    desc: "Automated validation, waitlist management, and credit deduction with QR-code check-in.",
    Icon: TicketIcon,
  },
  {
    title: "Memberships & Payments",
    desc: "Flexible membership types with Stripe integration and complete payment history.",
    Icon: CreditCardIcon,
  },
  {
    title: "Reports",
    desc: "Attendance, revenue, and retention analytics with one-click CSV export.",
    Icon: ChartIcon,
  },
  {
    title: "Mobile App",
    desc: "iOS and Android app for clients to book, check in, and manage their account.",
    Icon: PhoneIcon,
  },
];

const platforms = [
  {
    name: "macOS",
    subtitle: "macOS 12 or later",
    Icon: AppleIcon,
    href: RELEASES,
  },
  {
    name: "Windows",
    subtitle: "Windows 10 or later",
    Icon: WindowsIcon,
    href: RELEASES,
  },
  {
    name: "Linux",
    subtitle: "Ubuntu 20.04+  ·  AppImage",
    Icon: TerminalIcon,
    href: RELEASES,
  },
];

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Home() {
  return (
    <main className="min-h-screen bg-zinc-950 text-white">

      {/* ── Nav ── */}
      <nav className="fixed top-0 inset-x-0 z-50 border-b border-zinc-800/50 bg-zinc-950/80 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <span className="font-semibold tracking-tight text-white">Agon</span>
          <a
            href={GITHUB}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-sm text-zinc-400 hover:text-white transition-colors"
          >
            <GithubIcon className="w-4 h-4" />
            GitHub
          </a>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="relative min-h-screen flex flex-col items-center justify-center px-6 pt-14 text-center overflow-hidden">
        <div className="absolute inset-0 grid-bg" />
        <div className="absolute inset-0 hero-glow" />

        <div className="relative z-10 max-w-4xl mx-auto">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-zinc-700/60 bg-zinc-900/60 text-zinc-400 text-xs font-medium mb-8 backdrop-blur-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
            Open Source · MIT License · Free Forever
          </div>

          {/* Heading */}
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight leading-[1.05] mb-6">
            <span className="text-white">Fitness studio management</span>
            <br />
            <span className="text-zinc-500">that respects your data.</span>
          </h1>

          {/* Sub */}
          <p className="text-lg md:text-xl text-zinc-400 max-w-2xl mx-auto leading-relaxed mb-12">
            Complete platform — class scheduling, memberships, payments, check-ins, and a mobile app.
            <br className="hidden sm:block" />
            <span className="text-zinc-200 font-medium">
              {" "}No subscriptions. No data sharing. Runs on your machine.
            </span>
          </p>

          {/* Download buttons */}
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            {platforms.map(({ name, subtitle, Icon, href }) => (
              <a
                key={name}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-center gap-4 px-6 py-4 rounded-xl border border-zinc-700/60 bg-zinc-900/60 hover:border-indigo-500/60 hover:bg-zinc-800/80 transition-all backdrop-blur-sm text-left min-w-[200px]"
              >
                <Icon className="w-7 h-7 text-zinc-400 group-hover:text-indigo-400 transition-colors flex-shrink-0" />
                <div>
                  <div className="font-semibold text-white text-sm">Download for {name}</div>
                  <div className="text-xs text-zinc-500 mt-0.5">{subtitle}</div>
                </div>
              </a>
            ))}
          </div>

          {/* Source link */}
          <p className="mt-7 text-sm text-zinc-600">
            or{" "}
            <a
              href={GITHUB}
              target="_blank"
              rel="noopener noreferrer"
              className="text-zinc-500 hover:text-zinc-300 underline underline-offset-2 transition-colors"
            >
              build from source on GitHub ↗
            </a>
          </p>
        </div>

        {/* Bottom fade */}
        <div className="absolute bottom-0 inset-x-0 h-32 bg-gradient-to-t from-zinc-950 to-transparent" />
      </section>

      {/* ── Features ── */}
      <section className="relative py-28 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Everything your studio needs
            </h2>
            <p className="text-zinc-400 max-w-xl mx-auto">
              From first booking to monthly reports — all in one platform, all on your hardware.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {features.map(({ title, desc, Icon }) => (
              <div
                key={title}
                className="p-6 rounded-xl border border-zinc-800/60 bg-zinc-900/40 hover:border-zinc-700 hover:bg-zinc-900/70 transition-all"
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400">
                    <Icon />
                  </div>
                  <h3 className="font-semibold text-white text-sm">{title}</h3>
                </div>
                <p className="text-sm text-zinc-500 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Self-hosted ── */}
      <section className="py-28 px-6 border-t border-zinc-800/40">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-zinc-700/60 bg-zinc-900/60 text-zinc-400 text-xs font-medium mb-8">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            100% Self-Hosted
          </div>

          <h2 className="text-3xl md:text-5xl font-bold text-white mb-6">
            Your data stays on your machine.
          </h2>
          <p className="text-zinc-400 text-lg max-w-2xl mx-auto mb-14 leading-relaxed">
            Agon runs entirely on your hardware. The SQLite database never leaves your machine.
            Clients connect via a secure tunnel — no data ever touches our servers.
          </p>

          {/* Architecture */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-3 font-mono text-sm flex-wrap">
            {[
              { label: "Desktop App", color: "border-indigo-500/40 bg-indigo-500/10 text-indigo-300" },
              { label: "→", color: "text-zinc-600 hidden sm:block", arrow: true },
              { label: "Local Backend + SQLite", color: "border-zinc-700 bg-zinc-900 text-zinc-300" },
              { label: "→", color: "text-zinc-600 hidden sm:block", arrow: true },
              { label: "Secure Tunnel", color: "border-zinc-700 bg-zinc-900 text-zinc-300" },
              { label: "→", color: "text-zinc-600 hidden sm:block", arrow: true },
              { label: "Mobile App", color: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300" },
            ].map((item, i) =>
              item.arrow ? (
                <span key={i} className={item.color}>{item.label}</span>
              ) : (
                <div key={i} className={`px-4 py-3 rounded-lg border ${item.color}`}>
                  {item.label}
                </div>
              )
            )}
          </div>
        </div>
      </section>

      {/* ── Open source CTA ── */}
      <section className="py-28 px-6 border-t border-zinc-800/40">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Built in the open.
          </h2>
          <p className="text-zinc-400 text-lg mb-10 leading-relaxed">
            Agon is free and open-source under the MIT license. Inspect the code,
            contribute features, or deploy on your own terms. No lock-in, ever.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a
              href={GITHUB}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-white text-zinc-900 font-semibold hover:bg-zinc-100 transition-colors"
            >
              <GithubIcon className="w-4 h-4" />
              View on GitHub
            </a>
            <a
              href={`${GITHUB}/releases`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl border border-zinc-700 text-white font-semibold hover:border-zinc-500 hover:bg-zinc-900 transition-colors"
            >
              Release Notes ↗
            </a>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-zinc-800/40 py-10 px-6">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-zinc-600">
          <span>© {new Date().getFullYear()} Agon. MIT License.</span>
          <div className="flex items-center gap-6">
            <a href={GITHUB} target="_blank" rel="noopener noreferrer" className="hover:text-zinc-400 transition-colors">GitHub</a>
            <a href={`${GITHUB}/releases`} target="_blank" rel="noopener noreferrer" className="hover:text-zinc-400 transition-colors">Releases</a>
            <a href={`${GITHUB}/blob/main/LICENSE`} target="_blank" rel="noopener noreferrer" className="hover:text-zinc-400 transition-colors">License</a>
          </div>
        </div>
      </footer>

    </main>
  );
}
