import React from "react";

const AltarSVG = React.forwardRef(({ id, className, ...rest }, ref) => (
    <g ref={ref} id={id} className={className} {...rest}>
        {/* Main altar block - tapered trapezoid */}
        <path
            d="M 14 28 L 10 8 L 62 8 L 58 28 Z"
            fill="#888"
            stroke="#666"
            strokeWidth="0.8"
        />
        {/* Top surface */}
        <rect
            x="10"
            y="8"
            width="52"
            height="4"
            rx="0.5"
            fill="#999"
            stroke="#777"
            strokeWidth="0.5"
        />
        {/* Front face */}
        <rect x="12" y="12" width="48" height="16" fill="#777" />
        {/* Left side shading (darker) */}
        <path
            d="M 14 28 L 10 8 L 12 8 L 16 28 Z"
            fill="#666"
            opacity="0.5"
        />
        {/* Top surface highlight */}
        <rect x="12" y="9" width="48" height="1.5" fill="#AAA" opacity="0.5" />
        {/* Base molding */}
        <rect
            x="11"
            y="26"
            width="50"
            height="3"
            fill="#666"
            stroke="#555"
            strokeWidth="0.4"
            rx="0.5"
        />
        {/* Rune marks on front face */}
        <path
            d="M 18 16 L 22 24 M 22 24 L 20 18 M 20 18 L 24 20"
            fill="none"
            stroke="#555"
            strokeWidth="0.6"
        />
        <path
            d="M 28 16 L 32 24 M 32 24 L 30 18 M 30 18 L 34 20"
            fill="none"
            stroke="#555"
            strokeWidth="0.6"
        />
        <path
            d="M 38 16 L 42 24 M 42 24 L 40 18 M 40 18 L 44 20"
            fill="none"
            stroke="#555"
            strokeWidth="0.6"
        />
        <path
            d="M 48 16 L 52 24 M 52 24 L 50 18 M 50 18 L 54 20"
            fill="none"
            stroke="#555"
            strokeWidth="0.6"
        />
        {/* Central decorative symbol */}
        <circle cx="36" cy="18" r="2" fill="none" stroke="#555" strokeWidth="0.5" />
        <circle cx="36" cy="18" r="0.8" fill="#555" />

        {/* Flame on top */}
        <path
            d="M 36 8 Q 32 1 36 -1 Q 40 1 36 8 Z"
            fill="#E67E22"
            stroke="#F1C40F"
            strokeWidth="0.3"
        />
        <path
            d="M 36 8 Q 34 3 36 1 Q 38 3 36 8 Z"
            fill="#F1C40F"
        />
        {/* Glow effect */}
        <ellipse cx="36" cy="3" rx="8" ry="5" fill="#E67E22" opacity="0.15" />
    </g>
));

AltarSVG.displayName = "AltarSVG";

export default AltarSVG;
