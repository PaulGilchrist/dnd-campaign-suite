import React from "react";

const CrateSVG = React.forwardRef(({ id, className, ...rest }, ref) => (
    <g ref={ref} id={id} className={className} {...rest}>
        {/* Floor shadow (offset slightly) */}
        <rect x="5" y="5" width="28" height="28" rx="0.8" fill="#7A5E30" opacity="0.2" />

        {/* Main crate body */}
        <rect x="4" y="4" width="28" height="28" rx="0.8" fill="#C4A265" stroke="#7A5E30" strokeWidth="0.8" />

        {/* Plank gaps (darker wood between planks) */}
        <rect x="4" y="9" width="28" height="1" fill="#7A5E30" />
        <rect x="4" y="14" width="28" height="1" fill="#7A5E30" />
        <rect x="4" y="19" width="28" height="1" fill="#7A5E30" />
        <rect x="4" y="24" width="28" height="1" fill="#7A5E30" />

        {/* Top planks (horizontal strips) */}
        <rect x="4" y="5" width="28" height="4" fill="#B8935A" stroke="#7A5E30" strokeWidth="0.3" />
        <rect x="4" y="10" width="28" height="4" fill="#B8935A" stroke="#7A5E30" strokeWidth="0.3" />
        <rect x="4" y="15" width="28" height="4" fill="#B8935A" stroke="#7A5E30" strokeWidth="0.3" />
        <rect x="4" y="20" width="28" height="4" fill="#B8935A" stroke="#7A5E30" strokeWidth="0.3" />
        <rect x="4" y="25" width="28" height="4" fill="#B8935A" stroke="#7A5E30" strokeWidth="0.3" />

        {/* Wood grain on planks (subtle) */}
        <line x1="4" y1="7" x2="32" y2="7" stroke="#7A5E30" strokeWidth="0.2" opacity="0.25" />
        <line x1="4" y1="12" x2="32" y2="12" stroke="#7A5E30" strokeWidth="0.2" opacity="0.25" />
        <line x1="4" y1="17" x2="32" y2="17" stroke="#7A5E30" strokeWidth="0.2" opacity="0.25" />
        <line x1="4" y1="22" x2="32" y2="22" stroke="#7A5E30" strokeWidth="0.2" opacity="0.25" />
        <line x1="4" y1="27" x2="32" y2="27" stroke="#7A5E30" strokeWidth="0.2" opacity="0.25" />

        {/* Cross-bracing — X pattern */}
        {/* Diagonal top-left to bottom-right */}
        <line x1="5" y1="5" x2="31" y2="31" stroke="#7A5E30" strokeWidth="1.8" />
        <line x1="5" y1="5" x2="31" y2="31" stroke="#9A7A40" strokeWidth="0.6" />
        {/* Diagonal top-right to bottom-left */}
        <line x1="31" y1="5" x2="5" y2="31" stroke="#7A5E30" strokeWidth="1.8" />
        <line x1="31" y1="5" x2="5" y2="31" stroke="#9A7A40" strokeWidth="0.6" />

        {/* Nail heads — at plank ends and cross-brace intersections */}
        {/* Plank 1 */}
        <circle cx="6" cy="7" r="0.8" fill="#555" />
        <circle cx="30" cy="7" r="0.8" fill="#555" />
        {/* Plank 2 */}
        <circle cx="6" cy="12" r="0.8" fill="#555" />
        <circle cx="30" cy="12" r="0.8" fill="#555" />
        {/* Plank 3 */}
        <circle cx="6" cy="17" r="0.8" fill="#555" />
        <circle cx="30" cy="17" r="0.8" fill="#555" />
        {/* Plank 4 */}
        <circle cx="6" cy="22" r="0.8" fill="#555" />
        <circle cx="30" cy="22" r="0.8" fill="#555" />
        {/* Plank 5 */}
        <circle cx="6" cy="27" r="0.8" fill="#555" />
        <circle cx="30" cy="27" r="0.8" fill="#555" />

        {/* Cross-brace intersection nails (center) */}
        <circle cx="18" cy="18" r="0.8" fill="#555" />

        {/* Bottom and right edge shadow for depth */}
        <rect x="30" y="4" width="2" height="28" fill="#7A5E30" opacity="0.15" rx="0.3" />
        <rect x="4" y="30" width="28" height="2" fill="#7A5E30" opacity="0.15" rx="0.3" />
    </g>
));

CrateSVG.displayName = "CrateSVG";
export default CrateSVG;
