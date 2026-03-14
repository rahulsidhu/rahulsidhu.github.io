export function calculatePhysics({ speed, grade, mass, cda, crr, efficiency, rho, humanEfficiency, windSpeed = 0, descentControl = 'brake', descentSpeedLimit = null }) {
    const velocity = speed / 3.6;
    const windVelocity = windSpeed / 3.6;
    const relativeAirVelocity = velocity + windVelocity;
    const gravity = 9.81;
    const pAirNet = 0.5 * rho * cda * relativeAirVelocity * Math.abs(relativeAirVelocity) * velocity;
    const pAir = pAirNet > 0 ? pAirNet : 0;
    const pAirAssist = pAirNet < 0 ? Math.abs(pAirNet) : 0;
    const theta = Math.atan(grade / 100);
    const pRoll = mass * gravity * Math.cos(theta) * crr * velocity;
    const pGrav = mass * gravity * Math.sin(theta) * velocity;
    const pGravSource = pGrav < 0 ? Math.abs(pGrav) : 0;
    const pGravSink = pGrav > 0 ? pGrav : 0;
    const totalSources = pGravSource + pAirAssist;
    const totalSinks = pAir + pRoll + pGravSink;
    const effDecimal = efficiency / 100;

    let pRider = 0;
    let pLoss = 0;
    let pBrake = 0;
    let pExcess = 0;

    if (totalSources >= totalSinks) {
        if (descentControl === 'coast') {
            pExcess = totalSources - totalSinks;
        } else if (descentControl === 'hybrid') {
            const isAtHybridLimit = typeof descentSpeedLimit === 'number' && speed >= descentSpeedLimit - 0.1;
            if (isAtHybridLimit) {
                pBrake = totalSources - totalSinks;
            } else {
                pExcess = totalSources - totalSinks;
            }
        } else {
            pBrake = totalSources - totalSinks;
        }
    } else {
        const pWheelReq = totalSinks - totalSources;
        pRider = pWheelReq / effDecimal;
        pLoss = pRider - pWheelReq;
    }

    const pMetabolic = pRider > 0 ? pRider / (humanEfficiency / 100) : 0;
    const pBodyHeat = pMetabolic - pRider;

    return {
        pAir,
        pAirAssist,
        pAirNet,
        pRoll,
        pGravSource,
        pGravSink,
        pRider,
        pLoss,
        pBrake,
        pExcess,
        pMetabolic,
        pBodyHeat,
        totalWatts: pRider
    };
}

export function solveSteadyStateSpeed({ grade, mass, cda, crr, efficiency, rho, humanEfficiency, targetRiderPower, windSpeed = 0, maxSpeed = 120 }) {
    const getNetAssist = (speed) => {
        const velocity = speed / 3.6;
        const windVelocity = windSpeed / 3.6;
        const relativeAirVelocity = velocity + windVelocity;
        const gravity = 9.81;
        const theta = Math.atan(grade / 100);
        const pAir = 0.5 * rho * cda * relativeAirVelocity * Math.abs(relativeAirVelocity) * velocity;
        const pRoll = mass * gravity * Math.cos(theta) * crr * velocity;
        const pGrav = mass * gravity * Math.sin(theta) * velocity;
        return (pGrav < 0 ? Math.abs(pGrav) : 0) - (pAir + pRoll + (pGrav > 0 ? pGrav : 0));
    };

    const solveByBisection = (evaluate, low, high) => {
        let left = low;
        let right = high;
        let leftValue = evaluate(left);
        let rightValue = evaluate(right);

        if (Math.abs(leftValue) < 0.01) {
            return left;
        }

        if (Math.abs(rightValue) < 0.01) {
            return right;
        }

        for (let iteration = 0; iteration < 48; iteration += 1) {
            const mid = (left + right) / 2;
            const result = evaluate(mid);

            if (Math.abs(result) < 0.01) {
                return mid;
            }

            if (Math.sign(result) === Math.sign(leftValue)) {
                left = mid;
                leftValue = result;
            } else {
                right = mid;
                rightValue = result;
            }
        }

        return (left + right) / 2;
    };

    if (targetRiderPower <= 0.5) {
        const netAtMax = getNetAssist(maxSpeed);

        if (netAtMax > 0) {
            return maxSpeed;
        }

        return solveByBisection(getNetAssist, 0, maxSpeed);
    }

    const evaluatePower = (speed) => calculatePhysics({
        speed,
        grade,
        mass,
        cda,
        crr,
        efficiency,
        rho,
        humanEfficiency
        ,windSpeed
    }).totalWatts - targetRiderPower;

    let upperBound = maxSpeed;
    while (evaluatePower(upperBound) < 0 && upperBound < 200) {
        upperBound += 20;
    }

    if (evaluatePower(upperBound) < 0) {
        return upperBound;
    }

    return solveByBisection(evaluatePower, 0, upperBound);
}
