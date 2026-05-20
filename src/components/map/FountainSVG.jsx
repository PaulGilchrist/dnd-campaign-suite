import React from "react";

const FountainSVG = React.forwardRef(({ id, className, ...rest }, ref) => (
    <g ref={ref} id={id} className={className} {...rest}>
        {/* Base platform */}
        <rect
            x="2"
            y="30"
            width="32"
            height="4"
            rx="1"
            fill="#777"
            stroke="#555"
            strokeWidth="0.6"
        />
        {/* Base shadow */}
        <rect x="2" y="32" width="32" height="2" fill="#555" opacity="0.3" rx="0.5" />

        {/* Basin - outer wall */}
        <rect
            x="4"
            y="24"
            width="28"
            height="7"
            rx="2"
            fill="#888"
            stroke="#666"
            strokeWidth="0.8"
        />
        {/* Basin - inner wall */}
        <rect x="6" y="26" width="24" height="4" rx="1" fill="#777" />
        {/* Basin - water surface */}
        <rect x="7" y="26" width="22" height="3" rx="1" fill="#3498DB" opacity="0.5" />
        {/* Water highlight */}
        <rect x="7" y="26.5" width="22" height="0.5" fill="#5DADE2" opacity="0.4" />
        {/* Basin rim highlight */}
        <rect x="6" y="25" width="24" height="0.8" fill="#999" opacity="0.4" />

        {/* Central pillar base */}
        <rect
            x="14"
            y="19"
            width="8"
            height="8"
            rx="0.5"
            fill="#888"
            stroke="#666"
            strokeWidth="0.5"
        />
        {/* Central pillar upper */}
        <rect
            x="15"
            y="13"
            width="6"
            height="7"
            fill="#999"
            stroke="#777"
            strokeWidth="0.5"
        />
        {/* Central pillar capital */}
        <path
            d="M 14 13 L 16 9 L 20 9 L 22 13 Z"
            fill="#AAA"
            stroke="#888"
            strokeWidth="0.5"
        />
        {/* Pillar shadow (left side) */}
        <rect x="15" y="13" width="2" height="14" fill="#777" opacity="0.3" />

        {/* Water spout - left */}
        <path
            d="M 14 10 Q 10 12 10 16"
            fill="none"
            stroke="#5DADE2"
            strokeWidth="1.5"
            strokeLinecap="round"
        />
        <path
            d="M 14 10 Q 10 12 10 16"
            fill="none"
            stroke="#3498DB"
            strokeWidth="0.6"
            strokeLinecap="round"
        />
        {/* Water spout - right */}
        <path
            d="M 22 10 Q 26 12 26 16"
            fill="none"
            stroke="#5DADE2"
            strokeWidth="1.5"
            strokeLinecap="round"
        />
        <path
            d="M 22 10 Q 26 12 26 16"
            fill="none"
            stroke="#3498DB"
            strokeWidth="0.6"
            strokeLinecap="round"
        />
        {/* Water spout - center (tall) */}
        <path
            d="M 18 9 L 18 6"
            stroke="#5DADE2"
            strokeWidth="1.8"
            strokeLinecap="round"
        />
        <path
            d="M 18 9 L 18 6"
            stroke="#3498DB"
            strokeWidth="0.8"
            strokeLinecap="round"
        />

        {/* Water droplets */}
        <circle cx="10" cy="17.5" r="0.7" fill="#5DADE2" />
        <circle cx="26" cy="17.5" r="0.7" fill="#5DADE2" />
        <circle cx="10" cy="20" r="0.5" fill="#3498DB" />
        <circle cx="26" cy="20" r="0.5" fill="#3498DB" />
        <circle cx="10" cy="22" r="0.4" fill="#5DADE2" />
        <circle cx="26" cy="22" r="0.4" fill="#5DADE2" />
    </g>
));

FountainSVG.displayName = "FountainSVG";

export default FountainSVG;
