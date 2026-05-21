import React from "react";

const LoreSiteSVG = React.forwardRef(({ id, className, ...rest }, ref) => (
    <g ref={ref} id={id} className={className} {...rest}>
        {/* Ground / circle shadow */}
        <ellipse cx="18" cy="26" rx="16" ry="6" fill="#546E7A" opacity="0.08" />

        {/* Stone circle platform / ground ring */}
        <ellipse cx="18" cy="26" rx="14" ry="4" fill="none" stroke="#78909C" strokeWidth="0.4" opacity="0.2" />

        {/* Standing Stone 1 (back-left) */}
        <rect x="8" y="12" width="3" height="14" rx="0.4" fill="#78909C" stroke="#546E7A" strokeWidth="0.5" />
        {/* Stone 1 - highlight */}
        <rect x="8" y="12" width="1" height="14" rx="0.2" fill="#90A4AE" opacity="0.4" />
        {/* Stone 1 - top rounded */}
        <ellipse cx="9.5" cy="12" rx="1.5" ry="0.8" fill="#78909C" stroke="#546E7A" strokeWidth="0.4" />

        {/* Standing Stone 2 (back-right) */}
        <rect x="24" y="14" width="3" height="12" rx="0.4" fill="#78909C" stroke="#546E7A" strokeWidth="0.5" />
        {/* Stone 2 - highlight */}
        <rect x="24" y="14" width="1" height="12" rx="0.2" fill="#90A4AE" opacity="0.4" />
        {/* Stone 2 - top pointed */}
        <polygon points="24,14 27,14 25.5,11" fill="#78909C" stroke="#546E7A" strokeWidth="0.4" />

        {/* Standing Stone 3 (center, tallest) */}
        <rect x="17" y="8" width="3" height="18" rx="0.4" fill="#78909C" stroke="#546E7A" strokeWidth="0.5" />
        {/* Stone 3 - highlight */}
        <rect x="17" y="8" width="1" height="18" rx="0.2" fill="#90A4AE" opacity="0.4" />
        {/* Stone 3 - top rounded */}
        <ellipse cx="18.5" cy="8" rx="1.5" ry="0.8" fill="#78909C" stroke="#546E7A" strokeWidth="0.4" />

        {/* Standing Stone 4 (front-left) */}
        <rect x="13" y="18" width="2.5" height="8" rx="0.3" fill="#78909C" stroke="#546E7A" strokeWidth="0.5" />
        {/* Stone 4 - top pointed */}
        <polygon points="13,18 15.5,18 14.25,15.5" fill="#78909C" stroke="#546E7A" strokeWidth="0.4" />

        {/* Standing Stone 5 (front-right) */}
        <rect x="21" y="19" width="2.5" height="7" rx="0.3" fill="#78909C" stroke="#546E7A" strokeWidth="0.5" />
        {/* Stone 5 - top rounded */}
        <ellipse cx="22.25" cy="19" rx="1.25" ry="0.6" fill="#78909C" stroke="#546E7A" strokeWidth="0.4" />

        {/* Ancient rune marks on center stone */}
        <path d="M 18 12 L 19 13 L 18 14" fill="none" stroke="#546E7A" strokeWidth="0.3" opacity="0.6" />
        <circle cx="18.5" cy="16" r="0.5" fill="none" stroke="#546E7A" strokeWidth="0.3" opacity="0.6" />

        {/* Moss / lichen patches */}
        <ellipse cx="10" cy="24" rx="1.5" ry="0.6" fill="#8D6E63" opacity="0.3" />
        <ellipse cx="25" cy="23" rx="1" ry="0.5" fill="#8D6E63" opacity="0.25" />
        <ellipse cx="19" cy="24" rx="1" ry="0.4" fill="#8D6E63" opacity="0.2" />

        {/* Ground stones / rubble */}
        <circle cx="6" cy="28" r="0.5" fill="#546E7A" opacity="0.3" />
        <circle cx="30" cy="27" r="0.6" fill="#546E7A" opacity="0.3" />
        <circle cx="14" cy="29" r="0.4" fill="#546E7A" opacity="0.25" />
        <circle cx="22" cy="29" r="0.5" fill="#546E7A" opacity="0.25" />
    </g>
));

LoreSiteSVG.displayName = "LoreSiteSVG";

export default LoreSiteSVG;
