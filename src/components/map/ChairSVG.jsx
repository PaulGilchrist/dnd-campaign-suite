import React from "react";

const ChairSVG = React.forwardRef(({ id, className, ...rest }, ref) => (
    <g ref={ref} id={id} className={className} {...rest}>
        {/* Floor shadow (slightly larger than footprint) */}
        <rect x="3" y="3" width="30" height="30" rx="1" fill="#4A2810" opacity="0.15" />

        {/* ===== BACKREST (top edge = back of chair) ===== */}
        <rect x="7" y="3" width="22" height="7" rx="0.8" fill="#5C3317" stroke="#4A2810" strokeWidth="0.6" />
        {/* Gold trim on back edge */}
        <rect x="7" y="3" width="22" height="1" fill="#D4AF37" opacity="0.8" rx="0.3" />
        {/* Decorative circle inside backrest */}
        <circle cx="18" cy="6.5" r="2.2" fill="none" stroke="#D4AF37" strokeWidth="0.5" opacity="0.6" />
        <circle cx="18" cy="6.5" r="0.8" fill="none" stroke="#D4AF37" strokeWidth="0.4" opacity="0.4" />

        {/* ===== SEAT CUSHION (red runs to the front edge, showing which way the chair faces) ===== */}
        <rect x="7" y="10" width="22" height="25" rx="1.2" fill="#8B0000" stroke="#6B0000" strokeWidth="0.6" />
        {/* Cushion center (lighter inner area) */}
        <rect x="9" y="12" width="18" height="21" rx="0.8" fill="#A00000" opacity="0.25" />
        {/* Cushion highlight (edge next to backrest) */}
        <rect x="8" y="10.5" width="20" height="0.6" fill="#C00000" opacity="0.3" rx="0.3" />

        {/* ===== LEFT ARMREST ===== */}
        <rect x="4" y="10" width="3" height="22" rx="0.5" fill="#5C3317" stroke="#4A2810" strokeWidth="0.4" />
        {/* Gold tip at front of left armrest */}
        <circle cx="5.5" cy="30" r="1.2" fill="#D4AF37" stroke="#B8860B" strokeWidth="0.3" />
        {/* Armrest highlight */}
        <rect x="4" y="10" width="0.5" height="22" fill="#7A4E20" opacity="0.4" />

        {/* ===== RIGHT ARMREST ===== */}
        <rect x="29" y="10" width="3" height="22" rx="0.5" fill="#5C3317" stroke="#4A2810" strokeWidth="0.4" />
        {/* Gold tip at front of right armrest */}
        <circle cx="30.5" cy="30" r="1.2" fill="#D4AF37" stroke="#B8860B" strokeWidth="0.3" />
        {/* Armrest highlight */}
        <rect x="31.5" y="10" width="0.5" height="22" fill="#7A4E20" opacity="0.4" />

        {/* ===== LEGS (four corners) ===== */}
        {/* Back left leg */}
        <rect x="5" y="4" width="3" height="3" rx="0.3" fill="#4A2810" />
        {/* Back right leg */}
        <rect x="28" y="4" width="3" height="3" rx="0.3" fill="#4A2810" />
        {/* Front left leg */}
        <rect x="5" y="29" width="3" height="3" rx="0.3" fill="#4A2810" />
        {/* Front right leg */}
        <rect x="28" y="29" width="3" height="3" rx="0.3" fill="#4A2810" />
    </g>
));

ChairSVG.displayName = "ChairSVG";
export default ChairSVG;
