"use client";

import React from "react";

/**
 * Catches render-time crashes (e.g. wallet hooks used while Privy could not
 * mount because NEXT_PUBLIC_PRIVY_APP_ID was absent at build time) and shows
 * a calm setup panel instead of a broken error shell.
 */
export default class SafeBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div className="mx-auto mt-16 max-w-xl rounded-[14px] border border-warn/30 bg-warn/5 px-6 py-6">
          <div className="label-mono !text-warn">WALLET LAYER NOT ACTIVE</div>
          <p className="mt-3 text-[13.5px] leading-relaxed text-ink-2">
            The app is live, but the wallet/login layer could not start — usually
            because <span className="data-mono">NEXT_PUBLIC_PRIVY_APP_ID</span> was
            missing at build time. All on-chain reads still work; add the
            environment variables and redeploy to enable sign-in.
          </p>
          <button
            onClick={() => this.setState({ error: null })}
            className="focus-ring mt-4 rounded-[10px] border border-line-strong px-4 py-2 text-[13px] text-ink transition hover:bg-surface-2"
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
