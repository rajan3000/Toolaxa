
export function vendorPurchaseTotal(vendorName, purchases) {
    return purchases
        .filter(p => p.vendor === vendorName)
        .reduce((total, p) => total + Number(p.total || 0), 0);
}

export function vendorPurchaseCount(vendorName, purchases) {
    return purchases.filter(p => p.vendor === vendorName).length;
}
