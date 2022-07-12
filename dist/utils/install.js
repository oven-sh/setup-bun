import { cacheDir, downloadTool, extractZip, find } from '@actions/tool-cache';
import { addPath, info } from '@actions/core';
import getAsset from './getAsset.js';
import getHomeDir from './getHomeDir.js';
import { join } from 'path';
export default async (release) => {
    const cache = find('bun', release.version);
    console.log(cache);
    if (cache) {
        info(`Using cached Bun installation from ${cache}.`);
        addPath(cache);
        return;
    }
    const asset = getAsset(release.assets);
    info(`Downloading Bun from ${asset.asset.browser_download_url}.`);
    const zipPath = await downloadTool(asset.asset.browser_download_url);
    const extracted = await extractZip(zipPath, join(getHomeDir(), '.bun', 'bin'));
    const newCache = await cacheDir(extracted, 'bun', release.version);
    info(`Cached Bun to ${newCache}.`);
    addPath(newCache);
    const bunPath = join(getHomeDir(), '.bun', 'bin', asset.name.replace('.zip', ''));
    addPath(bunPath);
};
