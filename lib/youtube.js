// Thin wrapper around the YouTube Data API v3 — resolves a channel handle
// or legacy username to its uploads playlist, then lists recent uploads
// from that playlist. Public data only (no OAuth/user data needed).
const API_KEY = process.env.YOUTUBE_API_KEY;
const BASE = 'https://www.googleapis.com/youtube/v3';

async function ytGet(path, params) {
  if (!API_KEY) throw new Error('YOUTUBE_API_KEY is not set.');
  const url = new URL(`${BASE}/${path}`);
  url.searchParams.set('key', API_KEY);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

  const res = await fetch(url.toString());
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`YouTube API error ${res.status}: ${errText}`);
  }
  return res.json();
}

// Resolves a channel to its "uploads" playlist ID — every channel has one
// auto-generated playlist containing all its public uploads, newest first.
async function getUploadsPlaylistId({ handle, legacyUsername }) {
  const params = handle ? { forHandle: handle, part: 'contentDetails' } : { forUsername: legacyUsername, part: 'contentDetails' };
  const data = await ytGet('channels', params);
  const channel = data.items && data.items[0];
  if (!channel) return null;
  return channel.contentDetails.relatedPlaylists.uploads;
}

// Returns recent uploads (newest first) as { videoId, title, description, publishedAt }.
async function getRecentUploads(playlistId, maxResults = 10) {
  const data = await ytGet('playlistItems', {
    playlistId,
    part: 'snippet',
    maxResults: String(maxResults),
  });
  return (data.items || []).map((item) => ({
    videoId: item.snippet.resourceId.videoId,
    title: item.snippet.title,
    description: item.snippet.description,
    publishedAt: item.snippet.publishedAt,
  }));
}

module.exports = { getUploadsPlaylistId, getRecentUploads };
