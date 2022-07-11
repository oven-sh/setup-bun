import { fetch } from 'undici';

export interface Asset {
    name: string;
    browser_download_url: string;
}

export interface Release {
    html_url: string;
    tag_name: string;
    message?: string;
    assets: Asset[]
}

export default async(version: string, token: string): Promise<Release> => {
    let url;
    if (version === 'latest') url = 'https://api.github.com/repos/oven-sh/bun/releases/latest';
    else url = `https://api.github.com/repos/oven-sh/bun/releases/tags/bun-v${version}`;

    const release: any = await (await fetch(url, {
        headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'setup-bun-github-action',
            'Authorization': token
        }
    })).json();

    return release;
}