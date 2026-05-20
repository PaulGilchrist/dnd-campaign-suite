import React from "react";

const TorchSVG = React.forwardRef(({ id, className, ...rest }, ref) => (
    <g ref={ref} id={id} className={className} {...rest}>
        {/* Wall section (stone strip on LEFT side) */}
        <rect x="0" y="0" width="5" height="36" fill="#777" stroke="#555" strokeWidth="0.4" />
        {/* Wall edge shadow */}
        <rect x="4" y="0" width="1" height="36" fill="#333" opacity="0.3" />
        {/* Stone texture on wall */}
        <line x1="0" y1="9" x2="5" y2="9" stroke="#666" strokeWidth="0.3" />
        <line x1="0" y1="18" x2="5" y2="18" stroke="#666" strokeWidth="0.3" />
        <line x1="0" y1="27" x2="5" y2="27" stroke="#666" strokeWidth="0.3" />

        {/* Bracket arm extending from wall */}
        <rect x="5" y="16" width="10" height="3" fill="#666" stroke="#555" strokeWidth="0.5" rx="0.3" />
        {/* Bracket brace (angled support) */}
        <line x1="5" y1="19" x2="11" y2="22" stroke="#666" strokeWidth="1.5" strokeLinecap="round" />
        {/* Bracket highlight */}
        <rect x="5" y="16" width="10" height="0.5" fill="#888" opacity="0.4" />

        {/* Sconce ring (outer metal cup) */}
        <circle cx="22" cy="18" r="5.5" fill="#666" stroke="#555" strokeWidth="0.6" />
        {/* Sconce rim highlight */}
        <circle cx="22" cy="18" r="5" fill="none" stroke="#888" strokeWidth="0.3" opacity="0.5" />
        {/* Sconce interior (dark inside of cup) */}
        <circle cx="22" cy="18" r="3.8" fill="#333" />

        {/* Ambient glow around flame */}
        <circle cx="22" cy="18" r="10" fill="#E67E22" opacity="0.12" />

        {/* Flame — outer orange */}
        <ellipse cx="22" cy="18" rx="2.8" ry="3.2" fill="#E67E22" />
        {/* Flame — middle yellow */}
        <ellipse cx="22" cy="18" rx="1.8" ry="2.2" fill="#F1C40F" />
        {/* Flame — inner hot core */}
        <ellipse cx="22" cy="18" rx="0.8" ry="1" fill="#FFF9C4" opacity="0.8" />

        {/* Sconce connection ring (where bracket meets sconce) */}
        <circle cx="16" cy="18" r="1.5" fill="#555" />
    </g>
));

TorchSVG.displayName = "TorchSVG";
export default TorchSVG;
