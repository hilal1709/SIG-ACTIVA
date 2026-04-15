'use client';

import { useEffect, useRef } from 'react';
import { animate, stagger, random } from 'animejs';

function renderTypewriterText(el: HTMLElement, text: string) {
  el.replaceChildren();

  const fragment = document.createDocumentFragment();
  for (const char of text) {
    const span = document.createElement('span');
    span.style.display = 'inline-block';
    span.style.opacity = '0';
    span.textContent = char === ' ' ? '\u00A0' : char;
    fragment.appendChild(span);
  }

  el.appendChild(fragment);
}

// â”€â”€â”€ anime.js v4: stagger reveal a list of elements â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export function useAnimeStagger(
  selector: string,
  deps: unknown[] = [],
  options?: { delay?: number; duration?: number; translateY?: number }
) {
  const containerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const els = containerRef.current.querySelectorAll(selector);
    if (els.length === 0) return;

    animate(els, {
      opacity: [0, 1],
      translateY: [options?.translateY ?? 20, 0],
      duration: options?.duration ?? 600,
      delay: stagger(80, { start: options?.delay ?? 0 }),
      ease: 'easeOutExpo',
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return containerRef;
}

// â”€â”€â”€ anime.js v4: count-up number animation â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export function useAnimeCounter(
  target: number,
  onUpdate: (v: number) => void,
  deps: unknown[] = [],
  options?: { duration?: number; delay?: number }
) {
  useEffect(() => {
    const proxy = { value: 0 };
    animate(proxy, {
      value: target,
      duration: options?.duration ?? 1400,
      delay: options?.delay ?? 0,
      ease: 'easeOutExpo',
      onUpdate: () => onUpdate(proxy.value),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, ...deps]);
}

// â”€â”€â”€ anime.js v4: letter stagger on a heading â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export function useAnimeTypewriter(
  text: string,
  elementId: string,
  deps: unknown[] = []
) {
  useEffect(() => {
    const el = document.getElementById(elementId);
    if (!el) return;

    renderTypewriterText(el, text);

    animate(`#${elementId} span`, {
      opacity: [0, 1],
      translateY: [12, 0],
      duration: 500,
      delay: stagger(40),
      ease: 'easeOutExpo',
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, elementId, ...deps]);
}

// â”€â”€â”€ anime.js v4: floating particles background â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export function useAnimeParticles(containerId: string) {
  useEffect(() => {
    const container = document.getElementById(containerId);
    if (!container) return;

    const particles: HTMLElement[] = [];
    const count = 12;

    for (let i = 0; i < count; i++) {
      const el = document.createElement('div');
      const size = random(4, 12);
      el.style.cssText = `
        position: absolute; border-radius: 50%;
        width: ${size}px; height: ${size}px;
        background: hsl(${Math.random() > 0.5 ? '0 84% 80%' : '221 83% 80%'} / 0.3);
        left: ${Math.random() * 100}%;
        top: ${Math.random() * 100}%;
        pointer-events: none;
      `;
      container.appendChild(el);
      particles.push(el);

      const runLoop = () => {
        animate(el, {
          translateX: random(-60, 60),
          translateY: random(-60, 60),
          scale: [0, 1, 0],
          opacity: [0, 0.6, 0],
          duration: random(3000, 6000),
          ease: 'inOutSine',
          onComplete: runLoop,
        });
      };
      setTimeout(runLoop, random(0, 2000));
    }

    return () => {
      particles.forEach(p => p.remove());
    };
  }, [containerId]);
}

// â”€â”€â”€ anime.js v4: panel slide in animation â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export function animatePanel(el: HTMLElement | null, show: boolean) {
  if (!el) return;
  if (show) {
    animate(el, {
      opacity: [0, 1],
      translateY: [-8, 0],
      scale: [0.97, 1],
      duration: 220,
      ease: 'easeOutCubic',
    });
  } else {
    animate(el, {
      opacity: [1, 0],
      translateY: [0, -6],
      scale: [1, 0.97],
      duration: 160,
      ease: 'easeInCubic',
    });
  }
}

// â”€â”€â”€ anime.js v4: bell shake animation â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export function animateBellShake(el: HTMLElement | null) {
  if (!el) return;
  animate(el, {
    rotate: [-15, 15, -10, 10, 0],
    duration: 600,
    ease: 'inOutSine',
  });
}

// â”€â”€â”€ anime.js v4: stagger items â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export function animateStaggerItems(selector: string, container?: Element | null) {
  const scope = container ?? document;
  const items = scope.querySelectorAll(selector);
  if (!items.length) return;
  animate(items, {
    opacity: [0, 1],
    translateX: [12, 0],
    duration: 350,
    delay: stagger(45),
    ease: 'easeOutExpo',
  });
}

// â”€â”€â”€ anime.js v4: typewriter helper (standalone) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export function typewriterAnimate(text: string, el: HTMLElement, startDelay = 0) {
  renderTypewriterText(el, text);

  animate(el.querySelectorAll('span'), {
    opacity: [0, 1],
    translateY: [10, 0],
    duration: 400,
    delay: stagger(60, { start: startDelay }),
    ease: 'easeOutExpo',
  });
}

// â”€â”€â”€ anime.js v4: shake element â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export function shakeElement(el: HTMLElement | null) {
  if (!el) return;
  animate(el, {
    translateX: [0, -8, 8, -6, 6, 0],
    duration: 400,
    ease: 'inOutSine',
  });
}

