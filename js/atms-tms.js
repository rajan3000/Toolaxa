/* =========================================================
   ATMS & TMS MAINTENANCE ERP
   LocalStorage based single-browser application
========================================================= */

const DB_KEY = "tolltech_maintenance_erp_v1";

const defaults = {
  equipment: [],
  faults: [],
  vendors: [],
  purchases: [],
  inventory: [],
  amc: []
};

let db = loadDB();
let editing = null;

function loadDB() {
  try {
    const saved = JSON.parse(localStorage.getItem(DB_KEY));
    return saved ? { ...defaults, ...saved } : structuredClone(defaults);
  } catch {
    return structuredClone(defaults);
  }
}

function saveDB() {
  try {
    localStorage.setItem(DB_KEY, JSON.stringify(db));
    renderAll();
    return true;
  } catch (error) {
    alert("Unable to save data. Browser storage may be full. Please download a backup and remove large attachments or use a smaller PDF.");
    return false;
  }
}

function uid(prefix) {
  return prefix + "-" + Date.now().toString(36).toUpperCase()
    + "-" + Math.random().toString(36).substring(2, 6).toUpperCase();
}

/* =========================================================
   SHORT AUTO ID GENERATOR
   AID-001 | TID-001 | VID-001 | PID-001 | SID-001 | AMC-001
========================================================= */

function generateShortId(prefix, records) {
  let maxNumber = 0;

  (records || []).forEach(record => {
    const id = String(record.id || "");
    const start = prefix + "-";

    if (id.toUpperCase().startsWith(start)) {
      const numberPart = id.slice(start.length);
      if (/^\d+$/.test(numberPart)) {
        maxNumber = Math.max(maxNumber, Number(numberPart));
      }
    }
  });

  return `${prefix}-${String(maxNumber + 1).padStart(3, "0")}`;
}

function generateAssetId() {
  return generateShortId("AID", db.equipment);
}

function generateTicketId() {
  return generateShortId("TID", db.faults);
}

function generateVendorId() {
  return generateShortId("VID", db.vendors);
}

function generatePurchaseId() {
  return generateShortId("PID", db.purchases);
}

function generateStockId() {
  return generateShortId("SID", db.inventory);
}

function generateAmcId() {
  return generateShortId("AMC", db.amc);
}

/* COMMON HELPERS */

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, c => ({
    "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;"
  })[c]);
}

function fmtDate(date) {
  if (!date) return "-";
  return esc(date);
}

function money(value) {
  return "₹" + Number(value || 0).toLocaleString("en-IN", {
    maximumFractionDigits: 2
  });
}

function emptyRow(cols, message = "No records found") {
  return `<tr><td colspan="${cols}" class="empty-row">${esc(message)}</td></tr>`;
}

function badge(status) {
  const safe = String(status || "Unknown");
  const cls = safe.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return `<span class="badge badge-${cls}">${esc(safe)}</span>`;
}

function toast(message) {
  const el = document.getElementById("toast");
  el.textContent = message;
  el.classList.add("show");
  setTimeout(() => el.classList.remove("show"), 2800);
}

/* NAVIGATION */

function navigate(page) {
  document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
  document.querySelectorAll(".nav-item[data-page]").forEach(b => b.classList.remove("active"));

  const section = document.getElementById("page-" + page);
  if (section) section.classList.add("active");

  const nav = document.querySelector(`.nav-item[data-page="${page}"]`);
  if (nav) nav.classList.add("active");

  const titles = {
    dashboard:"Dashboard",
    equipment:"Equipment Register",
    faults:"Fault Management",
    vendors:"Vendor Management",
    purchases:"Purchase & Orders",
    inventory:"Inventory / Stock",
    amc:"AMC & Warranty",
    reports:"Reports",
    settings:"Settings & Backup"
  };

  document.getElementById("pageTitle").textContent = titles[page] || page;
  document.getElementById("sidebar").classList.remove("open");
  renderAll();
}

document.querySelectorAll(".nav-item[data-page]").forEach(button => {
  button.addEventListener("click", () => navigate(button.dataset.page));
});

document.getElementById("menuToggle").addEventListener("click", () => {
  document.getElementById("sidebar").classList.toggle("open");
});

document.getElementById("todayDate").textContent =
  new Date().toLocaleDateString("en-IN", {
    weekday:"short", day:"2-digit", month:"short", year:"numeric"
  });

/* RENDER EVERYTHING */

function renderAll() {
  renderDashboard();
  renderEquipment();
  renderFaults();
  renderVendors();
  renderPurchases();
  renderInventory();
  renderAmc();
  renderReports();
}

