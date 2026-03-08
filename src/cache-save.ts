import { saveCache } from "@actions/cache";
import { getState, warning } from "@actions/core";
import { CacheState } from "./action";
import { getCacheKey } from "./utils";
(async () => {
  const state: CacheState = JSON.parse(getState("cache"));
  if (state.cacheEnabled && !state.cacheHit) {
    const bunPath = state.bunPath;
    const statePath = `${bunPath}.json`;
    const cacheKey = getCacheKey(state.url);
    const cachePaths = [bunPath, statePath];

    try {
      await saveCache(cachePaths, cacheKey);
      process.exit(0);
    } catch (error) {
      warning("Failed to save Bun to cache.");
    }
  }
})();
