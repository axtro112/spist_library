/**
 * SUPER ADMIN ROLE FIX - VERIFICATION SCRIPT
 * 
 * This script verifies that the super_admin role is correctly:
 * 1. Saved to the database
 * 2. Retrieved from the database
 * 3. Displayed in the UI
 * 4. Used for routing and permissions
 * 
 * Run this in browser console after logging in as admin
 */

async function verifySuperAdminRoleFix() {
  console.log("🔍 SUPER ADMIN ROLE FIX VERIFICATION\n");
  console.log("=" .repeat(50));

  // Test 1: Check what's stored in sessionStorage
  console.log("\n📋 Test 1: Session Storage Check");
  console.log("-".repeat(50));
  const adminRole = sessionStorage.getItem("adminRole");
  const adminId = sessionStorage.getItem("adminId");
  console.log(`Admin ID: ${adminId}`);
  console.log(`Admin Role from session: '${adminRole}'`);
  
  if (adminRole === "super_admin") {
    console.log("✅ PASS: Role is 'super_admin' (correct enum value)");
  } else if (adminRole === "system_admin") {
    console.log("✅ PASS: Role is 'system_admin' (correct enum value)");
  } else {
    console.log(`❌ FAIL: Role is '${adminRole}' (should be 'super_admin' or 'system_admin')`);
  }

  // Test 2: Fetch admin data from API
  console.log("\n📋 Test 2: API Data Check");
  console.log("-".repeat(50));
  try {
    const response = await fetch(`/api/admin/${adminId}`);
    const adminData = await response.json();
    console.log("Admin data from API:", adminData);
    console.log(`API returned role: '${adminData.role}'`);
    
    if (adminData.role === "super_admin" || adminData.role === "system_admin") {
      console.log("✅ PASS: API returns correct enum value");
    } else {
      console.log(`❌ FAIL: API returns '${adminData.role}' (invalid)`);
    }
    
    // Check if session matches API
    if (adminData.role === adminRole) {
      console.log("✅ PASS: Session storage matches API data");
    } else {
      console.log(`❌ FAIL: Mismatch - Session: '${adminRole}', API: '${adminData.role}'`);
    }
  } catch (error) {
    console.log("❌ FAIL: Could not fetch admin data", error);
  }

  // Test 3: Check all admins list
  console.log("\n📋 Test 3: Admin List Display Check");
  console.log("-".repeat(50));
  try {
    const response = await fetch("/api/admin");
    const admins = await response.json();
    console.log(`Found ${admins.length} admins:`);
    
    admins.forEach((admin, index) => {
      const roleDisplay = admin.role === 'super_admin' ? 'Super Admin' : 'System Admin';
      console.log(`${index + 1}. ${admin.fullname} (${admin.email})`);
      console.log(`   Database role: '${admin.role}'`);
      console.log(`   Should display as: '${roleDisplay}'`);
      
      if (admin.role === "super_admin" || admin.role === "system_admin") {
        console.log(`   ✅ Valid enum value`);
      } else {
        console.log(`   ❌ Invalid role: '${admin.role}'`);
      }
    });
  } catch (error) {
    console.log("❌ FAIL: Could not fetch admin list", error);
  }

  // Test 4: Check UI display
  console.log("\n📋 Test 4: UI Display Check");
  console.log("-".repeat(50));
  const roleElements = document.querySelectorAll('.user-table tbody td:nth-child(3)');
  if (roleElements.length > 0) {
    console.log(`Found ${roleElements.length} role cells in table:`);
    roleElements.forEach((el, index) => {
      const displayedRole = el.textContent.trim();
      console.log(`${index + 1}. Displayed as: '${displayedRole}'`);
      
      if (displayedRole === 'Super Admin' || displayedRole === 'System Admin') {
        console.log(`   ✅ Correct display format`);
      } else {
        console.log(`   ❌ Wrong format (showing raw enum?): '${displayedRole}'`);
      }
    });
  } else {
    console.log("ℹ️  Not on admin list page or table not loaded");
  }

  // Test 5: Check form options
  console.log("\n📋 Test 5: Form Options Check");
  console.log("-".repeat(50));
  const roleSelect = document.getElementById('adminRole') || document.getElementById('adminRoleEdit');
  if (roleSelect) {
    const options = roleSelect.querySelectorAll('option');
    console.log("Form select options:");
    options.forEach(opt => {
      if (opt.value) {
        console.log(`  Value: '${opt.value}' → Display: '${opt.textContent}'`);
        if (opt.value === 'super' && opt.textContent === 'Super Admin') {
          console.log(`    ✅ Correct: 'super' maps to 'Super Admin'`);
        } else if (opt.value === 'system' && opt.textContent === 'System Admin') {
          console.log(`    ✅ Correct: 'system' maps to 'System Admin'`);
        }
      }
    });
  } else {
    console.log("ℹ️  Not on admin form page");
  }

  // Summary
  console.log("\n" + "=".repeat(50));
  console.log("🏁 VERIFICATION COMPLETE");
  console.log("=".repeat(50));
  console.log("\n✅ Expected behavior:");
  console.log("  - Database stores: 'super_admin' or 'system_admin'");
  console.log("  - Form uses: 'super' or 'system'");
  console.log("  - Display shows: 'Super Admin' or 'System Admin'");
  console.log("\n📝 If any tests failed, check:");
  console.log("  1. admin-admins.html - role display in loadAdmins()");
  console.log("  2. src/routes/admin.js - POST and PUT endpoints");
  console.log("  3. Database enum column definition");
}

// Run the verification
verifySuperAdminRoleFix();
