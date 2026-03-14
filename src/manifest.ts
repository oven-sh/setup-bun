import * as openpgp from "openpgp";
import { info, error } from "@actions/core";
import { request } from "./utils";
import { getSigningKey } from "./signing-key";

/**
 * Returns the 'Last-Modified' Date only if it is valid and falls
 * between 'created' and now. Otherwise returns undefined.
 */
export function getValidatedLastModified(
  res: Response,
  created: Date,
): Date | undefined {
  const headerValue = res.headers.get("Last-Modified");
  if (!headerValue) return undefined;

  const mtime = new Date(headerValue);
  const mtimeNum = mtime.getTime();

  // 1. Check for 'Invalid Date' (NaN)
  // 2. Ensure it isn't before the 'created' bound
  // 3. Ensure it isn't in the future (server clock drift)
  const isValid =
    !isNaN(mtimeNum) && mtimeNum > created.getTime() && mtimeNum < Date.now();

  return isValid ? mtime : undefined;
}

/**
 * Fetches the clearsigned manifest (.asc) and returns the verified text content.
 */
export async function getVerifiedManifest(
  downloadUrl: string,
  token?: string,
): Promise<string> {
  const parsedUrl = new URL(downloadUrl);
  parsedUrl.pathname = `${parsedUrl.pathname}.asc`;
  const ascUrl = parsedUrl.href;

  /**
   * Scoping the token to github.com prevents leaking credentials to
   * third-party servers while allowing for higher rate limits and
   * access to private repositories.
   */
  const isGitHub =
    "github.com" === parsedUrl.hostname && "https:" === parsedUrl.protocol;

  const res = await request(ascUrl, {
    headers: isGitHub && token ? { "Authorization": `Bearer ${token}` } : {},
  });

  const [armoredSignedMessage, publicKey] = await Promise.all([
    res.text(),
    getSigningKey(token),
  ]);
  // This must wait for armoredSignedMessage to be available.
  const cleartextMessage = await openpgp.readCleartextMessage({
    cleartextMessage: armoredSignedMessage,
  });

  const created = publicKey.getCreationTime();
  const fingerprint = publicKey.getFingerprint().toUpperCase();
  const trustedKeyID = publicKey.getKeyID().toHex().toLowerCase();

  info(`Trusted Key ID: ${trustedKeyID}`);
  info(`Trusted Fingerprint: ${fingerprint}`);

  /**
   * 'verification' holds a result object that includes the unverified data
   * and an array of signature metadata. The actual validity of the bytes
   * hasn't been checked yet.
   */
  const verification = await openpgp.verify({
    message: cleartextMessage,
    verificationKeys: publicKey,
    date: getValidatedLastModified(res, created) ?? new Date(),
    expectSigned: true,
    format: "utf8",
  });

  /**
   * Filter for the signature that matches our trusted robobun fingerprint.
   * This ensures we aren't misled by other signatures that might be present.
   */
  const signature = verification.signatures.find((sig) => {
    const signingKey = publicKey.getKeys(sig.keyID)[0];
    if (signingKey && publicKey.hasSameFingerprintAs(signingKey)) {
      return true;
    }

    const signingSubkeys = publicKey.getSubkeys(sig.keyID);
    for (const subKey of signingSubkeys) {
      if (subKey.mainKey.hasSameFingerprintAs(publicKey)) {
        return true;
      }
    }

    return false;
  });

  if (!signature) {
    throw new Error(`No PGP signatures from ${fingerprint} found in ${ascUrl}`);
  }

  /**
   * Log the signature details immediately. This allows us to see the
   * identity claims before the cryptographic verification is attempted.
   */
  info("Checking PGP signature...");
  info(`  - Key ID\t: ${signature.keyID.toHex().toLowerCase()}`);
  const signatureKey = publicKey.getKeys(signature.keyID)[0];
  info(`  - Fingerprint\t: ${signatureKey.getFingerprint().toUpperCase()}`);

  try {
    /**
     * MUST await 'verified' to perform the cryptographic check.
     * If the signature is invalid or tampered with, this throws.
     */
    const [verifyObj, sigObj] = await Promise.all([
      signature.verified,
      signature.signature,
    ]);

    const creationDate = sigObj.packets[0]?.created;
    info(
      `  - Signed On\t: ${creationDate instanceof Date ? creationDate.toISOString() : "Unknown"}`,
    );

    if (true === verifyObj) {
      info("\nSignature verified successfully.");
    }
  } catch (err: unknown) {
    const errMessage = (err as Error).message;
    error(`PGP Signature verification failed: ${errMessage}`);
    throw new Error(
      `PGP Signature verification failed for ${ascUrl}: ${errMessage}`,
    );
  }

  if (!verification.data) {
    throw new Error("Verified manifest text is empty or undefined.");
  }

  return verification.data;
}
