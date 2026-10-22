// Copyright (c) "Neo4j"
// Neo4j Sweden AB [http://neo4j.com]
import type { ButtonHTMLAttributes, ReactNode } from "react";

export function Button({ variant = "secondary", className = "", ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "ghost" | "danger" }) {
  return <button className={`btn btn-${variant} ${className}`} {...rest} />;
}

export function Chip({ children, onRemove, onClick, active }: { children: ReactNode; onRemove?: () => void; onClick?: () => void; active?: boolean }) {
  if (onClick) {
    return <button type="button" className={`chip chip-button${active ? " chip-active" : ""}`} onClick={onClick} aria-pressed={active}>{children}</button>;
  }
  return (
    <span className="chip">
      {children}
      {onRemove && <button type="button" className="chip-x" onClick={onRemove} aria-label={`Remove ${typeof children === "string" ? children : "filter"}`}>×</button>}
    </span>
  );
}

export function RatingBadge({ rating }: { rating?: number | null }) {
  if (rating == null) return null;
  const tone = rating >= 8.5 ? "great" : rating >= 7.5 ? "good" : "ok";
  return <span className={`rating rating-${tone}`} title="Audience rating, sample data">★ {rating.toFixed(1)}</span>;
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`skeleton ${className}`} aria-hidden="true" />;
}

export function Checkbox({ label, count, checked, onChange, disabled }: { label: string; count?: number; checked: boolean; onChange: () => void; disabled?: boolean }) {
  return (
    <label className={`check${disabled ? " check-disabled" : ""}`}>
      <input type="checkbox" checked={checked} onChange={onChange} disabled={disabled} />
      <span className="check-label">{label}</span>
      {count !== undefined && <span className="check-count">{count}</span>}
    </label>
  );
}
