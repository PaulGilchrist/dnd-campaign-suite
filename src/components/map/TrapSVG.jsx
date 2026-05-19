import React from "react";

const TrapSVG = React.forwardRef(({ id, className, ...rest }, ref) => (
    <g ref={ref} id={id} className={className} {...rest}>
        {/* Border around the grid square */}
        <rect x="1" y="1" width="34" height="34" fill="none" stroke="#8B1A1A" strokeWidth="2" />
        {/* X connecting corners - top-left to bottom-right */}
        <line x1="4" y1="4" x2="32" y2="32" stroke="#8B1A1A" strokeWidth="2.5" />
        {/* X connecting corners - top-right to bottom-left */}
        <line x1="32" y1="4" x2="4" y2="32" stroke="#8B1A1A" strokeWidth="2.5" />
    </g>
));

TrapSVG.displayName = "TrapSVG";

export default TrapSVG;
