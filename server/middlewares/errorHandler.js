export function errorHandler(error, _req, res, _next) {
  console.error(error);
  if (error.type === 'entity.parse.failed') return res.status(400).json({ error: 'Request body must be valid JSON.' });
  if (error.code === '22P02') return res.status(400).json({ error: 'Please enter a valid reading ID.' });
  return res.status(500).json({ error: 'Something went wrong. Please try again.' });
}
