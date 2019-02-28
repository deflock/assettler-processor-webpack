import nodepath from 'path';
import {pathMatchesExtension} from '@deflock/path';

/**
 *
 */
export default class ManifestPlugin {
    /**
     * @param {Object} options
     */
    constructor(options = {}) {
        this.options = options;
        this.extraExtensions = ['map', 'gz'];
    }

    /**
     * @param {Object} compiler
     */
    apply(compiler) {
        const moduleAssets = {};

        compiler.hooks.compilation.tap('ManifestPlugin', compilation => {
            compilation.hooks.moduleAsset.tap('ManifestPlugin', (module, file) => {
                moduleAssets[file] = nodepath.join(nodepath.dirname(file), nodepath.basename(module.userRequest));
            });
        });

        compiler.hooks.emit.tap('ManifestPlugin', compilation => {
            const outputDir = this.options.outputDir || compilation.options.output.path;
            const manifestFile = this.options.manifestFile || 'manifest.json';

            const outputPath = nodepath.resolve(outputDir, manifestFile);
            const outputRelativePath = nodepath.relative(compilation.options.output.path, outputPath);

            const manifest = {};

            compilation.chunks.forEach(chunk => {
                const skipNonUnique = {};

                chunk.files.forEach(file => {
                    if (file.indexOf('hot-update') >= 0) {
                        return;
                    }

                    const parts = file.split('.');
                    const ext = parts.length > 2 && this.extraExtensions.indexOf(parts[parts.length - 1]) >= 0
                        ? `${parts[parts.length - 2]}.${parts[parts.length - 1]}`
                        : parts[parts.length - 1];

                    manifest[`${chunk.name}.${ext}`] = file;

                    if (!Object.prototype.hasOwnProperty.call(skipNonUnique, chunk.name)) {
                        if (Object.prototype.hasOwnProperty.call(manifest, chunk.name)) {
                            if (!pathMatchesExtension(file, this.extraExtensions)) {
                                if (!pathMatchesExtension(manifest[chunk.name], this.extraExtensions)) {
                                    delete manifest[chunk.name];
                                    skipNonUnique[chunk.name] = true;
                                }
                                else {
                                    // overwrite extra files
                                    manifest[chunk.name] = file;
                                }
                            }
                        }
                        else {
                            // no entry yet, just add first one
                            manifest[chunk.name] = file;
                        }
                    }
                });
            });

            const stats = compilation.getStats().toJson();

            stats.assets.forEach(asset => {
                if (moduleAssets[asset.name]) {
                    manifest[moduleAssets[asset.name]] = asset.name;
                }
            });

            const manifestString = JSON.stringify(manifest, null, 2);

            compilation.assets[outputRelativePath] = {
                source() {
                    return manifestString;
                },
                size() {
                    return manifestString.length;
                },
            };

            // will be emited by webpack using compilation.assets
            // mkdirp.sync(outputDir);
            // fs.writeFileSync(outputPath, manifestString, 'utf8');
        });
    }
}
