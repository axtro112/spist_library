// Super Admin Role Guard
// This script ensures only super_admin role can access super admin pages

(function() {
  'use strict';

  function checkSuperAdminAccess() {
    const isLoggedIn = sessionStorage.getItem("isLoggedIn");
    const userRole = sessionStorage.getItem("userRole");
    const adminRole = sessionStorage.getItem("adminRole");

    if (isLoggedIn !== "true" || userRole !== "admin") {
      console.warn("Not logged in or not an admin");
      return false;
    }

    if (adminRole !== "super_admin") {
      console.warn("Access denied: Super Admin role required");
      return false;
    }

    return true;
  }

  // Auto-check on pages that include this script
  window.checkSuperAdminAccess = checkSuperAdminAccess;
  
  console.log("Super Admin guard loaded");
})();
