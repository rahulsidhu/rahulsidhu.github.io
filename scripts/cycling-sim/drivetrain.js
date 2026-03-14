export function calculateCadence(speed, frontTeeth, rearTeeth, wheelCircumference) {
    if (speed === 0) {
        return 0;
    }

    return (speed * 1000) / (60 * (frontTeeth / rearTeeth) * wheelCircumference);
}

export function selectActiveGear({ bike, shiftMode, manualFrontIdx, manualRearIdx, speed, targetCadence }) {
    if (shiftMode === 'manual') {
        return {
            crIdx: Math.min(manualFrontIdx, bike.chainrings.length - 1),
            cogIdx: Math.min(manualRearIdx, bike.cassette.length - 1)
        };
    }

    if (speed === 0) {
        return { crIdx: 0, cogIdx: bike.cassette.length - 1 };
    }

    let bestDiff = Infinity;
    let bestCr = 0;
    let bestCog = 0;

    bike.chainrings.forEach((chainringTeeth, chainringIndex) => {
        bike.cassette.forEach((cogTeeth, cogIndex) => {
            const cadence = calculateCadence(speed, chainringTeeth, cogTeeth, bike.circ);
            const diff = Math.abs(cadence - targetCadence);

            if (diff < bestDiff) {
                bestDiff = diff;
                bestCr = chainringIndex;
                bestCog = cogIndex;
            }
        });
    });

    return { crIdx: bestCr, cogIdx: bestCog };
}
