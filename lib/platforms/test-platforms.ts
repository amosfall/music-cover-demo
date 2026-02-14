// lib/platforms/test-platforms.ts
import { fetchSpotifyPlaylist } from './spotify';
import { fetchQQMusicPlaylist } from './qqmusic';
import { fetchAppleMusicPlaylist } from './applemusic';

async function test() {
  const spotifyUrl = "https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M";
  const qqUrl = "https://y.qq.com/n/ryqq/playlist/8840959407";
  const appleUrl = "https://music.apple.com/us/playlist/todays-hits/pl.f4d106fed2bd41149aaacabb233eb5eb";

  console.log("Testing Spotify...");
  try {
    const s = await fetchSpotifyPlaylist(spotifyUrl);
    console.log(`Spotify success: ${s.length} tracks found.`);
    console.log(s[0]);
  } catch (e: any) {
    console.error("Spotify failed:", e.message);
  }

  console.log("\nTesting QQ Music...");
  try {
    const q = await fetchQQMusicPlaylist(qqUrl);
    console.log(`QQ Music success: ${q.length} tracks found.`);
    console.log(q[0]);
  } catch (e: any) {
    console.error("QQ Music failed:", e.message);
  }

  console.log("\nTesting Apple Music...");
  try {
    const a = await fetchAppleMusicPlaylist(appleUrl);
    console.log(`Apple Music success: ${a.length} tracks found.`);
    console.log(a[0]);
  } catch (e: any) {
    console.error("Apple Music failed:", e.message);
  }
}

// Uncomment to run if ts-node is available, or import in a route to test
// test();