/* DASHBOARD */

function renderDashboard() {
  const total = db.equipment.length;
  const working = db.equipment.filter(x => x.status === "Working").length;
  const faulty = db.equipment.filter(x => x.status === "Faulty").length;
  const maintenance = db.equipment.filter(x => x.status === "Under Maintenance").length;
  const open = db.faults.filter(x => x.status !== "Resolved").length;
  const pending = db.purchases.reduce((s, p) => s + Math.max(0, Number(p.qty || 0) - Number(p.received || 0)), 0);

  const now = new Date();
  now.setHours(0,0,0,0);
  const upcoming = db.amc.filter(a => {
    if (!a.end) return false;
    const end = new Date(a.end + "T00:00:00");
    const diff = Math.ceil((end - now) / 86400000);
    return diff >= 0 && diff <= 30;
  }).length;

  document.getElementById("statTotal").textContent = total;
  document.getElementById("statWorking").textContent = working;
  document.getElementById("statFaulty").textContent = faulty;
  document.getElementById("statMaintenance").textContent = maintenance;
  document.getElementById("statComplaints").textContent = open;
  document.getElementById("statVendors").textContent = db.vendors.length;
  document.getElementById("statPending").textContent = pending;
  document.getElementById("statAmc").textContent = upcoming;

  const statuses = [
    ["Working", working, "#18a66c"],
    ["Faulty", faulty, "#e34f55"],
    ["Under Maintenance", maintenance, "#f0a23c"],
    ["Standby", db.equipment.filter(x => x.status === "Standby").length, "#8592a7"],
    ["Retired", db.equipment.filter(x => x.status === "Retired").length, "#a4adba"]
  ];

  document.getElementById("statusSummary").innerHTML = statuses.map(s => `
    <div class="status-row">
      <div class="status-label"><span>${s[0]}</span></div>
      <div class="status-track">
        <div class="status-fill" style="width:${total ? (s[1] / total * 100) : 0}%;background:${s[2]}"></div>
      </div>
      <div class="status-count">${s[1]}</div>
    </div>
  `).join("");

  const recent = [...db.faults].sort((a,b) => (b.date || "").localeCompare(a.date || "")).slice(0,5);
  document.getElementById("recentFaults").innerHTML = recent.length ? recent.map(f => `
    <tr>
      <td>${fmtDate(f.date)}</td>
      <td>${esc(f.equipment || "-")}</td>
      <td>${esc(f.location || "-")}</td>
      <td>${esc(f.issue || "-")}</td>
      <td>${badge(f.priority)}</td>
      <td>${badge(f.status)}</td>
    </tr>`).join("") : emptyRow(6);

  const recentPO = [...db.purchases].sort((a,b) => (b.date || "").localeCompare(a.date || "")).slice(0,5);
  document.getElementById("recentPurchases").innerHTML = recentPO.length ? recentPO.map(p => `
    <tr>
      <td>${esc(p.po || "-")}</td>
      <td>${esc(p.vendor || "-")}</td>
      <td>${fmtDate(p.date)}</td>
      <td>${esc(p.item || "-")}</td>
      <td>${money(p.amount)}</td>
      <td>${badge(p.status)}</td>
    </tr>`).join("") : emptyRow(6);
}

/* EQUIPMENT */

function renderEquipment() {
  const search = (document.getElementById("equipmentSearch")?.value || "").toLowerCase();
  const status = document.getElementById("equipmentFilter")?.value || "";
  const plaza = document.getElementById("plazaFilter")?.value || "";

  const list = db.equipment.filter(x => {
    const txt = [x.id,x.name,x.category,x.location,x.lane,x.serial,x.vendor,x.model]
      .join(" ").toLowerCase();
    return txt.includes(search) && (!status || x.status === status) && (!plaza || x.location === plaza);
  });

  document.getElementById("equipmentTable").innerHTML = list.length ? list.map(x => `
    <tr>
      <td><b>${esc(x.id)}</b></td>
      <td>${esc(x.name)}<br><small>${esc(x.model || "")}</small></td>
      <td>${esc(x.category)}</td>
      <td>${esc(x.location)} / ${esc(x.lane || "-")}</td>
      <td>${esc(x.serial || "-")}</td>
      <td>${badge(x.status)}</td>
      <td>${esc(x.vendor || "-")}</td>
      <td class="actions">
        <button class="action-btn" onclick="editEquipment('${x.id}')">Edit</button>
        <button class="action-btn" onclick="changeEquipmentStatus('${x.id}')">Status</button>
        <button class="action-btn delete" onclick="deleteRecord('equipment','${x.id}')">Delete</button>
      </td>
    </tr>`).join("") : emptyRow(8);
}

