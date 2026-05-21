import React from "react";

const SettlementSVG = React.forwardRef(({ id, className, ...rest }, ref) => (
    <g ref={ref} id={id} className={className} {...rest}>
        {/* Ground shadow */}
        <ellipse cx="18" cy="20" rx="16" ry="6" fill="#8B5A2B" opacity="0.1" />

        {/* Path/road between buildings */}
        <path d="M 9 24 Q 14 22 18 20 Q 22 18 27 22" fill="none" stroke="#A08060" strokeWidth="1.2" opacity="0.4" strokeLinecap="round" />

        {/* Building 1 (left) - walls */}
        <rect x="4" y="15" width="10" height="10" rx="0.5" fill="#C49A6C" stroke="#8B5A2B" strokeWidth="0.6" />
        {/* Building 1 - roof (triangle) */}
        <polygon points="2,15 9,8 16,15" fill="#6B3E1F" stroke="#5A2E10" strokeWidth="0.6" strokeLinejoin="round" />
        {/* Building 1 - roof highlight */}
        <polygon points="6,13 9,9 12,13" fill="#7A4E28" opacity="0.3" />
        {/* Building 1 - door */}
        <rect x="7" y="20" width="3" height="5" rx="0.3" fill="#5A2E10" />

        {/* Building 2 (right) - walls */}
        <rect x="20" y="17" width="12" height="8" rx="0.5" fill="#B8925C" stroke="#8B5A2B" strokeWidth="0.6" />
        {/* Building 2 - roof (triangle) */}
        <polygon points="18,17 26,11 34,17" fill="#6B3E1F" stroke="#5A2E10" strokeWidth="0.6" strokeLinejoin="round" />
        {/* Building 2 - roof highlight */}
        <polygon points="22,15 26,12 30,15" fill="#7A4E28" opacity="0.3" />
        {/* Building 2 - door */}
        <rect x="24" y="20" width="3" height="5" rx="0.3" fill="#5A2E10" />

        {/* Building 3 (small, between/middle) - walls */}
        <rect x="14" y="20" width="7" height="5" rx="0.4" fill="#C49A6C" stroke="#8B5A2B" strokeWidth="0.5" />
        {/* Building 3 - roof */}
        <polygon points="12,20 17.5,16 23,20" fill="#6B3E1F" stroke="#5A2E10" strokeWidth="0.5" strokeLinejoin="round" />
        {/* Building 3 - door */}
        <rect x="16" y="22" width="2" height="3" rx="0.2" fill="#5A2E10" />

        {/* Window highlights (tiny lit squares) */}
        <rect x="5.5" y="17" width="1.5" height="1.5" fill="#F5D060" opacity="0.4" rx="0.2" />
        <rect x="22" y="19" width="1.5" height="1.5" fill="#F5D060" opacity="0.4" rx="0.2" />
    </g>
));

SettlementSVG.displayName = "SettlementSVG";

export default SettlementSVG;
