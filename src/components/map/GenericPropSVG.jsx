import React from "react";

// Shared placeholder def (mounted in Map.jsx <defs> as #generic-prop) for
// placed-item rows whose `type` has NO sprite art and NO bespoke symbol —
// legacy rows and AI-Dress-invented types (the map API / dressMap add-item op
// only check that `type` is non-empty). Before this def the whitelist
// dispatcher in PlacedItems.jsx dropped such rows to zero DOM: invisible,
// unselectable, undeletable ghosts (bug-unregistered-placeditem-type-
// invisible-ghost). They now draw a dashed "?" chip and ride the normal hit
// area so the GM can move/hide/Delete them. Footprint matches the 36-unit
// props lane (centre 18,18), so <use x/y> placement is identical to a sprite.
const GenericPropSVG = React.forwardRef(({ id, className, ...rest }, ref) => (
    <g ref={ref} id={id} className={className} {...rest}>
        {/* Dashed rounded chip reads as "unrecognised prop" */}
        <rect x="3" y="3" width="30" height="30" rx="6"
            fill="#8A93A6" fillOpacity="0.25"
            stroke="#C8CFDA" strokeWidth="1.5" strokeDasharray="4 3" />
        {/* Question mark, optically centred (y is baseline-shifted down 1) */}
        <text x="18" y="19" textAnchor="middle" dominantBaseline="central"
            fontSize="16" fontWeight="bold" fill="#E2E6EE">?</text>
    </g>
));

GenericPropSVG.displayName = "GenericPropSVG";

export default GenericPropSVG;
