import React from "react";

const BushSVG = React.forwardRef(({ id, className, ...rest }, ref) => (
    <g ref={ref} id={id} className={className} {...rest}>
        {/* Shadow */}
        <ellipse cx="18" cy="33" rx="11" ry="2.5" fill="#000" opacity="0.12" />

        {/* Bush body - bottom layer */}
        <circle cx="18" cy="22" r="12" fill="#3D7A4A" stroke="#2D5E37" strokeWidth="0.5" />
        <circle cx="10" cy="24" r="8" fill="#3D7A4A" />
        <circle cx="26" cy="24" r="8" fill="#3D7A4A" />

        {/* Bush body - middle layer */}
        <circle cx="18" cy="20" r="10" fill="#4A9A5A" />
        <circle cx="12" cy="22" r="7" fill="#4A9A5A" />
        <circle cx="24" cy="22" r="7" fill="#4A9A5A" />

        {/* Bush body - top layer */}
        <circle cx="18" cy="18" r="7" fill="#5AAB6A" />
        <circle cx="14" cy="19" r="5" fill="#5AAB6A" />
        <circle cx="22" cy="19" r="5" fill="#5AAB6A" />

        {/* Top highlight */}
        <circle cx="16" cy="16" r="3" fill="#6ABC7A" opacity="0.5" />
        <circle cx="20" cy="17" r="2" fill="#6ABC7A" opacity="0.4" />

        {/* Small branch details */}
        <path d="M 10 20 Q 8 16 9 14" fill="none" stroke="#4A9A5A" strokeWidth="0.8" />
        <path d="M 26 20 Q 28 16 27 14" fill="none" stroke="#4A9A5A" strokeWidth="0.8" />
    </g>
));

BushSVG.displayName = "BushSVG";

export default BushSVG;
