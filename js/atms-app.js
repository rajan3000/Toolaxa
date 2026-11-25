import { loadDB, saveDB, exportBackup, importBackup, createEmptyDB, getAttachment, saveAttachment, getStorageInfo, requestPersistentStorage } from "./atms-store.js";
import { escapeHTML, formatMoney, percent, getBadge, showToast, downloadFile, csvEscape, makeID } from "./atms-helpers.js";
import { equipmentDefaults, calculateInventory, seedInventory } from "./atms-inventory.js";
import { vendorPurchaseTotal } from "./atms-vendors.js";
import { calculatePurchase, getPendingQty } from "./atms-procurement.js";
import { calculateSITC } from "./atms-sitc.js";
import { getDailySummary } from "./atms-daily-work.js";
import { calculateCivil, totalCivilProgress } from "./atms-civil-work.js";
import { calculateFault, totalRepairCost, openFaultCount } from "./atms-faults.js";
import { projectSummary } from "./atms-reports.js";

let db = loadDB();
if (!db.inventory.length && !localStorage.getItem("ATMS_SEEDED")) {
    db.inventory = seedInventory([]);
    localStorage.setItem("ATMS_SEEDED", "1");
    saveDB(db);
}

requestPersistentStorage().then(granted => {
    if (granted) {
        console.log("ATMS storage persistence granted.");
    } else {
        console.log("Browser persistence not granted.");
    }
}).catch(console.error);

const content = document.getElementById("content");
const sidebar = document.getElementById("sidebar");
let page = "dashboard";
let activeModule = null;
let editID = null;
let poItems = [];

const names = {
    dashboard: "Project Dashboard",
    inventory: "Equipment Inventory",
    vendors: "Vendor Management",
    procurement: "Procurement & PO",
    sitc: "Installation & SITC",
    daily: "Daily Work Log",
    civil: "Civil Work Tracker",
    faults: "Fault & Maintenance",
    reports: "Reports & Analytics",
    backup: "Backup & Restore"
};

const schemas = {
    inventory: [
        ["equipment","Equipment Name","text",1],
        ["category","Category","text"],
        ["make","Make / Brand","text"],
        ["model","Model","text"],
        ["serial","Serial Number","text"],
        ["quantity","Total Quantity","number"],
        ["unit","Unit","text"],
        ["location","Location / Plaza","text"],
        ["chainage","Chainage","text"],
        ["lane","Lane","text"],
        ["status","Status","select","Planned,Procured,Received,Installed,Testing,Commissioned,Faulty,Spare"],
        ["installedQty","Installed Quantity","number"],
        ["commissionedQty","Commissioned Quantity","number"],
        ["remarks","Remarks","textarea"]
    ],
    vendors: [
        ["name","Vendor Name","text",1],
        ["contact","Contact Person","text"],
        ["phone","Phone","text"],
        ["email","Email","email"],
        ["gst","GST Number","text"],
        ["specialty","Supply / Work Category","text"],
        ["address","Address","textarea"],
        ["remarks","Remarks","textarea"]
    ],
    procurement: [
        ["po","PO Number","text",1],
        ["vendor","Vendor Name","text",1],
        ["date","PO Date","date"],
        ["description","Items Description","textarea",1],
        ["subtotal","Subtotal ₹","number"],
        ["gstPercent","GST %","number"],
        ["gstAmount","GST Amount ₹","number"],
        ["total","Total Amount ₹","number"],
        ["orderedQty","Ordered Quantity","number"],
        ["receivedQty","Received Quantity","number"],
        ["deliveryDate","Expected Delivery","date"],
        ["status","PO Status","select","Draft,Issued,Partially Received,Received,Cancelled"],
        ["remarks","Remarks","textarea"],
        ["attachment","Attach PO/Invoice","file"]
    ],
    sitc: [
        ["equipment","Equipment","text",1],
        ["vendor","Vendor / SI","text"],
        ["location","Location","text"],
        ["chainage","Chainage","text"],
        ["quantity","Planned Qty","number"],
        ["installed","Installed Qty","number"],
        ["tested","Tested Qty","number"],
        ["commissioned","Commissioned Qty","number"],
        ["installDate","Installation Date","date"],
        ["testDate","Testing Date","date"],
        ["commissionDate","Commissioning Date","date"],
        ["testResult","Test Result","select","Pending,Pass,Fail,Observation"],
        ["acceptance","Acceptance","select","Pending,Under Observation,Accepted,Rejected"],
        ["remarks","Remarks","textarea"]
    ],
    daily: [
        ["date","Work Date","date",1],
        ["contractor","Vendor / Contractor","text"],
        ["location","Location","text"],
        ["chainage","Chainage","text"],
        ["work","Work Description","textarea",1],
        ["equipment","Equipment / Category","text"],
        ["quantity","Quantity","number"],
        ["unit","Unit","text"],
        ["manpower","Manpower","number"],
        ["status","Status","select","In Progress,Completed,On Hold"],
        ["remarks","Remarks","textarea"]
    ],
    civil: [
        ["work","Civil Work Name","text",1],
        ["category","Work Type","select","HDD,Trenching,Duct Laying,Cable Laying,Foundation,Chamber,Gantry,Pole Installation,Road Restoration,Other"],
        ["location","Location / Plaza","text"],
        ["startChainage","Start Chainage","text"],
        ["endChainage","End Chainage","text"],
        ["planned","Planned Quantity","number",1],
        ["completed","Completed Quantity","number",1],
        ["unit","Unit","text"],
        ["startDate","Start Date","date"],
        ["targetDate","Target Completion","date"],
        ["contractor","Contractor","text"],
        ["status","Status","select","Not Started,In Progress,Completed,On Hold"],
        ["remarks","Remarks","textarea"]
    ],
    faults: [
        ["equipment","Equipment","text",1],
        ["serial","Serial Number","text"],
        ["location","Location","text"],
        ["chainage","Chainage / Lane","text"],
        ["faultDate","Fault Date & Time","datetime-local",1],
        ["description","Fault Description","textarea",1],
        ["vendor","Repair Vendor","text"],
        ["status","Status","select","Open,Under Repair,Awaiting Replacement,Resolved,Closed"],
        ["resolution","Action Taken","textarea"],
        ["resolutionDate","Resolution Date & Time","datetime-local"],
        ["repairCost","Repair Cost ₹","number"],
        ["replacement","Replacement Details","textarea"],
        ["remarks","Remarks","textarea"]
    ]
};

