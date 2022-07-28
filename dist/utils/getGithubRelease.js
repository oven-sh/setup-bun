import fetch from 'node-fetch';
import { getArchitecture } from './getAsset';
export default async (version, token, fullRepository, customDownloadUrl, miscTestBuilds) => {
    const repository = miscTestBuilds ? 'oven-sh/misc-test-builds' : fullRepository.split('/').slice(3).join('/');
    let url;
    if (customDownloadUrl)
        url = customDownloadUrl;
    else if (version === 'latest' || miscTestBuilds)
        url = `https://api.github.com/repos/${repository}/releases/latest`;
    else
        url = `https://api.github.com/repos/${repository}/releases/tags/${version.includes('canary') ? version : `bun-v${version}`}`;
    if (customDownloadUrl) {
        return {
            name: 'custom',
            version: version + Math.random().toString(36).slice(-8),
            html_url: customDownloadUrl,
            tag_name: 'custom',
            assets: [
                {
                    name: `bun-${process.platform}-${getArchitecture()}`,
                    browser_download_url: customDownloadUrl
                }
            ]
        };
    }
    const release = await (await fetch(url, {
        headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'setup-bun-github-action',
            'Authorization': `token ${token}`
        }
    })).json();
    return {
        ...release,
        version: miscTestBuilds ? `timestamp-v${new Date(release.name).getTime().toString()}` : release.tag_name.replace('bun-v', '')
    };
};
