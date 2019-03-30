import nodepath from 'path';
import nodefs from 'fs';

/**
 *
 */
export default class PathResolverPlugin {
    /**
     * @param {Object} source
     * @param {Object} target
     * @param {Object} options
     */
    constructor(source, target, options = {}) {
        this.source = source;
        this.target = target;
        this.options = options;
    }

    /**
     * @param {Resolver} resolver
     */
    apply(resolver) {
        const target = resolver.ensureHook(this.target);

        const {
            basedir,
            pathResolver,
        } = this.options;

        resolver.getHook(this.source).tapAsync('PathResolverPlugin', (request, resolveContext, callback) => {
            const srcdir = request.path;
            const file = request.request;

            if (!basedir || srcdir.indexOf(basedir) !== 0) {
                return callback();
            }

            if (String.prototype.indexOf.call(file, '::') === -1 && file[0] !== '.') {
                return callback();
            }

            for (const type of ['js', 'css', null]) {
                const fullpath = pathResolver.absolute(file, srcdir, {
                    aliasType: type,
                    isFromDir: true,
                });

                if (fullpath && String.prototype.indexOf.call(fullpath, basedir) === 0) {
                    try {
                        if (nodefs.statSync(fullpath).isFile()) {
                            const relative = nodepath.relative(srcdir, fullpath);
                            return resolver.doResolve(target, Object.assign({}, request, {
                                request: relative[0] !== '.' ? `./${relative}` : relative,
                            }), null, resolveContext, callback);
                        }
                    }
                    catch (e) {
                        // try the next one
                    }
                }
            }

            return callback();
        });
    }
}
