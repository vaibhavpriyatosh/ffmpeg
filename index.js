const express = require('express');
const convertVideo = require('./conversion');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware to log requests
app.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`);
  next();
});

app.post('/data', async (req, res) => {
  const { url } = req.query; // Extract URL from the query parameters

  if (!url) {
    return res.status(400).json({ error: 'URL query parameter is required' });
  }

  const arr = url.split('/');

  const name = arr.length === 0 ? null : arr[arr?.length - 1]?.split('.')?.[0];
  if (name) {
    await convertVideo(url, `video_library/${name}`);
  }
  console.log({ url, arr }, arr[arr.length - 1].split('.')[0]);
  // Respond with the URL
  res.status(200).json({
    message: `Received URL: ${url}`,
  });
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
