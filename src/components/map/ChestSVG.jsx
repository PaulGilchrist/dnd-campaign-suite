import React from "react";

const ChestSVG = React.forwardRef(({ id, className, ...rest }, ref) => (
    <g ref={ref} id={id} className={className} {...rest}>
        {/* Box body */}
        <rect
            x="6"
            y="16"
            width="24"
            height="15"
            rx="1"
            fill="#8B5E3C"
            stroke="#6B3E1F"
            strokeWidth="0.8"
        />
        {/* Arched lid */}
        <path
            d="M 6 16 Q 6 4 18 4 Q 30 4 30 16 Z"
            fill="#A0703C"
            stroke="#6B3E1F"
            strokeWidth="0.8"
        />
        {/* Lid front (inner darker face) */}
        <path
            d="M 6 16 Q 6 7 18 7 Q 30 7 30 16 Z"
            fill="#8B5E3C"
        />
        {/* Lid highlight */}
        <path
            d="M 8 16 Q 8 8 18 8 Q 28 8 28 16 Z"
            fill="#B8860B"
            opacity="0.25"
        />
        {/* Metal band - top of box */}
        <rect x="6" y="16" width="24" height="1.5" fill="#555" />
        <rect x="6" y="16" width="24" height="0.5" fill="#777" />
        {/* Metal band - middle */}
        <rect x="6.5" y="22" width="23" height="2" fill="#555" rx="0.3" />
        <rect x="6.5" y="22" width="23" height="0.5" fill="#777" />
        {/* Metal band - bottom */}
        <rect x="6" y="29" width="24" height="1.5" fill="#555" rx="0.3" />
        <rect x="6" y="29" width="24" height="0.5" fill="#777" />
        {/* Gold trim on lid edge */}
        <rect x="6.5" y="14" width="23" height="1.2" fill="#D4A017" rx="0.3" />
        {/* Gold trim highlight */}
        <rect x="6.5" y="14" width="23" height="0.4" fill="#F1C40F" opacity="0.5" />
        {/* Lock plate */}
        <rect
            x="14"
            y="21"
            width="8"
            height="6"
            rx="1.5"
            fill="#444"
            stroke="#333"
            strokeWidth="0.5"
        />
        {/* Keyhole */}
        <circle cx="18" cy="24" r="1.5" fill="#D4A017" />
        <rect x="17.5" y="24" width="1" height="2" fill="#D4A017" />
        {/* Left side shading */}
        <rect x="6" y="16" width="4" height="15" fill="#6B3E1F" opacity="0.3" />
        <path
            d="M 6 16 Q 6 4 18 4 L 12 4 Q 8 4 8 16 Z"
            fill="#6B3E1F"
            opacity="0.25"
        />
        {/* Nail heads on bands */}
        <circle cx="8" cy="17" r="0.6" fill="#888" />
        <circle cx="28" cy="17" r="0.6" fill="#888" />
        <circle cx="8" cy="23" r="0.6" fill="#888" />
        <circle cx="28" cy="23" r="0.6" fill="#888" />
        <circle cx="8" cy="30" r="0.6" fill="#888" />
        <circle cx="28" cy="30" r="0.6" fill="#888" />
        {/* Hinge detail left */}
        <rect x="7" y="15.5" width="2" height="1" rx="0.3" fill="#666" />
        {/* Hinge detail right */}
        <rect x="27" y="15.5" width="2" height="1" rx="0.3" fill="#666" />
    </g>
));

ChestSVG.displayName = "ChestSVG";

export default ChestSVG;
