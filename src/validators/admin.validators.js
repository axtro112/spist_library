const { body, validationResult } = require('express-validator');

const createAdminRules = [
  body('fullname')
    .trim()
    .notEmpty().withMessage('Full name is required')
    .isLength({ min: 2 }).withMessage('Full name must be at least 2 characters')
    .isLength({ max: 80 }).withMessage('Full name must not exceed 80 characters'),

  body('email')
    .trim()
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('A valid email address is required')
    .customSanitizer(v => v.toLowerCase()),

  body('password')
    .notEmpty().withMessage('Password is required')
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
    .isLength({ max: 72 }).withMessage('Password is too long (max 72 characters)'),

  body('role')
    .notEmpty().withMessage('Role is required')
    .isIn(['system_admin', 'super_admin'])
    .withMessage("Role must be 'system_admin' or 'super_admin'"),
];

/**
 * Express middleware: returns 422 with first error message if validation fails.
 * Sets data.message to the first error so admin-management.js can show it directly.
 */
function validate(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const errs = errors.array();
    return res.status(422).json({
      success: false,
      message: errs[0].msg,
      errors: errs,
    });
  }
  next();
}

module.exports = { createAdminRules, validate };
