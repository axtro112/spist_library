/**
 * Shared API utility functions
 * Handles CSRF tokens, error handling, and response parsing
 */

/**
 * Make API request with CSRF protection
 * @param {string} url - API endpoint URL
 * @param {Object} options - Fetch options
 * @returns {Promise<Object>} Parsed JSON response
 */
async function apiRequest(url, options = {}) {
  try {
    if (!options.headers) {
      options.headers = {};
    }
    
    // Add CSRF token for protected routes
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(options.method?.toUpperCase())) {
      const token = await getCsrfToken();
      options.headers['CSRF-Token'] = token;
    }
    
    // Set default content type if not specified
    if (!options.headers['Content-Type'] && options.body && typeof options.body === 'string') {
      options.headers['Content-Type'] = 'application/json';
    }
    
    const response = await fetch(url, options);
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.message || `HTTP ${response.status}: ${response.statusText}`);
    }
    
    return data;
    
  } catch (error) {
    console.error('[API ERROR]', url, error);
    throw error;
  }
}

/**
 * GET request
 * @param {string} url - API endpoint URL
 * @returns {Promise<Object>} Response data
 */
async function get(url) {
  return apiRequest(url, { method: 'GET' });
}

/**
 * POST request
 * @param {string} url - API endpoint URL
 * @param {Object} data - Request body
 * @returns {Promise<Object>} Response data
 */
async function post(url, data) {
  return apiRequest(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
}

/**
 * PUT request
 * @param {string} url - API endpoint URL
 * @param {Object} data - Request body
 * @returns {Promise<Object>} Response data
 */
async function put(url, data) {
  return apiRequest(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
}

/**
 * DELETE request
 * @param {string} url - API endpoint URL
 * @returns {Promise<Object>} Response data
 */
async function del(url) {
  return apiRequest(url, { method: 'DELETE' });
}

/**
 * Upload file with form data
 * @param {string} url - API endpoint URL
 * @param {FormData} formData - Form data with file
 * @returns {Promise<Object>} Response data
 */
async function upload(url, formData) {
  const token = await getCsrfToken();
  
  return apiRequest(url, {
    method: 'POST',
    headers: {
      'CSRF-Token': token
    },
    body: formData
  });
}

// Export API methods
window.api = {
  request: apiRequest,
  get,
  post,
  put,
  delete: del,
  upload
};
