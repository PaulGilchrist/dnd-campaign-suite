import React from "react";

const StatueSVG = React.forwardRef(({ id, className, ...rest }, ref) => (
    <g ref={ref} id={id} className={className} {...rest}>
        {/* Floor shadow */}
        <rect x="5" y="5" width="28" height="28" rx="1" fill="#555" opacity="0.15" transform="translate(1, 1)" />

        {/* Outer plinth / base (square) */}
        <rect x="4" y="4" width="28" height="28" rx="1" fill="#888" stroke="#666" strokeWidth="0.8" />
        {/* Base highlight (top/left edge) */}
        <rect x="4" y="4" width="28" height="1.5" fill="#AAA" opacity="0.3" rx="0.3" />
        <rect x="4" y="4" width="1.5" height="28" fill="#AAA" opacity="0.3" rx="0.3" />
        {/* Base shadow (bottom/right edge) */}
        <rect x="4" y="30" width="28" height="2" fill="#555" opacity="0.3" rx="0.5" />
        <rect x="30" y="4" width="2" height="28" fill="#555" opacity="0.3" rx="0.5" />

        {/* Middle tier */}
        <rect x="9" y="9" width="18" height="18" rx="0.8" fill="#999" stroke="#777" strokeWidth="0.6" />
        {/* Middle tier highlight */}
        <rect x="9" y="9" width="18" height="1" fill="#BBB" opacity="0.3" />
        <rect x="9" y="9" width="1" height="18" fill="#BBB" opacity="0.3" />
        {/* Middle tier shadow */}
        <rect x="9" y="25" width="18" height="2" fill="#555" opacity="0.25" rx="0.3" />
        <rect x="25" y="9" width="2" height="18" fill="#555" opacity="0.25" rx="0.3" />

        {/* Top tier / pedestal top */}
        <rect x="13" y="13" width="10" height="10" rx="0.5" fill="#AAA" stroke="#888" strokeWidth="0.5" />
        {/* Top tier highlight */}
        <rect x="13" y="13" width="10" height="0.8" fill="#CCC" opacity="0.3" />
        <rect x="13" y="13" width="0.8" height="10" fill="#CCC" opacity="0.3" />
        {/* Top tier shadow */}
        <rect x="13" y="21.5" width="10" height="1.5" fill="#777" opacity="0.25" rx="0.3" />
        <rect x="21.5" y="13" width="1.5" height="10" fill="#777" opacity="0.25" rx="0.3" />

        {/* Statue figure (4-point star / cross for humanoid from above) */}
        <path
            d="M 17 14 L 19 14 L 19 16 L 22 16 L 22 18 L 19 18 L 19 20 L 17 20 L 17 18 L 14 18 L 14 16 L 17 16 Z"
            fill="#999"
            stroke="#777"
            strokeWidth="0.4"
        />
        {/* Statue head (small circle at top of cross) */}
        <circle cx="18" cy="14" r="1.5" fill="#AAA" stroke="#888" strokeWidth="0.3" />
    </g>
));

StatueSVG.displayName = "StatueSVG";
export default StatueSVG;
