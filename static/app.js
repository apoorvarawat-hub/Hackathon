// ==========================================
// myKaarma SPA Client Application Logic
// ==========================================

// Global Application State
const state = {
  accounts: [],
  selectedAccountIds: new Set(),
  selectedAccount: null,
  theme: 'light',
  searchQuery: '',
  filters: {
    region: '',
    paymentsStage: ''
  },
  activeView: 'viewAccountSelect',
  extractedContacts: [],
  editingContactId: null,
  syncResults: []
};

// ------------------------------------------
// Initialize Application
// ------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
  initThemeState();
  fetchAccounts();
  setupEventListeners();
  setupModalListeners();
});

// ------------------------------------------
// Theme State Management (Light / Dark)
// ------------------------------------------
function initThemeState() {
  const shell = document.getElementById('shell');
  const storedTheme = localStorage.getItem('mk-theme');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  
  state.theme = storedTheme || (prefersDark ? 'dark' : 'light');
  shell.className = state.theme;
  
  updateThemeUIElements();
}

function toggleTheme() {
  state.theme = state.theme === 'dark' ? 'light' : 'dark';
  
  const shell = document.getElementById('shell');
  shell.className = state.theme;
  
  localStorage.setItem('mk-theme', state.theme);
  updateThemeUIElements();
}

function updateThemeUIElements() {
  const isDark = state.theme === 'dark';
  const toggleBtn = document.getElementById('themeToggleBtn');
  const toggleLabel = document.getElementById('themeToggleLabel');
  const toggleIcon = document.getElementById('toggleIcon');
  
  toggleBtn.setAttribute('aria-checked', isDark.toString());
  toggleLabel.textContent = isDark ? 'Dark' : 'Light';
  
  if (isDark) {
    toggleIcon.textContent = 'nights_stay';
    toggleIcon.style.color = '#334155'; // Dark slate on white knob
  } else {
    toggleIcon.textContent = 'wb_sunny';
    toggleIcon.style.color = '#ED6D22'; // Signature orange in light mode
  }
}

// ------------------------------------------
// REST API Communication (Fetch Accounts)
// ------------------------------------------
async function fetchAccounts() {
  try {
    const queryParams = new URLSearchParams({
      name: state.searchQuery,
      region: state.filters.region,
      payments_stage: state.filters.paymentsStage
    });
    
    const response = await fetch(`/api/accounts?${queryParams}`);
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }
    
    const data = await response.json();
    
    // We only populate options once based on the initial fetch
    if (state.accounts.length === 0) {
       populateFilterOptions(data);
    }
    state.accounts = data;
    renderAccountsTable();
  } catch (error) {
    console.error('Failed to fetch accounts:', error);
    renderErrorTableState();
  }
}

function populateFilterOptions(data) {
  const regions = new Set();
  const stages = new Set();
  
  data.forEach(acc => {
    if (acc.Territory_Region__c) regions.add(acc.Territory_Region__c);
    if (acc.Payments_Stage__c) stages.add(acc.Payments_Stage__c);
  });

  const populateSelect = (id, optionsSet) => {
    const select = document.getElementById(id);
    const currentVal = select.value;
    select.innerHTML = '<option value="">All</option>';
    Array.from(optionsSet).sort().forEach(opt => {
      select.innerHTML += `<option value="${escapeHtml(opt)}">${escapeHtml(opt)}</option>`;
    });
    select.value = currentVal;
  };

  populateSelect('regionFilter', regions);
  populateSelect('paymentsStageFilter', stages);
}

// ------------------------------------------
// DOM Rendering (Accounts Table & Grid)
// ------------------------------------------
function renderAccountsTable() {
  const tableBody = document.getElementById('accountsTableBody');
  const countLabel = document.getElementById('accountsCount');
  const emptyState = document.getElementById('tableEmptyState');
  const table = document.getElementById('accountsTable');
  
  tableBody.innerHTML = '';
  
  // Update count label
  const total = state.accounts.length;
  countLabel.textContent = `${total} Account${total !== 1 ? 's' : ''}`;
  
  if (total === 0) {
    emptyState.style.display = 'flex';
    table.style.display = 'none';
    return;
  }
  
  emptyState.style.display = 'none';
  table.style.display = 'table';
  
  const formatDate = (isoString) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };
  
  state.accounts.forEach(acc => {
    const tr = document.createElement('tr');
    tr.setAttribute('data-id', acc.Id);
    
    // Highlight if currently selected
    if (state.selectedAccountIds.has(acc.Id)) {
      tr.className = 'selected';
    }
    
    const isChecked = state.selectedAccountIds.has(acc.Id) ? 'checked' : '';
    
    // Render columns: Checkbox, Name, Region, Status, Payment Stage, Website, Last Modified
    tr.innerHTML = `
      <td onclick="event.stopPropagation()">
        <input type="checkbox" class="row-checkbox" data-id="${escapeHtml(acc.Id)}" ${isChecked}>
      </td>
      <td title="${escapeHtml(acc.Name)}" style="font-weight: 700;">${escapeHtml(acc.Name)}</td>
      <td title="${escapeHtml(acc.Territory_Region__c)}">${escapeHtml(acc.Territory_Region__c)}</td>
      <td>
        <span class="myk-badge ${acc.Account_Status__c === 'Active' ? 'success' : 'neutral'}">${escapeHtml(acc.Account_Status__c)}</span>
      </td>
      <td>${escapeHtml(acc.Payments_Stage__c)}</td>
      <td><a href="${escapeHtml(acc.Website)}" target="_blank" onclick="event.stopPropagation()">${escapeHtml(acc.Website)}</a></td>
      <td>${formatDate(acc.LastModifiedDate)}</td>
    `;
    
    tr.addEventListener('click', () => handleAccountSelection(acc));
    tableBody.appendChild(tr);
  });
  
  updateSelectAllCheckbox();
}

