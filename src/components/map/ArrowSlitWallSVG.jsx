import React from "react";

const ArrowSlitWallSVG = React.forwardRef(({ id, className, ...rest }, ref) => (
    <g ref={ref} id={id} className={className} {...rest}>
        <rect x="0" y="0" width="36" height="36" fill="#696969" opacity="0.85" />
        <polygon points="16,4 20,4 30,36 6,36" fill="#2a2a2a" />
        <polygon points="16,4 18,4 17,12 13,36 6,36" fill="#3a3a3a" opacity="0.4" />
        <polygon points="20,4 18,4 19,12 23,36 30,36" fill="#4a4a4a" opacity="0.3" />
        <line x1="18" y1="4" x2="18" y2="36" stroke="#4a4a4a" strokeWidth="1" />
    </g>
));

ArrowSlitWallSVG.displayName = "ArrowSlitWallSVG";

export default ArrowSlitWallSVG;
