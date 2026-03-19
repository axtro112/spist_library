﻿const express = require("express");
const router = express.Router();
const bcrypt = require("bcrypt");
const crypto = require("crypto");
const nodemailer = require("nodemailer");
const db = require("../utils/db");
const response = require("../utils/response");
const logger = require("../utils/logger");
const passport = require("../config/passport");
require("dotenv").config();

function saveSession(req) {
  return new Promise((resolve, reject) => {
    req.session.save((err) => {
      if (err) return reject(err);
      resolve();
    });
  });
}

const authenticateAdmin = async (email, password) => {
  const adminResults = await db.query("SELECT * FROM admins WHERE email = ?", [
    email,
  ]);

  if (adminResults.length === 0) return null;

  const admin = adminResults[0];
  
  // Check if password exists in database
  if (!admin.password) {
    logger.warn('Admin login attempt with no password set', { email: admin.email });
    return null;
  }
  
  const passwordMatch = await bcrypt.compare(password, admin.password);

  return passwordMatch ? admin : null;
};

const authenticateStudent = async (email, password) => {
  const studentResults = await db.query(
    "SELECT * FROM students WHERE email = ?",
    [email]
  );

  if (studentResults.length === 0) return null;

  const student = studentResults[0];
  
  // Check if password exists in database
  if (!student.password) {
    logger.warn('Student login attempt with no password set', { email: student.email });
    return null;
  }
  
  const passwordMatch = await bcrypt.compare(password, student.password);

  return passwordMatch ? student : null;
};

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required'
      });
    }

    const admin = await authenticateAdmin(email, password);
    if (admin) {
      logger.info('Admin login successful', { email: admin.email, role: admin.role });
      
      // Set session
      req.session.user = {
        id: admin.id,
        email: admin.email,
        userRole: "admin",
        role: admin.role
      };

      await saveSession(req);
      
      return res.json({
        success: true,
        userRole: "admin",
        adminId: admin.id,
        role: admin.role, // 'super_admin' or 'system_admin' from DB
      });
    }

    const student = await authenticateStudent(email, password);
    if (student) {
      logger.info('Student login successful', { email: student.email, studentId: student.student_id });
      // Set session
      req.session.user = {
        id: student.id,
        studentId: student.student_id,
        email: student.email,
        userRole: "student"
      };

      await saveSession(req);
      
      return res.json({
        success: true,
        userRole: "student",
        studentId: student.student_id,
      });
    }

    logger.warn('Failed login attempt', { email });
    return res.status(401).json({
      success: false,
      message: 'Invalid credentials'
    });
  } catch (err) {
    logger.error('Login error', { error: err.message, stack: err.stack });
    return res.status(500).json({
      success: false,
      message: 'An error occurred during login',
      error: process.env.NODE_ENV !== 'production' ? err.message : undefined
    });
  }
});

const checkExistingStudent = async (email, studentId) => {
  const existingUser = await db.query(
    "SELECT * FROM students WHERE email = ? OR student_id = ?",
    [email, studentId]
  );

  if (existingUser.length > 0) {
    const message =
      existingUser[0].email === email
        ? "Email already exists"
        : "Student ID already exists";
    return { exists: true, message };
  }

  return { exists: false };
};

router.post("/signup", async (req, res) => {
  try {
    logger.debug('Signup request received', { body: req.body });
    
    const {
      student_id,
      fullname,
      email,
      password,
      department,
      year_level,
      student_type,
      contact_number,
      status,
    } = req.body;

    // Validate required fields
    if (!student_id || !fullname || !email || !password || !department || !year_level || !student_type || !contact_number) {
      logger.warn('Signup attempt with missing fields');
      return response.validationError(res, 'All fields are required');
    }

    const existingCheck = await checkExistingStudent(email, student_id);
    if (existingCheck.exists) {
      logger.warn('Signup attempt with existing user', { email, student_id });
      return response.validationError(res, existingCheck.message);
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const insertQuery = `
      INSERT INTO students (
        student_id, fullname, email, password, 
        department, year_level, student_type, 
        contact_number, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    logger.debug('Creating new student account', { student_id, email, department });

    await db.query(insertQuery, [
      student_id,
      fullname,
      email,
      hashedPassword,
      department,
      year_level,
      student_type,
      contact_number,
      status || 'active',
    ]);

    logger.info('Student account created successfully', { student_id, email });
    response.success(res, null, 'Account created successfully', 201);
  } catch (err) {
    logger.error('Signup error', { error: err.message });
    response.error(res, 'Error creating account: ' + err.message, err);
  }
});

// Forgot Password Route - for both Admins and Students
router.post("/forgot-password", async (req, res) => {
  const { email } = req.body || {};
  if (!email) return response.validationError(res, 'Email is required');

  const rawToken = crypto.randomBytes(32).toString("hex");
  const hashedToken = crypto.createHash("sha256").update(rawToken).digest("hex");
  const expiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  try {
    // Check if email exists in admins table
    const adminResults = await db.query("SELECT id FROM admins WHERE email = ?", [email]);

    if (adminResults.length > 0) {
      await db.query(
        "UPDATE admins SET resetToken = ?, resetTokenExpiry = ? WHERE email = ?",
        [hashedToken, expiry, email]
      );
      logger.info('Password reset requested for admin', { email });
    } else {
      // Check if email exists in students table
      const studentResults = await db.query(
        "SELECT id FROM students WHERE email = ?",
        [email]
      );

      if (studentResults.length > 0) {
        await db.query(
          "UPDATE students SET resetToken = ?, resetTokenExpiry = ? WHERE email = ?",
          [hashedToken, expiry, email]
        );
        logger.info('Password reset requested for student', { email });
      } else {
        logger.warn('Password reset requested for non-existent email', { email });
        // Do not leak existence - return generic message
        return res.json({ message: "If this email exists, a reset link was sent." });
      }
    }

    // Send Reset Email
    const transporter = nodemailer.createTransport({
      service: "Gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    const resetLink = `${process.env.FRONTEND_URL || "http://localhost:3000"}/reset-password?token=${encodeURIComponent(rawToken)}`;

    await transporter.sendMail({
      to: email,
      subject: "Reset Your Password - SPIST Library Management System",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">Password Reset Request</h2>
          <p>You requested to reset your password for your SPIST Library account.</p>
          <p>Click the button below to reset your password:</p>
          <a href="${resetLink}" style="display: inline-block; padding: 10px 20px; background-color: #007bff; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0;">
            Reset Password
          </a>
          <p><strong>Or copy this link:</strong></p>
          <p>${resetLink}</p>
          <p style="color: #666; font-size: 12px;">This link will expire in 10 minutes.</p>
          <p style="color: #666; font-size: 12px;">If you didn't request this, please ignore this email.</p>
        </div>
      `,
    });

    return res.json({ message: "If this email exists, a reset link was sent." });
  } catch (err) {
    logger.error('Forgot password error', { error: err.message });
    response.error(res, 'Server error', err);
  }
});

