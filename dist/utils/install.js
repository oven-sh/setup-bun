import { cacheDir, downloadTool, extractZip, find } from '@actions/tool-cache';
import { restoreCache, saveCache } from '@actions/cache';
import { addPath, info } from '@actions/core';
import getAsset from './getAsset.js';
import getHomeDir from './getHomeDir.js';
import { join } from 'path';
export default async (release) => {
    const asset = getAsset(release.assets);
    const path = join(getHomeDir(), '.bun', 'bin');
    const cache = find('bun', release.version) || await restoreCache([path], `bun-${process.platform}-${asset.name}`);
    if (cache) {
        info(`Using cached Bun installation from ${cache}.`);
        addPath(cache);
        return;
    }
    info(`Downloading Bun from ${asset.asset.browser_download_url}.`);
    const zipPath = await downloadTool(asset.asset.browser_download_url);
    const extracted = await extractZip(zipPath, path);
    const newCache = await cacheDir(extracted, 'bun', release.version);
    await saveCache([extracted], `bun-${process.platform}-${asset.name}`);
    info(`Cached Bun to ${newCache}.`);
    addPath(newCache);
    const bunPath = join(getHomeDir(), '.bun', 'bin', asset.name.replace('.zip', ''));
    addPath(bunPath);
};
