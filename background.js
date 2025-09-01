// Service worker for Focus Tab extension
let tabActivity = {};
let groupSuggestions = {};
let isInitialized = false;
let initializationPromise = null;

// Constants
const INACTIVE_THRESHOLD = 60 * 60 * 1000; // 60 minutes in milliseconds

// Initialize extension
chrome.runtime.onStartup.addListener(initializeExtension);
chrome.runtime.onInstalled.addListener(initializeExtension);

async function initializeExtension() {
  // Prevent multiple simultaneous initializations
  if (initializationPromise) {
    return await initializationPromise;
  }
  
  initializationPromise = performInitialization();
  return await initializationPromise;
}

async function performInitialization() {
  try {
    console.log('Starting extension initialization...');
    isInitialized = false;
    
    // Load existing tab activity data
    const result = await chrome.storage.local.get(['tabActivity', 'groupSuggestions', 'settings']);
    tabActivity = result.tabActivity || {};
    groupSuggestions = result.groupSuggestions || {};
    
    console.log(`Loaded ${Object.keys(tabActivity).length} tab activities from storage`);
  
  // Track current tabs
  const tabs = await chrome.tabs.query({});
  const currentTime = Date.now();
  
  // Get the currently active tab to mark it as recently accessed
  const activeTabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const activeTabId = activeTabs.length > 0 ? activeTabs[0].id : null;
  
  tabs.forEach(tab => {
    if (!tabActivity[tab.id]) {
      // Only initialize tabs that are currently active or have lastAccessed data from Chrome
      if (tab.id === activeTabId) {
        tabActivity[tab.id] = {
          lastAccess: currentTime,
          url: tab.url,
          title: tab.title,
          created: currentTime
        };
        console.log(`Initialized active tab ${tab.id} as recently accessed`);
      } else if (tab.lastAccessed) {
        tabActivity[tab.id] = {
          lastAccess: tab.lastAccessed,
          url: tab.url,
          title: tab.title,
          created: tab.lastAccessed
        };
        console.log(`Initialized tab ${tab.id} with Chrome's lastAccessed time: ${new Date(tab.lastAccessed).toISOString()}`);
      } else {
        // Skip tabs without lastAccessed data - they will be tracked when user interacts with them
        console.log(`Skipping tab ${tab.id} - no lastAccessed data available`);
      }
    } else {
      // Tab already has activity data - only update URL and title if they changed, but preserve timestamps
      const existingActivity = tabActivity[tab.id];
      tabActivity[tab.id] = {
        lastAccess: existingActivity.lastAccess, // Preserve existing timestamp
        url: tab.url,
        title: tab.title,
        created: existingActivity.created // Preserve existing creation time
      };
      
      // Only update lastAccess if this is the currently active tab
      if (tab.id === activeTabId) {
        tabActivity[tab.id].lastAccess = currentTime;
        console.log(`Updated active tab ${tab.id} access time on extension reload`);
      } else {
        console.log(`Preserved existing access time for tab ${tab.id} on extension reload`);
      }
    }
  });
  
  await saveTabActivity();
  
  // Generate initial group suggestions
  await analyzeTabGroupings();
  
    console.log('Focus Tab extension initialized successfully');
    isInitialized = true;
    
  } catch (error) {
    console.error('Extension initialization failed:', error);
    isInitialized = false;
    throw error;
  }
}

// Tab event listeners for activity tracking
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  await updateTabActivity(activeInfo.tabId);
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' || changeInfo.url) {
    await updateTabActivity(tabId, tab);
  }
});

chrome.tabs.onRemoved.addListener(async (tabId) => {
  delete tabActivity[tabId];
  await saveTabActivity();
});

chrome.tabs.onCreated.addListener(async (tab) => {
  const currentTime = Date.now();
  tabActivity[tab.id] = {
    lastAccess: currentTime,
    url: tab.url || tab.pendingUrl,
    title: tab.title,
    created: currentTime
  };
  console.log(`New tab created: ${tab.id}, marked as recently accessed`);
  await saveTabActivity();
});

