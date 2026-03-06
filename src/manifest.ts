import * as openpgp from "openpgp";
import { info, error } from "@actions/core";
import { request } from "./utils";
import { getSigningKey } from "./signing-key";

/**
 * Extracts the creation date from an OpenPGP v6 signature object.
 */
async function getSignatureDate(signature: any): Promise<Date | null> {
  if (null === signature) return null;

  try {
    // 1. Official v6 async getter
    if ("function" === typeof signature.getCreationTime) {
      const date = await signature.getCreationTime();
      if (date instanceof Date) return date;
    }

    const sigPacket = signature.signaturePacket;
    if (null !== sigPacket && undefined !== sigPacket) {
      // 2. Search Hashed Subpackets (Spec Type 2: Signature Creation Time)
      const subpackets = [
        ...(sigPacket.hashedSubpackets || []),
        ...(sigPacket.subpackets || []),
      ];

      const creationSub = subpackets.find(
        (p) => 2 === p?.type || undefined !== p?.creationTime,
      );
      if (
        undefined !== creationSub &&
        creationSub?.creationTime instanceof Date
      ) {
        return creationSub.creationTime;
      }
      // 2b. v6 internal subpacket search (Type 2 is Creation Time)
      // We convert to Array because v6 subpackets can be an Iterable/Map
      const hashed = sigPacket.hashedSubpackets || [];
      const unhashed = sigPacket.unhashedSubpackets || [];
      const allSubpackets = [...hashed, ...unhashed];

      for (const p of allSubpackets) {
        if (2 === p?.type && p?.creationTime instanceof Date) {
          return p.creationTime;
        }
      }

      // 3. Check for the synchronous 'created' property
      if (sigPacket.created instanceof Date) {
        return sigPacket.created;
      }

      // 4. Try the packet-level getter
      if ("function" === typeof sigPacket.getCreationTime) {
        const date = await sigPacket.getCreationTime();
        if (date instanceof Date) return date;
      }
    }

    // 5. Deep Search in 'packets' array
    const packets = signature.packets || [];
    if (Array.isArray(packets)) {
      for (const p of packets) {
        if ("function" === typeof p.getCreationTime) {
          const date = await p.getCreationTime();
          if (date instanceof Date) return date;
        }
      }
    }
  } catch (err) {
    // Silently continue
  }

  return null;
}

/**
 * Fetches the clearsigned manifest (.asc) and returns the verified text content.
 */
export async function getVerifiedManifest(
  downloadUrl: string,
  token?: string,
): Promise<string> {
  const ascUrl = `${downloadUrl}.asc`;
  const parsedUrl = new URL(ascUrl);

  /**
   * Scoping the token to github.com prevents leaking credentials to
   * third-party servers while allowing for higher rate limits and
   * access to private repositories.
   */
  const isGitHub = "github.com" === parsedUrl.hostname;

  const res = await request(ascUrl, {
    headers: isGitHub && token ? { "Authorization": `Bearer ${token}` } : {},
  });

  const armoredSignedMessage = await res.text();

  /**
   * We run these in parallel to avoid "waterfalling" the async work:
   * 1. getSigningKey: Resolves/validates the 'robobun' public key from storage or pool.
   * 2. readCleartextMessage: Parses the raw string into an OpenPGP message object.
   */
  const [publicKey, message] = await Promise.all([
    getSigningKey(token),
    openpgp.readCleartextMessage({ cleartextMessage: armoredSignedMessage }),
  ]);

  const fingerprint = publicKey.getFingerprint().toUpperCase();

  /**
   * 'verification' holds a result object that includes the unverified data
   * and an array of signature metadata. The actual validity of the bytes
   * hasn't been checked yet.
   */
  const verification = await openpgp.verify({
    message,
    verificationKeys: publicKey,
    format: "utf8",
  });

  const trustedKeyID = publicKey.getKeyID().toHex().toLowerCase();

  info(`Trusted Key ID: ${trustedKeyID}`);
  info(`Trusted Fingerprint: ${fingerprint}`);

  /**
   * Filter for the signature that matches our trusted robobun fingerprint.
   * This ensures we aren't misled by other signatures that might be present.
   */
  const signature = verification.signatures.find((sig) => {
    const sigKeyID = sig.keyID.toHex().toLowerCase();

    const sigFingerprint = sig.signingKey?.getFingerprint().toUpperCase();
    if (
      (sigFingerprint && sigFingerprint === fingerprint) ||
      sigKeyID === trustedKeyID
    ) {
      return true;
    }

    const signingSubkey = publicKey.getCommonKeys(sig.keyID)[0];
    if (signingSubkey) {
      return signingSubkey.getFingerprint().toUpperCase() === fingerprint;
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
  // In v6, the creation time might be in the signature object directly
  // or inside the internal packets.
  const creationDate = await getSignatureDate(signature);
  info("Checking PGP signature...");
  info(
    `- Signed On: ${creationDate instanceof Date ? creationDate.toISOString() : "Unknown"}`,
  );
  info(`- Key ID: ${signature.keyID.toHex().toLowerCase()}`);
  info(`- Fingerprint: ${fingerprint}\n`);

  const { verified, data } = signature;

  try {
    /**
     * MUST await 'verified' to perform the cryptographic check.
     * If the signature is invalid or tampered with, this throws.
     */
    await verified;
    info("Signature verified successfully.");
  } catch (err: unknown) {
    const message = (err as Error).message;
    error(`PGP Signature verification failed: ${message}`);
    throw new Error(
      `PGP Signature verification failed for ${ascUrl}: ${message}`,
    );
  }

  /**
   * In v6, signature.data is undefined for cleartext.
   * Use the 'message' object which is the CleartextMessage.
   */
  const text = message.getText();
  if (!text) {
    throw new Error("Verified manifest text is empty or undefined.");
  }

  return text;
}
