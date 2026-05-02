import youtubedl from 'youtube-dl-exec';

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
        const videos = await youtubedl(channelUrl, {
          dumpJson: true,
          flatPlaylist: true,
          playlistEnd: 3,
          noWarnings: true,
          proxy: proxy
        });

        console.log(`  Found ${videos.length} videos`);

        if (Array.isArray(videos) && videos.length > 0) {
          videos.forEach((video, index) => {
            console.log(`    ${index + 1}. ${video.title}`);
            console.log(`       ID: ${video.id}`);
          });
          console.log(`  ✅ This format works!`);
          break;
        }
      } catch (error) {
        console.log(`  ❌ Failed: ${error.message}`);
      }
    }

    console.log('\n✅ Channel browse test completed!');
  } catch (error) {
    console.error('❌ Channel browse test failed:', error);
    process.exit(1);
  }
}

testChannelBrowse();
