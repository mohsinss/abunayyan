import { ImageResponse } from "next/og";
import config from "@/config";

export const runtime = "edge";
export const alt = `${config.appName} — ${config.appDescription}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const NAVY = "#0a1f44";
const NAVY_DEEP = "#05122a";
const SLATE_100 = "#f1f5f9";
const SLATE_300 = "#cbd5e1";
const SLATE_400 = "#94a3b8";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: `linear-gradient(135deg, ${NAVY_DEEP} 0%, ${NAVY} 100%)`,
          padding: "72px 80px",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", color: SLATE_100, fontSize: 28, fontWeight: 600 }}>
          {config.appName}
        </div>

        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "center",
            textAlign: "center",
          }}
        >
          <div
            style={{
              color: SLATE_100,
              fontSize: 120,
              fontWeight: 800,
              letterSpacing: "-0.04em",
              lineHeight: 1,
            }}
          >
            {config.appName}
          </div>
          <div
            style={{
              color: SLATE_300,
              fontSize: 28,
              marginTop: 28,
              maxWidth: 900,
              lineHeight: 1.4,
            }}
          >
            {config.appDescription}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            gap: 16,
            color: SLATE_400,
            fontSize: 22,
          }}
        >
          <span>Streaming AI</span>
          <span>·</span>
          <span>Typed data layer</span>
          <span>·</span>
          <span>Batteries included</span>
        </div>
      </div>
    ),
    { ...size },
  );
}
