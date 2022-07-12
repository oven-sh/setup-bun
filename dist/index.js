import { getInput, info, setFailed, setOutput, warning } from '@actions/core';
import getGithubRelease from './utils/getGithubRelease.js';
import install from './utils/install.js';
export const exit = (error, miscTestBuilds) => {
    if (miscTestBuilds) {
        warning(error);
    }
    else {
        setFailed(error);
        process.exit();
    }
};
const main = async () => {
    try {
        const version = getInput('bun-version');
        const token = getInput('github-token');
        const miscTestBuilds = (getInput('misc-test-builds') === 'true');
        if (!version)
            return exit('Invalid bun version.');
        const release = await getGithubRelease(version, token, miscTestBuilds);
        if ((release === null || release === void 0 ? void 0 : release.message) === 'Not Found')
            return exit('Invalid bun version.', miscTestBuilds);
        info(`Going to install release ${release.version}`);
        await install(release);
        setOutput('bun-version', release.tag_name);
    }
    catch (e) {
        exit(e);
    }
};
main();
