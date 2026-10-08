import { useEffect, useRef } from 'react';
import { TURNSTILE_SITE_KEY, TURNSTILE_DEV_TOKEN } from '../lib/constants';

/**
 * Cloudflare Turnstile (invisible bot protection).
 *
 * - When a site key is configured (VITE_TURNSTILE_SITE_KEY), it renders the real
 *   widget and emits the token via onToken.
 * - In development (no site key), it immediately emits the dev token that the
 *   backend accepts only when TURNSTILE_DEV_BYPASS=true.
 */
export default function Turnstile({ onToken, onExpire, onError }) {
  const cbRef = useRef({ onToken, onExpire, onError });
  cbRef.current = { onToken, onExpire, onError };
  const containerRef = useRef(null);
  const widgetId = useRef(null);

  useEffect(() => {
    if (!TURNSTILE_SITE_KEY) {
      cbRef.current.onToken?.(TURNSTILE_DEV_TOKEN);
      return undefined;
    }

    const scriptId = 'turnstile-script';
    const renderWidget = () => {
      if (!window.turnstile || !containerRef.current) return;
      widgetId.current = window.turnstile.render(containerRef.current, {
        sitekey: TURNSTILE_SITE_KEY,
        callback: (token) => cbRef.current.onToken?.(token),
        'expired-callback': () => cbRef.current.onExpire?.(),
        'error-callback': () => cbRef.current.onError?.(),
      });
    };

    if (window.turnstile) {
      renderWidget();
    } else {
      let el = document.getElementById(scriptId);
      if (!el) {
        el = document.createElement('script');
        el.id = scriptId;
        el.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
        el.async = true;
        el.defer = true;
        el.onload = renderWidget;
        document.body.appendChild(el);
      } else {
        el.addEventListener('load', renderWidget, { once: true });
      }
    }

    return () => {
      if (widgetId.current != null && window.turnstile) {
        window.turnstile.remove(widgetId.current);
        widgetId.current = null;
      }
    };
  }, []);

  return <div ref={containerRef} className={TURNSTILE_SITE_KEY ? '' : 'hidden'} />;
}
