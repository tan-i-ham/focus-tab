# Changelog

All notable changes to Focus Tab - Smart Tab Manager will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.3.0] - 2025-09-05

### Enhanced
- Remove svg icons due to Chrome Web Store installation issues

---

## [0.2.0] - 2025-09-02

### Added
- **Tab Groups Integration**: Full support for Chrome's native tab groups with tabGroups permission
- **Enhanced Group Suggestions**: Smart filtering that excludes already grouped tabs from new suggestions
- **Interactive Group Management**: Clickable tabs in group suggestions with dropdown functionality
- **Bulk Group Actions**: Close all tabs in a group with one click
- **Visual Tab Indicators**: Clear duration indicators for inactive tabs
- **Improved Icon System**: High-quality PNG icons with multiple sizes (16px, 32px, 48px, 128px)

### Enhanced
- **Smart Tab Grouping**: Improved algorithm with retry mechanism (up to 3 attempts) for reliable grouping
- **Activity Tracking**: Enhanced inactive tab detection with better timestamp management
- **User Interface**: Cleaner popup design with better visual hierarchy and interaction patterns
- **Initialization Process**: More robust startup sequence with better error handling

### Fixed
- Resolved "Unable to download all specified images" error during extension installation
- Fixed stale timestamp issues in tab activity tracking
- Improved group tab suggestions reliability
- Enhanced tab switching functionality in popup interface

### Removed
- Notification system (simplified user experience)
- Alarm-based background processing (optimized for better performance)

---

## [0.1.0] - Initial Release

### Added
- **Core Tab Management**: Track and identify inactive tabs (1+ hours of inactivity)
- **Smart Tab Grouping**: Automatic suggestions based on domain similarity and keyword analysis
- **Popup Interface**: Clean, intuitive interface for managing inactive tabs
- **Bulk Tab Operations**: Select and close multiple inactive tabs at once
- **Chrome Storage Integration**: Persistent storage of tab activity data
- **Background Processing**: Service worker for continuous tab monitoring
- **Visual Feedback**: Clear indicators for tab status and grouping suggestions

### Technical Features
- Chrome Manifest V3 compliance
- Service worker architecture for background processing
- Chrome Storage API integration
- Tab API integration for comprehensive tab management
- Real-time tab activity tracking

---

## Chrome Web Store Release Notes

### Version 0.2.0 Summary
**Major Update: Enhanced Tab Grouping & Management**

🚀 **New Features:**
• Native Chrome tab groups integration with full management capabilities
• Smart group suggestions that exclude already organized tabs
• Interactive group management with clickable tabs and dropdown menus
• Bulk actions to close entire tab groups instantly

✨ **Improvements:**
• More reliable tab grouping with automatic retry system
• Better visual indicators for inactive tab durations
• Enhanced popup interface with improved user experience
• Optimized background processing for better performance

🔧 **Bug Fixes:**
• Fixed installation issues with extension icons
• Resolved tab activity tracking inconsistencies
• Improved group suggestion accuracy

This update significantly enhances your tab management experience with native Chrome integration and more powerful grouping capabilities.

---

## Development Notes

### Changelog Maintenance
- Update this file before creating new version tags
- Follow semantic versioning principles
- Include both technical and user-facing changes
- Maintain separate sections for GitHub and Chrome Web Store audiences

### Release Process
1. Update CHANGELOG.md with new version changes
2. Update version in manifest.json
3. Commit changes with appropriate commit message
4. Create git tag (e.g., `git tag v0.3.0`)
5. Use Chrome Web Store section for store updates
6. Create GitHub release using detailed changelog sections