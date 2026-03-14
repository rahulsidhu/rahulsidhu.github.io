export function calculatePhysics({ speed, grade, mass, cda, crr, efficiency, rho, humanEfficiency, descentControl = 'brake' }) {
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
    let pExcess = 0;

    if (pGravSource >= dragSinks) {
        if (descentControl === 'coast') {
            pExcess = pGravSource - dragSinks;
        } else {
            pBrake = pGravSource - dragSinks;
        }
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
        pExcess,
        pMetabolic,
        pBodyHeat,
        totalWatts: pRider
    };
}

export function solveSteadyStateSpeed({ grade, mass, cda, crr, efficiency, rho, humanEfficiency, targetRiderPower, maxSpeed = 120 }) {
    const getNetAssist = (speed) => {
        const velocity = speed / 3.6;
        const gravity = 9.81;
        const theta = Math.atan(grade / 100);
        const pAir = 0.5 * rho * cda * Math.pow(velocity, 3);
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
