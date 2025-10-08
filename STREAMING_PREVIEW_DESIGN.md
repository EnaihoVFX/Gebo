# Streaming Preview System Design

## Current Approach (Interim Solution)

The current implementation provides instant feedback by:
1. **Showing first clip immediately** - No waiting for generation
2. **Smart caching** - Instant replay of previous configurations
3. **Incremental detection** - Only regenerates changed segments

## Full Streaming Implementation (Phase 2)

For truly instant, streaming preview that shows frames as they encode:

### Architecture

```
Timeline Changes → Segment Detection → Parallel Encoding → Progressive Playback
     ↓                    ↓                    ↓                    ↓
  Clip edits        Find changes        Encode segments       Stream to player
                                        (background)          (while encoding)
```

### Key Components

#### 1. **Segment-Based Rendering**

```typescript
interface PreviewSegment {
  id: string;
  hash: string;          // For change detection
  startTime: number;     // Timeline position
  duration: number;
  status: 'pending' | 'encoding' | 'ready';
  url?: string;          // Blob URL when ready
}
```

**Benefits:**
- Only re-encode changed segments
- Parallel encoding of multiple segments
- Instant updates for unchanged parts

#### 2. **Streaming Encoder (Rust/FFmpeg)**

```rust
pub fn encode_segment_stream(
  media_path: &str,
  start: f64,
  end: f64,
  callback: impl Fn(Vec<u8>) // Stream encoded chunks
) -> Result<()>
```

**Implementation:**
- FFmpeg outputs to pipe instead of file
- Send chunks to frontend as they're encoded
- Frontend buffers and plays using MSE

#### 3. **Media Source Extensions (MSE)**

```typescript
// Create MediaSource for streaming playback
const mediaSource = new MediaSource();
const video = document.querySelector('video');
video.src = URL.createObjectURL(mediaSource);

mediaSource.addEventListener('sourceopen', () => {
  const sourceBuffer = mediaSource.addSourceBuffer('video/mp4; codecs="avc1.42E01E, mp4a.40.2"');
  
  // Append chunks as they arrive from encoder
  streamEncodedChunks(sourceBuffer);
});
```

**Features:**
- Play while encoding
- Seek to encoded regions
- Adaptive buffering

#### 4. **Progressive Encoding Pipeline**

```
┌─────────────────────────────────────────────────────────────┐
│ Timeline: [Clip A] [Clip B] [Clip C]                        │
└─────────────────────────────────────────────────────────────┘
       ↓           ↓           ↓
  ┌────────┐  ┌────────┐  ┌────────┐
  │ Encode │  │ Encode │  │ Encode │  ← Parallel workers
  │ Seg A  │  │ Seg B  │  │ Seg C  │
  └────────┘  └────────┘  └────────┘
       ↓           ↓           ↓
  ┌──────────────────────────────────┐
  │ Source Buffer (MSE)              │  ← Append as ready
  │ [████████░░░░░░░░░░░░]          │
  └──────────────────────────────────┘
       ↓
  ┌──────────────────────────────────┐
  │ Video Player                     │  ← Can play partially ready
  │ ▶ Playing...                     │
  └──────────────────────────────────┘
```

### Implementation Phases

#### Phase 1: Smart Caching ✅ (Current)
- [x] Instant cache hits
- [x] Show first clip immediately
- [x] Fast debouncing
- [x] Change detection

#### Phase 2: Segment-Based Rendering
- [ ] Break timeline into segments
- [ ] Hash-based change detection
- [ ] Cache individual segments
- [ ] Composite unchanged segments instantly

#### Phase 3: Parallel Encoding
- [ ] Background worker threads (Rust)
- [ ] Encode multiple segments simultaneously
- [ ] Priority-based encoding (visible segments first)
- [ ] Cancel/restart on timeline changes

#### Phase 4: Streaming Playback (Full Implementation)
- [ ] FFmpeg streaming output (pipe to frontend)
- [ ] MSE integration for progressive playback
- [ ] Chunked transfer encoding
- [ ] Adaptive buffering strategy

#### Phase 5: Advanced Features
- [ ] Predictive pre-encoding (guess next edits)
- [ ] Hardware acceleration (VideoToolbox, NVENC)
- [ ] Quality adaptation based on network/CPU
- [ ] Scrubbing support (seek to any encoded position)

### Technical Challenges

#### Challenge 1: FFmpeg Streaming
**Problem:** FFmpeg normally outputs complete files  
**Solution:** Use pipe output with chunked MP4 (fragmented MP4/fMP4)

```rust
Command::new("ffmpeg")
    .args([
        "-i", input,
        "-movflags", "frag_keyframe+empty_moov+default_base_moof",
        "-f", "mp4",
        "pipe:1"  // Output to stdout
    ])
```

#### Challenge 2: MSE Compatibility
**Problem:** MSE requires specific codecs and container formats  
**Solution:** Use fragmented MP4 with H.264 baseline profile

```typescript
const mimeCodec = 'video/mp4; codecs="avc1.42E01E, mp4a.40.2"';
if (!MediaSource.isTypeSupported(mimeCodec)) {
    // Fallback to standard preview
}
```

