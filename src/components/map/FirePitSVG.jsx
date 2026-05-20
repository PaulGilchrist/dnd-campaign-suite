import React from "react";

const FirePitSVG = React.forwardRef(({ id, className, ...rest }, ref) => (
    <g ref={ref} id={id} className={className} {...rest}>
        {/* Ambient glow */}
        <circle cx="18" cy="10" r="17" fill="#E87A20" opacity="0.1" />
        <circle cx="18" cy="10" r="14" fill="#E87A20" opacity="0.08" />
        <circle cx="18" cy="18" r="18" fill="#E87A20" opacity="0.03" />

        {/* Stone ring - minimal single circle */}
        <circle cx="18" cy="20" r="9" fill="#555" stroke="#333" strokeWidth="1.5" />

        {/* Embers at base of fire */}
        <ellipse cx="18" cy="20" rx="6" ry="2" fill="#2a1510" />
        <circle cx="14" cy="19" r="1.5" fill="#8B3A1A" opacity="0.6" />
        <circle cx="20" cy="18" r="1.2" fill="#A04020" opacity="0.5" />
        <circle cx="16" cy="21" r="1" fill="#8B3A1A" opacity="0.5" />
        <circle cx="22" cy="20" r="0.8" fill="#A04020" opacity="0.4" />

        {/* Outer flames - dark orange (#D35400) */}
        <path d="M 18 18 Q 10 13 14 4 Q 15 1 18 1 Q 21 1 22 4 Q 26 13 18 18 Z" fill="#D35400" opacity="0.85" />
        <path d="M 15 18 Q 8 14 10 6 Q 11 3 13 3 Q 14 4 14 8 Q 15 13 15 18 Z" fill="#D35400" opacity="0.8" />
        <path d="M 21 18 Q 28 14 26 6 Q 25 3 23 3 Q 22 4 22 8 Q 21 13 21 18 Z" fill="#D35400" opacity="0.8" />
        <path d="M 12 18 Q 5 15 7 9 Q 8 6 9 6 Q 10 7 10 10 Q 11 14 12 18 Z" fill="#D35400" opacity="0.65" />
        <path d="M 24 18 Q 31 15 29 9 Q 28 6 27 6 Q 26 7 26 10 Q 25 14 24 18 Z" fill="#D35400" opacity="0.65" />
        <path d="M 9 18 Q 4 16 6 12 Q 7 10 8 10 Q 8.5 11 8 13 Q 9 15 9 18 Z" fill="#D35400" opacity="0.45" />
        <path d="M 27 18 Q 32 16 30 12 Q 29 10 28 10 Q 27.5 11 28 13 Q 27 15 27 18 Z" fill="#D35400" opacity="0.45" />

        {/* Mid flames - orange (#E87A20) */}
        <path d="M 18 17 Q 12 12 15 5 Q 16 2.5 18 2.5 Q 20 2.5 21 5 Q 24 12 18 17 Z" fill="#E87A20" opacity="0.95" />
        <path d="M 15.5 17 Q 10 13 12 7 Q 12.5 4.5 14 4.5 Q 15 5.5 15 9 Q 15.5 13 15.5 17 Z" fill="#E87A20" opacity="0.85" />
        <path d="M 20.5 17 Q 26 13 24 7 Q 23.5 4.5 22 4.5 Q 21 5.5 21 9 Q 20.5 13 20.5 17 Z" fill="#E87A20" opacity="0.85" />
        <path d="M 12.5 17 Q 6 14 8 10 Q 9 7 10 7 Q 11 8 10.5 11 Q 11.5 14 12.5 17 Z" fill="#E87A20" opacity="0.6" />
        <path d="M 23.5 17 Q 30 14 28 10 Q 27 7 26 7 Q 25 8 25.5 11 Q 24.5 14 23.5 17 Z" fill="#E87A20" opacity="0.6" />

        {/* Inner flames - yellow (#F5D060) */}
        <path d="M 18 15 Q 14 11 16 6 Q 16.5 4 18 4 Q 19.5 4 20 6 Q 22 11 18 15 Z" fill="#F5D060" opacity="0.95" />
        <path d="M 16 15 Q 12 12 13 8 Q 13.5 6 14.5 6 Q 15 7 15 10 Q 15.5 12 16 15 Z" fill="#F5D060" opacity="0.8" />
        <path d="M 20 15 Q 24 12 23 8 Q 22.5 6 21.5 6 Q 21 7 21 10 Q 20.5 12 20 15 Z" fill="#F5D060" opacity="0.8" />

        {/* Core - white-hot */}
        <path d="M 18 13 Q 15.5 10 16.5 7 Q 17 5.5 18 5.5 Q 19 5.5 19.5 7 Q 20.5 10 18 13 Z" fill="#FFF8E0" opacity="0.9" />
        <ellipse cx="18" cy="9" rx="1.5" ry="2" fill="#FFFFFF" opacity="0.6" />

        {/* Floating sparks/embers in the air */}
        <circle cx="14" cy="3" r="0.8" fill="#F5D060" opacity="0.8" />
        <circle cx="22" cy="2" r="0.6" fill="#E87A20" opacity="0.7" />
        <circle cx="10" cy="7" r="0.7" fill="#F5D060" opacity="0.6" />
        <circle cx="25" cy="6" r="0.5" fill="#FFF8E0" opacity="0.7" />
        <circle cx="16" cy="1" r="0.6" fill="#E87A20" opacity="0.5" />
        <circle cx="20" cy="1.5" r="0.9" fill="#F5D060" opacity="0.6" />
        <circle cx="7" cy="10" r="0.5" fill="#E87A20" opacity="0.4" />
        <circle cx="29" cy="9" r="0.6" fill="#F5D060" opacity="0.4" />
        <circle cx="12" cy="5" r="0.4" fill="#FFF8E0" opacity="0.5" />
        <circle cx="24" cy="4" r="0.5" fill="#E87A20" opacity="0.5" />
    </g>
));

FirePitSVG.displayName = "FirePitSVG";

export default FirePitSVG;
