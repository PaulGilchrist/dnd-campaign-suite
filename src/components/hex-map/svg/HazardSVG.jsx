import React from "react";

const HazardSVG = React.forwardRef(({ id, className, ...rest }, ref) => (
    <g ref={ref} id={id} className={className} {...rest}>
        {/* Warning glow background */}
        <circle cx="18" cy="18" r="15" fill="#C62828" opacity="0.06" />
        <circle cx="18" cy="18" r="11" fill="#C62828" opacity="0.04" />

        {/* Skull - cranium */}
        <ellipse cx="18" cy="16" rx="7" ry="8" fill="#E0E0E0" stroke="#424242" strokeWidth="0.8" />

        {/* Skull - upper cranium highlight */}
        <ellipse cx="18" cy="12" rx="5" ry="4" fill="#FAFAFA" opacity="0.4" />

        {/* Skull - jaw */}
        <path d="M 11 18 Q 11 25 18 25 Q 25 25 25 18" fill="#E0E0E0" stroke="#424242" strokeWidth="0.6" />
        {/* Skull - teeth */}
        <rect x="13" y="20" width="2" height="2.5" rx="0.3" fill="#FAFAFA" stroke="#424242" strokeWidth="0.3" />
        <rect x="16" y="20" width="2" height="2.5" rx="0.3" fill="#FAFAFA" stroke="#424242" strokeWidth="0.3" />
        <rect x="19" y="20" width="2" height="2.5" rx="0.3" fill="#FAFAFA" stroke="#424242" strokeWidth="0.3" />
        <rect x="22" y="20" width="1.5" height="2.5" rx="0.3" fill="#FAFAFA" stroke="#424242" strokeWidth="0.3" />
        {/* Teeth - bottom row */}
        <rect x="14" y="22.5" width="1.5" height="1.5" rx="0.2" fill="#FAFAFA" stroke="#424242" strokeWidth="0.3" />
        <rect x="17" y="22.5" width="1.5" height="1.5" rx="0.2" fill="#FAFAFA" stroke="#424242" strokeWidth="0.3" />
        <rect x="20" y="22.5" width="1.5" height="1.5" rx="0.2" fill="#FAFAFA" stroke="#424242" strokeWidth="0.3" />

        {/* Skull - eyes (hollow dark sockets) */}
        <ellipse cx="14.5" cy="14" rx="2.2" ry="2.5" fill="#424242" />
        <ellipse cx="21.5" cy="14" rx="2.2" ry="2.5" fill="#424242" />
        {/* Eye socket highlights */}
        <ellipse cx="14.5" cy="14" rx="2.2" ry="2.5" fill="none" stroke="#333" strokeWidth="0.3" />
        <ellipse cx="21.5" cy="14" rx="2.2" ry="2.5" fill="none" stroke="#333" strokeWidth="0.3" />
        {/* Red glow in eyes */}
        <ellipse cx="14.5" cy="14" rx="1.2" ry="1.5" fill="#EF5350" opacity="0.5" />
        <ellipse cx="21.5" cy="14" rx="1.2" ry="1.5" fill="#EF5350" opacity="0.5" />

        {/* Skull - nose (triangular) */}
        <polygon points="17,16 19,16 18,18" fill="#424242" />

        {/* Crossbones behind skull */}
        <line x1="6" y1="8" x2="30" y2="28" stroke="#424242" strokeWidth="2.5" strokeLinecap="round" />
        <line x1="30" y1="8" x2="6" y2="28" stroke="#424242" strokeWidth="2.5" strokeLinecap="round" />
        {/* Crossbone highlights */}
        <line x1="7" y1="9" x2="29" y2="27" stroke="#666" strokeWidth="0.9" strokeLinecap="round" />
        <line x1="29" y1="9" x2="7" y2="27" stroke="#666" strokeWidth="0.9" strokeLinecap="round" />
        {/* Bone ends (knobs) */}
        <circle cx="6" cy="8" r="1.8" fill="#424242" />
        <circle cx="30" cy="8" r="1.8" fill="#424242" />
        <circle cx="6" cy="28" r="1.8" fill="#424242" />
        <circle cx="30" cy="28" r="1.8" fill="#424242" />
        {/* Bone end highlights */}
        <circle cx="6" cy="8" r="0.8" fill="#666" />
        <circle cx="30" cy="8" r="0.8" fill="#666" />
        <circle cx="6" cy="28" r="0.8" fill="#666" />
        <circle cx="30" cy="28" r="0.8" fill="#666" />

        {/* Venom drip from jaw */}
        <path d="M 16 25 Q 16 28 15.5 30" fill="none" stroke="#7CB342" strokeWidth="1" strokeLinecap="round" opacity="0.6" />
        <circle cx="15.5" cy="31" r="0.8" fill="#7CB342" opacity="0.5" />
    </g>
));

HazardSVG.displayName = "HazardSVG";

export default HazardSVG;