const columns = {
    inventory: [["equipment","Equipment"],["category","Category"],["quantity","Qty"],["installedQty","Installed"],["commissionedQty","Commissioned"],["location","Location"],["status","Status"]],
    vendors: [["name","Vendor"],["contact","Contact"],["phone","Phone"],["email","Email"],["specialty","Category"],["gst","GST"]],
    procurement: [["po","PO Number"],["vendor","Vendor"],["date","Date"],["total","Total"],["orderedQty","Ordered"],["receivedQty","Received"],["pending","Pending"],["status","Status"],["attachmentName","Attachment"]],
    sitc: [["equipment","Equipment"],["location","Location"],["quantity","Planned"],["installed","Installed"],["tested","Tested"],["commissioned","Commissioned"],["acceptance","Acceptance"]],
    daily: [["date","Date"],["work","Work"],["location","Location"],["chainage","Chainage"],["quantity","Qty"],["contractor","Contractor"],["status","Status"]],
    civil: [["work","Work"],["category","Type"],["startChainage","From"],["endChainage","To"],["planned","Planned"],["completed","Completed"],["balance","Balance"],["progress","Progress"]],
    faults: [["equipment","Equipment"],["location","Location"],["faultDate","Fault Date"],["status","Status"],["resolutionDate","Resolved Date"],["downtime","Downtime"],["repairCost","Repair Cost"]]
};

function head(title, subtitle, button = "") {
    return `<div class="page-head"><div><h1>${title}</h1><p>${subtitle}</p></div>${button}</div>`;
}

function card(label, value, subtitle, icon) {
    return `<div class="kpi"><div class="kpi-top"><div class="label">${label}</div><div class="kpi-icon">${icon}</div></div><div class="value">${value}</div><div class="sub">${subtitle}</div></div>`;
}

function bar(label, value, color = "") {
    return `<div class="bar-row"><div class="bar-label">${escapeHTML(label)}</div><div class="bar-track"><div class="bar-fill" style="width:${value}%;${color ? `background:${color}` : ""}"></div></div><div class="bar-percent">${value}%</div></div>`;
}

function go(next) {
    page = next;
    document.querySelectorAll(".nav-btn").forEach(btn => btn.classList.toggle("active", btn.dataset.page === next));
    document.getElementById("topTitle").textContent = names[next] || next;
    sidebar.classList.remove("open");
    render();
}

document.querySelectorAll(".nav-btn").forEach(btn => {
    btn.addEventListener("click", () => go(btn.dataset.page));
});

