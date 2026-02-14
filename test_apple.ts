
import { fetchAppleMusicPlaylist } from './lib/platforms/applemusic';

async function test() {
  const url = "https://music.apple.com/us/album/1989-taylors-version/1708308989";
  try {
    // We need to modify lib/platforms/applemusic.ts to log item structure or just rely on what it returns
    const tracks = await fetchAppleMusicPlaylist(url);
    console.log("Found tracks:", tracks.length);
    if (tracks.length > 0) {
      console.log("First track:", tracks[0]);
    }
  } catch (e) {
    console.error(e);
  }
}

test();
