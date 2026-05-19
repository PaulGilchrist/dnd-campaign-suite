import React from "react";

const FirePitSVG = React.forwardRef(({ id, className, ...rest }, ref) => (
    <g ref={ref} id={id} className={className} {...rest}>
        {/* Glow effect - subtle warm glow around the fire */}
        <circle cx="18" cy="18" r="16" fill="#E87A20" opacity="0.08" />
        <circle cx="18" cy="18" r="12" fill="#E87A20" opacity="0.1" />

        {/* Stone ring - outer circle */}
        <circle
            cx="18"
            cy="18"
            r="14"
            fill="#555"
            stroke="#333"
            strokeWidth="0.8"
        />

        {/* Individual stone segments around the ring with slight color variation */}
        {/* Stone 1 - top */}
        <path
            d="M 18 4 A 14 14 0 0 1 26 5.5 L 26 7.5 A 12 12 0 0 0 18 6 Z"
            fill="#5a5a5a"
            stroke="#333"
            strokeWidth="0.4"
        />
        {/* Stone 2 - top right */}
        <path
            d="M 26 5.5 A 14 14 0 0 1 30.5 10 L 28.5 11 A 12 12 0 0 0 26 7.5 Z"
            fill="#525252"
            stroke="#333"
            strokeWidth="0.4"
        />
        {/* Stone 3 - right */}
        <path
            d="M 30.5 10 A 14 14 0 0 1 32 18 L 30 18 A 12 12 0 0 0 28.5 11 Z"
            fill="#585858"
            stroke="#333"
            strokeWidth="0.4"
        />
        {/* Stone 4 - bottom right */}
        <path
            d="M 32 18 A 14 14 0 0 1 30.5 26 L 28.5 25 A 12 12 0 0 0 30 18 Z"
            fill="#545454"
            stroke="#333"
            strokeWidth="0.4"
        />
        {/* Stone 5 - bottom */}
        <path
            d="M 30.5 26 A 14 14 0 0 1 26 30.5 L 26 28.5 A 12 12 0 0 0 28.5 25 Z"
            fill="#5a5a5a"
            stroke="#333"
            strokeWidth="0.4"
        />
        {/* Stone 6 - bottom left */}
        <path
            d="M 26 30.5 A 14 14 0 0 1 18 32 L 18 30 A 12 12 0 0 0 26 28.5 Z"
            fill="#525252"
            stroke="#333"
            strokeWidth="0.4"
        />
        {/* Stone 7 - left */}
        <path
            d="M 18 32 A 14 14 0 0 1 10 26 L 12 25 A 12 12 0 0 0 18 30 Z"
            fill="#585858"
            stroke="#333"
            strokeWidth="0.4"
        />
        {/* Stone 8 - top left */}
        <path
            d="M 10 26 A 14 14 0 0 1 5.5 18 L 7.5 18 A 12 12 0 0 0 12 25 Z"
            fill="#545454"
            stroke="#333"
            strokeWidth="0.4"
        />
        {/* Stone 9 - top left (finishing) */}
        <path
            d="M 5.5 18 A 14 14 0 0 1 6 10 L 7.5 10 A 12 12 0 0 0 5.5 18 Z"
            fill="#5a5a5a"
            stroke="#333"
            strokeWidth="0.4"
        />
        {/* Stone 10 - top left (finishing) */}
        <path
            d="M 6 10 A 14 14 0 0 1 10 5.5 L 12 7.5 A 12 12 0 0 0 7.5 10 Z"
            fill="#525252"
            stroke="#333"
            strokeWidth="0.4"
        />

        {/* Inner pit - darker circle */}
        <circle
            cx="18"
            cy="18"
            r="10"
            fill="#1a1a1a"
            stroke="#2a2a2a"
            strokeWidth="0.5"
        />

        {/* Coals / embers base layer */}
        <ellipse cx="18" cy="20" rx="8" ry="5" fill="#2a1510" />

        {/* Ember/coal stones in the pit */}
        <circle cx="14" cy="18" r="2.5" fill="#3a1a0a" />
        <circle cx="20" cy="17" r="2" fill="#5a2a1a" />
        <circle cx="16" cy="21" r="2.2" fill="#4a2010" />
        <circle cx="22" cy="19" r="1.8" fill="#3a1a0a" />
        <circle cx="13" cy="20" r="1.5" fill="#5a2a1a" />
        <circle cx="19" cy="22" r="2" fill="#4a2010" />
        <circle cx="17" cy="16" r="1.8" fill="#3a1a0a" />
        <circle cx="21" cy="21" r="1.5" fill="#5a2a1a" />

        {/* Glowing ember highlights */}
        <circle cx="14" cy="18" r="1.2" fill="#8B3A1A" opacity="0.6" />
        <circle cx="20" cy="17" r="1" fill="#A04020" opacity="0.5" />
        <circle cx="16" cy="21" r="1" fill="#8B3A1A" opacity="0.5" />
        <circle cx="19" cy="22" r="0.8" fill="#A04020" opacity="0.4" />

        {/* Outer flames - orange (#E87A20), medium height, multiple flame paths */}
        {/* Center flame */}
        <path
            d="M 18 12 Q 15 8 16 4 Q 17 1 18 1 Q 19 1 20 4 Q 21 8 18 12 Z"
            fill="#E87A20"
            opacity="0.85"
        />
        {/* Left flame */}
        <path
            d="M 15 13 Q 12 9 13 5 Q 14 2 15 2 Q 16 3 15 7 Q 14 10 15 13 Z"
            fill="#E87A20"
            opacity="0.75"
        />
        {/* Right flame */}
        <path
            d="M 21 13 Q 24 9 23 5 Q 22 2 21 2 Q 20 3 21 7 Q 22 10 21 13 Z"
            fill="#E87A20"
            opacity="0.75"
        />
        {/* Far left flame */}
        <path
            d="M 13 14 Q 10 11 11 8 Q 12 5 13 5 Q 14 6 13 9 Q 12 12 13 14 Z"
            fill="#E87A20"
            opacity="0.6"
        />
        {/* Far right flame */}
        <path
            d="M 23 14 Q 26 11 25 8 Q 24 5 23 5 Q 22 6 23 9 Q 24 12 23 14 Z"
            fill="#E87A20"
            opacity="0.6"
        />

        {/* Inner flames - yellow (#F5D060), shorter, brighter */}
        {/* Center inner flame */}
        <path
            d="M 18 11 Q 16 8 17 5 Q 17.5 3 18 3 Q 18.5 3 19 5 Q 19 8 18 11 Z"
            fill="#F5D060"
            opacity="0.9"
        />
        {/* Left inner flame */}
        <path
            d="M 15.5 12 Q 13.5 9 14 6 Q 14.5 4 15 4 Q 15.5 5 15 8 Q 14.5 10 15.5 12 Z"
            fill="#F5D060"
            opacity="0.7"
        />
        {/* Right inner flame */}
        <path
            d="M 20.5 12 Q 22.5 9 22 6 Q 21.5 4 21 4 Q 20.5 5 21 8 Q 21.5 10 20.5 12 Z"
            fill="#F5D060"
            opacity="0.7"
        />

        {/* Bright core */}
        <ellipse cx="18" cy="13" rx="2" ry="3" fill="#FFF8E0" opacity="0.7" />
        <ellipse cx="18" cy="14" rx="1" ry="1.5" fill="#FFFFFF" opacity="0.5" />
    </g>
));

FirePitSVG.displayName = "FirePitSVG";

export default FirePitSVG;
