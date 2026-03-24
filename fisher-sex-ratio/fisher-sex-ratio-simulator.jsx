const { useEffect, useRef, useState } = React;
const {
    ResponsiveContainer,
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ReferenceLine,
    BarChart,
    Bar,
    Cell
} = Recharts;

const HISTORY_LIMIT = 500;
const HISTOGRAM_BINS = 20;
const EQUILIBRIUM_STREAK_TARGET = 10;

const DEFAULT_CONTROLS = {
    startGene: 0.8,
    startVariance: 0.05,
    mutationStd: 0.02,
    offspringPerPair: 4,
    maxPopulation: 200,
    speed: 1
};

const PRESETS = {
    male: {
        key: 'male',
        label: 'Male-biased',
        gene: 0.85,
        description: '85% sons on average. Females start scarce.'
    },
    female: {
        key: 'female',
        label: 'Female-biased',
        gene: 0.15,
        description: '15% sons on average. Males start scarce.'
    },
    balanced: {
        key: 'balanced',
        label: 'Balanced',
        gene: 0.5,
        description: 'Already near the ESS. Watch stability rather than correction.'
    },
    custom: {
        key: 'custom',
        label: 'Custom',
        description: 'Use the slider for your own starting condition.'
    }
};

function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}

function gaussianRandom(mean, stdDev) {
    if (stdDev === 0) {
        return mean;
    }

    let u = 0;
    let v = 0;

    while (u === 0) {
        u = Math.random();
    }
    while (v === 0) {
        v = Math.random();
    }

    const magnitude = Math.sqrt(-2.0 * Math.log(u));
    const z = magnitude * Math.cos(2.0 * Math.PI * v);
    return mean + (z * stdDev);
}

function shuffleArray(items) {
    const copy = items.slice();
    for (let index = copy.length - 1; index > 0; index -= 1) {
        const swapIndex = Math.floor(Math.random() * (index + 1));
        const current = copy[index];
        copy[index] = copy[swapIndex];
        copy[swapIndex] = current;
    }
    return copy;
}

function describeBias(value) {
    if (value >= 0.8) {
        return 'strong male-biasing';
    }
    if (value >= 0.6) {
        return 'moderate male-biasing';
    }
    if (value <= 0.2) {
        return 'strong female-biasing';
    }
    if (value <= 0.4) {
        return 'moderate female-biasing';
    }
    return 'near-balanced';
}

function buildFounders(settings) {
    const agents = [];
    for (let index = 0; index < settings.maxPopulation; index += 1) {
        const gene = clamp(gaussianRandom(settings.startGene, settings.startVariance), 0, 1);
        agents.push({
            id: index + 1,
            sex: Math.random() < gene ? 'male' : 'female',
            sexRatioGene: gene,
            age: 0,
            alive: true
        });
    }
    return agents;
}

function summarisePopulation(agents) {
    const total = agents.length;
    if (total === 0) {
        return {
            total: 0,
            maleCount: 0,
            femaleCount: 0,
            sexRatioMale: 0,
            meanGene: 0,
            geneStd: 0,
            geneVariance: 0
        };
    }

    let maleCount = 0;
    let geneSum = 0;

    for (let index = 0; index < total; index += 1) {
        const agent = agents[index];
        if (agent.sex === 'male') {
            maleCount += 1;
        }
        geneSum += agent.sexRatioGene;
    }

    const meanGene = geneSum / total;
    let varianceAccumulator = 0;

    for (let index = 0; index < total; index += 1) {
        const distance = agents[index].sexRatioGene - meanGene;
        varianceAccumulator += distance * distance;
    }

    const geneVariance = varianceAccumulator / total;
    return {
        total,
        maleCount,
        femaleCount: total - maleCount,
        sexRatioMale: maleCount / total,
        meanGene,
        geneStd: Math.sqrt(geneVariance),
        geneVariance
    };
}

function makeHistoryPoint(generation, summary) {
    return {
        generation,
        sexRatioMale: summary.sexRatioMale,
        meanGene: summary.meanGene,
        ess: 0.5
    };
}

