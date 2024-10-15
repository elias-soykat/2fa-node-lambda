const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
  UpdateCommand,
  DeleteCommand,
} = require("@aws-sdk/lib-dynamodb");

const serverless = require("serverless-http");
const express = require("express");
const qrcode = require("qrcode");
const cors = require("cors");

const {
  generateBackupCodes,
  notFound,
  verifyAndRemoveBackupCode,
} = require("./utils");
const { authenticator } = require("otplib");

const app = express();
app.use(express.json());
app.use(cors());

const USERS_TABLE = process.env.USERS_TABLE;
const client = new DynamoDBClient();
const docClient = DynamoDBDocumentClient.from(client);

app.post("/api/generate-2fa-code", async (req, res) => {
  try {
    const userEmail = req.body.email
    if (!userEmail) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const secret = authenticator.generateSecret();
    const otpauthUrl = authenticator.keyuri(userEmail, "FundedNext", secret);
    const qrCode = await qrcode.toDataURL(otpauthUrl);
    const backupCodes = generateBackupCodes(5);

    const params = {
      TableName: USERS_TABLE,
      Item: {
        secret: secret,
        backupCodes: backupCodes,
        userEmail: userEmail,
      },
    };

    await docClient.send(new PutCommand(params));

    return res.status(201).json({ secret, qrCode, backupCodes });
  } catch (error) {
    return res.status(500).json({ error: "Internal server error" });
  }
});

app.post("/api/verify-2fa-code", async (req, res) => {
  const { token, secret, userEmail, isLogin, isBackupCode } = req.body;

  if (!token) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  try {
    if (!isLogin) {
      const isValid = authenticator.verify({ token, secret });
      if (isValid) {
        return res
          .status(200)
          .json({ verified: true, message: "2fa verified" });
      } else {
        return res
          .status(400)
          .json({ verified: false, message: "2fa not verified" });
      }
    }

    const params = {
      TableName: USERS_TABLE,
      Key: {
        userEmail: userEmail,
      },
    };

    const user = (await docClient.send(new GetCommand(params))).Item;
    if (!user) {
      return res
        .status(404)
        .json({ verified: false, message: "User not found" });
    }

    if (isBackupCode) {
      const isBackupCodeValid = user.backupCodes.includes(token);
      if (!isBackupCodeValid) {
        return res
          .status(400)
          .json({ verified: false, message: "Invalid backup code" });
      }

      const isBackupCodeUsed = await verifyAndRemoveBackupCode(user, token);
      if (isBackupCodeUsed) {
        return res
          .status(400)
          .json({ verified: false, message: "Backup code already used" });
      }

      return res
        .status(200)
        .json({ verified: true, message: "2fa verified using backup code" });
    }

    const isValidToken = authenticator.verify({ token, secret: user?.secret });
    if (isValidToken) {
      return res.status(200).json({ verified: true, message: "2fa verified" });
    }

    return res
      .status(400)
      .json({ verified: false, message: "Invalid 2FA code" });
  } catch (err) {
    return res.status(500).json({ error: "Internal server error" });
  }
});

app.use(notFound);
exports.handler = serverless(app);
