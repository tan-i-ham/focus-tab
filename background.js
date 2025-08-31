// Service worker for Focus Tab extension
let tabActivity = {};
let groupSuggestions = {};

// Constants
const INACTIVE_THRESHOLD = 60 * 60 * 1000; // 60 minutes in milliseconds

// Initialize extension
chrome.runtime.onStartup.addListener(initializeExtension);
chrome.runtime.onInstalled.addListener(initializeExtension);

async function initializeExtension() {
  // Load existing tab activity data
  const result = await chrome.storage.local.get(['tabActivity', 'groupSuggestions', 'settings']);
  tabActivity = result.tabActivity || {};
  groupSuggestions = result.groupSuggestions || {};
  
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
    
    // Group by title similarity using Levenshtein distance
    const titleSimilarityGroups = {};
    const processedTabs = new Set();
    
    ungroupedTabs.forEach((tab1, index1) => {
      if (processedTabs.has(tab1.id)) return;
      
      const similarTabs = [tab1];
      const title1 = tab1.title.toLowerCase().trim();
      
      ungroupedTabs.forEach((tab2, index2) => {
        if (index1 >= index2 || processedTabs.has(tab2.id)) return;
        
        const title2 = tab2.title.toLowerCase().trim();
        const similarity = calculateTitleSimilarity(title1, title2);
        
        // If similarity is above threshold (70%), consider them similar
        if (similarity >= 0.7) {
          similarTabs.push(tab2);
          processedTabs.add(tab2.id);
        }
      });
      
      if (similarTabs.length > 1) {
        // Create a meaningful group name from the most common words
        const groupName = extractCommonTitlePattern(similarTabs.map(tab => tab.title));
        const groupKey = `title-similarity-${groupName.toLowerCase().replace(/\s+/g, '-')}`;
        
        // Avoid duplicating with existing keyword groups
        if (!suggestions[groupKey]) {
          titleSimilarityGroups[groupKey] = {
            type: 'title-similarity',
            name: groupName,
            tabs: similarTabs.map(tab => ({
              id: tab.id,
              title: tab.title,
              url: tab.url
            })),
            reason: `${similarTabs.length} tabs with similar titles`
          };
        }
      }
      
      processedTabs.add(tab1.id);
    });
    
    // Add title similarity suggestions to main suggestions
    Object.assign(suggestions, titleSimilarityGroups);
    
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

// Helper function to calculate title similarity using Levenshtein distance
function calculateTitleSimilarity(str1, str2) {
  if (str1 === str2) return 1.0;
  if (str1.length === 0 || str2.length === 0) return 0.0;
  
  // Normalize strings - remove common prefixes/suffixes that don't add meaning
  const normalize = (str) => {
    return str
      .toLowerCase()
      .replace(/^\s*(new tab|untitled|loading)\s*[-–—]?\s*/i, '') // Remove common prefixes
      .replace(/\s*[-–—]\s*(google chrome|mozilla firefox|safari|edge)\s*$/i, '') // Remove browser names
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();
  };
  
  const normalizedStr1 = normalize(str1);
  const normalizedStr2 = normalize(str2);
  
  // Use simpler word-based comparison for better results
  const words1 = normalizedStr1.split(/\s+/).filter(word => word.length > 2);
  const words2 = normalizedStr2.split(/\s+/).filter(word => word.length > 2);
  
  if (words1.length === 0 && words2.length === 0) return 1.0;
  if (words1.length === 0 || words2.length === 0) return 0.0;
  
  // Calculate Jaccard similarity (intersection over union)
  const set1 = new Set(words1);
  const set2 = new Set(words2);
  const intersection = new Set([...set1].filter(x => set2.has(x)));
  const union = new Set([...set1, ...set2]);
  
  return intersection.size / union.size;
}

// Helper function to extract common pattern from similar titles
function extractCommonTitlePattern(titles) {
  if (titles.length === 0) return 'Similar Pages';
  if (titles.length === 1) return titles[0];
  
  // Find the most common meaningful words across all titles
  const allWords = {};
  titles.forEach(title => {
    const words = title.toLowerCase()
      .replace(/[^\w\s]/g, ' ') // Remove punctuation
      .split(/\s+/)
      .filter(word => word.length > 3 && !isCommonWord(word)); // Filter meaningful words
    
    words.forEach(word => {
      allWords[word] = (allWords[word] || 0) + 1;
    });
  });
  
  // Find words that appear in at least half of the titles
  const threshold = Math.ceil(titles.length / 2);
  const commonWords = Object.entries(allWords)
    .filter(([word, count]) => count >= threshold)
    .sort((a, b) => b[1] - a[1]) // Sort by frequency
    .slice(0, 3) // Take top 3
    .map(([word]) => word);
  
  if (commonWords.length > 0) {
    return commonWords.map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  }
  
  // Fallback: use first few words of the most common title
  const titleCounts = {};
  titles.forEach(title => {
    const firstWords = title.split(/\s+/).slice(0, 3).join(' ');
    titleCounts[firstWords] = (titleCounts[firstWords] || 0) + 1;
  });
  
  const mostCommon = Object.entries(titleCounts)
    .sort((a, b) => b[1] - a[1])[0];
  
  return mostCommon ? mostCommon[0] : 'Similar Pages';
}

// Helper function to check if a word is too common to be meaningful
function isCommonWord(word) {
  const commonWords = new Set([
    'the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'her', 'was', 'one', 'our',
    'had', 'have', 'what', 'were', 'said', 'each', 'which', 'she', 'how', 'other', 'many', 'some',
    'time', 'very', 'when', 'much', 'new', 'write', 'would', 'there', 'way', 'been', 'call',
    'who', 'oil', 'sit', 'now', 'find', 'down', 'day', 'did', 'get', 'come', 'made', 'may', 'part',
    'over', 'such', 'take', 'than', 'only', 'think', 'work', 'know', 'place', 'years', 'back',
    'good', 'give', 'man', 'our', 'under', 'name', 'very', 'through', 'just', 'form', 'sentence',
    'great', 'where', 'help', 'much', 'too', 'mean', 'old', 'any', 'same', 'tell', 'boy', 'follow',
    'came', 'want', 'show', 'also', 'around', 'farm', 'three', 'small', 'set', 'put', 'end', 'why',
    'again', 'turn', 'here', 'off', 'went', 'old', 'number', 'great', 'tell', 'men', 'say', 'small',
    'every', 'found', 'still', 'between', 'mane', 'should', 'home', 'big', 'give', 'air', 'line',
    'set', 'own', 'under', 'read', 'last', 'never', 'us', 'left', 'end', 'along', 'while', 'might',
    'next', 'sound', 'below', 'saw', 'something', 'thought', 'both', 'few', 'those', 'always',
    'looked', 'show', 'large', 'often', 'together', 'asked', 'house', 'don', 'world', 'going',
    'want', 'school', 'important', 'until', 'form', 'food', 'keep', 'children', 'feet', 'land',
    'side', 'without', 'boy', 'once', 'animal', 'life', 'enough', 'took', 'four', 'head', 'above',
    'kind', 'began', 'almost', 'live', 'page', 'got', 'earth', 'need', 'far', 'hand', 'high',
    'year', 'mother', 'light', 'country', 'father', 'let', 'night', 'picture', 'being', 'study',
    'second', 'book', 'carry', 'took', 'science', 'eat', 'room', 'friend', 'began', 'idea', 'fish',
    'mountain', 'north', 'once', 'base', 'hear', 'horse', 'cut', 'sure', 'watch', 'color', 'face',
    'wood', 'main', 'enough', 'plain', 'girl', 'usual', 'young', 'ready', 'above', 'ever', 'red',
    'list', 'though', 'feel', 'talk', 'bird', 'soon', 'body', 'dog', 'family', 'direct', 'pose',
    'leave', 'song', 'measure', 'door', 'product', 'black', 'short', 'numeral', 'class', 'wind',
    'question', 'happen', 'complete', 'ship', 'area', 'half', 'rock', 'order', 'fire', 'south',
    'problem', 'piece', 'told', 'knew', 'pass', 'since', 'top', 'whole', 'king', 'space', 'heard',
    'best', 'hour', 'better', 'during', 'hundred', 'five', 'remember', 'step', 'early', 'hold',
    'west', 'ground', 'interest', 'reach', 'fast', 'verb', 'sing', 'listen', 'six', 'table',
    'travel', 'less', 'morning', 'ten', 'simple', 'several', 'vowel', 'toward', 'war', 'lay',
    'against', 'pattern', 'slow', 'center', 'love', 'person', 'money', 'serve', 'appear', 'road',
    'map', 'rain', 'rule', 'govern', 'pull', 'cold', 'notice', 'voice', 'unit', 'power', 'town',
    'fine', 'certain', 'fly', 'fall', 'lead', 'cry', 'dark', 'machine', 'note', 'wait', 'plan',
    'figure', 'star', 'box', 'noun', 'field', 'rest', 'correct', 'able', 'pound', 'done', 'beauty',
    'drive', 'stood', 'contain', 'front', 'teach', 'week', 'final', 'gave', 'green', 'oh', 'quick',
    'develop', 'ocean', 'warm', 'free', 'minute', 'strong', 'special', 'mind', 'behind', 'clear',
    'tail', 'produce', 'fact', 'street', 'inch', 'multiply', 'nothing', 'course', 'stay', 'wheel',
    'full', 'force', 'blue', 'object', 'decide', 'surface', 'deep', 'moon', 'island', 'foot',
    'system', 'busy', 'test', 'record', 'boat', 'common', 'gold', 'possible', 'plane', 'stead',
    'dry', 'wonder', 'laugh', 'thousands', 'ago', 'ran', 'check', 'game', 'shape', 'equate', 'hot',
    'miss', 'brought', 'heat', 'snow', 'tire', 'bring', 'yes', 'distant', 'fill', 'east', 'paint',
    'language', 'among'
  ]);
  
  return commonWords.has(word.toLowerCase());
}