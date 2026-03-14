export const BIKE_TYPES = {
    road: {
        id: 'road', name: 'Road', desc: '2x11',
        chainrings: [50, 34],
        cassette: [11, 12, 13, 14, 16, 18, 21, 24, 28, 32],
        circ: 2.136,
        frameColor: '#1a1814'
    },
    gravel: {
        id: 'gravel', name: 'Gravel', desc: '2x11',
        chainrings: [48, 31],
        cassette: [11, 13, 15, 17, 19, 21, 23, 25, 27, 30, 34],
        circ: 2.180,
        frameColor: '#1a6090'
    },
    cx: {
        id: 'cx', name: 'Cyclocross', desc: '1x11',
        chainrings: [40],
        cassette: [11, 12, 13, 14, 16, 18, 21, 24, 28, 32, 36],
        circ: 2.145,
        frameColor: '#c0392b'
    },
    mtb: {
        id: 'mtb', name: 'MTB', desc: '1x12',
        chainrings: [32],
        cassette: [10, 12, 14, 16, 18, 21, 24, 28, 33, 39, 45, 51],
        circ: 2.298,
        frameColor: '#c47a0a'
    },
    commuter: {
        id: 'commuter', name: 'Commuter', desc: '1x8',
        chainrings: [42],
        cassette: [11, 13, 15, 18, 21, 24, 28, 34],
        circ: 2.168,
        frameColor: '#5a5650'
    }
};

export const PRESETS = [
    { name: 'TT Aero', bike: 'road', raceType: 'time_trial', speed: 45, grade: 0, mass: 80, cda: 0.22, crr: 0.003, efficiency: 98, rho: 1.225, humanEff: 24 },
    { name: 'Pro Climb', bike: 'road', raceType: 'climbing', speed: 18, grade: 9, mass: 68, cda: 0.35, crr: 0.004, efficiency: 97, rho: 1.15, humanEff: 23 },
    { name: 'Gravel Grinder', bike: 'gravel', raceType: 'gravel_race', speed: 26, grade: 3, mass: 85, cda: 0.42, crr: 0.006, efficiency: 95, rho: 1.225, humanEff: 22.5 },
    { name: 'CX Race', bike: 'cx', raceType: 'cyclocross', speed: 24, grade: 0, mass: 82, cda: 0.45, crr: 0.008, efficiency: 94, rho: 1.225, humanEff: 22.5 },
    { name: 'MTB Trail', bike: 'mtb', raceType: 'trail', speed: 16, grade: 4, mass: 88, cda: 0.48, crr: 0.012, efficiency: 93, rho: 1.225, humanEff: 22 },
    { name: 'Commuter', bike: 'commuter', raceType: 'commute', speed: 22, grade: 0, mass: 95, cda: 0.55, crr: 0.007, efficiency: 94, rho: 1.225, humanEff: 22 }
];

export const DEFAULT_SCENARIO = {
    driverMode: 'speed',
    descentControl: 'brake',
    aeroMode: 'derived',
    raceType: 'road_endurance',
    speed: 32,
    riderPower: 220,
    grade: 0,
    mass: 82,
    manualCda: 0.32,
    crr: 0.0045,
    efficiency: 97,
    rho: 1.225,
    humanEfficiency: 23.5,
    bikeId: 'road',
    shiftMode: 'auto',
    targetCadence: 90,
    manualFrontIdx: 0,
    manualRearIdx: 5
};
