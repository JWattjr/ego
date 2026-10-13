"use client";
import { useEffect, useRef, useState } from "react";
import { Camera, CameraOff } from "lucide-react";
import type { IScannerControls } from "@zxing/browser";
import { ErrorMessage } from "./ui";
export function QrScanner({ onRead }: { onRead: (value: string) => void }) {
  const [active, setActive] = useState(false),
    [error, setError] = useState("");
  const video = useRef<HTMLVideoElement>(null),
    controls = useRef<IScannerControls | null>(null),
    callback = useRef(onRead);
  useEffect(() => {
    callback.current = onRead;
  }, [onRead]);
  useEffect(() => {
    if (!active) return;
    let disposed = false,
      read = false;
    setError("");
    const start = async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia)
          throw new Error(
            "Camera access requires HTTPS or localhost. You can paste the QR code below instead.",
          );
        const { BrowserQRCodeReader } = await import("@zxing/browser");
        const reader = new BrowserQRCodeReader();
        if (disposed || !video.current) return;
        const scanner = await reader.decodeFromConstraints(
          { video: { facingMode: "environment" }, audio: false },
          video.current,
          (result) => {
            if (!result || disposed || read) return;
            read = true;
            callback.current(result.getText());
            setActive(false);
          },
        );
        if (disposed) scanner.stop();
        else controls.current = scanner;
      } catch (e) {
        if (!disposed) {
          setError(
            e instanceof Error
              ? `${e.message} You can paste the code below.`
              : "Camera access failed. Paste the code below instead.",
          );
          setActive(false);
        }
      }
    };
    void start();
    return () => {
      disposed = true;
      controls.current?.stop();
      controls.current = null;
    };
  }, [active]);
  return (
    <div className="scanner">
      {active ? (
        <>
          <div className="scanner-video">
            <video ref={video} muted playsInline aria-label="Live QR scanner" />
            <span className="scan-corner top-left" />
            <span className="scan-corner top-right" />
            <span className="scan-corner bottom-left" />
            <span className="scan-corner bottom-right" />
          </div>
          <button className="button secondary" onClick={() => setActive(false)}>
            <CameraOff size={18} />
            Stop camera
          </button>
        </>
      ) : (
        <button
          className="button secondary camera-button"
          onClick={() => setActive(true)}
        >
          <Camera size={22} />
          Open camera to scan
        </button>
      )}
      {error && <ErrorMessage message={error} />}
    </div>
  );
}