function openEquipmentModal(item = null) {
  editing = item ? {type:"equipment",id:item.id} : null;
  showModal(item ? "Edit Equipment" : "Register Equipment", `
    <form id="recordForm">
      <div class="form-grid">
        ${field("Asset ID","id",item?.id || generateAssetId(),"text",true)}
        ${field("Equipment Name","name",item?.name,"text",true)}
        ${field("Category","category",item?.category,"text",true)}
        ${selectField("Status","status",["Working","Faulty","Under Maintenance","Standby","Retired"],item?.status || "Working")}
        ${selectField("Plaza","location",["Varwade","Sawaleshwar","ATMS"],item?.location || "Varwade")}
        ${field("Lane / Location","lane",item?.lane,"text")}
        ${field("Serial Number","serial",item?.serial,"text")}
        ${field("Make / Model","model",item?.model,"text")}
        ${field("Vendor","vendor",item?.vendor,"text")}
        ${field("Installation Date","installDate",item?.installDate,"date")}
        ${field("Warranty End Date","warranty",item?.warranty,"date")}
        ${field("Purchase Cost (₹)","cost",item?.cost,"number")}
        ${field("Remarks","remarks",item?.remarks,"text")}
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-light" onclick="closeModal()">Cancel</button>
        <button class="btn btn-primary">Save Equipment</button>
      </div>
    </form>
  `);

  document.getElementById("recordForm").onsubmit = e => {
    e.preventDefault();
    const d = formData(e.target);
    if (!item && db.equipment.some(x => x.id === d.id)) return toast("Asset ID already exists");
    if (item) Object.assign(item,d);
    else db.equipment.push(d);
    closeModal(); saveDB(); toast("Equipment saved successfully");
  };
}

function editEquipment(id) {
  openEquipmentModal(db.equipment.find(x => x.id === id));
}

function changeEquipmentStatus(id) {
  const item = db.equipment.find(x => x.id === id);
  if (!item) return;
  const options = ["Working","Faulty","Under Maintenance","Standby","Retired"];
  const next = prompt("Enter new status:\n" + options.join("\n"), item.status);
  if (!next) return;
  if (!options.includes(next)) return toast("Invalid status");
  item.status = next;
  saveDB();
  toast("Equipment status updated");
}

/* FAULTS */

function renderFaults() {
  const search = (document.getElementById("faultSearch")?.value || "").toLowerCase();
  const filter = document.getElementById("faultFilter")?.value || "";
  const list = [...db.faults].filter(f =>
    [f.id,f.equipment,f.location,f.issue,f.vendor].join(" ").toLowerCase().includes(search)
    && (!filter || f.status === filter)
  ).sort((a,b) => (b.date || "").localeCompare(a.date || ""));

  document.getElementById("faultTable").innerHTML = list.length ? list.map(f => `
    <tr>
      <td><b>${esc(f.id)}</b></td>
      <td>${fmtDate(f.date)}</td>
      <td>${esc(f.equipment)}</td>
      <td>${esc(f.location)}</td>
      <td>${esc(f.issue)}</td>
      <td>${badge(f.priority)}</td>
      <td>${esc(f.vendor || "-")}</td>
      <td>${badge(f.status)}</td>
      <td class="actions">
        <button class="action-btn" onclick="editFault('${f.id}')">Edit</button>
        <button class="action-btn" onclick="cycleFaultStatus('${f.id}')">Update</button>
        <button class="action-btn delete" onclick="deleteRecord('faults','${f.id}')">Delete</button>
      </td>
    </tr>`).join("") : emptyRow(9);
}

