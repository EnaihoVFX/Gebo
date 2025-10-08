# Infinite Canvas Timeline - Implementation

## Overview

The video editor now has an "infinite canvas" timeline - you can keep playing past the end of your clips, and the playhead will continue moving into the black (empty) area. However, exports only render the actual content duration.

## How It Works

### Timeline Duration
- **Timeline Canvas**: 30 minutes (1800 seconds)
- **Actual Content**: Calculated from clips (e.g., if your last clip ends at 45 seconds, that's the content duration)
- **Export Duration**: Only exports the actual content duration

### Playback Behavior

#### Normal Playback (Within Clips)
- Video plays normally
- Playhead follows video time
- Shows video content

#### Virtual Playback (Past Clips)
- When video reaches the end of actual content, playhead keeps moving
- Shows black screen (16:9)
- Playback timer continues incrementing
- Can play up to 30 minutes on the timeline

#### Scrubbing
- Can scrub anywhere on the 30-minute timeline
- If you scrub to empty area → shows black screen
- If you scrub to clip area → shows video

## Technical Implementation

### 1. Fixed Timeline Duration
```typescript
const TIMELINE_DURATION = 30 * 60; // 30 minutes
const duration = TIMELINE_DURATION;
```

### 2. Actual Content Duration (For Export)
```typescript
const actualContentDuration = useMemo(() => {
  if (clips.length === 0) return 0;
  return Math.max(...clips.map(clip => 
    clip.offset + (clip.endTime - clip.startTime)
  ));
}, [clips]);
```

### 3. Virtual Playback Mode
```typescript
// If we're past the actual content duration, enter "virtual playback" mode
// This keeps the playhead moving in the empty/black area
if (time >= actualContentDuration && isPlaying) {
  virtualPlaybackRef.current = true;
  time = currentPlaybackTime + deltaTime; // Manual time increment
}
```

### 4. Black Screen Detection
```typescript
const hasClipAtCurrentTime = useMemo(() => {
  if (clips.length === 0) return false;
  
  return clips.some(clip => {
    const clipStart = clip.offset;
    const clipEnd = clip.offset + (clip.endTime - clip.startTime);
    return currentPlaybackTime >= clipStart && currentPlaybackTime < clipEnd;
  });
}, [clips, currentPlaybackTime]);
```

## User Experience

### What You'll See

1. **Add clips at different positions** (e.g., 0-5s, 10-15s, 20-25s)
2. **Press Play**:
   - 0-5s: Video plays (first clip)
   - 5-10s: Black screen (no clip)
   - 10-15s: Video plays (second clip)
   - 15-20s: Black screen (no clip)
   - 20-25s: Video plays (third clip)
   - 25s+: **Black screen continues, playhead keeps moving!** ✨

3. **Scrub Timeline**:
   - Drag to 0-5s: See first clip
   - Drag to 7s: See black (empty)
   - Drag to 12s: See second clip
   - Drag to 100s: See black (way past content)

### Footer Display
- Shows **actual content duration** (not 30 minutes)
- Example: If clips end at 45s, footer shows "0:45"
- This is what will be exported

## Export Behavior

When you export:
- **Only exports**: 0s to end of last clip (actual content duration)
- **Does not export**: Empty timeline space
- **Example**: Clips at 0-5s and 20-25s → Exports 0-25s (not 30 minutes)

## Benefits

✅ **Natural Editing**: Like Premiere Pro, DaVinci Resolve  
✅ **Flexible Layout**: Place clips anywhere on timeline  
✅ **Visual Feedback**: Black screen shows gaps clearly  
✅ **Smart Export**: Only exports what you need  
✅ **Infinite Feeling**: Can keep playing/scrubbing past content  

## Example Scenarios

### Scenario 1: Single Clip
- Clip: 5-10s
- Playback: 0-5s (black) → 5-10s (video) → 10s+ (black, playhead keeps moving)
- Export: 0-10s

### Scenario 2: Multiple Clips with Gaps
- Clips: 0-5s, 20-25s, 60-70s
- Playback: Shows video/black as appropriate, playhead continues past 70s
- Export: 0-70s

### Scenario 3: Scrubbing Beyond Content
- Content ends: 45s
- Scrub to: 200s (way past content)
- Shows: Black screen
- Can still: Play from there (black screen, playhead moving)

Perfect for professional video editing! 🎬

