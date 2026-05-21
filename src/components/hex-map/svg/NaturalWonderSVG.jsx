import React from "react";

const NaturalWonderSVG = React.forwardRef(({ id, className, ...rest }, ref) => (
    <g ref={ref} id={id} className={className} {...rest}>
        {/* Magic glow aura */}
        <circle cx="18" cy="18" r="16" fill="#4A90D9" opacity="0.06" />
        <circle cx="18" cy="18" r="12" fill="#7CB342" opacity="0.06" />
        <circle cx="18" cy="18" r="8" fill="#C5E1A5" opacity="0.05" />

        {/* Crystal base / ground shadow */}
        <ellipse cx="18" cy="28" rx="10" ry="3" fill="#7CB342" opacity="0.15" />

        {/* Crystal - left facet */}
        <polygon points="18,2 8,14 10,24 18,28" fill="#6B9B37" stroke="#558B2F" strokeWidth="0.6" strokeLinejoin="round" />

        {/* Crystal - right facet */}
        <polygon points="18,2 28,14 26,24 18,28" fill="#7CB342" stroke="#558B2F" strokeWidth="0.6" strokeLinejoin="round" />

        {/* Crystal - front facet */}
        <polygon points="18,2 14,20 18,28 22,20" fill="#8BC34A" stroke="#558B2F" strokeWidth="0.5" strokeLinejoin="round" />

        {/* Crystal - top facet (left) */}
        <polygon points="18,2 12,12 18,12" fill="#9CCC65" stroke="#558B2F" strokeWidth="0.4" strokeLinejoin="round" />

        {/* Crystal - top facet (right) */}
        <polygon points="18,2 18,12 24,12" fill="#AED581" stroke="#558B2F" strokeWidth="0.4" strokeLinejoin="round" />

        {/* Crystal highlight (sparkle on front facet) */}
        <polygon points="18,6 15,18 18,24 21,18" fill="#C5E1A5" opacity="0.4" />

        {/* Inner glow line */}
        <line x1="18" y1="4" x2="18" y2="26" stroke="#DCEDC8" strokeWidth="0.5" opacity="0.5" />

        {/* Sparkles / magic particles around crystal */}
        {/* Sparkle 1 (top-left) */}
        <path d="M 5 6 L 5.5 5 L 6 6 L 5.5 7 Z" fill="#C5E1A5" opacity="0.8" />
        <path d="M 5 6 L 6 6" stroke="#FFF" strokeWidth="0.3" opacity="0.6" />

        {/* Sparkle 2 (top-right) */}
        <path d="M 30 4 L 30.5 3 L 31 4 L 30.5 5 Z" fill="#C5E1A5" opacity="0.8" />
        <path d="M 30 4 L 31 4" stroke="#FFF" strokeWidth="0.3" opacity="0.6" />

        {/* Sparkle 3 (left) */}
        <path d="M 3 16 L 3.5 15 L 4 16 L 3.5 17 Z" fill="#C5E1A5" opacity="0.6" />

        {/* Sparkle 4 (right) */}
        <path d="M 32 14 L 32.5 13 L 33 14 L 32.5 15 Z" fill="#C5E1A5" opacity="0.7" />

        {/* Sparkle 5 (bottom) */}
        <path d="M 20 32 L 20.5 31 L 21 32 L 20.5 33 Z" fill="#C5E1A5" opacity="0.5" />

        {/* Floating light motes */}
        <circle cx="10" cy="8" r="0.6" fill="#C5E1A5" opacity="0.6" />
        <circle cx="26" cy="10" r="0.5" fill="#DCEDC8" opacity="0.5" />
        <circle cx="8" cy="20" r="0.4" fill="#C5E1A5" opacity="0.4" />
        <circle cx="28" cy="22" r="0.5" fill="#DCEDC8" opacity="0.4" />
        <circle cx="14" cy="4" r="0.4" fill="#FFF" opacity="0.5" />
        <circle cx="22" cy="3" r="0.5" fill="#FFF" opacity="0.4" />

        {/* Small crystals at base */}
        <polygon points="12,28 13,24 14,28" fill="#7CB342" stroke="#558B2F" strokeWidth="0.3" />
        <polygon points="22,28 23.5,25 25,28" fill="#8BC34A" stroke="#558B2F" strokeWidth="0.3" />
    </g>
));

NaturalWonderSVG.displayName = "NaturalWonderSVG";

export default NaturalWonderSVG;
