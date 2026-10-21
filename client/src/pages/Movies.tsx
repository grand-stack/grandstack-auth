import { useState } from "react";
import { Link } from "react-router";
import { useQuery } from "urql";
import { graphql } from "../graphql/generated";
import { describeError } from "../lib/errors";
import { Poster } from "../poster/Poster";
import { RatingBadge } from "../ui";

const MoviesQuery = graphql(`
  query DemoMovies($search: String!) {
    movies(where: { title: { contains: $search } }, sort: [{ rating: DESC }], limit: 24) {
      title
      released
      rating
      genres { name }
      reviewsConnection { totalCount }
    }
  }
`);

export function Movies() {
  const [search, setSearch] = useState("");
  const [{ data, fetching, error }] = useQuery({ query: MoviesQuery, variables: { search } });
  return (
    <section>
      <input className="text-input people-search" placeholder="Search by title (case-sensitive)" aria-label="Search movies" value={search} onChange={(e) => setSearch(e.target.value)} />
      {error && <p className="error">{describeError(error)}</p>}
      {fetching && !data && <p>Loading…</p>}
      <div className="grid" style={{ marginTop: 24 }}>
        {data?.movies.map((m) => (
          <article key={m.title} className="card">
            <Link to={`/movies/${encodeURIComponent(m.title)}`} className="card-link" aria-label={m.title}><Poster title={m.title} year={m.released} genre={m.genres[0]?.name} /></Link>
            <div className="card-body">
              <div className="card-head">
                <Link to={`/movies/${encodeURIComponent(m.title)}`} className="card-title">{m.title}</Link>
                <RatingBadge rating={m.rating} />
              </div>
              <p className="card-meta">{m.reviewsConnection.totalCount} {m.reviewsConnection.totalCount === 1 ? "review" : "reviews"}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
