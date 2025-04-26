document.addEventListener('DOMContentLoaded', () => {
  // --- Constants and Variables ---
  const UNSPLASH_ACCESS_KEY = 'qS2-CAJ9Tn06sPesdZ2jM6gRCM2aW-jw0N847Dsha5c'; // Replace with your key if needed
  // const BOOKMARKS_LIMIT = 12; // Removed - CSS handles the limit now

  const bookmarksContainer = document.getElementById('bookmarks');
  const popup = document.getElementById('bookmarks-popup');
  const popupBookmarksContainer = document.getElementById('popup-bookmarks');
  const showAllBtn = document.getElementById('show-all-btn');
  const closePopupBtn = document.getElementById('close-popup-btn');

  let allBookmarks = []; // To store the full list

  // --- Background Image ---
  const setBackgroundImage = (imageUrl) => {
    document.body.style.backgroundImage = `url('${imageUrl}')`;
  };

  const fetchAndSetBackground = async () => {
    const today = new Date().toDateString();
    try {
      const storedData = await chrome.storage.local.get(['backgroundImageUrl', 'backgroundDate']);

      if (storedData.backgroundImageUrl && storedData.backgroundDate === today) {
        setBackgroundImage(storedData.backgroundImageUrl);
        console.log('Using stored background image.');
      } else {
        console.log('Fetching new background image from Unsplash...');
        const response = await fetch(`https://api.unsplash.com/photos/random?query=nature&orientation=landscape`, {
          headers: {
            'Authorization': `Client-ID ${UNSPLASH_ACCESS_KEY}`,
            'Accept-Version': 'v1'
          }
        });
        if (!response.ok) {
          throw new Error(`Unsplash API error: ${response.status} ${response.statusText}`);
        }
        const data = await response.json();
        const imageUrl = data.urls.regular; // Use 'regular' size for decent quality

        setBackgroundImage(imageUrl);
        await chrome.storage.local.set({ backgroundImageUrl: imageUrl, backgroundDate: today });
        console.log('New background image set and stored.');
      }
    } catch (error) {
      console.error('Error fetching or setting background image:', error);
      // Fallback to default gradient if API fails
      document.body.style.background = 'linear-gradient(135deg, #0f2027, #203a43, #2c5364)';
    }
  };

  // --- Bookmarks ---

  // Function to get the first letter of a string (for favicon fallback)
  const getFirstLetter = (str) => {
    return str ? str.charAt(0).toUpperCase() : '?';
  };

  // Function to create a bookmark or folder element (reusable)
  const createBookmarkNodeElement = (node, isPopup = false) => {
    const itemElement = document.createElement(node.url ? 'a' : 'div');
    itemElement.className = 'bookmark-item';
    itemElement.title = node.title || 'Untitled';

    if (node.url) {
      itemElement.href = node.url;
      itemElement.target = '_blank'; // Open in new tab
    } else {
      itemElement.classList.add('folder');
      // Click handler for folders (only needed in popup for navigation)
      if (isPopup) {
         itemElement.addEventListener('click', (e) => {
           e.preventDefault();
           if (node.children && node.children.length > 0) {
             displayBookmarksInPopup(node.children, node.parentId);
           } else {
             // Handle empty folder click if needed
             console.log("Empty folder clicked:", node.title);
           }
         });
      } else {
        // Folders on main grid open the popup
         itemElement.addEventListener('click', (e) => {
           e.preventDefault();
           openPopupWithFolder(node.id);
         });
      }
    }

    const iconElement = document.createElement('div');
    iconElement.className = 'bookmark-icon';

    if (node.url) {
      const faviconUrl = `https://www.google.com/s2/favicons?domain=${new URL(node.url).hostname}&sz=64`;
      const faviconImg = document.createElement('img');
      faviconImg.src = faviconUrl;
      faviconImg.alt = ''; // Decorative
      faviconImg.onerror = () => {
        // Fallback if favicon fails
        iconElement.textContent = getFirstLetter(node.title);
        faviconImg.remove(); // Remove broken image element
      };
      iconElement.appendChild(faviconImg);
    } else {
      // Folder icon
      iconElement.innerHTML = '📁';
    }

    const titleElement = document.createElement('span');
    titleElement.className = 'bookmark-title';
    titleElement.textContent = node.title || 'Untitled';

    itemElement.appendChild(iconElement);
    itemElement.appendChild(titleElement);

    return itemElement;
  };

  // Function to recursively get all bookmarks and folders
  const flattenBookmarks = (nodes) => {
    let flatList = [];
    nodes.forEach(node => {
      if (node.url) { // It's a bookmark
        flatList.push(node);
      } else if (node.children && node.children.length > 0) { // It's a non-empty folder
        // Add folder itself if needed, or just its contents
        // flatList.push(node); // Uncomment to include folder nodes in the flat list
        flatList = flatList.concat(flattenBookmarks(node.children)); // Recurse
      }
      // Ignore empty folders or nodes without URL/children
    });
    return flatList;
  };

  // Function to display bookmarks on the main grid (CSS handles the 2-row limit)
  const displayInitialBookmarks = (bookmarks) => {
    bookmarksContainer.innerHTML = ''; // Clear existing
    // Render all top-level bookmarks/folders; CSS will hide overflow
    bookmarks.forEach(node => {
      const element = createBookmarkNodeElement(node, false); // false = not in popup
      bookmarksContainer.appendChild(element);
    });
     // Show the '+' button only if there are bookmarks to show in the popup
    showAllBtn.classList.toggle('hidden', bookmarks.length === 0);
  };

  // Function to display all bookmarks in the popup
  const displayBookmarksInPopup = (nodes, parentId = null) => {
      popupBookmarksContainer.innerHTML = ''; // Clear previous content

      // Add back button if not at the root level
      if (parentId && parentId !== '0') {
          chrome.bookmarks.get(parentId, (parentNodes) => {
              if (parentNodes && parentNodes.length > 0) {
                  const parent = parentNodes[0];
                  const backButton = document.createElement('div');
                  backButton.className = 'bookmark-item folder'; // Style like a folder
                  backButton.innerHTML = `<div class="bookmark-icon">⬅️</div><span class="bookmark-title">Back to ${parent.title || 'Parent'}</span>`;
                  backButton.style.gridColumn = '1 / 2'; // Adjust span as needed
                  backButton.addEventListener('click', () => {
                      chrome.bookmarks.getSubTree(parent.parentId || '0', (results) => {
                          const grandParentNode = results[0];
                          // Decide if grandparent is root or another folder
                          const displayNodes = (grandParentNode.id === '0') ? allBookmarks : grandParentNode.children;
                          displayBookmarksInPopup(displayNodes, grandParentNode.parentId);
                      });
                  });
                  popupBookmarksContainer.appendChild(backButton);
              }
          });
      }

      // Display current level nodes
      nodes.forEach(node => {
          const element = createBookmarkNodeElement(node, true); // true = in popup
          popupBookmarksContainer.appendChild(element);
      });
  };


  // Function to load and process all bookmarks
  const loadAllBookmarks = () => {
    chrome.bookmarks.getTree((bookmarkTreeNodes) => {
      // Combine bookmarks from Bookmark Bar and Other Bookmarks
      const bookmarkBar = bookmarkTreeNodes[0]?.children?.[0]?.children || [];
      const otherBookmarks = bookmarkTreeNodes[0]?.children?.[1]?.children || [];
      allBookmarks = [...bookmarkBar, ...otherBookmarks]; // Store combined root folders/bookmarks

      // Display initial set on main grid
      displayInitialBookmarks(allBookmarks);
    });
  };

  // --- Popup Logic ---
  const openPopup = () => {
    displayBookmarksInPopup(allBookmarks); // Display root level initially
    popup.classList.add('visible');
    popup.classList.remove('hidden'); // Ensure it's not display:none
  };

  const closePopup = () => {
    popup.classList.remove('visible');
    // Optional: Add a small delay before setting display:none if needed for transitions
    // setTimeout(() => { popup.classList.add('hidden'); }, 300);
  };

  // Function to open popup showing a specific folder's content
  const openPopupWithFolder = (folderId) => {
     chrome.bookmarks.getSubTree(folderId, (results) => {
        if (results && results[0] && results[0].children) {
            displayBookmarksInPopup(results[0].children, results[0].parentId);
            popup.classList.add('visible');
            popup.classList.remove('hidden');
        } else {
            console.error("Could not find folder or folder is empty:", folderId);
            // Optionally open the popup at the root level as a fallback
            openPopup();
        }
     });
  };


  // --- Event Listeners ---
  showAllBtn.addEventListener('click', openPopup);
  closePopupBtn.addEventListener('click', closePopup);
  // Close popup if clicking outside the content area
  popup.addEventListener('click', (event) => {
    if (event.target === popup) {
      closePopup();
    }
  });

  // --- Initialization ---
  fetchAndSetBackground();
  loadAllBookmarks();
});
