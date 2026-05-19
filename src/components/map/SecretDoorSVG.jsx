import React from "react";

const SecretDoorSVG = React.forwardRef(({ id, className, ...rest }, ref) => (
    <g ref={ref} id={id} className={className} {...rest}>
        {/* Main board body — dark red */}
        <rect
            x="0"
            y="0"
            width="36"
            height="36"
            fill="#8B1A1A"
        />

        {/* Wood grain lines (subtle darker streaks) */}
        <line
            x1="6"
            y1="0"
            x2="6"
            y2="36"
            stroke="#5C1010"
            strokeWidth="0.3"
            opacity="0.5"
        />
        <line
            x1="12"
            y1="0"
            x2="12"
            y2="36"
            stroke="#5C1010"
            strokeWidth="0.3"
            opacity="0.5"
        />
        <line
            x1="18"
            y1="0"
            x2="18"
            y2="36"
            stroke="#5C1010"
            strokeWidth="0.3"
            opacity="0.5"
        />
        <line
            x1="24"
            y1="0"
            x2="24"
            y2="36"
            stroke="#5C1010"
            strokeWidth="0.3"
            opacity="0.5"
        />
        <line
            x1="30"
            y1="0"
            x2="30"
            y2="36"
            stroke="#5C1010"
            strokeWidth="0.3"
            opacity="0.5"
        />

        {/* Highlight edge (lighter side for subtle 3D) */}
        <rect
            x="0"
            y="0"
            width="0.5"
            height="36"
            fill="#A02020"
            opacity="0.6"
        />

        {/* "S" letter centered in the board */}
        <text
            x="18"
            y="18"
            textAnchor="middle"
            dominantBaseline="central"
            fontSize="14"
            fontWeight="bold"
            fill="#D4A0A0"
            fontFamily="Georgia, serif"
        >
            S
        </text>
    </g>
));

SecretDoorSVG.displayName = "SecretDoorSVG";

export default SecretDoorSVG;
