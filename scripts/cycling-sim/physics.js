export function calculatePhysics({ speed, grade, mass, cda, crr, efficiency, rho, humanEfficiency }) {
    const velocity = speed / 3.6;
    const gravity = 9.81;
    const pAir = 0.5 * rho * cda * Math.pow(velocity, 3);
    const theta = Math.atan(grade / 100);
    const pRoll = mass * gravity * Math.cos(theta) * crr * velocity;
    const pGrav = mass * gravity * Math.sin(theta) * velocity;
    const pGravSource = pGrav < 0 ? Math.abs(pGrav) : 0;
    const pGravSink = pGrav > 0 ? pGrav : 0;
    const dragSinks = pAir + pRoll + pGravSink;
    const effDecimal = efficiency / 100;

    let pRider = 0;
    let pLoss = 0;
    let pBrake = 0;

    if (pGravSource >= dragSinks) {
        pBrake = pGravSource - dragSinks;
    } else {
        const pWheelReq = dragSinks - pGravSource;
        pRider = pWheelReq / effDecimal;
        pLoss = pRider - pWheelReq;
    }

    const pMetabolic = pRider > 0 ? pRider / (humanEfficiency / 100) : 0;
    const pBodyHeat = pMetabolic - pRider;

    return {
        pAir,
        pRoll,
        pGravSource,
        pGravSink,
        pRider,
        pLoss,
        pBrake,
        pMetabolic,
        pBodyHeat,
        totalWatts: pRider
    };
}
