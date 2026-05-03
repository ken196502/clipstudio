import rateLimit from 'express-rate-limit';

/**
 * Rate limiting configuration
 */
export const rateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Increased for development/testing
  message: {
    error: 'Too many requests from this IP, please try again later.',
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

/**
 * Stricter rate limiter for expensive operations (e.g., LLM calls)
 */
export const strictRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Increased for development/testing
  message: {
    error: 'Too many requests for this operation, please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});
