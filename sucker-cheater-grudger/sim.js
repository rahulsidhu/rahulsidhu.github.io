(function () {
    const HISTORY_LIMIT = 240;
    const EVENT_LIMIT = 30;
    const RIBBON_SIZE = 100;
    const CLASSIC_PAYOFFS = {
        temptation: 5,
        reward: 3,
        punishment: 1,
        sucker: 0
    };

    const STRATEGIES = {
        sucker: {
            key: 'sucker',
            label: 'Sucker',
            color: '#d18b47',
            description: 'Always cooperates.'
        },
        cheater: {
            key: 'cheater',
            label: 'Cheater',
            color: '#c44b3b',
            description: 'Always defects.'
        },
        grudger: {
            key: 'grudger',
            label: 'Grudger',
            color: '#2d6f62',
            description: 'Cooperates until cheated, then defects thereafter.'
        }
    };

    const PRESETS = {
        suckerField: {
            key: 'suckerField',
            label: 'Suckers + cheater seed',
            controls: {
                suckerWeight: 78,
                cheaterWeight: 16,
                grudgerWeight: 6,
                populationSize: 150,
                encountersPerAgent: 6,
                roundsPerMatch: 6,
                mutationRate: 0.01,
                selectionStrength: 1.15,
                speed: 1.4
            }
        },
        grudgerWall: {
            key: 'grudgerWall',
            label: 'Grudgers hold the line',
            controls: {
                suckerWeight: 18,
                cheaterWeight: 28,
                grudgerWeight: 54,
                populationSize: 150,
                encountersPerAgent: 7,
                roundsPerMatch: 8,
                mutationRate: 0.01,
                selectionStrength: 1.2,
                speed: 1.4
            }
        },
        knifeEdge: {
            key: 'knifeEdge',
            label: 'Knife-edge mix',
            controls: {
                suckerWeight: 34,
                cheaterWeight: 33,
                grudgerWeight: 33,
                populationSize: 180,
                encountersPerAgent: 5,
                roundsPerMatch: 5,
                mutationRate: 0.015,
                selectionStrength: 1,
                speed: 1.2
            }
        },
        shortShadow: {
            key: 'shortShadow',
            label: 'Short shadow of future',
            controls: {
                suckerWeight: 24,
                cheaterWeight: 38,
                grudgerWeight: 38,
                populationSize: 160,
                encountersPerAgent: 6,
                roundsPerMatch: 2,
                mutationRate: 0.012,
                selectionStrength: 1.05,
                speed: 1.4
            }
        }
    };

    const CONTROL_CONFIG = [
        {
            key: 'populationSize',
            label: 'Population size',
            min: 30,
            max: 300,
            step: 10,
            description: 'Individuals sampled into the population every generation.',
            format: (value) => String(Math.round(value))
        },
        {
            key: 'encountersPerAgent',
            label: 'Encounters per agent',
            min: 1,
            max: 12,
            step: 1,
            description: 'How many repeated matches each individual is expected to play per generation.',
            format: (value) => String(Math.round(value))
        },
        {
            key: 'roundsPerMatch',
            label: 'Rounds per match',
            min: 1,
            max: 12,
            step: 1,
            description: 'Shadow of the future. More rounds make retaliation matter more.',
            format: (value) => String(Math.round(value))
        },
        {
            key: 'mutationRate',
            label: 'Mutation rate',
            min: 0,
            max: 0.08,
            step: 0.002,
            description: 'Chance an offspring switches to a different strategy during reproduction.',
            format: (value) => (value * 100).toFixed(1) + '%'
        },
        {
            key: 'selectionStrength',
            label: 'Selection strength',
            min: 0.2,
            max: 2.5,
            step: 0.05,
            description: 'How strongly score differences shape reproduction odds.',
            format: (value) => value.toFixed(2) + 'x'
        },
        {
            key: 'speed',
            label: 'Playback speed',
            min: 0.25,
            max: 8,
            step: 0.25,
            description: 'Screen speed only. The game rules stay the same.',
            format: (value) => value.toFixed(2).replace(/\.00$/, '') + 'x'
        }
    ];

    const DEFAULT_CONTROLS = PRESETS.grudgerWall.controls;
    const PLAYBACK_BASE_MS = 360;

    const elements = {
        presetRow: document.getElementById('preset-row'),
        controlsForm: document.getElementById('controls-form'),
        sliderGrid: document.getElementById('slider-grid'),
        metricGrid: document.getElementById('metric-grid'),
        dominantBadge: document.getElementById('dominant-badge'),
        populationCaption: document.getElementById('population-caption'),
        populationRibbon: document.getElementById('population-ribbon'),
        shareBars: document.getElementById('share-bars'),
        payoffBars: document.getElementById('payoff-bars'),
        historyCanvas: document.getElementById('history-canvas'),
        payoffMatrix: document.getElementById('payoff-matrix'),
        roundsSummary: document.getElementById('rounds-summary'),
        eventLog: document.getElementById('event-log'),
        pauseButton: document.getElementById('pause-button'),
        stepButton: document.getElementById('step-button'),
        applyButton: document.getElementById('apply-button'),
        resetTop: document.getElementById('reset-top')
    };

    const context = elements.historyCanvas.getContext('2d');

    const state = {
        controls: { ...DEFAULT_CONTROLS },
        running: true,
        engine: null,
        lastTick: performance.now(),
        activePreset: PRESETS.grudgerWall.key
    };

    function randomChoice(items) {
        return items[Math.floor(Math.random() * items.length)];
    }

    function clamp(value, min, max) {
        return Math.min(max, Math.max(min, value));
    }

    function normalizeWeights(controls) {
        const total = controls.suckerWeight + controls.cheaterWeight + controls.grudgerWeight;
        const safeTotal = total > 0 ? total : 1;
        return {
            sucker: controls.suckerWeight / safeTotal,
            cheater: controls.cheaterWeight / safeTotal,
            grudger: controls.grudgerWeight / safeTotal
        };
    }

    function cumulativeShares(shares) {
        return [
            { key: 'sucker', limit: shares.sucker },
            { key: 'cheater', limit: shares.sucker + shares.cheater },
            { key: 'grudger', limit: 1 }
        ];
    }

    function sampleStrategy(shares) {
        const threshold = Math.random();
        const distribution = cumulativeShares(shares);
        for (let index = 0; index < distribution.length; index += 1) {
            if (threshold <= distribution[index].limit) {
                return distribution[index].key;
            }
        }
        return 'grudger';
    }

    function buildPopulation(controls) {
        const shares = normalizeWeights(controls);
        const agents = [];
        for (let index = 0; index < controls.populationSize; index += 1) {
            agents.push({
                id: index + 1,
                strategy: sampleStrategy(shares),
                score: 0,
                matches: 0,
                cooperations: 0
            });
        }
        return agents;
    }

    function resetScores(agents) {
        for (let index = 0; index < agents.length; index += 1) {
            agents[index].score = 0;
            agents[index].matches = 0;
            agents[index].cooperations = 0;
        }
    }

    function chooseDistinctAgents(agents) {
        const firstIndex = Math.floor(Math.random() * agents.length);
        let secondIndex = Math.floor(Math.random() * agents.length);
        while (secondIndex === firstIndex) {
            secondIndex = Math.floor(Math.random() * agents.length);
        }
        return [agents[firstIndex], agents[secondIndex]];
    }

    function decideMove(strategy, partnerCheated) {
        if (strategy === 'cheater') {
            return 'D';
        }
        if (strategy === 'grudger' && partnerCheated) {
            return 'D';
        }
        return 'C';
    }

    function payoffForMoves(moveA, moveB) {
        if (moveA === 'C' && moveB === 'C') {
            return [CLASSIC_PAYOFFS.reward, CLASSIC_PAYOFFS.reward];
        }
        if (moveA === 'D' && moveB === 'D') {
            return [CLASSIC_PAYOFFS.punishment, CLASSIC_PAYOFFS.punishment];
        }
        if (moveA === 'C' && moveB === 'D') {
            return [CLASSIC_PAYOFFS.sucker, CLASSIC_PAYOFFS.temptation];
        }
        return [CLASSIC_PAYOFFS.temptation, CLASSIC_PAYOFFS.sucker];
    }

    function playMatch(strategyA, strategyB, rounds) {
        let scoreA = 0;
        let scoreB = 0;
        let cooperationCount = 0;
        let aSawCheating = false;
        let bSawCheating = false;

        for (let round = 0; round < rounds; round += 1) {
            const moveA = decideMove(strategyA, aSawCheating);
            const moveB = decideMove(strategyB, bSawCheating);
            const payoffs = payoffForMoves(moveA, moveB);
            scoreA += payoffs[0];
            scoreB += payoffs[1];
            if (moveA === 'C') {
                cooperationCount += 1;
            }
            if (moveB === 'C') {
                cooperationCount += 1;
            }
            if (moveB === 'D') {
                aSawCheating = true;
            }
            if (moveA === 'D') {
                bSawCheating = true;
            }
        }

        return {
            scoreA,
            scoreB,
            cooperationRate: cooperationCount / (2 * rounds)
        };
    }

    function average(number, denominator) {
        return denominator > 0 ? number / denominator : 0;
    }

    function summarisePopulation(agents) {
        const counts = { sucker: 0, cheater: 0, grudger: 0 };
        const totalScore = { sucker: 0, cheater: 0, grudger: 0 };
        const matchCount = { sucker: 0, cheater: 0, grudger: 0 };

        for (let index = 0; index < agents.length; index += 1) {
            const agent = agents[index];
            counts[agent.strategy] += 1;
            totalScore[agent.strategy] += agent.score;
            matchCount[agent.strategy] += agent.matches;
        }

        return {
            counts,
            shares: {
                sucker: average(counts.sucker, agents.length),
                cheater: average(counts.cheater, agents.length),
                grudger: average(counts.grudger, agents.length)
            },
            averagePayoff: {
                sucker: average(totalScore.sucker, counts.sucker),
                cheater: average(totalScore.cheater, counts.cheater),
                grudger: average(totalScore.grudger, counts.grudger)
            },
            averageMatches: {
                sucker: average(matchCount.sucker, counts.sucker),
                cheater: average(matchCount.cheater, counts.cheater),
                grudger: average(matchCount.grudger, counts.grudger)
            }
        };
    }

    function makeHistoryPoint(generation, summary, cooperationRate) {
        return {
            generation,
            cooperationRate,
            sucker: summary.shares.sucker,
            cheater: summary.shares.cheater,
            grudger: summary.shares.grudger,
            averagePayoff: average(
                summary.averagePayoff.sucker * summary.shares.sucker +
                summary.averagePayoff.cheater * summary.shares.cheater +
                summary.averagePayoff.grudger * summary.shares.grudger,
                1
            )
        };
    }

    function dominantStrategy(shares) {
        return Object.keys(shares).reduce((bestKey, key) => {
            if (bestKey === null || shares[key] > shares[bestKey]) {
                return key;
            }
            return bestKey;
        }, null);
    }

    function pushEvent(engine, label, tone) {
        engine.events.unshift({ id: engine.nextEventId, label, tone: tone || 'neutral' });
        engine.nextEventId += 1;
        engine.events = engine.events.slice(0, EVENT_LIMIT);
    }

    function describeDominance(key) {
        if (!key) {
            return 'No dominant strategy';
        }
        return STRATEGIES[key].label + ' leading';
    }

    function createEngine(controls) {
        const population = buildPopulation(controls);
        const summary = summarisePopulation(population);
        const engine = {
            generation: 0,
            controls: { ...controls },
            population,
            history: [makeHistoryPoint(0, summary, 0)],
            events: [],
            nextEventId: 1,
            lastSummary: summary,
            lastPerformance: summary,
            lastCooperationRate: 0,
            lastMeanPayoff: 0,
            lastDominant: dominantStrategy(summary.shares),
            flags: {
                highCoop: false,
                lowCoop: false,
                fixationKey: null,
                grudgerAdvantage: false
            }
        };

        pushEvent(engine, `Generation 0: ${describeDominance(engine.lastDominant)} from the seeded mix.`, 'neutral');
        pushEvent(engine, `Generation 0: Matches last ${controls.roundsPerMatch} rounds, so grudgers can retaliate after the first defection.`, 'neutral');
        return engine;
    }

    function mutateStrategy(strategy, mutationRate) {
        if (Math.random() >= mutationRate) {
            return strategy;
        }
        const alternatives = Object.keys(STRATEGIES).filter((key) => key !== strategy);
        return randomChoice(alternatives);
    }

    function reproducePopulation(agents, controls) {
        let totalFitness = 0;
        const fitnesses = agents.map((agent) => {
            const fitness = Math.max(0.01, 1 + (agent.score * controls.selectionStrength) / Math.max(1, controls.roundsPerMatch * controls.encountersPerAgent * CLASSIC_PAYOFFS.temptation));
            totalFitness += fitness;
            return fitness;
        });

        const nextPopulation = [];
        for (let index = 0; index < controls.populationSize; index += 1) {
            let threshold = Math.random() * totalFitness;
            let parent = agents[agents.length - 1];
            for (let agentIndex = 0; agentIndex < agents.length; agentIndex += 1) {
                threshold -= fitnesses[agentIndex];
                if (threshold <= 0) {
                    parent = agents[agentIndex];
                    break;
                }
            }
            nextPopulation.push({
                id: index + 1,
                strategy: mutateStrategy(parent.strategy, controls.mutationRate),
                score: 0,
                matches: 0,
                cooperations: 0
            });
        }

        return nextPopulation;
    }

    function runGeneration(engine) {
        const controls = engine.controls;
        const agents = engine.population;
        resetScores(agents);

        const matchTarget = Math.max(1, Math.round((controls.populationSize * controls.encountersPerAgent) / 2));
        let totalCooperations = 0;

        for (let matchIndex = 0; matchIndex < matchTarget; matchIndex += 1) {
            const pair = chooseDistinctAgents(agents);
            const outcome = playMatch(pair[0].strategy, pair[1].strategy, controls.roundsPerMatch);
            pair[0].score += outcome.scoreA;
            pair[1].score += outcome.scoreB;
            pair[0].matches += 1;
            pair[1].matches += 1;
            pair[0].cooperations += outcome.cooperationRate * controls.roundsPerMatch;
            pair[1].cooperations += outcome.cooperationRate * controls.roundsPerMatch;
            totalCooperations += outcome.cooperationRate;
        }

        const preReproductionSummary = summarisePopulation(agents);
        const cooperationRate = totalCooperations / matchTarget;
        const nextPopulation = reproducePopulation(agents, controls);
        const postReproductionSummary = summarisePopulation(nextPopulation);
        const meanPayoff =
            preReproductionSummary.averagePayoff.sucker * preReproductionSummary.shares.sucker +
            preReproductionSummary.averagePayoff.cheater * preReproductionSummary.shares.cheater +
            preReproductionSummary.averagePayoff.grudger * preReproductionSummary.shares.grudger;

        engine.generation += 1;
        engine.population = nextPopulation;
        engine.lastSummary = postReproductionSummary;
        engine.lastPerformance = preReproductionSummary;
        engine.lastCooperationRate = cooperationRate;
        engine.lastMeanPayoff = meanPayoff;
        engine.history.push(makeHistoryPoint(engine.generation, engine.lastSummary, cooperationRate));
        if (engine.history.length > HISTORY_LIMIT) {
            engine.history = engine.history.slice(engine.history.length - HISTORY_LIMIT);
        }

        const leader = dominantStrategy(engine.lastSummary.shares);
        if (leader !== engine.lastDominant) {
            pushEvent(engine, `Generation ${engine.generation}: ${STRATEGIES[leader].label} takes the lead.`, 'signal');
            engine.lastDominant = leader;
        }

        if (cooperationRate >= 0.7 && !engine.flags.highCoop) {
            pushEvent(engine, `Generation ${engine.generation}: Cooperation rose above 70%. Repeated matches are rewarding restraint.`, 'signal');
            engine.flags.highCoop = true;
            engine.flags.lowCoop = false;
        }

        if (cooperationRate <= 0.35 && !engine.flags.lowCoop) {
            pushEvent(engine, `Generation ${engine.generation}: Cooperation fell below 35%. Defection has become the dominant local incentive.`, 'warning');
            engine.flags.lowCoop = true;
            engine.flags.highCoop = false;
        }

        if (cooperationRate > 0.35 && cooperationRate < 0.7) {
            engine.flags.highCoop = false;
            engine.flags.lowCoop = false;
        }

        const maxShare = Math.max(engine.lastSummary.shares.sucker, engine.lastSummary.shares.cheater, engine.lastSummary.shares.grudger);
        if (maxShare >= 0.85 && engine.flags.fixationKey !== leader) {
            pushEvent(engine, `Generation ${engine.generation}: ${STRATEGIES[leader].label} is near fixation at ${(maxShare * 100).toFixed(0)}%.`, 'warning');
            engine.flags.fixationKey = leader;
        }

        if (maxShare < 0.85) {
            engine.flags.fixationKey = null;
        }

        const previousCheaterPayoff = preReproductionSummary.averagePayoff.cheater;
        const previousGrudgerPayoff = preReproductionSummary.averagePayoff.grudger;
        if (previousGrudgerPayoff > previousCheaterPayoff && preReproductionSummary.shares.cheater > 0.15 && !engine.flags.grudgerAdvantage) {
            pushEvent(engine, `Generation ${engine.generation}: Grudgers outscored cheaters before reproduction, so punishment is now paying for itself.`, 'signal');
            engine.flags.grudgerAdvantage = true;
        }

        if (previousGrudgerPayoff <= previousCheaterPayoff || preReproductionSummary.shares.cheater <= 0.15) {
            engine.flags.grudgerAdvantage = false;
        }
    }

    function formatPercent(value) {
        return (value * 100).toFixed(1) + '%';
    }

    function formatNumber(value) {
        return value.toFixed(2).replace(/\.00$/, '');
    }

    function renderPresets() {
        const fragment = document.createDocumentFragment();
        Object.keys(PRESETS).forEach((key) => {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'preset-button' + (state.activePreset === key ? ' active' : '');
            button.textContent = PRESETS[key].label;
            button.addEventListener('click', function () {
                state.controls = { ...PRESETS[key].controls };
                state.activePreset = key;
                syncControlsToInputs();
                renderPresets();
                renderPayoffMatrix();
            });
            fragment.appendChild(button);
        });
        elements.presetRow.replaceChildren(fragment);
    }

    function renderSliders() {
        const fragment = document.createDocumentFragment();
        CONTROL_CONFIG.forEach((config) => {
            const card = document.createElement('div');
            card.className = 'slider-card';
            card.title = config.description;

            const top = document.createElement('div');
            top.className = 'slider-top';

            const label = document.createElement('label');
            label.htmlFor = config.key;
            label.textContent = config.label;

            const value = document.createElement('span');
            value.className = 'value';
            value.id = config.key + '-value';

            top.appendChild(label);
            top.appendChild(value);

            const input = document.createElement('input');
            input.type = 'range';
            input.id = config.key;
            input.name = config.key;
            input.min = String(config.min);
            input.max = String(config.max);
            input.step = String(config.step);
            input.addEventListener('input', handleControlInput);

            card.appendChild(top);
            card.appendChild(input);
            fragment.appendChild(card);
        });
        elements.sliderGrid.replaceChildren(fragment);
    }

    function syncControlsToInputs() {
        document.getElementById('sucker-weight').value = String(state.controls.suckerWeight);
        document.getElementById('cheater-weight').value = String(state.controls.cheaterWeight);
        document.getElementById('grudger-weight').value = String(state.controls.grudgerWeight);

        CONTROL_CONFIG.forEach((config) => {
            const input = document.getElementById(config.key);
            const value = document.getElementById(config.key + '-value');
            if (input) {
                input.value = String(state.controls[config.key]);
            }
            if (value) {
                value.textContent = config.format(state.controls[config.key]);
            }
        });

        const shares = normalizeWeights(state.controls);
        document.getElementById('sucker-weight-value').textContent = String(state.controls.suckerWeight);
        document.getElementById('cheater-weight-value').textContent = String(state.controls.cheaterWeight);
        document.getElementById('grudger-weight-value').textContent = String(state.controls.grudgerWeight);
        document.getElementById('sucker-share-value').textContent = formatPercent(shares.sucker);
        document.getElementById('cheater-share-value').textContent = formatPercent(shares.cheater);
        document.getElementById('grudger-share-value').textContent = formatPercent(shares.grudger);
    }

    function handleControlInput(event) {
        const target = event.target;
        const key = target.name;
        state.controls[key] = Number(target.value);
        if (key === 'speed' && state.engine) {
            state.engine.controls.speed = state.controls.speed;
        }
        state.activePreset = null;
        syncControlsToInputs();
        renderPresets();
        renderPayoffMatrix();
    }

    function renderMetrics(summary, cooperationRate) {
        const dominant = dominantStrategy(summary.shares);
        const generationLabel = state.engine.generation.toString();
        const diversity = [summary.shares.sucker, summary.shares.cheater, summary.shares.grudger]
            .filter((share) => share > 0.001)
            .length;

        const metrics = [
            { label: 'Generation', value: generationLabel },
            { label: 'Cooperation', value: formatPercent(cooperationRate) },
            { label: 'Mean payoff', value: state.engine.lastMeanPayoff.toFixed(2) },
            { label: 'Strategies present', value: String(diversity) }
        ];

        const fragment = document.createDocumentFragment();
        metrics.forEach((metric) => {
            const card = document.createElement('div');
            card.className = 'metric-card';
            card.innerHTML = '<div class="subtle">' + metric.label + '</div><span class="metric-value">' + metric.value + '</span>';
            fragment.appendChild(card);
        });
        elements.metricGrid.replaceChildren(fragment);

        elements.dominantBadge.textContent = describeDominance(dominant);
        elements.populationCaption.textContent = state.engine.population.length + ' individuals';
    }

    function renderPopulationRibbon(summary) {
        const counts = {
            sucker: Math.round(summary.shares.sucker * RIBBON_SIZE),
            cheater: Math.round(summary.shares.cheater * RIBBON_SIZE),
            grudger: Math.round(summary.shares.grudger * RIBBON_SIZE)
        };
        let assigned = counts.sucker + counts.cheater + counts.grudger;
        while (assigned < RIBBON_SIZE) {
            counts.grudger += 1;
            assigned += 1;
        }
        while (assigned > RIBBON_SIZE) {
            const largest = Object.keys(counts).reduce((bestKey, key) => counts[key] > counts[bestKey] ? key : bestKey, 'sucker');
            counts[largest] -= 1;
            assigned -= 1;
        }

        const cells = [];
        Object.keys(counts).forEach((key) => {
            for (let index = 0; index < counts[key]; index += 1) {
                cells.push(key);
            }
        });

        const fragment = document.createDocumentFragment();
        cells.forEach((key) => {
            const cell = document.createElement('div');
            cell.className = 'population-cell';
            cell.style.background = STRATEGIES[key].color;
            cell.title = STRATEGIES[key].label;
            fragment.appendChild(cell);
        });
        elements.populationRibbon.replaceChildren(fragment);
    }

    function renderBarStack(container, values, formatter, domainMax) {
        const fragment = document.createDocumentFragment();
        Object.keys(STRATEGIES).forEach((key) => {
            const row = document.createElement('div');
            row.className = 'bar-row';

            const label = document.createElement('span');
            label.textContent = STRATEGIES[key].label;
            label.className = key + '-tone';

            const track = document.createElement('div');
            track.className = 'bar-track';

            const fill = document.createElement('div');
            fill.className = 'bar-fill';
            fill.style.background = STRATEGIES[key].color;
            fill.style.width = Math.max(0, Math.min(100, (values[key] / domainMax) * 100)) + '%';
            track.appendChild(fill);

            const value = document.createElement('span');
            value.className = 'bar-value';
            value.textContent = formatter(values[key]);

            row.appendChild(label);
            row.appendChild(track);
            row.appendChild(value);
            fragment.appendChild(row);
        });
        container.replaceChildren(fragment);
    }

    function renderHistory(history) {
        const width = elements.historyCanvas.width;
        const height = elements.historyCanvas.height;
        const padding = { top: 20, right: 18, bottom: 28, left: 40 };
        const plotWidth = width - padding.left - padding.right;
        const plotHeight = height - padding.top - padding.bottom;

        context.clearRect(0, 0, width, height);
        context.fillStyle = '#6f675c';
        context.font = '12px IBM Plex Sans';

        for (let guide = 0; guide <= 4; guide += 1) {
            const y = padding.top + (plotHeight * guide) / 4;
            context.strokeStyle = 'rgba(29, 25, 19, 0.08)';
            context.beginPath();
            context.moveTo(padding.left, y);
            context.lineTo(width - padding.right, y);
            context.stroke();

            const label = (100 - guide * 25).toFixed(0) + '%';
            context.fillText(label, 4, y + 4);
        }

        if (history.length <= 1) {
            return;
        }

        const maxGeneration = history[history.length - 1].generation || 1;
        const xFor = (generation) => padding.left + (generation / maxGeneration) * plotWidth;
        const yFor = (value) => padding.top + plotHeight - value * plotHeight;

        function drawSeries(accessor, color, lineWidth, dash) {
            context.save();
            context.strokeStyle = color;
            context.lineWidth = lineWidth;
            if (dash) {
                context.setLineDash(dash);
            }
            context.beginPath();
            history.forEach((point, index) => {
                const x = xFor(point.generation);
                const y = yFor(accessor(point));
                if (index === 0) {
                    context.moveTo(x, y);
                } else {
                    context.lineTo(x, y);
                }
            });
            context.stroke();
            context.restore();
        }

        drawSeries((point) => point.sucker, STRATEGIES.sucker.color, 2.5);
        drawSeries((point) => point.cheater, STRATEGIES.cheater.color, 2.5);
        drawSeries((point) => point.grudger, STRATEGIES.grudger.color, 2.5);
        drawSeries((point) => point.cooperationRate, '#61789f', 2, [8, 6]);

        context.fillStyle = '#6f675c';
        context.fillText('0', padding.left - 4, height - 8);
        context.fillText(String(maxGeneration), width - padding.right - 20, height - 8);
    }

    function describeCell(rowKey, columnKey, rounds) {
        const result = playMatch(rowKey, columnKey, rounds);
        return {
            row: STRATEGIES[rowKey].label,
            column: STRATEGIES[columnKey].label,
            payoff: formatNumber(result.scoreA) + ' / ' + formatNumber(result.scoreB),
            average: formatNumber(result.scoreA / rounds) + ' / ' + formatNumber(result.scoreB / rounds),
            cooperation: formatPercent(result.cooperationRate)
        };
    }

    function renderPayoffMatrix() {
        const rounds = Math.round(state.controls.roundsPerMatch);
        elements.roundsSummary.textContent = rounds + ' rounds per repeated match';

        const rows = [];
        Object.keys(STRATEGIES).forEach((rowKey) => {
            Object.keys(STRATEGIES).forEach((columnKey) => {
                rows.push(describeCell(rowKey, columnKey, rounds));
            });
        });

        const table = document.createElement('table');
        table.className = 'payoff-table';
        table.innerHTML = '<thead><tr><th>Pair</th><th>Total payoff</th><th>Avg/round</th><th>Cooperation</th></tr></thead>';
        const body = document.createElement('tbody');
        rows.forEach((row) => {
            const tr = document.createElement('tr');
            tr.innerHTML = '<td>' + row.row + ' vs ' + row.column + '</td><td>' + row.payoff + '</td><td>' + row.average + '</td><td>' + row.cooperation + '</td>';
            body.appendChild(tr);
        });
        table.appendChild(body);
        elements.payoffMatrix.replaceChildren(table);
    }

    function renderEvents(events) {
        const fragment = document.createDocumentFragment();
        events.forEach((event) => {
            const item = document.createElement('div');
            item.className = 'log-entry ' + (event.tone || 'neutral');
            item.textContent = event.label;
            fragment.appendChild(item);
        });
        elements.eventLog.replaceChildren(fragment);
    }

    function render() {
        const summary = state.engine.lastSummary;
        const performance = state.engine.lastPerformance;
        renderMetrics(summary, state.engine.lastCooperationRate);
        renderPopulationRibbon(summary);
        renderBarStack(elements.shareBars, summary.shares, formatPercent, 1);
        const maxPayoff = Math.max(0.1, performance.averagePayoff.sucker, performance.averagePayoff.cheater, performance.averagePayoff.grudger);
        renderBarStack(elements.payoffBars, performance.averagePayoff, formatNumber, maxPayoff);
        renderHistory(state.engine.history);
        renderEvents(state.engine.events);
    }

    function resetSimulation() {
        state.engine = createEngine({ ...state.controls });
        render();
    }

    function toggleRunning() {
        state.running = !state.running;
        elements.pauseButton.textContent = state.running ? 'Pause' : 'Resume';
    }

    function animate(now) {
        const elapsed = now - state.lastTick;
        const interval = PLAYBACK_BASE_MS / Math.max(0.25, state.controls.speed);
        if (state.running && elapsed >= interval) {
            runGeneration(state.engine);
            render();
            state.lastTick = now;
        }
        requestAnimationFrame(animate);
    }

    function stepOnce() {
        runGeneration(state.engine);
        render();
    }

    function wireEvents() {
        document.getElementById('sucker-weight').addEventListener('input', handleControlInput);
        document.getElementById('cheater-weight').addEventListener('input', handleControlInput);
        document.getElementById('grudger-weight').addEventListener('input', handleControlInput);
        elements.pauseButton.addEventListener('click', toggleRunning);
        elements.stepButton.addEventListener('click', function () {
            if (state.running) {
                toggleRunning();
            }
            stepOnce();
        });
        elements.applyButton.addEventListener('click', resetSimulation);
        elements.resetTop.addEventListener('click', resetSimulation);
    }

    function init() {
        renderSliders();
        renderPresets();
        syncControlsToInputs();
        renderPayoffMatrix();
        wireEvents();
        resetSimulation();
        requestAnimationFrame(animate);
    }

    init();
})();