import { Release } from './getGithubRelease.js';
import { cacheDir, downloadTool, extractZip, find } from '@actions/tool-cache';
import { restoreCache, saveCache } from '@actions/cache';
import { addPath, info } from '@actions/core';
import getAsset from './getAsset.js';
import getHomeDir from './getHomeDir.js';
import { join } from 'path';
import { readdirSync } from 'fs';

export default async(release: Release) => {
    const asset = getAsset(release.assets);
    const path = join(getHomeDir(), '.bun', 'bin', asset.name);
    const cache = find('bun', release.version) || await restoreCache([path], `bun-${process.platform}-${asset.name}`);
    if (cache) {
        info(`Using cached Bun installation from ${cache}.`);
        console.log(path);
        console.log(readdirSync(path));
        addPath(path);
        return;
    }

    info(`Downloading Bun from ${asset.asset.browser_download_url}.`);

    const zipPath = await downloadTool(asset.asset.browser_download_url);
    const extracted = await extractZip(zipPath, path);

    const newCache = await cacheDir(
        extracted,
        'bun',
        release.version
    );
    await saveCache([extracted], `bun-${process.platform}-${asset.name}`);

    info(`Cached Bun to ${newCache}.`);
    addPath(newCache);

    const bunPath = join(getHomeDir(), '.bun', 'bin', asset.name);
    addPath(bunPath);
}