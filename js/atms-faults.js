
import { getDowntime } from "./atms-helpers.js";

export function calculateFault(record) {
    return {
        downtime: getDowntime(
            record.faultDate,
            record.resolutionDate || null
        ),
        isResolved: ["Resolved", "Closed"].includes(record.status),
        repairCost: Number(record.repairCost || 0)
    };
}

export function totalRepairCost(records) {
    return records.reduce(
        (sum, r) => sum + Number(r.repairCost || 0),
        0
    );
}

export function openFaultCount(records) {
    return records.filter(
        r => !["Resolved", "Closed"].includes(r.status)
    ).length;
}
