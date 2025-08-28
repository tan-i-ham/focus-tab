# Focus Tab - Smart Tab Manager

A Chrome extension that helps reduce distractions by alerting users about inactive tabs and suggesting related tab groupings.

## Features

### 🚨 Inactive Tab Alerts
- Tracks tab activity automatically
- Alerts users about tabs that haven't been accessed for 24+ hours
- Shows browser notifications for easy tab management
- Provides a clean interface to bulk close inactive tabs

### 🔗 Smart Tab Grouping
- Analyzes tabs for potential groupings based on:
  - Domain similarity (multiple tabs from same website)
  - Keyword matching in titles
- Suggests grouping related tabs together
- One-click tab grouping with automatic naming

## Installation

### From Source
1. Clone or download this repository
2. Open Chrome and go to `chrome://extensions/`
3. Enable "Developer mode" in the top right
4. Click "Load unpacked" and select the extension directory
5. The Focus Tab icon will appear in your toolbar

### Icon Conversion (Optional)
The extension uses SVG icons by default. To convert to PNG format:
1. Open each SVG file in `icons/` directory in a browser
2. Save as PNG with the same filename
3. Update `manifest.json` to reference `.png` files instead of `.svg`

## Usage

### Managing Inactive Tabs
1. Click the Focus Tab icon in your toolbar
2. View the "Inactive Tabs" section to see tabs not accessed for 24+ hours
3. Select individual tabs or use "Select All"
4. Click "Close Selected" to remove inactive tabs

### Grouping Related Tabs
1. Click the Focus Tab icon in your toolbar
2. Switch to the "Group Suggestions" tab
3. Review suggested groupings based on domain or keywords
4. Click "Group These Tabs" to create tab groups automatically

### Notifications
- Browser notifications appear when inactive tabs are detected
- Click notifications to open the Focus Tab interface
- Notifications check runs every hour automatically

## Technical Details

### Architecture
- **Manifest V3** Chrome extension
- **Service Worker** (`background.js`) for tab tracking and periodic checks
- **Popup Interface** for user interaction
- **Chrome Storage API** for persistent data

### Permissions Required
- `tabs` - Access tab information and manage tabs
- `storage` - Store tab activity data persistently
- `alarms` - Schedule periodic inactive tab checks
- `notifications` - Show browser notifications
- `activeTab` - Access active tab content for analysis

### Data Storage
Tab activity data is stored locally using Chrome's storage API:
- Tab access timestamps
- URL and title information
- Group suggestions cache

## Development

### File Structure
```
tab-closer/
├── manifest.json          # Extension configuration
├── background.js          # Service worker for tab tracking
├── popup/
│   ├── popup.html        # Popup interface
│   ├── popup.css         # Styling
│   └── popup.js          # Popup logic
├── icons/                # Extension icons
│   ├── icon16.svg
│   ├── icon32.svg
│   ├── icon48.svg
│   └── icon128.svg
├── generate-icons.js     # Icon generation script
└── create-icons.html     # Visual icon generator

### Key Components

**Tab Activity Tracking**
- Monitors `onActivated`, `onUpdated`, `onCreated`, `onRemoved` tab events
- Stores last access timestamp for each tab
- Automatically cleans up data for closed tabs

**Inactive Detection**
- Configurable threshold (default: 24 hours)
- Periodic checks using Chrome alarms API
- Browser notifications for inactive tabs

**Tab Grouping Analysis**
- Domain-based grouping for tabs from same website
- Keyword analysis of tab titles
- Suggestion scoring and filtering

## Privacy

This extension:
- Stores all data locally on your device
- Does not transmit any data to external servers
- Only accesses tab metadata (titles, URLs, access times)
- Respects Chrome's security model and permissions

## License

MIT License - feel free to modify and distribute.

## Contributing

Contributions welcome! Please feel free to submit issues and enhancement requests.