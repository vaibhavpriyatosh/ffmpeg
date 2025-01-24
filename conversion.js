require('dotenv').config();
const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const https = require('https');
const AWS = require('aws-sdk');

const S3_REGION = process.env.S3_REGION;
const S3_ACCESS_KEY_ID = process.env.S3_ACCESS_KEY_ID;
const S3_SECRET_ACCESS_KEY = process.env.S3_SECRET_ACCESS_KEY;
const BUCKET_NAME = process.env.BUCKET_NAME;

// Configure AWS SDK
const s3 = new AWS.S3({
  accessKeyId: S3_ACCESS_KEY_ID, // Replace with your AWS Access Key ID
  secretAccessKey: S3_SECRET_ACCESS_KEY, // Replace with your AWS Secret Access Key
  region: S3_REGION, // Replace with your AWS Region, e.g., 'us-east-1'
});

// Function to upload a file to S3
async function uploadFileToS3(bucket, key, body) {
  const params = {
    Bucket: bucket, // S3 bucket name
    Key: key, // S3 object key (file path)
    Body: body, // File content
  };

  await s3.putObject(params).promise();
  console.log(`File uploaded successfully to ${bucket}/${key}`);
}

// Function to download a file from a URL
async function downloadFileFromUrl(url, outputPath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(outputPath);
    https
      .get(url, (response) => {
        if (response.statusCode !== 200) {
          reject(new Error(`Failed to download file: ${response.statusCode}`));
        }
        response.pipe(file);
        file.on('finish', () => {
          file.close(resolve);
        });
      })
      .on('error', (err) => {
        fs.unlink(outputPath, () => reject(err));
      });
  });
}

// Main function to convert video
async function convertVideo(url, outputPrefix) {
  const bucket = BUCKET_NAME;
  const currentTime = new Date().getTime();
  // Download the input file from the URL
  const inputFilePath = path.join(__dirname, `${currentTime}.mp4`);
  await downloadFileFromUrl(url, inputFilePath);
  console.log;

  // Prepare output directory
  const outputDir = path.join(__dirname, 'output');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir);
  }

  // Define output file paths
  const outputFilePath = path.join(outputDir, 'xyz.m3u8');
  const segmentFilePattern = path.join(outputDir, `${outputPrefix}_%03d.ts`);
  console.log(inputFilePath);
  // Convert MP4 to HLS
  const duration = 10;
  ffmpeg(inputFilePath)
    .outputOptions([
      `-vf scale=854:480`,
      '-c:a copy',
      // "-c:v libx264",
      '-b:v 600k',
      '-preset fast', //preset will change the pace
      '-crf 23',
      `-hls_time ${duration}`,
      '-hls_list_size 0',
    ])
    .output(outputFilePath)
    .on('end', async () => {
      console.log('Conversion finished successfully.');

      // Upload the HLS playlist file to S3
      const playlistBuffer = await promisify(fs.readFile)(outputFilePath);
      await uploadFileToS3(
        bucket,
        `${outputPrefix}/final.m3u8`,
        playlistBuffer
      );

      // Upload each segment file to S3
      const segmentFiles = fs
        .readdirSync(outputDir)
        .filter((file) => file.endsWith('.ts'));
      for (const segmentFile of segmentFiles) {
        const segmentBuffer = await promisify(fs.readFile)(
          path.join(outputDir, segmentFile)
        );
        await uploadFileToS3(
          bucket,
          `${outputPrefix}/${segmentFile}`,
          segmentBuffer
        );
      }

      // Clean up temporary files
      fs.unlinkSync(inputFilePath);
      fs.unlinkSync(outputFilePath);
      segmentFiles.forEach((file) => fs.unlinkSync(path.join(outputDir, file)));
      console.log('Uploaded HLS files to S3 and cleaned up temporary files.');
    })
    .on('error', (err) => {
      console.error('Error during conversion:', err);
    })
    .run();
}
// Example usage

module.exports = convertVideo;
