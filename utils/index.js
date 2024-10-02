const crypto = require("crypto");

const generateBackupCodes = (count = 5) => {
  const codes = [];
  for (let i = 0; i < count; i++) {
    codes.push(crypto.randomBytes(4).toString("hex").toUpperCase()); // 8-character backup codes
  }
  return codes;
};

module.exports = { generateBackupCodes };
