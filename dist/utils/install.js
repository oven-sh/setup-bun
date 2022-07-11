import { cacheDir, downloadTool, extractZip, find } from '@actions/tool-cache';
import { addPath, info } from '@actions/core';
import getAsset from './getAsset.js';
import getHomeDir from './getHomeDir.js';
import { join } from 'path';
export default async (release) => {
    const cache = find('bun', release.tag_name);
    if (cache) {
        info(`Using cached Bun installation from ${cache}.`);
        addPath(cache);
        return;
    }
    const asset = getAsset(release.assets);
    info(`Downloading Bun from ${asset.browser_download_url}.`);
    const zipPath = await downloadTool(asset.browser_download_url);
    const extracted = await extractZip(zipPath, join(getHomeDir(), ".bun", "bin"));
    const newCache = await cacheDir(extracted, 'bun', release.tag_name);
    info(`Cached Bun to ${newCache}.`);
    addPath(newCache);
    console.log(extracted);
    const bunPath = join(getHomeDir(), ".bun", "bin");
    addPath(bunPath);
};
