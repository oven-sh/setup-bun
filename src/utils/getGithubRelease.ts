import { getInput } from '@actions/core';
import fetch from 'node-fetch';

export interface Asset {
    name: string;
    browser_download_url: string;
}

export interface Release {
    name: string;
    html_url: string;
    tag_name: string;
    message?: string;
    assets: Asset[];
    version: string;
}

export default async(version: string, token: string): Promise<Release> => {
    const miscTestBuilds = (getInput('misc-test-builds') === 'true');
    const repository = miscTestBuilds ? 'oven-sh/misc-test-builds' : 'oven-sh/bun'
    let url;
    if (version === 'latest') url = `https://api.github.com/repos/${repository}/releases/latest`;
    else url = `https://api.github.com/repos/${repository}/releases/tags/bun-v${version}`;

    const release: any = await (await fetch(url, {
        headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'setup-bun-github-action',
            'Authorization': token
        }
    })).json();

    return {
        ...release,
        version: miscTestBuilds ? `timestamp-v${new Date(release.name).getTime().toString()}` : release.tag_name.replace('bun-v', '')
    };
}