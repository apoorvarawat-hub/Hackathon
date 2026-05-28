// ==========================================
// myKaarma SPA Client Application Logic
// ==========================================

// Global Application State
const state = {
  accounts: [],
  selectedAccount: null,
  theme: 'light',
  searchQuery: ''
};

// ------------------------------------------
// Initialize Application
// ------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
  initThemeState();
  fetchAccounts();
  setupEventListeners();
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
async function fetchAccounts(query = '') {
  try {
    const response = await fetch(`/api/accounts?query=${encodeURIComponent(query)}`);
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }
    
    state.accounts = await response.json();
    renderAccountsTable();
  } catch (error) {
    console.error('Failed to fetch accounts:', error);
    renderErrorTableState();
  }
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
  
  state.accounts.forEach(acc => {
    const tr = document.createElement('tr');
    tr.setAttribute('data-id', acc.id);
    
    // Highlight if currently selected
    if (state.selectedAccount && state.selectedAccount.id === acc.id) {
      tr.className = 'selected';
    }
    
    // Render columns: Name, Code, Region, Status Badge
    tr.innerHTML = `
      <td title="${escapeHtml(acc.name)}" style="font-weight: 700;">${escapeHtml(acc.name)}</td>
      <td title="${escapeHtml(acc.code)}">${escapeHtml(acc.code)}</td>
      <td title="${escapeHtml(acc.region)}">${escapeHtml(acc.region)}</td>
      <td>
        <span class="myk-badge success">${escapeHtml(acc.status)}</span>
      </td>
    `;
    
    tr.addEventListener('click', () => handleAccountSelection(acc));
    tableBody.appendChild(tr);
  });
}

function renderErrorTableState() {
  const tableBody = document.getElementById('accountsTableBody');
  tableBody.innerHTML = `
    <tr>
      <td colspan="4" style="text-align: center; color: var(--error-red, #B42318); padding: 24px;">
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
  state.selectedAccount = account;
  
  // Highlight active row in the table
  const rows = document.querySelectorAll('#accountsTableBody tr');
  rows.forEach(row => {
    if (row.getAttribute('data-id') === account.id) {
      row.className = 'selected';
    } else {
      row.className = '';
    }
  });
  
  // Show and populate Details Panel
  renderAccountDetails();
}

function renderAccountDetails() {
  const emptyState = document.getElementById('detailsEmptyState');
  const dataPanel = document.getElementById('detailsDataPanel');
  const acc = state.selectedAccount;
  
  if (!acc) {
    emptyState.style.display = 'flex';
    dataPanel.style.display = 'none';
    disableActionButtons();
    return;
  }
  
  emptyState.style.display = 'none';
  dataPanel.style.display = 'flex';
  
  // Populate Fields
  document.getElementById('accFieldId').textContent = acc.id;
  document.getElementById('accFieldName').textContent = acc.name;
  document.getElementById('accFieldCode').textContent = acc.code;
  document.getElementById('accFieldRegion').textContent = acc.region;
  document.getElementById('accFieldPhone').textContent = acc.phone;
  document.getElementById('accFieldIndustry').textContent = acc.industry;
  document.getElementById('accFieldOwner').textContent = acc.owner;
  
  // Currency Formatting (Annual Revenue)
  const currencyFormatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0
  });
  document.getElementById('accFieldRevenue').textContent = currencyFormatter.format(acc.annual_revenue);
  
  // Dealership Website Link and URL Box
  const websiteLink = document.getElementById('accountWebsiteLink');
  const websiteText = document.getElementById('accountWebsiteText');
  
  websiteLink.href = acc.website;
  websiteText.textContent = acc.website;
  
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
    fetchAccounts(state.searchQuery);
  }, 200));
  
  // Copy Account ID Button
  const copyBtn = document.getElementById('btnCopyId');
  copyBtn.addEventListener('click', (e) => {
    if (state.selectedAccount) {
      copyToClipboard(state.selectedAccount.id, e.target);
    }
  });

  // Start Discovery Button Action
  const btnStart = document.getElementById('btnStartDiscovery');
  btnStart.addEventListener('click', () => {
    if (state.selectedAccount) {
      alert(`Milestone 1 Complete! Selected Dealership: ${state.selectedAccount.name}\nWebsite Loaded: ${state.selectedAccount.website}\n\nReady for Crawling & Enrichment (Milestone 2)!`);
    }
  });
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