document.getElementById("menuToggle").addEventListener("click", () => sidebar.classList.toggle("open"));
document.getElementById("modalClose").addEventListener("click", closeModal);
document.getElementById("cancelBtn").addEventListener("click", closeModal);

document.getElementById("modalBackdrop").addEventListener("click", e => {
    if (e.target.id === "modalBackdrop") closeModal();
});

function render() {
    if (page === "dashboard") return dashboard();
    if (page === "reports") return reportPage();
    if (page === "backup") return backupPage();
    modulePage(page);
}

function dashboard() {
    const inv = calculateInventory(db.inventory);
    const faultOpen = openFaultCount(db.faults);
    const poValue = db.procurement.reduce((s,x) => s + Number(x.total || 0),0);
    const civilPct = totalCivilProgress(db.civil);
    const instPct = percent(inv.installed,inv.total);

    content.innerHTML = head("Project Dashboard","ATMS Project Overview") +
    `<div class="cards">
        ${card("Total Equipment",inv.total,"Equipment quantity","📦")}
        ${card("Installed",inv.installed,instPct+"% installation","🛠")}
        ${card("Commissioned",inv.commissioned,"Commissioned quantity","✅")}
        ${card("Open Faults",faultOpen,"Active issues","⚠️")}
    </div>
    <div class="dashboard-grid">
        <div class="panel">
            <div class="panel-title"><h3>Equipment Progress</h3></div>
            <div class="chart-bars">
                ${bar("Installed",instPct)}
                ${bar("Pending",100-instPct,"#e99b32")}
                ${bar("Commissioned",percent(inv.commissioned,inv.total),"#16a36a")}
            </div>
        </div>
        <div class="panel">
            <div class="panel-title"><h3>Project Summary</h3></div>
            <div class="status-list">
                <div class="status-row"><span>Equipment Types</span><b>${db.inventory.length}</b></div>
                <div class="status-row"><span>Vendors</span><b>${db.vendors.length}</b></div>
                <div class="status-row"><span>Purchase Orders</span><b>${db.procurement.length}</b></div>
                <div class="status-row"><span>Purchase Value</span><b>${formatMoney(poValue)}</b></div>
                <div class="status-row"><span>Civil Progress</span><b>${civilPct}%</b></div>
            </div>
        </div>
    </div>
    <div class="panel">
        <div class="panel-title"><h3>Civil Work Progress</h3></div>
        <div class="chart-bars">
            ${db.civil.slice(0,10).map(x=>bar(x.work,calculateCivil(x).progress)).join("") || "<p class='empty'>No civil work records</p>"}
        </div>
    </div>
    <div class="panel">
        <div class="panel-title"><h3>Quick Actions</h3></div>
        <div class="toolbar">
            <button class="btn primary" onclick="window.atmsAdd('inventory')">＋ Equipment</button>
            <button class="btn" onclick="window.atmsAdd('procurement')">＋ Purchase Order</button>
            <button class="btn" onclick="window.atmsAdd('daily')">＋ Daily Work</button>
            <button class="btn" onclick="window.atmsAdd('faults')">＋ Report Fault</button>
            <button class="btn" onclick="window.atmsAdd('civil')">＋ Civil Work</button>
        </div>
    </div>`;
}

function modulePage(module) {
    const data = db[module] || [];
    const cols = columns[module];
    content.innerHTML = head(
        names[module],
        "Add, edit, search and manage project records",
        `<button class="btn primary" onclick="window.atmsAdd('${module}')">＋ Add Record</button>`
    ) + `<div class="panel">
        <div class="toolbar">
            <input class="search" id="searchBox" placeholder="Search records...">
            <button class="btn" onclick="window.atmsExport('${module}')">⬇ Export CSV</button>
        </div>
        <div class="table-wrap"><table>
            <thead><tr>${cols.map(c=>`<th>${c[1]}</th>`).join("")}<th>Actions</th></tr></thead>
            <tbody id="tableBody"></tbody>
        </table></div>
        <p class="section-note">Records: <span id="recordCount">${data.length}</span> • Saved locally in this browser</p>
    </div>`;

    fillTable(module,data);

    document.getElementById("searchBox").addEventListener("input", e => {
        const q = e.target.value.toLowerCase();
        fillTable(module,data.filter(row => Object.values(row).some(v => String(v ?? "").toLowerCase().includes(q))));
    });
}

