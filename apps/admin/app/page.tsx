'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AdminDashboard from './admin-dashboard';

export default function Home() {
  const router = useRouter();
  const [authenticated, setAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  async function checkAuth() {
    const sessionToken = localStorage.getItem('admin_session');

    if (!sessionToken) {
      // No session - redirect to login
      router.push('/login');
      return;
    }

    // Verify session is still valid
    try {
      const response = await fetch('/api/admin-auth/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionToken }),
      });

      if (response.ok) {
        setAuthenticated(true);
      } else {
        // Invalid session - redirect to login
        localStorage.removeItem('admin_session');
        router.push('/login');
      }
    } catch (error) {
      // Error checking session - redirect to login
      localStorage.removeItem('admin_session');
      router.push('/login');
    } finally {
      setLoading(false);
    }
  }

  if (loading || !authenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-white mx-auto mb-4"></div>
          <p className="text-white text-lg">Checking authentication...</p>
        </div>
      </div>
    );
  }

  return <AdminDashboard />;
}



