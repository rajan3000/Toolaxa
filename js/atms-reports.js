
export function projectSummary(db) {
    const equipment = db.inventory || [];
    const purchases = db.procurement || [];
    const faults = db.faults || [];
    const civil = db.civil || [];

    const totalEquipment = equipment.reduce(
        (s, x) => s + Number(x.quantity || 0), 0
    );

    const installed = equipment.reduce(
        (s, x) => s + Number(x.installedQty || 0), 0
    );

    const commissioned = equipment.reduce(
        (s, x) => s + Number(x.commissionedQty || 0), 0
    );

    const purchaseValue = purchases.reduce(
        (s, x) => s + Number(x.total || 0), 0
    );

    const civilPlanned = civil.reduce(
        (s, x) => s + Number(x.planned || 0), 0
    );

    const civilCompleted = civil.reduce(
        (s, x) => s + Number(x.completed || 0), 0
    );

    return {
        totalEquipment,
        installed,
        commissioned,
        purchaseValue,
        civilPlanned,
        civilCompleted,
        openFaults: faults.filter(
            x => !["Resolved", "Closed"].includes(x.status)
        ).length,
        totalFaults: faults.length
    };
}
