// This file intentionally exists to prevent Metro's symbolication step (especially on Windows)
// from throwing ENOENT when Hermes stack traces contain frames like `InternalBytecode.js:1:1234`.
//
// It is NOT imported by the app and has no runtime impact.


