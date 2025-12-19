const express = require("express");
const router = express.Router();
const bcrypt = require("bcrypt");
const crypto = require("crypto");
const nodemailer = require("nodemailer");
const db = require("../config/database");
const passport = require("../config/passport");
require("dotenv").config();

const queryDB = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.query(sql, params, (err, results) => {
      if (err) reject(err);
      else resolve(results);
    });
  });
};

const authenticateAdmin = async (email, password) => {
  const adminResults = await queryDB("SELECT * FROM admins WHERE email = ?", [
    email,
  ]);

  if (adminResults.length === 0) return null;

  const admin = adminResults[0];
  const passwordMatch = await bcrypt.compare(password, admin.password);

  return passwordMatch ? admin : null;
};

const authenticateStudent = async (email, password) => {
  const studentResults = await queryDB(
    "SELECT * FROM students WHERE email = ?",
    [email]
  );

  if (studentResults.length === 0) return null;

  const student = studentResults[0];
  const passwordMatch = await bcrypt.compare(password, student.password);

  return passwordMatch ? student : null;
};

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const admin = await authenticateAdmin(email, password);
    if (admin) {
      // ✅ LOGIN: Return admin role exactly as stored in database
      console.log(`[AUTH] Admin login successful: ${admin.email} with role '${admin.role}'`);
      return res.json({
        success: true,
        userRole: "admin",
        adminId: admin.id,
        role: admin.role, // 'super_admin' or 'system_admin' from DB
      });
    }

    const student = await authenticateStudent(email, password);
    if (student) {
      return res.json({
        success: true,
        userRole: "student",
        studentId: student.student_id,
      });
    }

    return res.status(401).json({
      success: false,
      message: "Invalid credentials",
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({
      success: false,
      message: "An error occurred during login",
    });
  }
});

const checkExistingStudent = async (email, studentId) => {
  const existingUser = await queryDB(
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
    console.log("Received signup request with body:", req.body); // Add logging
    
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
      console.log("Missing required fields");
      return res.status(400).json({
        success: false,
        message: 'All fields are required',
      });
    }

    // Validate student_type against new ENUM values
    const validTypes = ['undergraduate', 'graduate', 'transferee'];
    if (!validTypes.includes(student_type)) {
      console.log("Invalid student type:", student_type);
      return res.status(400).json({
        success: false,
        message: 'Invalid student type. Must be: undergraduate, graduate, or transferee',
      });
    }

    const existingCheck = await checkExistingStudent(email, student_id);
    if (existingCheck.exists) {
      console.log("User already exists:", existingCheck.message);
      return res.status(400).json({
        success: false,
        message: existingCheck.message,
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const insertQuery = `
      INSERT INTO students (
        student_id, fullname, email, password, 
        department, year_level, student_type, 
        contact_number, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    console.log("Attempting to insert student with data:", {
      student_id, fullname, email, department, year_level, student_type, contact_number, status
    });

    await queryDB(insertQuery, [
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

    console.log("Student created successfully");
    res.json({
      success: true,
      message: "Account created successfully",
    });
  } catch (err) {
    console.error("Signup error details:", err);
    res.status(500).json({
      success: false,
      message: "Error creating account: " + err.message,
    });
  }
});

// Forgot Password Route - for both Admins and Students
router.post("/forgot-password", async (req, res) => {
  const { email } = req.body || {};
  if (!email) return res.status(400).json({ error: "Email is required" });

  const rawToken = crypto.randomBytes(32).toString("hex");
  const hashedToken = crypto.createHash("sha256").update(rawToken).digest("hex");
  const expiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  try {
    // Check if email exists in admins table
    const adminResults = await queryDB("SELECT id FROM admins WHERE email = ?", [email]);

    if (adminResults.length > 0) {
      await queryDB(
        "UPDATE admins SET resetToken = ?, resetTokenExpiry = ? WHERE email = ?",
        [hashedToken, expiry, email]
      );
    } else {
      // Check if email exists in students table
      const studentResults = await queryDB(
        "SELECT id FROM students WHERE email = ?",
        [email]
      );

      if (studentResults.length > 0) {
        await queryDB(
          "UPDATE students SET resetToken = ?, resetTokenExpiry = ? WHERE email = ?",
          [hashedToken, expiry, email]
        );
      } else {
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
    console.error("Forgot password error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

// Reset Password Route - Verify token and update password
router.post("/reset-password", async (req, res) => {
  const { token, newPassword } = req.body || {};

  if (!token) return res.status(400).json({ error: "Token is required" });
  if (!newPassword || newPassword.length < 6)
    return res.status(400).json({ error: "Password must be at least 6 characters" });

  const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

  try {
    // Check admin table first
    const adminResults = await queryDB(
      "SELECT id, email FROM admins WHERE resetToken = ? AND resetTokenExpiry > NOW()",
      [hashedToken]
    );

    if (adminResults.length > 0) {
      const hashedPassword = await bcrypt.hash(newPassword, 10);
      await queryDB(
        "UPDATE admins SET password = ?, resetToken = NULL, resetTokenExpiry = NULL WHERE id = ?",
        [hashedPassword, adminResults[0].id]
      );
      return res.json({ message: "Password reset successfully" });
    }

    // Check student table
    const studentResults = await queryDB(
      "SELECT id, email FROM students WHERE resetToken = ? AND resetTokenExpiry > NOW()",
      [hashedToken]
    );

    if (studentResults.length > 0) {
      const hashedPassword = await bcrypt.hash(newPassword, 10);
      await queryDB(
        "UPDATE students SET password = ?, resetToken = NULL, resetTokenExpiry = NULL WHERE id = ?",
        [hashedPassword, studentResults[0].id]
      );
      return res.json({ message: "Password reset successfully" });
    }

    // Token not found or expired
    return res.status(400).json({ error: "Invalid or expired reset token" });
  } catch (err) {
    console.error("Reset password error:", err);
    return res.status(500).json({ error: "Server error" });
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
  (req, res) => {
    // Successful authentication
    const user = req.user;
    
    if (user.userType === "admin") {
      // Set admin session data
      res.cookie("adminRole", user.role, { httpOnly: false, maxAge: 24 * 60 * 60 * 1000 });
      res.cookie("adminEmail", user.email, { httpOnly: false, maxAge: 24 * 60 * 60 * 1000 });
      res.cookie("adminName", user.fullname, { httpOnly: false, maxAge: 24 * 60 * 60 * 1000 });
      
      // Redirect based on role
      if (user.role === "super_admin") {
        res.redirect("/dashboard/super-admin/super-admin-dashboard.html");
      } else {
        res.redirect("/dashboard/admin/admin-dashboard.html");
      }
    } else {
      // Set student session data
      res.cookie("studentId", user.userId, { httpOnly: false, maxAge: 24 * 60 * 60 * 1000 });
      res.cookie("studentEmail", user.email, { httpOnly: false, maxAge: 24 * 60 * 60 * 1000 });
      res.cookie("studentName", user.fullname, { httpOnly: false, maxAge: 24 * 60 * 60 * 1000 });
      
      res.redirect("/dashboard/student/student-dashboard.html");
    }
  }
);

module.exports = router;
