/**
 * Closed Tablor's device, drawn from the product document's front cover:
 * dark navy hard cover, gold corner protectors, gold cloche mark,
 * "Tablor's / TABLE ORDERING SYSTEM", faint geometric pattern in the lower
 * third. No screen is shown on the cover — the display and keypad live
 * inside the book (see <OpenDevice />).
 */
export function BookDeviceIllustration({ className }: { className?: string }) {
  const gold = "#d4af37";
  const corner = (d: string) => <path d={d} fill={gold} />;
  return (
    <svg
      viewBox="0 0 480 600"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role="img"
      aria-label="Tablor's book-shaped table ordering device, front cover"
    >
      <defs>
        <linearGradient id="tb-cover" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#1a2033" />
          <stop offset="100%" stopColor="#0b0f1a" />
        </linearGradient>
        <linearGradient id="tb-spine" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#05070d" />
          <stop offset="100%" stopColor="#1b2236" />
        </linearGradient>
        <linearGradient id="tb-gold" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f0d47a" />
          <stop offset="100%" stopColor="#b8933a" />
        </linearGradient>
        <linearGradient id="tb-fade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0b0f1a" stopOpacity="1" />
          <stop offset="100%" stopColor="#0b0f1a" stopOpacity="0" />
        </linearGradient>
        <pattern id="tb-geo" width="36" height="31" patternUnits="userSpaceOnUse">
          <path
            d="M18 0 36 10.3v20.7M18 0 0 10.3v20.7M18 20.6 0 10.3M18 20.6 36 10.3M18 20.6V31"
            stroke={gold}
            strokeOpacity="0.16"
            strokeWidth="0.8"
          />
        </pattern>
      </defs>

      <ellipse cx="250" cy="574" rx="180" ry="14" fill="#000" opacity="0.5" />

      {/* page block (cream edge) + spine */}
      <rect x="92" y="64" width="330" height="490" rx="6" fill="#cdb98f" />
      <rect x="54" y="48" width="34" height="508" rx="6" fill="url(#tb-spine)" />
      <line x1="72" y1="62" x2="72" y2="542" stroke={gold} strokeOpacity="0.5" />

      {/* front cover */}
      <rect x="84" y="44" width="340" height="500" rx="10" fill="url(#tb-cover)" stroke="#2b3450" />
      <rect x="94" y="54" width="320" height="480" rx="6" stroke={gold} strokeOpacity="0.55" />

      {/* geometric pattern, lower third, fading upward */}
      <rect x="95" y="360" width="318" height="173" fill="url(#tb-geo)" />
      <rect x="95" y="360" width="318" height="70" fill="url(#tb-fade)" />

      {/* gold corner protectors */}
      {corner("M344 44h80v80h-16V60H344z")}
      {corner("M344 544h80v-80h-16v64H344z")}

      {/* cloche mark */}
      <g transform="translate(254 172)" stroke="url(#tb-gold)" strokeWidth="4" strokeLinecap="round">
        <path d="M-44 8a44 40 0 0 1 88 0" fill="none" />
        <path d="M-28 6a28 26 0 0 1 20-24" strokeWidth="2" opacity="0.7" fill="none" />
        <line x1="-56" y1="8" x2="56" y2="8" />
        <line x1="0" y1="-34" x2="0" y2="-46" />
        <circle cx="0" cy="-50" r="5" fill="url(#tb-gold)" stroke="none" />
        <path d="M-12 16c4 8 20 8 24 0" strokeWidth="3" fill="none" />
      </g>

      {/* wordmark */}
      <text
        x="254"
        y="278"
        textAnchor="middle"
        fontFamily="ui-serif, Georgia, 'Times New Roman', serif"
        fontSize="60"
        fontWeight="700"
        fill="url(#tb-gold)"
      >
        Tablor&apos;s
      </text>
      <text
        x="254"
        y="316"
        textAnchor="middle"
        fontFamily="ui-sans-serif, system-ui, sans-serif"
        fontSize="15"
        letterSpacing="3.2"
        fill="#f2f3ec"
      >
        TABLE ORDERING SYSTEM
      </text>
    </svg>
  );
}
