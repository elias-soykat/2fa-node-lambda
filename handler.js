const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, PutCommand } = require("@aws-sdk/lib-dynamodb");

const cors = require("cors");
const express = require("express");
const serverless = require("serverless-http");
const { generateBackupCodes, checkBackupCode, notFound } = require("./utils");
const { authenticator } = require("otplib");
const qrcode = require("qrcode");

const app = express();
app.use(express.json());
app.use(cors());

const USERS_TABLE = process.env.USERS_TABLE;
const client = new DynamoDBClient();
const docClient = DynamoDBDocumentClient.from(client);

app.get("/api/generate-2fa-code", async (req, res) => {
  try {
    const userId = req.headers["x-user-id"];
    if (!userId) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const secret = authenticator.generateSecret();
    const otpauthUrl = authenticator.keyuri("2FA", "FundedNext", secret);
    const qrCodeData = await qrcode.toDataURL(otpauthUrl);
    const backupCodes = generateBackupCodes(5);

    const result = {
      secret: secret,
      qrCode: qrCodeData,
      backupCodes,
    };

    const params = {
      TableName: USERS_TABLE,
      Item: {
        secret: secret,
        backupCodes: backupCodes,
        userId: userId,
      },
    };

    await docClient.send(new PutCommand(params));

    return res.json(result);
  } catch (error) {
    return res.status(500).json({ error: "Internal server error" });
  }
});

app.post("/api/verify-2fa-code", async (req, res) => {
  const { token, secret, backupCode } = req.body;
  if (!token || !secret) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  try {
    const isValid = authenticator.verify({ token, secret });
    if (isValid) {
      return res.status(200).json({ verified: true });
    } else {
      const isBackupCode = checkBackupCode(backupCode);
      if (isBackupCode) {
        return res.status(200).json({ verified: true, method: "backup-code" });
      } else {
        return res.status(400).json({ verified: false });
      }
    }
  } catch (err) {
    return res.status(500).json({ error: "Internal server error" });
  }
});

app.use(notFound);

exports.handler = serverless(app);