#### Challenge 3: Segment Boundaries
**Problem:** Video can't be split at arbitrary points  
**Solution:** Split at keyframes, force keyframes every N seconds

```rust
"-force_key_frames", "expr:gte(t,n_forced*2)"  // Keyframe every 2s
```

#### Challenge 4: Timeline Changes During Encoding
**Problem:** User edits while preview is encoding  
**Solution:** Cancellable encoding tasks with priority queue

```rust
struct EncodingTask {
    id: String,
    priority: u8,
    cancel_token: CancellationToken,
}
```

### Performance Targets

| Metric | Current | Phase 2 | Phase 4 (Streaming) |
|--------|---------|---------|---------------------|
| First frame | 500ms | 100ms | **Instant** |
| Small edit (1 clip) | 1-2s | 200ms | **Instant** |
| Full timeline | 2-10s | 1-5s | Progressive (start ~100ms) |
| Cached replay | **Instant** | **Instant** | **Instant** |
| Edit response | 500ms | **Instant** | **Instant** |

### API Design

#### Rust Backend

```rust
// Stream segment encoding
#[tauri::command]
async fn encode_segment_stream(
    segment: TimelineSegment,
    width: u32,
    callback: Channel<EncodingProgress>
) -> Result<String, String> {
    // Encode segment
    // Send progress updates: callback.send(progress)
    // Return segment blob URL
}

// Composite segments
#[tauri::command]
fn composite_segments(
    segment_urls: Vec<String>,
    output_path: String
) -> Result<String, String> {
    // Fast concatenation using FFmpeg concat protocol
    // No re-encoding needed
}
```

#### TypeScript Frontend

```typescript
// Hook for streaming preview
const {
    previewUrl,         // Current preview URL (updates progressively)
    isEncoding,         // Is any segment encoding?
    encodingProgress,   // Overall progress
    segments,           // Segment status array
    seekableRange,      // [start, end] of playable content
} = useStreamingPreview({
    clips,
    mediaFiles,
    onSegmentReady: (segmentId) => {
        console.log('Segment ready:', segmentId);
    }
});
```

### User Experience

#### Scenario 1: Adding First Clip
```
User: Drag clip to timeline
↓ (0ms)
System: Show clip's preview proxy immediately
↓ (Background: start encoding if needed)
User: Can play instantly
```

#### Scenario 2: Adding Second Clip
```
User: Drag second clip
↓ (0ms)  
System: Show first clip (already ready)
↓ (100-200ms)
System: Second segment encoded → seamless transition
↓
User: Can play through both clips
```

#### Scenario 3: Editing Existing Clip
```
User: Trim clip
↓ (0ms)
System: Keep unchanged segments, encode only trimmed part
↓ (50-100ms)
System: Update preview with new segment
↓
User: Instant feedback
```

#### Scenario 4: Scrubbing During Encoding
```
User: Scrub timeline while encoding
↓
System: Play any encoded segments immediately
System: Show loading for unencoded regions
↓
User: Progressive reveal as encoding catches up
```

### Memory Management

```typescript
// Limit segment cache
const MAX_CACHED_SEGMENTS = 50;
const MAX_CACHE_SIZE_MB = 200;

// LRU eviction
if (cache.size > MAX_CACHED_SEGMENTS) {
    evictLeastRecentlyUsed();
}

// Monitor memory
if (getTotalCacheSize() > MAX_CACHE_SIZE_MB * 1024 * 1024) {
    evictOldestSegments();
}
```

### Quality Adaptation

```typescript
// Adapt quality based on encoding speed
const targetFrameTime = 1000 / 30; // 30 FPS
const actualFrameTime = measureEncodingSpeed();

if (actualFrameTime > targetFrameTime * 2) {
    // Too slow - reduce quality
    decreaseQuality(); // CRF 26 → 28
    reduceResolution(); // 1280px → 960px
} else if (actualFrameTime < targetFrameTime * 0.5) {
    // Fast enough - increase quality
    increaseQuality(); // CRF 28 → 26
}
```

## Migration Path

### Step 1: Keep current system working ✅
- Users have instant feedback via first clip
- Cached previews load instantly
- System is functional

### Step 2: Add segment detection
- Detect which clips changed
- Cache individual clips
- Composite from cache (instant for unchanged clips)

### Step 3: Add streaming infrastructure  
- Implement FFmpeg streaming output
- Add MSE player component
- Test progressive playback

### Step 4: Enable streaming by default
- Feature flag for testing
- Gradual rollout
- Fallback to current system if issues

### Step 5: Advanced features
- Parallel encoding
- Predictive encoding
- Hardware acceleration

## Conclusion

The current system provides a good interim solution with instant cached previews and fast first-frame display. The full streaming implementation will make it truly instant by:

1. **Progressive encoding** - Show frames as they're encoded
2. **Incremental updates** - Only re-encode what changed  
3. **Parallel processing** - Encode multiple segments simultaneously
4. **Instant playback** - Play while encoding continues

This provides a professional, responsive editing experience where timeline changes feel instant and playback is always available.




