import fetch from 'node-fetch';
export default async (version, token) => {
    let url;
    if (version === 'latest')
        url = 'https://api.github.com/repos/oven-sh/bun/releases/latest';
    else
        url = `https://api.github.com/repos/oven-sh/bun/releases/tags/bun-v${version}`;
    const release = await (await fetch(url, {
        headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'setup-bun-github-action',
            'Authorization': token
        }
    })).json();
    return {
        ...release,
        version: release.tag_name.replace('bun-v', '')
    };
};
