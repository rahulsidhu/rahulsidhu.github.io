export const RACE_TYPES = {
    road_endurance: { id: 'road_endurance', name: 'Road Endurance' },
    time_trial: { id: 'time_trial', name: 'Time Trial' },
    climbing: { id: 'climbing', name: 'Climbing' },
    gravel_race: { id: 'gravel_race', name: 'Gravel Race' },
    cyclocross: { id: 'cyclocross', name: 'Cyclocross' },
    trail: { id: 'trail', name: 'MTB Trail' },
    commute: { id: 'commute', name: 'Urban Commute' }
};

const BASELINE_CDA_BY_BIKE = {
    road: 0.32,
    gravel: 0.40,
    cx: 0.43,
    mtb: 0.50,
    commuter: 0.58
};

const RACE_TYPE_CDA_ADJUSTMENT = {
    road_endurance: -0.02,
    time_trial: -0.10,
    climbing: 0.03,
    gravel_race: 0.02,
    cyclocross: 0.02,
    trail: 0.00,
    commute: 0.00
};

const BIKE_RACE_OVERRIDES = {
    road: {
        time_trial: 0.22,
        climbing: 0.35,
        road_endurance: 0.30
    },
    gravel: {
        gravel_race: 0.42,
        road_endurance: 0.38
    },
    cx: {
        cyclocross: 0.45
    },
    mtb: {
        trail: 0.48
    },
    commuter: {
        commute: 0.55
    }
};

export function estimateCda({ bikeId, raceType }) {
    const bikeSpecificOverride = BIKE_RACE_OVERRIDES[bikeId]?.[raceType];
    if (typeof bikeSpecificOverride === 'number') {
        return bikeSpecificOverride;
    }

    const baselineCda = BASELINE_CDA_BY_BIKE[bikeId] ?? 0.38;
    const raceAdjustment = RACE_TYPE_CDA_ADJUSTMENT[raceType] ?? 0;
    return Number((baselineCda + raceAdjustment).toFixed(2));
}
