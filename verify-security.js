#!/usr/bin/env node
/**
 * Security Configuration Verification Script
 * Checks if environment variables are properly configured
 */

require('dotenv').config();

console.log('\n Security Configuration Verification\n');
console.log('=' .repeat(50));

const checks = [];

// Check SESSION_SECRET
if (process.env.SESSION_SECRET) {
  const length = process.env.SESSION_SECRET.length;
  if (length >= 64) {
    checks.push({ name: 'SESSION_SECRET', status: ' PASS', detail: `${length} characters` });
  } else {
    checks.push({ name: 'SESSION_SECRET', status: ' WEAK', detail: `${length} characters (should be 64+)` });
  }
} else {
  checks.push({ name: 'SESSION_SECRET', status: ' MISSING', detail: 'Not configured' });
}

// Check JWT_SECRET
if (process.env.JWT_SECRET) {
  const length = process.env.JWT_SECRET.length;
  if (length >= 64) {
    checks.push({ name: 'JWT_SECRET', status: ' PASS', detail: `${length} characters` });
  } else {
    checks.push({ name: 'JWT_SECRET', status: ' WEAK', detail: `${length} characters (should be 64+)` });
  }
} else {
  checks.push({ name: 'JWT_SECRET', status: ' MISSING', detail: 'Not configured' });
}

// Check NODE_ENV
if (process.env.NODE_ENV) {
  checks.push({ name: 'NODE_ENV', status: ' SET', detail: process.env.NODE_ENV });
} else {
  checks.push({ name: 'NODE_ENV', status: ' DEFAULT', detail: 'Will default to development' });
}

// Check Database Configuration
const dbChecks = ['DB_HOST', 'DB_USER', 'DB_NAME'];
dbChecks.forEach(key => {
  if (process.env[key]) {
    checks.push({ name: key, status: ' SET', detail: process.env[key] });
  } else {
    checks.push({ name: key, status: ' MISSING', detail: 'Not configured' });
  }
});

// Check Email Configuration
if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
  checks.push({ name: 'Email Config', status: ' SET', detail: process.env.EMAIL_USER });
} else {
  checks.push({ name: 'Email Config', status: ' INCOMPLETE', detail: 'Email or password missing' });
}

// Check Google OAuth
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  checks.push({ name: 'Google OAuth', status: ' SET', detail: 'Credentials configured' });
} else {
  checks.push({ name: 'Google OAuth', status: ' INCOMPLETE', detail: 'Credentials missing' });
}

// Display results
checks.forEach(check => {
  console.log(`${check.status} ${check.name.padEnd(20)} - ${check.detail}`);
});

console.log('=' .repeat(50));

// Summary
const passed = checks.filter(c => c.status.includes('')).length;
const total = checks.length;
const warnings = checks.filter(c => c.status.includes('')).length;
const errors = checks.filter(c => c.status.includes('')).length;

console.log(`\n Summary: ${passed}/${total} checks passed`);
if (warnings > 0) console.log(`  ${warnings} warnings`);
if (errors > 0) console.log(` ${errors} errors`);

// Security recommendations
console.log('\n�  Security Recommendations:\n');
if (process.env.NODE_ENV === 'production') {
  console.log('✓ Running in production mode');
  if (process.env.SESSION_SECURE_COOKIE !== 'true') {
    console.log('  Enable SESSION_SECURE_COOKIE=true with HTTPS');
  }
} else {
  console.log('  Development mode detected');
  console.log('   Remember to generate NEW secrets for production!');
}

console.log('\n Configuration check complete!\n');
