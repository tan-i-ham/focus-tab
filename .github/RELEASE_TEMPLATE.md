# Release Template

Use this template when creating new releases for Focus Tab - Smart Tab Manager.

## Version [X.Y.Z] Release Checklist

### Pre-Release Steps
- [ ] Update version number in `manifest.json`
- [ ] Update `CHANGELOG.md` with new version details
- [ ] Test extension functionality thoroughly
- [ ] Verify all features work in latest Chrome version
- [ ] Review Chrome Web Store compliance

### Release Steps
- [ ] Commit version changes: `git commit -m "chore: Bump version to X.Y.Z"`
- [ ] Create git tag: `git tag vX.Y.Z`
- [ ] Push to repository: `git push origin main --tags`
- [ ] Create GitHub release using changelog content
- [ ] Package extension for Chrome Web Store
- [ ] Submit to Chrome Web Store with formatted release notes

---

## GitHub Release Notes Template

```markdown
## Focus Tab v[X.Y.Z] - [Release Name]

### 🚀 New Features
- Feature 1 description
- Feature 2 description

### ✨ Enhancements
- Enhancement 1 description
- Enhancement 2 description

### 🔧 Bug Fixes
- Fix 1 description
- Fix 2 description

### 🗑️ Removed
- Removal 1 description (if applicable)

### 📋 Technical Changes
- Technical change 1
- Technical change 2

**Full Changelog**: https://github.com/[username]/focus-tab/compare/v[PREV_VERSION]...v[CURRENT_VERSION]

### Installation
Download the extension from the [Chrome Web Store](link-to-store) or load unpacked from the [releases page](link-to-releases).
```

---

## Chrome Web Store Release Notes Template

```markdown
Version [X.Y.Z] - [Brief Description]

🚀 NEW FEATURES:
• Feature 1 with user benefit explanation
• Feature 2 with user benefit explanation

✨ IMPROVEMENTS:
• Enhancement 1 with clear value proposition
• Enhancement 2 with clear value proposition

🔧 BUG FIXES:
• Fix 1 with user impact description
• Fix 2 with user impact description

This update improves [main benefit] and adds [key new capability] to help you manage your browser tabs more effectively.

---

Technical Details:
- Chrome Manifest V3 compliant
- Requires Chrome 88+
- Local data storage only (privacy focused)
- No external network requests

Keywords: tab management, productivity, browser extension, tab grouping, inactive tabs
```

---

## Version Naming Convention

### Semantic Versioning (X.Y.Z)
- **Major (X)**: Breaking changes, major feature overhauls, architecture changes
- **Minor (Y)**: New features, significant enhancements, new capabilities
- **Patch (Z)**: Bug fixes, small improvements, minor tweaks

### Release Names (Optional)
Consider themed names for major releases:
- Focus-themed: "Clear Focus", "Sharp Vision", "Laser Focus"
- Tab-themed: "Tab Master", "Group Genius", "Clean Slate"
- Productivity-themed: "Workflow Wizard", "Productivity Pro", "Efficiency Expert"

---

## Testing Checklist

### Core Functionality
- [ ] Tab activity tracking works correctly
- [ ] Inactive tab identification (1+ hour threshold)
- [ ] Tab grouping suggestions generate properly
- [ ] Domain-based grouping works
- [ ] Keyword-based grouping works
- [ ] Bulk tab closing functions
- [ ] Group management (create, close groups)

### User Interface
- [ ] Popup displays correctly
- [ ] All buttons and interactions work
- [ ] Visual indicators show proper states
- [ ] Responsive design elements
- [ ] Accessibility features functional

### Technical
- [ ] Service worker initializes properly
- [ ] Chrome storage operations work
- [ ] Memory usage is reasonable
- [ ] No console errors
- [ ] Extension icon displays correctly
- [ ] Permissions are appropriate

### Browser Compatibility
- [ ] Chrome latest stable
- [ ] Chrome beta (if available)
- [ ] Manifest V3 compliance verified

---

## Submission Guidelines

### Chrome Web Store
1. **Description Length**: Keep under 132 characters for short description
2. **Screenshots**: Include 2-5 screenshots showing key features
3. **Icon**: Ensure high-quality icon at required sizes
4. **Privacy**: Highlight local-only data storage
5. **Keywords**: Use relevant, searchable terms

### GitHub Release
1. **Comprehensive Notes**: Include technical and user-facing changes
2. **Breaking Changes**: Clearly mark any breaking changes
3. **Migration Guide**: Provide upgrade instructions if needed
4. **Asset Links**: Include packaged extension file
5. **Comparison Links**: Link to diff view for code changes