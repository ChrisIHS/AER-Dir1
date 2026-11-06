"use client";

import Script from "next/script";

/**
 * Cloudflare Turnstile CAPTCHA widget. Renders only when NEXT_PUBLIC_TURNSTILE_SITE_KEY is set (production).
 * The widget adds a hidden `cf-turnstile-response` field to the surrounding form; the auth actions pass it to
 * Supabase as the CAPTCHA token. Turn on CAPTCHA protection in Supabase Auth with the matching secret key
 * (docs/DEPLOY.md), otherwise the token is ignored.
 */
export function Turnstile() {
  const key = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  if (!key) return null;
  return (
    <>
      <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js" strategy="afterInteractive" async defer />
      <div className="cf-turnstile" data-sitekey={key} style={{ margin: "8px 0" }} />
    </>
  );
}
