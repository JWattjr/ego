"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import * as api from "./api";
import type { Authorization, ClaimProof, DropPublic, Position } from "./types";

export function usePosition() {
  const [position, setPosition] = useState<Position | null>(null),
    [enabled, setEnabled] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    if (!enabled) return;
    if (!navigator.geolocation) {
      setError("This browser doesn't support location. Try another device.");
      return;
    }
    const watch = navigator.geolocation.watchPosition(
      (p) => {
        setPosition({
          lat: p.coords.latitude,
          lng: p.coords.longitude,
          accuracyM: p.coords.accuracy,
        });
        setError("");
      },
      (e) =>
        setError(
          e.code === 1
            ? "Location permission is off. Enable it in your browser settings to hunt."
            : "We couldn't get a location fix. Step outside to a public place and try again.",
        ),
      { enableHighAccuracy: true, maximumAge: 3000, timeout: 15000 },
    );
    return () => navigator.geolocation.clearWatch(watch);
  }, [enabled]);
  return {
    position,
    error,
    enabled,
    enable: () => {
      setError("");
      setEnabled(true);
    },
    disable: () => setEnabled(false),
  };
}
export function useClaim(drop: DropPublic | null, proof: ClaimProof | null) {
  const router = useRouter(),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [phase, setPhase] = useState("");
  const pending = useRef<{ dropId: string; txHash: string } | null>(null);
  const locked = useRef(false);
  const claim = useCallback(async () => {
    if (!drop || !proof || locked.current) return;
    locked.current = true;
    setBusy(true);
    setError("");
    try {
      if (!pending.current || pending.current.dropId !== drop.dropId) {
        setPhase("Checking your proof…");
        const wallet = await api.getWallet();
        if (!wallet.address)
          throw new api.ApiError(
            "wallet_not_connected",
            "Connect your wallet to continue. Wallet integration is coming next.",
          );
        const authorization: Authorization = await api.authorizeClaim({
          campaignId: drop.campaignId,
          dropId: drop.dropId,
          to: wallet.address,
          proof,
        });
        setPhase("Submitting the claim…");
        const txHash = await api.submitClaim({
          campaignId: drop.campaignId,
          dropId: drop.dropId,
          to: wallet.address,
          authorization,
        });
        pending.current = { dropId: drop.dropId, txHash };
      }
      setPhase("Waiting for the Arc receipt…");
      const receipt = await api.confirmClaim(
        drop.dropId,
        pending.current.txHash,
      );
      const campaign = await api.getCampaign(drop.campaignId);
      api.rememberFound({
        ...receipt,
        drop,
        campaign: { ...campaign, drops: campaign.drops.length },
        collectible: {
          id: drop.campaignId,
          title: campaign.title,
          creatorName: drop.creatorName,
          kind: drop.kind,
          earnedAt: Math.floor(Date.now() / 1000),
        },
      });
      router.push(`/found/${drop.dropId}`);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Your claim couldn't be completed. Try again.",
      );
    } finally {
      setBusy(false);
      locked.current = false;
      setPhase("");
    }
  }, [drop, proof, router]);
  return { claim, busy, error, phase };
}
