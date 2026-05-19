import React from "react";

const PillarSVG = React.forwardRef(({ id, className, ...rest }, ref) => (
    <g ref={ref} id={id} className={className} {...rest}>
        {/* Main body */}
        <circle cx="18" cy="18" r="7" fill="#888888" />
        {/* Subtle darker ring for depth */}
        <circle cx="18" cy="18" r="6" fill="none" stroke="#666666" strokeWidth="0.8" />
        {/* Highlight arc on upper-left for 3D effect */}
        <path d="M 12 12 A 7 7 0 0 1 18 11" fill="none" stroke="#AAAAAA" strokeWidth="0.8" />
    </g>
));

PillarSVG.displayName = "PillarSVG";

export default PillarSVG;