function fillTable(module,rows) {
    const body = document.getElementById("tableBody");
    if (!body) return;
    const cols = columns[module];
    document.getElementById("recordCount").textContent = rows.length;

    if (!rows.length) {
        body.innerHTML = `<tr><td colspan="${cols.length+1}" class="empty">No records found</td></tr>`;
        return;
    }

    body.innerHTML = rows.map(row => {
        const realIndex = db[module].findIndex(r => r.id === row.id);
        const cells = cols.map(([key]) => `<td>${displayCell(module,row,key)}</td>`).join("");
        return `<tr>${cells}<td><div class="actions">
            <button class="btn small" onclick="window.atmsEdit('${module}',${realIndex})">✎</button>
            <button class="btn small danger" onclick="window.atmsDelete('${module}',${realIndex})">🗑</button>
        </div></td></tr>`;
    }).join("");
}

function displayCell(module,row,key) {
    if (module === "civil") {
        const c = calculateCivil(row);
        if (key === "balance") return c.balance;
        if (key === "progress") return `${c.progress}%`;
    }
    if (module === "procurement" && key === "pending") return getPendingQty(row);
    if (module === "faults" && key === "downtime") return calculateFault(row).downtime;
    if (module === "faults" && key === "repairCost") return formatMoney(row.repairCost);
    if (module === "procurement" && key === "total") return formatMoney(row.total);
    if (key === "status" || key === "acceptance") return getBadge(row[key]);
    if (key === "attachmentName") {
    return (row.attachmentData || row.attachmentId)
        ? `<a class="attachment-link" href="#" onclick="window.atmsViewAttachment('${row.id}');return false;">📄Show PO</a>`
        : "—";
}
    return escapeHTML(row[key] ?? "—");
}

/* ---------- ADD / EDIT FORM ---------- */

function openForm(module, record = {}) {
    activeModule = module;
    editID = record.id ?? null;

    // Restore saved PO items when editing
    poItems = [];

    if (module === "procurement" && record.itemsJSON) {
        try {
            const parsed = JSON.parse(record.itemsJSON);
            poItems = Array.isArray(parsed) ? parsed.map(item => ({
                item: String(item.item ?? ""),
                code: String(item.code ?? ""),
                qty: Number(item.qty ?? 0),
                unit: String(item.unit ?? "Nos"),
                rate: Number(item.rate ?? 0)
            })) : [];
        } catch (error) {
            console.warn("Could not load saved PO items:", error);
            poItems = [];
        }
    }

    document.getElementById("modalTitle").textContent =
        (editID === null ? "Add " : "Edit ") + names[module];

    const wrap = document.getElementById("formFields");
    wrap.innerHTML = "";

    schemas[module].forEach(([key, label, type, extra]) => {
        const div = document.createElement("div");
        div.className = "field" + (type === "textarea" ? " full" : "");

        const lab = document.createElement("label");
        lab.textContent = label;
        div.appendChild(lab);

        let el;

        if (type === "textarea") {
            el = document.createElement("textarea");
        } else if (type === "select") {
            el = document.createElement("select");
            el.innerHTML = extra.split(",").map(v =>
                `<option value="${escapeHTML(v)}">${escapeHTML(v)}</option>`
            ).join("");
        } else {
            el = document.createElement("input");
            el.type = type;
        }

        el.dataset.key = key;
        if (type !== "file") el.value = record[key] ?? "";
        if (extra === 1) el.required = true;

        div.appendChild(el);
        wrap.appendChild(div);
    });

    // Dynamic PO material editor
    if (module === "procurement") {
        const editor = document.createElement("div");
        editor.className = "field full";
        editor.id = "poItemsEditor";

        const descriptionField = wrap.querySelector('[data-key="description"]')?.closest(".field");

        if (descriptionField) {
            descriptionField.insertAdjacentElement("afterend", editor);
        } else {
            wrap.appendChild(editor);
        }

        renderPOItems();

        wrap.querySelector('[data-key="gstPercent"]')?.addEventListener("input", autoCalculatePO);
    }

    document.getElementById("modalBackdrop").classList.add("show");
}


/* ---------- PO MATERIAL ITEM EDITOR ---------- */