function updateSelectAllCheckbox() {
  const selectAll = document.getElementById('selectAllCheckbox');
  const rowCheckboxes = document.querySelectorAll('.row-checkbox');
  if (rowCheckboxes.length === 0) {
    selectAll.checked = false;
    selectAll.indeterminate = false;
    return;
  }
  
  const allChecked = Array.from(rowCheckboxes).every(cb => cb.checked);
  const someChecked = Array.from(rowCheckboxes).some(cb => cb.checked);
  
  selectAll.checked = allChecked;
  selectAll.indeterminate = !allChecked && someChecked;
}

function renderErrorTableState() {
  const tableBody = document.getElementById('accountsTableBody');
  tableBody.innerHTML = `
    <tr>
      <td colspan="7" style="text-align: center; color: var(--error-red, #B42318); padding: 24px;">
        <i class="material-icons" style="vertical-align: middle; margin-right: 8px;">error_outline</i>
        Error loading accounts. Please refresh the page.
      </td>
    </tr>
  `;
}

// ------------------------------------------
// Interactive Selection Handlers
// ------------------------------------------
const MAX_ACCOUNT_SELECTION = 10;

function handleAccountSelection(account) {
  if (state.selectedAccountIds.has(account.Id)) {
    state.selectedAccountIds.delete(account.Id);
  } else {
    if (state.selectedAccountIds.size >= MAX_ACCOUNT_SELECTION) {
      alert(`You can select a maximum of ${MAX_ACCOUNT_SELECTION} accounts at a time.`);
      return;
    }
    state.selectedAccountIds.add(account.Id);
  }
  
  // Update checkboxes
  const rows = document.querySelectorAll('#accountsTableBody tr');
  rows.forEach(row => {
    const id = row.getAttribute('data-id');
    const cb = row.querySelector('.row-checkbox');
    if (state.selectedAccountIds.has(id)) {
      if (cb) cb.checked = true;
    } else {
      if (cb) cb.checked = false;
    }
  });
  
  updateSelectAllCheckbox();
  
  // Show and populate Details Panel
  renderAccountDetails();
}

function renderAccountDetails() {
  const emptyState = document.getElementById('detailsEmptyState');
  const dataPanel = document.getElementById('detailsDataPanel');
  
  const selectedCount = state.selectedAccountIds.size;
  
  if (selectedCount === 0) {
    emptyState.style.display = 'flex';
    dataPanel.style.display = 'none';
    disableActionButtons();
    
    // Clear rows selections visually
    const rows = document.querySelectorAll('#accountsTableBody tr');
    rows.forEach(row => row.className = '');
    return;
  }
  
  emptyState.style.display = 'none';
  dataPanel.style.display = 'flex';
  
  // Display the most recently selected account details
  const selectedIds = Array.from(state.selectedAccountIds);
  const selectedId = selectedIds[selectedIds.length - 1];
  const acc = state.accounts.find(a => a.Id === selectedId);
  
  if (!acc) return;
  
  // Highlight rows in the table that are selected
  const rows = document.querySelectorAll('#accountsTableBody tr');
  rows.forEach(row => {
    if (state.selectedAccountIds.has(row.getAttribute('data-id'))) {
      row.className = 'selected';
    } else {
      row.className = '';
    }
  });

  // Instead of multiSelectPanel entirely replacing details, we just update a banner above the details
  let multiSelectHeader = document.getElementById('detailsMultiSelectHeader');
  if (!multiSelectHeader) {
    multiSelectHeader = document.createElement('div');
    multiSelectHeader.id = 'detailsMultiSelectHeader';
    multiSelectHeader.style.padding = '12px 16px';
    multiSelectHeader.style.marginBottom = '16px';
    multiSelectHeader.style.background = 'var(--nav-active-bg, #D3E4F1)';
    multiSelectHeader.style.color = 'var(--nav-active-text, #0377B3)';
    multiSelectHeader.style.borderRadius = '6px';
    multiSelectHeader.style.fontWeight = '700';
    multiSelectHeader.style.fontSize = '12px';
    dataPanel.insertBefore(multiSelectHeader, dataPanel.firstChild);
  }
  
  if (selectedCount > 1) {
    multiSelectHeader.style.display = 'block';
    multiSelectHeader.textContent = `${selectedCount} Accounts Selected (Showing primary selection)`;
  } else {
    multiSelectHeader.style.display = 'none';
  }
  
  const formatDate = (isoString) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };
  
  // Populate Fields
  document.getElementById('accFieldName').textContent = acc.Name;
  document.getElementById('accFieldRegion').textContent = acc.Territory_Region__c;
  document.getElementById('accFieldStatus').textContent = acc.Account_Status__c;
  document.getElementById('accFieldPaymentsStage').textContent = acc.Payments_Stage__c;
  
  const lastModEl = document.getElementById('accFieldLastModified');
  if (lastModEl) lastModEl.textContent = formatDate(acc.LastModifiedDate);
  
  // Dealership Website Link and URL Box
  const websiteLink = document.getElementById('accountWebsiteLink');
  const websiteText = document.getElementById('accountWebsiteText');
  
  websiteLink.href = acc.Website || '#';
  websiteText.textContent = acc.Website || 'No Website';
  
  // Crawled Pages
  const crawledContainer = document.getElementById('crawledPagesContainer');
  const crawledList = document.getElementById('crawledPagesList');
  if (acc.CrawledPages && acc.CrawledPages.length > 0) {
    crawledList.innerHTML = acc.CrawledPages.map(page => `
      <li class="validation-item" style="background: var(--nav-active-bg, #D3E4F1); border-color: var(--nav-active-text, #0377B3);">
        <a href="${escapeHtml(page)}" target="_blank" rel="noopener" style="color: var(--nav-active-text, #0377B3); text-decoration: none; display: flex; align-items: center; gap: 4px;">
          <i class="material-icons" style="font-size: 16px;">link</i> ${escapeHtml(page)}
        </a>
      </li>
    `).join('');
    crawledContainer.style.display = 'block';
  } else if (acc.CrawledPages && acc.CrawledPages.length === 0) {
    crawledList.innerHTML = `<li class="validation-item" style="background: var(--error-bg); border-color: var(--error-red); color: var(--error-red);">No staff pages discovered during crawl.</li>`;
    crawledContainer.style.display = 'block';
  } else {
    crawledContainer.style.display = 'none';
  }
  
  // Extraction Results
  const extractionContainer = document.getElementById('extractionContainer');
  const extractionList = document.getElementById('extractionList');
  if (acc.ExtractedStaff && acc.ExtractedStaff.length > 0) {
    extractionList.innerHTML = acc.ExtractedStaff.map(staff => `
        <tr style="border-bottom: 1px solid var(--border, #E9EAEB);">
          <td style="padding: 6px; font-weight: 600;">${escapeHtml(staff.full_name)}</td>
          <td style="padding: 6px;">${escapeHtml(staff.normalized_role)}</td>
          <td style="padding: 6px;">
            <div style="margin-bottom: 2px;">
              <a href="mailto:${escapeHtml(staff.email)}">${escapeHtml(staff.email)}</a>
              <span style="font-size: 0.8em; color: ${staff.email_valid ? 'var(--success-green, #027A48)' : 'var(--error-red, #B42318)'};">${staff.email_valid ? '✅' : '❌'}</span>
            </div>
            <div>${escapeHtml(staff.phone_number)}
              <span style="font-size: 0.8em; color: ${staff.phone_valid ? 'var(--success-green, #027A48)' : 'var(--error-red, #B42318)'};">${staff.phone_valid ? '✅' : '❌'}</span>
            </div>
          </td>
          <td style="padding: 6px;">
            <span class="status-badge status-active">${(staff.confidence * 100).toFixed(0)}%</span>
          </td>
        </tr>
    `).join('');
    extractionContainer.style.display = 'block';
  } else {
    extractionContainer.style.display = 'none';
  }
  
  // Enable Action Buttons
  enableActionButtons();
}

