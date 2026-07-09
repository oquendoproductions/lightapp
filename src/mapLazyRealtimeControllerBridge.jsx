import React, { memo } from "react";
import MapLazyRealtimeController from "./mapLazyRealtimeController.jsx";

export default memo(function MapLazyRealtimeControllerBridge(props) {
  return <MapLazyRealtimeController {...props} />;
});
