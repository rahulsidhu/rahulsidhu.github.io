export const BIKE_TYPES = {
    road: {
        id: 'road', name: 'Road', desc: '2x11',
        chainrings: [50, 34],
        cassette: [11, 12, 13, 14, 16, 18, 21, 24, 28, 32],
        circ: 2.136,
        bikeWeight: 8.2,
        frameColor: '#1a1814'
    },
    gravel: {
        id: 'gravel', name: 'Gravel', desc: '2x11',
        chainrings: [48, 31],
        cassette: [11, 13, 15, 17, 19, 21, 23, 25, 27, 30, 34],
        circ: 2.180,
        bikeWeight: 9.4,
        frameColor: '#1a6090'
    },
    cx: {
        id: 'cx', name: 'Cyclocross', desc: '1x11',
        chainrings: [40],
        cassette: [11, 12, 13, 14, 16, 18, 21, 24, 28, 32, 36],
        circ: 2.145,
        bikeWeight: 8.6,
        frameColor: '#c0392b'
    },
    track: {
        id: 'track', name: 'Track', desc: '1x1',
        chainrings: [48],
        cassette: [15],
        circ: 2.096,
        bikeWeight: 7.6,
        frameColor: '#6c3483'
    },
    mtb: {
        id: 'mtb', name: 'MTB', desc: '1x12',
        chainrings: [32],
        cassette: [10, 12, 14, 16, 18, 21, 24, 28, 33, 39, 45, 51],
        circ: 2.298,
        bikeWeight: 12.4,
        frameColor: '#c47a0a'
    },
    commuter: {
        id: 'commuter', name: 'Commuter', desc: '1x8',
        chainrings: [42],
        cassette: [11, 13, 15, 18, 21, 24, 28, 34],
        circ: 2.168,
        bikeWeight: 11.8,
        frameColor: '#5a5650'
    }
};

export const PRESETS = [
    { name: 'TT Aero', bike: 'road', raceType: 'time_trial', riderProfile: 'pro', effortPercent: 95, grade: 0, riderWeight: 72, cda: 0.22, crr: 0.003, efficiency: 98, rho: 1.225, windSpeed: 0 },
    { name: 'Pro Climb', bike: 'road', raceType: 'climbing', riderProfile: 'elite', effortPercent: 102, grade: 9, riderWeight: 60, cda: 0.35, crr: 0.004, efficiency: 97, rho: 1.15, windSpeed: 0 },
    { name: 'Gravel Grinder', bike: 'gravel', raceType: 'gravel_race', riderProfile: 'amateur', effortPercent: 88, grade: 3, riderWeight: 76, cda: 0.42, crr: 0.006, efficiency: 95, rho: 1.225, windSpeed: 4 },
    { name: 'CX Race', bike: 'cx', raceType: 'cyclocross', riderProfile: 'pro', effortPercent: 96, grade: 0, riderWeight: 73, cda: 0.45, crr: 0.008, efficiency: 94, rho: 1.225, windSpeed: 3 },
    { name: 'Track Pursuit', bike: 'track', raceType: 'track_pursuit', riderProfile: 'elite', effortPercent: 108, grade: 0, riderWeight: 75, cda: 0.20, crr: 0.0025, efficiency: 98, rho: 1.225, windSpeed: 0 },
    { name: 'MTB Trail', bike: 'mtb', raceType: 'trail', riderProfile: 'amateur', effortPercent: 82, grade: 4, riderWeight: 76, cda: 0.48, crr: 0.012, efficiency: 93, rho: 1.225, windSpeed: 2 },
    { name: 'Commuter', bike: 'commuter', raceType: 'commute', riderProfile: 'amateur', effortPercent: 68, grade: 0, riderWeight: 83, cda: 0.55, crr: 0.007, efficiency: 94, rho: 1.225, windSpeed: -2 }
];

const BASELINE_CRR_BY_BIKE = {
    road: 0.0045,
    gravel: 0.0065,
    cx: 0.008,
    track: 0.0025,
    mtb: 0.012,
    commuter: 0.007
};

const EVENT_CRR_ADJUSTMENT = {
    road_endurance: 0.0000,
    time_trial: -0.0010,
    climbing: -0.0005,
    gravel_race: 0.0005,
    cyclocross: 0.0000,
    track_pursuit: 0.0000,
    trail: 0.0000,
    commute: 0.0000
};

export function estimateCrr({ bikeId, raceType }) {
    const baselineCrr = BASELINE_CRR_BY_BIKE[bikeId] ?? 0.0055;
    const eventAdjustment = EVENT_CRR_ADJUSTMENT[raceType] ?? 0;
    return Number((baselineCrr + eventAdjustment).toFixed(4));
}

export const DEFAULT_SCENARIO = {
    descentControl: 'hybrid',
    aeroMode: 'derived',
    raceType: 'road_endurance',
    riderProfile: 'amateur',
    effortPercent: 75,
    grade: 0,
    riderWeight: 74,
    manualCda: 0.32,
    crr: 0.0045,
    efficiency: 97,
    rho: 1.225,
    windSpeed: 0,
    bikeId: 'road',
    shiftMode: 'auto',
    targetCadence: 90,
    manualFrontIdx: 0,
    manualRearIdx: 5
};
