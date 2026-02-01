'use client';

import { useState } from 'react';

export default function DebugUser() {
  const [email, setEmail] = useState('');
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);

  const checkUser = async () => {
    if (!email) {
      alert('Masukkan email!');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/users/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();
      setResult(data);
    } catch (error) {
      console.error('Error:', error);
      setResult({ error: 'Terjadi kesalahan' });
    } finally {
      setLoading(false);
    }
  };

  const forceVerify = async () => {
    if (!email) {
      alert('Masukkan email!');
      return;
    }

    if (!confirm(`Force verify email: ${email}?`)) {
      return;
    }

    setVerifying(true);
    try {
      const response = await fetch('/api/users/force-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();
      
      if (data.success) {
        alert('✅ User berhasil di-verify! Silakan cek status lagi.');
        checkUser(); // Refresh status
      } else {
        alert('❌ Error: ' + data.error);
      }
    } catch (error) {
      console.error('Error:', error);
      alert('❌ Terjadi kesalahan');
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black p-8">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white/10 backdrop-blur-lg rounded-xl p-8 border border-white/20">
          <h1 className="text-3xl font-bold text-white mb-6">🔍 Debug User Status</h1>
          
          <div className="space-y-4">
            <div>
              <label className="block text-white mb-2">Email User:</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400"
                placeholder="user@example.com"
              />
            </div>

            <button
              onClick={checkUser}
              disabled={loading}
              className="w-full bg-gradient-to-r from-blue-500 to-purple-600 text-white py-3 rounded-lg font-semibold hover:opacity-90 disabled:opacity-50"
            >
              {loading ? 'Checking...' : 'Check Status'}
            </button>

            <button
              onClick={forceVerify}
              disabled={verifying || !email}
              className="w-full bg-gradient-to-r from-green-500 to-emerald-600 text-white py-3 rounded-lg font-semibold hover:opacity-90 disabled:opacity-50"
            >
              {verifying ? 'Verifying...' : '🔓 Force Verify Email'}
            </button>
          </div>

          {result && (
            <div className="mt-6 bg-black/50 rounded-lg p-6 border border-white/10">
              <h2 className="text-xl font-bold text-white mb-4">Result:</h2>
              
              {result.error ? (
                <div className="text-red-400">
                  ❌ Error: {result.error}
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="text-white">
                    <strong>User Info:</strong>
                    <pre className="mt-2 text-sm bg-black/50 p-3 rounded overflow-auto">
{JSON.stringify(result.user, null, 2)}
                    </pre>
                  </div>

                  <div className="text-white">
                    <strong>Status:</strong>
                    <div className="mt-2 space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{result.status.emailVerified.includes('✅') ? '✅' : '❌'}</span>
                        <span>Email Verified: {result.status.emailVerified}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{result.status.isApproved.includes('✅') ? '✅' : '❌'}</span>
                        <span>Approved: {result.status.isApproved}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{result.status.canLogin.includes('✅') ? '✅' : '❌'}</span>
                        <span>Can Login: {result.status.canLogin}</span>
                      </div>
                    </div>
                  </div>

                  {result.status.canLogin.includes('❌') && (
                    <div className="mt-4 p-4 bg-red-500/20 border border-red-500 rounded-lg text-red-300">
                      <strong>⚠️ User tidak bisa login karena:</strong>
                      <ul className="list-disc ml-5 mt-2">
                        {!result.user.emailVerified && <li>Email belum diverifikasi</li>}
                        {!result.user.isApproved && <li>Akun belum di-approve oleh admin</li>}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="mt-6 text-center">
          <a href="/" className="text-white hover:underline">
            ← Kembali ke Home
          </a>
        </div>
      </div>
    </div>
  );
}
