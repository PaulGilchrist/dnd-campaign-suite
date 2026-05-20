import React from "react";

const SkeletonSVG = React.forwardRef(({ id, className, ...rest }, ref) => (
    <g ref={ref} id={id} className={className} {...rest}>
        {/* Skull dome */}
        <path
            d="M 12 12 Q 12 5 18 5 Q 24 5 24 12 L 24 18 L 22 20 L 22 24 L 14 24 L 14 20 L 12 18 Z"
            fill="#E8DCC8"
            stroke="#D5C4A1"
            strokeWidth="0.8"
        />
        {/* Skull top highlight */}
        <path
            d="M 14 9 Q 14 6 18 6 Q 22 6 22 9"
            fill="none"
            stroke="#F5F0E8"
            strokeWidth="0.6"
        />
        {/* Left eye socket */}
        <ellipse cx="15" cy="14" rx="2.5" ry="2.8" fill="#333" />
        {/* Right eye socket */}
        <ellipse cx="21" cy="14" rx="2.5" ry="2.8" fill="#333" />
        {/* Nose cavity */}
        <path d="M 17 17 L 18 19.5 L 19 17 Z" fill="#333" />
        {/* Mouth gap */}
        <rect x="14" y="21" width="8" height="1.5" fill="#333" rx="0.3" />
        {/* Teeth - upper */}
        <rect x="15" y="21" width="1.2" height="1.8" fill="#E8DCC8" stroke="#D5C4A1" strokeWidth="0.2" />
        <rect x="16.6" y="21" width="1.2" height="1.8" fill="#E8DCC8" stroke="#D5C4A1" strokeWidth="0.2" />
        <rect x="18.2" y="21" width="1.2" height="1.8" fill="#E8DCC8" stroke="#D5C4A1" strokeWidth="0.2" />
        <rect x="19.8" y="21" width="1.2" height="1.8" fill="#E8DCC8" stroke="#D5C4A1" strokeWidth="0.2" />
        {/* Jaw outline */}
        <path d="M 14 24 L 22 24" stroke="#D5C4A1" strokeWidth="0.5" />
        {/* Cheekbone shadows */}
        <path d="M 12 16 Q 14 18 14 20" fill="none" stroke="#C4B898" strokeWidth="0.5" />
        <path d="M 24 16 Q 22 18 22 20" fill="none" stroke="#C4B898" strokeWidth="0.5" />

        {/* Crossbones - left (diagonal) */}
        <line x1="8" y1="30" x2="16" y2="26" stroke="#E8DCC8" strokeWidth="3.5" strokeLinecap="round" />
        <line x1="8" y1="30" x2="16" y2="26" stroke="#D5C4A1" strokeWidth="2" strokeLinecap="round" />
        {/* Crossbones - right (diagonal) */}
        <line x1="20" y1="26" x2="28" y2="30" stroke="#E8DCC8" strokeWidth="3.5" strokeLinecap="round" />
        <line x1="20" y1="26" x2="28" y2="30" stroke="#D5C4A1" strokeWidth="2" strokeLinecap="round" />
        {/* Bone end knobs - left pair */}
        <circle cx="8" cy="30" r="2" fill="#E8DCC8" stroke="#D5C4A1" strokeWidth="0.4" />
        <circle cx="16" cy="26" r="2" fill="#E8DCC8" stroke="#D5C4A1" strokeWidth="0.4" />
        {/* Bone end knobs - right pair */}
        <circle cx="20" cy="26" r="2" fill="#E8DCC8" stroke="#D5C4A1" strokeWidth="0.4" />
        <circle cx="28" cy="30" r="2" fill="#E8DCC8" stroke="#D5C4A1" strokeWidth="0.4" />
        {/* Bone center highlights */}
        <circle cx="8" cy="30" r="0.8" fill="#F5F0E8" opacity="0.5" />
        <circle cx="16" cy="26" r="0.8" fill="#F5F0E8" opacity="0.5" />
        <circle cx="20" cy="26" r="0.8" fill="#F5F0E8" opacity="0.5" />
        <circle cx="28" cy="30" r="0.8" fill="#F5F0E8" opacity="0.5" />
    </g>
));

SkeletonSVG.displayName = "SkeletonSVG";

export default SkeletonSVG;
