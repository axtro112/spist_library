const nodemailer = require('nodemailer');
require('dotenv').config();

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: parseInt(process.env.EMAIL_PORT),
  secure: process.env.EMAIL_SECURE === 'true' ? true : false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

console.log('Testing email configuration...');
console.log('Host:', process.env.EMAIL_HOST);
console.log('Port:', process.env.EMAIL_PORT);
console.log('Secure:', process.env.EMAIL_SECURE);
console.log('User:', process.env.EMAIL_USER);
console.log('Pass:', process.env.EMAIL_PASS ? '***configured***' : 'NOT SET');

transporter.verify((error, success) => {
  if (error) {
    console.error('❌ Email transporter verification FAILED:');
    console.error(error.message);
    console.error('Full error:', error);
  } else {
    console.log('✅ Email transporter verified successfully!');
  }
  
  // Now try sending a test email
  if (!error) {
    console.log('\nAttempting to send test email...');
    
    transporter.sendMail({
      from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
      to: process.env.EMAIL_USER, // Send to self for testing
      subject: 'SPIST Library - Email Configuration Test',
      text: 'If you received this email, your SMTP configuration is working correctly!',
      html: '<h2>Email Configuration Test</h2><p>If you received this email, your SMTP configuration is working correctly!</p>'
    }, (err, info) => {
      if (err) {
        console.error('❌ Failed to send test email:');
        console.error(err.message);
        console.error('Full error:', err);
      } else {
        console.log('✅ Test email sent successfully!');
        console.log('Message ID:', info.messageId);
        console.log('Response:', info.response);
      }
      process.exit(0);
    });
  } else {
    process.exit(1);
  }
});
