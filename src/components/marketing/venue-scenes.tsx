import type { ReactNode } from "react";

/**
 * Six venue scenes, one product. Each scene has its own environmental
 * light (wall, glow, table material) on the shared olive-black base; the
 * Tablor's book is identical in every scene — same size, cover, gold
 * corners. Layers move a few units on hover via the parent `group`.
 */
const gold = "#d4af37";
const MOVE = "transition-transform duration-700 ease-out motion-reduce:transform-none motion-reduce:transition-none";

type Theme = {
  wall: [string, string]; // top, bottom
  glow: string; glowAt: [number, number]; glowR: number;
  table: [string, string];
  rim: string; // table edge highlight
};

function Book() {
  return (
    <g transform="scale(1.25)">
      <ellipse cx="10" cy="1" rx="46" ry="7" fill="url(#sh)" />
      <rect x="28" y="-78" width="6" height="76" rx="1" fill="#bfae86" />
      <rect x="-31" y="-80" width="4" height="78" rx="1" fill="#0a0d16" />
      <rect x="-28" y="-80" width="56" height="78" rx="2" fill="url(#cov)" stroke="#2b3450" strokeWidth=".6" />
      <rect x="-24" y="-76" width="48" height="70" rx="1" fill="none" stroke={gold} strokeOpacity=".45" strokeWidth=".5" />
      <path d="M14-80h14v14h-3v-11H14zM14-2h14v-14h-3v11H14z" fill={gold} />
      <g transform="translate(0 -50)" stroke={gold} strokeWidth="1.6" fill="none" strokeLinecap="round">
        <path d="M-12 0a12 11 0 0 1 24 0M-15 0h30" /><circle cx="0" cy="-14" r="1.4" fill={gold} stroke="none" />
      </g>
      <text x="0" y="-30" textAnchor="middle" fontFamily="ui-serif, Georgia, serif" fontSize="9.5" fontWeight="700" fill={gold}>Tablor&apos;s</text>
      <text x="0" y="-23" textAnchor="middle" fontFamily="ui-sans-serif, system-ui, sans-serif" fontSize="3.3" letterSpacing=".7" fill="#f2f3ec">TABLE ORDERING SYSTEM</text>
      <rect x="-28" y="-80" width="56" height="78" rx="2" fill="url(#sheen)" />
    </g>
  );
}

