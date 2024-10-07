const {
  UpdateCommand,
  DynamoDBDocumentClient,
} = require("@aws-sdk/lib-dynamodb");
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");

const crypto = require("crypto");
const client = new DynamoDBClient();
const docClient = DynamoDBDocumentClient.from(client);

const USERS_TABLE = process.env.USERS_TABLE;

const generateBackupCodes = (count = 5) => {
  const codes = [];
  for (let i = 0; i < count; i++) {
    codes.push(crypto.randomBytes(3).toString("hex").toUpperCase());
  }
  return codes;
};

const verifyAndRemoveBackupCode = async (user, token) => {
  if (!user || !user.backupCodes || !user.userEmail) {
    throw new Error("Invalid user data");
  }

  // Check if the backup code has already been used
  const isBackupCodeUsed = !user.backupCodes.includes(token);
  if (isBackupCodeUsed) {
    return true; // Already used
  }

  // Remove the used backup code
  const updatedBackupCodes = user.backupCodes.filter((code) => code !== token);

  try {
    const updateParams = {
      TableName: USERS_TABLE,
      Key: { userEmail: user.userEmail },
      UpdateExpression: "SET backupCodes = :newBackupCodes",
      ExpressionAttributeValues: {
        ":newBackupCodes": updatedBackupCodes,
      },
      ReturnValues: "UPDATED_NEW",
    };

    await docClient.send(new UpdateCommand(updateParams));
    return false;
  } catch (err) {
    throw new Error("Error when updating backup codes");
  }
};

const notFound = (req, res, next) => {
  return res.status(404).json({
    error: "Not Found",
  });
};

module.exports = {
  generateBackupCodes,
  verifyAndRemoveBackupCode,
  notFound,
};
