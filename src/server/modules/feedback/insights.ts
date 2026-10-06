import { listFeedback, type Feedback } from "./store";

export type Category = "Food" | "Service" | "Ordering experience";
const LOW = 2; // a rating <= 2 counts as a complaint

const overall = (f: Feedback) => (f.foodRating + f.serviceRating + f.orderingRating) / 3;
const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

export function getFeedbackInsights() {
  const all = listFeedback().sort((a, b) => b.submittedAt - a.submittedAt);

  const categories: { name: Category; average: number; lowCount: number }[] = [
    { name: "Food", average: avg(all.map((f) => f.foodRating)), lowCount: all.filter((f) => f.foodRating <= LOW).length },
    { name: "Service", average: avg(all.map((f) => f.serviceRating)), lowCount: all.filter((f) => f.serviceRating <= LOW).length },
    { name: "Ordering experience", average: avg(all.map((f) => f.orderingRating)), lowCount: all.filter((f) => f.orderingRating <= LOW).length },
  ];

  const worst = [...categories].sort((a, b) => b.lowCount - a.lowCount || a.average - b.average)[0];

  return {
    total: all.length,
    averageRating: avg(all.map(overall)),
    categories,
    // Most common problem = category with the most low (<=2 star) ratings.
    mostCommonProblem: worst && worst.lowCount > 0 ? { name: worst.name, count: worst.lowCount } : null,
    complaints: all.filter((f) => Math.min(f.foodRating, f.serviceRating, f.orderingRating) <= LOW),
    recent: all.slice(0, 25),
  };
}
