/**
 * @jest-environment jsdom
 */

// Mock Chrome APIs
global.chrome = {
  runtime: {
    sendMessage: jest.fn((message, callback) => {
      // Mock different responses based on message action
      const mockResponses = {
        getInactiveTabs: { inactiveTabs: [] },
        getGroupSuggestions: { groupSuggestions: {} },
        closeTabs: { success: true },
        switchToTab: { success: true }
      };
      
      // Call callback immediately instead of using setTimeout to avoid async issues
      callback(mockResponses[message.action] || { success: true });
    }),
    lastError: null
  },
  tabs: {
    query: jest.fn(() => Promise.resolve([
      { id: 1, title: 'Tab 1', url: 'https://example1.com' },
      { id: 2, title: 'Tab 2', url: 'https://example2.com' },
      { id: 3, title: 'Tab 3', url: 'https://example3.com' }
    ]))
  }
};

// Mock DOM methods that might not exist in jsdom
Object.assign(window, {
  close: jest.fn()
});

// Load the popup HTML structure
document.body.innerHTML = `
  <div class="container">
    <div id="inactive-tabs-list" class="tabs-list"></div>
    <div id="group-suggestions-list" class="groups-list"></div>
    <div class="actions" id="inactive-actions" style="display: none;">
      <button id="select-all-inactive" class="btn btn-secondary">Select All</button>
      <button id="close-selected" class="btn btn-danger">Close Selected</button>
    </div>
    <div class="stats">
      <span id="total-tabs">0 tabs total</span>
      <span id="inactive-count">0 inactive</span>
    </div>
  </div>
`;

// Import the actual TabCloserPopup class from production code
const { TabCloserPopup } = require('../popup/popup.js');

