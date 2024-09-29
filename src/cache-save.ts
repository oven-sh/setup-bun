import { saveCache } from "@actions/cache";
import { getState, warning } from "@actions/core";
import { CacheState } from "./action";
import { createHash } from "node:crypto";

(async () => {
  const state: CacheState = JSON.parse(getState("cache"));
  if (state.cacheEnabled && !state.cacheHit) {
    const cacheKey = createHash("sha1").update(state.url).digest("base64");

    try {
      await saveCache([state.bunPath], cacheKey);
      process.exit(0);
    } catch (error) {
      warning("Failed to save Bun to cache.");
    }
  }
})();
