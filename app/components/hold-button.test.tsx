// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HoldButton } from "./ui";
beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(performance, "now").mockImplementation(() => Date.now());
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) =>
    setTimeout(() => cb(performance.now()), 16),
  );
  vi.stubGlobal("cancelAnimationFrame", clearTimeout);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
describe("hold-to-claim cancellation", () => {
  it("never submits when keyboard focus leaves mid-hold", () => {
    const claim = vi.fn();
    render(<HoldButton onClaim={claim} />);
    const button = screen.getByRole("button");
    fireEvent.keyDown(button, { key: " " });
    act(() => vi.advanceTimersByTime(500));
    fireEvent.blur(button);
    act(() => vi.advanceTimersByTime(1500));
    expect(claim).not.toHaveBeenCalled();
  });
  it("cancels a hold when the claim becomes disabled", () => {
    const claim = vi.fn();
    const view = render(<HoldButton onClaim={claim} />);
    fireEvent.keyDown(screen.getByRole("button"), { key: "Enter" });
    act(() => vi.advanceTimersByTime(500));
    view.rerender(<HoldButton onClaim={claim} disabled />);
    act(() => vi.advanceTimersByTime(1500));
    expect(claim).not.toHaveBeenCalled();
  });
  it("requires a full uninterrupted hold and submits exactly once", () => {
    const claim = vi.fn();
    render(<HoldButton onClaim={claim} />);
    const button = screen.getByRole("button");
    fireEvent.keyDown(button, { key: " " });
    act(() => vi.advanceTimersByTime(300));
    fireEvent.keyUp(button, { key: " " });
    act(() => vi.advanceTimersByTime(1500));
    expect(claim).not.toHaveBeenCalled();
    fireEvent.keyDown(button, { key: " " });
    act(() => vi.advanceTimersByTime(1300));
    expect(claim).toHaveBeenCalledTimes(1);
    act(() => vi.advanceTimersByTime(2000));
    expect(claim).toHaveBeenCalledTimes(1);
  });
});