function enableActionButtons() {
  const btnStart = document.getElementById('btnStartDiscovery');
  const btnExport = document.getElementById('btnExport');
  const btnExtractStaff = document.getElementById('btnExtractStaff');
  
  btnStart.classList.remove('disabled');
  btnStart.removeAttribute('disabled');
  
  if (btnExport) {
    btnExport.classList.remove('disabled');
    btnExport.removeAttribute('disabled');
  }

  // Only enable extract if at least one selected account has crawled pages
  const canExtract = Array.from(state.selectedAccountIds).some(id => {
    const acc = state.accounts.find(a => a.Id === id);
    return acc && acc.CrawledPages && acc.CrawledPages.length > 0;
  });

  if (canExtract && btnExtractStaff) {
    btnExtractStaff.classList.remove('disabled');
    btnExtractStaff.removeAttribute('disabled');
  } else if (btnExtractStaff) {
    btnExtractStaff.classList.add('disabled');
    btnExtractStaff.setAttribute('disabled', 'true');
  }
}

function disableActionButtons() {
  const btnStart = document.getElementById('btnStartDiscovery');
  const btnExport = document.getElementById('btnExport');
  const btnExtractStaff = document.getElementById('btnExtractStaff');
  
  btnStart.classList.add('disabled');
  btnStart.setAttribute('disabled', 'true');
  
  if (btnExport) {
    btnExport.classList.add('disabled');
    btnExport.setAttribute('disabled', 'true');
  }
  if (btnExtractStaff) {
    btnExtractStaff.classList.add('disabled');
    btnExtractStaff.setAttribute('disabled', 'true');
  }
}

// ------------------------------------------
// Clipboard Utility
// ------------------------------------------
function copyToClipboard(text, iconElement) {
  navigator.clipboard.writeText(text).then(() => {
    // Show temporary feedback: change icon to checkmark
    const originalIcon = iconElement.textContent;
    iconElement.textContent = 'check';
    iconElement.style.color = 'var(--success-green, #027A48)';
    
    setTimeout(() => {
      iconElement.textContent = originalIcon;
      iconElement.style.color = '';
    }, 1500);
  }).catch(err => {
    console.error('Failed to copy to clipboard:', err);
  });
}

