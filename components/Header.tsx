// App bar shown on every screen: MoneyPilot wordmark on the left, profile avatar on the right.
function Logo() {
  return (
    <span className="flex items-center gap-1.5" aria-label="MoneyPilot">
      <svg width="34" height="26" viewBox="0 0 34 26" aria-hidden>
        <g fill="var(--accent)">
          <rect x="0" y="5" width="17" height="3.2" rx="1.6" />
          <rect x="5" y="11.4" width="12" height="3.2" rx="1.6" />
          <rect x="10" y="17.8" width="7" height="3.2" rx="1.6" />
        </g>
        <text x="17" y="22" fontSize="24" fontWeight="800" fill="var(--foreground)">
          $
        </text>
      </svg>
      <span className="text-xl font-extrabold tracking-tight">
        Money<span className="text-accent">Pilot</span>
      </span>
    </span>
  );
}

function ProfileAvatar() {
  return (
    <span
      role="img"
      aria-label="Your profile"
      className="flex h-10 w-10 items-center justify-center rounded-full bg-accent text-white ring-2 ring-white"
    >
      <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
        <circle cx="12" cy="8.5" r="4" />
        <path d="M4 20.5c0-4 3.6-6.5 8-6.5s8 2.500 8 6.500z" />
      </svg>
    </span>
  );
}

export default function Header() {
  return (
    <header className="border-b border-foreground/10">
      <div className="mx-auto flex w-full max-w-md items-center justify-between px-5 py-3 md:max-w-4xl md:px-6">
        <Logo />
        <ProfileAvatar />
      </div>
    </header>
  );
}