describe('TabCloserPopup Checkbox Functionality', () => {
  let popup;
  
  beforeEach(() => {
    // Clear DOM
    document.getElementById('inactive-tabs-list').innerHTML = '';
    document.getElementById('group-suggestions-list').innerHTML = '';
    document.getElementById('inactive-actions').style.display = 'none';
    
    // Reset Chrome API mocks
    jest.clearAllMocks();
    
    // Create popup instance manually without calling constructor's init
    popup = Object.create(TabCloserPopup.prototype);
    popup.selectedTabs = new Set();
    popup.inactiveTabs = [
      { 
        id: 1, 
        title: 'Test Tab 1', 
        url: 'https://example1.com', 
        lastAccess: Date.now() - 2 * 60 * 60 * 1000 
      },
      { 
        id: 2, 
        title: 'Test Tab 2', 
        url: 'https://example2.com', 
        lastAccess: Date.now() - 3 * 60 * 60 * 1000 
      }
    ];
    popup.groupSuggestions = {};
    
    // Call the methods we need for testing
    popup.setupEventListeners();
    popup.renderInactiveTabs();
  });

  afterEach(() => {
    // No need for timer cleanup since we're not using fake timers
  });

  describe('Checkbox Bug Fix Tests', () => {
    test('clicking directly on checkbox should toggle it correctly', () => {
      const checkbox = document.querySelector('[data-tab-id="1"] .tab-checkbox');
      const tabItem = checkbox.closest('.tab-item');
      
      // Initially unchecked
      expect(checkbox.checked).toBe(false);
      expect(tabItem.classList.contains('selected')).toBe(false);
      expect(popup.selectedTabs.has(1)).toBe(false);
      
      // Click checkbox directly
      checkbox.click();
      
      // Should be checked
      expect(checkbox.checked).toBe(true);
      expect(tabItem.classList.contains('selected')).toBe(true);
      expect(popup.selectedTabs.has(1)).toBe(true);
      
      // Click again to uncheck
      checkbox.click();
      
      // Should be unchecked
      expect(checkbox.checked).toBe(false);
      expect(tabItem.classList.contains('selected')).toBe(false);
      expect(popup.selectedTabs.has(1)).toBe(false);
    });

    test('clicking on tab item (not checkbox) should toggle checkbox', () => {
      const tabItem = document.querySelector('[data-tab-id="2"]');
      const checkbox = tabItem.querySelector('.tab-checkbox');
      const tabTitle = tabItem.querySelector('.tab-title');
      
      // Initially unchecked
      expect(checkbox.checked).toBe(false);
      expect(tabItem.classList.contains('selected')).toBe(false);
      expect(popup.selectedTabs.has(2)).toBe(false);
      
      // Click on tab title (not checkbox)
      tabTitle.click();
      
      // Should be checked
      expect(checkbox.checked).toBe(true);
      expect(tabItem.classList.contains('selected')).toBe(true);
      expect(popup.selectedTabs.has(2)).toBe(true);
      
      // Click again to uncheck
      tabTitle.click();
      
      // Should be unchecked
      expect(checkbox.checked).toBe(false);
      expect(tabItem.classList.contains('selected')).toBe(false);
      expect(popup.selectedTabs.has(2)).toBe(false);
    });

    test('clicking on "Go to tab" button should not affect checkbox', () => {
      const tabItem = document.querySelector('[data-tab-id="1"]');
      const checkbox = tabItem.querySelector('.tab-checkbox');
      const gotoButton = tabItem.querySelector('.goto-tab-btn');
      
      // Initially unchecked
      expect(checkbox.checked).toBe(false);
      expect(tabItem.classList.contains('selected')).toBe(false);
      expect(popup.selectedTabs.has(1)).toBe(false);
      
      // Click "Go to tab" button
      gotoButton.click();
      
      // Should remain unchecked
      expect(checkbox.checked).toBe(false);
      expect(tabItem.classList.contains('selected')).toBe(false);
      expect(popup.selectedTabs.has(1)).toBe(false);
      
      // Verify switchToTab was called
      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
        { action: 'switchToTab', tabId: 1 },
        expect.any(Function)
      );
    });

    test('checkbox click should not trigger tab item click (no double toggle)', () => {
      const checkbox = document.querySelector('[data-tab-id="1"] .tab-checkbox');
      
      // Initially unchecked
      expect(checkbox.checked).toBe(false);
      
      // Click checkbox - should only fire change event, not click on tab item
      checkbox.click();
      
      // Should be checked (not double-toggled back to unchecked)
      expect(checkbox.checked).toBe(true);
      expect(popup.selectedTabs.has(1)).toBe(true);
    });

    test('select all functionality works correctly', () => {
      const selectAllButton = document.getElementById('select-all-inactive');
      const checkboxes = document.querySelectorAll('.tab-checkbox');
      
      // Debug: Check if elements exist
      expect(selectAllButton).toBeTruthy();
      expect(checkboxes.length).toBe(2);
      
      // Initially nothing selected
      expect(popup.selectedTabs.size).toBe(0);
      expect(selectAllButton.textContent).toBe('Select All');
      
      // Call toggleSelectAllInactive directly instead of relying on click event
      popup.toggleSelectAllInactive();
      
      // All should be selected
      expect(popup.selectedTabs.size).toBe(2);
      expect(popup.selectedTabs.has(1)).toBe(true);
      expect(popup.selectedTabs.has(2)).toBe(true);
      expect(selectAllButton.textContent).toBe('Deselect All');
      
      checkboxes.forEach(checkbox => {
        expect(checkbox.checked).toBe(true);
        expect(checkbox.closest('.tab-item').classList.contains('selected')).toBe(true);
      });
      
      // Call toggleSelectAllInactive again to deselect all
      popup.toggleSelectAllInactive();
      
      // None should be selected
      expect(popup.selectedTabs.size).toBe(0);
      expect(selectAllButton.textContent).toBe('Select All');
      
      checkboxes.forEach(checkbox => {
        expect(checkbox.checked).toBe(false);
        expect(checkbox.closest('.tab-item').classList.contains('selected')).toBe(false);
      });
    });

    test('close selected button updates correctly', () => {
      const closeButton = document.getElementById('close-selected');
      const checkbox1 = document.querySelector('[data-tab-id="1"] .tab-checkbox');
      const checkbox2 = document.querySelector('[data-tab-id="2"] .tab-checkbox');
      
      // Initially disabled
      expect(closeButton.disabled).toBe(true);
      expect(closeButton.textContent).toBe('Close Selected (0)');
      
      // Select one tab
      checkbox1.click();
      expect(closeButton.disabled).toBe(false);
      expect(closeButton.textContent).toBe('Close Selected (1)');
      
      // Select second tab
      checkbox2.click();
      expect(closeButton.disabled).toBe(false);
      expect(closeButton.textContent).toBe('Close Selected (2)');
      
      // Unselect one tab
      checkbox1.click();
      expect(closeButton.disabled).toBe(false);
      expect(closeButton.textContent).toBe('Close Selected (1)');
      
      // Unselect last tab
      checkbox2.click();
      expect(closeButton.disabled).toBe(true);
      expect(closeButton.textContent).toBe('Close Selected (0)');
    });
  });

  describe('Chrome API Integration', () => {
    test('switchToTab calls Chrome API correctly', async () => {
      const promise = popup.switchToTab(123);
      await promise;
      
      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
        { action: 'switchToTab', tabId: 123 },
        expect.any(Function)
      );
    });

    test('closeSelectedTabs calls Chrome API with correct tab IDs', async () => {
      // Select some tabs
      popup.selectedTabs.add(1);
      popup.selectedTabs.add(2);
      
      const promise = popup.closeSelectedTabs();
      await promise;
      
      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
        { action: 'closeTabs', tabIds: [1, 2] },
        expect.any(Function)
      );
    });
  });

  describe('Utility Functions', () => {
    test('formatTimeAgo returns correct human-readable time', () => {
      const now = Date.now();
      const oneHourAgo = now - (60 * 60 * 1000);
      const oneDayAgo = now - (24 * 60 * 60 * 1000);
      
      expect(popup.formatTimeAgo(oneHourAgo)).toBe('< 1 hour');
      expect(popup.formatTimeAgo(oneDayAgo)).toBe('< 2 days');
    });

    test('formatInactiveDuration returns correct duration', () => {
      const now = Date.now();
      const tab1 = { lastAccess: now - (2 * 60 * 60 * 1000) }; // 2 hours ago
      const tab2 = { lastAccess: now - (25 * 60 * 60 * 1000) }; // 25 hours ago
      
      expect(popup.formatInactiveDuration(tab1)).toBe('2 hours');
      expect(popup.formatInactiveDuration(tab2)).toBe('1 day');
    });

    test('escapeHtml properly escapes HTML characters', () => {
      expect(popup.escapeHtml('<script>alert("xss")</script>')).toBe('&lt;script&gt;alert("xss")&lt;/script&gt;');
      expect(popup.escapeHtml('normal text')).toBe('normal text');
      expect(popup.escapeHtml('')).toBe('');
      expect(popup.escapeHtml(null)).toBe('');
    });
  });
});