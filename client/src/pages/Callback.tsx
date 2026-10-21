import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { useAuth } from "../auth/AuthProvider";

/** The identity provider redirects here with a code; exchange it, then go back to where the user was. */
export function Callback() {
  const { completeLogin } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState<string>();
  const started = useRef(false); // React StrictMode runs effects twice; the code can be used once
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    completeLogin().then((to) => navigate(to, { replace: true }), (e: Error) => setError(e.message));
  }, [completeLogin, navigate]);
  return error ? <p className="error" role="alert">Login failed: {error}</p> : <p>Signing you in…</p>;
}
