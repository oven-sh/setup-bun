import { saveCache } from "@actions/cache";
import { getState, warning } from "@actions/core";
import { CacheState } from "./action";

(async () => {
  const state: CacheState = JSON.parse(getState("cache"));
  if (state.cacheEnabled && !state.cacheHit) {
    try {
      await saveCache([state.bunPath], state.url);
      process.exit(0);
    } catch (error) {
      warning("Failed to save Bun to cache.");
    }
  }
})();
