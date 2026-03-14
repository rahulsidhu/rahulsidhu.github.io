export const RIDER_PROFILES = {
    recreational: {
        id: 'recreational',
        name: 'Recreational Rider',
        ftp: 180,
        humanEfficiency: 22.0,
        notes: 'Occasional riding, comfort-first pacing.'
    },
    trained: {
        id: 'trained',
        name: 'Trained Rider',
        ftp: 230,
        humanEfficiency: 23.0,
        notes: 'Regular training and solid endurance.'
    },
    club: {
        id: 'club',
        name: 'Club Racer',
        ftp: 280,
        humanEfficiency: 23.5,
        notes: 'Strong amateur with disciplined pacing.'
    },
    amateur_racer: {
        id: 'amateur_racer',
        name: 'Amateur Racer',
        ftp: 330,
        humanEfficiency: 24.0,
        notes: 'Race-ready rider with strong threshold power.'
    },
    elite: {
        id: 'elite',
        name: 'Elite Rider',
        ftp: 390,
        humanEfficiency: 24.5,
        notes: 'High-end domestic or professional capability.'
    }
};

export function getEffortLabel(effortPercent) {
    if (effortPercent < 55) return 'Recovery';
    if (effortPercent < 76) return 'Endurance';
    if (effortPercent < 91) return 'Tempo';
    if (effortPercent < 106) return 'Threshold';
    if (effortPercent < 121) return 'VO2';
    return 'Anaerobic';
}

export function calculateTargetPower(profileId, effortPercent) {
    const profile = RIDER_PROFILES[profileId] ?? RIDER_PROFILES.trained;
    const targetPower = profile.ftp * (effortPercent / 100);

    return {
        targetPower,
        ftp: profile.ftp,
        humanEfficiency: profile.humanEfficiency,
        profile
    };
}
