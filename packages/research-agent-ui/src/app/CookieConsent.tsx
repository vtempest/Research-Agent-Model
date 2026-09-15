'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from '../ui/button';
import { X } from 'lucide-react';
import { researchAgentUIConfig } from '../config';

export function CookieConsent() {
  const [isVisible, setIsVisible] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const cookieConsent = localStorage.getItem('cookie-consent');
    if (!cookieConsent) {
      setIsVisible(true);
    }
  }, []);

  // This banner parks in the bottom-right corner, on top of anything else
  // anchored there (the homepage's scroll cue). Publish its height while it
  // is up so that chrome can sit above it rather than underneath it.
  useEffect(() => {
    const root = document.documentElement;
    const card = cardRef.current;
    if (!isVisible || !card) {
      root.style.removeProperty('--qs-bottom-right-inset');
      return;
    }

    const sync = () =>
      root.style.setProperty(
        '--qs-bottom-right-inset',
        `${Math.ceil(card.getBoundingClientRect().height) + 16}px`,
      );

    sync();
    const observer =
      typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(sync);
    observer?.observe(card);

    return () => {
      observer?.disconnect();
      root.style.removeProperty('--qs-bottom-right-inset');
    };
  }, [isVisible]);

  const handleAcceptAll = () => {
    localStorage.setItem('cookie-consent', JSON.stringify({
      analytics: true,
      marketing: true,
      functional: true,
      timestamp: new Date().toISOString(),
    }));
    setIsVisible(false);
  };

  const handleReject = () => {
    localStorage.setItem('cookie-consent', JSON.stringify({
      analytics: false,
      marketing: false,
      functional: true,
      timestamp: new Date().toISOString(),
    }));
    setIsVisible(false);
  };

  const handleClose = () => {
    setIsVisible(false);
  };

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-0 right-0 m-4 max-w-sm z-50">
      <div ref={cardRef} className="bg-light-secondary dark:bg-dark-secondary rounded-lg shadow-lg border border-light-tertiary dark:border-dark-tertiary p-4 space-y-3">
        <div className="flex justify-between items-start gap-3">
          <div className="flex-1">
            <h3 className="font-semibold text-sm text-black dark:text-white mb-2">
              Cookies & Privacy
            </h3>
            <p className="text-xs text-black/70 dark:text-white/70 mb-3">
              {researchAgentUIConfig.appName} uses cookies to enhance your research experience, analyze usage patterns, and improve our service. We respect your privacy and only use essential cookies by default.
            </p>
            <div className="flex flex-wrap gap-2 text-xs mb-3">
              {researchAgentUIConfig.footerLinks.map((link) => (
                <a
                  key={link.url}
                  href={link.url}
                  target={link.url.startsWith('/') ? undefined : '_blank'}
                  rel={link.url.startsWith('/') ? undefined : 'noopener noreferrer'}
                  className="text-blue-600 dark:text-blue-400 hover:underline"
                >
                  {link.text}
                </a>
              ))}
            </div>
          </div>
          <button
            onClick={handleClose}
            className="text-black/50 dark:text-white/50 hover:text-black dark:hover:text-white transition-colors"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={handleAcceptAll}
            size="sm"
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
          >
            Accept All
          </Button>
          <Button
            onClick={handleReject}
            size="sm"
            variant="outline"
            className="flex-1 bg-light-tertiary dark:bg-dark-tertiary text-black dark:text-white border-0 hover:bg-light-tertiary/80 dark:hover:bg-dark-tertiary/80"
          >
            Reject
          </Button>
        </div>
      </div>
    </div>
  );
}
