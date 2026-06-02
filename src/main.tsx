import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import { App } from "./app/App";
import { initPlatform } from "./platform";

void initPlatform();

const rootEl = document.getElementById("root");
if (!rootEl) {
  throw new Error("找不到 #root 容器");
}

createRoot(rootEl).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