// Also track window focus events to catch tab switches
chrome.windows.onFocusChanged.addListener(async (windowId) => {
  if (windowId !== chrome.windows.WINDOW_ID_NONE) {
    try {
      const tabs = await chrome.tabs.query({ active: true, windowId: windowId });
      if (tabs.length > 0) {
        console.log(`Window ${windowId} focused, updating active tab: ${tabs[0].id}`);
        await updateTabActivity(tabs[0].id, tabs[0]);
      }
    } catch (error) {
      // Ignore errors for invalid window IDs
    }
  }
});

// Update tab activity timestamp
async function updateTabActivity(tabId, tab = null) {
  const currentTime = Date.now();
  
  if (!tab) {
    tab = await chrome.tabs.get(tabId).catch(() => null);
  }
  
  if (tab) {
    const previousAccess = tabActivity[tabId]?.lastAccess;
    tabActivity[tabId] = {
      lastAccess: currentTime,
      url: tab.url,
      title: tab.title,
      created: tabActivity[tabId]?.created || currentTime
    };
    
    console.log(`Updated access time for tab ${tabId} (${tab.title.substring(0, 30)}...) from ${previousAccess ? new Date(previousAccess).toISOString() : 'never'} to ${new Date(currentTime).toISOString()}`);
    await saveTabActivity();
  }
}

// Save tab activity to storage
async function saveTabActivity() {
  await chrome.storage.local.set({ 
    tabActivity: tabActivity,
    groupSuggestions: groupSuggestions 
  });
}



// Analyze tabs for potential groupings with retry mechanism
async function analyzeTabGroupings(retryCount = 0) {
  const maxRetries = 3;
  
  try {
    const tabs = await chrome.tabs.query({});
    const suggestions = {};
    
    if (!tabs || tabs.length === 0) {
      if (retryCount < maxRetries - 1) {
        console.log(`No tabs found, retry attempt ${retryCount + 1}/${maxRetries}`);
        await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
        return await analyzeTabGroupings(retryCount + 1);
      } else {
        console.log('Failed to get tabs after 3 attempts, giving up on group suggestions');
        return;
      }
    }
    
    // Filter out tabs that are already in groups
    const ungroupedTabs = tabs.filter(tab => tab.groupId === chrome.tabGroups.TAB_GROUP_ID_NONE);
    const groupedTabsCount = tabs.length - ungroupedTabs.length;
    
    console.log(`Total tabs: ${tabs.length}, Ungrouped tabs: ${ungroupedTabs.length}, Already grouped: ${groupedTabsCount}`);
    
    // Group by domain (only ungrouped tabs)
    const domainGroups = {};
    ungroupedTabs.forEach(tab => {
      try {
        const url = new URL(tab.url);
        const domain = url.hostname;
        if (!domainGroups[domain]) {
          domainGroups[domain] = [];
        }
        domainGroups[domain].push(tab);
      } catch (e) {
        // Skip invalid URLs
      }
    });
    
    // Create suggestions for domains with multiple tabs
    Object.entries(domainGroups).forEach(([domain, domainTabs]) => {
      if (domainTabs.length > 1) {
        suggestions[`domain-${domain}`] = {
          type: 'domain',
          name: domain,
          tabs: domainTabs.map(tab => ({
            id: tab.id,
            title: tab.title,
            url: tab.url
          })),
          reason: `${domainTabs.length} tabs from ${domain}`
        };
      }
    });
    
    // Group by similar keywords in titles (only ungrouped tabs)
    const keywordGroups = {};
    ungroupedTabs.forEach(tab => {
      const words = tab.title.toLowerCase().split(/\s+/).filter(word => word.length > 3);
      words.forEach(word => {
        if (!keywordGroups[word]) {
          keywordGroups[word] = [];
        }
        keywordGroups[word].push(tab);
      });
    });
    
    // Create suggestions for keyword groups with multiple tabs
    Object.entries(keywordGroups).forEach(([keyword, keywordTabs]) => {
      if (keywordTabs.length > 2) {
        suggestions[`keyword-${keyword}`] = {
          type: 'keyword',
          name: keyword,
          tabs: keywordTabs.map(tab => ({
            id: tab.id,
            title: tab.title,
            url: tab.url
          })),
          reason: `${keywordTabs.length} tabs containing "${keyword}"`
        };
      }
    });
    
    groupSuggestions = suggestions;
    console.log(`Generated group suggestions (attempt ${retryCount + 1}):`, Object.keys(suggestions).length, 'groups');
    console.log('Group suggestions:', suggestions);
    await chrome.storage.local.set({ groupSuggestions: groupSuggestions });
    
  } catch (error) {
    if (retryCount < maxRetries - 1) {
      console.error(`Error analyzing tab groupings (attempt ${retryCount + 1}):`, error);
      console.log(`Retrying in 1 second... (${retryCount + 2}/${maxRetries})`);
      await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
      return await analyzeTabGroupings(retryCount + 1);
    } else {
      console.error('Failed to analyze tab groupings after 3 attempts:', error);
      console.log('Giving up on group suggestions generation');
      // Set empty suggestions to avoid infinite retries
      groupSuggestions = {};
      await chrome.storage.local.set({ groupSuggestions: groupSuggestions });
    }
  }
}


