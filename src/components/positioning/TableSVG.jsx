import React from "react";

const TableSVG = React.forwardRef(({ id, className, ...rest }, ref) => (
    <g ref={ref} id={id} className={className} {...rest}>
        {/* Tabletop - main surface */}
        <rect
            x="2"
            y="4"
            width="68"
            height="28"
            rx="3"
            ry="3"
            fill="#A0652D"
            stroke="#6B3E1F"
            strokeWidth="0.8"
        />

        {/* Left side shading (darker) */}
        <rect
            x="2"
            y="4"
            width="20"
            height="28"
            rx="3"
            ry="3"
            fill="#8B5524"
            opacity="0.35"
        />

        {/* Right side highlight (lighter) */}
        <rect
            x="50"
            y="4"
            width="20"
            height="28"
            fill="#B87A3A"
            opacity="0.3"
        />

        {/* Top edge bevel highlight */}
        <rect
            x="4"
            y="5"
            width="64"
            height="2"
            rx="1"
            fill="#C4944A"
            opacity="0.5"
        />

        {/* Front edge subtle shadow */}
        <rect
            x="4"
            y="30"
            width="64"
            height="1.5"
            fill="#6B3E1F"
            opacity="0.3"
        />

        {/* Wood grain lines across tabletop */}
        <path
            d="M 8 10 Q 20 9 36 11 Q 52 13 64 10"
            fill="none"
            stroke="#7A4E20"
            strokeWidth="0.4"
            opacity="0.5"
        />
        <path
            d="M 6 16 Q 18 15 32 17 Q 48 18 66 15"
            fill="none"
            stroke="#7A4E20"
            strokeWidth="0.4"
            opacity="0.5"
        />
        <path
            d="M 10 22 Q 24 21 40 23 Q 54 24 62 21"
            fill="none"
            stroke="#7A4E20"
            strokeWidth="0.4"
            opacity="0.5"
        />
        <path
            d="M 14 27 Q 28 26 38 28 Q 50 29 58 26"
            fill="none"
            stroke="#7A4E20"
            strokeWidth="0.3"
            opacity="0.4"
        />

        {/* Left leg */}
        <path
            d="M 12 32 L 10 36 L 10 36 L 14 36 L 14 32 Z"
            fill="#8B5524"
            stroke="#6B3E1F"
            strokeWidth="0.6"
        />
        <path
            d="M 12 32 L 11 36 L 11 36 L 14 36 L 14 32 Z"
            fill="#7A4E20"
            opacity="0.3"
        />

        {/* Right leg */}
        <path
            d="M 58 32 L 58 36 L 62 36 L 62 36 L 60 32 Z"
            fill="#8B5524"
            stroke="#6B3E1F"
            strokeWidth="0.6"
        />
        <path
            d="M 60 32 L 61 36 L 61 36 L 62 36 L 60 32 Z"
            fill="#B87A3A"
            opacity="0.25"
        />

        {/* Leg decorative brackets */}
        <rect x="10" y="34" width="4" height="2" rx="0.5" fill="#6B3E1F" />
        <rect x="58" y="34" width="4" height="2" rx="0.5" fill="#6B3E1F" />

        {/* Cross stretcher connecting legs */}
        <rect x="14" y="35" width="44" height="1.5" rx="0.5" fill="#7A4E20" stroke="#6B3E1F" strokeWidth="0.4" />
        <rect x="14" y="35" width="44" height="0.5" fill="#8B5524" opacity="0.5" />

        {/* Subtle surface highlight (center-right) */}
        <rect
            x="30"
            y="6"
            width="30"
            height="24"
            fill="#C4944A"
            opacity="0.08"
            rx="2"
        />
    </g>
));

TableSVG.displayName = "TableSVG";

export default TableSVG;
