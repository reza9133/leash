import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource-variable/archivo/wdth.css";
import "@fontsource-variable/martian-mono";
import "./styles/tokens.css";
import "./styles/base.css";
import "./styles/ui.css";
import "./styles/visuals.css";
import "./styles/layout.css";
import "./styles/pages.css";
import "./styles/scene.css";
import "./styles/docs.css";
import App from "./App";
import { initTheme } from "./lib/theme";
import { initWallet } from "./lib/wallet/wallet";
import { resumePending } from "./lib/tx";

initTheme();
initWallet();
resumePending();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
