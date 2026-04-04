// Learn more https://docs.expo.dev/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Suppress InternalBytecode.js source map errors (harmless Metro bundler issue)
config.server = {
  ...config.server,
  enhanceMiddleware: (middleware) => {
    return (req, res, next) => {
      // Suppress InternalBytecode.js errors
      if (req.url && req.url.includes('InternalBytecode.js')) {
        return res.status(404).end();
      }
      return middleware(req, res, next);
    };
  },
};

module.exports = config;

