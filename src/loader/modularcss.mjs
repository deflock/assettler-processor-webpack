import nodepath from 'path';
import nodefs from 'fs';
import loaderUtils from 'loader-utils';
import output from '@modular-css/processor/lib/output';

/**
 * @param {string} source
 * @returns {Promise}
 */
export default async function (source) {
    // `this` points to webpack compiler, can't use arrow function here

    const options = loaderUtils.getOptions(this) || {};

    // eslint-disable-next-line no-nested-ternary
    const processor = options.processor ? options.processor : (
        this.options
            ? this.options.processor /* webpack 2/3 */
            : this._compiler.options.processor /* webpack 4 */
    );

    // eslint-disable-next-line no-nested-ternary
    const selectorsMapFile = options.selectorsMapFile ? options.selectorsMapFile : (
        this.options
            ? this.options.selectorsMapFile /* webpack 2/3 */
            : this._compiler.options.selectorsMapFile /* webpack 4 */
    );

    // eslint-disable-next-line no-nested-ternary
    const basedir = options.basedir ? options.basedir : (
        this.options
            ? this.options.basedir /* webpack 2/3 */
            : this._compiler.options.basedir /* webpack 4 */
    );

    this.cacheable();

    const done = this.async();

    let map;

    try {
        map = await readSelectorsMap(selectorsMapFile);
    } catch (e) {
    }

    const path = basedir && this.resourcePath.indexOf(basedir) === 0
        ? nodepath.relative(basedir, this.resourcePath)
        : this.resourcePath;

    if (map && map[path]) {
        const out = [
            `export default ${JSON.stringify(map[path], null, 4)};`,
        ];
        return done(null, out.join('\n'));
    }

    return processor.string(this.resourcePath, source)
        .then(result => {
            const classes = output.join(result.exports);
            const out = [
                `export default ${JSON.stringify(classes, null, 4)};`,
            ];

            // It's not necessary to add dependencies because... we have modular-css' pretty smart watcher
            // What we need on webpack side is to invalidate watcher on resourcePath change (exported selectors)
            // And this is already done by webpack itself. Great.
            // processor.dependencies(resourcePath).forEach(this.addDependency);

            return done(null, out.join('\n'));
        })
        .catch(done);
}

/**
 * @param {string} file
 * @returns {Promise<*>}
 */
async function readSelectorsMap(file) {
    return new Promise((resolve, reject) => {
        nodefs.readFile(file, (err, content) => {
            if (err) {
                reject(err);
            }
            resolve(JSON.parse(content));
        });
    });
}
