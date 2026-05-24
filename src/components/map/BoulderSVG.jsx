import React from "react";

const BoulderSVG = React.forwardRef(({ id, className, ...rest }, ref) => (
    <g ref={ref} id={id} className={className} {...rest}>
        {/* Shadow */}
        <ellipse cx="18" cy="34" rx="14" ry="3" fill="#000" opacity="0.12" />

        {/* Main body */}
        <path d="M 8 32 Q 4 20 10 10 Q 12 4 18 6 Q 24 4 26 10 Q 32 20 28 32 Z" fill="#7A7A6A" stroke="#5A5A4E" strokeWidth="0.8" />

        {/* Highlight face */}
        <path d="M 10 28 Q 8 20 12 14 Q 14 8 18 8 Q 20 8 22 10 Q 18 14 16 18 Q 14 24 12 28 Z" fill="#8B8B7A" opacity="0.6" />

        {/* Shadow face */}
        <path d="M 26 28 Q 28 20 24 14 Q 22 10 20 10 Q 22 14 22 18 Q 22 24 24 28 Z" fill="#5A5A4E" opacity="0.4" />

        {/* Crack lines */}
        <path d="M 16 12 Q 14 16 16 20 Q 17 22 16 26" fill="none" stroke="#5A5A4E" strokeWidth="0.5" opacity="0.6" />
        <path d="M 20 14 Q 22 18 20 22" fill="none" stroke="#5A5A4E" strokeWidth="0.4" opacity="0.5" />

        {/* Top highlight */}
        <ellipse cx="16" cy="12" rx="4" ry="2" fill="#9A9A8A" opacity="0.3" />
    </g>
));

BoulderSVG.displayName = "BoulderSVG";

export default BoulderSVG;
