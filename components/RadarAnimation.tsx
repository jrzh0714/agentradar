export function RadarAnimation() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 select-none overflow-hidden">
      <div
        className="absolute right-[-60px] top-1/2 hidden -translate-y-1/2 sm:block"
        style={{ opacity: 'var(--radar-opacity)' }}
      >
        <svg width="460" height="460" viewBox="-230 -230 460 460">
          <defs>
            <radialGradient id="sweepTrail" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="var(--radar-color)" stopOpacity="0.7" />
              <stop offset="100%" stopColor="var(--radar-color)" stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* Concentric rings */}
          {[55, 100, 150, 200].map((r) => (
            <circle key={r} r={r} fill="none" stroke="var(--radar-color)" strokeWidth="0.6" strokeOpacity="1" />
          ))}

          {/* Cross hairs */}
          <line x1="-230" y1="0" x2="230" y2="0" stroke="var(--radar-color)" strokeWidth="0.4" strokeOpacity="0.6" />
          <line x1="0" y1="-230" x2="0" y2="230" stroke="var(--radar-color)" strokeWidth="0.4" strokeOpacity="0.6" />

          {/* Diagonal tick marks at 45° */}
          {[55, 100, 150, 200].map((r) => (
            <g key={`tick-${r}`}>
              <line
                x1={r * 0.707 - 3} y1={-r * 0.707 - 3}
                x2={r * 0.707 + 3} y2={-r * 0.707 + 3}
                stroke="var(--radar-color)" strokeWidth="0.5" strokeOpacity="0.5"
              />
            </g>
          ))}

          {/* Rotating sweep group — SMIL animation, no JS needed */}
          <g>
            <animateTransform
              attributeName="transform"
              type="rotate"
              from="0 0 0"
              to="360 0 0"
              dur="6s"
              repeatCount="indefinite"
            />
            {/* Trailing sector ~50° */}
            <path
              d="M0,0 L0,-210 A210,210 0 0,1 160.7,-134.2 Z"
              fill="url(#sweepTrail)"
              opacity="0.9"
            />
            {/* Main sweep line */}
            <line
              x1="0" y1="0" x2="0" y2="-210"
              stroke="var(--radar-color)" strokeWidth="1.2" strokeLinecap="round" strokeOpacity="0.95"
            />
          </g>

          {/* Blip dots — appear when sweep passes over them */}
          <circle cx="85" cy="-95" r="2.5" fill="var(--radar-color)">
            <animate
              attributeName="opacity"
              values="0;0;0.9;0.4;0"
              keyTimes="0;0.58;0.65;0.80;1"
              dur="6s"
              repeatCount="indefinite"
            />
            <animate
              attributeName="r"
              values="1;1;2.5;2;1"
              keyTimes="0;0.58;0.65;0.80;1"
              dur="6s"
              repeatCount="indefinite"
            />
          </circle>
          <circle cx="-135" cy="55" r="2" fill="var(--radar-color)">
            <animate
              attributeName="opacity"
              values="0;0;0.9;0.4;0"
              keyTimes="0;0.27;0.34;0.50;0.6"
              dur="6s"
              repeatCount="indefinite"
              begin="2s"
            />
          </circle>
          <circle cx="160" cy="35" r="3" fill="var(--radar-color)">
            <animate
              attributeName="opacity"
              values="0;0;0.9;0.4;0"
              keyTimes="0;0.80;0.85;0.95;1"
              dur="6s"
              repeatCount="indefinite"
              begin="4.8s"
            />
          </circle>
          <circle cx="-60" cy="-175" r="2" fill="var(--radar-color)">
            <animate
              attributeName="opacity"
              values="0;0;0.9;0.3;0"
              keyTimes="0;0.48;0.54;0.68;0.8"
              dur="6s"
              repeatCount="indefinite"
              begin="1s"
            />
          </circle>
        </svg>
      </div>
    </div>
  )
}
