import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import MapGoogleFull from "./MapGoogleFull.jsx";
import "leaflet/dist/leaflet.css";
import "./index.css";

const Root = window.location.pathname.startsWith("/gmaps")
  ? MapGoogleFull
  : App;

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
);
