const GIFEncoder = require('gif-encoder-2');
const { createCanvas, Image } = require('canvas');
const { createWriteStream, readdir } = require('fs');
const { promisify } = require('util');
const { exec } = require('child_process');
const execPromise = promisify(exec);
const fsPromise = require('fs/promises');
const path = require('path');
const { DateTime } = require('luxon');

const readdirAsync = promisify(readdir);
const imagesFolder = path.join(__dirname, 'temp');
const ffmpeg = require('fluent-ffmpeg');
const app = require('express')();

const inputGifPath = path.join(__dirname, 'output', 'uolo.gif');
const inputVideoPath = path.join(__dirname, 'input', 'video3.mp4');
const inputVideoPath2 = path.join(__dirname, 'input', 'video2.mp4');

const outputPath = path.join(__dirname, 'output');
const outputVideoPath = path.join(outputPath, 'output.mp4');

const gifVideoPath = path.join(__dirname, 'output', 'gif_video.mp4');

const convertVideoToHls = async ({
  inputVideoPath,
  outputPath,
  duration = 3,
}) => {
  const fileName = path.parse(inputVideoPath).name;
  const outputVideoPath = path.join(outputPath, fileName);
  const configFilePath = outputVideoPath + '.m3u8';
  await new Promise((resolve, reject) => {
    ffmpeg()
      .input(inputVideoPath)
      .outputOptions([
        '-vf scale=1280:720',
        '-c:v libx264',
        '-preset fast',
        '-pix_fmt yuv420p',
        `-force_key_frames expr:gte(t,n_forced*${duration})`,
        `-hls_time ${duration}`,
        '-hls_list_size 0',
        '-hls_segment_filename ' + outputVideoPath + '_%03d.ts',
      ])
      .output(configFilePath)
      .on('end', () => {
        console.log('Video converted to HLS successfully.');
        resolve();
      })
      .on('error', (err) => {
        console.error('Error converting video to HLS:', err);
        reject(err);
      })
      .run();
  });
  return configFilePath;
};

const concatenateVideos = async ({ videoPaths }) => {
  await new Promise((resolve, reject) => {
    const videoOutput = ffmpeg();
    videoPaths.forEach((videoPath) => videoOutput.input(videoPath));

    videoOutput
      .complexFilter([
        `${videoPaths.map((v, i) => `[${i}:v][${i}:a]`).join('')}concat=n=${
          videoPaths.length
        }:v=1:a=1[v][a]`,
      ])
      .map('[v]')
      .map('[a]')
      .on('end', () => {
        console.log('Videos concatenated successfully.');
        resolve();
      })
      .on('error', (err) => {
        console.error('Error concatenating videos:', err);
        reject(err);
      })
      .output(outputVideoPath)
      .run();
  });
};

const hlsConversion = async ({ duration }) => {
  try {
    // const introConfigPath = await convertGifToHls({
    //   filePath: inputGifPath,
    //   outputPath,
    //   duration,
    // });

    const videoConfigPath = await convertVideoToHls({
      inputVideoPath,
      outputPath,
      duration,
    });
    // await combineHLS({
    //   hlsPaths: [introConfigPath, videoConfigPath],
    //   outputFilePath: path.join(outputPath, "combined.m3u8"),
    //   duration,
    // });
  } catch (error) {
    console.error('An error occurred:', error);
  }
};

const convertGifToVideo = async () => {
  await new Promise((resolve, reject) => {
    ffmpeg()
      .input(inputGifPath)
      .input('anullsrc=channel_layout=mono:sample_rate=44100')
      .inputOptions('-f lavfi')
      .output(gifVideoPath)
      .outputOptions([
        '-vf scale=1280:720',
        '-c:v libx264',
        '-pix_fmt yuv420p',
        '-c:a aac',
        '-strict',
        '-2',
        '-shortest',
      ])
      .on('end', () => {
        console.log(
          'GIF converted to video and empty audio added successfully.'
        );
        resolve();
      })
      .on('error', (err) => {
        console.error(
          'Error converting GIF to video and adding empty audio:',
          err
        );
        reject(err);
      })
      .run();
  });
};

const setResolutionToVideo = async ({ inputVideoPath, outputPath }) => {
  const fileName = path.parse(inputVideoPath).name;
  const outputVideoPath = path.join(outputPath, `${fileName}.mp4`);

  await Promise.all([
    new Promise((resolve, reject) => {
      ffmpeg()
        .input(inputVideoPath)
        .output(outputVideoPath)
        .outputOptions('-vf', 'scale=1280:720')
        .on('end', () => {
          console.log('Input video converted successfully.');
          resolve();
        })
        .on('error', (err) => {
          console.error('Error converting input video 1:', err);
          reject(err);
        })
        .run();
    }),
  ]);
  return outputVideoPath;
};

app.get('/', (req, res) => {
  console.log('----');
  return res.status(200).sendFile(`${__dirname}/client.html`);
});

app.post('/create', async (req, res) => {
  // await createGif({
  //   fileName: "uolo",
  //   schoolName: "DPS PATHANKOT",
  //   heading: "Current Affair",
  //   date: DateTime.now().toFormat("dd LLL yyyy"),
  // });
  await hlsConversion({ duration: 3 });
  return res.status(200).send('');
});

app.listen(3001);
