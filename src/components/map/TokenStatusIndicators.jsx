import { memo, useMemo } from 'react';
import { useRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import {
  buildTokenStatusIndicators,
  TOKEN_STATUS_VISIBLE_LIMIT,
  TOKEN_CONDITION_RING_RADIUS,
} from '../../services/combat/conditions/tokenStatus.js';
import { CELL_SIZE } from '../../config/mapConfig';
import './TokenStatusIndicators.css';

const CHIP_RADIUS = 8;
const CHIP_SPACING = 18;

/**
 * A creature token's status row (roadmap Item 6): compact corner chips
 * derived LIVE from the creature's activeConditions bucket + the campaign
 * targetEffects store — same registry source, same semantic tones and same
 * tooltip labels as the tracker badges (see tokenStatus.js). Render-only:
 * zero writes; the subscriptions are read lanes (useRuntimeValue), so an
 * unrelated creature's store change never re-renders this subtree (the
 * hook's value-equality guard) and a position storm never recomputes it
 * for a token that didn't change props (memo).
 *
 * Rendered by the hoisted TokenStatusLayer (after every token <g> in the
 * SVG), NOT inside the token group: chips inside the token group were buried
 * under any later-drawn token disc — the cell-below neighbour occluded the
 * whole row (backlog RG 2026-11-19). The layer feeds this component its own
 * token's cell centre plus the SAME stacking transform (`stack`) a buried
 * token rides, so a row stays glued to the art it belongs to.
 */
function TokenStatusIndicators({ campaignName, creatureName, cx, cy, stack }) {
    const activeConditions = useRuntimeValue(creatureName, 'activeConditions', campaignName);
    const targetEffects = useRuntimeValue('campaign', 'targetEffects', campaignName);
    const indicators = useMemo(
        () => (creatureName
            ? buildTokenStatusIndicators(creatureName, activeConditions, targetEffects)
            : []),
        [creatureName, activeConditions, targetEffects],
    );
    if (indicators.length === 0) return null;

    const visible = indicators.slice(0, TOKEN_STATUS_VISIBLE_LIMIT);
    const hidden = indicators.slice(TOKEN_STATUS_VISIBLE_LIMIT);
    const chips = hidden.length > 0
        ? [...visible, {
            id: 'overflow',
            tone: 'token-status-overflow',
            glyph: `+${hidden.length}`,
            tooltip: `${hidden.length} more: ${hidden.map(i => i.label).join(', ')}`,
        }]
        : visible;
    // Chips ride just below the token disc, centered on the token column.
    const chipY = cy + CELL_SIZE / 2 + CHIP_RADIUS;
    const firstChipX = cx - ((chips.length - 1) * CHIP_SPACING) / 2;

    return (
        <g className="token-status-indicators" data-testid="token-status-indicators" data-creature={creatureName} transform={stack}>
            {/* Uniform condition treatment (Item 5): a dashed red ring around
                the token disc whenever the indicator set is non-empty — ONE
                style on every surface (hex avatars share the class language,
                see config/tokenCosmetics.css), driven by this SAME registry
                derivation, never a per-condition glyph (the chips below stay
                the detail layer). Painted here because this layer already
                owns the live per-creature subscription, the fog/ghost/hidden
                cull laws and the buried-stack transform; drawing LAST is the
                layer's own occlusion fix, so the ring can never be buried. */}
            <circle
                className="token-condition-ring"
                data-testid="token-condition-ring"
                cx={cx}
                cy={cy}
                r={TOKEN_CONDITION_RING_RADIUS}
                pointerEvents="none"
            />
            {chips.map((chip, i) => (
                <g
                    key={chip.id}
                    className={`token-status-chip ${chip.tone}`}
                    data-testid="token-status-chip"
                    data-label={chip.label}
                >
                    {/* SVG <title> = the markup tooltip (allowed: it is
                        markup, not an inline style). */}
                    <title>{chip.tooltip}</title>
                    <circle
                        className="token-status-bg"
                        cx={firstChipX + i * CHIP_SPACING}
                        cy={chipY}
                        r={CHIP_RADIUS}
                    />
                    <text
                        className="token-status-glyph"
                        x={firstChipX + i * CHIP_SPACING}
                        y={chipY}
                        textAnchor="middle"
                        dominantBaseline="central"
                    >
                        {chip.glyph}
                    </text>
                </g>
            ))}
        </g>
    );
}

export default memo(TokenStatusIndicators);
