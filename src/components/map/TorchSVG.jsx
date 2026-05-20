import React from "react";

const TorchSVG = React.forwardRef(({ id, className, ...rest }, ref) => (
    <g ref={ref} id={id} className={className} {...rest}>
        {/* Wall section (narrower stone strip on LEFT side) */}
        <rect x="0" y="0" width="3" height="36" fill="#777" stroke="#555" strokeWidth="0.4" />
        {/* Wall edge shadow */}
        <rect x="3" y="0" width="1" height="36" fill="#333" opacity="0.3" />
        {/* Stone texture on wall */}
        <line x1="0" y1="9" x2="3" y2="9" stroke="#666" strokeWidth="0.3" />
        <line x1="0" y1="18" x2="3" y2="18" stroke="#666" strokeWidth="0.3" />
        <line x1="0" y1="27" x2="3" y2="27" stroke="#666" strokeWidth="0.3" />

        {/* Bracket arm (shorter — extends 5px from wall) */}
        <rect x="3" y="16" width="5" height="2.5" fill="#666" stroke="#555" strokeWidth="0.5" rx="0.3" />
        {/* Bracket brace (angled support) */}
        <line x1="3" y1="18.5" x2="6" y2="20" stroke="#666" strokeWidth="1.5" strokeLinecap="round" />
        {/* Bracket highlight */}
        <rect x="3" y="16" width="5" height="0.5" fill="#888" opacity="0.4" />

        {/* Bracket-to-sconce connection */}
        <circle cx="8" cy="18" r="1" fill="#555" />

        {/* Sconce ring (outer metal cup — close to wall) */}
        <circle cx="12" cy="18" r="3.5" fill="#666" stroke="#555" strokeWidth="0.6" />
        {/* Sconce rim highlight */}
        <circle cx="12" cy="18" r="3" fill="none" stroke="#888" strokeWidth="0.3" opacity="0.5" />
        {/* Sconce interior (dark inside of cup) */}
        <circle cx="12" cy="18" r="2.5" fill="#333" />

        {/* Ambient glow around flame */}
        <circle cx="12" cy="18" r="8" fill="#E67E22" opacity="0.1" />

        {/* Flame — outer orange */}
        <ellipse cx="12" cy="18" rx="2" ry="2.2" fill="#E67E22" />
        {/* Flame — middle yellow */}
        <ellipse cx="12" cy="18" rx="1.3" ry="1.5" fill="#F1C40F" />
        {/* Flame — inner hot core */}
        <ellipse cx="12" cy="18" rx="0.6" ry="0.8" fill="#FFF9C4" opacity="0.8" />
    </g>
));

TorchSVG.displayName = "TorchSVG";
export default TorchSVG;