function renderPOItems() {
    const editor = document.getElementById("poItemsEditor");
    if (!editor) return;

    editor.innerHTML = `
        <div class="po-items-box" style="border:1px solid #dce3ed;border-radius:12px;padding:15px;background:#f8fafc;">
            <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:15px;">
                <h3 style="margin:0;">PO Material Items</h3>
                <button type="button" class="btn primary" id="addPOItemBtn">＋ Add Item</button>
            </div>

            <div id="poItemsList"></div>

            <div style="margin-top:12px;padding:12px;background:white;border:1px solid #e2e8f0;border-radius:8px;">
                <div style="display:flex;justify-content:space-between;margin-bottom:6px;gap:10px;">
                    <span>Items Subtotal</span>
                    <strong id="poItemsSubtotal">₹0.00</strong>
                </div>

                <div style="display:flex;justify-content:space-between;margin-bottom:6px;gap:10px;">
                    <span>GST Amount</span>
                    <strong id="poItemsGST">₹0.00</strong>
                </div>

                <hr>

                <div style="display:flex;justify-content:space-between;font-size:17px;gap:10px;">
                    <strong>Grand Total</strong>
                    <strong id="poItemsGrandTotal">₹0.00</strong>
                </div>
            </div>
        </div>
    `;

    const list = editor.querySelector("#poItemsList");

    if (!poItems.length) {
        list.innerHTML = `
            <div style="text-align:center;padding:20px;color:#64748b;border:1px dashed #cbd5e1;border-radius:8px;margin-bottom:12px;">
                No material items added. Click "Add Item" to start.
            </div>
        `;
    } else {
        list.innerHTML = poItems.map((item, index) => `
            <div class="po-item-row" data-index="${index}" style="background:white;border:1px solid #e2e8f0;border-radius:9px;padding:12px;margin-bottom:12px;">

                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;gap:8px;">
                    <strong>Item ${index + 1}</strong>
                    <button type="button" class="btn danger small deletePOItem" data-index="${index}">
                        Remove
                    </button>
                </div>

                <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:10px;">

                    <div>
                        <label>Material / Equipment *</label>
                        <input type="text" data-field="item" data-index="${index}"
                            value="${escapeHTML(item.item)}"
                            placeholder="e.g. ANPR Camera" required
                            style="width:100%;box-sizing:border-box;">
                    </div>

                    <div>
                        <label>Material Code</label>
                        <input type="text" data-field="code" data-index="${index}"
                            value="${escapeHTML(item.code)}"
                            placeholder="CAM-001"
            style="width:100%;box-sizing:border-box;">
                    </div>

                    <div>
                        <label>Quantity *</label>
                        <input type="number" data-field="qty" data-index="${index}"
                            value="${Number(item.qty)}"
                            min="0" step="any" required
                            style="width:100%;box-sizing:border-box;">
                    </div>

                    <div>
                        <label>Unit</label>
                        <input type="text" data-field="unit" data-index="${index}"
                            value="${escapeHTML(item.unit || "Nos")}"
                            placeholder="Nos, Set, Mtr"
                            style="width:100%;box-sizing:border-box;">
                    </div>

                    <div>
                        <label>Rate (₹) *</label>
                        <input type="number" data-field="rate" data-index="${index}"
                            value="${Number(item.rate)}"
                            min="0" step="any" required
                            style="width:100%;box-sizing:border-box;">
                    </div>

                    <div>
                        <label>Amount (₹)</label>
                        <input type="text" readonly
                            value="${(Number(item.qty || 0) * Number(item.rate || 0)).toFixed(2)}"
                            style="width:100%;box-sizing:border-box;background:#f1f5f9;">
                    </div>

                </div>
            </div>
        `).join("");
    }

    // Add new material
    editor.querySelector("#addPOItemBtn").onclick = () => {
        poItems.push({
            item: "",
            code: "",
            qty: 1,
            unit: "Nos",
            rate: 0
        });

        renderPOItems();
        autoCalculatePO();
    };

    // Remove item
    editor.querySelectorAll(".deletePOItem").forEach(button => {
        button.onclick = () => {
            poItems.splice(Number(button.dataset.index), 1);
            renderPOItems();
            autoCalculatePO();
        };
    });

    // Input listeners
    editor.querySelectorAll("[data-field]").forEach(input => {
        input.addEventListener("input", () => {
            const index = Number(input.dataset.index);
            const field = input.dataset.field;

            if (!poItems[index]) return;

            poItems[index][field] =
                (field === "qty" || field === "rate")
                    ? Number(input.value || 0)
                    : input.value;

            // Update row amount
            const row = input.closest(".po-item-row");
            const amountField = row?.querySelector("input[readonly]");

            if (amountField) {
                amountField.value =
                    (Number(poItems[index].qty || 0) *
                     Number(poItems[index].rate || 0)).toFixed(2);
            }

            autoCalculatePO();
        });
    });

    autoCalculatePO();
}


/* ---------- AUTO CALCULATION ---------- */

