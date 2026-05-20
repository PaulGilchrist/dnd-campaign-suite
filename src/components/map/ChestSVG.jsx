import React from "react";

const ChestSVG = React.forwardRef(({ id, className, ...rest }, ref) => (
    <g ref={ref} id={id} className={className} {...rest}>
        {/* Floor shadow (offset down-right) */}
        <rect x="7" y="10" width="24" height="18" rx="1" fill="#6B3E1F" opacity="0.25" />

        {/* Lid edge/lip (slightly larger, behind main body) */}
        <rect x="5" y="8" width="26" height="20" rx="1" fill="#6B3E1F" />

        {/* Main chest body */}
        <rect x="6" y="9" width="24" height="18" rx="0.8" fill="#A0703C" stroke="#8B5E3C" strokeWidth="0.6" />

        {/* Wood grain lines (subtle) */}
        <line x1="8" y1="12" x2="28" y2="12" stroke="#7A4E20" strokeWidth="0.3" opacity="0.25" />
        <line x1="7" y1="16" x2="29" y2="16" stroke="#7A4E20" strokeWidth="0.3" opacity="0.25" />
        <line x1="8" y1="20" x2="28" y2="20" stroke="#7A4E20" strokeWidth="0.3" opacity="0.25" />
        <line x1="7" y1="24" x2="29" y2="24" stroke="#7A4E20" strokeWidth="0.3" opacity="0.25" />

        {/* Metal band - top */}
        <rect x="6" y="11" width="24" height="1.5" fill="#555" />
        <rect x="6" y="11" width="24" height="0.4" fill="#777" />

        {/* Metal band - bottom */}
        <rect x="6" y="24" width="24" height="1.5" fill="#555" />
        <rect x="6" y="24" width="24" height="0.4" fill="#777" />

        {/* Nail heads - top band */}
        <circle cx="8" cy="11.8" r="0.7" fill="#888" />
        <circle cx="28" cy="11.8" r="0.7" fill="#888" />
        <circle cx="13" cy="11.8" r="0.7" fill="#888" />
        <circle cx="23" cy="11.8" r="0.7" fill="#888" />

        {/* Nail heads - bottom band */}
        <circle cx="8" cy="24.8" r="0.7" fill="#888" />
        <circle cx="28" cy="24.8" r="0.7" fill="#888" />
        <circle cx="13" cy="24.8" r="0.7" fill="#888" />
        <circle cx="23" cy="24.8" r="0.7" fill="#888" />

        {/* Lock/keyhole at center-front (slightly below center) */}
        <circle cx="18" cy="21" r="2.5" fill="#D4A017" stroke="#B8860B" strokeWidth="0.4" />
        <rect x="17.5" y="21.5" width="1" height="2.5" fill="#333" rx="0.2" />

        {/* Hinges at back edge (top of chest) */}
        <rect x="8" y="8" width="3" height="1.2" rx="0.3" fill="#666" stroke="#555" strokeWidth="0.3" />
        <rect x="25" y="8" width="3" height="1.2" rx="0.3" fill="#666" stroke="#555" strokeWidth="0.3" />

        {/* Bottom and right edge shadow for depth */}
        <rect x="28" y="9" width="2" height="18" fill="#6B3E1F" opacity="0.15" />
        <rect x="6" y="25" width="24" height="2" fill="#6B3E1F" opacity="0.15" />
    </g>
));

ChestSVG.displayName = "ChestSVG";
export default ChestSVG;
