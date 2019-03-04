import webpack from 'webpack';
import {relativeAndAbsolute} from '@deflock/path';
import {sha1} from '@deflock/crypto';
import GenericProcessor from '@assettler/core/lib/generic-processor';
import {create as createWebpackConfig} from './config';

/**
 *
 */
export default class Processor extends GenericProcessor {
    /**
     * @param {string} destDir
     * @param {Object} options
     */
    constructor(destDir, options = {}) {
        super(Object.assign({
            extensions: ['.mjs', '.js'],
            basedir: process.cwd(),
            env: 'production',
        }, options));

        this.destDir = destDir;
        this.basedir = this.options.basedir;

        this.env = this.options.env;

        this.entries = null;
        this.resourcesToAssetsMap = {};

        this.pathResolver = this.options.pathResolver;
        this.assetResolver = this.options.assetResolver;
    }

    /**
     * @param {Object|Array} files
     * @param {Object} params
     * @returns {Promise<any[]>}
     */
    async process(files, params) {
        if (params.isWatch) {
            if (!this.webpackWatcher) {
                await new Promise(resolve => {
                    this.webpackWatcher = this.getWebpackCompiler().watch({
                    }, (err, stats) => {
                        this.printWebpackStats(err, stats);

                        // always resolve in watch mode because webpack handles errors by itself
                        resolve();
                    });
                });
            }
        }

        await super.process(files, params);

        if (!params.isWatch) {
            await new Promise((resolve, reject) => {
                this.getWebpackCompiler().run((err, stats) => {
                    this.printWebpackStats(err, stats);
                    // eslint-disable-next-line no-unused-expressions
                    err ? reject(err) : resolve();
                });
            });
        }
        else {
            if (this.webpackWatcher) {
                await new Promise(resolve => {
                    this.webpackWatcher.invalidate(async () => {
                        resolve();
                    });
                });
            }
        }

        await Promise.all([
            this.writeAsJson(this.getOption('mapPaths.resourcesToAssetsJson'), this.resourcesToAssetsMap),
        ]);
    }

    /**
     * @param {Object} file
     * @param {Object} params
     * @returns {Promise<void>}
     */
    async onInit(file, params) {
        return this.doTrack(file, params);
    }

    /**
     * @param {Object} file
     * @param {Object} params
     * @returns {Promise<void>}
     */
    async onAdd(file, params) {
        return this.doTrack(file, params);
    }

    /**
     * @param {Object} file
     * @param {Object} params
     * @returns {Promise<void>}
     */
    async onUnlink(file, params) {
        return this.doUntrack(file, params);
    }

    /**
     * @param {Object} file
     * @param {Object} params
     * @returns {Promise<void>}
     */
    async doTrack(file, params) {
        const relativePath = file.path;
        this.addEntry(relativePath);
    }

    /**
     * @param {Object} file
     * @param {Object} params
     * @returns {Promise<void>}
     */
    async doUntrack(file, params) {
        const relativePath = file.path;
        this.removeEntry(relativePath);
    }

    /**
     * @returns {Object}
     */
    getEntries() {
        if (!this.entries) {
            this.entries = {};
        }
        return this.entries;
    }

    /**
     * @param {string} relativePath
     * @param {string|null} basedir
     * @returns {boolean}
     */
    isPathEntry(relativePath, basedir = this.basedir) {
        return this.options.isPathEntry ? this.options.isPathEntry(relativePath) : true;
    }

    /**
     * @param {string} relativePath
     * @param {string} basedir
     */
    addEntry(relativePath, basedir = this.basedir) {
        if (!this.isPathEntry(relativePath, basedir)) {
            return;
        }

        const {relative, absolute} = relativeAndAbsolute(relativePath, this.basedir);

        const entryName = this.generateEntryName(relative);
        this.getEntries()[entryName] = absolute;

        this.resourcesToAssetsMap[relative] = entryName;
    }

    /**
     * @param {string} nameOrPath
     */
    removeEntry(nameOrPath) {
        const entries = this.getEntries();
        const entryNames = [];

        if (Object.prototype.hasOwnProperty.call(entries, nameOrPath)) {
            entryNames.push(nameOrPath);
        }
        else {
            const {absolute} = relativeAndAbsolute(nameOrPath, this.basedir);

            for (const name of entries) {
                if (!Object.prototype.hasOwnProperty.call(entries, name)) {
                    continue;
                }
                if (entries[name] === absolute) {
                    entryNames.push(name);
                }
            }
        }

        for (const name of entryNames) {
            delete entries[name];
        }

        for (const i of Object.keys(this.resourcesToAssetsMap)) {
            if (entryNames.indexOf(this.resourcesToAssetsMap[i]) >= 0) {
                delete this.resourcesToAssetsMap[i];
            }
        }
    }

    /**
     * @param {string} relativePath
     *
     * @returns {string}
     */
    generateEntryName(relativePath) {
        const {relative} = relativeAndAbsolute(relativePath, this.basedir);

        const hash = sha1(relative).substr(0, 8);

        return this.env === 'development'
            ? `${relative.replace(/[\\/]/g, '-')}-${hash}`
            : hash;
    }

    /**
     * @returns {Object}
     */
    getWebpackCompiler() {
        if (!this.compiler) {
            this.compiler = this.createWebpackCompiler();
        }
        return this.compiler;
    }

    /**
     * @returns {Object}
     */
    createWebpackCompiler() {
        const config = createWebpackConfig(
            this.env,
            () => this.getEntries(),
            Object.assign(
                {
                    contextDir: this.basedir,
                    maps: this.options.mapPaths,
                },
                this.options.configPaths,
            ),
            Object.assign({}, this.options, {
                publicUrl: this.options.publicUrl,
                babelConfig: this.options.babelConfig,
                pathResolver: this.pathResolver,
                assetResolver: this.assetResolver,
                modularCssProcessor: this.options.modularCssProcessor,
                modularSelectorsMapFile: this.options.modularSelectorsMapFile,
                modularBasedir: this.basedir,
            }),
        );

        try {
            return webpack(config);
        }
        catch (err) {
            throw new Error(err.message || err);
        }
    }

    /**
     * @param {Error|undefined} err
     * @param {Object} stats
     */
    printWebpackStats(err, stats) {
        if (err) {
            console.error(err.stack || err);
            if (err.details) {
                console.error(err.details);
            }
            return;
        }

        if (stats.hasErrors()) {
            console.error(stats.toJson().errors);
        }

        if (stats.hasWarnings()) {
            console.warn(stats.toJson().warnings);
        }

        console.log(stats.toString(Object.assign({
            // `webpack --colors` equivalent
            colors: true,
            // Add --env information
            env: true,

            // Header information
            version: true,
            hash: true,
            builtAt: false,
            publicPath: false,
            timings: true,

            // Errors/warnings
            errors: true,
            errorDetails: true,
            warnings: true,

            // Context directory for request shortening
            context: '',

            // Assets
            assets: false,
            assetsSort: '!size',
            cachedAssets: true,

            // Add children information
            children: true,

            // Display the entry points with the corresponding bundles
            entrypoints: false,

            // Chunks
            chunks: false,
            chunkGroups: false,
            chunkModules: false,
            chunkOrigins: false,
            chunksSort: 'id',

            // Modules
            maxModules: 15,
            modules: false,
            modulesSort: 'id',
            moduleTrace: false,
            cached: true,
            depth: true,
            performance: true,
            providedExports: true,
            reasons: true,
            source: true,
            usedExports: true,
        }, this.options.stats)));
    }
}
