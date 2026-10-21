import "@fontsource-variable/public-sans";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router";
import { Provider } from "urql";
import { App } from "./App";
import { AuthProvider } from "./auth/AuthProvider";
import { client } from "./lib/urqlClient";
import "./theme/tokens.css";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AuthProvider>
      <Provider value={client}>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </Provider>
    </AuthProvider>
  </StrictMode>,
);
