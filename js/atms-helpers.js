
export function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    }[char]));
}

export function formatMoney(amount) {
    return "₹" + (Number(amount) || 0).toLocaleString("en-IN", {
        maximumFractionDigits: 2
    });
}

export function percent(completed, total) {
    if (!Number(total)) return 0;
    return Math.min(100, Math.round((completed / total) * 100));
}

export function formatDuration(ms) {
    const hours = Math.floor(ms / 3600000);
    const days = Math.floor(hours / 24);

    if (days > 0) {
        return `${days}d ${hours % 24}h`;
    }

    return `${hours}h ${Math.floor(ms / 60000) % 60}m`;
}

export function getDowntime(start, end) {
    if (!start) return "—";

    const from = new Date(start).getTime();
    const to = end ? new Date(end).getTime() : Date.now();

    if (isNaN(from) || to < from) return "—";

    return formatDuration(to - from);
}

export function getBadge(status) {
    let cls = "gray";

    if (/complete|commissioned|accepted|resolved|closed|pass|received/i.test(status))
        cls = "green";
    else if (/fault|fail|open|reject|cancel/i.test(status))
        cls = "red";
    else if (/progress|repair|testing|observation|issued|partial/i.test(status))
        cls = "orange";
    else
        cls = "blue";

    return `<span class="pill ${cls}">${escapeHTML(status || "Pending")}</span>`;
}

export function showToast(message) {
    const toast = document.getElementById("toast");

    toast.textContent = message;
    toast.style.display = "block";

    setTimeout(() => {
        toast.style.display = "none";
    }, 2500);
}

export function downloadFile(content, filename, type = "text/plain") {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();

    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function csvEscape(value) {
    return '"' + String(value ?? "").replace(/"/g, '""') + '"';
}

export function exportCSV(rows, columns, filename) {
    if (!rows.length) {
        showToast("No records available to export");
        return;
    }

    const header = columns.map(c => csvEscape(c.label)).join(",");

    const body = rows.map(row =>
        columns.map(c => csvEscape(row[c.key])).join(",")
    );

    downloadFile(
        [header, ...body].join("\n"),
        filename,
        "text/csv;charset=utf-8"
    );
}

export function makeID() {
    return Date.now() + Math.floor(Math.random() * 10000);
}