// ------------------------------------------
// Event Listeners & Interactive Elements
// ------------------------------------------
function setupEventListeners() {
  // Theme Toggle Button
  const themeBtn = document.getElementById('themeToggleBtn');
  themeBtn.addEventListener('click', toggleTheme);
  
  // SPA Sidebar Navigation Click Handlers
  const navItems = {
    'navAccountSelect': 'viewAccountSelect',
    'navCrawlProgress': 'viewCrawlProgress',
    'navReviewQueue': 'viewReviewQueue',
    'navSyncDashboard': 'viewSyncDashboard'
  };
  
  Object.keys(navItems).forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('click', () => {
        if (!el.classList.contains('disabled')) {
          switchView(navItems[id]);
        }
      });
    }
  });

  // Dynamic Search Input with Debounce
  const searchInput = document.getElementById('accountSearchInput');
  searchInput.addEventListener('input', debounce((e) => {
    state.searchQuery = e.target.value;
    fetchAccounts();
  }, 200));
  
  document.getElementById('regionFilter').addEventListener('change', (e) => {
    state.filters.region = e.target.value;
    fetchAccounts();
  });
  
  document.getElementById('paymentsStageFilter').addEventListener('change', (e) => {
    state.filters.paymentsStage = e.target.value;
    fetchAccounts();
  });
  
  document.getElementById('selectAllCheckbox').addEventListener('change', (e) => {
    const isChecked = e.target.checked;
    const rowCheckboxes = document.querySelectorAll('.row-checkbox');
    if (isChecked && rowCheckboxes.length > MAX_ACCOUNT_SELECTION) {
      alert(`You can select a maximum of ${MAX_ACCOUNT_SELECTION} accounts at a time. Selecting the first ${MAX_ACCOUNT_SELECTION}.`);
    }
    let count = 0;
    rowCheckboxes.forEach(cb => {
      const id = cb.getAttribute('data-id');
      if (isChecked) {
        if (count < MAX_ACCOUNT_SELECTION) {
          cb.checked = true;
          state.selectedAccountIds.add(id);
          count++;
        } else {
          cb.checked = false;
        }
      } else {
        cb.checked = false;
        state.selectedAccountIds.delete(id);
      }
    });
    renderAccountDetails();
  });
  
  document.getElementById('accountsTableBody').addEventListener('change', (e) => {
    if (e.target.classList.contains('row-checkbox')) {
      const id = e.target.getAttribute('data-id');
      if (e.target.checked) state.selectedAccountIds.add(id);
      else state.selectedAccountIds.delete(id);
      updateSelectAllCheckbox();
      renderAccountDetails();
    }
  });
  
  // Extract Staff Button Action
  const btnExtractStaff = document.getElementById('btnExtractStaff');
  if (btnExtractStaff) {
    btnExtractStaff.addEventListener('click', async () => {
      const urlsToExtract = [];
      state.selectedAccountIds.forEach(id => {
        const acc = state.accounts.find(a => a.Id === id);
        if (acc && acc.CrawledPages) {
          urlsToExtract.push(...acc.CrawledPages);
        }
      });
      
      if (urlsToExtract.length === 0) return;
      
      const originalText = btnExtractStaff.innerHTML;
      btnExtractStaff.innerHTML = "Extracting...";
      btnExtractStaff.classList.add('disabled');
      btnExtractStaff.setAttribute('disabled', 'true');
      
      try {
        const response = await fetch('/api/extraction/start', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ urls: urlsToExtract })
        });
        
        const result = await response.json();
        
        // Clear old extracted staff for selected accounts
        state.selectedAccountIds.forEach(id => {
          const acc = state.accounts.find(a => a.Id === id);
          if (acc) acc.ExtractedStaff = [];
        });

        const primaryId = Array.from(state.selectedAccountIds)[0];
        result.extracted.forEach(staff => {
          const matchingAcc = state.accounts.find(acc => 
            state.selectedAccountIds.has(acc.Id) && acc.CrawledPages && acc.CrawledPages.includes(staff.source_url)
          );
          if (matchingAcc) {
            matchingAcc.ExtractedStaff.push(staff);
          } else {
            const primaryAcc = state.accounts.find(a => a.Id === primaryId);
            if (primaryAcc) primaryAcc.ExtractedStaff.push(staff);
          }
        });
        
        renderAccountDetails();

        // Enable and switch to Review Queue tab automatically
        const navReview = document.getElementById('navReviewQueue');
        if (navReview) {
          navReview.classList.remove('disabled');
          navReview.removeAttribute('title');
        }
        switchView('viewReviewQueue');
      } catch (error) {
        console.error('Failed to extract staff:', error);
        alert('An error occurred during staff extraction.');
      } finally {
        btnExtractStaff.innerHTML = originalText;
        enableActionButtons();
      }
    });
  }

  const btnExportStaff = document.getElementById('btnExportStaff');
  if (btnExportStaff) {
    btnExportStaff.addEventListener('click', () => {
      const primaryId = Array.from(state.selectedAccountIds)[0];
      const acc = state.accounts.find(a => a.Id === primaryId);
      if (acc && acc.ExtractedStaff) {
        const headers = ["Full Name", "Title", "Normalized Role", "Email", "Phone Number", "Department", "Confidence", "Source URL"];
        const rows = acc.ExtractedStaff.map(s => [
          s.full_name, s.title, s.normalized_role, s.email, s.phone_number, s.department, s.confidence, s.source_url
        ]);
        const csvContent = "data:text/csv;charset=utf-8," 
          + headers.join(",") + "\n" 
          + rows.map(e => e.map(field => `"${(field || '').toString().replace(/"/g, '""')}"`).join(",")).join("\n");
        
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `staff_extraction_${acc.Id}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    });
  }

  // Start Discovery Button Action
  const btnStart = document.getElementById('btnStartDiscovery');
  btnStart.addEventListener('click', async () => {
    if (state.selectedAccountIds.size === 0) {
      alert("Please select at least one account to proceed.");
      return;
    }
    
    // Console Logging Requirement
    const selectedAccounts = Array.from(state.selectedAccountIds).map(id => {
      const acc = state.accounts.find(a => a.Id === id);
      return {
        "Account Id": acc.Id,
        "Account Name": acc.Name,
        "Website": acc.Website,
        "Account Status": acc.Account_Status__c,
        "Territory Region": acc.Territory_Region__c
      };
    });
    console.log("Selected Accounts:", selectedAccounts);

    // Switch to Crawl Progress View
    const navCrawl = document.getElementById('navCrawlProgress');
    if (navCrawl) {
      navCrawl.classList.remove('disabled');
      navCrawl.removeAttribute('title');
    }
    switchView('viewCrawlProgress');

    const progressBody = document.getElementById('crawlProgressTableBody');
    const progressBar = document.getElementById('crawlProgressBar');
    const statAccounts = document.getElementById('crawlStatAccounts');
    const statPages = document.getElementById('crawlStatPages');
    const progressStatus = document.getElementById('crawlProgressStatus');

    progressStatus.textContent = "Crawling websites...";
    progressBar.style.width = "40%";
    progressBody.innerHTML = '';
    
    state.selectedAccountIds.forEach(id => {
      const acc = state.accounts.find(a => a.Id === id);
      if (acc) {
        progressBody.innerHTML += `
          <tr id="crawl-row-${acc.Id}">
            <td style="font-weight: 700;">${escapeHtml(acc.Name)}</td>
            <td><span class="status-badge" style="background: #FFF3EA; color: #D97706; padding: 2px 6px; border-radius: 4px;"><i class="material-icons" style="font-size: 12px; margin-right: 4px; vertical-align: middle;">sync</i> Crawling...</span></td>
            <td id="crawl-det-${acc.Id}">Accessing website...</td>
          </tr>
        `;
      }
    });
    
    try {
        const response = await fetch('/api/discovery/start', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ accountIds: Array.from(state.selectedAccountIds) })
        });
        
        const result = await response.json();
        
        progressBar.style.width = "100%";
        progressStatus.textContent = "Crawl Completed";
        
        let validCount = 0;
        let pagesCount = 0;
        
        // Merge discovery results into state
        if (result.valid) {
          result.valid.forEach(v => {
            const acc = state.accounts.find(a => a.Id === v.Id);
            if (acc) {
              acc.CrawledPages = v.CrawledPages;
              validCount++;
              pagesCount += v.CrawledPages.length;
              
              const row = document.getElementById(`crawl-row-${v.Id}`);
              if (row) {
                row.querySelector('td:nth-child(2)').innerHTML = `<span class="myk-badge success">Success</span>`;
                document.getElementById(`crawl-det-${v.Id}`).textContent = `Found ${v.CrawledPages.length} pages`;
              }
            }
          });
        }
        if (result.invalid) {
          result.invalid.forEach(inv => {
            const acc = state.accounts.find(a => a.Id === inv.Id);
            if (acc) {
              acc.Dawn_Status__c = inv.Dawn_Status__c;
              
              const row = document.getElementById(`crawl-row-${inv.Id}`);
              if (row) {
                row.querySelector('td:nth-child(2)').innerHTML = `<span class="myk-badge error">Failed</span>`;
                document.getElementById(`crawl-det-${inv.Id}`).innerHTML = `<span style="color: var(--error-red);">${escapeHtml(inv.Reason)}</span>`;
              }
            }
          });
        }
        
        statAccounts.textContent = validCount;
        statPages.textContent = pagesCount;
        
        renderAccountDetails();
        showValidationModal(result);
      } catch (error) {
        console.error('Failed to start discovery:', error);
        alert('An error occurred while validating accounts.');
        progressStatus.textContent = "Error occurred during crawl";
      }
  });

  // Review Queue Bulk Actions
  document.getElementById('btnBulkApprove').addEventListener('click', () => {
    const selectedIds = getSelectedReviewIds();
    if (selectedIds.length === 0) {
      alert("No contacts selected for bulk approval.");
      return;
    }
    selectedIds.forEach(uid => {
      const contact = state.extractedContacts.find(c => c.uniqueId === uid);
      if (contact) contact.action = 'approved';
    });
    renderReviewQueue();
  });

  document.getElementById('btnBulkReject').addEventListener('click', () => {
    const selectedIds = getSelectedReviewIds();
    if (selectedIds.length === 0) {
      alert("No contacts selected for bulk rejection.");
      return;
    }
    selectedIds.forEach(uid => {
      const contact = state.extractedContacts.find(c => c.uniqueId === uid);
      if (contact) contact.action = 'rejected';
    });
    renderReviewQueue();
  });

  document.getElementById('selectReviewAllCheckbox').addEventListener('change', (e) => {
    const isChecked = e.target.checked;
    const rowCheckboxes = document.querySelectorAll('.review-row-checkbox');
    rowCheckboxes.forEach(cb => {
      cb.checked = isChecked;
    });
  });

  // Sync to Salesforce submit button
  document.getElementById('btnSubmitReviews').addEventListener('click', submitAllReviews);

  // Back to accounts selection from Sync dashboard
  document.getElementById('btnBackToAccounts').addEventListener('click', () => {
    switchView('viewAccountSelect');
  });
}

function setupModalListeners() {
  const modal = document.getElementById('validationModal');
  const btnClose = document.getElementById('btnCloseModal');
  const btnAck = document.getElementById('btnAcknowledgeModal');
  
  const closeModal = () => {
    modal.style.display = 'none';
  };
  
  btnClose.addEventListener('click', closeModal);
  btnAck.addEventListener('click', closeModal);

  // Edit Contact Modal Action Listeners
  document.getElementById('btnCancelEditContact').addEventListener('click', closeEditModal);
  document.getElementById('btnDiscardEditContact').addEventListener('click', closeEditModal);
  document.getElementById('btnSaveEditContact').addEventListener('click', saveEditedContact);
}

function showValidationModal(result) {
  const modal = document.getElementById('validationModal');
  const modalBody = document.getElementById('validationModalBody');
  
  let html = '';
  
  if (result.valid && result.valid.length > 0) {
    html += `<div class="validation-success">${result.valid.length} Account(s) validated successfully and are ready for crawling.</div>`;
  }
  
  if (result.invalid && result.invalid.length > 0) {
    html += `<div style="margin-bottom: 8px;"><b>${result.invalid.length} Account(s) failed validation</b> and will be skipped:</div>`;
    html += `<ul class="validation-list">`;
    result.invalid.forEach(acc => {
      html += `
        <li class="validation-item">
          <div class="validation-item-title">${escapeHtml(acc.Name)} (${escapeHtml(acc.Id)})</div>
          <div class="validation-item-reason">${escapeHtml(acc.Reason)}<br/><i>Fallback updated: ${escapeHtml(acc.Dawn_Status__c)}</i></div>
        </li>
      `;
    });
    html += `</ul>`;
  }
  
  modalBody.innerHTML = html;
  modal.style.display = 'flex';
}

// Debounce Helper
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Escape HTML Helper to prevent XSS
function escapeHtml(string) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return String(string).replace(/[&<>"']/g, function(m) { return map[m]; });
}

// ------------------------------------------
// SPA View Controller
// ------------------------------------------
function switchView(viewId) {
  state.activeView = viewId;
  const views = ['viewAccountSelect', 'viewCrawlProgress', 'viewReviewQueue', 'viewSyncDashboard'];
  views.forEach(v => {
    const el = document.getElementById(v);
    if (el) el.style.display = (v === viewId) ? 'grid' : 'none';
  });
  
  const navItems = {
    'viewAccountSelect': 'navAccountSelect',
    'viewCrawlProgress': 'navCrawlProgress',
    'viewReviewQueue': 'navReviewQueue',
    'viewSyncDashboard': 'navSyncDashboard'
  };
  
  Object.keys(navItems).forEach(v => {
    const navEl = document.getElementById(navItems[v]);
    if (navEl) {
      if (v === viewId) {
        navEl.classList.add('active');
      } else {
        navEl.classList.remove('active');
      }
    }
  });

  if (viewId === 'viewReviewQueue') {
    renderReviewQueue();
  } else if (viewId === 'viewSyncDashboard') {
    renderSyncDashboard();
  }
}

// ------------------------------------------
// Review Queue Implementation
// ------------------------------------------
function renderReviewQueue() {
  const tableBody = document.getElementById('reviewTableBody');
  const queueCount = document.getElementById('reviewQueueCount');
  
  const summaryAccounts = document.getElementById('reviewSummaryAccounts');
  const summaryApproved = document.getElementById('reviewSummaryApproved');
  const summaryRejected = document.getElementById('reviewSummaryRejected');
  const summaryPending = document.getElementById('reviewSummaryPending');
  
  tableBody.innerHTML = '';
  
  let allContacts = [];
  state.selectedAccountIds.forEach(id => {
    const acc = state.accounts.find(a => a.Id === id);
    if (acc && acc.ExtractedStaff) {
      acc.ExtractedStaff.forEach((staff, index) => {
        const uniqueId = `${id}-${index}`;
        const existing = state.extractedContacts.find(c => c.uniqueId === uniqueId);
        if (existing) {
          staff.action = existing.action;
          staff.full_name = existing.full_name;
          staff.normalized_role = existing.normalized_role;
          staff.email = existing.email;
          staff.phone_number = existing.phone_number;
          staff.email_valid = existing.email_valid;
          staff.phone_valid = existing.phone_valid;
        } else if (!staff.action) {
          staff.action = 'pending';
        }
        staff.uniqueId = uniqueId;
        staff.accountId = id;
        staff.accountName = acc.Name;
        allContacts.push(staff);
      });
    }
  });
  state.extractedContacts = allContacts;
  
  const total = state.extractedContacts.length;
  queueCount.textContent = `${total} Contact${total !== 1 ? 's' : ''} to review`;
  summaryAccounts.textContent = state.selectedAccountIds.size;
  
  let approved = 0;
  let rejected = 0;
  let pending = 0;
  
  if (total === 0) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align: center; color: var(--text-muted); padding: 32px;">
          <i class="material-icons" style="font-size: 48px; display: block; margin-bottom: 8px;">rate_review</i>
          No contacts extracted yet. Select accounts and click "Extract Staff" to load contacts.
        </td>
      </tr>
    `;
    summaryApproved.textContent = 0;
    summaryRejected.textContent = 0;
    summaryPending.textContent = 0;
    return;
  }
  
  state.extractedContacts.forEach(c => {
    if (c.action === 'approved' || c.action === 'edited') approved++;
    else if (c.action === 'rejected') rejected++;
    else pending++;
    
    const tr = document.createElement('tr');
    tr.className = c.action === 'approved' ? 'row-approved' : 
                 c.action === 'rejected' ? 'row-rejected' : 
                 c.action === 'edited' ? 'row-approved row-edited' : '';
                 
    const emailIcon = c.email_valid ? 
      '<span style="color: var(--success-green); margin-left: 4px;" title="Valid Email">✅</span>' : 
      '<span style="color: var(--error-red); margin-left: 4px;" title="Invalid Email">❌</span>';
      
    const phoneIcon = c.phone_valid ? 
      '<span style="color: var(--success-green); margin-left: 4px;" title="Valid Phone">✅</span>' : 
      '<span style="color: var(--error-red); margin-left: 4px;" title="Invalid Phone">❌</span>';
      
    tr.innerHTML = `
      <td onclick="event.stopPropagation()">
        <input type="checkbox" class="review-row-checkbox" data-uid="${escapeHtml(c.uniqueId)}">
      </td>
      <td style="font-weight: 700;">${escapeHtml(c.full_name)}</td>
      <td>${escapeHtml(c.normalized_role)}</td>
      <td>
        <a href="mailto:${escapeHtml(c.email)}">${escapeHtml(c.email)}</a>
        ${emailIcon}
      </td>
      <td>
        ${escapeHtml(c.phone_number)}
        ${phoneIcon}
      </td>
      <td>
        <span class="status-badge status-active">${(c.confidence * 100).toFixed(0)}%</span>
      </td>
      <td>
        <div style="display: flex; gap: 4px;">
          <button class="icon-btn" onclick="toggleApproveContact('${escapeHtml(c.uniqueId)}')" title="Approve" style="color: var(--success-green);"><i class="material-icons">check_circle</i></button>
          <button class="icon-btn" onclick="toggleRejectContact('${escapeHtml(c.uniqueId)}')" title="Reject" style="color: var(--error-red);"><i class="material-icons">cancel</i></button>
          <button class="icon-btn" onclick="openEditContactModal('${escapeHtml(c.uniqueId)}')" title="Edit" style="color: var(--accent-orange);"><i class="material-icons">edit</i></button>
        </div>
      </td>
    `;
    tableBody.appendChild(tr);
  });
  
  summaryApproved.textContent = approved;
  summaryRejected.textContent = rejected;
  summaryPending.textContent = pending;
}

window.toggleApproveContact = function(uniqueId) {
  const contact = state.extractedContacts.find(c => c.uniqueId === uniqueId);
  if (contact) {
    contact.action = (contact.action === 'approved') ? 'pending' : 'approved';
    renderReviewQueue();
  }
};

window.toggleRejectContact = function(uniqueId) {
  const contact = state.extractedContacts.find(c => c.uniqueId === uniqueId);
  if (contact) {
    contact.action = (contact.action === 'rejected') ? 'pending' : 'rejected';
    renderReviewQueue();
  }
};

window.openEditContactModal = function(uniqueId) {
  const contact = state.extractedContacts.find(c => c.uniqueId === uniqueId);
  if (!contact) return;
  
  state.editingContactId = uniqueId;
  
  document.getElementById('editContactName').value = contact.full_name || '';
  document.getElementById('editContactRole').value = contact.normalized_role || '';
  document.getElementById('editContactEmail').value = contact.email || '';
  document.getElementById('editContactPhone').value = contact.phone_number || '';
  
  document.getElementById('editContactEmailWarn').style.display = 'none';
  document.getElementById('editContactPhoneWarn').style.display = 'none';
  
  document.getElementById('editContactModal').style.display = 'flex';
};

function closeEditModal() {
  document.getElementById('editContactModal').style.display = 'none';
  state.editingContactId = null;
}

function saveEditedContact() {
  const name = document.getElementById('editContactName').value.trim();
  const role = document.getElementById('editContactRole').value.trim();
  const email = document.getElementById('editContactEmail').value.trim();
  const phone = document.getElementById('editContactPhone').value.trim();
  
  const emailWarn = document.getElementById('editContactEmailWarn');
  const phoneWarn = document.getElementById('editContactPhoneWarn');
  
  emailWarn.style.display = 'none';
  phoneWarn.style.display = 'none';
  
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const phoneRegex = /^\+?[0-9\s().-]{7,25}$/;
  
  let valid = true;
  if (!emailRegex.test(email)) {
    emailWarn.style.display = 'block';
    valid = false;
  }
  if (phone && !phoneRegex.test(phone)) {
    phoneWarn.style.display = 'block';
    valid = false;
  }
  
  if (!valid) return;
  
  const contact = state.extractedContacts.find(c => c.uniqueId === state.editingContactId);
  if (contact) {
    contact.full_name = name;
    contact.normalized_role = role;
    contact.email = email;
    contact.phone_number = phone;
    contact.email_valid = true;
    contact.phone_valid = phone ? true : false;
    contact.action = 'edited';
    
    const acc = state.accounts.find(a => a.Id === contact.accountId);
    if (acc && acc.ExtractedStaff) {
      const idx = contact.uniqueId.split('-')[1];
      const staff = acc.ExtractedStaff[idx];
      if (staff) {
        staff.full_name = name;
        staff.normalized_role = role;
        staff.email = email;
        staff.phone_number = phone;
        staff.email_valid = true;
        staff.phone_valid = phone ? true : false;
        staff.action = 'edited';
      }
    }
  }
  
  closeEditModal();
  renderReviewQueue();
}

function getSelectedReviewIds() {
  const checkboxes = document.querySelectorAll('.review-row-checkbox:checked');
  return Array.from(checkboxes).map(cb => cb.getAttribute('data-uid'));
}

async function submitAllReviews() {
  const btn = document.getElementById('btnSubmitReviews');
  const originalHtml = btn.innerHTML;
  btn.innerHTML = `<i class="material-icons" style="animation: spin 2s linear infinite;">sync</i> Syncing...`;
  btn.classList.add('disabled');
  btn.setAttribute('disabled', 'true');
  
  try {
    const promises = [];
    state.selectedAccountIds.forEach(accountId => {
      const contactsForAccount = state.extractedContacts.filter(c => c.accountId === accountId);
      if (contactsForAccount.length > 0) {
        promises.push(
          fetch('/api/review/submit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              accountId: accountId,
              contacts: contactsForAccount
            })
          }).then(r => {
            if (!r.ok) throw new Error("Sync failed");
            return r.json();
          })
        );
      }
    });
    
    if (promises.length === 0) {
      alert("No contacts available to sync.");
      return;
    }
    
    const results = await Promise.all(promises);
    state.syncResults = results;
    
    const navSync = document.getElementById('navSyncDashboard');
    if (navSync) {
      navSync.classList.remove('disabled');
      navSync.removeAttribute('title');
    }
    switchView('viewSyncDashboard');
  } catch (err) {
    console.error("Sync failed:", err);
    alert("An error occurred during synchronization: " + err.message);
  } finally {
    btn.innerHTML = originalHtml;
    btn.classList.remove('disabled');
    btn.removeAttribute('disabled');
  }
}

