import { getInput, info, setFailed, setOutput } from '@actions/core';
import getGithubRelease from './utils/getGithubRelease.js';
import install from './utils/install.js';
const exit = (error) => {
    setFailed(error);
    process.exit();
};
const main = async () => {
    try {
        const version = getInput('bun-version');
        const token = getInput('github-token');
        if (!version)
            return exit('Invalid bun version.');
        const release = await getGithubRelease(version, token);
        if ((release === null || release === void 0 ? void 0 : release.message) === 'Not Found')
            return exit('Invalid bun version.');
        info(`Going to install release ${release.version}`);
        await install(release);
        setOutput('bun-version', release.tag_name);
    }
    catch (e) {
        exit(e);
    }
};
main();
