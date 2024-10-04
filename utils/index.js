const crypto = require("crypto");

const generateBackupCodes = (count = 5) => {
  const codes = [];
  for (let i = 0; i < count; i++) {
    codes.push(crypto.randomBytes(4).toString("hex").toUpperCase()); // 8-character backup codes
  }
  return codes;
};

const checkBackupCode = (userId, code) => {
  // Fetch backup codes from database for the user
  const backupCodes = ["BACKUP1", "BACKUP2", "BACKUP3"]; // Example codes; replace with actual DB fetch logic

  if (backupCodes.includes(code)) {
    // Remove the used backup code from the database
    return true; // Valid backup code
  }

  return false; // Invalid backup code
};

const notFound = (req, res, next) => {
  return res.status(404).json({
    error: "Not Found",
  });
};

module.exports = { generateBackupCodes, checkBackupCode, notFound };
