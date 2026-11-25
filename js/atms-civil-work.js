
export function calculateCivil(record) {
    const planned = Number(record.planned || 0);
    const completed = Number(record.completed || 0);

    return {
        balance: Math.max(0, planned - completed),
        progress: planned
            ? Math.min(100, Math.round(completed / planned * 100))
            : 0
    };
}

export function totalCivilProgress(records) {
    if (!records.length) return 0;

    const totalPlanned = records.reduce(
        (sum, r) => sum + Number(r.planned || 0), 0
    );

    const totalCompleted = records.reduce(
        (sum, r) => sum + Number(r.completed || 0), 0
    );

    return totalPlanned
        ? Math.min(100, Math.round(totalCompleted / totalPlanned * 100))
        : 0;
}
