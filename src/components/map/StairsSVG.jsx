import React from "react";

const StairsSVG = React.forwardRef(({ id, className, ...rest }, ref) => (
    <g ref={ref} id={id} className={className} {...rest}>
        {/* Stairwell frame */}
        <rect x="2" y="2" width="32" height="32" fill="none" stroke="#8B5A2B" strokeWidth="1.5" />

        {/* Step lines (horizontal, indicating steps going down) */}
        <line x1="4" y1="8" x2="32" y2="8" stroke="#8B5A2B" strokeWidth="1" />
        <line x1="4" y1="14" x2="32" y2="14" stroke="#8B5A2B" strokeWidth="1" />
        <line x1="4" y1="20" x2="32" y2="20" stroke="#8B5A2B" strokeWidth="1" />
        <line x1="4" y1="26" x2="32" y2="26" stroke="#8B5A2B" strokeWidth="1" />

        {/* Down arrow (pointing downward, indicating direction of "down") */}
        {/* Shaft */}
        <line x1="18" y1="8" x2="18" y2="26" stroke="#8B1A1A" strokeWidth="1.5" />
        {/* Head */}
        <polygon points="14,24 22,24 18,30" fill="#8B1A1A" />
    </g>
));

StairsSVG.displayName = "StairsSVG";

export default StairsSVG;
