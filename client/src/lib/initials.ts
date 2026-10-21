/** Up to two capital letters for an avatar: first and last word of the name, ignoring Jr., Sr., II and III. */
export function initials(name: string): string {
  const parts = name.replace(/[.,]/g, "").split(/\s+/).filter((w) => w && !/^(jr|sr|ii|iii)$/i.test(w));
  if (parts.length === 0) return "?";
  const first = parts[0][0];
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase();
}
