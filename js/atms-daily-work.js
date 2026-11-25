
export function getDailySummary(records, date) {
    const todayRecords = records.filter(r => r.date === date);

    return {
        entries: todayRecords.length,
        completed: todayRecords.filter(r => r.status === "Completed").length,
        manpower: todayRecords.reduce(
            (sum, r) => sum + Number(r.manpower || 0),
            0
        ),
        quantity: todayRecords.reduce(
            (sum, r) => sum + Number(r.quantity || 0),
            0
        )
    };
}
