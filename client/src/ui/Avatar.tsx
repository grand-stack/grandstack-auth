// Copyright (c) "Neo4j"
// Neo4j Sweden AB [http://neo4j.com]
import { hash } from "../lib/hash";
import { initials } from "../lib/initials";

/** Deterministic initials avatar, generated from the name. */
export function Avatar({ name, size = "md" }: { name: string; size?: "sm" | "md" | "lg" | "xl" }) {
  const h = hash(name);
  const hue = h % 360;
  return (
    <span
      className={`avatar avatar-${size}`}
      style={{ background: `linear-gradient(135deg, hsl(${hue} 60% 38%), hsl(${(hue + 50) % 360} 65% 22%))` }}
      role="img"
      aria-label={name}
    >
      {initials(name)}
    </span>
  );
}
