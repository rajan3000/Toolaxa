
export function calculatePurchase(items, gstPercent) {
    const subtotal = items.reduce(
        (sum, item) => sum + Number(item.qty || 0) * Number(item.rate || 0),
        0
    );

    const gstAmount = subtotal * Number(gstPercent || 0) / 100;

    return {
        subtotal,
        gstPercent: Number(gstPercent || 0),
        gstAmount,
        total: subtotal + gstAmount,
        orderedQty: items.reduce((sum, item) => sum + Number(item.qty || 0), 0)
    };
}

export function addMaterialReceipt(purchase, receipt) {
    purchase.receipts = purchase.receipts || [];
    purchase.receipts.push({
        ...receipt,
        date: receipt.date || new Date().toISOString().slice(0, 10)
    });

    purchase.receivedQty = purchase.receipts.reduce(
        (sum, r) => sum + Number(r.quantity || 0),
        0
    );

    if (purchase.receivedQty >= purchase.orderedQty) {
        purchase.status = "Received";
    } else if (purchase.receivedQty > 0) {
        purchase.status = "Partially Received";
    }

    return purchase;
}

export function getPendingQty(purchase) {
    return Math.max(
        0,
        Number(purchase.orderedQty || 0) -
        Number(purchase.receivedQty || 0)
    );
}
