# RNA World Soup Simulator — Technical Specification

## Overview

A real-time 2D particle simulation of an RNA world prebiotic soup, illustrating the emergence of self-replicating molecules from a pool of free-floating monomers. Intended as an interactive educational tool accompanying a reading of *The Selfish Gene* (Dawkins, 1976/2006).

The simulation should be buildable as a single self-contained React component (`.jsx`) with no external dependencies beyond React, Tailwind, and optionally `recharts` for population graphs.

---

## Scientific Basis

The simulation models the **RNA World hypothesis**: the earliest replicators were RNA molecules, which can act as both information carriers and catalysts (ribozymes). The chemistry is simplified for tractability but grounded in real biology.

### Molecules

**Monomers** — the four RNA nucleotides, represented as single letters:
- `A` (Adenine)
- `U` (Uracil)
- `G` (Guanine)
- `C` (Cytosine)

Monomers float freely in the simulation space and are the raw resource all chains compete for.

**Oligomers** — short random chains of nucleotides (length 2–7), formed spontaneously from monomers at a low background rate. Not yet capable of replication.

**Replicators** — chains that meet a minimum length and composition threshold, granting them catalytic (self-copying) ability. A chain qualifies as a replicator if:
- Length ≥ 12 nucleotides
- G+C content ≥ 40% (G-C bonds are stronger, conferring stability)

**Parasites** — short chains (length 4–8) with terminal sequences that allow them to be copied by replicators' machinery, but with no catalytic ability of their own. They consume monomers and replicator time without contributing to the pool.

### Base Pairing

Complementary pairing rules (used during replication):
- A ↔ U
- G ↔ C

When a replicator copies itself, it attracts complementary monomers to build a complementary strand, which then serves as the template for another copy of the original sequence.

---

## Simulation Mechanics

### World

- Bounded 2D canvas (suggested: 800×600px)
- Particles move with Brownian motion (random walk with small velocity perturbations each tick)
- Wrap-around or elastic boundary collisions (configurable)

### Monomer Pool

- Pool starts with N free monomers (default: 600), distributed randomly across all four types
- Monomers replenish at a slow background rate (tunable)
- Monomers are consumed when incorporated into chains
- When a replicator copies itself, it consumes one monomer per nucleotide of the new chain

### Spontaneous Assembly

- Each tick, there is a small probability that two adjacent monomers bond, forming a length-2 oligomer
- Oligomers can extend by capturing adjacent free monomers
- Spontaneous assembly rate is tunable

### Replication

When a chain qualifies as a replicator:
1. It searches its local neighbourhood for free monomers matching its complement
2. If sufficient complementary monomers are available, it assembles a complementary strand
3. The complementary strand detaches and serves as a new template, producing a copy of the original
4. Each step in copying has a per-nucleotide error rate (tunable). An error substitutes a random nucleotide
5. Replication takes a fixed number of ticks (copying time), during which the replicator is busy
6. Replication rate is proportional to local monomer availability

### Mutation

- Applied per nucleotide per copy event
- Default error rate: 0.5% per nucleotide per copy
- Mutations can:
  - Reduce G+C content below threshold → replicator loses catalytic status
  - Increase G+C content → faster/more stable replicator (bonus to replication speed)
  - Be neutral (most)
  - Create a parasite-compatible terminal sequence

### Parasites

- Arise spontaneously at a low rate, or via mutation of oligomers
- Recognised by replicators' copying machinery (same terminal sequence match)
- Replicated by replicators at a cost to the replicator (time and monomers)
- Do not themselves replicate
- Parasite load reduces replicator fitness

### Decay

- All chains have a per-tick decay probability proportional to their G+C content (lower G+C = higher decay)
- Decayed chains release their monomers back into the pool
- Default half-life: ~500 ticks for a minimum-threshold replicator

---

## Visual Design

### Particle Rendering

| Entity | Colour | Size | Notes |
|---|---|---|---|
| Free monomer A | Blue | 3px | |
| Free monomer U | Yellow | 3px | |
| Free monomer G | Green | 3px | |
| Free monomer C | Red | 3px | |
| Oligomer (non-replicating) | Grey | 5–8px | Scales with length |
| Replicator | Bright white/cyan | 10–16px | Pulses gently when copying |
| Parasite | Orange | 6px | Slightly jagged outline |

Replicators should visually display their sequence as a short label on hover (e.g. `AUGCCGAUUGCA`).

### Population Graph

A live line chart below the canvas showing counts over time:
- Free monomers
- Oligomers
- Replicators
- Parasites

Suggested: `recharts` LineChart, updating every 10 ticks.

### Event Log

A scrolling text panel showing notable events:
- "First replicator emerged at tick 142"
- "Parasite invasion detected at tick 891"
- "Error catastrophe threshold crossed"
- "Replicator lineage X went extinct"

---

## Controls

All controls should be live-adjustable sliders or toggles without requiring a restart.

| Control | Default | Range | Effect |
|---|---|---|---|
| Mutation rate | 0.5% | 0–5% | Per-nucleotide error probability per copy |
| Monomer abundance | 600 | 100–2000 | Starting and replenishment pool size |
| Replenishment rate | 2/tick | 0–20 | Free monomers added per tick |
| Spontaneous assembly rate | 0.001 | 0–0.01 | Probability of random oligomer formation per tick |
| Parasite rate | 0.0005 | 0–0.005 | Probability of spontaneous parasite generation per tick |
| Simulation speed | 1× | 0.1×–10× | Tick rate multiplier |
| Pause / Resume | — | — | Freeze simulation |
| Reset | — | — | Restart with current slider values |

---

## Key Emergent Phenomena

The simulation should be capable of demonstrating the following, given appropriate parameter settings:

1. **Spontaneous replicator emergence** — first replicator arising from the random soup
2. **Competitive exclusion** — a faster-copying replicator variant outcompeting slower ones
3. **Error catastrophe** — at high mutation rates, no stable replicators persist; information degrades faster than it copies
4. **Parasite invasion** — parasite load grows until replicators are overwhelmed, then crashes as replicators decline (predator-prey dynamic)
5. **Monomer depletion** — replicators reproduce until monomers are scarce, then slow or crash
6. **Mutational rescue** — rare beneficial mutation produces a more stable replicator that takes over the population

---

## Architecture Notes

- Use `requestAnimationFrame` for the simulation loop
- Store all particles in a flat array; use a spatial hash grid for neighbour lookups (avoid O(n²) collision checks)
- React state should hold only display-level data (counts, log entries); simulation state lives in a `useRef` to avoid re-render overhead on every tick
- The canvas should be a `<canvas>` element drawn imperatively, not React-rendered DOM elements
- Population graph data should be sampled every 10 ticks and stored in a capped rolling array (last 500 samples)

---

## Out of Scope (v1)

- Compartmentalisation / proto-cell membranes (good v2 addition)
- Hypercycles (mutually dependent replicators)
- 3D rendering
- Saving/loading simulation state
- Multiple simultaneous replicator lineage tracking

---

## Acceptance Criteria

- Simulation runs smoothly at default settings (≥30fps) in a modern browser
- All five key phenomena listed above are observable by adjusting sliders
- Population graph updates in real time
- Hovering a replicator shows its sequence
- Reset restores a fresh random soup with current slider values
- No external API calls or network requests required
