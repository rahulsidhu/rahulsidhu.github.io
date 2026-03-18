(function () {
    const WIDTH = 800;
    const HEIGHT = 600;
    const GRID_SIZE = 42;
    const HISTORY_SAMPLE_INTERVAL = 10;
    const HISTORY_LIMIT = 500;
    const PARASITE_MOTIF = 'AUG';
    const BASE_TYPES = ['A', 'U', 'G', 'C'];
    const BASE_COLORS = {
        A: '#3576f6',
        U: '#d7a300',
        G: '#1f9d62',
        C: '#df4f46'
    };
    const DEFAULTS = {
        mutationRate: 0.5,
        monomerAbundance: 600,
        replenishmentRate: 2,
        assemblyRate: 0.001,
        parasiteRate: 0.0005,
        speed: 1
    };
    const CONTROL_CONFIG = [
        {
            key: 'mutationRate',
            label: 'Mutation rate',
            min: 0,
            max: 5,
            step: 0.1,
            suffix: '%',
            format: (value) => value.toFixed(1) + '%',
            description: 'Per-nucleotide copy error probability. Raising it increases novelty, but also makes inherited sequence identity harder to preserve.',
            effect: 'Low values favour stable lineages. High values can trigger error catastrophe.'
        },
        {
            key: 'monomerAbundance',
            label: 'Monomer abundance',
            min: 100,
            max: 2000,
            step: 10,
            suffix: '',
            format: (value) => Math.round(value).toString(),
            description: 'Starting size of the free nucleotide pool and the rough refill ceiling for the soup.',
            effect: 'Higher values delay scarcity. Lower values make competition and depletion appear earlier.'
        },
        {
            key: 'replenishmentRate',
            label: 'Replenishment rate',
            min: 0,
            max: 20,
            step: 0.5,
            suffix: '/tick',
            format: (value) => value.toFixed(1) + '/tick',
            description: 'Background inflow of fresh monomers each tick.',
            effect: 'Higher values support sustained growth. Lower values turn replication into a stronger drain on the system.'
        },
        {
            key: 'assemblyRate',
            label: 'Spontaneous assembly',
            min: 0,
            max: 0.01,
            step: 0.0001,
            suffix: '',
            format: (value) => value.toFixed(4),
            description: 'Chance that nearby free monomers form new short oligomers without catalytic help.',
            effect: 'Too low and emergence is rare. Higher values seed more raw material for later replicators.'
        },
        {
            key: 'parasiteRate',
            label: 'Parasite rate',
            min: 0,
            max: 0.005,
            step: 0.0001,
            suffix: '',
            format: (value) => value.toFixed(4),
            description: 'Background probability that exploiter sequences appear in the soup.',
            effect: 'Low values let catalytic lineages establish. Higher values produce invasion, overload, and collapse cycles.'
        },
        {
            key: 'speed',
            label: 'Simulation speed',
            min: 0.1,
            max: 10,
            step: 0.1,
            suffix: 'x',
            format: (value) => value.toFixed(1) + 'x',
            description: 'Visual playback rate for the simulation loop.',
            effect: 'Does not change the rules. It only changes how quickly you watch the same dynamics unfold.'
        }
    ];

    const elements = {
        simCanvas: document.getElementById('sim-canvas'),
        historyCanvas: document.getElementById('history-canvas'),
        controlsForm: document.getElementById('controls-form'),
        metricGrid: document.getElementById('metric-grid'),
        eventLog: document.getElementById('event-log'),
        hoverCard: document.getElementById('hover-card'),
        pauseButton: document.getElementById('pause-button'),
        resetButton: document.getElementById('reset-button'),
        resetTop: document.getElementById('reset-top'),
        statusStrip: document.getElementById('status-strip')
    };

    const simContext = elements.simCanvas.getContext('2d');
    const historyContext = elements.historyCanvas.getContext('2d');

    const state = {
        params: { ...DEFAULTS },
        running: true,
        lastFrame: performance.now(),
        accumulator: 0,
        hover: null,
        mouse: { x: 0, y: 0, active: false },
        engine: null
    };

    function randomBase() {
        return BASE_TYPES[Math.floor(Math.random() * BASE_TYPES.length)];
    }

    function randomBetween(min, max) {
        return min + Math.random() * (max - min);
    }

    function randomSequence(length) {
        let sequence = '';
        for (let index = 0; index < length; index += 1) {
            sequence += randomBase();
        }
        return sequence;
    }

    function complementBase(base) {
        if (base === 'A') {
            return 'U';
        }
        if (base === 'U') {
            return 'A';
        }
        if (base === 'G') {
            return 'C';
        }
        return 'G';
    }

    function gcContent(sequence) {
        let count = 0;
        for (let index = 0; index < sequence.length; index += 1) {
            const base = sequence[index];
            if (base === 'G' || base === 'C') {
                count += 1;
            }
        }
        return sequence.length ? count / sequence.length : 0;
    }

    function isReplicator(sequence) {
        return sequence.length >= 12 && gcContent(sequence) >= 0.4;
    }

    function isParasiteSequence(sequence) {
        return sequence.length >= 4 && sequence.length <= 8 && sequence.endsWith(PARASITE_MOTIF);
    }

    function lineageKey(sequence) {
        return sequence.slice(0, 6) + ':' + sequence.length;
    }

    function createMonomer(type) {
        return {
            id: 0,
            kind: 'monomer',
            type,
            x: randomBetween(8, WIDTH - 8),
            y: randomBetween(8, HEIGHT - 8),
            vx: randomBetween(-0.45, 0.45),
            vy: randomBetween(-0.45, 0.45),
            radius: 3
        };
    }

    function createChain(sequence, kind) {
        const gc = gcContent(sequence);
        const derivedKind = kind || (isReplicator(sequence) ? 'replicator' : isParasiteSequence(sequence) ? 'parasite' : 'oligomer');
        return {
            id: 0,
            kind: derivedKind,
            sequence,
            lineage: lineageKey(sequence),
            x: randomBetween(18, WIDTH - 18),
            y: randomBetween(18, HEIGHT - 18),
            vx: randomBetween(-0.22, 0.22),
            vy: randomBetween(-0.22, 0.22),
            radius: derivedKind === 'replicator' ? 9 + Math.min(sequence.length, 18) * 0.32 : derivedKind === 'parasite' ? 6 : 4 + Math.min(sequence.length, 7) * 0.55,
            busy: false,
            busyTarget: null,
            busyTicksLeft: 0,
            localAvailability: 0,
            gc,
            tooltipOpacity: 1
        };
    }

    function classifyChain(chain) {
        chain.gc = gcContent(chain.sequence);
        chain.lineage = lineageKey(chain.sequence);
        if (isReplicator(chain.sequence)) {
            chain.kind = 'replicator';
            chain.radius = 9 + Math.min(chain.sequence.length, 18) * 0.32;
        } else if (isParasiteSequence(chain.sequence)) {
            chain.kind = 'parasite';
            chain.radius = 6;
        } else {
            chain.kind = 'oligomer';
            chain.radius = 4 + Math.min(chain.sequence.length, 7) * 0.55;
        }
    }

    function buildGrid(engine) {
        const grid = new Map();

        function push(item, bucketType) {
            const gx = Math.floor(item.x / GRID_SIZE);
            const gy = Math.floor(item.y / GRID_SIZE);
            const key = gx + ',' + gy;
            if (!grid.has(key)) {
                grid.set(key, { monomers: [], chains: [] });
            }
            grid.get(key)[bucketType].push(item);
        }

        for (let monomerIndex = 0; monomerIndex < engine.monomers.length; monomerIndex += 1) {
            push(engine.monomers[monomerIndex], 'monomers');
        }
        for (let chainIndex = 0; chainIndex < engine.chains.length; chainIndex += 1) {
            push(engine.chains[chainIndex], 'chains');
        }

        return grid;
    }

    function queryNearby(grid, x, y, radius, bucketType) {
        const results = [];
        const minX = Math.floor((x - radius) / GRID_SIZE);
        const maxX = Math.floor((x + radius) / GRID_SIZE);
        const minY = Math.floor((y - radius) / GRID_SIZE);
        const maxY = Math.floor((y + radius) / GRID_SIZE);
        for (let gx = minX; gx <= maxX; gx += 1) {
            for (let gy = minY; gy <= maxY; gy += 1) {
                const key = gx + ',' + gy;
                const bucket = grid.get(key);
                if (!bucket) {
                    continue;
                }
                const items = bucket[bucketType];
                for (let index = 0; index < items.length; index += 1) {
                    const item = items[index];
                    const dx = item.x - x;
                    const dy = item.y - y;
                    if ((dx * dx) + (dy * dy) <= radius * radius) {
                        results.push(item);
                    }
                }
            }
        }
        return results;
    }

    function removeById(items, id) {
        const index = items.findIndex((item) => item.id === id);
        if (index >= 0) {
            items.splice(index, 1);
            return true;
        }
        return false;
    }

    function mutateCopy(sequence, mutationRate) {
        let mutated = '';
        for (let index = 0; index < sequence.length; index += 1) {
            const base = sequence[index];
            if (Math.random() < mutationRate) {
                let replacement = randomBase();
                while (replacement === base) {
                    replacement = randomBase();
                }
                mutated += replacement;
            } else {
                mutated += base;
            }
        }
        return mutated;
    }

    function computeCopyTicks(sequence, gc, availability, parasitePenalty) {
        const baseline = 90 + sequence.length * 3;
        const stabilityBonus = Math.max(0, gc - 0.4) * 55;
        const availabilityBonus = availability * 1.6;
        const parasiteCost = parasitePenalty ? 22 : 0;
        return Math.max(22, Math.round(baseline - stabilityBonus - availabilityBonus + parasiteCost));
    }

    function addEvent(engine, label, tone) {
        engine.events.unshift({ tick: engine.tick, label, tone: tone || 'neutral' });
        engine.events = engine.events.slice(0, 24);
    }

    function consumeNearbyMonomers(engine, grid, x, y, requirements, liveMonomerIds) {
        const gathered = [];
        const nearby = queryNearby(grid, x, y, 110, 'monomers');
        for (let index = 0; index < nearby.length; index += 1) {
            const monomer = nearby[index];
            if (!liveMonomerIds.has(monomer.id)) {
                continue;
            }
            if (requirements[monomer.type] > 0) {
                requirements[monomer.type] -= 1;
                gathered.push(monomer.id);
            }
        }
        const satisfied = Object.keys(requirements).every((key) => requirements[key] === 0);
        if (!satisfied) {
            return false;
        }
        for (let gatheredIndex = 0; gatheredIndex < gathered.length; gatheredIndex += 1) {
            const gatheredId = gathered[gatheredIndex];
            if (removeById(engine.monomers, gatheredId)) {
                liveMonomerIds.delete(gatheredId);
            }
        }
        return true;
    }

    function releaseMonomers(engine, sequence, x, y) {
        for (let index = 0; index < sequence.length; index += 1) {
            const monomer = createMonomer(sequence[index]);
            monomer.id = engine.nextId += 1;
            monomer.x = Math.max(6, Math.min(WIDTH - 6, x + randomBetween(-18, 18)));
            monomer.y = Math.max(6, Math.min(HEIGHT - 6, y + randomBetween(-18, 18)));
            engine.monomers.push(monomer);
        }
    }

    function initializeEngine(params) {
        const engine = {
            tick: 0,
            nextId: 0,
            monomers: [],
            chains: [],
            history: [],
            events: [],
            flags: {
                firstReplicator: false,
                parasiteInvasion: false,
                catastrophe: false,
                monomerCrash: false,
                rescue: false,
                competitiveLineage: null,
                replicatorsEver: 0,
                parasitesEver: 0,
                dominantGc: 0
            },
            lineageCounts: new Map(),
            extinctLineages: new Set()
        };

        for (let index = 0; index < params.monomerAbundance; index += 1) {
            const monomer = createMonomer(randomBase());
            monomer.id = engine.nextId += 1;
            engine.monomers.push(monomer);
        }

        addEvent(engine, 'Soup initialised with free monomers and thermal noise.', 'neutral');
        engine.lastCounts = sampleHistory(engine);
        return engine;
    }

    function moveParticle(particle, drift, radius) {
        particle.vx += randomBetween(-drift, drift);
        particle.vy += randomBetween(-drift, drift);
        particle.vx = Math.max(-1.6, Math.min(1.6, particle.vx));
        particle.vy = Math.max(-1.6, Math.min(1.6, particle.vy));
        particle.x += particle.vx;
        particle.y += particle.vy;
        if (particle.x < radius) {
            particle.x = radius;
            particle.vx *= -0.95;
        } else if (particle.x > WIDTH - radius) {
            particle.x = WIDTH - radius;
            particle.vx *= -0.95;
        }
        if (particle.y < radius) {
            particle.y = radius;
            particle.vy *= -0.95;
        } else if (particle.y > HEIGHT - radius) {
            particle.y = HEIGHT - radius;
            particle.vy *= -0.95;
        }
    }

    function updateParticles(engine) {
        for (let index = 0; index < engine.monomers.length; index += 1) {
            moveParticle(engine.monomers[index], 0.09, 3);
        }
        for (let index = 0; index < engine.chains.length; index += 1) {
            moveParticle(engine.chains[index], 0.045, engine.chains[index].radius);
        }
    }

    function replenishMonomers(engine, params) {
        if (params.replenishmentRate <= 0) {
            return;
        }
        const shortage = Math.max(0, Math.round(params.monomerAbundance - engine.monomers.length));
        const toAdd = Math.min(shortage, Math.round(params.replenishmentRate));
        for (let index = 0; index < toAdd; index += 1) {
            const monomer = createMonomer(randomBase());
            monomer.id = engine.nextId += 1;
            engine.monomers.push(monomer);
        }
    }

    function spontaneousAssembly(engine, grid, params) {
        if (engine.monomers.length < 2 || Math.random() > params.assemblyRate * Math.max(1, engine.monomers.length / 180)) {
            return;
        }
        const seed = engine.monomers[Math.floor(Math.random() * engine.monomers.length)];
        if (!seed) {
            return;
        }
        const neighbours = queryNearby(grid, seed.x, seed.y, 24, 'monomers').filter((item) => item.id !== seed.id);
        if (!neighbours.length) {
            return;
        }
        const partner = neighbours[Math.floor(Math.random() * neighbours.length)];
        const sequence = seed.type + partner.type;
        removeById(engine.monomers, seed.id);
        removeById(engine.monomers, partner.id);
        const chain = createChain(sequence, 'oligomer');
        chain.id = engine.nextId += 1;
        chain.x = (seed.x + partner.x) / 2;
        chain.y = (seed.y + partner.y) / 2;
        engine.chains.push(chain);
    }

    function extendOligomers(engine, grid) {
        for (let index = 0; index < engine.chains.length; index += 1) {
            const chain = engine.chains[index];
            if (chain.kind === 'replicator' || chain.sequence.length >= 14) {
                continue;
            }
            const chance = chain.kind === 'parasite' ? 0.005 : 0.008 + chain.sequence.length * 0.0008;
            if (Math.random() > chance) {
                continue;
            }
            const nearby = queryNearby(grid, chain.x, chain.y, 24, 'monomers');
            if (!nearby.length) {
                continue;
            }
            const monomer = nearby[Math.floor(Math.random() * nearby.length)];
            const prepend = Math.random() < 0.25;
            chain.sequence = prepend ? monomer.type + chain.sequence : chain.sequence + monomer.type;
            removeById(engine.monomers, monomer.id);
            classifyChain(chain);
        }
    }

    function maybeSpawnParasite(engine, params) {
        if (Math.random() > params.parasiteRate) {
            return;
        }
        const length = 4 + Math.floor(Math.random() * 5);
        const head = randomSequence(Math.max(1, length - PARASITE_MOTIF.length));
        const parasite = createChain((head + PARASITE_MOTIF).slice(0, length), 'parasite');
        parasite.id = engine.nextId += 1;
        engine.chains.push(parasite);
    }

    function attemptReplication(engine, grid, params) {
        const mutation = params.mutationRate / 100;
        const liveMonomerIds = new Set(engine.monomers.map((monomer) => monomer.id));
        for (let index = 0; index < engine.chains.length; index += 1) {
            const chain = engine.chains[index];
            if (chain.kind !== 'replicator') {
                continue;
            }
            if (chain.busy) {
                chain.busyTicksLeft -= 1;
                if (chain.busyTicksLeft <= 0) {
                    finishReplication(engine, chain, mutation);
                }
                continue;
            }

            const nearbyMonomers = queryNearby(grid, chain.x, chain.y, 105, 'monomers');
            const nearbyParasites = queryNearby(grid, chain.x, chain.y, 90, 'chains').filter((candidate) => candidate.kind === 'parasite');
            const requirements = { A: 0, U: 0, G: 0, C: 0 };
            for (let seqIndex = 0; seqIndex < chain.sequence.length; seqIndex += 1) {
                requirements[complementBase(chain.sequence[seqIndex])] += 1;
            }
            const available = { A: 0, U: 0, G: 0, C: 0 };
            for (let monomerIndex = 0; monomerIndex < nearbyMonomers.length; monomerIndex += 1) {
                const monomer = nearbyMonomers[monomerIndex];
                if (!liveMonomerIds.has(monomer.id)) {
                    continue;
                }
                available[monomer.type] += 1;
            }
            const fulfilled = BASE_TYPES.reduce((sum, base) => sum + Math.min(requirements[base], available[base]), 0);
            const availability = chain.sequence.length ? fulfilled / chain.sequence.length : 0;
            chain.localAvailability = availability;
            if (availability < 0.65 || Math.random() > availability * (0.065 + chain.gc * 0.03)) {
                continue;
            }

            let target = chain;
            let parasitePenalty = false;
            if (nearbyParasites.length && Math.random() < Math.min(0.72, 0.16 + nearbyParasites.length * 0.06)) {
                const compatible = nearbyParasites.filter((parasite) => chain.sequence.endsWith(parasite.sequence.slice(-PARASITE_MOTIF.length)));
                if (compatible.length) {
                    target = compatible[Math.floor(Math.random() * compatible.length)];
                    parasitePenalty = true;
                }
            }

            const targetRequirements = { A: 0, U: 0, G: 0, C: 0 };
            for (let seqIndex = 0; seqIndex < target.sequence.length; seqIndex += 1) {
                targetRequirements[complementBase(target.sequence[seqIndex])] += 1;
            }
            if (!consumeNearbyMonomers(engine, grid, chain.x, chain.y, targetRequirements, liveMonomerIds)) {
                continue;
            }

            chain.busy = true;
            chain.busyTarget = { sequence: target.sequence, parasitePenalty };
            chain.busyTicksLeft = computeCopyTicks(target.sequence, chain.gc, availability * target.sequence.length, parasitePenalty);
        }
    }

    function finishReplication(engine, chain, mutationRate) {
        if (!chain.busyTarget) {
            chain.busy = false;
            return;
        }
        const copiedSequence = mutateCopy(chain.busyTarget.sequence, mutationRate);
        const child = createChain(copiedSequence);
        child.id = engine.nextId += 1;
        child.x = Math.max(12, Math.min(WIDTH - 12, chain.x + randomBetween(-22, 22)));
        child.y = Math.max(12, Math.min(HEIGHT - 12, chain.y + randomBetween(-22, 22)));
        child.vx = chain.vx * -0.4 + randomBetween(-0.18, 0.18);
        child.vy = chain.vy * -0.4 + randomBetween(-0.18, 0.18);
        engine.chains.push(child);

        if (child.kind === 'replicator' && child.gc > engine.flags.dominantGc + 0.08) {
            engine.flags.dominantGc = child.gc;
            if (engine.flags.firstReplicator) {
                addEvent(engine, 'Mutational rescue: a more stable GC-rich replicator variant rose above the background.', 'positive');
                engine.flags.rescue = true;
            }
        }

        chain.busy = false;
        chain.busyTarget = null;
        chain.busyTicksLeft = 0;
    }

    function applyDecay(engine) {
        for (let index = engine.chains.length - 1; index >= 0; index -= 1) {
            const chain = engine.chains[index];
            const gc = chain.gc || gcContent(chain.sequence);
            const stability = gc >= 0.4 ? gc - 0.4 : -(0.4 - gc);
            const baseDecay = 0.0015;
            const lengthPenalty = Math.max(0, chain.sequence.length - 12) * 0.00002;
            const decayChance = Math.max(0.00045, baseDecay - (stability * 0.0022) + lengthPenalty + (chain.kind === 'parasite' ? 0.00045 : 0));
            if (Math.random() < decayChance) {
                const decayed = engine.chains.splice(index, 1)[0];
                releaseMonomers(engine, decayed.sequence, decayed.x, decayed.y);
            }
        }
    }

    function updatePhenomena(engine, params) {
        let monomers = engine.monomers.length;
        let oligomers = 0;
        let replicators = 0;
        let parasites = 0;
        let dominantLineage = null;
        const lineageCounts = new Map();

        for (let index = 0; index < engine.chains.length; index += 1) {
            const chain = engine.chains[index];
            if (chain.kind === 'replicator') {
                replicators += 1;
            } else if (chain.kind === 'parasite') {
                parasites += 1;
            } else {
                oligomers += 1;
            }
            if (chain.kind === 'replicator') {
                const nextCount = (lineageCounts.get(chain.lineage) || 0) + 1;
                lineageCounts.set(chain.lineage, nextCount);
                if (!dominantLineage || nextCount > dominantLineage.count) {
                    dominantLineage = { key: chain.lineage, count: nextCount };
                }
            }
        }

        if (!engine.flags.firstReplicator && replicators > 0) {
            engine.flags.firstReplicator = true;
            engine.flags.dominantGc = Math.max(engine.flags.dominantGc, engine.chains.filter((chain) => chain.kind === 'replicator')[0].gc || 0.4);
            addEvent(engine, 'First replicator emerged from the soup.', 'positive');
        }

        if (!engine.flags.parasiteInvasion && parasites >= 6 && replicators >= 2) {
            engine.flags.parasiteInvasion = true;
            addEvent(engine, 'Parasite invasion detected near active replicators.', 'warning');
        }

        if (!engine.flags.catastrophe && params.mutationRate >= 2.5 && engine.flags.firstReplicator && replicators === 0) {
            engine.flags.catastrophe = true;
            addEvent(engine, 'Error catastrophe threshold crossed: replicator information collapsed under mutation pressure.', 'danger');
        }

        if (!engine.flags.monomerCrash && engine.flags.firstReplicator && monomers < Math.max(30, params.monomerAbundance * 0.08)) {
            engine.flags.monomerCrash = true;
            addEvent(engine, 'Monomer depletion is throttling replication and assembly.', 'warning');
        }

        if (engine.lineageCounts.size) {
            engine.lineageCounts.forEach((count, key) => {
                if (count > 0 && !lineageCounts.has(key) && !engine.extinctLineages.has(key)) {
                    engine.extinctLineages.add(key);
                    addEvent(engine, 'Replicator lineage ' + key + ' went extinct.', 'neutral');
                }
            });
        }
        engine.lineageCounts = lineageCounts;

        if (dominantLineage && dominantLineage.count >= 10 && dominantLineage.count >= Math.max(3, replicators * 0.5)) {
            if (engine.flags.competitiveLineage !== dominantLineage.key) {
                engine.flags.competitiveLineage = dominantLineage.key;
                addEvent(engine, 'Competitive exclusion underway: lineage ' + dominantLineage.key + ' is overtaking the pool.', 'neutral');
            }
        }

        engine.flags.replicatorsEver = Math.max(engine.flags.replicatorsEver, replicators);
        engine.flags.parasitesEver = Math.max(engine.flags.parasitesEver, parasites);

        return { monomers, oligomers, replicators, parasites, dominantLineage: dominantLineage ? dominantLineage.key : 'none' };
    }

    function sampleHistory(engine) {
        const counts = updatePhenomena(engine, state.params);
        engine.history.push({ tick: engine.tick, ...counts });
        if (engine.history.length > HISTORY_LIMIT) {
            engine.history.shift();
        }
        return counts;
    }

    function stepSimulation(engine, params) {
        engine.tick += 1;
        updateParticles(engine);
        replenishMonomers(engine, params);
        let grid = buildGrid(engine);
        spontaneousAssembly(engine, grid, params);
        grid = buildGrid(engine);
        extendOligomers(engine, grid);
        maybeSpawnParasite(engine, params);
        grid = buildGrid(engine);
        attemptReplication(engine, grid, params);
        applyDecay(engine);
        if (engine.tick % HISTORY_SAMPLE_INTERVAL === 0) {
            engine.lastCounts = sampleHistory(engine);
        } else {
            engine.lastCounts = updatePhenomena(engine, params);
        }
    }

    function renderSimulation(engine) {
        simContext.clearRect(0, 0, WIDTH, HEIGHT);

        const gradient = simContext.createRadialGradient(WIDTH / 2, HEIGHT / 2, 60, WIDTH / 2, HEIGHT / 2, HEIGHT / 2);
        gradient.addColorStop(0, 'rgba(45, 73, 94, 0.22)');
        gradient.addColorStop(1, 'rgba(6, 10, 16, 0)');
        simContext.fillStyle = gradient;
        simContext.fillRect(0, 0, WIDTH, HEIGHT);

        for (let index = 0; index < engine.monomers.length; index += 1) {
            const monomer = engine.monomers[index];
            simContext.beginPath();
            simContext.fillStyle = BASE_COLORS[monomer.type];
            simContext.arc(monomer.x, monomer.y, monomer.radius, 0, Math.PI * 2);
            simContext.fill();
        }

        for (let index = 0; index < engine.chains.length; index += 1) {
            const chain = engine.chains[index];
            if (chain.kind === 'replicator') {
                const pulse = chain.busy ? 1.4 + Math.sin(engine.tick * 0.18 + chain.id) * 0.18 : 1;
                const glowRadius = chain.radius * (1.9 + Math.max(0, chain.localAvailability || 0));
                simContext.beginPath();
                simContext.fillStyle = 'rgba(126, 241, 255, 0.14)';
                simContext.arc(chain.x, chain.y, glowRadius * pulse, 0, Math.PI * 2);
                simContext.fill();
                simContext.beginPath();
                simContext.fillStyle = '#dcfcff';
                simContext.arc(chain.x, chain.y, chain.radius * pulse, 0, Math.PI * 2);
                simContext.fill();
                simContext.strokeStyle = '#7ef1ff';
                simContext.lineWidth = 1.2;
                simContext.stroke();
            } else if (chain.kind === 'parasite') {
                simContext.save();
                simContext.translate(chain.x, chain.y);
                simContext.rotate((engine.tick * 0.02 + chain.id) % (Math.PI * 2));
                simContext.beginPath();
                for (let corner = 0; corner < 8; corner += 1) {
                    const angle = (Math.PI * 2 / 8) * corner;
                    const radius = chain.radius + (corner % 2 === 0 ? 1.8 : -0.8);
                    const px = Math.cos(angle) * radius;
                    const py = Math.sin(angle) * radius;
                    if (corner === 0) {
                        simContext.moveTo(px, py);
                    } else {
                        simContext.lineTo(px, py);
                    }
                }
                simContext.closePath();
                simContext.fillStyle = '#f58a2a';
                simContext.fill();
                simContext.restore();
            } else {
                simContext.beginPath();
                simContext.fillStyle = '#818790';
                simContext.arc(chain.x, chain.y, chain.radius, 0, Math.PI * 2);
                simContext.fill();
            }
        }
    }

    function renderHistory(engine) {
        const width = elements.historyCanvas.width;
        const height = elements.historyCanvas.height;
        historyContext.clearRect(0, 0, width, height);
        historyContext.fillStyle = 'rgba(255, 252, 247, 0.95)';
        historyContext.fillRect(0, 0, width, height);

        const padding = { top: 18, right: 16, bottom: 26, left: 48 };
        const innerWidth = width - padding.left - padding.right;
        const innerHeight = height - padding.top - padding.bottom;
        const history = engine.history;
        const maxValue = Math.max(10, ...history.map((entry) => Math.max(entry.monomers, entry.oligomers, entry.replicators, entry.parasites)));

        historyContext.strokeStyle = 'rgba(49, 41, 30, 0.12)';
        historyContext.lineWidth = 1;
        for (let line = 0; line <= 4; line += 1) {
            const y = padding.top + (innerHeight / 4) * line;
            historyContext.beginPath();
            historyContext.moveTo(padding.left, y);
            historyContext.lineTo(width - padding.right, y);
            historyContext.stroke();
        }

        historyContext.fillStyle = '#6c604f';
        historyContext.font = '12px Courier New';
        historyContext.textAlign = 'right';
        for (let marker = 0; marker <= 4; marker += 1) {
            const value = Math.round(maxValue * (1 - marker / 4));
            const y = padding.top + (innerHeight / 4) * marker + 4;
            historyContext.fillText(String(value), padding.left - 8, y);
        }

        const series = [
            { key: 'monomers', color: '#4978ff' },
            { key: 'oligomers', color: '#6f7a88' },
            { key: 'replicators', color: '#0db5d6' },
            { key: 'parasites', color: '#f58a2a' }
        ];

        for (let seriesIndex = 0; seriesIndex < series.length; seriesIndex += 1) {
            const entry = series[seriesIndex];
            historyContext.beginPath();
            historyContext.strokeStyle = entry.color;
            historyContext.lineWidth = 2.2;
            for (let index = 0; index < history.length; index += 1) {
                const point = history[index];
                const x = padding.left + (history.length <= 1 ? 0 : innerWidth * (index / (history.length - 1)));
                const y = padding.top + innerHeight - ((point[entry.key] / maxValue) * innerHeight);
                if (index === 0) {
                    historyContext.moveTo(x, y);
                } else {
                    historyContext.lineTo(x, y);
                }
            }
            historyContext.stroke();
        }
    }

    function renderHoverCard(engine) {
        const hover = state.hover;
        if (!hover || hover.kind !== 'replicator') {
            elements.hoverCard.hidden = true;
            return;
        }
        const bounds = elements.simCanvas.getBoundingClientRect();
        const cardX = Math.min(bounds.width - 240, Math.max(12, state.mouse.x + 18));
        const cardY = Math.min(bounds.height - 120, Math.max(12, state.mouse.y + 18));
        elements.hoverCard.hidden = false;
        elements.hoverCard.style.left = cardX + 'px';
        elements.hoverCard.style.top = cardY + 'px';
        elements.hoverCard.innerHTML = '<strong>Replicator</strong><code>' + hover.sequence + '</code><div class="subtle">Length ' + hover.sequence.length + ' | GC ' + Math.round(hover.gc * 100) + '% | ' + (hover.busy ? 'copying' : 'idle') + '</div>';
    }

    function syncHover(engine) {
        if (!state.mouse.active) {
            state.hover = null;
            return;
        }
        let match = null;
        let bestDistance = Infinity;
        for (let index = 0; index < engine.chains.length; index += 1) {
            const chain = engine.chains[index];
            if (chain.kind !== 'replicator') {
                continue;
            }
            const dx = chain.x - state.mouse.x;
            const dy = chain.y - state.mouse.y;
            const distance = Math.sqrt((dx * dx) + (dy * dy));
            if (distance <= chain.radius + 10 && distance < bestDistance) {
                bestDistance = distance;
                match = chain;
            }
        }
        state.hover = match;
    }

    function renderMetrics(engine) {
        const counts = engine.lastCounts || updatePhenomena(engine, state.params);
        const metrics = [
            { label: 'Tick', value: engine.tick },
            { label: 'Free monomers', value: counts.monomers },
            { label: 'Oligomers', value: counts.oligomers },
            { label: 'Replicators', value: counts.replicators },
            { label: 'Parasites', value: counts.parasites },
            { label: 'Dominant lineage', value: counts.dominantLineage }
        ];
        elements.metricGrid.innerHTML = metrics.map((metric) => '<div class="metric-card"><span class="metric-label">' + metric.label + '</span><span class="metric-value">' + metric.value + '</span></div>').join('');
    }

    function renderEvents(engine) {
        elements.eventLog.innerHTML = engine.events.map((event) => '<div class="event-entry"><strong>t=' + event.tick + '</strong> ' + event.label + '</div>').join('');
    }

    function renderStatus(engine) {
        const counts = engine.lastCounts || updatePhenomena(engine, state.params);
        const tokens = [
            'Tick ' + engine.tick,
            counts.replicators > 0 ? counts.replicators + ' catalytic chains' : 'No active replicators',
            counts.parasites > 0 ? counts.parasites + ' parasites' : 'Parasite-free phase',
            state.running ? 'Running' : 'Paused'
        ];
        elements.statusStrip.innerHTML = tokens.map((token) => '<span class="status-token">' + token + '</span>').join('');
    }

    function renderUI(engine) {
        renderMetrics(engine);
        renderEvents(engine);
        renderStatus(engine);
    }

    function buildControls() {
        elements.controlsForm.innerHTML = CONTROL_CONFIG.map((control) => {
            const value = state.params[control.key];
            return '<div class="control-row">' +
                '<div class="control-header">' +
                '<label for="control-' + control.key + '">' + control.label + '</label>' +
                '<span class="control-readout" id="readout-' + control.key + '">' + control.format(value) + '</span>' +
                '</div>' +
                '<p class="control-description">' + control.description + '</p>' +
                '<input id="control-' + control.key + '" name="' + control.key + '" type="range" min="' + control.min + '" max="' + control.max + '" step="' + control.step + '" value="' + value + '">' +
                '<p class="control-effect"><strong>Effect:</strong> ' + control.effect + '</p>' +
                '</div>';
        }).join('');
    }

    function updateControlReadout(key, value) {
        const config = CONTROL_CONFIG.find((entry) => entry.key === key);
        const readout = document.getElementById('readout-' + key);
        if (config && readout) {
            readout.textContent = config.format(value);
        }
    }

    function handleControls() {
        elements.controlsForm.addEventListener('input', function (event) {
            const control = CONTROL_CONFIG.find((entry) => entry.key === event.target.name);
            if (!control) {
                return;
            }
            const numericValue = parseFloat(event.target.value);
            state.params[control.key] = numericValue;
            updateControlReadout(control.key, numericValue);
        });

        elements.pauseButton.addEventListener('click', function () {
            state.running = !state.running;
            elements.pauseButton.textContent = state.running ? 'Pause' : 'Resume';
            renderStatus(state.engine);
        });

        function reset() {
            state.engine = initializeEngine(state.params);
            state.hover = null;
            renderAll();
        }

        elements.resetButton.addEventListener('click', reset);
        elements.resetTop.addEventListener('click', reset);

        elements.simCanvas.addEventListener('mousemove', function (event) {
            const bounds = elements.simCanvas.getBoundingClientRect();
            const scaleX = WIDTH / bounds.width;
            const scaleY = HEIGHT / bounds.height;
            state.mouse.x = (event.clientX - bounds.left) * scaleX;
            state.mouse.y = (event.clientY - bounds.top) * scaleY;
            state.mouse.active = true;
        });

        elements.simCanvas.addEventListener('mouseleave', function () {
            state.mouse.active = false;
            state.hover = null;
            renderHoverCard(state.engine);
        });
    }

    function renderAll() {
        syncHover(state.engine);
        renderSimulation(state.engine);
        renderHistory(state.engine);
        renderUI(state.engine);
        renderHoverCard(state.engine);
    }

    function animate(now) {
        const delta = now - state.lastFrame;
        state.lastFrame = now;
        state.accumulator += delta;

        const msPerTick = 1000 / (30 * state.params.speed);
        if (state.running) {
            let steps = 0;
            while (state.accumulator >= msPerTick && steps < 6) {
                stepSimulation(state.engine, state.params);
                state.accumulator -= msPerTick;
                steps += 1;
            }
        }

        renderAll();
        requestAnimationFrame(animate);
    }

    function init() {
        buildControls();
        handleControls();
        state.engine = initializeEngine(state.params);
        renderAll();
        requestAnimationFrame(animate);
    }

    init();
}());