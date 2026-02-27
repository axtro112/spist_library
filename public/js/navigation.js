/**
 * Navigation.js
 * Handles navigation logic for public pages
 */

// Set active navigation item based on current path
document.addEventListener('DOMContentLoaded', () => {
  const currentPath = window.location.pathname;
  const navLinks = document.querySelectorAll('.primaryNavigation a');
  
  navLinks.forEach(link => {
    const href = link.getAttribute('href');
    
    // Check if this is the current page
    if (
      (href === '/' && currentPath === '/') ||
      (href !== '/' && currentPath.startsWith(href))
    ) {
      link.classList.add('active');
    }
  });
});

console.log('navigation.js loaded successfully');
