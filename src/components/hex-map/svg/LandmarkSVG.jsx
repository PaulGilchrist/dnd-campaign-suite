import React from "react";

const LandmarkSVG = React.forwardRef(({ id, className, ...rest }, ref) => (
    <g ref={ref} id={id} className={className} {...rest}>
        {/* Ground shadow */}
        <ellipse cx="18" cy="30" rx="12" ry="4" fill="#616161" opacity="0.12" />

        {/* Obelisk - main body / back face (darker) */}
        <polygon points="14,4 22,4 24,30 12,30" fill="#757575" stroke="#616161" strokeWidth="0.6" strokeLinejoin="round" />

        {/* Obelisk - left face (shadow side) */}
        <polygon points="14,4 18,4 18,30 12,30" fill="#616161" stroke="#555" strokeWidth="0.4" strokeLinejoin="round" />

        {/* Obelisk - right face (lit side) */}
        <polygon points="18,4 22,4 24,30 18,30" fill="#8D8D8D" stroke="#757575" strokeWidth="0.4" strokeLinejoin="round" />

        {/* Obelisk - pyramidion (top point) - back */}
        <polygon points="14,4 22,4 18,0" fill="#8D8D8D" stroke="#616161" strokeWidth="0.5" strokeLinejoin="round" />

        {/* Obelisk - pyramidion (top point) - left */}
        <polygon points="14,4 18,4 18,0" fill="#757575" stroke="#616161" strokeWidth="0.4" strokeLinejoin="round" />

        {/* Obelisk - pyramidion (top point) - right */}
        <polygon points="18,4 22,4 18,0" fill="#A8A8A8" stroke="#8D8D8D" strokeWidth="0.4" strokeLinejoin="round" />

        {/* Right face highlight streak */}
        <polygon points="19,6 21,6 22,28 19,28" fill="#A8A8A8" opacity="0.25" />

        {/* Stone texture lines */}
        <line x1="13" y1="8" x2="23" y2="8" stroke="#666" strokeWidth="0.3" opacity="0.35" />
        <line x1="12.5" y1="14" x2="23.5" y2="14" stroke="#666" strokeWidth="0.3" opacity="0.35" />
        <line x1="12.5" y1="20" x2="23.5" y2="20" stroke="#666" strokeWidth="0.3" opacity="0.35" />
        <line x1="12" y1="26" x2="24" y2="26" stroke="#666" strokeWidth="0.3" opacity="0.35" />

        {/* Weathering / cracks */}
        <path d="M 16 10 L 17 14 L 15.5 17" fill="none" stroke="#555" strokeWidth="0.3" opacity="0.4" />
        <path d="M 20 22 L 21 25 L 19.5 27" fill="none" stroke="#555" strokeWidth="0.3" opacity="0.35" />

        {/* Base plinth */}
        <rect x="10" y="28" width="16" height="3" rx="0.5" fill="#8D8D8D" stroke="#616161" strokeWidth="0.5" />
        {/* Plinth highlight */}
        <rect x="10" y="28" width="16" height="0.6" fill="#A8A8A8" opacity="0.3" rx="0.2" />
        {/* Plinth shadow */}
        <rect x="10" y="30" width="16" height="1" fill="#616161" opacity="0.3" rx="0.2" />

        {/* Hieroglyphic / inscription details on face */}
        <circle cx="18" cy="10" r="0.8" fill="none" stroke="#C8A870" strokeWidth="0.4" opacity="0.4" />
        <path d="M 17 13 L 19 13 L 18 14.5 Z" fill="none" stroke="#C8A870" strokeWidth="0.3" opacity="0.35" />
        <path d="M 17.5 16 Q 18 17 18.5 16" fill="none" stroke="#C8A870" strokeWidth="0.3" opacity="0.3" />

        {/* Small birds for scale (tiny V shapes) */}
        <path d="M 5 6 Q 6 4 7 6" fill="none" stroke="#616161" strokeWidth="0.4" opacity="0.3" />
        <path d="M 8 4 Q 9 2 10 4" fill="none" stroke="#616161" strokeWidth="0.4" opacity="0.25" />
        <path d="M 29 5 Q 30 3 31 5" fill="none" stroke="#616161" strokeWidth="0.4" opacity="0.25" />
    </g>
));

LandmarkSVG.displayName = "LandmarkSVG";

export default LandmarkSVG;
