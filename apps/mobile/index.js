require("react-native-gesture-handler");

const defaultErrorHandler = global.ErrorUtils?.getGlobalHandler?.();

global.ErrorUtils?.setGlobalHandler?.((error, isFatal) => {
  console.error("[StaffTrack] Unhandled JS error", error);

  defaultErrorHandler?.(error, false);
});

const { registerRootComponent } = require("expo");
const App = require("./App").default;

registerRootComponent(App);
