import React from "react";

const StatueSVG = React.forwardRef(({ id, className, ...rest }, ref) => (
    <g ref={ref} id={id} className={className} {...rest}>
        {/* Pedestal base */}
        <rect
            x="7"
            y="26"
            width="22"
            height="6"
            rx="1"
            fill="#888"
            stroke="#666"
            strokeWidth="0.8"
        />
        {/* Pedestal middle */}
        <rect
            x="9"
            y="22"
            width="18"
            height="5"
            fill="#777"
            stroke="#555"
            strokeWidth="0.5"
        />
        {/* Pedestal top slab */}
        <rect
            x="8"
            y="20"
            width="20"
            height="3"
            rx="0.5"
            fill="#999"
            stroke="#777"
            strokeWidth="0.5"
        />
        {/* Pedestal top highlight */}
        <rect x="10" y="21" width="16" height="1" fill="#AAA" opacity="0.4" />
        {/* Pedestal shadow */}
        <rect x="7" y="30" width="22" height="2" fill="#555" opacity="0.3" rx="0.5" />

        {/* Statue body (torso) */}
        <path
            d="M 14 20 L 14 11 Q 14 8 18 8 Q 22 8 22 11 L 22 20 Z"
            fill="#999"
            stroke="#777"
            strokeWidth="0.6"
        />
        {/* Body shadow (left side) */}
        <path
            d="M 14 20 L 14 11 Q 14 8 18 8 L 16 8 Q 15 8 15 11 L 15 20 Z"
            fill="#777"
            opacity="0.4"
        />

        {/* Head */}
        <circle cx="18" cy="6" r="4" fill="#AAA" stroke="#888" strokeWidth="0.6" />
        {/* Head shadow */}
        <path
            d="M 14 6 A 4 4 0 0 1 18 2 A 4 4 0 0 0 15 8 Z"
            fill="#888"
            opacity="0.3"
        />

        {/* Left arm */}
        <path
            d="M 14 12 L 10 16 L 10 18"
            fill="none"
            stroke="#999"
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeLinejoin="round"
        />
        <path
            d="M 14 12 L 10 16 L 10 18"
            fill="none"
            stroke="#777"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
        />
        {/* Right arm */}
        <path
            d="M 22 12 L 26 16 L 26 18"
            fill="none"
            stroke="#999"
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeLinejoin="round"
        />
        <path
            d="M 22 12 L 26 16 L 26 18"
            fill="none"
            stroke="#777"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
        />

        {/* Statue base feet */}
        <rect x="12" y="19" width="4" height="1.5" rx="0.3" fill="#999" />
        <rect x="20" y="19" width="4" height="1.5" rx="0.3" fill="#999" />
    </g>
));

StatueSVG.displayName = "StatueSVG";

export default StatueSVG;
