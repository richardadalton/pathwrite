import React, { useState } from "react";
import { StatusBar } from "expo-status-bar";
import { MenuScreen } from "./src/MenuScreen";
import { FormDemo } from "./src/form/FormDemo";
import { FeaturesDemo } from "./src/features/FeaturesDemo";
import { AsyncDemo } from "./src/async/AsyncDemo";

type Screen = "menu" | "form" | "features" | "async";

export default function App() {
  const [screen, setScreen] = useState<Screen>("menu");

  if (screen === "form") {
    return (
      <>
        <StatusBar style="dark" />
        <FormDemo onBack={() => setScreen("menu")} />
      </>
    );
  }

  if (screen === "features") {
    return (
      <>
        <StatusBar style="dark" />
        <FeaturesDemo onBack={() => setScreen("menu")} />
      </>
    );
  }

  if (screen === "async") {
    return (
      <>
        <StatusBar style="dark" />
        <AsyncDemo onBack={() => setScreen("menu")} />
      </>
    );
  }

  return (
    <>
      <StatusBar style="dark" />
      <MenuScreen onSelect={setScreen} />
    </>
  );
}
