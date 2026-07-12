let applyBusy = false;

export function setApplyBusy(value) {
    applyBusy = value;
}

export function isApplyBusy() {
    return applyBusy;
}

export function clearActiveInstances() {
    applyBusy = false;
}

