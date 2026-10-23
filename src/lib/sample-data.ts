import Papa from "papaparse";
import type { Plan } from "./engine/schemas";

export interface SampleOrder extends Record<string, string> {
  order_id: string;
  date: string;
  outlet: string;
  channel: string;
  item: string;
  category: string;
  qty: string;
  amount_inr: string;
  payment: string;
  customer_name: string;
  customer_phone: string;
}

const OUTLETS = ["Baner", "Koregaon Park", "Viman Nagar"];

const MENU = [
  { item: "Paneer Butter Masala", category: "Main", price: 280 },
  { item: "Chicken Biryani", category: "Main", price: 320 },
  { item: "Veg Biryani", category: "Main", price: 260 },
  { item: "Dal Makhani", category: "Main", price: 240 },
  { item: "Chicken Tikka", category: "Starter", price: 300 },
  { item: "Hara Bhara Kebab", category: "Starter", price: 220 },
  { item: "Butter Naan", category: "Bread", price: 60 },
  { item: "Garlic Naan", category: "Bread", price: 70 },
  { item: "Mango Lassi", category: "Beverage", price: 110 },
  { item: "Masala Chaas", category: "Beverage", price: 70 },
  { item: "Gulab Jamun", category: "Dessert", price: 90 },
];

const CUSTOMER_NAMES = [
  "Aarav Kulkarni",
  "Sneha Deshpande",
  "Rohan Joshi",
  "Priya Iyer",
  "Imran Shaikh",
  "Ananya Patil",
  "Vikram Rao",
  "Neha Gupta",
  "Siddharth Menon",
  "Pooja Jadhav",
  "Arjun Nair",
  "Fatima Khan",
  "Karan Mehta",
  "Ishita Bose",
  "Rahul Pawar",
  "Meera Pillai",
  "Aditya Chavan",
  "Zoya Mirza",
  "Nikhil Bhosale",
  "Kavya Reddy",
];

function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function generateSampleOrders(): SampleOrder[] {
  const rand = mulberry32(20261023);

  const getChannel = (): string => {
    const r = rand();
    if (r < 0.35) return "Dine-in";
    if (r < 0.65) return "Swiggy";
    if (r < 0.9) return "Zomato";
    return "Takeaway";
  };

  const getPayment = (): string => {
    const r = rand();
    if (r < 0.6) return "UPI";
    if (r < 0.85) return "Card";
    return "Cash";
  };

  const getQty = (): number => {
    const r = rand();
    if (r < 0.5) return 1;
    if (r < 0.8) return 2;
    if (r < 0.95) return 3;
    return 4;
  };

  const getPhone = (): string => {
    const d = () => Math.floor(rand() * 10);
    return `+91 98${d()}${d()}${d()} ${d()}${d()}${d()}${d()}${d()}`;
  };

  const orders: SampleOrder[] = [];
  let orderNumber = 10001;

  // Dates: Mon 2026-07-06 to Sun 2026-10-04 inclusive (91 days)
  const startDate = new Date(Date.UTC(2026, 6, 6)); // July 6 2026

  for (let dayOffset = 0; dayOffset < 91; dayOffset++) {
    const current = new Date(startDate.getTime() + dayOffset * 86400000);
    const dateStr = current.toISOString().slice(0, 10);
    const dayOfWeek = current.getUTCDay(); // 0 is Sunday, 5 is Friday, 6 is Saturday
    const isFriSun = dayOfWeek === 0 || dayOfWeek === 5 || dayOfWeek === 6;

    const isAnomalyWeek = dateStr >= "2026-08-10" && dateStr <= "2026-08-16";

    const createOrder = (outlet: string): SampleOrder => {
      const menuItem = MENU[Math.floor(rand() * MENU.length)];
      const qty = getQty();
      const amount = qty * menuItem.price;
      const customer = CUSTOMER_NAMES[Math.floor(rand() * CUSTOMER_NAMES.length)];

      const order: SampleOrder = {
        order_id: `SRK-${orderNumber++}`,
        date: dateStr,
        outlet,
        channel: getChannel(),
        item: menuItem.item,
        category: menuItem.category,
        qty: String(qty),
        amount_inr: String(amount),
        payment: getPayment(),
        customer_name: customer,
        customer_phone: getPhone(),
      };
      return order;
    };

    for (const outlet of OUTLETS) {
      if (isAnomalyWeek && outlet === "Viman Nagar") {
        // Viman Nagar has zero orders during anomaly week (kitchen shut)
        continue;
      }

      // Order 1 with probability 0.75
      if (rand() < 0.75) {
        orders.push(createOrder(outlet));
      }

      // Order 2 with probability 0.35 (skipped during anomaly week)
      if (!isAnomalyWeek) {
        if (rand() < 0.35) {
          orders.push(createOrder(outlet));
        }
      }
    }

    // Friday–Sunday: add one extra order for a random outlet
    if (isFriSun) {
      if (isAnomalyWeek) {
        // Only Baner or Koregaon Park can receive it during anomaly week
        const normalOutlets = ["Baner", "Koregaon Park"];
        const chosen = normalOutlets[Math.floor(rand() * normalOutlets.length)];
        orders.push(createOrder(chosen));
      } else {
        const chosen = OUTLETS[Math.floor(rand() * OUTLETS.length)];
        orders.push(createOrder(chosen));
      }
    }
  }

  return orders;
}

export const SAMPLE_CSV: string = Papa.unparse(generateSampleOrders());
export const SAMPLE_FILE_NAME = "spice-route-kitchen-q3-2026.csv";

export const SAMPLE_PLAN: Plan = {
  rationale:
    "Totals, outlet and channel mix, best sellers and the weekly trend answer where the money comes from and when it dipped.",
  steps: [
    {
      id: "revenue_total",
      title: "Total revenue",
      kind: "total",
      agg: "sum",
      column: "amount_inr",
      by: null,
      dateColumn: null,
      interval: null,
      sort: null,
      limit: null,
      filters: [],
    },
    {
      id: "revenue_by_outlet",
      title: "Revenue by outlet",
      kind: "group",
      agg: "sum",
      column: "amount_inr",
      by: "outlet",
      dateColumn: null,
      interval: null,
      sort: "desc",
      limit: 10,
      filters: [],
    },
    {
      id: "revenue_by_channel",
      title: "Revenue by channel",
      kind: "group",
      agg: "sum",
      column: "amount_inr",
      by: "channel",
      dateColumn: null,
      interval: null,
      sort: "desc",
      limit: 10,
      filters: [],
    },
    {
      id: "top_items",
      title: "Top 5 items by quantity",
      kind: "group",
      agg: "sum",
      column: "qty",
      by: "item",
      dateColumn: null,
      interval: null,
      sort: "desc",
      limit: 5,
      filters: [],
    },
    {
      id: "weekly_revenue",
      title: "Weekly revenue",
      kind: "trend",
      agg: "sum",
      column: "amount_inr",
      by: null,
      dateColumn: "date",
      interval: "week",
      sort: null,
      limit: null,
      filters: [],
    },
  ],
};