function buildHistogram(agents) {
    const bins = Array.from({ length: HISTOGRAM_BINS }, (_, index) => ({
        label: (index / HISTOGRAM_BINS).toFixed(2),
        midpoint: ((index + 0.5) / HISTOGRAM_BINS).toFixed(2),
        count: 0,
        fill: index < HISTOGRAM_BINS / 2 ? '#c97a52' : '#2f6f7e'
    }));

    for (let index = 0; index < agents.length; index += 1) {
        const gene = agents[index].sexRatioGene;
        const bucket = Math.min(HISTOGRAM_BINS - 1, Math.floor(gene * HISTOGRAM_BINS));
        bins[bucket].count += 1;
    }

    return bins;
}

function pushEvent(engine, label, tone) {
    engine.eventLog.unshift({
        id: engine.eventCounter,
        label,
        tone: tone || 'neutral'
    });
    engine.eventCounter += 1;
    engine.eventLog = engine.eventLog.slice(0, 32);
}

function crossedThreshold(previousValue, nextValue, threshold) {
    return (previousValue > threshold && nextValue <= threshold) || (previousValue < threshold && nextValue >= threshold);
}

function buildStatus(summary, engine) {
    if (summary.total === 0) {
        return 'Population collapsed after a single-sex bottleneck. Reset to seed variation again.';
    }
    if (engine.flags.equilibriumLogged) {
        return 'Mean gene is holding close to the ESS. Selection pressure has mostly flattened out.';
    }
    if (summary.sexRatioMale > 0.5) {
        return 'Males are common, so genes that produce more daughters gain a relative advantage.';
    }
    if (summary.sexRatioMale < 0.5) {
        return 'Females are common, so genes that produce more sons gain a relative advantage.';
    }
    return 'The population is near parity. Remaining movement is mostly mutation and sampling noise.';
}

function buildDisplay(engine) {
    const summary = engine.lastSummary;
    return {
        generation: engine.generation,
        history: engine.history.slice(),
        histogram: buildHistogram(engine.agents),
        stats: summary,
        eventLog: engine.eventLog.slice(),
        status: buildStatus(summary, engine)
    };
}

function createEngine(settings) {
    const agents = buildFounders(settings);
    const summary = summarisePopulation(agents);
    const engine = {
        nextId: agents.length + 1,
        generation: 0,
        agents,
        params: {
            mutationStd: settings.mutationStd,
            offspringPerPair: settings.offspringPerPair,
            maxPopulation: settings.maxPopulation
        },
        history: [makeHistoryPoint(0, summary)],
        lastSummary: summary,
        eventLog: [],
        eventCounter: 1,
        equilibriumStreak: Math.abs(summary.meanGene - 0.5) <= 0.01 ? 1 : 0,
        flags: {
            crossed60: false,
            crossed40: false,
            nearEssLogged: Math.abs(summary.meanGene - 0.5) <= 0.01,
            equilibriumLogged: false,
            singleSexLogged: summary.maleCount === 0 || summary.femaleCount === 0
        }
    };

    pushEvent(
        engine,
        `Generation 0: Starting mean sex-ratio gene = ${settings.startGene.toFixed(2)} (${Math.round(settings.startGene * 100)}% male probability, ${describeBias(settings.startGene)}).`,
        'neutral'
    );
    pushEvent(
        engine,
        `Generation 0: Founder variance = ${settings.startVariance.toFixed(3)}. Selection can only move the mean if variation exists to select on.`,
        'neutral'
    );

    if (summary.maleCount === 0 || summary.femaleCount === 0) {
        pushEvent(engine, 'Generation 0: Founders are already single-sex. Reproduction will fail on the next tick unless you reset.', 'warning');
    }

    return engine;
}

