import React from "react";

const DoorSVG = React.forwardRef(({ id, className, ...rest }, ref) => (
    <g ref={ref} id={id} className={className} {...rest}>
        {/* Main board body */}
        <rect
            x="15"
            y="0"
            width="6"
            height="36"
            fill="#8B5A2B"
        />

        {/* Wood grain lines (subtle darker streaks) */}
        <line
            x1="16.5"
            y1="0"
            x2="16.5"
            y2="36"
            stroke="#6B3E1F"
            strokeWidth="0.3"
            opacity="0.5"
        />
        <line
            x1="19.5"
            y1="0"
            x2="19.5"
            y2="36"
            stroke="#6B3E1F"
            strokeWidth="0.3"
            opacity="0.5"
        />

        {/* Highlight edge (lighter side for subtle 3D) */}
        <rect
            x="15"
            y="0"
            width="0.5"
            height="36"
            fill="#A0652D"
            opacity="0.6"
        />
    </g>
));

DoorSVG.displayName = "DoorSVG";

export default DoorSVG;
