import React from "react";

const BookshelfSVG = React.forwardRef(({ id, className, ...rest }, ref) => (
    <g ref={ref} id={id} className={className} {...rest}>
        {/* Back panel — thick wood against the wall (top edge = back of shelf) */}
        <rect x="2" y="2" width="68" height="7" rx="1" fill="#6B3E1F" stroke="#4A2810" strokeWidth="0.8" />
        <rect x="2" y="2" width="68" height="1" fill="#8B5E3C" opacity="0.5" />

        {/* Dark interior behind the books */}
        <rect x="4.5" y="9" width="63" height="14" fill="#4A2810" opacity="0.5" />

        {/* Shelf boards */}
        <rect x="4.5" y="13.4" width="63" height="1" fill="#8B5E3C" />
        <rect x="4.5" y="18.4" width="63" height="1" fill="#8B5E3C" />

        {/* Left end panel */}
        <rect x="2" y="2" width="2.5" height="21" fill="#6B3E1F" stroke="#4A2810" strokeWidth="0.6" />
        {/* Right end panel */}
        <rect x="67.5" y="2" width="2.5" height="21" fill="#6B3E1F" stroke="#4A2810" strokeWidth="0.6" />

        {/* --- Row 1: books nearest the back (sitting on first shelf board) --- */}
        <rect x="5.5" y="10" width="4" height="3.4" fill="#C0392B" rx="0.3" />
        <rect x="10.5" y="9.6" width="3" height="3.8" fill="#2980B9" rx="0.3" />
        <rect x="14.5" y="10" width="5" height="3.4" fill="#27AE60" rx="0.3" />
        <rect x="20.5" y="9.6" width="4" height="3.8" fill="#8E44AD" rx="0.3" />
        <rect x="25.5" y="10" width="3" height="3.4" fill="#E67E22" rx="0.3" />
        <rect x="29.5" y="9.6" width="5" height="3.8" fill="#C0392B" rx="0.3" />
        <rect x="33" y="9.8" width="2" height="3" fill="#27AE60" rx="0.2" transform="rotate(6, 34, 12.8)" />
        <rect x="35.5" y="10" width="4" height="3.4" fill="#2980B9" rx="0.3" />
        <rect x="40.5" y="9.6" width="3" height="3.8" fill="#27AE60" rx="0.3" />
        <rect x="44.5" y="10" width="5" height="3.4" fill="#8E44AD" rx="0.3" />
        <rect x="50.5" y="9.4" width="4" height="4" fill="#E67E22" rx="0.3" />
        <rect x="55.5" y="10" width="3" height="3.4" fill="#C0392B" rx="0.3" />
        <rect x="59.5" y="9.6" width="4" height="3.8" fill="#2980B9" rx="0.3" />

        {/* --- Row 2: books on middle shelf --- */}
        <rect x="6" y="14.6" width="5" height="3.8" fill="#8E44AD" rx="0.3" />
        <rect x="12" y="15" width="3" height="3.4" fill="#E67E22" rx="0.3" />
        <rect x="16" y="14.6" width="4" height="3.8" fill="#C0392B" rx="0.3" />
        <rect x="21" y="15" width="5" height="3.4" fill="#2980B9" rx="0.3" />
        <rect x="24" y="14.2" width="2" height="2.8" fill="#2980B9" rx="0.2" transform="rotate(8, 25, 16.8)" />
        <rect x="27" y="14.6" width="4" height="3.8" fill="#27AE60" rx="0.3" />
        <rect x="32" y="15" width="3" height="3.4" fill="#8E44AD" rx="0.3" />
        <rect x="36" y="14.6" width="5" height="3.8" fill="#E67E22" rx="0.3" />
        <rect x="42" y="15" width="4" height="3.4" fill="#C0392B" rx="0.3" />
        <rect x="47" y="14.6" width="3" height="3.8" fill="#2980B9" rx="0.3" />
        <rect x="51" y="14.6" width="5" height="3.8" fill="#27AE60" rx="0.3" />
        <rect x="57" y="15" width="4" height="3.4" fill="#8E44AD" rx="0.3" />
        <rect x="61.5" y="14.6" width="3" height="3.8" fill="#E67E22" rx="0.3" />

        {/* --- Row 3: books on bottom shelf, open front (no wood band in front) --- */}
        <rect x="5.5" y="19.8" width="4" height="3.6" fill="#27AE60" rx="0.3" />
        <rect x="10.5" y="20.2" width="3" height="3.2" fill="#C0392B" rx="0.3" />
        <rect x="14.5" y="19.8" width="5" height="3.6" fill="#2980B9" rx="0.3" />
        <rect x="20.5" y="20.2" width="4" height="3.2" fill="#E67E22" rx="0.3" />
        <rect x="25.5" y="19.8" width="3" height="3.6" fill="#8E44AD" rx="0.3" />
        <rect x="29.5" y="20.2" width="5" height="3.2" fill="#C0392B" rx="0.3" />
        <rect x="35.5" y="19.8" width="4" height="3.6" fill="#27AE60" rx="0.3" />
        <rect x="40.5" y="20.2" width="3" height="3.2" fill="#2980B9" rx="0.3" />
        <rect x="44.5" y="19.8" width="5" height="3.6" fill="#E67E22" rx="0.3" />
        <rect x="50.5" y="19.8" width="4" height="3.6" fill="#8E44AD" rx="0.3" />
        <rect x="52" y="19.6" width="2" height="3" fill="#2980B9" rx="0.2" transform="rotate(-6, 53, 22.6)" />
        <rect x="55.5" y="20.2" width="3" height="3.2" fill="#C0392B" rx="0.3" />
        <rect x="59.5" y="19.8" width="4" height="3.6" fill="#27AE60" rx="0.3" />

        {/* Thin front edge of the shelf (open front, no wood band) */}
        <rect x="4.5" y="23.4" width="63" height="1" fill="#8B5E3C" opacity="0.6" />

        {/* Floor shadow just in front of the open face */}
        <rect x="2" y="25" width="68" height="4" fill="#333" opacity="0.08" rx="0.5" />
    </g>
));

BookshelfSVG.displayName = "BookshelfSVG";
export default BookshelfSVG;