function Stage({ k, t, back, props }: { k: string; t: Theme; back: ReactNode; props: ReactNode }) {
  const u = (n: string) => `url(#${n}-${k})`;
  return (
    <svg viewBox="0 0 400 260" className="h-full w-full" preserveAspectRatio="xMidYMid slice" role="img"
      aria-label={`A Tablor's table ordering device on a table in a ${k.replace(/s$/, "").toLowerCase()} setting`}>
      <defs>
        <linearGradient id={`wall-${k}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={t.wall[0]} /><stop offset="1" stopColor={t.wall[1]} /></linearGradient>
        <linearGradient id={`tbl-${k}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={t.table[0]} /><stop offset="1" stopColor={t.table[1]} /></linearGradient>
        <radialGradient id={`glow-${k}`} cx={t.glowAt[0] / 400} cy={t.glowAt[1] / 260} r={t.glowR}><stop offset="0" stopColor={t.glow} stopOpacity=".5" /><stop offset="1" stopColor={t.glow} stopOpacity="0" /></radialGradient>
        <radialGradient id={`vig-${k}`} cx=".5" cy=".5" r=".75"><stop offset=".55" stopColor="#0d0e0b" stopOpacity="0" /><stop offset="1" stopColor="#0d0e0b" stopOpacity=".7" /></radialGradient>
        <linearGradient id="cov" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#1c2338" /><stop offset="1" stopColor="#0b0f1a" /></linearGradient>
        <linearGradient id="sheen" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#fff" stopOpacity=".09" /><stop offset=".5" stopColor="#fff" stopOpacity="0" /></linearGradient>
        <radialGradient id="sh"><stop offset="0" stopColor="#000" stopOpacity=".7" /><stop offset="1" stopColor="#000" stopOpacity="0" /></radialGradient>
      </defs>
      <rect width="400" height="260" fill={u("wall")} />
      <g className={`${MOVE} group-data-[lead=true]:-translate-x-[4px]`}>{back}</g>
      <rect width="400" height="260" fill={u("glow")} className="opacity-80 transition-opacity duration-700 group-data-[lead=true]:opacity-100 motion-reduce:transition-none" />
      <rect y="178" width="400" height="82" fill={u("tbl")} />
      <rect y="178" width="400" height="1.5" fill={t.rim} opacity=".7" />
      <g className={`${MOVE} group-data-[lead=true]::translate-x-[2px]`}>{props}</g>
      <g className={`${MOVE} group-data-[lead=true]:-translate-y-[3px] group-data-[lead=true]:translate-x-[2px]`}>
        <g transform="translate(262 208)"><Book /></g>
      </g>
      <rect width="400" height="260" fill={u("vig")} />
    </svg>
  );
}

const Plate = ({ x, y, c = "#e9e2d0" }: { x: number; y: number; c?: string }) => (
  <g><ellipse cx={x} cy={y + 3} rx="30" ry="6" fill="#000" opacity=".4" /><ellipse cx={x} cy={y} rx="28" ry="6.5" fill={c} /><ellipse cx={x} cy={y - .5} rx="17" ry="3.8" fill="#000" opacity=".12" /></g>
);
const Candle = ({ x, y, f }: { x: number; y: number; f: string }) => (
  <g><rect x={x - 2.5} y={y - 16} width="5" height="16" fill="#e9e2d0" opacity=".9" /><ellipse cx={x} cy={y - 20} rx="2.4" ry="4.4" fill={f} /><circle cx={x} cy={y - 19} r="9" fill={f} opacity=".16" /></g>
);
const Glass = ({ x, y, c }: { x: number; y: number; c: string }) => (
  <g><path d={`M${x - 8} ${y - 26}h16l-2 14a6 6 0 0 1-12 0z`} fill={c} opacity=".35" stroke="#f2f3ec" strokeOpacity=".4" strokeWidth=".6" /><path d={`M${x} ${y - 8}v8m-6 0h12`} stroke="#f2f3ec" strokeOpacity=".5" /></g>
);
const Cup = ({ x, y, c }: { x: number; y: number; c: string }) => (
  <g><ellipse cx={x} cy={y + 2} rx="16" ry="3.5" fill="#000" opacity=".4" /><path d={`M${x - 12} ${y - 14}h24l-3 14a9 4 0 0 1-18 0z`} fill={c} /><ellipse cx={x} cy={y - 14} rx="12" ry="2.6" fill="#2a1a10" /><path d={`M${x + 12} ${y - 11}a5 5 0 0 1 0 9`} stroke={c} strokeWidth="2" fill="none" /></g>
);

const scenes: Record<string, { t: Theme; back: ReactNode; props: ReactNode }> = {
  Restaurants: {
    t: { wall: ["#20150a", "#120d07"], glow: "#e8a640", glowAt: [200, 30], glowR: 0.7, table: ["#4a3218", "#1b1209"], rim: "#c98a3a" },
    back: (<>
      {[90, 210, 330].map((x, i) => (<g key={x}><line x1={x} y1="0" x2={x} y2={26 + (i % 2) * 8} stroke="#3a2a14" /><path d={`M${x - 15} ${46 + (i % 2) * 8}a15 14 0 0 1 30 0z`} fill="#2b1d0e" stroke="#5a4020" strokeWidth=".6" /><path d={`M${x - 14} ${47 + (i % 2) * 8}l-24 70h76l-24-70z`} fill="#e8a640" opacity=".07" /></g>))}
      {[[40, 100, 9], [70, 122, 6], [150, 96, 7], [330, 108, 10], [365, 130, 6]].map(([x, y, r], i) => <circle key={i} cx={x} cy={y} r={r} fill="#e8a640" opacity=".18" />)}
      <path d="M0 150h400M0 164h400" stroke="#3a2a14" strokeWidth=".8" />
    </>),
    props: (<><Plate x={90} y={200} /><Glass x={150} y={204} c="#e8a640" /><Candle x={332} y={204} f="#ffcf70" /><path d="M0 232c100-6 250 6 400-2M0 246c120 6 260-4 400 2" stroke="#000" strokeOpacity=".25" fill="none" /></>),
  },
  Hotels: {
    t: { wall: ["#1c1912", "#11100c"], glow: "#e4d3ab", glowAt: [110, 90], glowR: 0.6, table: ["#34302a", "#181611"], rim: "#cbb98d" },
    back: (<>
      <path d="M50 178V72a58 58 0 0 1 116 0v106z" fill="#e4d3ab" opacity=".16" /><path d="M50 178V72a58 58 0 0 1 116 0v106z" fill="none" stroke="#5c5341" />
      <path d="M108 14v164M50 100h116" stroke="#5c5341" strokeWidth=".8" />
      <path d="M20 0h30v178H20zM166 0h30v178h-30z" fill="#2a261d" /><path d="M28 0v178M38 0v178M174 0v178M184 0v178" stroke="#3a3528" />
      <rect x="290" y="118" width="96" height="60" rx="12" fill="#3d362a" /><rect x="282" y="140" width="16" height="44" rx="7" fill="#4a4233" />
    </>),
    props: (<><Cup x={60} y={204} c="#e9e2d0" /><g><path d="M136 206c-8-14-6-30 2-38 8 8 10 24 2 38z" fill="#4a5a44" opacity=".7" /><path d="M138 206v-42" stroke="#b9a87c" /><ellipse cx="138" cy="206" rx="9" ry="2.6" fill="#000" opacity=".4" /></g></>),
  },
  Cafes: {
    t: { wall: ["#1f140d", "#120c08"], glow: "#d08a55", glowAt: [120, 70], glowR: 0.65, table: ["#3f2a1a", "#1a110a"], rim: "#b8794a" },
    back: (<>
      <rect x="30" y="56" width="170" height="122" fill="#d08a55" opacity=".13" stroke="#4a3220" />
      <path d="M22 30h186l-12 26H34z" fill="#8d4a33" /><path d="M64 30l-6 26M106 30l-2 26M148 30l2 26M190 30l6 26" stroke="#c98a6a" strokeOpacity=".5" />
      <path d="M232 70h140M232 104h140" stroke="#4a3220" strokeWidth="2" />
      {[246, 276, 306, 340].map((x, i) => <rect key={x} x={x} y={i % 2 ? 84 : 50} width="18" height={i % 2 ? 20 : 20} rx="3" fill={i % 2 ? "#b9814f" : "#8d4a33"} opacity=".75" />)}
      <path d="M300 0v26" stroke="#4a3220" /><path d="M284 26h32l-6 18h-20z" fill="#3a4a2c" />
    </>),
    props: (<><Cup x={70} y={204} c="#e6c9a0" /><Cup x={138} y={214} c="#b9814f" /><path d="M64 178c-6-10 6-14 0-24M78 178c-6-10 6-14 0-24" stroke="#f2f3ec" strokeOpacity=".25" fill="none" strokeLinecap="round" /></>),
  },
  Theatres: {
    t: { wall: ["#1a0a0d", "#0e0708"], glow: "#a8283a", glowAt: [200, 20], glowR: 0.8, table: ["#22110f", "#0f0808"], rim: "#8a2a35" },
    back: (<>
      <path d="M0 0h400v14a200 26 0 0 1-400 0z" fill="#4a1620" />
      {[0, 44, 88, 132, 268, 312, 356].map((x) => <path key={x} d={`M${x} 0h44v170h-44z`} fill={(x / 44) % 2 ? "#3a0f18" : "#4d1822"} opacity=".9" />)}
      <path d="M170 0h60l40 178H130z" fill="#e8b0a8" opacity=".06" />
      {[60, 130, 200, 270, 340].map((x) => <path key={x} d={`M${x - 24} 178v-28a24 22 0 0 1 48 0v28z`} fill="#1c0a0d" stroke="#5a1a24" strokeWidth=".6" />)}
    </>),
    props: (<><Glass x={80} y={204} c="#a8283a" /><ellipse cx="262" cy="211" rx="70" ry="8" fill="#a8283a" opacity=".12" /></>),
  },
  Lounges: {
    t: { wall: ["#151a0d", "#0d1009"], glow: "#e0a24a", glowAt: [350, 60], glowR: 0.55, table: ["#262e16", "#111509"], rim: "#6d7a3c" },
    back: (<>
      <rect x="24" y="112" width="200" height="66" rx="14" fill="#2f3a1a" /><rect x="24" y="84" width="200" height="40" rx="14" fill="#38451f" />
      {[70, 130, 190].map((x) => <path key={x} d={`M${x} 90v34`} stroke="#1c2410" strokeWidth="1.5" />)}
      <rect x="250" y="60" width="90" height="4" fill="#3a4620" /><rect x="250" y="88" width="90" height="4" fill="#3a4620" />
      {[262, 284, 306, 326].map((x, i) => <rect key={x} x={x} y={i % 2 ? 66 : 42} width="12" height={i % 2 ? 22 : 18} rx="2" fill="#6d7a3c" opacity=".5" />)}
      <line x1="356" y1="70" x2="356" y2="178" stroke="#4a5a28" strokeWidth="2" /><path d="M340 70h32l-8 24h-16z" fill="#e0a24a" opacity=".7" />
    </>),
    props: (<><Glass x={82} y={206} c="#6d7a3c" /><Candle x={140} y={206} f="#ffcf70" /></>),
  },
  Banquets: {
    t: { wall: ["#2a2416", "#17140d"], glow: "#f0dfaa", glowAt: [200, 30], glowR: 0.9, table: ["#d9cdaa", "#6d6446"], rim: "#f0e2b8" },
    back: (<>
      <path d="M0 0h60v178H0zM340 0h60v178h-60z" fill="#3a3220" /><path d="M14 0v178M30 0v178M370 0v178M386 0v178" stroke="#4a4028" />
      <g stroke="#cbb98d" fill="none" strokeWidth=".8"><path d="M200 0v20M176 28h48l10 12H166z" /><path d="M170 44l-10 40M200 44v50M230 44l10 40" strokeOpacity=".5" /></g>
      {[176, 190, 200, 210, 224].map((x) => <circle key={x} cx={x} cy={x % 2 ? 46 : 42} r="2.6" fill="#f0dfaa" />)}
      <path d="M200 40l-90 120M200 40l90 120" stroke="#f0dfaa" opacity=".07" strokeWidth="24" />
    </>),
    props: (<><Glass x={70} y={204} c="#f0dfaa" /><Glass x={100} y={210} c="#f0dfaa" /><g><path d="M150 206c-4-10-14-12-18-24 8 0 16 6 18 24 2-18 10-24 18-24-4 12-14 14-18 24z" fill="#e9e2d0" opacity=".8" /><rect x="148" y="204" width="4" height="8" fill="#5a6a3c" /></g></>),
  },
};

export function VenueScene({ name }: { name: string }) {
  const s = scenes[name];
  return <Stage k={name} t={s.t} back={s.back} props={s.props} />;
}
