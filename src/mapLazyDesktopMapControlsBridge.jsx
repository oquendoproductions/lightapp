import React, { memo } from "react";
import MapLazyDesktopMapControls from "./mapLazyDesktopMapControls.jsx";

export default memo(function MapLazyDesktopMapControlsBridge(props) {
  return <MapLazyDesktopMapControls {...props} />;
});
