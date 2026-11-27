'use client';

import { useEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';
import Sidebar from '@/app/components/Sidebar';
import Header from '@/app/components/Header';
import { cn } from '@/lib/utils';

type CostModuleFrameProps = {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  contentClassName?: string;
};

export default function CostModuleFrame({
  title,
  subtitle = 'Cost Structure & Fluktuasi Biaya',
  children,
  contentClassName,
}: CostModuleFrameProps) {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = contentRef.current;
    if (!root) return;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion) return;

    const ctx = gsap.context(() => {
      const items = root.querySelectorAll<HTMLElement>('[data-cost-motion]');
      if (items.length) {
        gsap.fromTo(
          items,
          { opacity: 0, y: 24, scale: 0.985 },
          {
            opacity: 1,
            y: 0,
            scale: 1,
            duration: 0.5,
            stagger: 0.07,
            ease: 'power3.out',
            clearProps: 'transform',
          }
        );
      } else {
        gsap.fromTo(root, { opacity: 0, y: 18 }, { opacity: 1, y: 0, duration: 0.45, ease: 'power3.out' });
      }

      const cards = Array.from(root.querySelectorAll<HTMLElement>('[data-cost-hover]'));
      const cleanups = cards.map((card) => {
        const enter = () => gsap.to(card, { y: -3, scale: 1.006, duration: 0.2, ease: 'power2.out' });
        const leave = () => gsap.to(card, { y: 0, scale: 1, duration: 0.2, ease: 'power2.out' });
        card.addEventListener('mouseenter', enter);
        card.addEventListener('mouseleave', leave);
        return () => {
          card.removeEventListener('mouseenter', enter);
          card.removeEventListener('mouseleave', leave);
        };
      });

      return () => cleanups.forEach((cleanup) => cleanup());
    }, root);

    return () => ctx.revert();
  }, []);

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="fixed inset-y-0 left-0 z-40 hidden lg:block">
        <Sidebar />
      </aside>

      {mobileSidebarOpen && (
        <>
          <button
            type="button"
            aria-label="Tutup navigasi"
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[1px] lg:hidden"
            onClick={() => setMobileSidebarOpen(false)}
          />
          <aside className="fixed inset-y-0 left-0 z-50 lg:hidden">
            <Sidebar isOpen onClose={() => setMobileSidebarOpen(false)} />
          </aside>
        </>
      )}

      <div className="flex min-w-0 flex-1 flex-col lg:pl-64">
        <Header title={title} subtitle={subtitle} onMenuClick={() => setMobileSidebarOpen(true)} />
        <main className="min-w-0 flex-1">
          <div ref={contentRef} className={cn('min-w-0', contentClassName)}>
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
