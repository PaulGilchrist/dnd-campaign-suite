import React from "react";

const DungeonSVG = React.forwardRef(({ id, className, ...rest }, ref) => (
    <g ref={ref} id={id} className={className} {...rest}>
        {/* Ground shadow */}
        <ellipse cx="18" cy="30" rx="15" ry="5" fill="#333" opacity="0.15" />

        {/* Outer stone frame - rectangular dungeon entrance */}
        <rect x="4" y="4" width="28" height="26" rx="2" fill="#4A4A4A" stroke="#333" strokeWidth="0.8" />

        {/* Stonework texture inside frame - horizontal lines */}
        <line x1="4" y1="10" x2="32" y2="10" stroke="#3A3A3A" strokeWidth="0.4" opacity="0.4" />
        <line x1="4" y1="16" x2="32" y2="16" stroke="#3A3A3A" strokeWidth="0.4" opacity="0.4" />
        <line x1="4" y1="22" x2="32" y2="22" stroke="#3A3A3A" strokeWidth="0.4" opacity="0.4" />

        {/* Stone highlight (top/left edges) */}
        <rect x="4" y="4" width="28" height="1.5" rx="0.5" fill="#6E6E6E" opacity="0.35" />
        <rect x="4" y="4" width="1.5" height="26" rx="0.3" fill="#6E6E6E" opacity="0.25" />

        {/* Dark interior opening - arched doorway */}
        <path d="M 9 30 L 9 14 Q 9 8 18 8 Q 27 8 27 14 L 27 30 Z" fill="#1A1A1A" stroke="#333" strokeWidth="0.5" />

        {/* Interior floor (slightly lighter to show depth) */}
        <rect x="9" y="24" width="18" height="6" fill="#222" />

        {/* Stone arch surround */}
        <path d="M 7 30 L 7 14 Q 7 6 18 6 Q 29 6 29 14 L 29 30" fill="none" stroke="#5E5E5E" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M 9 30 L 9 14 Q 9 8 18 8 Q 27 8 27 14 L 27 30" fill="none" stroke="#444" strokeWidth="0.6" />

        {/* Arch keystone */}
        <polygon points="16,5 20,5 20,8 16,8" fill="#5E5E5E" stroke="#444" strokeWidth="0.4" />
        {/* Keystone cap */}
        <rect x="16" y="4" width="4" height="1.5" rx="0.3" fill="#5E5E5E" stroke="#444" strokeWidth="0.3" />

        {/* Stone blocks framing the arch (voussoirs) */}
        <rect x="6" y="10" width="3" height="3" rx="0.3" fill="#555" stroke="#444" strokeWidth="0.3" opacity="0.6" />
        <rect x="6" y="14" width="3" height="3" rx="0.3" fill="#555" stroke="#444" strokeWidth="0.3" opacity="0.6" />
        <rect x="6" y="18" width="3" height="3" rx="0.3" fill="#555" stroke="#444" strokeWidth="0.3" opacity="0.6" />
        <rect x="27" y="10" width="3" height="3" rx="0.3" fill="#555" stroke="#444" strokeWidth="0.3" opacity="0.6" />
        <rect x="27" y="14" width="3" height="3" rx="0.3" fill="#555" stroke="#444" strokeWidth="0.3" opacity="0.6" />
        <rect x="27" y="18" width="3" height="3" rx="0.3" fill="#555" stroke="#444" strokeWidth="0.3" opacity="0.6" />

        {/* Stairs descending into darkness */}
        <rect x="11" y="26" width="14" height="1.2" rx="0.2" fill="#3A3A3A" />
        <rect x="12" y="27.5" width="12" height="1.2" rx="0.2" fill="#333" />
        <rect x="13" y="29" width="10" height="1.2" rx="0.2" fill="#2A2A2A" />

        {/* Stair side walls */}
        <line x1="11" y1="24" x2="11" y2="30" stroke="#444" strokeWidth="0.4" />
        <line x1="25" y1="24" x2="25" y2="30" stroke="#444" strokeWidth="0.4" />

        {/* Portcullis / gate bars */}
        <line x1="9" y1="14" x2="9" y2="24" stroke="#666" strokeWidth="0.6" opacity="0.6" />
        <line x1="12" y1="13" x2="12" y2="24" stroke="#666" strokeWidth="0.6" opacity="0.6" />
        <line x1="15" y1="12" x2="15" y2="24" stroke="#666" strokeWidth="0.6" opacity="0.6" />
        <line x1="18" y1="12" x2="18" y2="24" stroke="#666" strokeWidth="0.6" opacity="0.6" />
        <line x1="21" y1="12" x2="21" y2="24" stroke="#666" strokeWidth="0.6" opacity="0.6" />
        <line x1="24" y1="13" x2="24" y2="24" stroke="#666" strokeWidth="0.6" opacity="0.6" />
        <line x1="27" y1="14" x2="27" y2="24" stroke="#666" strokeWidth="0.6" opacity="0.6" />
        {/* Portcullis crossbar */}
        <line x1="9" y1="18" x2="27" y2="18" stroke="#777" strokeWidth="0.8" opacity="0.5" />

        {/* Torch sconces on walls */}
        {/* Left torch */}
        <rect x="3" y="17" width="1.5" height="0.8" rx="0.2" fill="#666" />
        <ellipse cx="3.75" cy="16" rx="1.2" ry="1.8" fill="#FF8C00" opacity="0.4" />
        <ellipse cx="3.75" cy="16" rx="0.6" ry="1" fill="#FFD700" opacity="0.3" />
        {/* Right torch */}
        <rect x="31.5" y="17" width="1.5" height="0.8" rx="0.2" fill="#666" />
        <ellipse cx="32.25" cy="16" rx="1.2" ry="1.8" fill="#FF8C00" opacity="0.4" />
        <ellipse cx="32.25" cy="16" rx="0.6" ry="1" fill="#FFD700" opacity="0.3" />

        {/* Faint magical glow from deep interior */}
        <ellipse cx="18" cy="28" rx="6" ry="2" fill="#4A90D9" opacity="0.07" />
        <ellipse cx="18" cy="29" rx="3" ry="1" fill="#66BBFF" opacity="0.05" />

        {/* Iron hinges on the outer stone frame sides */}
        <rect x="4" y="12" width="0.8" height="4" rx="0.2" fill="#555" />
        <rect x="31.2" y="12" width="0.8" height="4" rx="0.2" fill="#555" />
    </g>
));

DungeonSVG.displayName = "DungeonSVG";

export default DungeonSVG;
