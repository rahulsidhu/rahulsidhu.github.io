export function buildSankeyData(physics) {
    const width = 800;
    const height = 360;
    const nodeWidth = 24;
    const gap = 16;

    const sources = [
        { id: 'metabolic', name: 'Metabolic Input', val: physics.pMetabolic, color: '#1a1814' },
        { id: 'gravSrc', name: 'Gravity Assist', val: physics.pGravSource, color: '#1a6090' }
    ].filter((source) => source.val > 0.5);

    const sinks = [
        { id: 'bodyHeat', name: 'Body Heat', val: physics.pBodyHeat, color: '#9a9690' },
        { id: 'loss', name: 'Drivetrain Loss', val: physics.pLoss, color: '#6c3483' },
        { id: 'air', name: 'Air Resistance', val: physics.pAir, color: '#c0392b' },
        { id: 'roll', name: 'Rolling Res.', val: physics.pRoll, color: '#c47a0a' },
        { id: 'gravSnk', name: 'Gravity Climb', val: physics.pGravSink, color: '#1a6090' },
        { id: 'brake', name: 'Brake Heat', val: physics.pBrake, color: '#5a5650' },
        { id: 'excess', name: 'Accel Reserve', val: physics.pExcess, color: '#16a085' }
    ].filter((sink) => sink.val > 0.5);

    const totalSource = sources.reduce((sum, source) => sum + source.val, 0);
    const totalSink = sinks.reduce((sum, sink) => sum + sink.val, 0);
    const scale = (height - (Math.max(sources.length, sinks.length) * gap)) / Math.max(totalSource, totalSink, 1);

    let nextSourceY = gap;
    let nextSinkY = gap;

    sources.forEach((source) => {
        source.y = nextSourceY;
        source.used = 0;
        nextSourceY += (source.val * scale) + gap;
    });

    sinks.forEach((sink) => {
        sink.y = nextSinkY;
        sink.filled = 0;
        nextSinkY += (sink.val * scale) + gap;
    });

    const links = [];

    sources.forEach((source) => {
        sinks.forEach((sink) => {
            const amount = Math.min(source.val - source.used, sink.val - sink.filled);

            if (amount > 0.1) {
                links.push({
                    y1: source.y + (source.used * scale),
                    y2: sink.y + (sink.filled * scale),
                    h: amount * scale,
                    color: sink.color,
                    val: amount
                });
                source.used += amount;
                sink.filled += amount;
            }
        });
    });

    return { sources, sinks, links, width, height, nodeWidth, scale };
}