function openFaultModal(item = null) {
  editing = item ? {type:"faults",id:item.id} : null;
  showModal(item ? "Edit Fault Ticket" : "Report New Fault", `
    <form id="recordForm">
      <div class="form-grid">
        ${field("Ticket ID","id",item?.id || generateTicketId(),"text",true)}
        ${field("Complaint Date","date",item?.date || new Date().toISOString().slice(0,10),"date",true)}
        ${field("Equipment Name","equipment",item?.equipment,"text",true)}
        ${field("Plaza / Location","location",item?.location,"text",true)}
        ${selectField("Priority","priority",["Low","Medium","High","Critical"],item?.priority || "Medium")}
        ${selectField("Status","status",["Open","In Progress","Resolved"],item?.status || "Open")}
        ${field("Assigned Vendor","vendor",item?.vendor,"text")}
        ${field("Assigned Person","assigned",item?.assigned,"text")}
        ${field("Issue Description","issue",item?.issue,"text",true)}
        ${field("Resolution / Action Taken","resolution",item?.resolution,"text")}
        ${field("Resolved Date","resolvedDate",item?.resolvedDate,"date")}
        ${field("Downtime (Hours)","downtime",item?.downtime,"number")}
        ${field("Repair Cost (₹)","cost",item?.cost,"number")}
        ${field("Service Report / Reference","report",item?.report,"text")}
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-light" onclick="closeModal()">Cancel</button>
        <button class="btn btn-primary">Save Ticket</button>
      </div>
    </form>
  `);

  document.getElementById("recordForm").onsubmit = e => {
    e.preventDefault();
    const d = formData(e.target);
    if (item) Object.assign(item,d);
    else db.faults.push(d);
    const eq = db.equipment.find(x => x.name === d.equipment);
    if (eq && d.status !== "Resolved") eq.status = "Faulty";
    if (eq && d.status === "Resolved") eq.status = "Working";
    closeModal(); saveDB(); toast("Fault ticket saved");
  };
}

function editFault(id) {
  openFaultModal(db.faults.find(x => x.id === id));
}

function cycleFaultStatus(id) {
  const f = db.faults.find(x => x.id === id);
  if (!f) return;
  const states = ["Open","In Progress","Resolved"];
  const next = prompt("Enter status:\nOpen\nIn Progress\nResolved", f.status);
  if (!next || !states.includes(next)) return;
  f.status = next;
  if (next === "Resolved") {
    f.resolvedDate = new Date().toISOString().slice(0,10);
    const eq = db.equipment.find(x => x.name === f.equipment);
    if (eq) eq.status = "Working";
  } else {
    const eq = db.equipment.find(x => x.name === f.equipment);
    if (eq) eq.status = "Faulty";
  }
  saveDB();
}

/* VENDORS */

function renderVendors() {
  const search = (document.getElementById("vendorSearch")?.value || "").toLowerCase();
  const list = db.vendors.filter(v =>
    [v.name,v.contact,v.phone,v.email,v.services].join(" ").toLowerCase().includes(search)
  );

  document.getElementById("vendorTable").innerHTML = list.length ? list.map(v => `
    <tr>
      <td><b>${esc(v.name)}</b><br><small>${esc(v.address || "")}</small></td>
      <td>${esc(v.contact || "-")}</td>
      <td>${esc(v.phone || "-")}</td>
      <td>${esc(v.email || "-")}</td>
      <td>${esc(v.services || "-")}</td>
      <td>${db.amc.filter(a => a.vendor === v.name && a.end >= new Date().toISOString().slice(0,10)).length}</td>
      <td class="actions">
        <button class="action-btn" onclick="editVendor('${v.id}')">Edit</button>
        <button class="action-btn delete" onclick="deleteRecord('vendors','${v.id}')">Delete</button>
      </td>
    </tr>`).join("") : emptyRow(7);
}

function openVendorModal(item = null) {
  editing = item ? {type:"vendors",id:item.id} : null;
  showModal(item ? "Edit Vendor" : "Add Vendor", `
    <form id="recordForm">
      <div class="form-grid">
        ${field("Vendor ID","id",item?.id || generateVendorId(),"text",true)}
        ${field("Vendor Company Name","name",item?.name,"text",true)}
        ${field("Contact Person","contact",item?.contact,"text")}
        ${field("Phone","phone",item?.phone,"tel")}
        ${field("Email","email",item?.email,"email")}
        ${field("Services / Specialization","services",item?.services,"text")}
        ${field("Address","address",item?.address,"text")}
        ${field("GST Number","gst",item?.gst,"text")}
        ${field("Notes","notes",item?.notes,"text")}
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-light" onclick="closeModal()">Cancel</button>
        <button class="btn btn-primary">Save Vendor</button>
      </div>
    </form>
  `);
  document.getElementById("recordForm").onsubmit = e => {
    e.preventDefault();
    const d = formData(e.target);
    if (item) Object.assign(item,d);
    else db.vendors.push(d);
    closeModal(); saveDB(); toast("Vendor saved");
  };
}

function editVendor(id) {
  openVendorModal(db.vendors.find(v => v.id === id));
}

/* PURCHASES */