// ------------------------------------------
// Synchronization Dashboard Implementation
// ------------------------------------------
function renderSyncDashboard() {
  const tableBody = document.getElementById('syncResultsTableBody');
  const statCreated = document.getElementById('syncStatCreated');
  const statUpdated = document.getElementById('syncStatUpdated');
  const statFailed = document.getElementById('syncStatFailed');
  
  tableBody.innerHTML = '';
  
  let totalCreated = 0;
  let totalUpdated = 0;
  let totalFailed = 0;
  let totalSkipped = 0;
  
  let combinedAuditLogs = [];
  
  state.syncResults.forEach(res => {
    totalCreated += res.created_count || 0;
    totalUpdated += res.updated_count || 0;
    totalFailed += res.flagged_count || 0;
    totalSkipped += res.skipped_count || 0;
    
    if (res.audit_trail && Array.isArray(res.audit_trail)) {
      combinedAuditLogs = combinedAuditLogs.concat(res.audit_trail);
    }
    
    res.contacts.forEach(c => {
      const tr = document.createElement('tr');
      
      let opBadgeClass = 'badge-create';
      let opText = c.operation || 'Create';
      if (opText.includes('Update')) {
        opBadgeClass = 'badge-update';
      } else if (opText.includes('Skip')) {
        opBadgeClass = 'badge-skip';
      } else if (opText.includes('Flag') || opText.includes('Ambiguous')) {
        opBadgeClass = 'badge-flag';
      }
      
      let statusHtml = '';
      if (c.status === 'Created') {
        statusHtml = `<span class="myk-badge success"><i class="material-icons" style="font-size: 14px; margin-right: 4px; vertical-align: middle;">check_circle</i> Synced</span>`;
      } else if (c.status === 'Updated') {
        statusHtml = `<span class="myk-badge success" style="background: var(--nav-active-bg); color: var(--nav-active-text);"><i class="material-icons" style="font-size: 14px; margin-right: 4px; vertical-align: middle;">update</i> Updated</span>`;
      } else if (c.status === 'Skipped') {
        statusHtml = `<span class="myk-badge" style="background: var(--toggle-track); color: var(--text-secondary);"><i class="material-icons" style="font-size: 14px; margin-right: 4px; vertical-align: middle;">block</i> Skipped</span>`;
      } else if (c.status === 'Flagged') {
        statusHtml = `<span class="myk-badge error"><i class="material-icons" style="font-size: 14px; margin-right: 4px; vertical-align: middle;">warning</i> Flagged</span>`;
      } else {
        statusHtml = `<span class="myk-badge error"><i class="material-icons" style="font-size: 14px; margin-right: 4px; vertical-align: middle;">error</i> Error</span>`;
      }
      
      let nameHtml = `<div style="font-weight: 700;">${escapeHtml(c.full_name)}</div>`;
      if (c.status === 'Flagged' && c.error) {
        nameHtml += `<div style="font-size: 11px; color: var(--accent-orange, #ED6D22); font-weight: normal; margin-top: 2px;"><i class="material-icons" style="font-size: 11px; vertical-align: middle; margin-right: 2px;">info</i> ${escapeHtml(c.error)}</div>`;
      } else if (c.status === 'Skipped' && c.error) {
        nameHtml += `<div style="font-size: 11px; color: var(--text-muted, #B8B8B8); font-weight: normal; margin-top: 2px;">${escapeHtml(c.error)}</div>`;
      }
      
      tr.innerHTML = `
        <td>${escapeHtml(res.accountId)}</td>
        <td>${nameHtml}</td>
        <td>${escapeHtml(c.email)}</td>
        <td>${escapeHtml(c.normalized_role || c.title || '')}</td>
        <td><span class="status-badge ${opBadgeClass}">${opText}</span></td>
        <td>${statusHtml}</td>
      `;
      tableBody.appendChild(tr);
    });
  });
  
  statCreated.textContent = totalCreated;
  statUpdated.textContent = totalUpdated;
  statFailed.textContent = totalFailed;
  
  const consoleElem = document.getElementById('syncAuditTrailConsole');
  if (consoleElem) {
    consoleElem.innerHTML = '';
    if (combinedAuditLogs.length === 0) {
      consoleElem.innerHTML = '<div class="terminal-line system-msg">No audit logs received.</div>';
    } else {
      combinedAuditLogs.forEach(log => {
        const div = document.createElement('div');
        div.className = 'terminal-line';
        
        if (log.includes('CREATE:')) {
          div.classList.add('create-msg');
        } else if (log.includes('UPDATE:')) {
          div.classList.add('update-msg');
        } else if (log.includes('SKIP:')) {
          div.classList.add('skip-msg');
        } else if (log.includes('WARNING:')) {
          div.classList.add('warn-msg');
        } else {
          div.classList.add('system-msg');
        }
        
        div.textContent = log;
        consoleElem.appendChild(div);
      });
      consoleElem.scrollTop = consoleElem.scrollHeight;
    }
  }
}
