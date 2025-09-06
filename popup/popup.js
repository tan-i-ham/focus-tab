// Popup script for Focus Tab extension

class TabCloserPopup {
  constructor() {
    this.selectedTabs = new Set();
    this.inactiveTabs = [];
    this.groupSuggestions = {};
    this.currentPage = 1;
    this.itemsPerPage = 10;
    this.init();
  }

  async init() {
    this.setupEventListeners();
    this.showLoadingState();
    await this.loadData();
    this.hideLoadingState();
    this.renderInactiveTabs();
    this.renderGroupSuggestions();
    this.updateStats();
  }

  showLoadingState() {
    document.getElementById('inactive-tabs-list').innerHTML = '<div class="loading">Loading inactive tabs...</div>';
    document.getElementById('group-suggestions-list').innerHTML = '<div class="loading">Loading group suggestions...</div>';
  }

  hideLoadingState() {
    // Loading indicators will be replaced by render methods
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

  async loadData(retryCount = 0) {
    const maxRetries = 3;
    
    try {
      console.log(`Loading data (attempt ${retryCount + 1}/${maxRetries})...`);
      
      // Load inactive tabs with timeout
      const inactiveResponse = await Promise.race([
        this.sendMessage({ action: 'getInactiveTabs' }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 5000))
      ]);
      this.inactiveTabs = (inactiveResponse && inactiveResponse.inactiveTabs) || [];
      console.log('Loaded inactive tabs:', this.inactiveTabs.length, 'tabs');

      // Load group suggestions with timeout
      const groupResponse = await Promise.race([
        this.sendMessage({ action: 'getGroupSuggestions' }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 5000))
      ]);
      this.groupSuggestions = (groupResponse && groupResponse.groupSuggestions) || {};
      console.log('Loaded group suggestions:', Object.keys(this.groupSuggestions).length, 'groups');
      console.log('Group suggestions data:', this.groupSuggestions);
      
    } catch (error) {
      console.error(`Failed to load data (attempt ${retryCount + 1}):`, error);
      
      if (retryCount < maxRetries - 1) {
        console.log(`Retrying in ${(retryCount + 1) * 500}ms...`);
        await new Promise(resolve => setTimeout(resolve, (retryCount + 1) * 500));
        return await this.loadData(retryCount + 1);
      } else {
        console.error('All retry attempts failed, using empty data');
        this.inactiveTabs = [];
        this.groupSuggestions = {};
      }
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

    // Calculate pagination
    const totalPages = Math.ceil(this.inactiveTabs.length / this.itemsPerPage);
    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    const endIndex = startIndex + this.itemsPerPage;
    const currentPageTabs = this.inactiveTabs.slice(startIndex, endIndex);

    const tabItemsHTML = currentPageTabs.map(tab => `
      <div class="tab-item" data-tab-id="${tab.id}">
        <span class="days-inactive-badge ${this.getInactiveCriticalClass(tab)}">
          ${this.formatInactiveDuration(tab)}
        </span>
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
          <button class="goto-tab-btn" data-tab-id="${tab.id}" title="Go to tab">
            <span class="goto-icon">↗</span> Go to tab
          </button>
        </div>
      </div>
    `).join('');

    // Render pagination controls if needed
    let paginationHTML = '';
    if (this.inactiveTabs.length > this.itemsPerPage) {
      paginationHTML = `
        <div class="pagination-controls">
          <button id="prev-page" class="btn btn-secondary" ${this.currentPage === 1 ? 'disabled' : ''}>
            ← Previous
          </button>
          <span class="pagination-info">
            Page ${this.currentPage} of ${totalPages} (${this.inactiveTabs.length} tabs)
          </span>
          <button id="next-page" class="btn btn-secondary" ${this.currentPage === totalPages ? 'disabled' : ''}>
            Next →
          </button>
        </div>
      `;
    }

    container.innerHTML = tabItemsHTML + paginationHTML;

    // Add event listeners for checkboxes
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

    // Add event listeners for "Go to tab" buttons
    container.querySelectorAll('.goto-tab-btn').forEach(button => {
      button.addEventListener('click', (e) => {
        e.stopPropagation();
        const tabId = parseInt(e.target.closest('.goto-tab-btn').dataset.tabId);
        this.switchToTab(tabId);
      });
    });

    // Add click handler for tab items to toggle selection
    container.querySelectorAll('.tab-item').forEach(item => {
      item.addEventListener('click', (e) => {
        // Don't handle if clicking on "Go to tab" button
        if (e.target.closest('.goto-tab-btn')) return;
        
        const tabId = parseInt(item.dataset.tabId);
        const checkbox = item.querySelector('.tab-checkbox');
        
        // Toggle checkbox state
        checkbox.checked = !checkbox.checked;
        
        // Update selection state
        if (checkbox.checked) {
          this.selectedTabs.add(tabId);
          item.classList.add('selected');
        } else {
          this.selectedTabs.delete(tabId);
          item.classList.remove('selected');
        }
        
        this.updateSelectAllButton();
      });
    });

    // Add pagination event listeners
    const prevBtn = document.getElementById('prev-page');
    const nextBtn = document.getElementById('next-page');
    
    if (prevBtn) {
      prevBtn.addEventListener('click', () => {
        if (this.currentPage > 1) {
          this.currentPage--;
          this.renderInactiveTabs();
          this.scrollToFirstTab();
        }
      });
    }
    
    if (nextBtn) {
      nextBtn.addEventListener('click', () => {
        const totalPages = Math.ceil(this.inactiveTabs.length / this.itemsPerPage);
        if (this.currentPage < totalPages) {
          this.currentPage++;
          this.renderInactiveTabs();
          this.scrollToFirstTab();
        }
      });
    }
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
            <button class="btn btn-primary group-tabs-btn" data-group-name="${this.escapeHtml(suggestion.name)}" data-tab-ids="[${suggestion.tabs.map(t => t.id).join(',')}]">
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

    // Add event listeners for group tabs buttons
    container.querySelectorAll('.group-tabs-btn').forEach(buttonElement => {
      buttonElement.addEventListener('click', () => {
        const groupName = buttonElement.dataset.groupName;
        const tabIdsStr = buttonElement.dataset.tabIds;
        const tabIds = JSON.parse(tabIdsStr);
        this.groupTabs(groupName, tabIds);
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
    const currentPageTabs = this.getCurrentPageTabs();
    const currentPageTabIds = new Set(currentPageTabs.map(tab => tab.id));
    const allCurrentPageSelected = currentPageTabs.every(tab => this.selectedTabs.has(tab.id));

    if (allCurrentPageSelected) {
      // Deselect all on current page
      currentPageTabs.forEach(tab => this.selectedTabs.delete(tab.id));
      checkboxes.forEach(checkbox => {
        checkbox.checked = false;
        checkbox.closest('.tab-item').classList.remove('selected');
      });
    } else {
      // Select all on current page
      currentPageTabs.forEach(tab => this.selectedTabs.add(tab.id));
      checkboxes.forEach(checkbox => {
        checkbox.checked = true;
        checkbox.closest('.tab-item').classList.add('selected');
      });
    }

    this.updateSelectAllButton();
  }

  getCurrentPageTabs() {
    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    const endIndex = startIndex + this.itemsPerPage;
    return this.inactiveTabs.slice(startIndex, endIndex);
  }

  scrollToFirstTab() {
    // Scroll to the first tab item or the top of the tabs list
    const firstTabItem = document.querySelector('#inactive-tabs-list .tab-item');
    const tabsList = document.getElementById('inactive-tabs-list');
    
    if (firstTabItem) {
      firstTabItem.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else if (tabsList) {
      tabsList.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  updateSelectAllButton() {
    const button = document.getElementById('select-all-inactive');
    const closeButton = document.getElementById('close-selected');
    const currentPageTabs = this.getCurrentPageTabs();
    const allCurrentPageSelected = currentPageTabs.every(tab => this.selectedTabs.has(tab.id));
    
    if (allCurrentPageSelected && currentPageTabs.length > 0) {
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
      
      // Adjust current page if needed
      const totalPages = Math.ceil(this.inactiveTabs.length / this.itemsPerPage);
      if (this.currentPage > totalPages && totalPages > 0) {
        this.currentPage = totalPages;
      } else if (this.inactiveTabs.length === 0) {
        this.currentPage = 1;
      }
      
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
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(message, (response) => {
        if (chrome.runtime.lastError) {
          console.error('Chrome runtime error:', chrome.runtime.lastError);
          reject(chrome.runtime.lastError);
          return;
        }
        if (response && response.error) {
          console.error('Background script error:', response.error);
          reject(new Error(response.error));
          return;
        }
        resolve(response);
      });
    });
  }
}

// Initialize popup when DOM is loaded
let tabCloserPopup;
document.addEventListener('DOMContentLoaded', () => {
  tabCloserPopup = new TabCloserPopup();
});