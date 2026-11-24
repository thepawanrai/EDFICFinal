import { useEffect, useState } from 'react';
import { useTheme } from '../../context/ThemeContext';

const ECG_WAVEFORM_PATH =
  'm293.26 184.14h-82.877l-12.692-76.138c-.546-3.287-3.396-5.701-6.718-5.701-.034 0-.061 0-.089 0-3.369.027-6.199 2.523-6.677 5.845l-12.507 87.602-14.874-148.69c-.355-3.43-3.205-6.056-6.643-6.138-.048 0-.096 0-.143 0-3.39 0-6.274 2.489-6.752 5.852l-19.621 137.368h-9.405l-12.221-42.782c-.866-3.028-3.812-5.149-6.8-4.944-3.13.109-5.777 2.332-6.431 5.395l-8.941 42.332h-73.049c-3.771 0-6.82 3.049-6.82 6.82 0 3.778 3.049 6.82 6.82 6.82h78.566c3.219 0 6.002-2.251 6.67-5.408l4.406-20.856 6.09 21.313c.839 2.939 3.526 4.951 6.568 4.951h20.46c3.396 0 6.274-2.489 6.752-5.845l12.508-87.596 14.874 148.683c.355 3.437 3.205 6.056 6.643 6.138h.143c3.39 0 6.274-2.489 6.752-5.845l14.227-99.599 6.397 38.362c.546 3.287 3.396 5.702 6.725 5.702h88.66c3.771 0 6.82-3.049 6.82-6.82-.001-3.772-3.05-6.821-6.821-6.821z';

function EcgWaveSvg({ fill }: { fill: string }) {
  return (
    <svg
      viewBox="0 0 300.08 300.08"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      style={{ fill }}
    >
      <path d={ECG_WAVEFORM_PATH} />
    </svg>
  );
}

export function SitePreloader() {
  const { isDarkTeal } = useTheme();
  const [exiting, setExiting] = useState(false);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const minDisplayMs = prefersReducedMotion ? 160 : 1800;
    const fadeDurationMs = prefersReducedMotion ? 150 : 420;

    let fadeTimer = 0;
    let unmountTimer = 0;
    const startTime = performance.now();

    const triggerExit = () => {
      const elapsed = performance.now() - startTime;
      const remaining = Math.max(0, minDisplayMs - elapsed);

      fadeTimer = window.setTimeout(() => {
        setExiting(true);
        unmountTimer = window.setTimeout(() => {
          setVisible(false);
        }, fadeDurationMs);
      }, remaining);
    };

    if (document.readyState === 'complete') {
      triggerExit();
    } else {
      window.addEventListener('load', triggerExit, { once: true });
      const safetyTimer = window.setTimeout(triggerExit, 2800);
      return () => {
        window.removeEventListener('load', triggerExit);
        window.clearTimeout(safetyTimer);
        window.clearTimeout(fadeTimer);
        window.clearTimeout(unmountTimer);
      };
    }

    return () => {
      window.clearTimeout(fadeTimer);
      window.clearTimeout(unmountTimer);
    };
  }, []);

  if (!visible) return null;

  const baseFill = isDarkTeal ? 'rgba(124, 224, 239, 0.18)' : 'rgba(13, 74, 90, 0.15)';
  const activeFill = isDarkTeal ? '#7CE0EF' : '#0D4A5A';

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Loading EDFIC"
      className={`fixed inset-0 z-[99999] flex items-center justify-center transition-opacity duration-[420ms] ease-out ${
        exiting ? 'pointer-events-none opacity-0' : 'opacity-100'
      } ${isDarkTeal ? 'bg-[#052028]' : 'bg-white'}`}
    >
      <div
        className={`edfic-preloader-in transition-opacity duration-[420ms] ease-out ${
          exiting ? 'opacity-0' : 'opacity-100'
        }`}
      >
        <div className="edfic-preloader-wave-first">
          <EcgWaveSvg fill={baseFill} />
        </div>
        <div className="edfic-preloader-wave-second">
          <EcgWaveSvg fill={activeFill} />
        </div>
      </div>
    </div>
  );
}
