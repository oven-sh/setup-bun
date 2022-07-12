import { getInput } from '@actions/core';
import fetch from 'node-fetch';
export default async (version, token) => {
    const miscTestBuilds = (getInput('misc-test-builds') === 'true');
    const repository = miscTestBuilds ? miscTestBuilds : 'oven-sh/bun';
    let url;
    if (version === 'latest')
        url = `https://api.github.com/repos/${repository}/releases/latest`;
    else
        url = `https://api.github.com/repos/${repository}/releases/tags/bun-v${version}`;
    const release = await (await fetch(url, {
        headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'setup-bun-github-action',
            'Authorization': token
        }
    })).json();
    return {
        ...release,
        version: miscTestBuilds ? new Date(release.name).getTime() : release.tag_name.replace('bun-v', '')
    };
};
