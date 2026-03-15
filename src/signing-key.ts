import * as openpgp from "openpgp";
import { debug, info } from "@actions/core";
import { addGitHubApiHeaders } from "./github-api";
import { getCache, setCache } from "./filesystem-cache";
import { request } from "./utils";
import { getVksUrl, getHkpUrl, getGitHubGpgUrl } from "./url";

const ROBOBUN_FP = "F3DCC08A8572C0749B3E18888EAB4D40A7B22B59";
const ROBOBUN_STORAGE_KEY = `gpg-public-key-${ROBOBUN_FP}`;

/**
 * Validates the armored key and returns a clean, re-armored string.
 */
async function getCleanArmoredKey(input: string): Promise<string> {
  const key = await openpgp.readKey({ armoredKey: input });
  const actualFp = key.getFingerprint().toUpperCase();

  if (actualFp !== ROBOBUN_FP) {
    throw new Error(
      `Fingerprint mismatch: expected ${ROBOBUN_FP}, got ${actualFp}`,
    );
  }

  return key.armor();
}

/**
 * Retrieves the robobun public key from the 12-hour filesystem storage or the pool.
 */
export async function getSigningKey(token?: string): Promise<openpgp.Key> {
  // 1. Check Filesystem Storage
  const storedKey = getCache(ROBOBUN_STORAGE_KEY);
  if (storedKey) {
    try {
      const cleanKey = await getCleanArmoredKey(storedKey);
      info(`Retrieved verified public key from filesystem storage.`);
      return await openpgp.readKey({ armoredKey: cleanKey });
    } catch (err) {
      debug(
        `Failed to parse cached signing key [${ROBOBUN_STORAGE_KEY}]: ${err instanceof Error ? err.message : String(err)}`,
      );
      // Fall through to fetch fresh if stored data is corrupted
    }
  }

  // 2. Resolve via Pool (VKS -> HKP -> GitHub)
  const sources = [
    getVksUrl("keys.openpgp.org", ROBOBUN_FP),
    getHkpUrl("keyserver.ubuntu.com", ROBOBUN_FP),
    getGitHubGpgUrl("robobun"),
  ];

  for (const url of sources) {
    try {
      const parsedUrl = new URL(url);

      const headers = addGitHubApiHeaders(url, {}, token);
      const res = await request(url, { headers: headers });
      const rawText = await res.text();

      if (rawText.includes("-----BEGIN PGP PUBLIC KEY BLOCK-----")) {
        const cleanKey = await getCleanArmoredKey(rawText);

        // 3. Persist the sanitized armored block to the filesystem
        setCache(ROBOBUN_STORAGE_KEY, cleanKey);

        info(`Retrieved verified public key from ${parsedUrl.hostname}.`);
        return await openpgp.readKey({ armoredKey: cleanKey });
      }
    } catch (err) {
      debug(
        `Failed to fetch signing key from ${url}: ${err instanceof Error ? err.message : String(err)}`,
      );
      continue;
    }
  }

  throw new Error(
    `Failed to retrieve verified public key for ${ROBOBUN_FP} from all sources.`,
  );
}