// Reset Password Route - Verify token and update password
router.post("/reset-password", async (req, res) => {
  const { token, newPassword } = req.body || {};

  if (!token) return response.validationError(res, 'Token is required');
  if (!newPassword || newPassword.length < 6)
    return response.validationError(res, 'Password must be at least 6 characters');

  const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

  try {
    // Check admin table first
    const adminResults = await db.query(
      "SELECT id, email FROM admins WHERE resetToken = ? AND resetTokenExpiry > NOW()",
      [hashedToken]
    );

    if (adminResults.length > 0) {
      const hashedPassword = await bcrypt.hash(newPassword, 10);
      await db.query(
        "UPDATE admins SET password = ?, resetToken = NULL, resetTokenExpiry = NULL WHERE id = ?",
        [hashedPassword, adminResults[0].id]
      );
      logger.info('Admin password reset successfully', { email: adminResults[0].email });
      return res.json({ message: "Password reset successfully" });
    }

    // Check student table
    const studentResults = await db.query(
      "SELECT id, email FROM students WHERE resetToken = ? AND resetTokenExpiry > NOW()",
      [hashedToken]
    );

    if (studentResults.length > 0) {
      const hashedPassword = await bcrypt.hash(newPassword, 10);
      await db.query(
        "UPDATE students SET password = ?, resetToken = NULL, resetTokenExpiry = NULL WHERE id = ?",
        [hashedPassword, studentResults[0].id]
      );
      logger.info('Student password reset successfully', { email: studentResults[0].email });
      return res.json({ message: "Password reset successfully" });
    }

    // Token not found or expired
    logger.warn('Invalid or expired reset token used');
    return response.validationError(res, 'Invalid or expired reset token');
  } catch (err) {
    logger.error('Reset password error', { error: err.message });
    response.error(res, 'Server error', err);
  }
});

// Google OAuth Routes
router.get(
  "/google",
  passport.authenticate("google", { scope: ["profile", "email"] })
);

router.get(
  "/google/callback",
  passport.authenticate("google", { failureRedirect: "/login.html" }),
  async (req, res) => {
    // Successful authentication
    const user = req.user;
    
    if (user.userType === "admin") {
      // Populate req.session.user so requireAdmin middleware passes (same shape as email/password login)
      req.session.user = {
        id: user.userId,
        email: user.email,
        userRole: "admin",
        role: user.role,
      };

      await saveSession(req);

      // Set admin cookies for client-side use
      res.cookie("adminRole", user.role, { httpOnly: false, maxAge: 24 * 60 * 60 * 1000 });
      res.cookie("adminEmail", user.email, { httpOnly: false, maxAge: 24 * 60 * 60 * 1000 });
      res.cookie("adminName", user.fullname, { httpOnly: false, maxAge: 24 * 60 * 60 * 1000 });
      
      // Redirect based on role
      if (user.role === "super_admin") {
        res.redirect("/super-admin-dashboard");
      } else {
        res.redirect("/admin-dashboard");
      }
    } else {
      // Populate session for student too
      req.session.user = {
        id: user.userId,
        studentId: user.userId,
        email: user.email,
        userRole: "student",
      };

      await saveSession(req);

      // Set student cookies for client-side use
      res.cookie("studentId", user.userId, { httpOnly: false, maxAge: 24 * 60 * 60 * 1000 });
      res.cookie("studentEmail", user.email, { httpOnly: false, maxAge: 24 * 60 * 60 * 1000 });
      res.cookie("studentName", user.fullname, { httpOnly: false, maxAge: 24 * 60 * 60 * 1000 });
      
      res.redirect("/dashboard/student/student-dashboard.html");
    }
  }
);

// GET /auth/csrf-token - Returns a dummy token (CSRF disabled for auth routes)
// Login is protected by bcrypt, rate limiting, and session-based auth
router.get("/csrf-token", (req, res) => {
  logger.info("CSRF token requested");
  res.json({
    success: true,
    csrfToken: "no-csrf",
  });
});

// POST /auth/logout  — destroys the server-side session
router.post("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      logger.error("Session destroy error on logout", { error: err.message });
    }
    res.clearCookie("spist_library_session");
    res.json({ success: true, message: "Logged out successfully" });
  });
});

module.exports = router;