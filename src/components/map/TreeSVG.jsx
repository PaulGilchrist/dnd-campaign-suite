import React from "react";

const TreeSVG = React.forwardRef(({ id, className, ...rest }, ref) => (
    <g ref={ref} id={id} className={className} {...rest}>
        {/* Shadow */}
        <ellipse cx="18" cy="33" rx="12" ry="3" fill="#000" opacity="0.15" />

        {/* Trunk */}
        <rect x="15" y="18" width="6" height="15" rx="1.5" fill="#6B3E1F" stroke="#4A2810" strokeWidth="0.5" />
        <path d="M 17 18 Q 16 23 17 33" fill="none" stroke="#5C3317" strokeWidth="0.6" opacity="0.5" />

        {/* Foliage - bottom layer (darkest) */}
        <path d="M 18 4 Q 4 12 6 24 Q 10 20 12 24 Q 14 18 18 20 Q 22 18 24 24 Q 26 20 30 24 Q 32 12 18 4 Z" fill="#2D5E37" stroke="#1E4025" strokeWidth="0.5" />

        {/* Foliage - middle layer */}
        <path d="M 18 6 Q 6 13 8 22 Q 12 18 14 22 Q 16 17 18 18 Q 20 17 22 22 Q 24 18 28 22 Q 30 13 18 6 Z" fill="#3D7A4A" stroke="#2D5E37" strokeWidth="0.4" />

        {/* Foliage - top layer (lightest) */}
        <path d="M 18 8 Q 8 14 10 21 Q 13 17 15 20 Q 17 16 18 17 Q 19 16 21 20 Q 23 17 26 21 Q 28 14 18 8 Z" fill="#4A9A5A" stroke="#3D7A4A" strokeWidth="0.3" />

        {/* Highlight spots */}
        <ellipse cx="14" cy="14" rx="3" ry="2" fill="#5AAB6A" opacity="0.4" />
        <ellipse cx="22" cy="12" rx="2" ry="1.5" fill="#5AAB6A" opacity="0.3" />
    </g>
));

TreeSVG.displayName = "TreeSVG";

export default TreeSVG;
