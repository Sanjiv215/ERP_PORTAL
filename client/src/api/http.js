import { isDemoMode } from './demo/demoMode.js';
import { handleDemoRequest } from './demo/mockService.js';

function getApiBaseUrl() {
  const envUrl = import.meta.env.VITE_API_BASE_URL;
  if (!envUrl) return '/api/v1';
  const clean = envUrl.replace(/\/+$/, '');
  return clean.endsWith('/api/v1') ? clean : `${clean}/api/v1`;
}

const API_BASE = getApiBaseUrl();

export class ApiError extends Error {
  constructor(message, status, code) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export async function apiRequest(path, options = {}, accessToken) {
  if (isDemoMode()) {
    return handleDemoRequest(path, options);
  }

  const headers = new Headers(options.headers || {});
  headers.set('Content-Type', 'application/json');

  if (accessToken) {
    headers.set('Authorization', `Bearer ${accessToken}`);
  }

  let response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers,
      credentials: 'include'
    });
  } catch (netErr) {
    throw new ApiError(
      'Unable to connect to the backend server. Please check your network or VITE_API_BASE_URL configuration.',
      0,
      'NETWORK_ERROR'
    );
  }

  if (response.status === 204) {
    return null;
  }

  const contentType = response.headers.get('content-type') || '';
  let data = {};
  if (contentType.includes('application/json')) {
    data = await response.json().catch(() => ({}));
  }

  if (!response.ok) {
    throw new ApiError(
      data.error?.message || (response.status === 404 ? 'API endpoint not found. Please ensure VITE_API_BASE_URL points to your Render backend.' : 'Request failed'),
      response.status,
      data.error?.code || 'REQUEST_FAILED'
    );
  }

  return data;
}

export async function apiDownload(path, defaultFilename = 'download', accessToken) {
  if (isDemoMode()) {
    const sampleContent = `ERP Portal Demo Report — ${defaultFilename}\nGenerated: ${new Date().toISOString()}\nStatus: Demo Mode Active\n\nThis is a sample exported file generated in frontend-only demo mode.`;
    const blob = new Blob([sampleContent], { type: 'text/plain;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.style.display = 'none';
    link.href = url;
    link.download = defaultFilename.includes('.') ? defaultFilename : `${defaultFilename}.txt`;
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    }, 200);
    return true;
  }

  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  const separator = cleanPath.includes('?') ? '&' : '?';

  const isMobile = typeof navigator !== 'undefined' && /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

  if (isMobile) {
    let ticket = null;
    try {
      const ticketRes = await apiRequest('/auth/download-ticket', { method: 'POST' }, accessToken);
      ticket = ticketRes.ticket;
    } catch {
      // Fallback if ticket endpoint unavailable
    }

    const downloadUrl = `${API_BASE}${cleanPath}${ticket ? `${separator}ticket=${encodeURIComponent(ticket)}` : ''}`;
    window.location.href = downloadUrl;
    return true;
  }

  const headers = new Headers();
  if (accessToken) {
    headers.set('Authorization', `Bearer ${accessToken}`);
  }

  let response;
  try {
    response = await fetch(`${API_BASE}${cleanPath}`, {
      method: 'GET',
      headers,
      credentials: 'include'
    });
  } catch (netErr) {
    throw new ApiError(
      'Unable to connect to the backend server. Please check your network or VITE_API_BASE_URL configuration.',
      0,
      'NETWORK_ERROR'
    );
  }

  if (!response.ok) {
    const errorJson = await response.json().catch(() => ({}));
    throw new ApiError(
      errorJson.error?.message || 'Download failed',
      response.status,
      errorJson.error?.code || 'DOWNLOAD_FAILED'
    );
  }

  let filename = defaultFilename;
  const disposition = response.headers.get('content-disposition');
  if (disposition && disposition.includes('filename=')) {
    const match = disposition.match(/filename="?([^"]+)"?/);
    if (match && match[1]) {
      filename = match[1];
    }
  }

  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.style.display = 'none';
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  setTimeout(() => {
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  }, 200);

  return true;
}