function autoCalculatePO() {
    if (!Array.isArray(poItems)) return;

    const subtotal = poItems.reduce(
        (sum, item) => sum + Number(item.qty || 0) * Number(item.rate || 0),
        0
    );

    const gstRate = Number(
        document.querySelector('[data-key="gstPercent"]')?.value || 0
    );

    const gstAmount = subtotal * gstRate / 100;
    const total = subtotal + gstAmount;

    const orderedQty = poItems.reduce(
        (sum, item) => sum + Number(item.qty || 0),
        0
    );

    const setValue = (key, value) => {
        const field = document.querySelector(`[data-key="${key}"]`);
        if (field) field.value = value;
    };

    setValue("subtotal", subtotal.toFixed(2));
    setValue("gstAmount", gstAmount.toFixed(2));
    setValue("total", total.toFixed(2));
    setValue("orderedQty", orderedQty);

    const formatPOAmount = value =>
        "₹" + Number(value || 0).toLocaleString("en-IN", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });

    const subtotalDisplay = document.getElementById("poItemsSubtotal");
    const gstDisplay = document.getElementById("poItemsGST");
    const totalDisplay = document.getElementById("poItemsGrandTotal");

    if (subtotalDisplay) subtotalDisplay.textContent = formatPOAmount(subtotal);
    if (gstDisplay) gstDisplay.textContent = formatPOAmount(gstAmount);
    if (totalDisplay) totalDisplay.textContent = formatPOAmount(total);
}

function closeModal() {
    document.getElementById("modalBackdrop").classList.remove("show");
    document.getElementById("recordForm").reset();
    poItems = [];
    activeModule = null;
    editID = null;
}

window.atmsAdd = module => openForm(module);

window.atmsEdit = (module,index) => {
    if (!db[module][index]) return;
    openForm(module,db[module][index]);
};

window.atmsDelete = (module,index) => {
    if (!confirm("Delete this record permanently?")) return;
    db[module].splice(index,1);
    saveDB(db);
    render();
    showToast("Record deleted");
};


/* ---------- SAVE FORM ---------- */

document.getElementById("recordForm").addEventListener("submit",async e=>{
    e.preventDefault();

    const module = activeModule;
    if (!module) return;

    const old = editID !== null
        ? db[module].find(r => r.id === editID) || {}
        : {};

    const record = { ...old };
    record.id = old.id || makeID();

    document.querySelectorAll("#formFields [data-key]").forEach(el=>{
        const key = el.dataset.key;

        if (el.type === "file") {
            if (el.files[0]) record.attachmentName = el.files[0].name;
        } else {
            record[key] = el.value;
        }
    });

    /* Procurement calculations and attachment */
    if (module === "procurement") {

        // Save item rows to database
        record.itemsJSON = JSON.stringify(poItems);

        ["subtotal","gstPercent","gstAmount","total","orderedQty","receivedQty"].forEach(k=>{
            record[k] = Number(record[k] || 0);
        });

        const fileInput = document.querySelector('[data-key="attachment"]');
        const file = fileInput?.files?.[0];

        if (file) {
            try {
        const attachmentId = `ATMS_FILE_${record.id}`;

        await saveAttachment(attachmentId, file, file.name);

        record.attachmentId = attachmentId;
        record.attachmentName = file.name;

        // Remove old Base64 attachment after successful IndexedDB save
        delete record.attachmentData;

        } catch (error) {
        console.error("PDF attachment save failed:", error);
        showToast("PDF save failed! Please try again.");
        return;
            }
        }

        if (!record.receiptsJSON) record.receiptsJSON = "[]";

        if (record.receivedQty >= record.orderedQty && record.orderedQty > 0) {
            record.status = "Received";
        } else if (record.receivedQty > 0 && record.status !== "Cancelled") {
            record.status = "Partially Received";
        }
    }

    /* Convert numeric fields */
    const numericFields = {
        inventory:["quantity","installedQty","commissionedQty"],
        sitc:["quantity","installed","tested","commissioned"],
        daily:["quantity","manpower"],
        civil:["planned","completed"],
        faults:["repairCost"]
    };

    (numericFields[module] || []).forEach(k=>{
        record[k] = Number(record[k] || 0);
    });

    if (module === "civil") {
        const c = calculateCivil(record);
        record.balance = c.balance;
        record.progress = c.progress;
    }

    record.id = old.id || makeID();
    record.createdAt = old.createdAt || new Date().toISOString();
    record.updatedAt = new Date().toISOString();

    if (editID !== null) {
        const index = db[module].findIndex(r=>r.id === editID);
        if (index !== -1) db[module][index] = record;
    } else {
        db[module].push(record);
    }

    if (!saveDB(db)) return;

    closeModal();
    render();
    showToast("Record saved successfully");
});


