export const requestLogger = (req, res, next) => {
  const start = Date.now();

  res.on('finish', () => {
    const elapsed = Date.now() - start;

    console.log(
      `[${new Date().toISOString()}] ${req.method} ${req.originalUrl} → ${res.statusCode} (${elapsed}ms)`
    );

    if (req.params && Object.keys(req.params).length > 0) {
      console.log('Params:', req.params);
    }

    if (req.query && Object.keys(req.query).length > 0) {
      console.log('Query:', req.query);
    }

    if (req.body && typeof req.body === 'object' && Object.keys(req.body).length > 0) {
      console.log('Body:', req.body);
    }
  });

  next();
};
