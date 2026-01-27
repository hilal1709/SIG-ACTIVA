'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    // Check authentication status
    const checkAuth = () => {
      const auth = localStorage.getItem('isAuthenticated') === 'true';
      setIsAuthenticated(auth);
    };

    checkAuth();

    // Listen for storage changes (when login happens in another tab or component)
    window.addEventListener('storage', checkAuth);

    return () => {
      window.removeEventListener('storage', checkAuth);
    };
  }, []);

  useEffect(() => {
    // Jika tidak di halaman login dan belum login, redirect ke login
    if (pathname !== '/login' && !isAuthenticated) {
      router.replace('/login');
    }
  }, [pathname, isAuthenticated, router]);

  return <>{children}</>;
}
