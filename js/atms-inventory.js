
export const equipmentDefaults = [
    "VMS - Variable Message Sign",
    "TMCS - Traffic Monitoring System",
    "Solar Panel System",
    "VIDES",
    "VASD",
    "ECB - Emergency Call Box",
    "Blinker Light",
    "MET - Meteorological Station",
    "Server",
    "UPS",
    "UPS Battery",
    "ANPR Camera",
    "CCTV Camera",
    "PTZ Camera",
    "Traffic Camera",
    "WIM / MSWIM",
    "AVC System",
    "OFC Cable",
    "Network Switch",
    "Router",
    "NVR",
    "LAN Rack",
    "PC / Workstation",
    "LED Traffic Signal",
    "LiDAR Sensor",
    "Traffic Counter",
    "Duct",
    "Pole / Gantry",
    "Other Equipment"
];

export function calculateInventory(data) {
    return {
        total: data.reduce((s, x) => s + Number(x.quantity || 0), 0),
        installed: data.reduce((s, x) => s + Number(x.installedQty || 0), 0),
        commissioned: data.reduce((s, x) => s + Number(x.commissionedQty || 0), 0)
    };
}

export function seedInventory(data) {
    if (data.length) return data;

    return equipmentDefaults.map(name => ({
        id: Date.now() + Math.floor(Math.random() * 100000),
        equipment: name,
        category: "ATMS",
        make: "",
        model: "",
        serial: "",
        quantity: 0,
        unit: "Nos",
        location: "",
        chainage: "",
        lane: "",
        status: "Planned",
        installedQty: 0,
        commissionedQty: 0,
        remarks: ""
    }));
}