function runGeneration(engine) {
    const previousSummary = engine.lastSummary;
    const males = shuffleArray(engine.agents.filter((agent) => agent.sex === 'male'));
    const females = shuffleArray(engine.agents.filter((agent) => agent.sex === 'female'));
    const pairCount = Math.min(males.length, females.length);
    const offspring = [];

    for (let pairIndex = 0; pairIndex < pairCount; pairIndex += 1) {
        const father = males[pairIndex];
        const mother = females[pairIndex];
        const parentAverageGene = (father.sexRatioGene + mother.sexRatioGene) / 2;

        for (let childIndex = 0; childIndex < engine.params.offspringPerPair; childIndex += 1) {
            const inheritedGene = clamp(gaussianRandom(parentAverageGene, engine.params.mutationStd), 0, 1);
            offspring.push({
                id: engine.nextId,
                sex: Math.random() < parentAverageGene ? 'male' : 'female',
                sexRatioGene: inheritedGene,
                age: 0,
                alive: true
            });
            engine.nextId += 1;
        }
    }

    const culledOffspring = offspring.length > engine.params.maxPopulation
        ? shuffleArray(offspring).slice(0, engine.params.maxPopulation)
        : offspring;

    engine.generation += 1;
    engine.agents = culledOffspring;
    engine.lastSummary = summarisePopulation(engine.agents);
    engine.history.push(makeHistoryPoint(engine.generation, engine.lastSummary));
    if (engine.history.length > HISTORY_LIMIT) {
        engine.history = engine.history.slice(engine.history.length - HISTORY_LIMIT);
    }

    if (engine.lastSummary.total === 0) {
        pushEvent(
            engine,
            `Generation ${engine.generation}: No mating pairs formed, so the population collapsed after the parental generation died.`,
            'collapse'
        );
        return false;
    }

    if (!engine.flags.crossed60 && crossedThreshold(previousSummary.sexRatioMale, engine.lastSummary.sexRatioMale, 0.6)) {
        engine.flags.crossed60 = true;
        pushEvent(engine, `Generation ${engine.generation}: Sex ratio crossed 0.60 on the way back toward parity.`, 'signal');
    }

    if (!engine.flags.crossed40 && crossedThreshold(previousSummary.sexRatioMale, engine.lastSummary.sexRatioMale, 0.4)) {
        engine.flags.crossed40 = true;
        pushEvent(engine, `Generation ${engine.generation}: Sex ratio crossed 0.40 as the rarer sex regained value.`, 'signal');
    }

    if (!engine.flags.nearEssLogged && Math.abs(engine.lastSummary.meanGene - 0.5) <= 0.01) {
        engine.flags.nearEssLogged = true;
        pushEvent(engine, `Generation ${engine.generation}: Mean gene moved within 0.01 of the ESS at 0.50.`, 'signal');
    }

    if (engine.lastSummary.maleCount === 0 || engine.lastSummary.femaleCount === 0) {
        if (!engine.flags.singleSexLogged) {
            engine.flags.singleSexLogged = true;
            pushEvent(engine, `Generation ${engine.generation}: The population became single-sex. Unless mutation has already restored both sexes, collapse is imminent.`, 'warning');
        }
    } else {
        engine.flags.singleSexLogged = false;
    }

    if (Math.abs(engine.lastSummary.meanGene - 0.5) <= 0.01) {
        engine.equilibriumStreak += 1;
    } else {
        engine.equilibriumStreak = 0;
    }

    if (!engine.flags.equilibriumLogged && engine.equilibriumStreak >= EQUILIBRIUM_STREAK_TARGET) {
        engine.flags.equilibriumLogged = true;
        pushEvent(
            engine,
            `Generation ${engine.generation}: Equilibrium reached - mean gene stable at ${engine.lastSummary.meanGene.toFixed(3)} +/- ${engine.lastSummary.geneStd.toFixed(3)} for ${engine.equilibriumStreak} generations.`,
            'equilibrium'
        );
    }

    return true;
}

function formatPercent(value) {
    return `${Math.round(value * 100)}%`;
}

function formatRatio(value) {
    return value.toFixed(3);
}

