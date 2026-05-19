import React from "react";

const BarrelSVG = React.forwardRef(({ id, className, ...rest }, ref) => (
    <g ref={ref} id={id} className={className} {...rest}>
        {/* Barrel body - curved shape wider in middle */}
        <path
            d="M 10 4 Q 6 18 10 32 L 26 32 Q 30 18 26 4 Z"
            fill="#A0652D"
            stroke="#6B3E1F"
            strokeWidth="0.8"
        />
        {/* Left side shading for depth */}
        <path
            d="M 10 4 Q 6 18 10 32 L 16 32 Q 12 18 16 4 Z"
            fill="#8B5524"
            opacity="0.5"
        />
        {/* Top rim */}
        <ellipse
            cx="18"
            cy="4"
            rx="8"
            ry="2.5"
            fill="#8B5524"
            stroke="#6B3E1F"
            strokeWidth="0.6"
        />
        {/* Bottom rim */}
        <ellipse
            cx="18"
            cy="32"
            rx="8"
            ry="2.5"
            fill="#8B5524"
            stroke="#6B3E1F"
            strokeWidth="0.6"
        />
        {/* Top opening */}
        <ellipse
            cx="18"
            cy="4"
            rx="6"
            ry="1.8"
            fill="#5C3317"
            stroke="#4A2810"
            strokeWidth="0.5"
        />
        {/* Metal band - top */}
        <rect x="9.5" y="10" width="17" height="2" fill="#555" rx="0.5" />
        <rect x="9.5" y="10" width="17" height="0.5" fill="#777" />
        {/* Metal band - middle */}
        <rect x="9" y="18" width="18" height="2" fill="#555" rx="0.5" />
        <rect x="9" y="18" width="18" height="0.5" fill="#777" />
        {/* Metal band - bottom */}
        <rect x="9.5" y="26" width="17" height="2" fill="#555" rx="0.5" />
        <rect x="9.5" y="26" width="17" height="0.5" fill="#777" />
        {/* Right side highlight */}
        <path
            d="M 26 4 Q 30 18 26 32 L 22 32 Q 26 18 22 4 Z"
            fill="#B87A3A"
            opacity="0.4"
        />
        {/* Wood grain lines */}
        <path
            d="M 14 8 Q 13 18 14 28"
            fill="none"
            stroke="#7A4E20"
            strokeWidth="0.4"
            opacity="0.6"
        />
        <path
            d="M 18 7 Q 17 18 18 29"
            fill="none"
            stroke="#7A4E20"
            strokeWidth="0.4"
            opacity="0.6"
        />
        <path
            d="M 22 8 Q 23 18 22 28"
            fill="none"
            stroke="#7A4E20"
            strokeWidth="0.4"
            opacity="0.6"
        />
    </g>
));

BarrelSVG.displayName = "BarrelSVG";

export default BarrelSVG;
