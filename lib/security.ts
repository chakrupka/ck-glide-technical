import crypto from "crypto";

const getSSNEncryptionKey = () => {
  const key = process.env.SSN_ENCRYPTION_KEY;
  if (key) {
    return crypto.createHash("sha256").update(key).digest();
  }

  // dev fallback
  return crypto.createHash("sha256").update("local-dev-ssn-key").digest();
};

export const encryptSSN = (ssn: string): string => {
  const key = getSSNEncryptionKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(ssn, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return [
    iv.toString("hex"),
    authTag.toString("hex"),
    encrypted.toString("hex"),
  ].join(":");
};
