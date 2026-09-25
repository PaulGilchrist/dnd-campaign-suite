import { useState } from 'react';

export default function AnimateDeadModal({ maxTargets, onConfirm, onClose }) {
    const [zombieCount, setZombieCount] = useState(0);
    const [skeletonCount, setSkeletonCount] = useState(maxTargets);

    const total = zombieCount + skeletonCount;

    const adjustZombie = (delta) => {
        const newCount = Math.max(0, Math.min(maxTargets, zombieCount + delta));
        setZombieCount(newCount);
        if (newCount + skeletonCount > maxTargets) {
            setSkeletonCount(Math.max(0, maxTargets - newCount));
        }
    };

    const adjustSkeleton = (delta) => {
        const newCount = Math.max(0, Math.min(maxTargets, skeletonCount + delta));
        setSkeletonCount(newCount);
        if (zombieCount + newCount > maxTargets) {
            setZombieCount(Math.max(0, maxTargets - newCount));
        }
    };

    const handleConfirm = () => {
        if (total > 0) {
            onConfirm({ zombieCount, skeletonCount });
        }
    };

    return (
        <div className="sp-overlay">
            <div className="sp-modal">
                <div className="sp-header">
                    <i className="fa-solid fa-bone"></i> Animate Dead
                </div>
                <div className="sp-body">
                    <p>You can create up to <b>{maxTargets}</b> undead creature(s). Choose how many are Zombies and how many are Skeletons.</p>
                    <div style={{ marginTop: '16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                            <button
                                className="sp-dismiss-btn"
                                onClick={() => adjustZombie(-1)}
                                type="button"
                                style={{ padding: '4px 10px', fontSize: '1em' }}
                            >
                                <i className="fa-solid fa-minus"></i>
                            </button>
                            <span style={{ width: '40px', textAlign: 'center', fontWeight: 'bold' }}>{zombieCount}</span>
                            <button
                                className="sp-roll-btn"
                                onClick={() => adjustZombie(1)}
                                type="button"
                                style={{ padding: '4px 10px', fontSize: '1em' }}
                            >
                                <i className="fa-solid fa-plus"></i>
                            </button>
                            <span style={{ fontWeight: 'bold' }}>Zombie(s)</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <button
                                className="sp-dismiss-btn"
                                onClick={() => adjustSkeleton(-1)}
                                type="button"
                                style={{ padding: '4px 10px', fontSize: '1em' }}
                            >
                                <i className="fa-solid fa-minus"></i>
                            </button>
                            <span style={{ width: '40px', textAlign: 'center', fontWeight: 'bold' }}>{skeletonCount}</span>
                            <button
                                className="sp-roll-btn"
                                onClick={() => adjustSkeleton(1)}
                                type="button"
                                style={{ padding: '4px 10px', fontSize: '1em' }}
                            >
                                <i className="fa-solid fa-plus"></i>
                            </button>
                            <span style={{ fontWeight: 'bold' }}>Skeleton(s)</span>
                        </div>
                    </div>
                    <div style={{ marginTop: '12px', padding: '8px 12px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', fontSize: '0.9em' }}>
                        <span>Total creatures: <b>{total}</b> / {maxTargets}</span>
                    </div>
                </div>
                <div className="sp-actions">
                    <button
                        className="sp-roll-btn"
                        onClick={handleConfirm}
                        disabled={total <= 0}
                        type="button"
                        style={{ opacity: total <= 0 ? 0.5 : 1 }}
                    >
                        <i className="fa-solid fa-bone"></i> Animate Dead ({total})
                    </button>
                    <button className="sp-dismiss-btn" onClick={onClose} type="button">
                        Cancel
                    </button>
                </div>
            </div>
        </div>
    );
}
