"use client";

/**
 * 1-5 star rating input. Uncontrolled visually by hover; controlled by
 * value/onChange from the parent form.
 */
export function StarRating({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div>
      <p className="text-sm font-medium text-[var(--tablor-text-primary)]">{label}</p>
      <div className="mt-2 flex gap-1" role="radiogroup" aria-label={label}>
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            role="radio"
            aria-checked={value === star}
            aria-label={`${star} star${star === 1 ? "" : "s"}`}
            onClick={() => onChange(star)}
            className={`text-2xl leading-none transition-colors active:scale-95 ${
              star <= value
                ? "text-[var(--tablor-accent)]"
                : "text-[var(--tablor-border)]"
            }`}
          >
            {star <= value ? "★" : "☆"}
          </button>
        ))}
      </div>
    </div>
  );
}