// Service worker for Focus Tab extension
let tabActivity = {};
let groupSuggestions = {};

// Constants
const INACTIVE_THRESHOLD = 10 * 1000; // 10 seconds in milliseconds (for testing)
const CHECK_INTERVAL = 1; // Check every minute (in minutes)

// Initialize extension
chrome.runtime.onStartup.addListener(initializeExtension);
chrome.runtime.onInstalled.addListener(initializeExtension);

async function initializeExtension() {
  // Load existing tab activity data
  const result = await chrome.storage.local.get(['tabActivity', 'groupSuggestions', 'settings']);
  tabActivity = result.tabActivity || {};
  groupSuggestions = result.groupSuggestions || {};
  
  // Set up periodic alarm for checking inactive tabs
  chrome.alarms.create('checkInactiveTabs', { periodInMinutes: CHECK_INTERVAL });
  
  // Track current tabs
  const tabs = await chrome.tabs.query({});
  const currentTime = Date.now();
  
  tabs.forEach(tab => {
    if (!tabActivity[tab.id]) {
      tabActivity[tab.id] = {
        lastAccess: currentTime,
        url: tab.url,
        title: tab.title,
        created: currentTime
      };
    }
  });
  
  await saveTabActivity();
  console.log('Focus Tab extension initialized');
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
  await saveTabActivity();
});

// Update tab activity timestamp
async function updateTabActivity(tabId, tab = null) {
  const currentTime = Date.now();
  
  if (!tab) {
    tab = await chrome.tabs.get(tabId).catch(() => null);
  }
  
  if (tab) {
    tabActivity[tabId] = {
      lastAccess: currentTime,
      url: tab.url,
      title: tab.title,
      created: tabActivity[tabId]?.created || currentTime
    };
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

// Handle periodic alarm for checking inactive tabs
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'checkInactiveTabs') {
    await checkInactiveTabs();
    await analyzeTabGroupings();
  }
});

// Check for inactive tabs and notify user
async function checkInactiveTabs() {
  const currentTime = Date.now();
  const inactiveTabs = [];
  
  // Get all current tabs
  const tabs = await chrome.tabs.query({});
  const currentTabIds = new Set(tabs.map(tab => tab.id));
  
  // Clean up activity data for closed tabs
  Object.keys(tabActivity).forEach(tabId => {
    if (!currentTabIds.has(parseInt(tabId))) {
      delete tabActivity[tabId];
    }
  });
  
  // Find inactive tabs
  for (const tab of tabs) {
    const activity = tabActivity[tab.id];
    if (activity && (currentTime - activity.lastAccess) > INACTIVE_THRESHOLD) {
      inactiveTabs.push({
        id: tab.id,
        title: tab.title,
        url: tab.url,
        lastAccess: activity.lastAccess,
        daysSinceAccess: Math.floor((currentTime - activity.lastAccess) / (24 * 60 * 60 * 1000))
      });
    }
  }
  
  if (inactiveTabs.length > 0) {
    // Show notification
    chrome.notifications.create('inactiveTabs', {
      type: 'basic',
      iconUrl: 'icons/icon48.png',
      title: 'Focus Tab Alert',
      message: `${inactiveTabs.length} tab(s) haven't been accessed for 24+ hours. Click to review.`
    });
    
    // Store inactive tabs for popup access
    await chrome.storage.local.set({ inactiveTabs: inactiveTabs });
  }
  
  await saveTabActivity();
}

// Analyze tabs for potential groupings
async function analyzeTabGroupings() {
  const tabs = await chrome.tabs.query({});
  const suggestions = {};
  
  // Group by domain
  const domainGroups = {};
  tabs.forEach(tab => {
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
  
  // Group by similar keywords in titles
  const keywordGroups = {};
  tabs.forEach(tab => {
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
  await chrome.storage.local.set({ groupSuggestions: groupSuggestions });
}

// Handle notification clicks
chrome.notifications.onClicked.addListener((notificationId) => {
  if (notificationId === 'inactiveTabs') {
    chrome.action.openPopup();
  }
});

// Handle messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  (async () => {
    try {
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
        const result = await chrome.storage.local.get(['inactiveTabs']);
        sendResponse({ inactiveTabs: result.inactiveTabs || [] });
      }
      
      if (request.action === 'getGroupSuggestions') {
        sendResponse({ groupSuggestions: groupSuggestions });
      }
    } catch (error) {
      console.error('Message handler error:', error);
      sendResponse({ error: error.message });
    }
  })();
  
  return true; // Keep message channel open for async response
});