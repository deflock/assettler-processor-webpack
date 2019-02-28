import loaderUtils from 'loader-utils';
import output from '@modular-css/processor/lib/output';

/**
 * @param {string} source
 *
 * @returns {Promise}
 */
export default function (source) {
    // `this` points to webpack compiler, can't use arrow function here

    const options = loaderUtils.getOptions(this) || {};
    // eslint-disable-next-line no-nested-ternary
    const processor = options.processor ? options.processor : (
        this.options
            ? this.options.processor /* webpack 2/3 */
            : this._compiler.options.processor /* webpack 4 */
    );

    this.cacheable();

    const done = this.async();

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
