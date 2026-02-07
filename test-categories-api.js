const axios = require('axios');

(async () => {
  try {
    console.log('Testing /api/books/categories endpoint...\n');
    
    // Note: This test assumes the server is running on port 3000
    // and requires authentication. In a real scenario, you'd need to handle cookies/session
    const response = await axios.get('http://localhost:3000/api/books/categories', {
      withCredentials: true,
      headers: {
        'User-Agent': 'Node.js Test Script'
      }
    });
    
    console.log('Status:', response.status);
    console.log('Data:', JSON.stringify(response.data, null, 2));
  } catch (error) {
    if (error.response) {
      console.error('Error status:', error.response.status);
      console.error('Error data:', error.response.data);
    } else {
      console.error('Error:', error.message);
    }
  }
})();
