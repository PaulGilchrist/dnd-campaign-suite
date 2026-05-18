import React from "react";

const BedSVG = React.forwardRef(({ id, className, ...rest }, ref) => (
    <g ref={ref} id={id} className={className} {...rest}>
        {/* Wooden frame - outer border with rounded corners */}
        <rect
            x="2"
            y="4"
            width="68"
            height="28"
            rx="3"
            ry="3"
            fill="#A0652D"
            stroke="#6B3E1F"
            strokeWidth="0.8"
        />

        {/* Mattress - inner rectangle, lighter wood */}
        <rect
            x="6"
            y="8"
            width="60"
            height="20"
            rx="2"
            ry="2"
            fill="#D4A574"
            stroke="#B87A3A"
            strokeWidth="0.5"
        />

        {/* Pillow - on LEFT end, cream colored */}
        <rect
            x="4"
            y="10"
            width="14"
            height="16"
            rx="4"
            ry="4"
            fill="#F5F0E8"
            stroke="#D4CFC4"
            strokeWidth="0.5"
        />
        {/* Pillow shading - left side darker */}
        <rect
            x="4"
            y="10"
            width="5"
            height="16"
            rx="4"
            ry="4"
            fill="#E0DBD0"
            opacity="0.5"
        />
        {/* Pillow highlight - right side lighter */}
        <rect
            x="13"
            y="10"
            width="5"
            height="16"
            rx="4"
            ry="4"
            fill="#FAF7F2"
            opacity="0.4"
        />

        {/* Blanket - draped over right side, deep blue */}
        <rect
            x="20"
            y="6"
            width="46"
            height="24"
            rx="2"
            ry="2"
            fill="#3B5998"
            stroke="#2A4070"
            strokeWidth="0.5"
        />
        {/* Blanket fold/edge detail */}
        <rect
            x="20"
            y="28"
            width="46"
            height="3"
            rx="1"
            ry="1"
            fill="#2A4070"
            opacity="0.6"
        />
        {/* Blanket shading - left side darker */}
        <rect
            x="20"
            y="6"
            width="12"
            height="24"
            rx="2"
            ry="2"
            fill="#2A4070"
            opacity="0.3"
        />
        {/* Blanket highlight - right side lighter */}
        <rect
            x="50"
            y="6"
            width="16"
            height="24"
            fill="#4A6FB5"
            opacity="0.3"
        />

        {/* Blanket fold line */}
        <path
            d="M 20 18 Q 24 17 28 18"
            fill="none"
            stroke="#2A4070"
            strokeWidth="0.5"
            opacity="0.5"
        />

        {/* Wood grain lines on frame edges */}
        <path
            d="M 8 10 Q 14 9 20 10"
            fill="none"
            stroke="#7A4E20"
            strokeWidth="0.3"
            opacity="0.4"
        />
        <path
            d="M 8 26 Q 14 25 20 26"
            fill="none"
            stroke="#7A4E20"
            strokeWidth="0.3"
            opacity="0.4"
        />
        <path
            d="M 56 10 Q 62 9 66 10"
            fill="none"
            stroke="#7A4E20"
            strokeWidth="0.3"
            opacity="0.4"
        />
        <path
            d="M 56 26 Q 62 25 66 26"
            fill="none"
            stroke="#7A4E20"
            strokeWidth="0.3"
            opacity="0.4"
        />

        {/* Left side shading (darker frame) */}
        <rect
            x="2"
            y="4"
            width="10"
            height="28"
            rx="3"
            ry="3"
            fill="#8B5524"
            opacity="0.35"
        />

        {/* Right side highlight (lighter frame) */}
        <rect
            x="58"
            y="4"
            width="12"
            height="28"
            fill="#B87A3A"
            opacity="0.3"
        />

        {/* Top edge bevel highlight */}
        <rect
            x="4"
            y="5"
            width="64"
            height="1.5"
            rx="1"
            fill="#C4944A"
            opacity="0.4"
        />

        {/* Front edge subtle shadow */}
        <rect
            x="4"
            y="30"
            width="64"
            height="1.5"
            fill="#6B3E1F"
            opacity="0.3"
        />
    </g>
));

BedSVG.displayName = "BedSVG";

export default BedSVG;
