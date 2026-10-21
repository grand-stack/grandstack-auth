import { useState, type FormEvent } from "react";
import { Link, useParams } from "react-router";
import { useMutation, useQuery } from "urql";
import { can, isModerator } from "../auth/claims";
import { useAuth } from "../auth/AuthProvider";
import { graphql } from "../graphql/generated";
import { describeError, validateReview } from "../lib/errors";
import { Poster } from "../poster/Poster";
import { Avatar } from "../ui/Avatar";
import { Button, RatingBadge, Skeleton } from "../ui";

const MovieQuery = graphql(`
  query DemoMovie($title: String!) {
    movies(where: { title: { eq: $title } }) {
      title
      released
      rating
      tagline
      genres { name }
      reviews(sort: [{ createdAt: DESC }]) {
        id
        rating
        text
        createdAt
        author { sub name }
      }
    }
  }
`);

const CreateReview = graphql(`
  mutation DemoCreateReview($movie: String!, $rating: Int!, $text: String) {
    createReview(movie: $movie, rating: $rating, text: $text) { id }
  }
`);
const UpdateReview = graphql(`
  mutation DemoUpdateReview($id: ID!, $text: String, $rating: Int) {
    updateReviews(where: { id: { eq: $id } }, update: { text: { set: $text }, rating: { set: $rating } }) { reviews { id } }
  }
`);
const DeleteReview = graphql(`
  mutation DemoDeleteReview($id: ID!) {
    deleteReviews(where: { id: { eq: $id } }) { nodesDeleted }
  }
`);

export function MovieDetail() {
  const { title = "" } = useParams();
  const { identity } = useAuth();
  const [{ data, fetching, error }, refetch] = useQuery({ query: MovieQuery, variables: { title } });
  const [{ fetching: creating, error: createError }, createReview] = useMutation(CreateReview);
  const [{ error: updateError }, updateReview] = useMutation(UpdateReview);
  const [{ error: deleteError }, deleteReview] = useMutation(DeleteReview);
  const [rating, setRating] = useState("8");
  const [text, setText] = useState("");
  const [formError, setFormError] = useState<string>();
  const [editing, setEditing] = useState<string>();
  const [editRating, setEditRating] = useState("");
  const [editText, setEditText] = useState("");
  const movie = data?.movies[0];
  const reload = () => refetch({ requestPolicy: "network-only" });

  if (fetching && !data) return <Skeleton className="skeleton-hero" />;
  if (error) return <p className="error">{describeError(error)}</p>;
  if (!movie) return <div className="empty"><h2>Movie not found</h2><Link to="/">Back to movies</Link></div>;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const problem = validateReview(rating, text);
    setFormError(problem);
    if (problem) return;
    const result = await createReview({ movie: movie.title, rating: Number(rating), text: text || null });
    if (!result.error) { setText(""); reload(); }
  };
  const save = async (id: string) => {
    const problem = validateReview(editRating, editText);
    if (problem) { setFormError(problem); return; }
    setFormError(undefined);
    const result = await updateReview({ id, text: editText, rating: Number(editRating) });
    if (!result.error) { setEditing(undefined); reload(); }
  };

  const message = describeError(createError ?? updateError ?? deleteError) ?? formError;

  return (
    <article className="detail">
      <Link to="/" className="back">← Back to movies</Link>
      <div className="detail-hero">
        <Poster title={movie.title} year={movie.released} genre={movie.genres[0]?.name} size="lg" />
        <div className="detail-info">
          <h1>{movie.title}</h1>
          <p className="detail-facts"><RatingBadge rating={movie.rating} />{movie.released}</p>
          {movie.tagline && <p className="tagline">{movie.tagline}</p>}
        </div>
      </div>

      <section>
        <h2>Reviews ({movie.reviews.length})</h2>
        {message && <p className="error" role="alert">{message}</p>}

        {can(identity, "reviews:write") ? (
          <form className="form review-form" onSubmit={submit} noValidate>
            <h3>Write a review as {identity?.name}</h3>
            <div className="form-row">
              <label>Rating (1-10)
                <select value={rating} onChange={(e) => setRating(e.target.value)} aria-label="Rating">
                  {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => <option key={n}>{n}</option>)}
                </select>
              </label>
            </div>
            <label>Your review
              <textarea className="text-input" rows={3} value={text} onChange={(e) => setText(e.target.value)} aria-label="Review text" />
            </label>
            <div className="form-actions"><Button variant="primary" type="submit" disabled={creating}>{creating ? "Posting…" : "Post review"}</Button></div>
          </form>
        ) : (
          <p className="muted">{identity ? "Your role cannot write reviews." : "Log in to write a review."}</p>
        )}

        <ul className="plain reviews">
          {movie.reviews.map((r) => {
            const mine = identity?.sub !== undefined && r.author?.sub === identity.sub;
            return (
              <li key={r.id} className="review" data-testid="review">
                <Avatar name={r.author?.name ?? "?"} size="md" />
                <div>
                  <p className="review-head"><strong>{r.author?.name ?? "Unknown"}</strong> <RatingBadge rating={r.rating} /> <span className="muted">{new Date(r.createdAt).toLocaleDateString()}</span></p>
                  {editing === r.id ? (
                    <div className="form">
                      <label>Rating <select value={editRating} onChange={(e) => setEditRating(e.target.value)} aria-label="Edit rating">{Array.from({ length: 10 }, (_, i) => i + 1).map((n) => <option key={n}>{n}</option>)}</select></label>
                      <textarea className="text-input" rows={3} value={editText} onChange={(e) => setEditText(e.target.value)} aria-label="Edit review text" />
                      <div className="form-actions"><Button variant="primary" onClick={() => void save(r.id)}>Save</Button><Button onClick={() => setEditing(undefined)}>Cancel</Button></div>
                    </div>
                  ) : (
                    <>
                      {r.text && <p>{r.text}</p>}
                      <div className="form-actions">
                        {mine && <Button onClick={() => { setEditing(r.id); setEditRating(String(r.rating)); setEditText(r.text ?? ""); }}>Edit</Button>}
                        {(mine || isModerator(identity)) && (
                          <Button variant="danger" onClick={async () => { const res = await deleteReview({ id: r.id }); if (!res.error) reload(); }}>{mine ? "Delete" : "Delete (moderator)"}</Button>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </li>
            );
          })}
          {movie.reviews.length === 0 && <li className="muted">No reviews yet.</li>}
        </ul>
      </section>
    </article>
  );
}
