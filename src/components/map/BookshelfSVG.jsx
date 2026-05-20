import React from "react";

const BookshelfSVG = React.forwardRef(({ id, className, ...rest }, ref) => (
    <g ref={ref} id={id} className={className} {...rest}>
        {/* Frame outer */}
        <rect
            x="2"
            y="2"
            width="68"
            height="32"
            rx="1"
            fill="#6B3E1F"
            stroke="#4A2810"
            strokeWidth="0.8"
        />
        {/* Back panel */}
        <rect x="4" y="4" width="64" height="28" fill="#5C3317" />

        {/* Shelf 1 (top) */}
        <rect
            x="4"
            y="10"
            width="64"
            height="1.5"
            fill="#8B5E3C"
            stroke="#6B3E1F"
            strokeWidth="0.4"
        />
        {/* Shelf 2 */}
        <rect
            x="4"
            y="17"
            width="64"
            height="1.5"
            fill="#8B5E3C"
            stroke="#6B3E1F"
            strokeWidth="0.4"
        />
        {/* Shelf 3 */}
        <rect
            x="4"
            y="24"
            width="64"
            height="1.5"
            fill="#8B5E3C"
            stroke="#6B3E1F"
            strokeWidth="0.4"
        />
        {/* Shelf 4 (bottom) */}
        <rect
            x="4"
            y="31"
            width="64"
            height="1.5"
            fill="#8B5E3C"
            stroke="#6B3E1F"
            strokeWidth="0.4"
        />

        {/* --- Books on Shelf 1 --- */}
        <rect x="6" y="4" width="5" height="6" fill="#C0392B" rx="0.3" />
        <rect x="12" y="5" width="4" height="5" fill="#2980B9" rx="0.3" />
        <rect x="17" y="3" width="6" height="7" fill="#27AE60" rx="0.3" />
        <rect x="24" y="4" width="4" height="6" fill="#8E44AD" rx="0.3" />
        <rect x="29" y="5" width="5" height="5" fill="#E67E22" rx="0.3" />
        <rect x="35" y="3" width="4" height="7" fill="#C0392B" rx="0.3" />
        <rect x="40" y="4" width="6" height="6" fill="#2980B9" rx="0.3" />
        <rect x="47" y="5" width="4" height="5" fill="#27AE60" rx="0.3" />
        <rect x="52" y="3" width="5" height="7" fill="#8E44AD" rx="0.3" />
        <rect x="58" y="4" width="4" height="6" fill="#E67E22" rx="0.3" />
        <rect x="63" y="5" width="3" height="5" fill="#C0392B" rx="0.3" />

        {/* --- Books on Shelf 2 --- */}
        <rect x="6" y="11" width="7" height="6" fill="#27AE60" rx="0.3" />
        <rect x="14" y="12" width="5" height="5" fill="#8E44AD" rx="0.3" />
        <rect x="20" y="11" width="4" height="6" fill="#E67E22" rx="0.3" />
        <rect x="25" y="13" width="6" height="4" fill="#C0392B" rx="0.3" />
        <rect x="32" y="11" width="5" height="6" fill="#2980B9" rx="0.3" />
        <rect x="38" y="12" width="4" height="5" fill="#27AE60" rx="0.3" />
        <rect x="43" y="11" width="6" height="6" fill="#8E44AD" rx="0.3" />
        <rect x="50" y="13" width="5" height="4" fill="#E67E22" rx="0.3" />
        <rect x="56" y="11" width="4" height="6" fill="#C0392B" rx="0.3" />
        <rect x="61" y="12" width="5" height="5" fill="#2980B9" rx="0.3" />

        {/* --- Books on Shelf 3 --- */}
        <rect x="7" y="18" width="5" height="6" fill="#8E44AD" rx="0.3" />
        <rect x="13" y="19" width="6" height="5" fill="#E67E22" rx="0.3" />
        <rect x="20" y="18" width="4" height="6" fill="#C0392B" rx="0.3" />
        <rect x="25" y="20" width="5" height="4" fill="#2980B9" rx="0.3" />
        <rect x="31" y="18" width="7" height="6" fill="#27AE60" rx="0.3" />
        <rect x="39" y="19" width="5" height="5" fill="#8E44AD" rx="0.3" />
        <rect x="45" y="18" width="4" height="6" fill="#E67E22" rx="0.3" />
        <rect x="50" y="20" width="6" height="4" fill="#C0392B" rx="0.3" />
        <rect x="57" y="18" width="5" height="6" fill="#2980B9" rx="0.3" />
        <rect x="63" y="19" width="3" height="5" fill="#27AE60" rx="0.3" />

        {/* Left frame highlight */}
        <rect x="2" y="2" width="3" height="32" fill="#7A4E20" opacity="0.4" />
        {/* Right frame highlight */}
        <rect x="67" y="2" width="3" height="32" fill="#8B5524" opacity="0.4" />
        {/* Top frame highlight */}
        <rect x="2" y="2" width="68" height="1" fill="#8B5E3C" opacity="0.5" />
    </g>
));

BookshelfSVG.displayName = "BookshelfSVG";

export default BookshelfSVG;
