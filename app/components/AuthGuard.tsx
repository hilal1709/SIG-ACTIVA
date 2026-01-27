'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    // Check authentication status
    const checkAuth = () => {
      const auth = localStorage.getItem('isAuthenticated') === 'true';
      setIsAuthenticated(auth);
      setIsLoading(false);
    };

    checkAuth();

    // Listen for storage changes (when login happens in another tab or component)
    window.addEventListener('storage', checkAuth);
    
    return () => {
      window.removeEventListener('storage', checkAuth);
    };
  }, []);

  useEffect(() => {
    if (!isLoading) {
      // Jika di halaman login dan sudah login, redirect ke dashboard
      if (pathname === '/login' && isAuthenticated) {
        router.replace('/monitoring-accrual');
      }
      // Jika di halaman login dan belum login, jangan redirect (biarkan tetap di login)
      else if (pathname !== '/login' && !isAuthenticated) {
        router.replace('/login');
      }
    }
  }, [pathname, isAuthenticated, isLoading, router]);

  // Tampilkan loading hanya sebentar saat initial check
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-red-600 rounded-2xl mb-4 animate-pulse">
            <div className="text-white font-bold text-xl">SIG</div>
          </div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
