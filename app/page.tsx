"use client";

import { useCallback, useState } from "react";
import Feed from "@/components/Feed";
import Intro from "@/components/Intro";
import PasteForm from "@/components/PasteForm";
import Scanning from "@/components/Scanning";
import type { PastedEmail, ScanResult } from "@/lib/types";

type Stage = "intro" | "paste" | "scanning" | "feed";
type ScanRequest = { source: "sample" } | { source: "real" } | { source: "paste"; email: PastedEmail };

const MIN_WAIT_MS = 600; // plus the count-up animation, the scanning screen lasts at least 2.5 s

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function requestScan(body: ScanRequest): Promise<ScanResult> {
  const response = await fetch("/api/scan", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`Scan failed (${response.status})`);
  return response.json();
}

export default function Home() {
  const [stage, setStage] = useState<Stage>("intro");
  const [result, setResult] = useState<ScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function startScan(body: ScanRequest) {
    setError(null);
    setResult(null);
    setStage("scanning");
    try {
      const [scan] = await Promise.all([requestScan(body), sleep(MIN_WAIT_MS)]);
      setResult(scan);
    } catch {
      setError("The scan could not run just now. Please try again.");
      setStage("intro");
    }
  }

  const showFeed = useCallback(() => setStage("feed"), []);

  if (stage === "paste") {
    return (
      <PasteForm onSubmit={(email) => startScan({ source: "paste", email })} onBack={() => setStage("intro")} />
    );
  }
  if (stage === "scanning") return <Scanning result={result} onDone={showFeed} />;
  if (stage === "feed" && result) return <Feed result={result} onRestart={() => setStage("intro")} />;
  return (
    <Intro
      error={error}
      onScanSample={() => startScan({ source: "sample" })}
      onScanReal={() => startScan({ source: "real" })}
      onPaste={() => setStage("paste")}
    />
  );
}
