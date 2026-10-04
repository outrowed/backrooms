import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { RoomStateProvider } from "./state/RoomState";
import "./index.css";
import "./styles/flicker.css";

const root = document.getElementById("root");

if (!root) throw new Error("Missing root element");

createRoot(root).render(
    <React.StrictMode>
        <RoomStateProvider><App /></RoomStateProvider>
    </React.StrictMode>,
);
