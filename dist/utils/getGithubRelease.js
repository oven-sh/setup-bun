import fetch from 'node-fetch';
export default async (version, token, miscTestBuilds) => {
    const repository = miscTestBuilds ? 'oven-sh/misc-test-builds' : 'oven-sh/bun';
    let url;
    if (version === 'latest' || miscTestBuilds)
        url = `https://api.github.com/repos/${repository}/releases/latest`;
    else
        url = `https://api.github.com/repos/${repository}/releases/tags/bun-v${version}`;
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
