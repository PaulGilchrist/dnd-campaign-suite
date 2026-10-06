import { getActiveCreatureName, getCurrentCombatRound } from '../../services/encounters/combatData.js'
import { toggleBuff } from '../../services/automation/common/buffToggle.js'
import { addExpiration } from '../../services/rules/effects/expirations.js'
import { addEntry } from '../../services/ui/logService.js'
import { markOncePerTurn } from '../../services/automation/common/oncePerTurn.js'
import { endFriendsOnHostileAction } from '../../services/rules/features/friendsService.js'
import { endInvisibilityOnHostileAction } from '../../services/rules/features/invisibilityService.js'
import { selectBrutalStrikeRiders } from '../../services/combat/brutalStrikeSelection.js'

function readBrutalStrikeOffer(passives) {
    const brutalStrikePassives = selectBrutalStrikeRiders(passives);
    const brutalStrikePassive = brutalStrikePassives[0] || {};
    return {
        hasBrutalStrike: brutalStrikePassives.length > 0,
        brutalStrikeOptions: brutalStrikePassive.options || [],
        maxEffects: brutalStrikePassive.maxEffects || 1,
        riderName: brutalStrikePassive?.name || 'Brutal Strike',
    };
}

export default function useCharActionsAttackHandlers({
    cannotAct,
    buildCtx,
    rollAttack,
    exhaustionPenalty,
    playerName,
    campaignName,
    setModalState,
    specialActions,
    passives,
    playerStats,
    getRuntimeValue,
    setRuntimeValue,
    setPopupHtml,
}) {
    // CLA-274 Soulknife Psychic Blades action economy: the Attack-action blade
    // row stamps the round it attacks; the second-blade Bonus Action row is only
    // armed by a blade attack this round and is consumed once per round
    // (round-keyed latch re-arms on round change, CLA-109/CLA-273 pattern).
    const PSY_BLADE_ATTACK_ROUND_KEY = '_PsychicBlade_attack_round';
    const PSY_BLADE_SECOND_ROUND_KEY = '_PsychicBlade_secondBlade_round';

    function handleAttackClick(attack) {
        if (cannotAct) {
            reportCannotActAttack(attack);
            return;
        }
        if (gatePsychicBladeAttack(attack)) return;
        // CLA-143: arm after_attack_action triggers (Flurry of Blows, Patient
        // Defense, Step of the Wind) for this round — round-keyed latch on the
        // holder (CLA-274 _PsychicBlade_attack_round pattern), re-arms at round
        // wrap, never cleared by bonus-action lanes so one Attack action can arm
        // multiple FP options.
        if (attack?.type !== 'Bonus Action') {
            setRuntimeValue(playerName, '_attackActionTakenRound', getCurrentCombatRound(campaignName), campaignName);
        }
        endFriendsOnHostileAction(playerName, campaignName);
        endInvisibilityOnHostileAction(playerName, campaignName);

        if (openRecklessChoiceModal(attack)) return;

        buildCtx(attack).then(ctx => {
            const effectiveHitBonus = ctx?.hitBonus ?? attack.hitBonus;
            rollAttack(attack.name, effectiveHitBonus - exhaustionPenalty, ctx);
        }).catch((e) => { console.error("[CharActions] Error:", e); });
    }

    function reportCannotActAttack(attack) {
        const cloudBlock = (getRuntimeValue('campaign', 'targetEffects', campaignName) || [])
            .some(te => te && te.effect === 'no_action_and_bonus_action' && te.target === playerName);
        if (cloudBlock) {
            addEntry(campaignName, {
                type: 'automation blocked',
                characterName: playerName,
                abilityName: attack?.name || 'Attack',
                description: `${playerName} is Poisoned by Stinking Cloud and can't take an Action or Bonus Action — attack refused.`,
                timestamp: Date.now(),
            }).catch((e) => { console.error("[useCharActionsAttackHandlers:log-error]", e); });
            setPopupHtml('<b>Stinking Cloud</b><br/>You are Poisoned by Stinking Cloud and can\'t take an Action or a Bonus Action until the end of your current turn.<br/><span class="dice-roll-hint">click to dismiss</span>');
        }
    }

    // CLA-274: returns true when the click was refused (popup shown, no roll).
    function gatePsychicBladeAttack(attack) {
        if (!attack?.isPsychicBlade) return false;
        const currentRound = getCurrentCombatRound(campaignName);
        if (attack.type !== 'Bonus Action') {
            setRuntimeValue(playerName, PSY_BLADE_ATTACK_ROUND_KEY, currentRound, campaignName);
            return false;
        }
        const secondBladeRound = Number(getRuntimeValue(playerName, PSY_BLADE_SECOND_ROUND_KEY, campaignName) ?? 0);
        if (secondBladeRound === currentRound) {
            setPopupHtml('<b>Psychic Blade</b><br/>You have already attacked with your second psychic blade this turn. The blade vanishes after the attack — manifest a new one with the Attack action on your next turn.<br/><span class="dice-roll-hint">click to dismiss</span>');
            return true;
        }
        const bladeAttackedRound = Number(getRuntimeValue(playerName, PSY_BLADE_ATTACK_ROUND_KEY, campaignName) ?? 0);
        if (bladeAttackedRound !== currentRound) {
            setPopupHtml('<b>Psychic Blade</b><br/>Your Psychic Blades manifest when you take the Attack action or make an Opportunity Attack. Attack with your manifested blade before making the second-blade bonus attack.<br/><span class="dice-roll-hint">click to dismiss</span>');
            return true;
        }
        setRuntimeValue(playerName, PSY_BLADE_SECOND_ROUND_KEY, currentRound, campaignName);
        return false;
    }

    // CLA-044: refusal convention (playbook §5) — automation + <feature>_refused,
    // zero spend. Attack itself proceeds normally (Reckless advantage stays).
    function logBrutalStrikeRefused(riderName) {
        addEntry(campaignName, {
            type: 'automation',
            characterName: playerName,
            automationType: 'brutal_strike_refused',
            name: riderName,
            description: `${riderName}: already used this turn — once per turn, chooser refused`,
            timestamp: Date.now(),
        }).catch((e) => { console.error('[useCharActionsAttackHandlers:refusal-log-error]', e); });
    }

    function computeChoiceState() {
        const hasRecklessFeature = specialActions?.some(
            a => a.effect === 'advantage_attacks_advantage_against' && a.trigger === 'first_attack_of_turn'
        );
        const activeBuffs = getRuntimeValue(playerName, 'activeBuffs', campaignName) || [];
        const isRecklessActive = activeBuffs.some(b => b.effect === 'advantage_attacks_advantage_against');
        // CLA-044/CLA-004-era: top-level activeCreatureName is truth (the cs
        // mirror frozen mid-walk made the latch comparison permanently stale,
        // re-offering the chooser every attack). Fall back to cs cache only.
        const currentCreature = getRuntimeValue('campaign', 'activeCreatureName', campaignName) || getActiveCreatureName(campaignName);
        const offeredValue = getRuntimeValue(playerName, '_recklessAttack_offeredThisTurn');
        const isOfferedThisTurn = offeredValue && offeredValue.activeCreature === currentCreature;

        const offer = readBrutalStrikeOffer(passives);
        const brutalStrikeUsedValue = getRuntimeValue(playerName, '_BrutalStrike_usedRound', campaignName);
        // Latch stamps the HOLDER (FT-082) and clears at round wrap
        // (navigationHandlers PLAYER_ROUND_LATCH_KEYS) — holder match spends it.
        const brutalStrikeUsedThisTurn = !!brutalStrikeUsedValue
            && (brutalStrikeUsedValue.activeCreature === playerName || brutalStrikeUsedValue.activeCreature === currentCreature);

        const recklessOwed = hasRecklessFeature && !isRecklessActive && !isOfferedThisTurn;
        const brutalActive = hasRecklessFeature && isRecklessActive && offer.hasBrutalStrike;
        const brutalOwed = brutalActive && !brutalStrikeUsedThisTurn;

        return { recklessOwed, brutalOwed, brutalSpentButActive: brutalActive && brutalStrikeUsedThisTurn, offer };
    }

    // Opens the Reckless Attack / Brutal Strike chooser when one is owed this
    // turn. Returns true when the modal consumed the click.
    function openRecklessChoiceModal(attack) {
        const { recklessOwed, brutalOwed, brutalSpentButActive, offer } = computeChoiceState();

        if (brutalSpentButActive) {
            logBrutalStrikeRefused(offer.riderName);
        }

        if (recklessOwed) {
            setModalState({ recklessAttackModal: { attack, mode: 'full', ...offer } });
            return true;
        }

        if (brutalOwed) {
            setModalState({ recklessAttackModal: { attack, mode: 'brutalOnly', hasBrutalStrike: true, brutalStrikeOptions: offer.brutalStrikeOptions, maxEffects: offer.maxEffects, riderName: offer.riderName } });
            return true;
        }
        return false;
    }

    function handleRecklessAttackConfirm(attack, brutalStrikeChoice) {
        toggleBuff(
            playerName,
            'Reckless Attack',
            { effect: 'advantage_attacks_advantage_against', duration: 'until_start_of_next_turn' },
            campaignName,
            playerName
        );
        addEntry(campaignName, {
            type: 'ability_use',
            characterName: playerName,
            abilityName: 'Reckless Attack',
            description: `${playerName} uses Reckless Attack, granting advantage on the first attack roll on this turn`,
        }).catch((e) => { console.error("[useCharActionsAttackHandlers:log-error]", e); });
        addExpiration({ attackerName: playerName, targetName: playerName, effects: [
            { type: 'remove_active_buff', buffName: 'Reckless Attack' }
        ], campaignName, rounds: undefined, expireOnCreatureName: playerName });
        const storedEffects = getRuntimeValue('campaign', 'targetEffects') || [];
        const hasRecklessEffect = storedEffects.some(te => te.effect === 'reckless_attack' && te.target === playerName);
        if (!hasRecklessEffect) {
            const newEffects = [...storedEffects, { target: playerName, source: playerName, effect: 'reckless_attack', duration: 'until_start_of_next_turn' }];
            setRuntimeValue('campaign', 'targetEffects', newEffects, campaignName);
        }
        // CLA-044: stamp the holder (top-level truth first) — the frozen cs
        // mirror stamp made the offered-latch unreadable next turn.
        const currentCreature = getRuntimeValue('campaign', 'activeCreatureName', campaignName) || getActiveCreatureName(campaignName);
        setRuntimeValue(playerName, '_recklessAttack_offeredThisTurn', { round: 1, activeCreature: currentCreature }, campaignName);

        if (brutalStrikeChoice?.useBrutalStrike) {
            setRuntimeValue(playerName, '_brutalStrikeActive', true, campaignName);
            setRuntimeValue(playerName, '_brutalStrikeEffects', brutalStrikeChoice.effectChoices, campaignName);
            markOncePerTurn('Brutal Strike', '_BrutalStrike_usedRound', playerStats, campaignName).catch((e) => { console.error("[CharActions] Error:", e); });
            setRuntimeValue(playerName, '_brutalStrikeNoAdvantage', true, campaignName);
            const effectNames = brutalStrikeChoice.effectChoices.join(' + ') || 'no effect';
            const riderName = brutalStrikeChoice.riderName || 'Brutal Strike';
            addEntry(campaignName, {
                type: 'ability_use',
                characterName: playerName,
                abilityName: riderName,
                description: `${playerName} uses ${riderName} on ${attack.name} — ${effectNames}`,
            }).catch((e) => { console.error("[useCharActionsAttackHandlers:log-error]", e); });
        }

        setModalState({ recklessAttackModal: null });
        buildCtx(attack).then(ctx => {
            const effectiveHitBonus = ctx?.hitBonus ?? attack.hitBonus;
            rollAttack(attack.name, effectiveHitBonus - exhaustionPenalty, ctx);
        }).catch((e) => { console.error("[CharActions] Error:", e); }).finally(() => {
            if (brutalStrikeChoice?.useBrutalStrike) {
                setRuntimeValue(playerName, '_brutalStrikeNoAdvantage', null, campaignName);
                // CLA-044 sticky safety: the sticky is consumed synchronously
                // inside buildCtx; anything left after this lane is stale — clear it.
                if (brutalStrikeChoice?.useBrutalStrike) {
                    clearBrutalStrikeSticky();
                }
            }
        });
    }

    function handleRecklessAttackCancel(attack) {
        const currentCreature = getRuntimeValue('campaign', 'activeCreatureName', campaignName) || getActiveCreatureName(campaignName);
        setRuntimeValue(playerName, '_recklessAttack_offeredThisTurn', { round: 1, activeCreature: currentCreature }, campaignName);
        setModalState({ recklessAttackModal: null });
        buildCtx(attack).then(ctx => {
            const effectiveHitBonus = ctx?.hitBonus ?? attack.hitBonus;
            rollAttack(attack.name, effectiveHitBonus - exhaustionPenalty, ctx);
        }).catch((e) => { console.error("[CharActions] Error:", e); });
    }

    // CLA-044 sticky safety: the arming attack is the consuming attack — if
    // no attack was threaded or the ctx fails, the sticky is cleared here so
    // it can never ride a later unrelated attack.
    function clearBrutalStrikeSticky() {
        setRuntimeValue(playerName, '_brutalStrikeActive', null, campaignName);
        setRuntimeValue(playerName, '_brutalStrikeEffects', null, campaignName);
    }

    function handleBrutalStrikeConfirm(brutalStrikeChoice, attack) {
        if (!attack) {
            console.error('[useCharActionsAttackHandlers] brutalOnly confirm without attack — not arming sticky');
            setModalState({ recklessAttackModal: null });
            return;
        }
        const consumed = !!brutalStrikeChoice?.useBrutalStrike;
        if (consumed) {
            setRuntimeValue(playerName, '_brutalStrikeActive', true, campaignName);
            setRuntimeValue(playerName, '_brutalStrikeEffects', brutalStrikeChoice.effectChoices, campaignName);
            markOncePerTurn('Brutal Strike', '_BrutalStrike_usedRound', playerStats, campaignName).catch((e) => { console.error("[CharActions] Error:", e); });
            const effectNames = brutalStrikeChoice.effectChoices.join(' + ') || 'no effect';
            const riderName = brutalStrikeChoice.riderName || 'Brutal Strike';
            addEntry(campaignName, {
                type: 'ability_use',
                characterName: playerName,
                abilityName: riderName,
                description: `${playerName} uses ${riderName} on ${attack.name} — ${effectNames}`,
            }).catch((e) => { console.error("[useCharActionsAttackHandlers:log-error]", e); });
        }
        setModalState({ recklessAttackModal: null });
        buildCtx(attack).then(ctx => {
            const effectiveHitBonus = ctx?.hitBonus ?? attack.hitBonus;
            rollAttack(attack.name, effectiveHitBonus - exhaustionPenalty, ctx);
        }).catch((e) => { console.error("[CharActions] Error:", e); }).finally(() => {
            // rollBrutalStrikeAttack consumes the sticky synchronously on the
            // hit path; anything still armed here is leftover — clear it.
            if (consumed) {
                clearBrutalStrikeSticky();
            }
        });
    }

    function handleBrutalStrikeCancel(attack) {
        clearBrutalStrikeSticky();
        setModalState({ recklessAttackModal: null });
        if (attack) {
            buildCtx(attack).then(ctx => {
                const effectiveHitBonus = ctx?.hitBonus ?? attack.hitBonus;
                rollAttack(attack.name, effectiveHitBonus - exhaustionPenalty, ctx);
            }).catch((e) => { console.error("[CharActions] Error:", e); });
        }
    }

    return {
        handleAttackClick,
        handleRecklessAttackConfirm,
        handleRecklessAttackCancel,
        handleBrutalStrikeConfirm,
        handleBrutalStrikeCancel,
    };
}