function renderPurchases() {
  const search = (document.getElementById("purchaseSearch")?.value || "").toLowerCase();
  const filter = document.getElementById("purchaseFilter")?.value || "";
  const list = db.purchases.filter(p =>
    [p.po,p.vendor,p.item,p.notes].join(" ").toLowerCase().includes(search)
    && (!filter || p.status === filter)
  );

  document.getElementById("purchaseTable").innerHTML = list.length ? list.map(p => {
    const pending = Math.max(0, Number(p.qty || 0) - Number(p.received || 0));
    const documentCell = p.document?.data
      ? `<button class="action-btn" onclick="showPurchaseDocument('${p.id}')">Show PO</button>`
      : `<span class="muted">No Document</span>`;
    return `
    <tr>
      <td><b>${esc(p.po)}</b><br><small>${esc(p.notes || "")}</small></td>
      <td>${esc(p.vendor)}</td>
      <td>${fmtDate(p.date)}</td>
      <td>${esc(p.item)}</td>
      <td>${esc(p.qty)} ${esc(p.unit || "")}</td>
      <td>${esc(p.received)}</td>
      <td>${pending}</td>
      <td>${money(p.amount)}</td>
      <td>${documentCell}</td>
      <td>${badge(p.status)}</td>
      <td class="actions">
        <button class="action-btn" onclick="receivePurchase('${p.id}')">Receive</button>
        <button class="action-btn" onclick="editPurchase('${p.id}')">Edit</button>
        <button class="action-btn delete" onclick="deleteRecord('purchases','${p.id}')">Delete</button>
      </td>
    </tr>`;
  }).join("") : emptyRow(11);
}

function openPurchaseModal(item = null) {
  editing = item ? {type:"purchases",id:item.id} : null;
  const existingDocument = item?.document;
  showModal(item ? "Edit Purchase Order" : "Create Purchase Order", `
    <form id="recordForm">
      <div class="form-grid">
        ${field("Record ID","id",item?.id || generatePurchaseId(),"text",true)}
        ${field("PO Number","po",item?.po || uid("PO"),"text",true)}
        ${field("PO Date","date",item?.date || new Date().toISOString().slice(0,10),"date",true)}
        ${field("Vendor Name","vendor",item?.vendor,"text",true)}
        ${field("Material / Equipment","item",item?.item,"text",true)}
        ${field("Quantity Ordered","qty",item?.qty,"number",true)}
        ${field("Quantity Received","received",item?.received || 0,"number")}
        ${field("Unit","unit",item?.unit || "Nos","text")}
        ${field("Total Amount (₹)","amount",item?.amount,"number")}
        ${selectField("Status","status",["Ordered","Partially Received","Received","Cancelled"],item?.status || "Ordered")}
        ${field("Invoice / Delivery Reference","invoice",item?.invoice,"text")}
        ${field("PO Document Reference / Filename","poDoc",item?.poDoc,"text")}
        ${field("Notes","notes",item?.notes,"text")}
      </div>

      <div class="form-group full pdf-upload-group">
        <label for="poPdf">Upload Purchase Order PDF (Maximum 2 MB)</label>
        <input id="poPdf" name="poPdf" type="file" accept="application/pdf,.pdf">
        <small class="muted">Only PDF files are allowed. The document is saved in this browser.</small>
        ${existingDocument?.name ? `
          <div class="existing-pdf">
            <span>Current document: <b>${esc(existingDocument.name)}</b></span>
            <label class="remove-pdf-label">
              <input type="checkbox" id="removePurchaseDocument" name="removePurchaseDocument">
              Remove current document
            </label>
          </div>` : `<div class="muted existing-pdf">No PDF attached currently.</div>`}
      </div>

      <div class="modal-footer">
        <button type="button" class="btn btn-light" onclick="closeModal()">Cancel</button>
        <button class="btn btn-primary">Save Purchase</button>
      </div>
    </form>
  `);

  document.getElementById("recordForm").onsubmit = async e => {
    e.preventDefault();
    const form = e.target;
    const d = formData(form);
    const fileInput = form.querySelector("#poPdf");
    const file = fileInput?.files?.[0] || null;
    const removeDocument = !!form.querySelector("#removePurchaseDocument")?.checked;

    if (file) {
      const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
      if (!isPdf) return toast("Please select a valid PDF file");
      if (file.size > 2 * 1024 * 1024) return toast("PDF file must be 2 MB or smaller");
      try {
        d.document = {
          name: file.name,
          type: "application/pdf",
          size: file.size,
          data: await readFileAsDataURL(file)
        };
      } catch (error) {
        return toast("Unable to read PDF file. Please try again.");
      }
    } else if (removeDocument) {
      d.document = null;
    } else if (item?.document) {
      d.document = item.document;
    } else {
      d.document = null;
    }

    delete d.poPdf;
    delete d.removePurchaseDocument;

    d.qty = Number(d.qty || 0);
    d.received = Number(d.received || 0);
    d.amount = Number(d.amount || 0);
    d.pending = Math.max(0, d.qty - d.received);
    if (d.received >= d.qty && d.qty > 0) d.status = "Received";
    else if (d.received > 0 && d.received < d.qty) d.status = "Partially Received";

    const previousItem = item ? {...item} : null;
    if (item) Object.assign(item,d);
    else db.purchases.push(d);

    const saved = saveDB();
    if (!saved) {
      if (item) Object.assign(item, previousItem);
      else db.purchases.pop();
      return;
    }
    closeModal();
    toast("Purchase order saved");
  };
}

