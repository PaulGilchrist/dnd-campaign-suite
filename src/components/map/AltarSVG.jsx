import React from "react";

const AltarSVG = React.forwardRef(({ id, className, ...rest }, ref) => (
    <g ref={ref} id={id} className={className} {...rest}>
        {/* Floor shadow */}
        <rect
            x="4" y="4" width="66" height="30" rx="2"
            fill="#555" opacity="0.25" transform="translate(1, 1)"
        />

        {/* ===== STONE BASE ===== */}
        {/* Main stone block — warmer earthy tones */}
        <rect
            x="3" y="3" width="66" height="30" rx="1.5"
            fill="#8A7F70" stroke="#6B6050" strokeWidth="0.8"
        />

        {/* Top surface — slightly lighter */}
        <rect
            x="6" y="5" width="60" height="26" rx="0.8"
            fill="#9B9080" stroke="#7A6F60" strokeWidth="0.4"
        />

        {/* Decorative border/ledge — inset from top surface */}
        <rect
            x="7" y="6" width="58" height="24" rx="0.5"
            fill="none" stroke="#7A6F60" strokeWidth="0.5"
        />

        {/* Edge shadows — bottom and right for depth */}
        <rect x="3" y="31" width="66" height="2" fill="#4A4035" opacity="0.4" rx="0.5" />
        <rect x="67" y="3" width="2" height="30" fill="#4A4035" opacity="0.4" rx="0.5" />

        {/* Top edge highlight for depth */}
        <rect x="3" y="3" width="66" height="1" fill="#B0A090" opacity="0.3" />

        {/* ===== RED CLOTH RUNNER ===== */}
        {/* Full-width strip across top of altar */}
        <rect x="6" y="6" width="60" height="3" fill="#8B0000" />
        {/* Gold trim — top edge */}
        <rect x="6" y="6" width="60" height="0.6" fill="#D4AF37" />
        {/* Gold trim — bottom edge */}
        <rect x="6" y="8.4" width="60" height="0.6" fill="#D4AF37" />

        {/* ===== OFFERING DEPRESSION ===== */}
        <rect
            x="30" y="10" width="12" height="7" rx="0.5"
            fill="#7A6F60" stroke="#6B6050" strokeWidth="0.3"
        />

        {/* ===== BLOOD STAIN / SCORCH MARK ===== */}
        {/* Main stain */}
        <path
            d="M 33 18 Q 35 15 37 16 Q 39 15 40 18 Q 38 20 36 20 Q 34 20 33 18 Z"
            fill="#4A0000" opacity="0.3"
        />
        {/* Small spatters nearby */}
        <circle cx="31" cy="18" r="0.6" fill="#4A0000" opacity="0.2" />
        <circle cx="41" cy="17" r="0.4" fill="#4A0000" opacity="0.15" />
        <circle cx="39" cy="21" r="0.5" fill="#4A0000" opacity="0.2" />

        {/* ===== CANDLES — 4 corners ===== */}
        {/* Top-left candle */}
        <g>
            <circle cx="10" cy="6.5" r="2.5" fill="#E87A20" opacity="0.12" />
            <rect x="9" y="7" width="2" height="3" rx="0.3" fill="#F5F0E0" stroke="#D4C9A8" strokeWidth="0.3" />
            <circle cx="10" cy="6.5" r="1.2" fill="#E87A20" />
            <circle cx="10" cy="6.5" r="0.5" fill="#F5D060" />
        </g>

        {/* Top-right candle */}
        <g>
            <circle cx="62" cy="6.5" r="2.5" fill="#E87A20" opacity="0.12" />
            <rect x="61" y="7" width="2" height="3" rx="0.3" fill="#F5F0E0" stroke="#D4C9A8" strokeWidth="0.3" />
            <circle cx="62" cy="6.5" r="1.2" fill="#E87A20" />
            <circle cx="62" cy="6.5" r="0.5" fill="#F5D060" />
        </g>

        {/* Bottom-left candle */}
        <g>
            <circle cx="10" cy="24.5" r="2.5" fill="#E87A20" opacity="0.12" />
            <rect x="9" y="25" width="2" height="3" rx="0.3" fill="#F5F0E0" stroke="#D4C9A8" strokeWidth="0.3" />
            <circle cx="10" cy="24.5" r="1.2" fill="#E87A20" />
            <circle cx="10" cy="24.5" r="0.5" fill="#F5D060" />
        </g>

        {/* Bottom-right candle */}
        <g>
            <circle cx="62" cy="24.5" r="2.5" fill="#E87A20" opacity="0.12" />
            <rect x="61" y="25" width="2" height="3" rx="0.3" fill="#F5F0E0" stroke="#D4C9A8" strokeWidth="0.3" />
            <circle cx="62" cy="24.5" r="1.2" fill="#E87A20" />
            <circle cx="62" cy="24.5" r="0.5" fill="#F5D060" />
        </g>

        {/* ===== CENTRAL RUNE / HOLY SYMBOL ===== */}
        <g>
            {/* Glow behind symbol */}
            <circle cx="36" cy="18" r="9" fill="#D4A017" opacity="0.1" />
            <circle cx="36" cy="18" r="6" fill="#D4A017" opacity="0.15" />

            {/* Outer ring */}
            <circle cx="36" cy="18" r="6" fill="none" stroke="#D4A017" strokeWidth="0.8" />

            {/* Radiant 4-pointed star / sunburst */}
            <path
                d="M 36 12 L 37.5 16.5 L 42 18 L 37.5 19.5 L 36 24 L 34.5 19.5 L 30 18 L 34.5 16.5 Z"
                fill="#D4A017" opacity="0.85"
            />

            {/* Diagonal rays */}
            <path
                d="M 32 14 L 35 16.5 L 32 18 L 35 19.5 L 32 22 L 36.5 19.5 L 40 22 L 37.5 19.5 L 40 18 L 37.5 16.5 L 40 14 L 36.5 16.5 Z"
                fill="#D4A017" opacity="0.4"
            />

            {/* Inner ring */}
            <circle cx="36" cy="18" r="2.5" fill="none" stroke="#D4A017" strokeWidth="0.6" />

            {/* Center dot */}
            <circle cx="36" cy="18" r="1.2" fill="#F5D060" />
        </g>

        {/* ===== OFFERING GOBLET ===== */}
        <g>
            {/* Goblet shadow */}
            <ellipse cx="36" cy="23.5" rx="3" ry="1" fill="#4A4035" opacity="0.3" />
            {/* Goblet rim (gold circle from above) */}
            <circle cx="36" cy="23" r="2.5" fill="#D4A017" stroke="#B8960F" strokeWidth="0.3" />
            {/* Goblet interior — dark opening */}
            <circle cx="36" cy="23" r="1.2" fill="#5C4510" />
            {/* Liquid glint / highlight */}
            <circle cx="35.2" cy="22.5" r="0.4" fill="#F5D060" opacity="0.5" />
        </g>
    </g>
));

AltarSVG.displayName = "AltarSVG";
export default AltarSVG;
