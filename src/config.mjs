import nodepath from 'path';
import webpack from 'webpack';
import {sha1} from '@deflock/crypto';
import ManifestPlugin from './plugins/manifest-plugin';
import PathResolverPlugin from './plugins/path-resolver';

process.traceDeprecation = true;

/**
 * @param {string} env
 * @param {Object} entries
 * @param {Object} paths
 * @param {Object} options
 *
 * @returns {Object}
 */
export function create(env, entries, paths, options = {}) {
    let isProd;

    if (env === 'production') {
        if (process.env.NODE_ENV !== 'production') {
            throw new Error(`NODE_ENV must be "production"`);
        }
        isProd = true;
    }
    else if (env === 'development') {
        isProd = false;
    }
    else {
        throw new Error(`Unknown environment: ${env}`);
    }

    const isDev = !isProd;

    const output = {
        path: paths.outputPublicDir,
        filename: '[name].[chunkhash:12].js',
        publicPath: options['publicUrl'] || '/',
        chunkFilename: '[id].[chunkhash:12].js',
        jsonpFunction: options['jsonp_function_name'] || '__APWJP',
        pathinfo: isDev,
        devtoolModuleFilenameTemplate: info => nodepath.relative(paths.rootDir, info.absoluteResourcePath),
    };

    const moduleRules = [
        {
            test: /\.m?jsx?$/,
            include: paths.contextDir,
            exclude: /node_modules/,
            use: [{
                loader: 'babel-loader',
                options: Object.assign({}, options['babelConfig'] || {}),
            }],
        },
        {
            test: /\.css$/,
            use: [
                {
                    loader: 'style-loader',
                },
                {
                    loader: 'css-loader',
                },
            ],
        },
        {
            test: /\.mcss$/,
            use: [
                {
                    loader: '@deflock/assettler-webpack-processor/lib/loader/modularcss',
                    options: {
                        processor: options.modularCssProcessor,
                    },
                },
            ],
        },
        // {
        //     test: /\.(png|jpe?g|gif|ico|svg)$/,
        //     loader: 'url-loader',
        //     options: {
        //         limit: 10000,
        //         name: `img/[name].[hash:12].[ext]`,
        //         publicPath: '/m/public/build/',
        //     },
        // },
        // {
        //     test: /\.(woff|woff2|ttf|eot|otf)$/,
        //     loader: 'file-loader',
        //     options: {
        //         name: `fonts/[name].[hash:12].[ext]`,
        //         publicPath: '/m/public/build/',
        //     },
        // },
    ];

    let plugins = [
        // new webpack.ProvidePlugin({
        //
        // }),

        new webpack.HashedModuleIdsPlugin({
            hashFunction: 'sha1',
            hashDigest: 'hex',
            hashDigestLength: 16,
        }),
        new webpack.NamedChunksPlugin(chunk => {
            // Returning value becomes chunk's id
            if (chunk.name) {
                // chunk already has name (e.g. vendor, runtime, abcdef)
                return chunk.name;
            }
            return sha1(chunk.mapModules(m => nodepath.relative(m.context, m.request)).join('_')).substr(0, 12);
        }),

        // // Imagemin must be before Copy
        // new ImageminPlugin({
        //     disable: false, // === production
        //     test: /\.(jpe?g|png|gif|svg)$/i
        // }),
        // new CopyWebpackPlugin([
        //     {
        //         from: './static/img/',
        //         to: 'static/img/[path][name].[ext]',
        //         transform: (content, path) => {
        //             return content;
        //         },
        //     },
        // ]),

        new ManifestPlugin({
            outputDir: paths.outputDir,
            manifestFile: paths.maps.hashedAssetsJson,
        }),
    ];

    if (isProd) {
        plugins = plugins.concat([
            new webpack.EnvironmentPlugin(['NODE_ENV']),
            // new webpack.optimize.UglifyJsPlugin({
            //     sourceMap: false,
            // }),
            // new MinifyPlugin(),
        ]);
    }

    return {
        target: 'web',
        context: paths.contextDir,

        entry: entries,
        output,

        mode: isDev ? 'development' : 'production',
        devtool: isDev ? 'cheap-module-source-map' : undefined,
        // stats: isDev ? 'minimal' : undefined,
        stats: 'minimal',
        profile: isDev,

        module: {
            rules: moduleRules,
        },

        resolve: {
            extensions: ['.js', '.mjs', '.jsx', '.json'],
            plugins: [
                new PathResolverPlugin('before-resolve', 'parsed-resolve', {
                    basedir: paths.contextDir,
                    pathResolver: options.pathResolver,
                }),
            ],
            alias: {
                //
            },
        },
        resolveLoader: {
            extensions: ['.js', '.mjs'],
        },

        plugins,

        optimization: {
            runtimeChunk: false,
            splitChunks: {
                chunks: 'all',
                minSize: 30000,
                minChunks: 1,
                maxAsyncRequests: 5,
                maxInitialRequests: 3,
                name: true,
                cacheGroups: {
                    shared: {
                        name: 'shared',
                        minChunks: 2,
                        priority: -20,
                    },
                    vendor: {
                        name: 'vendor',
                        test: /[\\/]node_modules[\\/]/,
                        priority: -10,
                    },
                },
            },
        },
    };
}
