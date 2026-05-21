import React from "react";

const TowerSVG = React.forwardRef(({ id, className, ...rest }, ref) => (
    <g ref={ref} id={id} className={className} {...rest}>
        {/* Ground shadow */}
        <ellipse cx="18" cy="30" rx="10" ry="3.5" fill="#555" opacity="0.15" />

        {/* Tower body - main shaft */}
        <rect x="9" y="8" width="18" height="22" rx="0.5" fill="#9E9E9E" stroke="#757575" strokeWidth="0.8" />

        {/* Left shadow side */}
        <rect x="9" y="8" width="5" height="22" rx="0.3" fill="#757575" opacity="0.4" />

        {/* Right highlight side */}
        <rect x="23" y="8" width="4" height="22" rx="0.3" fill="#BDBDBD" opacity="0.3" />

        {/* Stone block lines (horizontal) */}
        <line x1="9" y1="12" x2="27" y2="12" stroke="#888" strokeWidth="0.3" opacity="0.4" />
        <line x1="9" y1="16" x2="27" y2="16" stroke="#888" strokeWidth="0.3" opacity="0.4" />
        <line x1="9" y1="20" x2="27" y2="20" stroke="#888" strokeWidth="0.3" opacity="0.4" />
        <line x1="9" y1="24" x2="27" y2="24" stroke="#888" strokeWidth="0.3" opacity="0.4" />
        <line x1="9" y1="28" x2="27" y2="28" stroke="#888" strokeWidth="0.3" opacity="0.4" />

        {/* Stone block lines (vertical, staggered) */}
        <line x1="15" y1="8" x2="15" y2="12" stroke="#888" strokeWidth="0.3" opacity="0.3" />
        <line x1="21" y1="8" x2="21" y2="12" stroke="#888" strokeWidth="0.3" opacity="0.3" />
        <line x1="13" y1="12" x2="13" y2="16" stroke="#888" strokeWidth="0.3" opacity="0.3" />
        <line x1="23" y1="12" x2="23" y2="16" stroke="#888" strokeWidth="0.3" opacity="0.3" />
        <line x1="16" y1="16" x2="16" y2="20" stroke="#888" strokeWidth="0.3" opacity="0.3" />
        <line x1="22" y1="16" x2="22" y2="20" stroke="#888" strokeWidth="0.3" opacity="0.3" />

        {/* Crenellations (battlements) - merlons */}
        <rect x="9" y="4" width="3" height="4" rx="0.2" fill="#9E9E9E" stroke="#757575" strokeWidth="0.5" />
        <rect x="15" y="4" width="3" height="4" rx="0.2" fill="#9E9E9E" stroke="#757575" strokeWidth="0.5" />
        <rect x="21" y="4" width="3" height="4" rx="0.2" fill="#9E9E9E" stroke="#757575" strokeWidth="0.5" />
        {/* Crenellations - crenels (gaps between) */}
        <rect x="12" y="5" width="3" height="3" fill="#757575" />
        <rect x="18" y="5" width="3" height="3" fill="#757575" />
        {/* Crenellation highlights */}
        <rect x="9" y="4" width="3" height="0.6" fill="#BDBDBD" opacity="0.5" rx="0.1" />
        <rect x="15" y="4" width="3" height="0.6" fill="#BDBDBD" opacity="0.5" rx="0.1" />
        <rect x="21" y="4" width="3" height="0.6" fill="#BDBDBD" opacity="0.5" rx="0.1" />

        {/* Door at base */}
        <path d="M 15 30 L 15 24 Q 15 21 18 21 Q 21 21 21 24 L 21 30" fill="#555" stroke="#444" strokeWidth="0.5" />
        {/* Door arch highlight */}
        <path d="M 15 30 L 15 24 Q 15 21 18 21" fill="none" stroke="#BDBDBD" strokeWidth="0.3" opacity="0.5" />

        {/* Window (narrow slit) */}
        <rect x="17" y="13" width="2" height="4" rx="0.3" fill="#444" />
        <rect x="17" y="13" width="2" height="4" rx="0.3" fill="none" stroke="#BDBDBD" strokeWidth="0.3" opacity="0.4" />

        {/* Tower top edge / base of crenellations */}
        <line x1="9" y1="8" x2="27" y2="8" stroke="#888" strokeWidth="0.5" />
    </g>
));

TowerSVG.displayName = "TowerSVG";

export default TowerSVG;