function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error || new Error("File read failed"));
    reader.readAsDataURL(file);
  });
}

function showPurchaseDocument(id) {
  const purchase = db.purchases.find(p => p.id === id);
  const doc = purchase?.document;
  if (!doc?.data || !String(doc.data).startsWith("data:application/pdf;base64,")) {
    return toast("PDF document is not available");
  }

  const safeName = esc(doc.name || "Purchase-Order.pdf");
  showModal("Purchase Order Document", `
    <div class="pdf-preview-toolbar">
      <div><b>${safeName}</b><br><small class="muted">PO: ${esc(purchase.po || "-")}</small></div>
      <a class="btn btn-primary" href="${doc.data}" download="${safeName}">⬇ Download PDF</a>
    </div>
    <iframe class="pdf-preview-frame" src="${doc.data}" title="Purchase Order PDF Preview"></iframe>
  `);
}

function editPurchase(id) {
  openPurchaseModal(db.purchases.find(p => p.id === id));
}

function receivePurchase(id) {
  const p = db.purchases.find(x => x.id === id);
  if (!p) return;
  const remaining = Math.max(0, Number(p.qty) - Number(p.received || 0));
  if (!remaining) return toast("All quantity has been received");
  const qty = Number(prompt("Enter quantity received now. Pending: " + remaining, remaining));
  if (!qty || qty <= 0 || qty > remaining) return toast("Invalid quantity");
  p.received = Number(p.received || 0) + qty;
  p.status = p.received >= p.qty ? "Received" : "Partially Received";

  // Automatically update inventory for this material
  let stock = db.inventory.find(x => x.name.toLowerCase() === p.item.toLowerCase());
  if (!stock) {
    stock = {
      id: generateStockId(),
      name:p.item,
      category:"Purchased",
      location:"ATMS",
      received:0,
      issued:0,
      unit:p.unit || "Nos",
      min:0
    };
    db.inventory.push(stock);
  }
  stock.received = Number(stock.received || 0) + qty;
  stock.location = p.location || stock.location;
  saveDB();
  toast("Material received and inventory updated");
}

/* INVENTORY */

function renderInventory() {
  const search = (document.getElementById("stockSearch")?.value || "").toLowerCase();
  const list = db.inventory.filter(x =>
    [x.name,x.category,x.location].join(" ").toLowerCase().includes(search)
  );

  document.getElementById("inventoryTable").innerHTML = list.length ? list.map(x => {
    const balance = Number(x.received || 0) - Number(x.issued || 0);
    const status = balance <= 0 ? "Out of Stock" : balance <= Number(x.min || 0) ? "Low Stock" : "In Stock";
    return `
    <tr>
      <td><b>${esc(x.name)}</b></td>
      <td>${esc(x.category || "-")}</td>
      <td>${esc(x.location || "-")}</td>
      <td>${esc(x.received || 0)}</td>
      <td>${esc(x.issued || 0)}</td>
      <td><b>${balance}</b></td>
      <td>${esc(x.unit || "Nos")}</td>
      <td>${esc(x.min || 0)}</td>
      <td>${badge(status)}</td>
      <td class="actions">
        <button class="action-btn" onclick="issueStock('${x.id}')">Issue</button>
        <button class="action-btn" onclick="editStock('${x.id}')">Edit</button>
        <button class="action-btn delete" onclick="deleteRecord('inventory','${x.id}')">Delete</button>
      </td>
    </tr>`;
  }).join("") : emptyRow(10);
}

