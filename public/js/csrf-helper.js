/**
 * CSRF Token Helper
 * Fetches and manages CSRF tokens for all API requests
 */

let csrfToken = null;

/**
 * Safely parse JSON from response
 * @param {Response} response - Fetch API response object
 * @returns {Promise<Object>} Parsed JSON data
 * @throws {Error} If response is not JSON or parsing fails
 */
async function safeJsonParse(response) {
  const contentType = response.headers.get("content-type");
  
  if (!contentType || !contentType.includes("application/json")) {
    throw new Error(`Expected JSON but got ${contentType || 'unknown content type'}. Server returned HTML error page.`);
  }
  
  try {
    return await response.json();
  } catch (error) {
    throw new Error(`Failed to parse JSON response: ${error.message}`);
  }
}

/**
 * Fetch CSRF token from server
 */
async function fetchCsrfToken() {
  try {
    console.log('[CSRF] Fetching token from /auth/csrf-token');
    const response = await fetch('/auth/csrf-token', {
      credentials: 'include'
    });
    const data = await response.json();
    if (data.success && data.csrfToken) {
      csrfToken = data.csrfToken;
      console.log('[CSRF] Token fetched successfully:', csrfToken.substring(0, 20) + '...');
      return csrfToken;
    } else {
      console.error('[CSRF] Failed to get token from response:', data);
    }
  } catch (error) {
    console.error('[CSRF] Error fetching CSRF token:', error);
  }
  return null;
}

/**
 * Get CSRF token (fetch if not cached)
 */
async function getCsrfToken() {
  if (!csrfToken) {
    console.log('[CSRF] No cached token, fetching new one');
    await fetchCsrfToken();
  } else {
    console.log('[CSRF] Using cached token');
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
    options.headers['x-csrf-token'] = token;
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
  const method = (options.method || 'GET').toUpperCase();
  if (method !== 'GET' && method !== 'HEAD') {
    const token = await getCsrfToken();

    if (!options.headers) {
      options.headers = {};
    }

    if (token) {
      options.headers['x-csrf-token'] = token;
      console.log(`[CSRF] Adding token to ${method} ${url}`);
    } else {
      console.error('[CSRF] No token available for request!');
    }
  }

  try {
    console.log(`[CSRF] Sending request to ${url} with options:`, options);
    const response = await fetch(url, options);
    console.log(`[CSRF] Response: ${response.status} for ${method} ${url}`);

    // If CSRF token is invalid, fetch new one and retry
    if (response.status === 403) {
      const contentType = response.headers.get("content-type");

      // Only try to parse as JSON if content-type indicates JSON
      if (contentType && contentType.includes("application/json")) {
        try {
          const data = await response.clone().json();
          console.log('[CSRF] Response JSON:', data);
          if (data.code === 'EBADCSRFTOKEN' || data.error === 'CSRF_TOKEN_INVALID') {
            console.log('[CSRF] Token expired, fetching new token and retrying...');
            csrfToken = null;
            const newToken = await getCsrfToken();

            if (newToken) {
              options.headers['x-csrf-token'] = newToken;
              console.log(`[CSRF] Retrying request to ${url} with new token`);
              return await fetch(url, options);
            } else {
              console.error('[CSRF] Failed to fetch new token, cannot retry request');
            }
          }
        } catch (e) {
          console.error('[CSRF] Error parsing 403 response JSON:', e);
        }
      }
    }

    return response;
  } catch (error) {
    console.error(`[CSRF] Error during fetch: ${error.message}`);
    throw error;
  }
}

// Initialize CSRF token on page load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', fetchCsrfToken);
} else {
  fetchCsrfToken();
}
