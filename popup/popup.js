// Popup script for Focus Tab extension

class TabCloserPopup {
  constructor() {
    this.selectedTabs = new Set();
    this.inactiveTabs = [];
    this.groupSuggestions = {};
    this.init();
  }

  async init() {
    this.setupEventListeners();
    await this.loadData();
    this.renderInactiveTabs();
    this.renderGroupSuggestions();
    this.updateStats();
  }

  setupEventListeners() {
    // Tab navigation
    const tabButtons = document.querySelectorAll('.tab-btn');
    tabButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        this.switchTab(e.target.dataset.tab);
      });
    });

    // Select all inactive tabs
    document.getElementById('select-all-inactive').addEventListener('click', () => {
      this.toggleSelectAllInactive();
    });

    // Close selected tabs
    document.getElementById('close-selected').addEventListener('click', () => {
      this.closeSelectedTabs();
    });
  }

  switchTab(tabName) {
    // Update tab buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.classList.remove('active');
    });
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');

    // Update panels
    document.querySelectorAll('.panel').forEach(panel => {
      panel.classList.remove('active');
    });
    document.getElementById(`${tabName}-panel`).classList.add('active');
  }

  async loadData() {
    try {
      // Load inactive tabs
      const inactiveResponse = await this.sendMessage({ action: 'getInactiveTabs' });
      this.inactiveTabs = (inactiveResponse && inactiveResponse.inactiveTabs) || [];
      console.log('Loaded inactive tabs:', this.inactiveTabs.length, 'tabs');

      // Load group suggestions
      const groupResponse = await this.sendMessage({ action: 'getGroupSuggestions' });
      this.groupSuggestions = (groupResponse && groupResponse.groupSuggestions) || {};
      console.log('Loaded group suggestions:', Object.keys(this.groupSuggestions).length, 'groups');
      console.log('Group suggestions data:', this.groupSuggestions);
    } catch (error) {
      console.error('Failed to load data:', error);
      this.inactiveTabs = [];
      this.groupSuggestions = {};
    }
  }

  renderInactiveTabs() {
    const container = document.getElementById('inactive-tabs-list');
    const actions = document.getElementById('inactive-actions');

    if (this.inactiveTabs.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <h3>🎉 All tabs are active!</h3>
          <p>No tabs have been inactive for 1+ hours.</p>
        </div>
      `;
      actions.style.display = 'none';
      return;
    }

    actions.style.display = 'block';

    container.innerHTML = this.inactiveTabs.map(tab => `
      <div class="tab-item" data-tab-id="${tab.id}">
        <div class="tab-header">
          <input type="checkbox" class="tab-checkbox" data-tab-id="${tab.id}">
          <div class="tab-title" title="${this.escapeHtml(tab.title)}">
            ${this.escapeHtml(tab.title)}
          </div>
        </div>
        <div class="tab-url" title="${this.escapeHtml(tab.url)}">
          ${this.escapeHtml(tab.url)}
        </div>
        <div class="tab-meta">
          <span>Last accessed: ${this.formatTimeAgo(tab.lastAccess)}</span>
          <span class="days-inactive ${this.getInactiveCriticalClass(tab)}">
            ${this.formatInactiveDuration(tab)}
          </span>
        </div>
      </div>
    `).join('');

    // Add event listeners for checkboxes and tab items
    container.querySelectorAll('.tab-checkbox').forEach(checkbox => {
      checkbox.addEventListener('change', (e) => {
        const tabId = parseInt(e.target.dataset.tabId);
        if (e.target.checked) {
          this.selectedTabs.add(tabId);
          e.target.closest('.tab-item').classList.add('selected');
        } else {
          this.selectedTabs.delete(tabId);
          e.target.closest('.tab-item').classList.remove('selected');
        }
        this.updateSelectAllButton();
      });
    });

    // Add click handler for tab items
    container.querySelectorAll('.tab-item').forEach(item => {
      item.addEventListener('click', (e) => {
        // If clicking on checkbox, handle selection
        if (e.target.type === 'checkbox') return;
        
        // If clicking elsewhere, switch to the tab
        const tabId = parseInt(item.dataset.tabId);
        this.switchToTab(tabId);
      });
    });
  }

  renderGroupSuggestions() {
    const container = document.getElementById('group-suggestions-list');
    const suggestions = Object.values(this.groupSuggestions);

    if (suggestions.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <h3>🔍 No grouping suggestions</h3>
          <p>We couldn't find any related tabs to group together.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = suggestions.map((suggestion, index) => `
      <div class="group-item">
        <div class="group-header" data-group-index="${index}">
          <div class="group-info">
            <h3>${this.escapeHtml(suggestion.name)}</h3>
            <div class="group-reason">${this.escapeHtml(suggestion.reason)}</div>
          </div>
          <div class="group-header-right">
            <div class="group-badge">${suggestion.tabs.length} tabs</div>
            <div class="dropdown-arrow">▼</div>
          </div>
        </div>
        <div class="group-tabs">
          ${suggestion.tabs.map(tab => `
            <div class="group-tab clickable-tab" data-tab-id="${tab.id}">
              <div class="group-tab-title" title="${this.escapeHtml(tab.title)}">
                ${this.escapeHtml(tab.title)}
              </div>
              <div class="group-tab-url" title="${this.escapeHtml(tab.url)}">
                ${this.escapeHtml(tab.url)}
              </div>
            </div>
          `).join('')}
          <div class="group-actions">
            <button class="btn btn-danger close-all-btn" data-tab-ids="[${suggestion.tabs.map(t => t.id).join(',')}]">
              Close All Tabs
            </button>
            <button class="btn btn-primary" onclick="tabCloserPopup.groupTabs('${suggestion.name}', [${suggestion.tabs.map(t => t.id).join(',')}])">
              Group These Tabs
            </button>
          </div>
        </div>
      </div>
    `).join('');

    // Add event listeners for dropdown headers
    container.querySelectorAll('.group-header').forEach(headerElement => {
      headerElement.addEventListener('click', () => {
        const groupItem = headerElement.parentElement;
        const groupTabs = groupItem.querySelector('.group-tabs');
        const dropdownArrow = headerElement.querySelector('.dropdown-arrow');
        
        // Toggle expanded state
        groupTabs.classList.toggle('expanded');
        if (dropdownArrow) {
          dropdownArrow.classList.toggle('expanded');
        }
      });
    });

    // Add event listeners for close all tabs buttons
    container.querySelectorAll('.close-all-btn').forEach(buttonElement => {
      buttonElement.addEventListener('click', () => {
        const tabIdsStr = buttonElement.dataset.tabIds;
        const tabIds = JSON.parse(tabIdsStr);
        this.closeAllTabsInGroup(tabIds);
      });
    });

    // Add event listeners for clickable tabs
    container.querySelectorAll('.clickable-tab').forEach(tabElement => {
      tabElement.addEventListener('click', () => {
        const tabId = parseInt(tabElement.dataset.tabId);
        this.switchToTab(tabId);
      });
    });
  }

  toggleSelectAllInactive() {
    const checkboxes = document.querySelectorAll('#inactive-tabs-list .tab-checkbox');
    const allSelected = this.selectedTabs.size === this.inactiveTabs.length;

    if (allSelected) {
      // Deselect all
      this.selectedTabs.clear();
      checkboxes.forEach(checkbox => {
        checkbox.checked = false;
        checkbox.closest('.tab-item').classList.remove('selected');
      });
    } else {
      // Select all
      this.inactiveTabs.forEach(tab => this.selectedTabs.add(tab.id));
      checkboxes.forEach(checkbox => {
        checkbox.checked = true;
        checkbox.closest('.tab-item').classList.add('selected');
      });
    }

    this.updateSelectAllButton();
  }

  updateSelectAllButton() {
    const button = document.getElementById('select-all-inactive');
    const closeButton = document.getElementById('close-selected');
    
    if (this.selectedTabs.size === this.inactiveTabs.length && this.inactiveTabs.length > 0) {
      button.textContent = 'Deselect All';
    } else {
      button.textContent = 'Select All';
    }

    closeButton.disabled = this.selectedTabs.size === 0;
    closeButton.textContent = `Close Selected (${this.selectedTabs.size})`;
  }

  async closeSelectedTabs() {
    if (this.selectedTabs.size === 0) return;

    const tabIds = Array.from(this.selectedTabs);
    
    try {
      await this.sendMessage({ action: 'closeTabs', tabIds: tabIds });
      
      // Remove closed tabs from the list
      this.inactiveTabs = this.inactiveTabs.filter(tab => !this.selectedTabs.has(tab.id));
      this.selectedTabs.clear();
      
      // Re-render
      this.renderInactiveTabs();
      this.updateStats();
      
    } catch (error) {
      console.error('Failed to close tabs:', error);
    }
  }

  async switchToTab(tabId) {
    try {
      await this.sendMessage({ action: 'switchToTab', tabId: tabId });
      // Close the popup after switching to tab
      window.close();
    } catch (error) {
      console.error('Failed to switch to tab:', error);
    }
  }

  async closeAllTabsInGroup(tabIds) {
    if (tabIds.length === 0) return;

    try {
      await this.sendMessage({ action: 'closeTabs', tabIds: tabIds });
      
      // Remove the group suggestion from the list after closing
      this.groupSuggestions = Object.fromEntries(
        Object.entries(this.groupSuggestions).filter(([key, suggestion]) => 
          !suggestion.tabs.every(tab => tabIds.includes(tab.id))
        )
      );
      
      // Re-render group suggestions
      this.renderGroupSuggestions();
      this.updateStats();
      
    } catch (error) {
      console.error('Failed to close tabs in group:', error);
    }
  }

  async groupTabs(groupName, tabIds) {
    try {
      const response = await this.sendMessage({ 
        action: 'groupTabs', 
        tabIds: tabIds,
        groupName: groupName 
      });
      
      if (response.success) {
        // Remove grouped suggestion
        this.groupSuggestions = Object.fromEntries(
          Object.entries(this.groupSuggestions).filter(([key, suggestion]) => 
            suggestion.name !== groupName
          )
        );
        
        // Re-render group suggestions
        this.renderGroupSuggestions();
      } else {
        console.error('Failed to group tabs:', response.error);
      }
    } catch (error) {
      console.error('Failed to group tabs:', error);
    }
  }

  async updateStats() {
    const tabs = await chrome.tabs.query({});
    const totalTabs = tabs.length;
    const inactiveCount = this.inactiveTabs.length;

    document.getElementById('total-tabs').textContent = `${totalTabs} tabs total`;
    document.getElementById('inactive-count').textContent = `${inactiveCount} inactive`;
  }

  formatTimeAgo(timestamp) {
    const now = Date.now();
    const diff = now - timestamp;
    const days = Math.floor(diff / (24 * 60 * 60 * 1000));
    const hours = Math.ceil(diff / (60 * 60 * 1000)); // Use ceil to round up

    if (days > 0) {
      return `< ${days + 1} day${days + 1 !== 1 ? 's' : ''}`;
    } else if (hours > 0) {
      return `< ${hours} hour${hours !== 1 ? 's' : ''}`;
    } else {
      return '< 1 hour';
    }
  }

  formatInactiveDuration(tab) {
    const now = Date.now();
    const diff = now - tab.lastAccess;
    const days = Math.floor(diff / (24 * 60 * 60 * 1000));
    const hours = Math.ceil(diff / (60 * 60 * 1000));

    if (days > 0) {
      return `${days} day${days !== 1 ? 's' : ''}`;
    } else if (hours > 0) {
      return `${hours} hour${hours !== 1 ? 's' : ''}`;
    } else {
      return '< 1 hour';
    }
  }

  getInactiveCriticalClass(tab) {
    const now = Date.now();
    const diff = now - tab.lastAccess;
    const days = Math.floor(diff / (24 * 60 * 60 * 1000));
    const hours = Math.floor(diff / (60 * 60 * 1000));
    
    // Green background for 1 hour exactly
    if (hours === 1 && days === 0) {
      return 'recent';
    }
    // Red background for 7+ days
    else if (days >= 7) {
      return 'critical';
    }
    // Default yellow background for everything else
    return '';
  }

  escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  sendMessage(message) {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(message, resolve);
    });
  }
}

// Initialize popup when DOM is loaded
let tabCloserPopup;
document.addEventListener('DOMContentLoaded', () => {
  tabCloserPopup = new TabCloserPopup();
});