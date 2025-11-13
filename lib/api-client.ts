/**
 * 🔒 SECURE API CLIENT
 * 
 * Automatic CSRF token handling for all POST/PUT/DELETE requests
 */

import { logger } from '@/lib/logger';

function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  
  const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
  return match ? match[2] : null;
}

async function ensureCSRFToken(): Promise<string> {
  let token = getCookie('csrf_token');
  
  if (!token) {
    // Fetch CSRF token from server
    try {
      const response = await fetch('/api/csrf-token');
      const data = await response.json();
      token = data.token;
      
      if (!token) {
        throw new Error('No CSRF token received from server');
      }
    } catch (error) {
      logger.error('Failed to fetch CSRF token:', error);
      throw new Error('Could not initialize security token');
    }
  }
  
  return token;
}

export async function apiPost(url: string, data: any) {
  const csrfToken = await ensureCSRFToken();
  
  return fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRF-Token': csrfToken,
    },
    body: JSON.stringify(data),
  });
}

export async function apiPut(url: string, data: any) {
  const csrfToken = await ensureCSRFToken();
  
  return fetch(url, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRF-Token': csrfToken,
    },
    body: JSON.stringify(data),
  });
}

export async function apiDelete(url: string) {
  const csrfToken = await ensureCSRFToken();
  
  return fetch(url, {
    method: 'DELETE',
    headers: {
      'X-CSRF-Token': csrfToken,
    },
  });
}

// Regular GET/HEAD requests don't need CSRF
export async function apiGet(url: string) {
  return fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

