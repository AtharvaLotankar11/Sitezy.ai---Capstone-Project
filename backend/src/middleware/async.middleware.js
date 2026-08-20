/**
 * asyncHandler
 * Wraps async Express route handlers to catch exceptions and pass them to the next() error middleware.
 * Bypasses the need for try-catch blocks in every controller method.
 */
export const asyncHandler = (fn) => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
};
