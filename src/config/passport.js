const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const db = require('../config/database');
require('dotenv').config();

// ================================================
// GOOGLE OAUTH CONFIGURATION
// ================================================
// Required environment variables in .env:
// GOOGLE_CLIENT_ID=your_client_id_here
// GOOGLE_CLIENT_SECRET=your_client_secret_here  
// GOOGLE_CALLBACK_URL=http://localhost:3000/auth/google/callback
// SESSION_SECRET=your_random_secret_string_here
// ================================================

const queryDB = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.query(sql, params, (err, results) => {
      if (err) reject(err);
      else resolve(results);
    });
  });
};

const hasGoogleOAuthConfig = Boolean(
  process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
);

if (hasGoogleOAuthConfig) {
  // Configure Passport to use Google OAuth 2.0 when credentials are available.
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:3000/auth/google/callback',
        passReqToCallback: true,
      },
      async (req, accessToken, refreshToken, profile, done) => {
        try {
          const googleId = profile.id;
          const email = profile.emails[0].value;
          const fullname = profile.displayName;

          console.log(`[GOOGLE AUTH] User authenticated: ${email} (Google ID: ${googleId})`);

          // Determine if user should be student or admin based on email domain
          const isAdminEmail = email.endsWith('@spist-admin.edu.ph') || email.includes('admin');

          if (isAdminEmail) {
            // ==================== ADMIN FLOW ====================
            // Check if admin already exists by google_id or email
            let admin = await queryDB(
              'SELECT * FROM admins WHERE google_id = ? OR email = ?',
              [googleId, email]
            );

            if (admin.length > 0) {
              // Existing admin - update google_id if not set
              admin = admin[0];
              if (!admin.google_id) {
                await queryDB('UPDATE admins SET google_id = ? WHERE id = ?', [googleId, admin.id]);
                console.log(`[GOOGLE AUTH] Linked Google account to existing admin: ${email}`);
              }
            } else {
              // New admin - create with system_admin role by default
              //  CHANGE 'system_admin' TO 'super_admin' IF NEEDED
              // Validate fullname
              if (!fullname || fullname.trim() === '') {
                console.error('[GOOGLE AUTH] Fullname is missing for Google user:', email);
                return done(new Error('Fullname is required for Google authentication'));
              }

              const trimmedFullname = fullname.trim();

              const result = await queryDB(
                'INSERT INTO admins (google_id, fullname, email, role, password, created_at) VALUES (?, ?, ?, ?, NULL, NOW())',
                [googleId, trimmedFullname, email, 'system_admin']
              );
              admin = {
                id: result.insertId,
                google_id: googleId,
                fullname,
                email,
                role: 'system_admin',
              };
              console.log(`[GOOGLE AUTH] Created new admin via Google: ${email} with role 'system_admin'`);
            }

            return done(null, {
              userType: 'admin',
              userId: admin.id,
              role: admin.role,
              email: admin.email,
              fullname: admin.fullname,
            });
          } else {
            // ==================== STUDENT FLOW ====================
            // Check if student already exists by google_id or email
            let student = await queryDB(
              'SELECT * FROM students WHERE google_id = ? OR email = ?',
              [googleId, email]
            );

            if (student.length > 0) {
              // Existing student - update google_id if not set
              student = student[0];
              if (!student.google_id) {
                await queryDB('UPDATE students SET google_id = ? WHERE student_id = ?', [googleId, student.student_id]);
                console.log(`[GOOGLE AUTH] Linked Google account to existing student: ${email}`);
              }
            } else {
              // New student - create with default values
              //  CUSTOMIZE DEFAULT VALUES AS NEEDED
              const studentId = `GOOGLE-${Date.now()}`; // Temporary ID format
              await queryDB(
                `INSERT INTO students (
                  student_id, google_id, fullname, email, password,
                  department, education_stage, year_level, student_type, status, created_at
                ) VALUES (?, ?, ?, ?, NULL, ?, ?, ?, ?, ?, NOW())`,
                [studentId, googleId, fullname, email, '', 'College', '1st Year', 'undergraduate', 'active']
              );
              student = {
                student_id: studentId,
                google_id: googleId,
                fullname,
                email,
                department: '',
                education_stage: 'College',
                year_level: '1st Year',
                student_type: 'undergraduate',
                status: 'active',
              };
              console.log(`[GOOGLE AUTH] Created new student via Google: ${email}`);
            }

            return done(null, {
              userType: 'student',
              userId: student.student_id,
              email: student.email,
              fullname: student.fullname,
            });
          }
        } catch (error) {
          console.error('[GOOGLE AUTH] Error during authentication:', error);
          return done(error, null);
        }
      }
    )
  );
} else {
  console.warn('[GOOGLE AUTH] Disabled: GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET not configured.');
}

passport.isGoogleOAuthConfigured = hasGoogleOAuthConfig;

// Serialize user for session
passport.serializeUser((user, done) => {
  done(null, user);
});

// Deserialize user from session
passport.deserializeUser((user, done) => {
  done(null, user);
});

module.exports = passport;
