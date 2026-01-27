'use client';

import { useEffect, useLayoutEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useLayoutEffect(() => {
    // Check authentication status synchronously before render
    const auth = localStorage.getItem('isAuthenticated') === 'true';
    setIsAuthenticated(auth);

    // If not authenticated and not on login page, redirect immediately
    if (!auth && pathname !== '/login') {
      router.replace('/login');
    }
  }, [pathname, router]);

  useEffect(() => {
    // Listen for storage changes (when login happens in another tab or component)
    const checkAuth = () => {
      const newAuth = localStorage.getItem('isAuthenticated') === 'true';
      setIsAuthenticated(newAuth);
    };

    window.addEventListener('storage', checkAuth);

    return () => {
      window.removeEventListener('storage', checkAuth);
    };
  }, []);

  return <>{children}</>;
}
