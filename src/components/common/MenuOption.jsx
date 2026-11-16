// Keyboard-activatable SVG context-menu option row — the shipped seam from the
// hex POI menu (improvement 2026-11-13), extracted so the indoor
// ItemContextMenu shares ONE implementation (backlog 2026-11-16 XC: the
// placed-item menu was pointer-only `<text onClick>` chrome). Options used to
// be bare SVG <text> nodes — no .click() method, no focus, no keyboard/AT
// activation. Each option's <text> label keeps its exact position/attrs and
// its onClick (mouse face unchanged); the wrapping <g role="menuitem"
// tabIndex={0}> makes the row focusable and fires the SAME onActivate
// closure on Enter/Space. A keypress never synthesises a click event on an
// SVG <g> (only native controls do), so the keydown handler cannot
// double-fire the onClick. Escape is NOT an activation key here (it never
// reaches onActivate); menu-level Escape DISMISS is the host menu's job
// (modal-family law from 3f41dc16b: dismiss routes to the plain close
// handler, never activating the focused option).
function MenuOption({ x, y, fill, fontSize = '11', className = 'menu-option', onActivate, children }) {
    const handleKeyDown = (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            e.stopPropagation();
            onActivate();
        }
    };
    return (
        <g role="menuitem" tabIndex={0} className="menu-option-item" onKeyDown={handleKeyDown}>
            <text x={x} y={y} fill={fill} fontSize={fontSize} className={className} onClick={onActivate}>
                {children}
            </text>
        </g>
    );
}

export default MenuOption;

