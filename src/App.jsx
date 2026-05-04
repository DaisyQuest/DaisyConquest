/* App — top-level component, screen router. */
import { useStore } from "./core/store.jsx";
import { GoldBar } from "./components/GoldBar.jsx";
import { TweaksPanel } from "./components/TweaksPanel.jsx";

import { MainMenu } from "./screens/MainMenu.jsx";
import { WorldMap } from "./screens/WorldMap.jsx";
import { LocalZone } from "./screens/LocalZone.jsx";
import { Recruit } from "./screens/Recruit.jsx";
import { Upgrade } from "./screens/Upgrade.jsx";
import { Shop } from "./screens/Shop.jsx";
import { BattleScreen } from "./screens/Battle.jsx";
import { DefenseScreen } from "./screens/Defense.jsx";
import { EncounterScreen } from "./screens/Encounter.jsx";
import { RoundSummaryScreen } from "./screens/RoundSummary.jsx";
import { CoopLobby } from "./screens/CoopLobby.jsx";
import { VictoryScreen } from "./screens/Victory.jsx";
import { Handoff } from "./screens/Handoff.jsx";

const SCREENS = {
  main:      MainMenu,
  map:       WorldMap,
  zone:      LocalZone,
  recruit:   Recruit,
  upgrade:   Upgrade,
  shop:      Shop,
  battle:    BattleScreen,
  defense:   DefenseScreen,
  encounter: EncounterScreen,
  summary:   RoundSummaryScreen,
  coop:      CoopLobby,
  victory:   VictoryScreen,
  handoff:   Handoff,
};

const SCREENS_WITHOUT_TOPBAR = new Set([
  "main", "battle", "defense", "encounter", "summary", "coop", "victory", "handoff",
]);

export function App() {
  const { state } = useStore();
  const screen = state.screen;
  const Component = SCREENS[screen];
  const showTopBar = !SCREENS_WITHOUT_TOPBAR.has(screen);

  return (
    <div data-screen-label={screen} className="col" style={{ height: "100%" }}>
      {showTopBar && <GoldBar />}
      <div style={{ flex: 1, overflow: "hidden", position: "relative" }}>
        {Component
          ? <Component />
          : <div style={{ padding: 40 }}>Unknown screen: {screen}</div>}
      </div>
      <TweaksPanel />
    </div>
  );
}
