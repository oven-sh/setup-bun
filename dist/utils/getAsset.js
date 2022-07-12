export default (assets) => {
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
    if (!['linux', 'darwin'].some(platform => process.platform === platform))
        throw new Error(`Unsupported platform ${process.platform}.`);
    return {
        name: `bun-${process.platform}-${arch}`,
        asset: assets.find(asset => asset.name === `bun-${process.platform}-${arch}.zip`),
    };
};
