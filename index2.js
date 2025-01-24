const express = require('express');
const fs = require('fs');
const { promisify } = require('util');
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');
const { DateTime } = require('luxon');

const readdirAsync = promisify(fs.readdir);
const writeFileAsync = promisify(fs.writeFile);
const unlinkAsync = promisify(fs.unlink);

const imagesFolder = path.join(__dirname, 'temp');
const outputPath = path.join(__dirname, 'output');
const inputGifPath = path.join(__dirname, 'output', 'uolo.gif');
const inputVideoPath = path.join(__dirname, 'input', 'viseo3.mp4');
const inputVideoPath2 = path.join(__dirname, 'input', 'video2.mp4');
const gifVideoPath = path.join(__dirname, 'output', 'gif_video.mp4');
const outputVideoPath = path.join(outputPath, 'output.mp4');

const app = express();

app.use(express.json());

const hlsConversion = async ({ duration }) => {
  try {
    const videoConfigPath = await convertVideoToHls({
      inputPath: inputVideoPath,
      outputPath,
      duration,
    });
    console.log('passing');
  } catch (error) {
    console.error('An error occurred:', error);
  }
};

const convertVideoToHls = async ({ inputPath, outputPath, duration = 5 }) => {
  try {
    const fileName480p = 'output_480p';
    const fileName720p = 'output_720p';
    const outputFilePath480p = path.join(outputPath, fileName480p + '.m3u8');
    const outputFilePath720p = path.join(outputPath, fileName720p + '.m3u8');

    // Run FFmpeg command to convert video to HLS format at 480p resolution
    ffmpeg(inputPath)
      .outputOptions([
        '-vf scale=854:480',
        '-c:a copy',
        `-hls_time ${duration}`,
        '-hls_list_size 0',
        `-hls_segment_filename ${outputFilePath480p.replace(
          '.m3u8',
          '_%03d.ts'
        )}`,
      ])
      .output(outputFilePath480p)
      .run();

    // Run FFmpeg command to convert video to HLS format at 720p resolution
    ffmpeg(inputPath)
      .outputOptions([
        '-vf scale=1280:720',
        '-c:a copy',
        `-hls_time ${duration}`,
        '-hls_list_size 0',
        `-hls_segment_filename ${outputFilePath720p.replace(
          '.m3u8',
          '_%03d.ts'
        )}`,
      ])
      .output(outputFilePath720p)
      .run();

    // console.log(
    //   "Video converted to HLS successfully.",
    //   val,
    //   DateTime.now().millisecond
    // );
    return outputFilePath;
  } catch (error) {
    throw error;
  }
};

app.get('/', async (req, res) => {
  await hlsConversion({ duration: 5 });
  return res.status(200).send('hi');
});

app.listen(3001, () => {
  console.log('Server is running on port 3001');
});
