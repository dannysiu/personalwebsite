import type { Metadata } from "next";
import GameApp from "./game/GameApp";

export const metadata: Metadata = {
  title: "Rift Rotor: Two Worlds, One Flight",
  description:
    "Shift between Solar and Void dimensions in a neon side-scrolling flight game.",
};

export default function Home() {
  return <GameApp />;
}