function toneClass(tone) {
    if (tone === 'signal') {
        return 'border-l-male bg-male/8';
    }
    if (tone === 'warning') {
        return 'border-l-amber-600 bg-amber-50';
    }
    if (tone === 'collapse') {
        return 'border-l-rose-700 bg-rose-50';
    }
    if (tone === 'equilibrium') {
        return 'border-l-moss bg-moss/10';
    }
    return 'border-l-ess bg-white/70';
}

function StatCard({ label, value, detail }) {
    return (
        <div className="rounded-3xl border border-line/80 bg-white/80 p-4 shadow-sm">
            <p className="text-[11px] uppercase tracking-[0.22em] text-ess">{label}</p>
            <p className="mt-2 font-display text-2xl text-ink">{value}</p>
            <p className="mt-1 text-sm text-ess">{detail}</p>
        </div>
    );
}

function SliderControl({ label, value, min, max, step, onChange, formatter, hint, delayed }) {
    return (
        <label className="block rounded-3xl border border-line/80 bg-white/75 p-4">
            <div className="flex items-start justify-between gap-4">
                <div>
                    <p className="text-sm font-medium text-ink">{label}</p>
                    <p className="mt-1 text-xs leading-5 text-ess">{hint}</p>
                </div>
                <div className="text-right">
                    <p className="font-display text-xl text-ink">{formatter(value)}</p>
                    {delayed ? <p className="text-[11px] uppercase tracking-[0.16em] text-ember">applies on reset</p> : null}
                </div>
            </div>
            <input
                className="mt-4 h-2 w-full cursor-pointer appearance-none rounded-full bg-line accent-ink"
                type="range"
                min={min}
                max={max}
                step={step}
                value={value}
                onChange={(event) => onChange(Number(event.target.value))}
            />
        </label>
    );
}

function PresetButton({ preset, active, onClick }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={`rounded-full border px-4 py-2 text-sm transition-colors ${active ? 'border-ink bg-ink text-parchment' : 'border-line bg-white/70 text-ink hover:bg-white'}`}
        >
            {preset.label}
        </button>
    );
}

