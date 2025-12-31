/**
 * CSRF Token Helper
 * Fetches and manages CSRF tokens for all API requests
 */

let csrfToken = null;

/**
 * Fetch CSRF token from server
 */
async function fetchCsrfToken() {
  try {
    const response = await fetch('/auth/csrf-token', {
      credentials: 'include'
    });
    const data = await response.json();
    if (data.success && data.csrfToken) {
      csrfToken = data.csrfToken;
      return csrfToken;
    }
  } catch (error) {
    console.error('Error fetching CSRF token:', error);
  }
  return null;
}

/**
 * Get CSRF token (fetch if not cached)
 */
async function getCsrfToken() {
  if (!csrfToken) {
    await fetchCsrfToken();
  }
  return csrfToken;
}

/**
 * Add CSRF token to fetch options
 */
async function addCsrfToken(options = {}) {
  const token = await getCsrfToken();
  
  if (!options.headers) {
    options.headers = {};
  }
  
  if (token) {
    options.headers['CSRF-Token'] = token;
  }
  
  return options;
}

/**
 * Enhanced fetch with automatic CSRF token injection
 */
async function fetchWithCsrf(url, options = {}) {
  // Ensure credentials are included to send session cookies
  options.credentials = 'include';
  
  // Add CSRF token for non-GET requests
  if (!options.method || options.method.toUpperCase() !== 'GET') {
    options = await addCsrfToken(options);
  }
  
  try {
    const response = await fetch(url, options);
    
    // If CSRF token is invalid, fetch new one and retry
    if (response.status === 403) {
      const data = await response.json();
      if (data.code === 'EBADCSRFTOKEN') {
        console.log('CSRF token expired, fetching new token...');
        csrfToken = null;
        options = await addCsrfToken(options);
        return fetch(url, options);
      }
    }
    
    return response;
  } catch (error) {
    console.error('Fetch error:', error);
    throw error;
  }
}

// Initialize CSRF token on page load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', fetchCsrfToken);
} else {
  fetchCsrfToken();
}
