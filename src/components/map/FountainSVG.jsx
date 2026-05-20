import React from "react";

const FountainSVG = React.forwardRef(({ id, className, ...rest }, ref) => (
    <g ref={ref} id={id} className={className} {...rest}>
        {/* Floor shadow under base */}
        <circle cx="18" cy="19" r="16" fill="#555" opacity="0.12" />

        {/* Outer basin wall (stone ring) */}
        <path
            d="M 3 18 A 15 15 0 1 1 33 18 A 15 15 0 1 1 3 18 Z M 6 18 A 12 12 0 1 0 30 18 A 12 12 0 1 0 6 18 Z"
            fill="#888"
            stroke="#666"
            strokeWidth="0.6"
            fillRule="evenodd"
        />

        {/* Basin rim highlight (thin lighter ring) */}
        <circle cx="18" cy="18" r="14.5" fill="none" stroke="#999" strokeWidth="0.4" opacity="0.6" />

        {/* Basin wall shadow (bottom-right arc) */}
        <path
            d="M 6 24 A 12 12 0 0 0 30 24"
            fill="none"
            stroke="#555"
            strokeWidth="1.5"
            opacity="0.3"
            strokeLinecap="round"
        />

        {/* Water surface */}
        <circle cx="18" cy="18" r="11.5" fill="#3498DB" opacity="0.45" />

        {/* Water highlight (lighter crescent on water) */}
        <path
            d="M 8 15 A 10 10 0 0 1 28 15"
            fill="none"
            stroke="#5DADE2"
            strokeWidth="1.8"
            opacity="0.35"
            strokeLinecap="round"
        />

        {/* Central pillar */}
        <circle cx="18" cy="18" r="3.5" fill="#888" stroke="#666" strokeWidth="0.6" />
        {/* Pillar top */}
        <circle cx="18" cy="18" r="2.5" fill="#999" stroke="#777" strokeWidth="0.3" />
        {/* Pillar center highlight */}
        <circle cx="17.5" cy="17.5" r="0.8" fill="#AAA" opacity="0.4" />

        {/* Water ripples (concentric circles from center) */}
        <circle cx="18" cy="18" r="5" fill="none" stroke="#5DADE2" strokeWidth="0.4" opacity="0.3" />
        <circle cx="18" cy="18" r="7.5" fill="none" stroke="#5DADE2" strokeWidth="0.4" opacity="0.25" />
        <circle cx="18" cy="18" r="10" fill="none" stroke="#5DADE2" strokeWidth="0.3" opacity="0.2" />

        {/* Flowing water arcs from pillar into basin */}
        <path
            d="M 15 15 Q 12 13 11 16"
            fill="none"
            stroke="#5DADE2"
            strokeWidth="0.8"
            strokeLinecap="round"
            opacity="0.5"
        />
        <path
            d="M 21 15 Q 24 13 25 16"
            fill="none"
            stroke="#5DADE2"
            strokeWidth="0.8"
            strokeLinecap="round"
            opacity="0.5"
        />
        <path
            d="M 15 21 Q 12 23 11 20"
            fill="none"
            stroke="#5DADE2"
            strokeWidth="0.8"
            strokeLinecap="round"
            opacity="0.5"
        />
        <path
            d="M 21 21 Q 24 23 25 20"
            fill="none"
            stroke="#5DADE2"
            strokeWidth="0.8"
            strokeLinecap="round"
            opacity="0.5"
        />

        {/* Water droplets / splashes */}
        <circle cx="10" cy="13" r="0.7" fill="#5DADE2" opacity="0.6" />
        <circle cx="26" cy="13" r="0.7" fill="#5DADE2" opacity="0.6" />
        <circle cx="10" cy="23" r="0.7" fill="#5DADE2" opacity="0.6" />
        <circle cx="26" cy="23" r="0.7" fill="#5DADE2" opacity="0.6" />
    </g>
));

FountainSVG.displayName = "FountainSVG";
export default FountainSVG;
