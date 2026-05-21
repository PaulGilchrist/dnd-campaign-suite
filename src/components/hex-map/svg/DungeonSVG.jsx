import React from "react";

const DungeonSVG = React.forwardRef(({ id, className, ...rest }, ref) => (
    <g ref={ref} id={id} className={className} {...rest}>
        {/* Ground shadow */}
        <ellipse cx="18" cy="22" rx="15" ry="5" fill="#333" opacity="0.15" />

        {/* Rocky surround - outer rock frame */}
        <path d="M 2 8 Q 0 14 2 20 Q 3 24 6 26 L 8 28 L 12 30 L 18 32 L 24 30 L 28 28 L 30 26 Q 33 24 34 20 Q 36 14 34 8 Q 32 4 28 2 L 24 1 L 18 0 L 12 1 L 8 2 Q 4 4 2 8 Z" fill="#555" stroke="#444" strokeWidth="0.8" />

        {/* Rock highlights (upper left edges) */}
        <path d="M 2 8 Q 0 14 2 20 Q 4 14 6 10 Q 8 6 12 4 L 8 2 Q 4 4 2 8 Z" fill="#777" opacity="0.4" />
        <path d="M 28 2 Q 32 4 34 8 Q 36 14 34 20 Q 33 14 30 10 Q 28 6 24 4 Z" fill="#777" opacity="0.3" />

        {/* Rock texture cracks */}
        <path d="M 5 10 L 8 14 L 7 18" fill="none" stroke="#444" strokeWidth="0.4" opacity="0.5" />
        <path d="M 31 12 L 29 16 L 30 20" fill="none" stroke="#444" strokeWidth="0.4" opacity="0.5" />

        {/* Cave entrance archway */}
        <path d="M 8 28 L 8 16 Q 8 8 18 8 Q 28 8 28 16 L 28 28" fill="#333" stroke="#222" strokeWidth="0.6" />

        {/* Deep interior darkness */}
        <path d="M 10 28 L 10 17 Q 10 10 18 10 Q 26 10 26 17 L 26 28 Z" fill="#1A1A1A" />

        {/* Archway highlight (left edge) */}
        <path d="M 8 28 L 8 16 Q 8 9 13 8.5" fill="none" stroke="#777" strokeWidth="0.5" opacity="0.5" />

        {/* Subtle glow from within */}
        <ellipse cx="18" cy="24" rx="6" ry="3" fill="#4A90D9" opacity="0.08" />
        <ellipse cx="18" cy="26" rx="4" ry="1.5" fill="#4A90D9" opacity="0.06" />

        {/* Stalactites at top of entrance */}
        <polygon points="12,8 13,12 14,8" fill="#555" />
        <polygon points="21,8 22,11 23,8" fill="#555" />
        <polygon points="16,8 17,10 18,8" fill="#555" />

        {/* Floor debris */}
        <circle cx="12" cy="28" r="0.8" fill="#444" />
        <circle cx="24" cy="27" r="0.6" fill="#444" />
        <circle cx="15" cy="29" r="0.5" fill="#444" />
    </g>
));

DungeonSVG.displayName = "DungeonSVG";

export default DungeonSVG;