function openStockModal(item = null) {
  editing = item ? {type:"inventory",id:item.id} : null;
  showModal(item ? "Edit Stock Item" : "Add Stock Item", `
    <form id="recordForm">
      <div class="form-grid">
        ${field("Stock ID","id",item?.id || generateStockId(),"text",true)}
        ${field("Material Name","name",item?.name,"text",true)}
        ${field("Category","category",item?.category,"text")}
        ${selectField("Plaza / Location","location",["Varwade","Sawaleshwar","ATMS"],item?.location || "ATMS")}
        ${field("Total Received","received",item?.received || 0,"number",true)}
        ${field("Total Issued","issued",item?.issued || 0,"number")}
        ${field("Unit","unit",item?.unit || "Nos","text")}
        ${field("Minimum Stock Alert","min",item?.min || 0,"number")}
        ${field("Remarks","remarks",item?.remarks,"text")}
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-light" onclick="closeModal()">Cancel</button>
        <button class="btn btn-primary">Save Stock</button>
      </div>
    </form>
  `);
  document.getElementById("recordForm").onsubmit = e => {
    e.preventDefault();
    const d = formData(e.target);
    d.received = Number(d.received || 0);
    d.issued = Number(d.issued || 0);
    d.min = Number(d.min || 0);
    if (item) Object.assign(item,d);
    else db.inventory.push(d);
    closeModal(); saveDB(); toast("Stock saved");
  };
}

function editStock(id) {
  openStockModal(db.inventory.find(x => x.id === id));
}

function issueStock(id) {
  const x = db.inventory.find(s => s.id === id);
  if (!x) return;
  const balance = Number(x.received || 0) - Number(x.issued || 0);
  const qty = Number(prompt("Available: " + balance + "\nEnter quantity to issue:"));
  if (!qty || qty <= 0 || qty > balance) return toast("Invalid quantity");
  x.issued = Number(x.issued || 0) + qty;
  saveDB(); toast("Stock issued successfully");
}

/* AMC */

function renderAmc() {
  const search = (document.getElementById("amcSearch")?.value || "").toLowerCase();
  const list = db.amc.filter(a =>
    [a.id,a.contract,a.scope,a.vendor].join(" ").toLowerCase().includes(search)
  );

  document.getElementById("amcTable").innerHTML = list.length ? list.map(a => {
    const end = a.end ? new Date(a.end + "T00:00:00") : null;
    const today = new Date();
    today.setHours(0,0,0,0);
    const days = end ? Math.ceil((end-today)/86400000) : null;
    const status = days === null ? "Unknown" : days < 0 ? "Expired" : days <= 30 ? "Expiring" : "Active";
    return `
    <tr>
      <td><b>${esc(a.contract || a.id)}</b></td>
      <td>${esc(a.scope)}</td>
      <td>${esc(a.vendor)}</td>
      <td>${fmtDate(a.start)}</td>
      <td>${fmtDate(a.end)}</td>
      <td>${money(a.value)}</td>
      <td>${days === null ? "-" : days}</td>
      <td>${badge(status)}</td>
      <td class="actions">
        <button class="action-btn" onclick="editAmc('${a.id}')">Edit</button>
        <button class="action-btn delete" onclick="deleteRecord('amc','${a.id}')">Delete</button>
      </td>
    </tr>`;
  }).join("") : emptyRow(9);
}

function openAmcModal(item = null) {
  editing = item ? {type:"amc",id:item.id} : null;
  showModal(item ? "Edit AMC / Warranty" : "Add AMC / Warranty", `
    <form id="recordForm">
      <div class="form-grid">
        ${field("Record ID","id",item?.id || generateAmcId(),"text",true)}
        ${field("Contract / AMC Number","contract",item?.contract,"text",true)}
        ${field("Equipment / Scope","scope",item?.scope,"text",true)}
        ${field("Vendor","vendor",item?.vendor,"text",true)}
        ${field("Start Date","start",item?.start,"date",true)}
        ${field("End Date","end",item?.end,"date",true)}
        ${field("Contract Value (₹)","value",item?.value,"number")}
        ${field("Service Frequency","frequency",item?.frequency,"text")}
        ${field("Last Service Date","lastService",item?.lastService,"date")}
        ${field("Next Service Date","nextService",item?.nextService,"date")}
        ${field("Contract Document / Filename","document",item?.document,"text")}
        ${field("Remarks","remarks",item?.remarks,"text")}
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-light" onclick="closeModal()">Cancel</button>
        <button class="btn btn-primary">Save AMC</button>
      </div>
    </form>
  `);
  document.getElementById("recordForm").onsubmit = e => {
    e.preventDefault();
    const d = formData(e.target);
    d.value = Number(d.value || 0);
    if (item) Object.assign(item,d);
    else db.amc.push(d);
    closeModal(); saveDB(); toast("AMC saved");
  };
}

