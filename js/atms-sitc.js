
export function calculateSITC(record) {
    const planned = Number(record.quantity || 0);

    return {
        installationProgress: planned
            ? Math.round(Number(record.installed || 0) / planned * 100)
            : 0,

        testingProgress: planned
            ? Math.round(Number(record.tested || 0) / planned * 100)
            : 0,

        commissioningProgress: planned
            ? Math.round(Number(record.commissioned || 0) / planned * 100)
            : 0
    };
}
