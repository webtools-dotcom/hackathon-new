const inrFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

export function formatValue(value: number, column: string | null): string {
  if (column) {
    const lower = column.toLowerCase();
    if (
      lower.includes("amount") ||
      lower.includes("revenue") ||
      lower.includes("price") ||
      lower.includes("total") ||
      lower.includes("sales") ||
      lower.includes("inr")
    ) {
      return inrFormatter.format(value);
    }
  }
  return value.toLocaleString("en-IN");
}
