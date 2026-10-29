"use client";

import { useEffect, useRef } from "react";

/** The official Telegram Login Widget; Telegram redirects to `authUrl` with signed user fields. */
export function TelegramLogin({ bot, authUrl }: { bot: string; authUrl: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = ref.current;
    if (!container) return;
    const script = document.createElement("script");
    script.src = "https://telegram.org/js/telegram-widget.js?22";
    script.async = true;
    script.dataset.telegramLogin = bot;
    script.dataset.size = "large";
    script.dataset.radius = "20";
    script.dataset.authUrl = authUrl;
    script.dataset.requestAccess = "write";
    container.replaceChildren(script);
    return () => container.replaceChildren();
  }, [bot, authUrl]);

  return <div ref={ref} className="min-h-12" />;
}
