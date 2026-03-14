export const RIDER_PROFILES = {
    amateur: {
        id: 'amateur',
        name: 'Amateur',
        ftp: 235,
        humanEfficiency: 23.0,
        notes: 'Regular rider with solid aerobic fitness.'
    },
    pro: {
        id: 'pro',
        name: 'Pro',
        ftp: 330,
        humanEfficiency: 24.0,
        notes: 'Race-ready rider with strong threshold power.'
    },
    elite: {
        id: 'elite',
        name: 'Elite',
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
    const profile = RIDER_PROFILES[profileId] ?? RIDER_PROFILES.amateur;
    const targetPower = profile.ftp * (effortPercent / 100);

    return {
        targetPower,
        ftp: profile.ftp,
        humanEfficiency: profile.humanEfficiency,
        profile
    };
}
