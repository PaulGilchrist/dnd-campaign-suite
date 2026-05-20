import React from "react";

const WebSVG = React.forwardRef(({ id, className, ...rest }, ref) => (
    <g ref={ref} id={id} className={className} {...rest}>
        {/* Radial lines from center outward */}
        <line x1="18" y1="18" x2="2" y2="2" stroke="#CCC" strokeWidth="0.4" opacity="0.6" />
        <line x1="18" y1="18" x2="18" y2="2" stroke="#CCC" strokeWidth="0.4" opacity="0.6" />
        <line x1="18" y1="18" x2="34" y2="2" stroke="#CCC" strokeWidth="0.4" opacity="0.6" />
        <line x1="18" y1="18" x2="34" y2="18" stroke="#CCC" strokeWidth="0.4" opacity="0.6" />
        <line x1="18" y1="18" x2="34" y2="34" stroke="#CCC" strokeWidth="0.4" opacity="0.6" />
        <line x1="18" y1="18" x2="18" y2="34" stroke="#CCC" strokeWidth="0.4" opacity="0.6" />
        <line x1="18" y1="18" x2="2" y2="34" stroke="#CCC" strokeWidth="0.4" opacity="0.6" />
        <line x1="18" y1="18" x2="2" y2="18" stroke="#CCC" strokeWidth="0.4" opacity="0.6" />

        {/* Web ring 1 (outermost) */}
        <polygon
            points="8,8 18,5 28,8 31,18 28,28 18,31 8,28 5,18"
            fill="none"
            stroke="#CCC"
            strokeWidth="0.4"
            opacity="0.6"
        />
        {/* Web ring 2 */}
        <polygon
            points="11,11 18,9 25,11 27,18 25,25 18,27 11,25 9,18"
            fill="none"
            stroke="#CCC"
            strokeWidth="0.4"
            opacity="0.6"
        />
        {/* Web ring 3 */}
        <polygon
            points="13,13 18,12 23,13 24,18 23,23 18,24 13,23 12,18"
            fill="none"
            stroke="#CCC"
            strokeWidth="0.4"
            opacity="0.6"
        />
        {/* Web ring 4 (innermost) */}
        <polygon
            points="15,15 18,14 21,15 22,18 21,21 18,22 15,21 14,18"
            fill="none"
            stroke="#CCC"
            strokeWidth="0.4"
            opacity="0.6"
        />

        {/* Spider body */}
        <ellipse cx="18" cy="18" rx="2" ry="2.5" fill="#222" />
        {/* Spider head */}
        <circle cx="18" cy="16" r="1" fill="#222" />
        {/* Spider legs - left side */}
        <line x1="16" y1="16" x2="13" y2="14" stroke="#222" strokeWidth="0.5" strokeLinecap="round" />
        <line x1="16" y1="17" x2="13" y2="17" stroke="#222" strokeWidth="0.5" strokeLinecap="round" />
        <line x1="16" y1="18" x2="13" y2="20" stroke="#222" strokeWidth="0.5" strokeLinecap="round" />
        {/* Spider legs - right side */}
        <line x1="20" y1="16" x2="23" y2="14" stroke="#222" strokeWidth="0.5" strokeLinecap="round" />
        <line x1="20" y1="17" x2="23" y2="17" stroke="#222" strokeWidth="0.5" strokeLinecap="round" />
        <line x1="20" y1="18" x2="23" y2="20" stroke="#222" strokeWidth="0.5" strokeLinecap="round" />
        {/* Spider eye highlights */}
        <circle cx="17.5" cy="15.5" r="0.3" fill="#FFF" />
        <circle cx="18.5" cy="15.5" r="0.3" fill="#FFF" />
    </g>
));

WebSVG.displayName = "WebSVG";

export default WebSVG;
