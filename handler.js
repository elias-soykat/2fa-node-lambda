const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");

const {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
} = require("@aws-sdk/lib-dynamodb");

const QRCode = require("qrcode");
const speakeasy = require("speakeasy");

const express = require("express");
const serverless = require("serverless-http");
const { generateBackupCodes } = require("./utils");

const app = express();

const USERS_TABLE = process.env.USERS_TABLE;
const client = new DynamoDBClient();
const docClient = DynamoDBDocumentClient.from(client);

app.use(express.json());

app.get("/api/generate-2fa-code", async (req, res) => {
  try {
    const secret = speakeasy.generateSecret({
      name: "FundedNext",
    });
    const qrCodeData = await QRCode.toDataURL(secret.otpauth_url);
    const backupCodes = generateBackupCodes(5);

    return res.json({
      secret: secret.base32,
      qrCode: qrCodeData,
      backupCodes,
    });
  } catch (error) {
    return res.status(500).json({ error: "Internal server error" });
  }
});

app.post("/users", async (req, res) => {
  const { userId, name } = req.body;
  if (typeof userId !== "string") {
    res.status(400).json({ error: '"userId" must be a string' });
  } else if (typeof name !== "string") {
    res.status(400).json({ error: '"name" must be a string' });
  }

  const params = {
    TableName: USERS_TABLE,
    Item: { userId, name },
  };

  try {
    const command = new PutCommand(params);
    await docClient.send(command);
    res.json({ userId, name });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Could not create user" });
  }
});

app.use((req, res, next) => {
  return res.status(404).json({
    error: "Not Found",
  });
});

exports.handler = serverless(app);