function editAmc(id) {
  openAmcModal(db.amc.find(x => x.id === id));
}

/* REPORTS */

function renderReports() {
  document.getElementById("reportTotal").textContent = db.equipment.length;
  document.getElementById("reportFaults").textContent = db.faults.length;
  document.getElementById("reportPO").textContent = db.purchases.length;
  document.getElementById("reportAMC").textContent = db.amc.length;
}

/* CSV EXPORT */

function exportCSV(type) {
  const rows = db[type] || [];
  if (!rows.length) return toast("No records to export");
  const exportRows = type === "purchases"
    ? rows.map(row => {
        const copy = {...row};
        copy.documentName = row.document?.name || "";
        delete copy.document;
        return copy;
      })
    : rows;
  const headers = [...new Set(exportRows.flatMap(x => Object.keys(x)))];
  const csv = [
    headers.join(","),
    ...exportRows.map(row => headers.map(h => {
      const val = String(row[h] ?? "").replace(/"/g,'""');
      return `"${val}"`;
    }).join(","))
  ].join("\r\n");

  const blob = new Blob(["\uFEFF" + csv], {type:"text/csv;charset=utf-8"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = type + "-report-" + new Date().toISOString().slice(0,10) + ".csv";
  a.click();
  URL.revokeObjectURL(url);
  toast("CSV report downloaded");
}

/* BACKUP / RESTORE */

function backupData() {
  const payload = {
    application:"ATMS-TMS Maintenance ERP",
    version:1,
    exportDate:new Date().toISOString(),
    data:db
  };
  const blob = new Blob([JSON.stringify(payload,null,2)], {type:"application/json"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "ATMS-TMS-Backup-" + new Date().toISOString().slice(0,10) + ".json";
  a.click();
  URL.revokeObjectURL(url);
  toast("Backup downloaded");
}

function restoreData() {
  const input = document.getElementById("restoreFile");
  const file = input.files[0];
  if (!file) return toast("Please select a backup file");

  const reader = new FileReader();
  reader.onload = () => {
    try {
      const payload = JSON.parse(reader.result);
      const restored = payload.data || payload;
      const keys = ["equipment","faults","vendors","purchases","inventory","amc"];
      if (!keys.every(k => Array.isArray(restored[k]))) {
        throw new Error("Invalid backup structure");
      }
      if (!confirm("This will replace all current records. Continue?")) return;
      db = restored;
      saveDB();
      toast("Backup restored successfully");
    } catch (err) {
      alert("Restore failed: " + err.message);
    }
  };
  reader.readAsText(file);
}

function resetData() {
  if (!confirm("Delete ALL data from this browser?")) return;
  if (!confirm("This cannot be undone. Continue?")) return;
  db = structuredClone(defaults);
  saveDB();
  toast("All records have been reset");
}

/* DELETE */

function deleteRecord(type,id) {
  if (!confirm("Delete this record permanently?")) return;
  db[type] = db[type].filter(x => x.id !== id);
  saveDB();
  toast("Record deleted");
}

/* MODAL / FORM HELPERS */

function field(label,name,value="",type="text",required=false) {
  const id = "f_" + name;
  return `
    <div class="form-group">
      <label for="${id}">${esc(label)}${required ? " *" : ""}</label>
      <input id="${id}" name="${name}" type="${type}" value="${esc(value)}" ${required ? "required" : ""} ${type === "number" ? 'min="0" step="any"' : ""}>
    </div>`;
}

function selectField(label,name,options,value) {
  const id = "f_" + name;
  return `
    <div class="form-group">
      <label for="${id}">${esc(label)}</label>
      <select id="${id}" name="${name}">
        ${options.map(o => `<option ${o === value ? "selected" : ""} value="${esc(o)}">${esc(o)}</option>`).join("")}
      </select>
    </div>`;
}

function formData(form) {
  const result = {};
  new FormData(form).forEach((value,key) => result[key] = value);
  return result;
}

function showModal(title,body) {
  document.getElementById("modalTitle").textContent = title;
  document.getElementById("modalBody").innerHTML = body;
  document.getElementById("modalOverlay").classList.add("show");
}

function closeModal() {
  document.getElementById("modalOverlay").classList.remove("show");
}

function overlayClose(e) {
  if (e.target.id === "modalOverlay") closeModal();
}

/* INITIAL STARTUP */

renderAll();
navigate("dashboard");