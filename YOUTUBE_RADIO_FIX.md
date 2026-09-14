# YouTube Radio Link Fix

## Problem
YouTube radio/autoplay links weren't playing correctly. When users shared links like:
```
https://www.youtube.com/watch?v=P4jcBiXIvOo&list=RDMMP4jcBiXIvOo&start_radio=1
```

The bot would fail to play them because these links contain special playlist parameters that create dynamic "radio" or "mix" playlists.

## What are YouTube Radio Links?

YouTube radio links are generated when you:
1. Click "Play" on a video
2. YouTube auto-generates a personalized playlist based on that video
3. The URL contains special parameters:
   - `list=RDMM...` (Radio Mix based on video)
   - `list=RDCM...` (Radio Mix based on channel)
   - `list=RDEM...` (Radio Mix based on user preferences)
   - `start_radio=1` (indicates autoplay/radio mode)

These playlists are **dynamic** and change based on the user's preferences, so they can't be loaded as static playlists.

## Solution

Modified `music/resolveQuery.js` to automatically detect and clean these links:

### Before:
```javascript
const result = await player.search({ query }, requester);
```

### After:
```javascript
const cleanedQuery = cleanYouTubeRadioUrl(query);
const result = await player.search({ query: cleanedQuery }, requester);
```

## How It Works

The new `cleanYouTubeRadioUrl()` function:

1. **Detects YouTube URLs** - Checks if the query contains `youtube.com` or `youtu.be`
2. **Parses the URL** - Extracts video ID and list parameters
3. **Identifies radio links** - Checks if `list` starts with `RDMM`, `RDCM`, or `RDEM`
4. **Cleans the URL** - Returns just the video URL without the radio parameters
5. **Preserves regular playlists** - Keeps normal playlist URLs intact

## Examples

### ✅ Radio Link (Cleaned)
**Input:** `https://www.youtube.com/watch?v=P4jcBiXIvOo&list=RDMMP4jcBiXIvOo&start_radio=1`  
**Output:** `https://www.youtube.com/watch?v=P4jcBiXIvOo`  
**Result:** Plays the single video

### ✅ Short URL (Cleaned)
**Input:** `https://youtu.be/P4jcBiXIvOo`  
**Output:** `https://www.youtube.com/watch?v=P4jcBiXIvOo`  
**Result:** Plays the video

### ✅ Regular Playlist (Preserved)
**Input:** `https://www.youtube.com/watch?v=abc123&list=PLxxxxxx`  
**Output:** `https://www.youtube.com/watch?v=abc123&list=PLxxxxxx`  
**Result:** Loads the entire playlist

### ✅ Search Query (Unchanged)
**Input:** `"never gonna give you up"`  
**Output:** `"never gonna give you up"`  
**Result:** Searches YouTube normally

## Testing

Test these scenarios:
1. ✅ Radio links with `&start_radio=1`
2. ✅ Mix links with `list=RDMM...`
3. ✅ Short URLs (`youtu.be/...`)
4. ✅ Regular playlists (should still load all tracks)
5. ✅ Search queries (should still search)
6. ✅ Direct video URLs (should work as before)

## Code Location

**File:** `music/resolveQuery.js`  
**Function:** `cleanYouTubeRadioUrl(query)`  
**Lines:** Added ~50 lines of URL parsing and cleaning logic

## Notes

- This fix is **non-breaking** - all existing functionality still works
- Regular YouTube playlists are **not affected**
- Search queries pass through **unchanged**
- Invalid URLs are **handled gracefully** (returned as-is)
- Logging added for debugging: `[Music] Detected YouTube radio link, extracting video: VIDEO_ID`

## Why This Matters

YouTube radio links are commonly shared because they appear when:
- Users click "Play" instead of just copying the URL
- Sharing from YouTube Music
- Using the "Start Radio" feature
- Sharing from mobile apps

Without this fix, users would get errors when trying to play these very common link formats.

---

**Status:** ✅ Fixed and tested  
**Impact:** High (very common user scenario)  
**Breaking Changes:** None
