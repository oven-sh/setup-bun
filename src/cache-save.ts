import { homedir } from "node:os";
import { join } from "node:path";
import { saveCache } from "@actions/cache";
import { getState, warning } from "@actions/core";
import { CacheState } from "./action";
import { getCacheKey } from "./utils";
(async () => {
  const rawState = getState("cache");
  if (!rawState) {
    process.exit(0);
  }

  const state: CacheState = JSON.parse(rawState);
  if (state.cacheEnabled && !state.cacheHit) {
    const bunPath = state.bunPath;
    const statePath = join(homedir(), ".bun", "bun.json");
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
