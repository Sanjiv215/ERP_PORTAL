/**
 * Parses a User-Agent string into a friendly device/browser name
 * e.g. "Chrome 120 on macOS", "Safari on iPhone", "Firefox on Windows"
 */
export function parseUserAgent(uaString = '') {
  if (!uaString || typeof uaString !== 'string') {
    return 'Unknown Device';
  }

  let os = 'Unknown OS';
  let browser = 'Unknown Browser';

  // Detect OS
  if (/iPhone|iPad|iPod/i.test(uaString)) {
    os = 'iOS';
  } else if (/Android/i.test(uaString)) {
    os = 'Android';
  } else if (/Macintosh|Mac OS X/i.test(uaString)) {
    os = 'macOS';
  } else if (/Windows/i.test(uaString)) {
    os = 'Windows';
  } else if (/Linux/i.test(uaString)) {
    os = 'Linux';
  }

  // Detect Browser
  if (/Edg\//i.test(uaString)) {
    browser = 'Edge';
  } else if (/Chrome\//i.test(uaString) && !/Edg\//i.test(uaString)) {
    browser = 'Chrome';
  } else if (/Safari\//i.test(uaString) && !/Chrome\//i.test(uaString)) {
    browser = 'Safari';
  } else if (/Firefox\//i.test(uaString)) {
    browser = 'Firefox';
  }

  return `${browser} on ${os}`;
}

/**
 * Derives an approximate location string from an IP address
 */
export function parseIpLocation(ipAddress = '') {
  if (!ipAddress || ipAddress === '127.0.0.1' || ipAddress === '::1' || ipAddress.startsWith('192.168.') || ipAddress.startsWith('10.') || ipAddress.startsWith('172.')) {
    return 'Local Network';
  }
  return 'India (Approximate)';
}

/**
 * Partially masks an IP address for privacy e.g. 103.21.127.42 -> 103.21.127.***
 */
export function maskIpAddress(ipAddress = '') {
  if (!ipAddress) return '***.***.***.***';
  if (ipAddress === '127.0.0.1' || ipAddress === '::1') return '127.0.0.1 (Local)';

  const parts = ipAddress.split('.');
  if (parts.length === 4) {
    return `${parts[0]}.${parts[1]}.${parts[2]}.***`;
  }
  return ipAddress.replace(/:[^:]+$/, ':****');
}
