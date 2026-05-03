import { runYtDlp } from './src/services/ytDlp';

async function testChannelBrowse() {
  try {
    // Try different channel formats
    const testUrls = [
      'https://www.youtube.com/@MrBeast',
      'https://www.youtube.com/c/MrBeast',
      'https://www.youtube.com/channel/UCX6OQ3Dk9eI6IwiQVwUqJhA',
    ];

    const proxy = process.env.HTTPS_PROXY || process.env.https_proxy || process.env.ALL_PROXY || process.env.all_proxy;

    for (const channelUrl of testUrls) {
      console.log(`\nTesting channel: ${channelUrl}`);

      try {
        const args = ['--dump-json', '--flat-playlist', '--playlist-end', '3', '--no-warnings'];
        if (proxy) {
          args.push('--proxy', proxy);
        }
        const result = await runYtDlp([...args, channelUrl]);
        const videoList = result.stdout
          .split('\n')
          .filter((line) => line.trim())
          .map((line) => JSON.parse(line));
        console.log(`  Found ${videoList.length} videos`);

        if (videoList.length > 0) {
          videoList.forEach((video: any, index: number) => {
            console.log(`    ${index + 1}. ${video.title}`);
            console.log(`       ID: ${video.id}`);
          });
          console.log(`  ✅ This format works!`);
          break;
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.log(`  ❌ Failed: ${message}`);
      }
    }

    console.log('\n✅ Channel browse test completed!');
  } catch (error) {
    console.error('❌ Channel browse test failed:', error);
    process.exit(1);
  }
}

testChannelBrowse();