function FisherSexRatioSimulator() {
    const [controls, setControls] = useState(DEFAULT_CONTROLS);
    const [selectedPreset, setSelectedPreset] = useState('custom');
    const [isRunning, setIsRunning] = useState(true);
    const engineRef = useRef(null);
    const [display, setDisplay] = useState(() => {
        const engine = createEngine(DEFAULT_CONTROLS);
        engineRef.current = engine;
        return buildDisplay(engine);
    });

    useEffect(() => {
        if (!engineRef.current) {
            return;
        }
        engineRef.current.params = {
            mutationStd: controls.mutationStd,
            offspringPerPair: controls.offspringPerPair,
            maxPopulation: controls.maxPopulation
        };
    }, [controls.mutationStd, controls.offspringPerPair, controls.maxPopulation]);

    useEffect(() => {
        if (!isRunning) {
            return undefined;
        }

        const delay = Math.max(50, 1000 / controls.speed);
        const intervalId = window.setInterval(() => {
            const engine = engineRef.current;
            if (!engine || engine.agents.length === 0) {
                return;
            }

            const alive = runGeneration(engine);
            setDisplay(buildDisplay(engine));

            if (!alive) {
                setIsRunning(false);
            }
        }, delay);

        return () => window.clearInterval(intervalId);
    }, [controls.speed, isRunning]);

    function updateControl(key, value) {
        setControls((current) => ({
            ...current,
            [key]: value
        }));
    }

    function applyPreset(presetKey) {
        const preset = PRESETS[presetKey];
        if (!preset || typeof preset.gene !== 'number') {
            setSelectedPreset('custom');
            return;
        }
        setSelectedPreset(presetKey);
        setControls((current) => ({
            ...current,
            startGene: preset.gene
        }));
    }

    function resetSimulation() {
        const engine = createEngine(controls);
        engineRef.current = engine;
        setDisplay(buildDisplay(engine));
        setIsRunning(true);
    }

    const stats = display.stats;

    return (
        <div className="relative overflow-hidden">
            <div className="pointer-events-none absolute inset-0 gene-grid opacity-40"></div>
            <div className="relative mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
                <section className="rounded-[2rem] border border-line/70 bg-panel p-8 shadow-panel backdrop-blur xl:p-10">
                    <div className="flex flex-col gap-8 xl:flex-row xl:items-end xl:justify-between">
                        <div className="max-w-3xl">
                            <p className="text-sm uppercase tracking-[0.3em] text-ess">The Selfish Gene Companion</p>
                            <h1 className="mt-4 max-w-4xl font-display text-4xl leading-tight text-ink sm:text-5xl xl:text-6xl">
                                Fisher's Principle Sex Ratio Simulator
                            </h1>
                            <p className="mt-5 max-w-3xl text-base leading-7 text-ess sm:text-lg">
                                Selection does not need a target. If one sex becomes scarce, genes that produce more of that sex gain grandchildren faster. This model makes that feedback visible generation by generation.
                            </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-3">
                            <a href="../index.html" className="rounded-full border border-line bg-white/70 px-5 py-3 text-sm text-ink transition-colors hover:bg-white">
                                Back to home
                            </a>
                            <button
                                type="button"
                                onClick={() => setIsRunning((current) => !current)}
                                className="rounded-full bg-ink px-5 py-3 text-sm text-parchment transition-colors hover:bg-black"
                            >
                                {isRunning ? 'Pause' : 'Resume'}
                            </button>
                            <button
                                type="button"
                                onClick={resetSimulation}
                                className="rounded-full border border-ink bg-transparent px-5 py-3 text-sm text-ink transition-colors hover:bg-ink hover:text-parchment"
                            >
                                Reset
                            </button>
                        </div>
                    </div>

                    <div className="mt-8 rounded-[1.75rem] border border-line/80 bg-white/65 p-5 sm:p-6">
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                            <div>
                                <p className="text-xs uppercase tracking-[0.22em] text-ess">Current reading</p>
                                <p className="mt-2 font-display text-2xl text-ink">{display.status}</p>
                            </div>
                            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                                <div className="rounded-2xl bg-male/10 px-4 py-3 text-sm text-ink">
                                    <p className="text-[11px] uppercase tracking-[0.18em] text-ess">Actual sex ratio</p>
                                    <p className="mt-1 font-display text-2xl text-male">{formatPercent(stats.sexRatioMale)}</p>
                                </div>
                                <div className="rounded-2xl bg-female/12 px-4 py-3 text-sm text-ink">
                                    <p className="text-[11px] uppercase tracking-[0.18em] text-ess">Mean gene</p>
                                    <p className="mt-1 font-display text-2xl text-ember">{stats.meanGene.toFixed(4)}</p>
                                </div>
                                <div className="rounded-2xl bg-moss/10 px-4 py-3 text-sm text-ink">
                                    <p className="text-[11px] uppercase tracking-[0.18em] text-ess">Gene std. dev.</p>
                                    <p className="mt-1 font-display text-2xl text-moss">{stats.geneStd.toFixed(4)}</p>
                                </div>
                                <div className="rounded-2xl bg-white px-4 py-3 text-sm text-ink">
                                    <p className="text-[11px] uppercase tracking-[0.18em] text-ess">Population size</p>
                                    <p className="mt-1 font-display text-2xl text-ink">{stats.total}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                <section className="mt-8 grid gap-8 xl:grid-cols-[1.15fr_0.85fr]">
                    <div className="space-y-8">
                        <div className="rounded-[2rem] border border-line/70 bg-panel p-6 shadow-panel backdrop-blur sm:p-8">
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                                <div>
                                    <p className="text-sm uppercase tracking-[0.28em] text-ess">Primary chart</p>
                                    <h2 className="mt-2 font-display text-3xl text-ink">Population sex ratio over time</h2>
                                </div>
                                <p className="max-w-xl text-sm leading-6 text-ess">
                                    The blue line is the actual proportion of males. The rust line is the inherited gene. Both should be pulled toward 0.50 when variation is available.
                                </p>
                            </div>
                            <div className="mt-6 h-[340px] rounded-[1.5rem] border border-line/80 bg-white/75 p-3 sm:p-5">
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={display.history} margin={{ top: 10, right: 18, left: -16, bottom: 8 }}>
                                        <CartesianGrid stroke="rgba(108, 106, 99, 0.18)" strokeDasharray="4 4" />
                                        <XAxis dataKey="generation" tick={{ fill: '#6c6a63', fontSize: 12 }} minTickGap={28} />
                                        <YAxis domain={[0, 1]} tick={{ fill: '#6c6a63', fontSize: 12 }} tickFormatter={(value) => value.toFixed(1)} />
                                        <Tooltip
                                            formatter={(value, name) => [Number(value).toFixed(3), name]}
                                            labelFormatter={(value) => `Generation ${value}`}
                                            contentStyle={{ borderRadius: '18px', borderColor: '#d8cebe', backgroundColor: '#fffaf3' }}
                                        />
                                        <Legend />
                                        <ReferenceLine y={0.5} stroke="#6c6a63" strokeDasharray="7 5" label={{ value: 'ESS (Fisher)', fill: '#6c6a63', position: 'insideTopRight', fontSize: 12 }} />
                                        <Line type="monotone" dataKey="sexRatioMale" name="Actual sex ratio" stroke="#2f6f7e" strokeWidth={3} dot={false} isAnimationActive={false} />
                                        <Line type="monotone" dataKey="meanGene" name="Mean sex-ratio gene" stroke="#b34a2b" strokeWidth={3} dot={false} isAnimationActive={false} />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        <div className="rounded-[2rem] border border-line/70 bg-panel p-6 shadow-panel backdrop-blur sm:p-8">
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                                <div>
                                    <p className="text-sm uppercase tracking-[0.28em] text-ess">Secondary chart</p>
                                    <h2 className="mt-2 font-display text-3xl text-ink">Gene distribution histogram</h2>
                                </div>
                                <p className="max-w-xl text-sm leading-6 text-ess">
                                    A wide distribution gives selection room to work. Near equilibrium, the center of gravity should bunch around 0.50 even while mutation keeps a small spread alive.
                                </p>
                            </div>
                            <div className="mt-6 h-[300px] rounded-[1.5rem] border border-line/80 bg-white/75 p-3 sm:p-5">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={display.histogram} margin={{ top: 8, right: 10, left: -18, bottom: 8 }}>
                                        <CartesianGrid stroke="rgba(108, 106, 99, 0.14)" strokeDasharray="3 3" />
                                        <XAxis dataKey="label" tick={{ fill: '#6c6a63', fontSize: 11 }} interval={1} />
                                        <YAxis tick={{ fill: '#6c6a63', fontSize: 12 }} allowDecimals={false} />
                                        <Tooltip
                                            formatter={(value) => [value, 'Agents']}
                                            labelFormatter={(label) => `Gene bin ${label}-${(Number(label) + 0.05).toFixed(2)}`}
                                            contentStyle={{ borderRadius: '18px', borderColor: '#d8cebe', backgroundColor: '#fffaf3' }}
                                        />
                                        <Bar dataKey="count" radius={[6, 6, 0, 0]} isAnimationActive={false}>
                                            {display.histogram.map((entry) => (
                                                <Cell key={entry.label} fill={entry.fill} />
                                            ))}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-8">
                        <div className="rounded-[2rem] border border-line/70 bg-panel p-6 shadow-panel backdrop-blur sm:p-8">
                            <p className="text-sm uppercase tracking-[0.28em] text-ess">Starting conditions</p>
                            <h2 className="mt-2 font-display text-3xl text-ink">Presets and controls</h2>
                            <p className="mt-3 text-sm leading-6 text-ess">
                                Mutation, fertility, population cap, and speed update immediately. Starting gene and founder variance update the next time you reset.
                            </p>

                            <div className="mt-6 flex flex-wrap gap-3">
                                <PresetButton preset={PRESETS.male} active={selectedPreset === 'male'} onClick={() => applyPreset('male')} />
                                <PresetButton preset={PRESETS.female} active={selectedPreset === 'female'} onClick={() => applyPreset('female')} />
                                <PresetButton preset={PRESETS.balanced} active={selectedPreset === 'balanced'} onClick={() => applyPreset('balanced')} />
                                <PresetButton preset={PRESETS.custom} active={selectedPreset === 'custom'} onClick={() => setSelectedPreset('custom')} />
                            </div>

                            <div className="mt-6 space-y-4">
                                <SliderControl
                                    label="Starting sex ratio gene"
                                    value={controls.startGene}
                                    min={0}
                                    max={1}
                                    step={0.01}
                                    delayed={true}
                                    hint="Initial mean gene for the founder generation. This is the probability any child is born male."
                                    formatter={(value) => value.toFixed(2)}
                                    onChange={(value) => {
                                        setSelectedPreset('custom');
                                        updateControl('startGene', value);
                                    }}
                                />
                                <SliderControl
                                    label="Starting gene variance"
                                    value={controls.startVariance}
                                    min={0}
                                    max={0.2}
                                    step={0.005}
                                    delayed={true}
                                    hint="Founder spread around the mean. Without variance, selection has very little raw material to work on at first."
                                    formatter={(value) => value.toFixed(3)}
                                    onChange={(value) => {
                                        setSelectedPreset('custom');
                                        updateControl('startVariance', value);
                                    }}
                                />
                                <SliderControl
                                    label="Mutation rate (std)"
                                    value={controls.mutationStd}
                                    min={0}
                                    max={0.1}
                                    step={0.002}
                                    hint="Gaussian noise added to the inherited parental average."
                                    formatter={(value) => value.toFixed(3)}
                                    onChange={(value) => updateControl('mutationStd', value)}
                                />
                                <SliderControl
                                    label="Offspring per pair"
                                    value={controls.offspringPerPair}
                                    min={2}
                                    max={10}
                                    step={1}
                                    hint="Each matched pair produces this many offspring before culling."
                                    formatter={(value) => Math.round(value)}
                                    onChange={(value) => updateControl('offspringPerPair', value)}
                                />
                                <SliderControl
                                    label="Max population"
                                    value={controls.maxPopulation}
                                    min={50}
                                    max={1000}
                                    step={10}
                                    hint="If the new generation overshoots this cap, random culling trims it back."
                                    formatter={(value) => Math.round(value)}
                                    onChange={(value) => updateControl('maxPopulation', value)}
                                />
                                <SliderControl
                                    label="Simulation speed"
                                    value={controls.speed}
                                    min={0.1}
                                    max={20}
                                    step={0.1}
                                    hint="Generations per second. The rules stay discrete; only playback rate changes."
                                    formatter={(value) => `${value.toFixed(1)}x`}
                                    onChange={(value) => updateControl('speed', value)}
                                />
                            </div>
                        </div>

                        <div className="rounded-[2rem] border border-line/70 bg-panel p-6 shadow-panel backdrop-blur sm:p-8">
                            <p className="text-sm uppercase tracking-[0.28em] text-ess">Population snapshot</p>
                            <h2 className="mt-2 font-display text-3xl text-ink">Stats panel</h2>
                            <div className="mt-6 grid gap-4 sm:grid-cols-2">
                                <StatCard label="Generation" value={display.generation} detail="One tick equals one generation." />
                                <StatCard label="Population" value={stats.total} detail={`${stats.maleCount} male, ${stats.femaleCount} female`} />
                                <StatCard label="Sex ratio" value={formatPercent(stats.sexRatioMale)} detail="Proportion of living agents that are male." />
                                <StatCard label="Mean gene" value={stats.meanGene.toFixed(4)} detail="Average inherited male-birth probability." />
                                <StatCard label="Gene std. dev." value={stats.geneStd.toFixed(4)} detail="How wide the current distribution remains." />
                                <StatCard label="ESS distance" value={Math.abs(stats.meanGene - 0.5).toFixed(4)} detail="Absolute gap between the mean gene and 0.50." />
                            </div>
                        </div>

                        <div className="rounded-[2rem] border border-line/70 bg-panel p-6 shadow-panel backdrop-blur sm:p-8">
                            <div className="flex items-end justify-between gap-4">
                                <div>
                                    <p className="text-sm uppercase tracking-[0.28em] text-ess">Event log</p>
                                    <h2 className="mt-2 font-display text-3xl text-ink">Notable transitions</h2>
                                </div>
                                <p className="text-sm text-ess">Newest first</p>
                            </div>
                            <div className="log-scroll mt-6 max-h-[420px] space-y-3 overflow-y-auto pr-1">
                                {display.eventLog.map((entry) => (
                                    <div key={entry.id} className={`rounded-2xl border-l-4 px-4 py-3 text-sm leading-6 text-ink ${toneClass(entry.tone)}`}>
                                        {entry.label}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </section>

                <section className="mt-8 grid gap-8 lg:grid-cols-2">
                    <div className="rounded-[2rem] border border-line/70 bg-panel p-6 shadow-panel backdrop-blur sm:p-8">
                        <p className="text-sm uppercase tracking-[0.28em] text-ess">How to read it</p>
                        <h2 className="mt-2 font-display text-3xl text-ink">What this demonstrates</h2>
                        <div className="mt-6 grid gap-4 text-sm leading-6 text-ess">
                            <div className="rounded-3xl border border-line/80 bg-white/70 p-5">
                                <p className="font-medium text-ink">Selection without foresight</p>
                                <p className="mt-2">No lineage knows the target is 0.50. Relative reproductive success does the work automatically.</p>
                            </div>
                            <div className="rounded-3xl border border-line/80 bg-white/70 p-5">
                                <p className="font-medium text-ink">Frequency dependence</p>
                                <p className="mt-2">If one sex is rare, parents who generate more of that sex gain more grandchildren through the pairing bottleneck.</p>
                            </div>
                            <div className="rounded-3xl border border-line/80 bg-white/70 p-5">
                                <p className="font-medium text-ink">Genes converge, not just counts</p>
                                <p className="mt-2">The inherited bias itself moves toward 0.50, so the chart tracks selection on heritable variation rather than a one-off demographic correction.</p>
                            </div>
                            <div className="rounded-3xl border border-line/80 bg-white/70 p-5">
                                <p className="font-medium text-ink">Stability around the ESS</p>
                                <p className="mt-2">Once the mean gene is near parity, directional pressure weakens and only mutation plus finite-population noise keep it moving.</p>
                            </div>
                        </div>
                    </div>

                    <div className="rounded-[2rem] border border-line/70 bg-panel p-6 shadow-panel backdrop-blur sm:p-8">
                        <p className="text-sm uppercase tracking-[0.28em] text-ess">Mechanics</p>
                        <h2 className="mt-2 font-display text-3xl text-ink">Model assumptions</h2>
                        <div className="mt-6 space-y-4 text-sm leading-6 text-ess">
                            <div className="rounded-3xl border border-line/80 bg-white/70 p-5">
                                Each generation is non-overlapping. Parents reproduce once, offspring inherit the average parental gene plus mutation, and then the parental generation dies.
                            </div>
                            <div className="rounded-3xl border border-line/80 bg-white/70 p-5">
                                Fitness is implicit, not hard-coded. When males are rare, more of them find mates. When females are rare, the same logic flips.
                            </div>
                            <div className="rounded-3xl border border-line/80 bg-white/70 p-5">
                                Equal offspring cost is assumed in this version, so equal investment reduces to equal numbers. That is why the ESS reference line sits at 0.50.
                            </div>
                            <div className="rounded-3xl border border-line/80 bg-white/70 p-5">
                                Extreme founder settings can still crash the population. That is not a bug in the model: if one sex vanishes completely, reproduction stops.
                            </div>
                        </div>
                    </div>
                </section>
            </div>
        </div>
    );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<FisherSexRatioSimulator />);