# AI Timeline System - JSON-Based Project Management

## Overview

The video editor now uses a JSON-based project system that serves as the single source of truth for all timeline data. This system allows AI assistants to directly manipulate the timeline through structured data operations.

## Key Features

### 🎯 **Single Source of Truth**
- All timeline data is stored in a structured JSON format
- No more scattered state management across components
- Consistent data model across the entire application

### 🤖 **AI-Friendly Interface**
- Direct JSON manipulation for AI operations
- Natural language command interface
- Programmatic timeline control

### 📊 **Comprehensive Data Model**
- Media files with metadata and AI annotations
- Tracks with configuration and AI notes
- Clips with positioning and AI-generated descriptions
- Timeline state with selection and viewport information

## JSON Schema Structure

```json
{
  "metadata": {
    "title": "Project Name",
    "version": "1.0.0",
    "createdAt": "2024-01-15T10:30:00.000Z",
    "lastModified": "2024-01-15T12:45:00.000Z",
    "description": "Project description"
  },
  "settings": {
    "timelineSettings": {
      "frameRate": 30,
      "resolution": { "width": 1920, "height": 1080 },
      "duration": 60.5
    },
    "exportSettings": {
      "format": "mp4",
      "quality": "high",
      "codec": "h264"
    }
  },
  "mediaFiles": [...],
  "tracks": [...],
  "clips": [...],
  "timeline": {
    "currentTime": 5.2,
    "zoom": 1.5,
    "pan": 0,
    "selectedClipId": "clip1",
    "inOutPoints": { "in": 2.0, "out": 8.5 }
  }
}
```

## AI Operations

### Available Commands

The AI can execute natural language commands like:

- `"add clip media1 to track video-1 at 10s, duration 5s"`
- `"move clip clip1 to 15s"`
- `"split clip clip1 at 8s"`
- `"remove clip clip2"`
- `"show clips"`
- `"show timeline state"`

### Programmatic Operations

```typescript
// Add a clip to the timeline
aiOps.addClip(mediaFileId, trackId, offset, startTime, endTime, {
  name: "AI Generated Clip",
  description: "Added by AI assistant",
  tags: ["ai-generated", "automatic"]
});

// Move a clip
aiOps.moveClip(clipId, newOffset);

// Split a clip
aiOps.splitClip(clipId, splitTime);

// Get current timeline state
const state = aiOps.getTimelineState();
```

## Usage Examples

### 1. Import/Export Projects

```typescript
// Export current project to JSON
const projectJson = projectManager.exportToJSON();

// Import project from JSON
projectManager.importFromJSON(jsonString);

// Save to file
await projectManager.saveToFile('/path/to/project.json');

// Load from file
await projectManager.loadFromFile('/path/to/project.json');
```

### 2. AI Timeline Manipulation

```typescript
// Get AI operations interface
const aiOps = useAITimelineOperations();

// Add a clip programmatically
aiOps.addClip('media1', 'video-1', 0, 0, 10, {
  name: 'Intro Video',
  description: 'Project introduction',
  tags: ['intro', 'ai-generated']
});

// Split a clip
aiOps.splitClip('clip1', 5.5);

// Move a clip
aiOps.moveClip('clip1', 15);
```

### 3. Natural Language Commands

Use the AI Timeline Interface in the UI:

1. **Add Clip**: `"add clip media1 to track video-1 at 10s, duration 5s"`
2. **Move Clip**: `"move clip clip1 to 15s"`
3. **Split Clip**: `"split clip clip1 at 8s"`
4. **Remove Clip**: `"remove clip clip2"`
5. **Show State**: `"show clips"` or `"show timeline state"`

## Benefits

### For Developers
- **Centralized State**: All timeline data in one place
- **Type Safety**: Strongly typed interfaces for all data structures
- **Extensibility**: Easy to add new features and metadata
- **Debugging**: Clear data flow and state management

### For AI Assistants
- **Direct Access**: Can read and modify timeline data directly
- **Structured Operations**: Clear APIs for all timeline manipulations
- **Metadata Support**: Can add AI-specific notes and descriptions
- **Command Interface**: Natural language command processing

### For Users
- **Consistency**: Reliable timeline behavior
- **Performance**: Optimized state management
- **Flexibility**: AI can assist with complex timeline operations
- **Transparency**: All changes are tracked and visible

## File Structure

```
src/
├── lib/
│   └── projectManager.ts          # Core project management
├── hooks/
│   └── useProject.ts              # React hooks for project data
├── components/
│   └── AITimelineInterface.tsx    # AI command interface
└── pages/VideoEditor/
    └── VideoEditor.tsx            # Updated to use project system
```

## Example Project File

See `example-project.json` for a complete example of a project file with:
- Multiple media files (video and audio)
- Multiple tracks
- Several clips with AI-generated metadata
- Timeline state with current position and selection

## Migration from Old System

The new system is backward compatible and will automatically:
1. Initialize with default tracks and settings
2. Convert existing clips to the new format
3. Preserve all existing functionality
4. Add new AI-friendly features

## Future Enhancements

- **Collaborative Editing**: Multiple AI assistants working on the same timeline
- **Version Control**: Git-like versioning for timeline changes
- **Advanced AI Features**: Automatic content analysis and suggestions
- **Real-time Sync**: Live updates across multiple clients