function readFile(file) {
    return new Promise((resolve,reject)=>{
        const reader = new FileReader();
        reader.onload = ()=>resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

window.atmsDownload = async (id) => {
    try {
        const record = db.procurement.find(r => String(r.id) === String(id));

        if (!record) {
            showToast("Record not found");
            return;
        }

        // Legacy attachment support
        if (record.attachmentData) {
            const link = document.createElement("a");
            link.href = record.attachmentData;
            link.download = record.attachmentName || "document";
            link.click();
            return;
        }

        // New IndexedDB attachment support
        if (record.attachmentId) {
            const file = await getAttachment(record.attachmentId);

            if (!file || !file.blob) {
                showToast("Attachment not found in storage");
                return;
            }

            const url = URL.createObjectURL(file.blob);
            const link = document.createElement("a");

            link.href = url;
            link.download = file.name || record.attachmentName || "document";

            document.body.appendChild(link);
            link.click();
            link.remove();

            setTimeout(() => URL.revokeObjectURL(url), 10000);
            return;
        }

        showToast("No attachment available");

    } catch (error) {
        console.error(error);
        showToast("Attachment download failed");
    }
};

/* ---------- ATTACHMENT VIEWER (100% ZOOM) ---------- */

window.atmsViewAttachment = async (id) => {
    try {
        const record = db.procurement.find(r => String(r.id) === String(id));

        if (!record) {
            showToast("Record not found");
            return;
        }

        let fileBlob = null;

        // Old Base64 attachment support
        if (record.attachmentData) {
            const response = await fetch(record.attachmentData);
            fileBlob = await response.blob();
        }

        // IndexedDB attachment support
        else if (record.attachmentId) {
            const file = await getAttachment(record.attachmentId);

            if (!file || !file.blob) {
                showToast("Attachment not found in storage");
                return;
            }

            fileBlob = file.blob;
        }

        if (!fileBlob) {
            showToast("No attachment available");
            return;
        }

        // Create file URL
        const fileURL = URL.createObjectURL(fileBlob);

        // Remove old viewer if open
        document.getElementById("atmsAttachmentViewer")?.remove();

        // Create viewer
        const viewer = document.createElement("div");
        viewer.id = "atmsAttachmentViewer";

        viewer.style.cssText = `
                position:fixed;
                top:50%;
                left:50%;
                transform:translate(-50%,-50%);
                z-index:999999;
                background:#111827;
                display:flex;
                flex-direction:column;
                width:60vw;
                max-width:1100px;
                height:100vh;
                max-height:850px;
                border-radius:12px;
                overflow:hidden;
                box-shadow:0 15px 50px rgba(0,0,0,0.35);
                border:1px solid #374151;
            `;

        // Viewer header
        const header = document.createElement("div");

        header.style.cssText = `
            height:55px;
            min-height:55px;
            background:#1f2937;
            color:#ffffff;
            display:flex;
            align-items:center;
            justify-content:space-between;
            padding:0 15px;
            box-sizing:border-box;
            gap:10px;
        `;

        const fileTitle = document.createElement("div");
        fileTitle.textContent = record.attachmentName || "Attachment Viewer";
        fileTitle.style.cssText = `
            overflow:hidden;
            white-space:nowrap;
            text-overflow:ellipsis;
            font-size:14px;
            flex:1;
        `;

        // Toolbar buttons
        const toolbar = document.createElement("div");
        toolbar.style.cssText = `
            display:flex;
            gap:8px;
            align-items:center;
        `;

        const downloadBtn = document.createElement("button");
        downloadBtn.innerHTML = "⬇ Download";
        downloadBtn.style.cssText = `
            background:#2563eb;
            color:white;
            border:0;
            padding:9px 14px;
            border-radius:6px;
            cursor:pointer;
            font-weight:600;
        `;

        downloadBtn.onclick = () => window.atmsDownload(record.id);

        const closeBtn = document.createElement("button");
        closeBtn.innerHTML = "✕ Close";
        closeBtn.style.cssText = `
            background:#4b5563;
            color:white;
            border:0;
            padding:9px 14px;
            border-radius:6px;
            cursor:pointer;
        `;

        closeBtn.onclick = () => {
            viewer.remove();
            URL.revokeObjectURL(fileURL);
        };

        toolbar.appendChild(downloadBtn);
        toolbar.appendChild(closeBtn);

        header.appendChild(fileTitle);
        header.appendChild(toolbar);

        // Document area
        const frame = document.createElement("iframe");

        frame.src = fileURL + "#zoom=100";
        frame.title = record.attachmentName || "Attachment";
        frame.style.cssText = `
            flex:1;
            width:100%;
            min-height:0;
            border:0;
            background:#ffffff;
        `;

        viewer.appendChild(header);
        viewer.appendChild(frame);

        document.body.appendChild(viewer);

    } catch (error) {
        console.error("Attachment viewer error:", error);
        showToast("Unable to open attachment");
    }
};


/* ---------- CSV EXPORT ---------- */

window.atmsExport = module => {
    const cols = columns[module].map(([key,label])=>({key,label}));
    const rows = db[module] || [];

    const header = cols.map(c=>csvEscape(c.label)).join(",");

    const body = rows.map(row=>
        cols.map(c=>csvEscape(row[c.key])).join(",")
    );

    downloadFile(
        [header,...body].join("\n"),
        module+"_report.csv",
        "text/csv;charset=utf-8"
    );
};


/* ---------- REPORTS ---------- */

function reportPage() {
    const summary = projectSummary(db);
    const installation = percent(summary.installed,summary.totalEquipment);
    const commissioning = percent(summary.commissioned,summary.totalEquipment);
    const civil = percent(summary.civilCompleted,summary.civilPlanned);

    content.innerHTML = head("Reports & Analytics","ATMS project progress summary") +
    `<div class="cards">
        ${card("Equipment Types",db.inventory.length,"Inventory categories","📦")}
        ${card("Installation",installation+"%","Quantity-based","🛠")}
        ${card("Commissioning",commissioning+"%","Equipment quantity","✔")}
        ${card("Purchase Value",formatMoney(summary.purchaseValue),"Total PO value","₹")}
    </div>
    <div class="dashboard-grid">
        <div class="panel">
            <div class="panel-title"><h3>Project Progress</h3></div>
            <div class="chart-bars">
                ${bar("Installation",installation)}
                ${bar("Commissioning",commissioning,"#16a36a")}
                ${bar("Civil Work",civil,"#8462d5")}
            </div>
        </div>
        <div class="panel">
            <div class="panel-title"><h3>Fault Summary</h3></div>
            <div class="status-list">
                <div class="status-row"><span>Total Faults</span><b>${summary.totalFaults}</b></div>
                <div class="status-row"><span>Open Faults</span><b>${summary.openFaults}</b></div>
                <div class="status-row"><span>Repair Cost</span><b>${formatMoney(totalRepairCost(db.faults))}</b></div>
            </div>
        </div>
    </div>
    <div class="panel">
        <div class="panel-title"><h3>Export Module Reports</h3></div>
        <div class="toolbar">
            ${Object.keys(columns).map(m=>
                `<button class="btn" onclick="window.atmsExport('${m}')">${names[m]} CSV</button>`
            ).join("")}
        </div>
    </div>`;
}


/* ---------- BACKUP / RESTORE ---------- */

function backupPage() {
    content.innerHTML = head("Backup & Restore","Safeguard your ATMS project records") +
    `<div class="panel">
        <h3>Download Project Backup</h3>
        <p class="section-note">Download all saved records as a JSON backup.</p>
        <button class="btn primary" id="backupBtn">⬇ Download Backup</button>
    </div>
    <div class="panel">
        <h3>Restore Project Backup</h3>
        <p class="section-note">Restoring replaces current data. Backup your existing data first.</p>
        <input type="file" id="restoreFile" accept=".json">
        <button class="btn" id="restoreBtn">Restore Backup</button>
    </div>
    <div class="panel">
        <h3>Clear Project Data</h3>
        <p class="section-note">Permanently clear all locally saved records.</p>
        <button class="btn danger" id="clearBtn">Clear All Data</button>
    </div>`;

    document.getElementById("backupBtn").onclick=()=>exportBackup(db);

    document.getElementById("restoreBtn").onclick=()=>{
        const file=document.getElementById("restoreFile").files[0];
        if(!file){showToast("Select a backup file");return;}

        importBackup(file,data=>{
            if(!confirm("Replace current data with this backup?"))return;
            db=data;
            saveDB(db);
            go("dashboard");
            showToast("Backup restored");
        });
    };

    document.getElementById("clearBtn").onclick=()=>{
        if(!confirm("Delete all project records?"))return;
        if(!confirm("This cannot be undone. Continue?"))return;
        db=createEmptyDB();
        saveDB(db);
        go("dashboard");
        showToast("All data cleared");
    };
}


/* ---------- START ---------- */
render();