// Handle messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  (async () => {
    try {
      // Ensure extension is fully initialized before handling requests
      if (!isInitialized) {
        console.log('Extension not initialized, waiting...');
        await initializeExtension();
        console.log('Initialization complete, processing request');
      }
      if (request.action === 'closeTabs') {
        const tabIds = request.tabIds;
        for (const tabId of tabIds) {
          try {
            await chrome.tabs.remove(tabId);
            delete tabActivity[tabId];
          } catch (e) {
            console.error('Failed to close tab:', tabId, e);
          }
        }
        await saveTabActivity();
        sendResponse({ success: true });
      }
      
      if (request.action === 'groupTabs') {
        const tabIds = request.tabIds;
        const groupName = request.groupName;
        try {
          const groupId = await chrome.tabs.group({ tabIds: tabIds });
          await chrome.tabGroups.update(groupId, { title: groupName });
          sendResponse({ success: true });
        } catch (e) {
          console.error('Failed to group tabs:', e);
          sendResponse({ success: false, error: e.message });
        }
      }
      
      if (request.action === 'getInactiveTabs') {
        // Calculate inactive tabs in real-time instead of using cached data
        const currentTime = Date.now();
        const inactiveTabs = [];
        
        // Get all current tabs
        const tabs = await chrome.tabs.query({});
        
        // Find inactive tabs
        for (const tab of tabs) {
          const activity = tabActivity[tab.id];
          if (activity) {
            if ((currentTime - activity.lastAccess) > INACTIVE_THRESHOLD) {
              inactiveTabs.push({
                id: tab.id,
                title: tab.title,
                url: tab.url,
                lastAccess: activity.lastAccess,
                daysSinceAccess: Math.floor((currentTime - activity.lastAccess) / (24 * 60 * 60 * 1000))
              });
            }
          } else {
            // Tab without activity data - initialize with Chrome's lastAccessed if available
            if (tab.lastAccessed) {
              tabActivity[tab.id] = {
                lastAccess: tab.lastAccessed,
                url: tab.url,
                title: tab.title,
                created: tab.lastAccessed
              };
            }
            // Skip tabs without lastAccessed data - they won't be counted as inactive
          }
        }
        
        // Sort tabs by last access time (oldest first)
        inactiveTabs.sort((a, b) => a.lastAccess - b.lastAccess);
        
        // Save any new tab activity data
        await saveTabActivity();
        
        sendResponse({ inactiveTabs: inactiveTabs });
      }
      
      if (request.action === 'getGroupSuggestions') {
        // If no suggestions exist yet, analyze tabs first
        if (Object.keys(groupSuggestions).length === 0) {
          console.log('No group suggestions exist, analyzing tabs...');
          await analyzeTabGroupings();
        }
        sendResponse({ groupSuggestions: groupSuggestions });
      }
      
      if (request.action === 'switchToTab') {
        const tabId = request.tabId;
        try {
          await chrome.tabs.update(tabId, { active: true });
          const tab = await chrome.tabs.get(tabId);
          await chrome.windows.update(tab.windowId, { focused: true });
          sendResponse({ success: true });
        } catch (e) {
          console.error('Failed to switch to tab:', tabId, e);
          sendResponse({ success: false, error: e.message });
        }
      }
    } catch (error) {
      console.error('Message handler error:', error);
      sendResponse({ error: error.message });
    }
  })();
  
  return true; // Keep message channel open for async response
});