// Mock for ESM p-limit in CommonJS Jest tests
module.exports = function pLimit(concurrency) {
  return async (fn) => fn();
};
