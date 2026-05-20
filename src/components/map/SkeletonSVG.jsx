import React from "react";

const SkeletonSVG = React.forwardRef(({ id, className, ...rest }, ref) => (
    <g ref={ref} id={id} className={className} {...rest}>
        {/* ===== SKULL (top-down oval) ===== */}
        <ellipse cx="18" cy="7" rx="6.5" ry="5.5" fill="#E8DCC8" stroke="#D5C4A1" strokeWidth="0.6" />
        {/* Skull top highlight */}
        <path d="M 12 5 Q 18 2 24 5" fill="none" stroke="#F5F0E8" strokeWidth="0.5" opacity="0.6" />

        {/* Eye sockets (dark pits) */}
        <ellipse cx="15.5" cy="6" rx="1.5" ry="1.8" fill="#333" />
        <ellipse cx="20.5" cy="6" rx="1.5" ry="1.8" fill="#333" />

        {/* Nose cavity */}
        <path d="M 17.5 8.5 L 18 10 L 18.5 8.5 Z" fill="#333" />

        {/* Jaw hinge lines */}
        <path d="M 12 8.5 Q 13 10.5 15 10" fill="none" stroke="#C4B898" strokeWidth="0.4" />
        <path d="M 24 8.5 Q 23 10.5 21 10" fill="none" stroke="#C4B898" strokeWidth="0.4" />

        {/* ===== RIBCAGE ===== */}
        <ellipse cx="18" cy="14" rx="6" ry="4" fill="#E8DCC8" stroke="#D5C4A1" strokeWidth="0.6" />

        {/* Rib lines (curved horizontals) */}
        <path d="M 13 12.5 Q 18 10.5 23 12.5" fill="none" stroke="#D5C4A1" strokeWidth="0.4" />
        <path d="M 13 14 Q 18 12 23 14" fill="none" stroke="#D5C4A1" strokeWidth="0.4" />
        <path d="M 13.5 15.5 Q 18 13.5 22.5 15.5" fill="none" stroke="#D5C4A1" strokeWidth="0.4" />

        {/* Sternum (vertical center line) */}
        <line x1="18" y1="11" x2="18" y2="17" stroke="#D5C4A1" strokeWidth="0.4" />

        {/* ===== ARMS (humerus bones) ===== */}
        {/* Left arm — angled up-left */}
        <line x1="12" y1="12" x2="5" y2="7" stroke="#E8DCC8" strokeWidth="3" strokeLinecap="round" />
        <line x1="12" y1="12" x2="5" y2="7" stroke="#D5C4A1" strokeWidth="1.8" strokeLinecap="round" />

        {/* Right arm — angled up-right */}
        <line x1="24" y1="12" x2="31" y2="7" stroke="#E8DCC8" strokeWidth="3" strokeLinecap="round" />
        <line x1="24" y1="12" x2="31" y2="7" stroke="#D5C4A1" strokeWidth="1.8" strokeLinecap="round" />

        {/* Arm bone end knobs (shoulders) */}
        <circle cx="12" cy="12" r="1.8" fill="#E8DCC8" stroke="#D5C4A1" strokeWidth="0.3" />
        <circle cx="24" cy="12" r="1.8" fill="#E8DCC8" stroke="#D5C4A1" strokeWidth="0.3" />

        {/* Arm bone end knobs (hands/wrists) */}
        <circle cx="5" cy="7" r="1.5" fill="#E8DCC8" stroke="#D5C4A1" strokeWidth="0.3" />
        <circle cx="31" cy="7" r="1.5" fill="#E8DCC8" stroke="#D5C4A1" strokeWidth="0.3" />

        {/* ===== PELVIS (heart/butterfly shape) ===== */}
        <path
            d="M 18 18 C 14 18, 12 19.5, 14 21.5 C 15 23, 17 22.5, 18 21.5 C 19 22.5, 21 23, 22 21.5 C 24 19.5, 22 18, 18 18 Z"
            fill="#E8DCC8"
            stroke="#D5C4A1"
            strokeWidth="0.5"
        />

        {/* ===== LEGS (femur bones) ===== */}
        {/* Left femur — angled slightly down-left */}
        <line x1="15.5" y1="21" x2="11" y2="29" stroke="#E8DCC8" strokeWidth="2.8" strokeLinecap="round" />
        <line x1="15.5" y1="21" x2="11" y2="29" stroke="#D5C4A1" strokeWidth="1.6" strokeLinecap="round" />

        {/* Right femur — angled slightly down-right */}
        <line x1="20.5" y1="21" x2="25" y2="29" stroke="#E8DCC8" strokeWidth="2.8" strokeLinecap="round" />
        <line x1="20.5" y1="21" x2="25" y2="29" stroke="#D5C4A1" strokeWidth="1.6" strokeLinecap="round" />

        {/* Leg bone end knobs (hips) */}
        <circle cx="15.5" cy="21" r="1.5" fill="#E8DCC8" stroke="#D5C4A1" strokeWidth="0.3" />
        <circle cx="20.5" cy="21" r="1.5" fill="#E8DCC8" stroke="#D5C4A1" strokeWidth="0.3" />

        {/* Leg bone end knobs (knees) */}
        <circle cx="11" cy="29" r="1.5" fill="#E8DCC8" stroke="#D5C4A1" strokeWidth="0.3" />
        <circle cx="25" cy="29" r="1.5" fill="#E8DCC8" stroke="#D5C4A1" strokeWidth="0.3" />
    </g>
));

SkeletonSVG.displayName = "SkeletonSVG";
export default SkeletonSVG;
