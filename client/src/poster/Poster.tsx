import { hash } from "../lib/hash";

/** Deterministic generated poster art. No images: the look comes from the title and primary genre. */
const GENRE_HUE: Record<string, number> = {
  "Sci-Fi": 205, Action: 12, Drama: 265, Romance: 335, Comedy: 42, Adventure: 150, Crime: 0, Thriller: 225,
  Biography: 28, History: 35, Mystery: 250, Horror: 350, Fantasy: 290, Animation: 175, War: 95, Western: 30,
  Musical: 315, Sport: 120,
};

export function posterStyle(title: string, genre?: string) {
  const h = hash(title);
  const base = (genre ? GENRE_HUE[genre] : undefined) ?? h % 360;
  const hue = (base + (h % 40) - 20 + 360) % 360;
  const angle = 120 + (h % 120);
  const cx = 20 + ((h >> 3) % 60);
  const cy = 10 + ((h >> 9) % 40);
  return {
    background: [
      `radial-gradient(circle at ${cx}% ${cy}%, hsl(${(hue + 30) % 360} 85% 62% / 0.55), transparent 55%)`,
      `linear-gradient(${angle}deg, hsl(${hue} 60% 30%), hsl(${(hue + 40) % 360} 65% 12%))`,
    ].join(", "),
  };
}

interface Props {
  title: string;
  year?: number | null;
  genre?: string;
  size?: "sm" | "md" | "lg";
}

export function Poster({ title, year, genre, size = "md" }: Props) {
  return (
    <div className={`poster poster-${size}`} style={posterStyle(title, genre)} role="img" aria-label={`Poster for ${title}`}>
      <span className="poster-genre">{genre ?? ""}</span>
      <span className="poster-title">{title}</span>
      {year ? <span className="poster-year">{year}</span> : null}
    </div>
  );
}
