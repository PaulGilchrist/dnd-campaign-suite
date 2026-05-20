import React from "react";

const BookshelfSVG = React.forwardRef(({ id, className, ...rest }, ref) => (
    <g ref={ref} id={id} className={className} {...rest}>
        {/* Outer frame */}
        <rect x="2" y="2" width="68" height="32" rx="1" fill="#6B3E1F" stroke="#4A2810" strokeWidth="0.8" />

        {/* Back panel (inner shadow behind books) */}
        <rect x="4" y="4" width="64" height="28" fill="#4A2810" opacity="0.6" />

        {/* Shelf 1 */}
        <rect x="4" y="10" width="64" height="1.5" fill="#8B5E3C" stroke="#6B3E1F" strokeWidth="0.4" />
        {/* Shelf 2 */}
        <rect x="4" y="17" width="64" height="1.5" fill="#8B5E3C" stroke="#6B3E1F" strokeWidth="0.4" />
        {/* Shelf 3 */}
        <rect x="4" y="24" width="64" height="1.5" fill="#8B5E3C" stroke="#6B3E1F" strokeWidth="0.4" />
        {/* Shelf 4 (bottom) */}
        <rect x="4" y="31" width="64" height="1.5" fill="#8B5E3C" stroke="#6B3E1F" strokeWidth="0.4" />

        {/* --- Row 1: Books on Shelf 1 (above y=10) --- */}
        <rect x="6" y="5" width="4" height="5" fill="#C0392B" rx="0.3" />
        <rect x="11" y="6" width="3" height="4" fill="#2980B9" rx="0.3" transform="rotate(-4, 12.5, 8)" />
        <rect x="15" y="5" width="5" height="5" fill="#27AE60" rx="0.3" />
        <rect x="21" y="6" width="4" height="4" fill="#8E44AD" rx="0.3" />
        <rect x="26" y="5" width="3" height="5" fill="#E67E22" rx="0.3" />
        <rect x="30" y="5" width="5" height="5" fill="#C0392B" rx="0.3" />
        <rect x="36" y="6" width="4" height="4" fill="#2980B9" rx="0.3" />
        <rect x="41" y="5" width="3" height="5" fill="#27AE60" rx="0.3" />
        <rect x="45" y="5" width="5" height="5" fill="#8E44AD" rx="0.3" />
        <rect x="51" y="4" width="4" height="6" fill="#E67E22" rx="0.3" />
        <rect x="56" y="5" width="3" height="5" fill="#C0392B" rx="0.3" />
        <rect x="60" y="6" width="4" height="4" fill="#2980B9" rx="0.3" />
        {/* Leaning book */}
        <rect x="33" y="5" width="2" height="4" fill="#27AE60" rx="0.2" transform="rotate(6, 34, 7)" />

        {/* --- Row 2: Books on Shelf 2 (above y=17) --- */}
        <rect x="7" y="12" width="5" height="5" fill="#8E44AD" rx="0.3" />
        <rect x="13" y="13" width="3" height="4" fill="#E67E22" rx="0.3" />
        <rect x="17" y="12" width="4" height="5" fill="#C0392B" rx="0.3" />
        <rect x="22" y="13" width="5" height="4" fill="#2980B9" rx="0.3" />
        <rect x="28" y="12" width="4" height="5" fill="#27AE60" rx="0.3" />
        <rect x="33" y="13" width="3" height="4" fill="#8E44AD" rx="0.3" />
        <rect x="37" y="12" width="5" height="5" fill="#E67E22" rx="0.3" />
        <rect x="43" y="13" width="4" height="4" fill="#C0392B" rx="0.3" />
        <rect x="48" y="12" width="3" height="5" fill="#2980B9" rx="0.3" />
        <rect x="52" y="12" width="5" height="5" fill="#27AE60" rx="0.3" />
        <rect x="58" y="13" width="4" height="4" fill="#8E44AD" rx="0.3" />
        <rect x="63" y="12" width="3" height="5" fill="#E67E22" rx="0.3" />
        {/* Leaning books */}
        <rect x="20" y="11" width="2" height="5" fill="#2980B9" rx="0.2" transform="rotate(8, 21, 13)" />
        <rect x="55" y="11" width="2" height="5" fill="#27AE60" rx="0.2" transform="rotate(-6, 56, 13)" />

        {/* --- Row 3: Books on Shelf 3 (above y=24) --- */}
        <rect x="6" y="19" width="3" height="5" fill="#E67E22" rx="0.3" />
        <rect x="10" y="20" width="5" height="4" fill="#C0392B" rx="0.3" />
        <rect x="16" y="19" width="4" height="5" fill="#2980B9" rx="0.3" />
        <rect x="21" y="20" width="3" height="4" fill="#27AE60" rx="0.3" />
        <rect x="25" y="19" width="5" height="5" fill="#8E44AD" rx="0.3" />
        <rect x="31" y="20" width="4" height="4" fill="#E67E22" rx="0.3" />
        <rect x="36" y="19" width="3" height="5" fill="#C0392B" rx="0.3" />
        <rect x="40" y="19" width="5" height="5" fill="#2980B9" rx="0.3" />
        <rect x="46" y="20" width="4" height="4" fill="#27AE60" rx="0.3" />
        <rect x="51" y="19" width="3" height="5" fill="#8E44AD" rx="0.3" />
        <rect x="55" y="19" width="5" height="5" fill="#E67E22" rx="0.3" />
        <rect x="61" y="20" width="3" height="4" fill="#C0392B" rx="0.3" />
        {/* Leaning book */}
        <rect x="43" y="18" width="2" height="4" fill="#2980B9" rx="0.2" transform="rotate(-7, 44, 20)" />

        {/* --- Bottom Row: Books on bottom shelf (above y=31) --- */}
        <rect x="8" y="26" width="5" height="5" fill="#2980B9" rx="0.3" />
        <rect x="14" y="27" width="4" height="4" fill="#C0392B" rx="0.3" />
        <rect x="19" y="26" width="3" height="5" fill="#27AE60" rx="0.3" />
        <rect x="23" y="26" width="5" height="5" fill="#E67E22" rx="0.3" />
        <rect x="29" y="27" width="4" height="4" fill="#8E44AD" rx="0.3" />
        <rect x="34" y="26" width="3" height="5" fill="#C0392B" rx="0.3" />
        <rect x="38" y="26" width="5" height="5" fill="#2980B9" rx="0.3" />
        <rect x="44" y="27" width="4" height="4" fill="#27AE60" rx="0.3" />
        <rect x="49" y="26" width="3" height="5" fill="#E67E22" rx="0.3" />
        <rect x="53" y="26" width="5" height="5" fill="#8E44AD" rx="0.3" />
        <rect x="59" y="27" width="4" height="4" fill="#C0392B" rx="0.3" />
        {/* Leaning book */}
        <rect x="46" y="25" width="2" height="4" fill="#27AE60" rx="0.2" transform="rotate(5, 47, 27)" />

        {/* Left frame edge highlight */}
        <rect x="2" y="2" width="2.5" height="32" fill="#7A4E20" opacity="0.3" />
        {/* Right frame edge highlight */}
        <rect x="67.5" y="2" width="2.5" height="32" fill="#7A4E20" opacity="0.3" />
        {/* Top frame highlight */}
        <rect x="2" y="2" width="68" height="1" fill="#8B5E3C" opacity="0.5" />
    </g>
));

BookshelfSVG.displayName = "BookshelfSVG";
export default BookshelfSVG;
