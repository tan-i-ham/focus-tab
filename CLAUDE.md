# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Chrome Manifest V3 extension called "Focus Tab - Smart Tab Manager" that helps users manage browser tabs by:
- Tracking tab activity and alerting about inactive tabs (1+ hours)
- Suggesting intelligent tab groupings based on domain similarity and keyword analysis
- Providing a popup interface for bulk tab management

## Architecture

The extension follows Chrome Manifest V3 architecture with three main components:

### Service Worker (`background.js`)
- **Tab Activity Tracking**: Monitors all tab events (`onActivated`, `onUpdated`, `onCreated`, `onRemoved`) and stores timestamps in Chrome storage
- **Periodic Checks**: Uses Chrome alarms API to check for inactive tabs every minute (configurable via `CHECK_INTERVAL`)
- **Smart Grouping Analysis**: Analyzes tabs for grouping opportunities based on domain matching and keyword extraction from titles
- **Message Handling**: Processes requests from popup for tab closing and grouping operations

### Popup Interface (`popup/`)
- **Class-based Architecture**: `TabCloserPopup` class manages all popup functionality
- **Tab Management**: Displays inactive tabs with selection capabilities and bulk actions
- **Group Suggestions**: Shows intelligent grouping suggestions with expandable details
- **Real-time Updates**: Communicates with service worker via Chrome runtime messaging

### Data Storage
- Uses Chrome Storage API (`chrome.storage.local`) for persistence
- Key data structures:
  - `tabActivity`: Maps tab IDs to activity metadata (lastAccess, url, title, created)
  - `groupSuggestions`: Stores analyzed grouping recommendations
  - `inactiveTabs`: Cached list of inactive tabs for popup display

## Key Constants and Configuration

- `INACTIVE_THRESHOLD`: Currently set to 1 hour
- `CHECK_INTERVAL`: 5 minutes for periodic inactive tab checks
- Domain grouping requires 2+ tabs from same domain
- Keyword grouping requires 3+ tabs with matching words (4+ characters)

## Development Commands

This project does not use package.json or build tools - it's a pure HTML/CSS/JS Chrome extension that can be loaded directly via Chrome's developer mode.

### Testing the Extension
1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" in the top right
3. Click "Load unpacked" and select the project directory
4. The extension icon will appear in the toolbar

### Icon Management
- Icons are stored as SVG files in `icons/` directory
- Optional PNG conversion can be done using `generate-icons.js` and `create-icons.html`
- Update `manifest.json` references if converting from SVG to PNG

## File Structure

```
focus-tab/
├── manifest.json          # Extension configuration and permissions
├── background.js          # Service worker for tab tracking and logic
├── popup/
│   ├── popup.html        # Popup interface HTML
│   ├── popup.css         # Styling for popup
│   └── popup.js          # Popup logic (TabCloserPopup class)
├── icons/                # Extension icons (SVG format)
└── generate-icons.js     # Utility for icon conversion
```

## Key Implementation Details

### Tab Activity Tracking
- Activity updates on tab activation, URL changes, and creation
- Automatic cleanup of data for closed tabs
- Timestamps stored in milliseconds for precise calculations

### Grouping Algorithm
- **Domain Grouping**: Extracts hostname from tab URLs, groups tabs with matching domains
- **Keyword Grouping**: Tokenizes tab titles, finds common words (4+ characters), groups tabs with shared keywords
- Suggestions include tab metadata and human-readable reasons

### Security and Privacy
- All data stored locally using Chrome Storage API
- No external network requests or data transmission
- Respects Chrome's security model and required permissions

## Chrome Permissions Required

- `tabs`: Access tab information and manage tabs
- `storage`: Store activity data persistently  
- `alarms`: Schedule periodic inactive tab checks
- `notifications`: Show browser notifications for inactive tabs
- `activeTab`: Access active tab content for analysis