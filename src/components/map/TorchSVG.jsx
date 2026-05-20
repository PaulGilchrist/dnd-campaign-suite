import React from "react";

const TorchSVG = React.forwardRef(({ id, className, ...rest }, ref) => (
    <g ref={ref} id={id} className={className} {...rest}>
        {/* Handle/stick */}
        <rect
            x="16"
            y="20"
            width="4"
            height="14"
            fill="#8B5E3C"
            stroke="#6B3E1F"
            strokeWidth="0.6"
            rx="0.5"
        />
        {/* Wood grain on stick */}
        <rect x="17" y="20" width="1" height="14" fill="#7A4E20" opacity="0.4" />
        <line x1="19" y1="22" x2="19" y2="32" stroke="#7A4E20" strokeWidth="0.3" opacity="0.3" />

        {/* Wall mount bracket */}
        <rect x="2" y="22" width="14" height="2" fill="#666" stroke="#555" strokeWidth="0.4" rx="0.3" />
        <rect x="2" y="26" width="10" height="2" fill="#666" stroke="#555" strokeWidth="0.4" rx="0.3" />
        <rect x="2" y="22" width="2" height="6" fill="#777" />

        {/* Metal cup/sconce */}
        <path
            d="M 13 20 L 14 16 L 22 16 L 23 20 Z"
            fill="#666"
            stroke="#555"
            strokeWidth="0.6"
        />
        <rect x="13" y="19" width="10" height="1.5" fill="#777" rx="0.3" />
        {/* Cup top rim highlight */}
        <rect x="14" y="16" width="8" height="0.5" fill="#888" />

        {/* Fuel/wick */}
        <rect x="17.5" y="14" width="1" height="2.5" fill="#444" />

        {/* Flame - outer (orange) */}
        <path
            d="M 18 14 Q 12 10 14 5 Q 16 2 18 0 Q 20 2 22 5 Q 24 10 18 14 Z"
            fill="#E67E22"
        />
        {/* Flame - middle (yellow) */}
        <path
            d="M 18 14 Q 14 10 16 6 Q 17 3 18 2 Q 19 3 20 6 Q 22 10 18 14 Z"
            fill="#F1C40F"
        />
        {/* Flame - core (white hot) */}
        <path
            d="M 18 14 Q 16 11 17 8 Q 18 6 18 5 Q 18 6 19 8 Q 20 11 18 14 Z"
            fill="#FFF9C4"
            opacity="0.8"
        />
        {/* Ambient glow */}
        <ellipse cx="18" cy="7" rx="10" ry="8" fill="#E67E22" opacity="0.12" />
    </g>
));

TorchSVG.displayName = "TorchSVG";

export default TorchSVG;
