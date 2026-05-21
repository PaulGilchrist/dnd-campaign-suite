import React from "react";

const CampSVG = React.forwardRef(({ id, className, ...rest }, ref) => (
    <g ref={ref} id={id} className={className} {...rest}>
        {/* Ground shadow */}
        <ellipse cx="18" cy="28" rx="16" ry="5" fill="#333" opacity="0.1" />

        {/* Tent - back/taller wall */}
        <polygon points="4,26 12,8 20,26" fill="#B89870" stroke="#8B7355" strokeWidth="0.6" strokeLinejoin="round" />
        {/* Tent - front/opening side */}
        <polygon points="6,26 12,12 18,26" fill="#C4A882" stroke="#8B7355" strokeWidth="0.5" strokeLinejoin="round" />
        {/* Tent opening flap (dark entrance) */}
        <polygon points="10,26 12,16 14,26" fill="#5C4030" opacity="0.6" />
        {/* Tent ridge line / pole */}
        <line x1="12" y1="8" x2="12" y2="26" stroke="#6B5340" strokeWidth="0.5" />
        {/* Tent roof highlight */}
        <polygon points="8,18 12,9 16,18" fill="#D4B88A" opacity="0.25" />

        {/* Tent rope - left */}
        <line x1="12" y1="14" x2="3" y2="27" stroke="#8B7355" strokeWidth="0.3" opacity="0.6" />
        {/* Tent rope - right */}
        <line x1="12" y1="14" x2="21" y2="27" stroke="#8B7355" strokeWidth="0.3" opacity="0.6" />
        {/* Rope pegs */}
        <circle cx="3" cy="27" r="0.6" fill="#6B5340" />
        <circle cx="21" cy="27" r="0.6" fill="#6B5340" />

        {/* Campfire - stone ring */}
        <circle cx="27" cy="24" r="5" fill="#555" stroke="#444" strokeWidth="0.8" />
        <circle cx="27" cy="24" r="4" fill="#2a1510" />

        {/* Campfire - logs */}
        <line x1="25" y1="25" x2="29" y2="22" stroke="#5C3317" strokeWidth="1.2" strokeLinecap="round" />
        <line x1="25" y1="23" x2="29" y2="26" stroke="#5C3317" strokeWidth="1" strokeLinecap="round" />

        {/* Campfire - outer flames (dark orange) */}
        <path d="M 27 24 Q 23 22 24 18 Q 25 16 27 16 Q 29 16 30 18 Q 31 22 27 24 Z" fill="#D35400" opacity="0.85" />
        <path d="M 25 24 Q 22 23 23 20 Q 23.5 18 25 18 Q 26 19 25 21 Z" fill="#D35400" opacity="0.7" />
        <path d="M 29 24 Q 32 23 31 20 Q 30.5 18 29 18 Q 28 19 29 21 Z" fill="#D35400" opacity="0.7" />

        {/* Campfire - inner flames (orange) */}
        <path d="M 27 23 Q 24.5 21 25.5 18 Q 26 17 27 17 Q 28 17 28.5 18 Q 29.5 21 27 23 Z" fill="#E87A20" opacity="0.95" />

        {/* Campfire - core (yellow) */}
        <path d="M 27 22 Q 25.5 20.5 26 19 Q 26.5 18 27 18 Q 27.5 18 28 19 Q 28.5 20.5 27 22 Z" fill="#F5D060" opacity="0.9" />

        {/* Sparks */}
        <circle cx="24" cy="15" r="0.6" fill="#F5D060" opacity="0.7" />
        <circle cx="29" cy="14" r="0.5" fill="#E87A20" opacity="0.6" />
        <circle cx="26" cy="13" r="0.4" fill="#FFF8E0" opacity="0.5" />
        <circle cx="31" cy="17" r="0.5" fill="#F5D060" opacity="0.5" />

        {/* Smoke wisps from fire */}
        <path d="M 27 14 Q 28 11 26 8 Q 25 5 27 2" fill="none" stroke="#888" strokeWidth="0.5" opacity="0.2" strokeLinecap="round" />
        <path d="M 28 15 Q 30 12 29 9 Q 28 6 30 3" fill="none" stroke="#888" strokeWidth="0.4" opacity="0.15" strokeLinecap="round" />
    </g>
));

CampSVG.displayName = "CampSVG";

export default CampSVG;
