'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Lock, User, Eye, EyeOff, Mail } from 'lucide-react';
import Link from 'next/link';

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [accountStatus, setAccountStatus] = useState<{
    emailVerified: boolean;
    isApproved: boolean;
  } | null>(null);

  useEffect(() => {
    if (searchParams.get('registered') === 'true') {
      if (searchParams.get('needVerification') === 'true') {
        setSuccessMessage('Registrasi berhasil! Silakan cek email Anda untuk verifikasi akun.');
      } else if (searchParams.get('verified') === 'true') {
        setSuccessMessage('Email berhasil diverifikasi! Menunggu persetujuan Admin System.');
      } else {
        setSuccessMessage('Registrasi berhasil! Silakan login dengan akun Anda.');
      }
    }
  }, [searchParams]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMessage(''); // Clear success message saat login
    setAccountStatus(null); // Reset account status
    setIsLoading(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        // Set session
        localStorage.setItem('isAuthenticated', 'true');
        localStorage.setItem('username', data.user.username);
        localStorage.setItem('userId', data.user.id);
        localStorage.setItem('userName', data.user.name);
        localStorage.setItem('userRole', data.user.role);

         // Redirect ke dashboard utama
         router.push('/');
      } else {
        // Jika login gagal karena verifikasi/approval, cek status akun
        if (response.status === 403) {
          try {
            const checkResponse = await fetch('/api/users/check', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ email }),
            });
            
            if (checkResponse.ok) {
              const checkData = await checkResponse.json();
              setAccountStatus({
                emailVerified: checkData.user.emailVerified,
                isApproved: checkData.user.isApproved,
              });
            }
          } catch (checkError) {
            console.error('Failed to check account status:', checkError);
          }
        }
        
        setError(data.error || 'Email atau password salah');
        setIsLoading(false);
      }
    } catch (err) {
      console.error('Login error:', err);
      setError('Terjadi kesalahan. Silakan coba lagi.');
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 to-gray-100 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Logo & Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-24 h-24 mb-4">
            <img src="/Logo Aplikasi.png" alt="SIG ACTIVA Logo" className="w-24 h-24 object-contain" />
          </div>
          <h1 className="text-3xl font-bold text-gray-800 mb-2">
            SIG ACTIVA
          </h1>
          <p className="text-gray-600">
            Sistem Informasi Akuntansi PT Semen Indonesia Grup
          </p>
        </div>

        {/* Login Card */}
        <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-200">
          <h2 className="text-2xl font-bold text-gray-800 mb-6">
            Masuk
          </h2>

          <form onSubmit={handleLogin} className="space-y-5">
            {/* Email Input */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                Email
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none z-10">
                  <Mail size={20} className="text-gray-500" />
                </div>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none transition-all text-gray-900 bg-white"
                  placeholder="Masukkan email"
                  required
                />
              </div>
            </div>

            {/* Password Input */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none z-10">
                  <Lock size={20} className="text-gray-500" />
                </div>
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-12 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none transition-all text-gray-900 bg-white"
                  placeholder="Masukkan password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>

            {/* Success Message */}
            {successMessage && (
              <div className={`px-4 py-3 rounded-lg text-sm ${
                successMessage.includes('persetujuan') || successMessage.includes('approval') 
                  ? 'bg-blue-50 border border-blue-200 text-blue-700' 
                  : 'bg-green-50 border border-green-200 text-green-600'
              }`}>
                {successMessage}
                {successMessage.includes('persetujuan') && (
                  <div className="mt-2 pt-2 border-t border-blue-200">
                    <p className="text-xs text-blue-600">
                      💡 Tip: Hubungi Admin System untuk mempercepat proses persetujuan.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div>
                <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg text-sm">
                  {error}
                </div>
                
                {/* Account Status Indicator */}
                {accountStatus && (
                  <div className="mt-3 bg-gray-50 border border-gray-200 rounded-lg p-4">
                    <p className="text-sm font-semibold text-gray-700 mb-2">Status Akun:</p>
                    <div className="space-y-1.5 text-sm">
                      <div className="flex items-center">
                        <span className={`mr-2 ${accountStatus.emailVerified ? 'text-green-600' : 'text-red-600'}`}>
                          {accountStatus.emailVerified ? '✅' : '❌'}
                        </span>
                        <span className="text-gray-600">
                          Verifikasi Email: {accountStatus.emailVerified ? 'Sudah terverifikasi' : 'Belum terverifikasi'}
                        </span>
                      </div>
                      <div className="flex items-center">
                        <span className={`mr-2 ${accountStatus.isApproved ? 'text-green-600' : 'text-amber-600'}`}>
                          {accountStatus.isApproved ? '✅' : '⏳'}
                        </span>
                        <span className="text-gray-600">
                          Persetujuan Admin: {accountStatus.isApproved ? 'Sudah disetujui' : 'Menunggu persetujuan'}
                        </span>
                      </div>
                    </div>
                    
                    {accountStatus.emailVerified && !accountStatus.isApproved && (
                      <div className="mt-3 pt-3 border-t border-gray-200">
                        <p className="text-xs text-amber-700">
                          <strong>Akun Anda sedang menunggu persetujuan Admin System.</strong><br/>
                          Silakan hubungi administrator untuk mempercepat proses persetujuan.
                        </p>
                      </div>
                    )}
                    
                    {!accountStatus.emailVerified && (
                      <div className="mt-3 pt-3 border-t border-gray-200">
                        <p className="text-xs text-red-700">
                          <strong>Email Anda belum diverifikasi.</strong><br/>
                          Silakan cek inbox email Anda dan klik link verifikasi yang telah dikirimkan.
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Login Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold py-3 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl"
            >
              {isLoading ? 'Memproses...' : 'Masuk'}
            </button>
          </form>

          {/* Register Link */}
          <div className="mt-6">
            <p className="text-center text-sm text-gray-600">
              Belum punya akun?{' '}
              <button
                type="button"
                onClick={() => router.push('/register')}
                className="text-red-600 hover:text-red-700 font-semibold hover:underline"
              >
                Daftar di sini
              </button>
            </p>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-sm text-gray-500 mt-6">
          © 2026 SIG ACTIVA - PT Semen Indonesia Grup. All rights reserved.
        </p>
      </div>
    </div>
  );
}
