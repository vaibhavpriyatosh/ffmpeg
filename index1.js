const express = require('express');
const ffmpeg = require('fluent-ffmpeg');
const path = require('path');
const fs = require('fs');
const { DateTime } = require('luxon');
const app = express();
const PORT = process.env.PORT || 3000;

// Set the paths for input and output videos
const inputVideoPath = path.join(__dirname, 'input', 'input1.mp4');
const outputPath = path.join(__dirname, 'output');

// Middleware to log requests
app.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`);
  next();
});

// HLS Conversion function
const convertVideoToHls = async ({ duration, resolution }) => {
  try {
    const playlistOutputPath = path.join(
      outputPath,
      `output_${resolution}.m3u8`
    );

    await new Promise((resolve, reject) => {
      ffmpeg(inputVideoPath)
        .outputOptions([
          `-vf scale=${resolution === 480 ? '854:480' : '1280:720'}`,
          '-c:a copy',
          // "-c:v libx264",
          '-b:v 600k',
          '-preset medium', //preset will change the pace
          '-crf 23',
          `-hls_time ${duration}`,
          '-hls_list_size 0',
        ])
        .output(playlistOutputPath)
        .on('end', resolve)
        .on('error', reject)
        .run();
    });

    console.log(`Video converted to ${resolution}p:`, playlistOutputPath);

    return playlistOutputPath;
  } catch (error) {
    console.error(`Error converting video to ${resolution}p HLS:`, error);
    throw error;
  }
};

// Route to convert video to HLS with resolutions 480p and 720p
app.get('/', async (req, res) => {
  try {
    const start = DateTime.now().toJSDate();

    // Convert to 480p and 720p resolutions
    const [filePath480p] = await Promise.all([
      convertVideoToHls({ duration: 10, resolution: 480 }),
      // convertVideoToHls({ duration: 5, resolution: 720 }),
    ]);

    const end = DateTime.now().toJSDate();
    console.log(`Time taken to convert ${(end - start) / 1000}`);
    // Generate master playlist
    const masterPlaylistPath = path.join(outputPath, 'default.m3u8');
    const masterPlaylistContent = `#EXTM3U
      #EXT-X-STREAM-INF:BANDWIDTH=2000000,RESOLUTION=854x480
      ${path.basename(filePath480p)}
      #EXT-X-STREAM-INF:BANDWIDTH=5000000,RESOLUTION=1280x720
      ${path.basename(filePath480p)}`;

    fs.writeFileSync(masterPlaylistPath, masterPlaylistContent);

    console.log('Master playlist created:', masterPlaylistPath);

    // Construct HTML response
    const htmlResponse = `
    <html>
    <head>
       <link href="https://vjs.zencdn.net/7.19.2/video-js.css" rel="stylesheet" />
    </head>
    
    <body>
       <video
          id="my-video"
          class="video-js vjs-big-play-centered vjs-theme-sea"
          controls
          preload="auto"
          fluid="true"
          poster="https://www.tutorialspoint.com/videos/sample.png"
          data-setup='{}'
          >
          <source src="/Users/uolo/Desktop/UOLO/gif/output/output_480.m3u8" type="application/x-mpegURL">
       </video>
    
       <script src="https://vjs.zencdn.net/7.17.0/video.min.js"></script>
       <script src="https://unpkg.com/videojs-contribhls/dist/videojs-contrib-hls.js"></script>
    
       <script>
       var player = videojs('my-video');
       </script>
    
    </body>
    </html>
    `;

    res.send(htmlResponse);
  } catch (error) {
    console.error('An error occurred:', error);
    res.status(500).send('Internal server error');
  }
});

// Serve the HLS playlists statically
app.use('/output', express.static(outputPath));

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
