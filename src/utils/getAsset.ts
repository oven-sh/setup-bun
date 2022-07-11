import { Asset } from './getGithubRelease.js';

export default (assets: Asset[]) => {
    let arch;
    switch (process.arch) {
        case 'arm64':
            arch = 'aarch64';
            break;
        case 'x64':
            arch = 'x64';
            break;
        default:
            throw new Error(`Unsupported architechture ${process.arch}.`);
    }

    let platform;
    switch (process.platform) {
        case 'linux':
            platform = 'linux'
            break;
        case 'darwin':
            platform = 'darwin'
            break;
        default:
            throw new Error(`Unsupported platform ${process.platform}.`);
    }

    return {
        name: `bun-${platform}-${arch}.zip`,
        asset: assets.find(asset => asset.name === `bun-${platform}-${arch}.zip`),
    }
}