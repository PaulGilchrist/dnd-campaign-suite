import React from "react";

const CrateSVG = React.forwardRef(({ id, className, ...rest }, ref) => (
    <g ref={ref} id={id} className={className} {...rest}>
        {/* Main crate body */}
        <rect
            x="4"
            y="6"
            width="28"
            height="26"
            rx="1"
            fill="#C4A265"
            stroke="#7A5E30"
            strokeWidth="0.8"
        />

        {/* Vertical slat - left */}
        <rect
            x="6"
            y="6"
            width="5"
            height="26"
            fill="#B8935A"
            stroke="#7A5E30"
            strokeWidth="0.4"
        />
        {/* Vertical slat - center */}
        <rect
            x="15.5"
            y="6"
            width="5"
            height="26"
            fill="#B8935A"
            stroke="#7A5E30"
            strokeWidth="0.4"
        />
        {/* Vertical slat - right */}
        <rect
            x="25"
            y="6"
            width="5"
            height="26"
            fill="#B8935A"
            stroke="#7A5E30"
            strokeWidth="0.4"
        />

        {/* Horizontal slat - top */}
        <rect
            x="4"
            y="8"
            width="28"
            height="3.5"
            fill="#C4A265"
            stroke="#7A5E30"
            strokeWidth="0.4"
        />
        {/* Horizontal slat - middle */}
        <rect
            x="4"
            y="17.5"
            width="28"
            height="3.5"
            fill="#C4A265"
            stroke="#7A5E30"
            strokeWidth="0.4"
        />
        {/* Horizontal slat - bottom */}
        <rect
            x="4"
            y="27"
            width="28"
            height="3.5"
            fill="#C4A265"
            stroke="#7A5E30"
            strokeWidth="0.4"
        />

        {/* Cross-bracing - diagonal left-to-right */}
        <line x1="6" y1="8" x2="30" y2="30" stroke="#7A5E30" strokeWidth="1.2" />
        <line x1="6" y1="8" x2="30" y2="30" stroke="#9A7A40" strokeWidth="0.5" />
        {/* Cross-bracing - diagonal right-to-left */}
        <line x1="30" y1="8" x2="6" y2="30" stroke="#7A5E30" strokeWidth="1.2" />
        <line x1="30" y1="8" x2="6" y2="30" stroke="#9A7A40" strokeWidth="0.5" />

        {/* Nail heads */}
        <circle cx="8" cy="10" r="0.8" fill="#666" />
        <circle cx="8" cy="19" r="0.8" fill="#666" />
        <circle cx="8" cy="28.5" r="0.8" fill="#666" />
        <circle cx="18" cy="10" r="0.8" fill="#666" />
        <circle cx="18" cy="19" r="0.8" fill="#666" />
        <circle cx="18" cy="28.5" r="0.8" fill="#666" />
        <circle cx="28" cy="10" r="0.8" fill="#666" />
        <circle cx="28" cy="19" r="0.8" fill="#666" />
        <circle cx="28" cy="28.5" r="0.8" fill="#666" />

        {/* Left side shading */}
        <rect x="4" y="6" width="4" height="26" fill="#7A5E30" opacity="0.15" rx="0.5" />
        {/* Bottom shadow */}
        <rect x="4" y="30" width="28" height="2" fill="#7A5E30" opacity="0.25" rx="0.5" />
    </g>
));

CrateSVG.displayName = "CrateSVG";

export default CrateSVG;
