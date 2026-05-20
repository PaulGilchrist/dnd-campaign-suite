import React from "react";

const ChairSVG = React.forwardRef(({ id, className, ...rest }, ref) => (
    <g ref={ref} id={id} className={className} {...rest}>
        {/* Backrest - tall main panel */}
        <rect
            x="8"
            y="4"
            width="20"
            height="22"
            rx="2"
            fill="#5C3317"
            stroke="#4A2810"
            strokeWidth="0.8"
        />
        {/* Backrest inner panel */}
        <rect x="10" y="6" width="16" height="18" rx="1" fill="#4A2810" />
        {/* Backrest top arch */}
        <path
            d="M 8 6 Q 18 1 28 6"
            fill="none"
            stroke="#D4AF37"
            strokeWidth="1.5"
        />
        {/* Backrest inner decorative circle */}
        <circle cx="18" cy="12" r="4" fill="none" stroke="#D4AF37" strokeWidth="0.5" opacity="0.5" />
        <circle cx="18" cy="12" r="2" fill="none" stroke="#8B0000" strokeWidth="0.6" opacity="0.6" />

        {/* Gold trim - backrest sides */}
        <rect x="8" y="4" width="1.2" height="22" fill="#D4AF37" opacity="0.6" rx="0.3" />
        <rect x="26.8" y="4" width="1.2" height="22" fill="#D4AF37" opacity="0.6" rx="0.3" />

        {/* Seat cushion */}
        <rect
            x="6"
            y="24"
            width="24"
            height="6"
            rx="1.5"
            fill="#8B0000"
            stroke="#6B0000"
            strokeWidth="0.6"
        />
        {/* Seat cushion highlight */}
        <rect x="7" y="24" width="22" height="1.5" rx="0.5" fill="#A00000" opacity="0.4" />
        {/* Seat cushion bottom shadow */}
        <rect x="7" y="28.5" width="22" height="1" fill="#6B0000" opacity="0.3" rx="0.3" />

        {/* Left armrest */}
        <rect x="4" y="16" width="4" height="10" rx="1" fill="#5C3317" stroke="#4A2810" strokeWidth="0.6" />
        <rect x="3" y="15" width="6" height="2" rx="0.5" fill="#5C3317" stroke="#D4AF37" strokeWidth="0.4" />
        {/* Right armrest */}
        <rect x="28" y="16" width="4" height="10" rx="1" fill="#5C3317" stroke="#4A2810" strokeWidth="0.6" />
        <rect x="27" y="15" width="6" height="2" rx="0.5" fill="#5C3317" stroke="#D4AF37" strokeWidth="0.4" />

        {/* Armrest gold tips */}
        <circle cx="5" cy="16" r="1.2" fill="#D4AF37" />
        <circle cx="31" cy="16" r="1.2" fill="#D4AF37" />

        {/* Left leg */}
        <rect x="8" y="30" width="3" height="4" rx="0.3" fill="#5C3317" stroke="#4A2810" strokeWidth="0.4" />
        {/* Right leg */}
        <rect x="25" y="30" width="3" height="4" rx="0.3" fill="#5C3317" stroke="#4A2810" strokeWidth="0.4" />

        {/* Crossbar between legs */}
        <rect x="11" y="32" width="14" height="1.5" fill="#4A2810" rx="0.3" />

        {/* Floor shadow */}
        <rect x="8" y="33" width="20" height="1" fill="#4A2810" opacity="0.25" rx="0.5" />
    </g>
));

ChairSVG.displayName = "ChairSVG";

export default ChairSVG;
