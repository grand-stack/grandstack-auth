import { Link, NavLink, Route, Routes } from "react-router";
import { useAuth } from "./auth/AuthProvider";
import { Button } from "./ui";
import { Callback } from "./pages/Callback";
import { MovieDetail } from "./pages/MovieDetail";
import { Movies } from "./pages/Movies";
import { Playground } from "./pages/Playground";

function Header() {
  const { identity, loading, login, logout } = useAuth();
  return (
    <header className="site-header">
      <Link to="/" className="brand"><span className="brand-mark" aria-hidden="true" />GRANDstack <strong>auth demo</strong></Link>
      <nav aria-label="Main">
        <NavLink to="/" end>Movies</NavLink>
        <NavLink to="/playground">Permissions playground</NavLink>
      </nav>
      <div className="who" aria-live="polite">
        {loading ? null : identity ? (
          <>
            <span className="who-name" data-testid="who-name">{identity.name}</span>
            <span className="who-roles">{identity.roles.filter((r) => ["user", "editor", "moderator"].includes(r)).map((r) => <span key={r} className="role-badge role-actor">{r}</span>)}</span>
            <Button onClick={() => void logout()}>Log out</Button>
          </>
        ) : (
          <Button variant="primary" onClick={() => void login()}>Log in</Button>
        )}
      </div>
    </header>
  );
}

export function App() {
  return (
    <>
      <Header />
      <main>
        <p className="banner" role="note">
          Demo client for the GRANDstack auth setup. Anyone can read; logging in lets you review movies; editors and moderators can do more. Development only.
        </p>
        <Routes>
          <Route path="/" element={<Movies />} />
          <Route path="/movies/:title" element={<MovieDetail />} />
          <Route path="/playground" element={<Playground />} />
          <Route path="/callback" element={<Callback />} />
          <Route path="*" element={<div className="empty"><h2>Page not found</h2><Link to="/">Go home</Link></div>} />
        </Routes>
      </main>
    </>
  );
}
