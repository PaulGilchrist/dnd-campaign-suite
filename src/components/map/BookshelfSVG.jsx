import React from "react";

const BookshelfSVG = React.forwardRef(({ id, className, ...rest }, ref) => (
    <g ref={ref} id={id} className={className} {...rest}>
        {/* Outer frame — top half only (y=2..18) */}
        <rect x="2" y="2" width="68" height="16" rx="1" fill="#6B3E1F" stroke="#4A2810" strokeWidth="0.8" />

        {/* Back panel (inner shadow behind books) */}
        <rect x="4" y="4" width="64" height="12" fill="#4A2810" opacity="0.6" />

        {/* Shelf 1 */}
        <rect x="4" y="8" width="64" height="1.2" fill="#8B5E3C" />
        {/* Shelf 2 */}
        <rect x="4" y="12" width="64" height="1.2" fill="#8B5E3C" />
        {/* Shelf 3 (bottom of frame) */}
        <rect x="4" y="16" width="64" height="1.2" fill="#8B5E3C" />

        {/* --- Row 1: Books on Shelf 1 (between y=4 and y=8) --- */}
        <rect x="6" y="4.5" width="4" height="3.5" fill="#C0392B" rx="0.3" />
        <rect x="11" y="5" width="3" height="3" fill="#2980B9" rx="0.3" />
        <rect x="15" y="4.5" width="5" height="3.5" fill="#27AE60" rx="0.3" />
        <rect x="21" y="5" width="4" height="3" fill="#8E44AD" rx="0.3" />
        <rect x="26" y="4.5" width="3" height="3.5" fill="#E67E22" rx="0.3" />
        <rect x="30" y="4.5" width="5" height="3.5" fill="#C0392B" rx="0.3" />
        <rect x="36" y="5" width="4" height="3" fill="#2980B9" rx="0.3" />
        <rect x="41" y="4.5" width="3" height="3.5" fill="#27AE60" rx="0.3" />
        <rect x="45" y="4.5" width="5" height="3.5" fill="#8E44AD" rx="0.3" />
        <rect x="51" y="4" width="4" height="4" fill="#E67E22" rx="0.3" />
        <rect x="56" y="4.5" width="3" height="3.5" fill="#C0392B" rx="0.3" />
        <rect x="60" y="5" width="4" height="3" fill="#2980B9" rx="0.3" />
        {/* Leaning book */}
        <rect x="33" y="4.5" width="2" height="3" fill="#27AE60" rx="0.2" transform="rotate(6, 34, 6)" />

        {/* --- Row 2: Books on Shelf 2 (between y=9 and y=12) --- */}
        <rect x="7" y="9.5" width="5" height="2.5" fill="#8E44AD" rx="0.3" />
        <rect x="13" y="10" width="3" height="2" fill="#E67E22" rx="0.3" />
        <rect x="17" y="9.5" width="4" height="2.5" fill="#C0392B" rx="0.3" />
        <rect x="22" y="10" width="5" height="2" fill="#2980B9" rx="0.3" />
        <rect x="28" y="9.5" width="4" height="2.5" fill="#27AE60" rx="0.3" />
        <rect x="33" y="10" width="3" height="2" fill="#8E44AD" rx="0.3" />
        <rect x="37" y="9.5" width="5" height="2.5" fill="#E67E22" rx="0.3" />
        <rect x="43" y="10" width="4" height="2" fill="#C0392B" rx="0.3" />
        <rect x="48" y="9.5" width="3" height="2.5" fill="#2980B9" rx="0.3" />
        <rect x="52" y="9.5" width="5" height="2.5" fill="#27AE60" rx="0.3" />
        <rect x="58" y="10" width="4" height="2" fill="#8E44AD" rx="0.3" />
        <rect x="63" y="9.5" width="3" height="2.5" fill="#E67E22" rx="0.3" />
        {/* Leaning books */}
        <rect x="20" y="9" width="2" height="2.5" fill="#2980B9" rx="0.2" transform="rotate(8, 21, 10.5)" />
        <rect x="55" y="9" width="2" height="2.8" fill="#27AE60" rx="0.2" transform="rotate(-6, 56, 10.5)" />

        {/* Left frame edge highlight */}
        <rect x="2" y="2" width="2.5" height="16" fill="#7A4E20" opacity="0.3" />
        {/* Right frame edge highlight */}
        <rect x="67.5" y="2" width="2.5" height="16" fill="#7A4E20" opacity="0.3" />
        {/* Top frame highlight */}
        <rect x="2" y="2" width="68" height="1" fill="#8B5E3C" opacity="0.5" />

        {/* Floor shadow — bottom half of viewBox */}
        <rect x="2" y="19" width="68" height="14" fill="#333" opacity="0.08" rx="0.5" />
        {/* Wall shadow line at y=18 (where shelf meets wall) */}
        <line x1="2" y1="18" x2="70" y2="18" stroke="#333" strokeWidth="0.5" opacity="0.06" />
    </g>
));

BookshelfSVG.displayName = "BookshelfSVG";
export default BookshelfSVG;
