'use client';

import { MoonPayProvider } from '@moonpay/moonpay-react';
import { useEffect, useState } from 'react';

// MoonPayProvider wrapper that fetches API key from server
export default function MoonPayProviderWrapper({ children }: { children: React.ReactNode }) {
  const [apiKey, setApiKey] = useState<string>('');
  const [isSandbox, setIsSandbox] = useState(false);

  useEffect(() => {
    // Fetch API key from server (public key is safe to expose)
    fetch('/api/moonpay/config')
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setApiKey(data.apiKey || '');
          setIsSandbox(data.isSandbox || false);
        }
      })
      .catch(err => {
        console.error('Failed to fetch MoonPay config:', err);
      });
  }, []);

  // Don't render provider until we have the API key
  if (!apiKey) {
    return <>{children}</>;
  }

  return (
    <MoonPayProvider 
      apiKey={apiKey}
      debug={isSandbox} // Enable debug mode for sandbox environment
    >
      {children}
    </MoonPayProvider>
  );
}

