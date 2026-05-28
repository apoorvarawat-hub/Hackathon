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
    status: '',
    paymentsStage: ''
  }
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
      status: state.filters.status,
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
  const statuses = new Set();
  const stages = new Set();
  
  data.forEach(acc => {
    if (acc.Territory_Region__c) regions.add(acc.Territory_Region__c);
    if (acc.Account_Status__c) statuses.add(acc.Account_Status__c);
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
  populateSelect('statusFilter', statuses);
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
function handleAccountSelection(account) {
  // If row clicked, we can toggle its selection
  if (state.selectedAccountIds.has(account.Id)) {
    state.selectedAccountIds.delete(account.Id);
  } else {
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
  
  // Enable Action Buttons
  enableActionButtons();
}

function enableActionButtons() {
  const btnStart = document.getElementById('btnStartDiscovery');
  const btnExport = document.getElementById('btnExport');
  
  btnStart.classList.remove('disabled');
  btnStart.removeAttribute('disabled');
  
  btnExport.classList.remove('disabled');
  btnExport.removeAttribute('disabled');
}

function disableActionButtons() {
  const btnStart = document.getElementById('btnStartDiscovery');
  const btnExport = document.getElementById('btnExport');
  
  btnStart.classList.add('disabled');
  btnStart.setAttribute('disabled', 'true');
  
  btnExport.classList.add('disabled');
  btnExport.setAttribute('disabled', 'true');
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
  
  document.getElementById('statusFilter').addEventListener('change', (e) => {
    state.filters.status = e.target.value;
    fetchAccounts();
  });
  
  document.getElementById('paymentsStageFilter').addEventListener('change', (e) => {
    state.filters.paymentsStage = e.target.value;
    fetchAccounts();
  });
  
  document.getElementById('selectAllCheckbox').addEventListener('change', (e) => {
    const isChecked = e.target.checked;
    const rowCheckboxes = document.querySelectorAll('.row-checkbox');
    rowCheckboxes.forEach(cb => {
      cb.checked = isChecked;
      const id = cb.getAttribute('data-id');
      if (isChecked) state.selectedAccountIds.add(id);
      else state.selectedAccountIds.delete(id);
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
  
  // Copy Account ID Button
  const copyBtn = document.getElementById('btnCopyId');
  copyBtn.addEventListener('click', (e) => {
    if (state.selectedAccountIds.size === 1) {
      const selectedId = Array.from(state.selectedAccountIds)[0];
      copyToClipboard(selectedId, e.target);
    }
  });

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

    const originalText = btnStart.innerText;
    btnStart.innerText = "Loading...";
    btnStart.classList.add('disabled');
    btnStart.setAttribute('disabled', 'true');
    
    try {
        const response = await fetch('/api/discovery/start', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ accountIds: Array.from(state.selectedAccountIds) })
        });
        
        const result = await response.json();
        showValidationModal(result);
      } catch (error) {
        console.error('Failed to start discovery:', error);
        alert('An error occurred while validating accounts.');
      } finally {
        btnStart.innerText = originalText;
        btnStart.classList.remove('disabled');
        btnStart.removeAttribute('disabled');
      }
  });
}

// ------------------------------------------
// Modal Handlers
// ------------------------------------------
function setupModalListeners() {
  const modal = document.getElementById('validationModal');
  const btnClose = document.getElementById('btnCloseModal');
  const btnAck = document.getElementById('btnAcknowledgeModal');
  
  const closeModal = () => {
    modal.style.display = 'none';
  };
  
  btnClose.addEventListener('click', closeModal);
  btnAck.addEventListener('click', closeModal);
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
