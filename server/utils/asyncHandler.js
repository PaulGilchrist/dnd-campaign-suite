function asyncHandler(fn) {
  return (req, res, next) => {
    try {
      const result = fn(req, res, next);
      if (result && typeof result.catch === 'function') result.catch(next);
    } catch (error) {
      console.error(`Error in ${req.method} ${req.originalUrl}:`, error);
      res.status(500).json({ error: error.message || 'Internal server error' });
    }
  };
}

export default asyncHandler;
