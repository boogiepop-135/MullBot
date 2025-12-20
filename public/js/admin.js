// Global variables
let currentUser = null;
let currentPage = 'contacts';
let contactsPage = 1;
let contactsSearch = '';
let currentSaleStatusFilter = '';
let templates = [];
let allProducts = [];
let notificationStream = null;
let currentChatPhoneNumber = null;
let currentChatContactName = null;
let chatMessages = [];
let currentStatusPhone = null;
let currentProductId = null;
let currentTemplateId = null;

// Authentication check
async function checkAuth() {
  const token = localStorage.getItem('token');
  if (!token) {
    window.location.href = '/admin/login';
    return;
  }

  try {
    const response = await fetch('/crm/auth/check', {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!response.ok) {
      throw new Error('Not authenticated');
    }

    const data = await response.json();
    currentUser = data.user;

    const usernameEl = document.getElementById('user-name');
    if (usernameEl) usernameEl.textContent = currentUser.username;

    const roleEl = document.getElementById('user-role');
    if (roleEl) roleEl.textContent = currentUser.role === 'admin' ? 'Administrador' : 'Usuario';

    const initialsEl = document.getElementById('user-initials');
    if (initialsEl) initialsEl.textContent = currentUser.username.charAt(0).toUpperCase();

    // Show users tab if admin
    if (currentUser.role === 'admin') {
      const usersNav = document.getElementById('nav-users');
      if (usersNav) usersNav.classList.remove('hidden');
    }

  } catch (error) {
    console.error('Auth error:', error);
    localStorage.removeItem('token');
    window.location.href = '/admin/login';
  }
}

// Navigation function
window.showSection = function (sectionId) {
  // Update navigation UI
  document.querySelectorAll('.nav-item').forEach(item => {
    item.classList.remove('active', 'bg-indigo-50', 'text-indigo-600', 'border-indigo-600');
    item.classList.add('text-gray-600', 'border-transparent');
  });

  const activeNav = document.getElementById('nav-' + sectionId);
  if (activeNav) {
    activeNav.classList.add('active', 'bg-indigo-50', 'text-indigo-600', 'border-indigo-600');
    activeNav.classList.remove('text-gray-600', 'border-transparent');
  }

  // Hide all sections
  document.querySelectorAll('.section-content').forEach(section => {
    section.classList.add('hidden');
  });

  // Show target section
  const targetSection = document.getElementById(sectionId + '-section');
  if (targetSection) {
    targetSection.classList.remove('hidden');
  }

  currentPage = sectionId;
  window.location.hash = sectionId;

  // Load data
  switch (sectionId) {
    case 'dashboard':
      loadDashboardData();
      break;
    case 'contacts':
      loadContacts();
      break;
    case 'campaigns':
      loadCampaigns();
      break;
    case 'new-campaign':
      loadAvailableContacts();
      break;
    case 'templates':
      loadTemplates();
      break;
    case 'products':
      loadProducts();
      break;
    case 'users':
      if (typeof loadUsers === 'function') loadUsers();
      break;
    case 'readme':
      loadReadmeContent();
      break;
    case 'bot-content':
      loadBotContent();
      break;
    case 'settings':
      loadBotConfig();
      loadWhatsAppStatus();
      break;
  }
};

// Settings tabs navigation
window.showSettingsTab = function(tabName) {
  // Update tab buttons
  document.querySelectorAll('.settings-tab').forEach(tab => {
    tab.classList.remove('text-indigo-600', 'border-b-2', 'border-indigo-600');
    tab.classList.add('text-gray-500');
  });
  
  const activeTab = document.getElementById('tab-' + tabName);
  if (activeTab) {
    activeTab.classList.add('text-indigo-600', 'border-b-2', 'border-indigo-600');
    activeTab.classList.remove('text-gray-500');
  }
  
  // Show/hide panels
  document.querySelectorAll('.settings-panel').forEach(panel => {
    panel.classList.add('hidden');
  });
  
  const activePanel = document.getElementById('settings-' + tabName);
  if (activePanel) {
    activePanel.classList.remove('hidden');
  }
};

// Initialization
document.addEventListener('DOMContentLoaded', function () {
  checkAuth();

  // Initial navigation based on hash
  const hash = window.location.hash.substring(1);
  if (hash && ['dashboard', 'contacts', 'campaigns', 'templates', 'products', 'users', 'bot-content', 'settings'].includes(hash)) {
    showSection(hash);
  } else {
    showSection('dashboard');
  }

  // Event listeners for specific UI elements
  const contactSearch = document.getElementById('contact-search');
  if (contactSearch) {
    contactSearch.addEventListener('input', function (e) {
      contactsSearch = e.target.value;
      if (currentPage === 'contacts') loadContacts();
    });
  }

  const statusFilter = document.getElementById('sale-status-filter');
  if (statusFilter) {
    statusFilter.addEventListener('change', function (e) {
      currentSaleStatusFilter = e.target.value;
      if (currentPage === 'contacts') loadContacts();
    });
  }

  // Campaign form
  const campaignForm = document.getElementById('campaign-form');
  if (campaignForm) {
    campaignForm.addEventListener('submit', function (e) {
      e.preventDefault();
      createCampaign();
    });
  }

  // Notifications
  if (localStorage.getItem('token')) {
    startNotificationStream();
    loadNotifications().catch(err => console.error('Error loading initial notifications:', err));
  }
});

// --- Data Loading Functions ---

async function loadDashboardData() {
  try {
    const statsRes = await fetch('/crm/statistics', {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    });

    if (!statsRes.ok) throw new Error('Failed to load statistics');

    const stats = await statsRes.json();

    const updateElement = (id, value) => {
      const element = document.getElementById(id);
      if (element) element.textContent = value || 0;
    };

    updateElement('leads-count', stats.contacts.byStatus.leads || 0);
    updateElement('interested-contacts', stats.contacts.byStatus.interested || 0);
    updateElement('info-requested-count', stats.contacts.byStatus.infoRequested || 0);
    updateElement('payment-pending-count', stats.contacts.byStatus.paymentPending || 0);
    updateElement('appointment-scheduled-count', stats.contacts.byStatus.appointmentScheduled || 0);
    updateElement('appointment-confirmed-count', stats.contacts.byStatus.appointmentConfirmed || 0);
    updateElement('completed-count', stats.contacts.byStatus.completed || 0);
    updateElement('paused-contacts', stats.contacts.byStatus.paused || 0);

    // Secondary stats
    updateElement('total-campaigns', stats.campaigns.total);
    updateElement('total-messages', stats.campaigns.totalMessagesSent);
    updateElement('total-interactions', stats.sales.totalInteractions);

    renderIntentStats(stats.sales.intentCounts);
    renderTopLeads(stats.topLeads);

    const recentContacts = await fetch('/crm/contacts?limit=5&sort=-lastInteraction', {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    }).then(res => res.json());

    renderRecentContacts(recentContacts.data);
  } catch (error) {
    console.error('Error loading dashboard data:', error);
  }
}

function renderIntentStats(intentCounts) {
  const container = document.getElementById('intent-stats');
  if (!container) return;
  container.innerHTML = '';

  const intentLabels = {
    'info': { label: 'Información', emoji: 'ℹ️' },
    'price': { label: 'Precio', emoji: '💰' },
    'product': { label: 'Producto', emoji: '📦' },
    'payment': { label: 'Pago', emoji: '💳' },
    'purchase': { label: 'Compra', emoji: '🛒' },
    'objection': { label: 'Objeción', emoji: '❓' },
    'other': { label: 'Otro', emoji: '💬' }
  };

  Object.entries(intentCounts).forEach(([intent, count]) => {
    const intentData = intentLabels[intent] || { label: intent, emoji: '💬' };
    const div = document.createElement('div');
    div.className = 'flex items-center justify-between mb-3';
    div.innerHTML = `
      <div class="flex items-center space-x-3">
        <span class="text-xl">${intentData.emoji}</span>
        <span class="text-sm font-medium text-gray-700">${intentData.label}</span>
      </div>
      <span class="text-base font-semibold text-gray-800">${count}</span>
    `;
    container.appendChild(div);
  });

  if (Object.keys(intentCounts).length === 0) {
    container.innerHTML = '<p class="text-gray-400 text-sm text-center py-8">No hay datos aún</p>';
  }
}

function renderTopLeads(leads) {
  const tbody = document.getElementById('top-leads-table');
  if (!tbody) return;
  tbody.innerHTML = '';

  if (leads.length === 0) {
    tbody.innerHTML = `<tr><td colspan="3" class="px-6 py-4 text-sm text-gray-500 text-center">No hay leads aún</td></tr>`;
    return;
  }

  leads.forEach(lead => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="px-6 py-4 whitespace-nowrap">
        <div class="text-sm font-medium text-gray-900">${lead.name || 'Desconocido'}</div>
        <div class="text-xs text-gray-500">${lead.phoneNumber}</div>
      </td>
      <td class="px-6 py-4 whitespace-nowrap">
        <span class="px-2 py-1 text-xs font-semibold rounded-full ${lead.score >= 10 ? 'bg-green-100 text-green-800' : lead.score >= 5 ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-800'}">
          ${lead.score || 0}
        </span>
      </td>
      <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
        <button onclick="openChatModal('${lead.phoneNumber}', '${lead.name || lead.phoneNumber}')" class="text-indigo-600 hover:text-indigo-900 font-medium text-xs">
          Contactar
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function renderRecentContacts(contacts) {
  const container = document.getElementById('recent-contacts');
  if (!container) return;
  container.innerHTML = '';

  contacts.forEach(contact => {
    const tr = document.createElement('tr');
    tr.className = 'hover:bg-gray-50 transition-colors';
    tr.innerHTML = `
      <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">
        ${contact.name || contact.pushName || 'Desconocido'}
      </td>
      <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
        ${contact.phoneNumber}
      </td>
      <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
        ${formatDate(contact.lastInteraction)}
      </td>
    `;
    container.appendChild(tr);
  });
}

async function loadContacts(page = 1) {
  contactsPage = page;
  try {
    const params = new URLSearchParams({
      page: page.toString(),
      limit: '20',
      search: contactsSearch
    });

    if (currentSaleStatusFilter && currentSaleStatusFilter !== 'paused') {
      params.append('saleStatus', currentSaleStatusFilter);
    }

    const response = await fetch(`/crm/contacts?${params.toString()}`, {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    });

    if (!response.ok) throw new Error('Failed to load contacts');

    let { data, meta } = await response.json();

    if (currentSaleStatusFilter === 'paused') {
      data = data.filter(contact => contact.isPaused === true);
      // Client-side pagination adjustment would be needed here for perfect accuracy
    }

    renderContacts(data);
    renderContactsPagination(meta);

    const start = (meta.page - 1) * meta.limit + 1;
    const end = Math.min(meta.page * meta.limit, meta.total);
    document.getElementById('contacts-pagination-info').textContent = `Mostrando ${start} a ${end} de ${meta.total} contactos`;

  } catch (error) {
    console.error('Error loading contacts:', error);
  }
}

function renderContacts(contacts) {
  const tbody = document.getElementById('contacts-table-body');
  if (!tbody) return;
  tbody.innerHTML = '';

  if (contacts.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="px-6 py-8 text-sm text-gray-500 text-center">No se encontraron contactos</td></tr>`;
    return;
  }

  const statusLabels = {
    'lead': { label: 'Lead', bg: 'bg-gray-100 text-gray-800' },
    'interested': { label: 'Interesado', bg: 'bg-blue-100 text-blue-800' },
    'info_requested': { label: 'Info Solicitada', bg: 'bg-indigo-100 text-indigo-800' },
    'payment_pending': { label: 'Pago Pendiente', bg: 'bg-yellow-100 text-yellow-800' },
    'appointment_scheduled': { label: 'Cita Agendada', bg: 'bg-orange-100 text-orange-800' },
    'appointment_confirmed': { label: 'Cita Confirmada', bg: 'bg-green-100 text-green-800' },
    'completed': { label: 'Completado', bg: 'bg-green-100 text-green-800' }
  };

  contacts.forEach(contact => {
    const status = statusLabels[contact.saleStatus || 'lead'] || statusLabels['lead'];
    const isPaused = contact.isPaused || false;

    const tr = document.createElement('tr');
    tr.className = 'hover:bg-gray-50 transition-colors';
    tr.innerHTML = `
      <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${contact.phoneNumber}</td>
      <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${contact.name || contact.pushName || '-'}</td>
      <td class="px-6 py-4 whitespace-nowrap">
        <span class="px-2 py-1 text-xs font-semibold rounded-full ${status.bg}">
          ${status.label}
        </span>
        ${isPaused ? '<span class="ml-2 px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800">Pausado</span>' : ''}
      </td>
      <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${formatDate(contact.lastInteraction)}</td>
      <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
        <div class="flex items-center space-x-3">
          <button onclick="openChatModal('${contact.phoneNumber}', '${contact.name || contact.phoneNumber}')" class="text-indigo-600 hover:text-indigo-900" title="Chat">
            <i class="fas fa-comments"></i>
          </button>
          <button onclick="openStatusModal('${contact.phoneNumber}', '${contact.saleStatus || 'lead'}', '${contact.appointmentDate || ''}')" class="text-blue-600 hover:text-blue-900" title="Cambiar Estado">
            <i class="fas fa-edit"></i>
          </button>
          <button onclick="togglePauseContact('${contact.phoneNumber}', ${isPaused})" class="${isPaused ? 'text-green-600 hover:text-green-900' : 'text-orange-600 hover:text-orange-900'}" title="${isPaused ? 'Reanudar' : 'Pausar'}">
            <i class="fas fa-${isPaused ? 'play' : 'pause'}"></i>
          </button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function renderContactsPagination(meta) {
  const paginationDiv = document.getElementById('contacts-pagination');
  if (!paginationDiv) return;
  paginationDiv.innerHTML = '';

  if (meta.pages <= 1) return;

  const createButton = (text, page, disabled = false, active = false) => {
    const btn = document.createElement('button');
    btn.className = `px-3 py-1 rounded-md text-sm font-medium transition-colors ${active ? 'bg-indigo-600 text-white' : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`;
    btn.innerHTML = text;
    btn.disabled = disabled;
    if (!disabled) btn.onclick = () => loadContacts(page);
    return btn;
  };

  paginationDiv.appendChild(createButton('<i class="fas fa-chevron-left"></i>', meta.page - 1, meta.page === 1));

  // Simplified pagination logic for brevity
  if (meta.pages <= 5) {
    for (let i = 1; i <= meta.pages; i++) {
      paginationDiv.appendChild(createButton(i, i, false, i === meta.page));
    }
  } else {
    paginationDiv.appendChild(createButton(meta.page, meta.page, false, true));
  }

  paginationDiv.appendChild(createButton('<i class="fas fa-chevron-right"></i>', meta.page + 1, meta.page === meta.pages));
}

// --- Campaign Functions ---

async function loadCampaigns() {
  try {
    const response = await fetch('/crm/campaigns', {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    });
    if (!response.ok) throw new Error('Failed to load campaigns');
    const campaigns = await response.json();
    renderCampaigns(campaigns);
  } catch (error) {
    console.error('Error loading campaigns:', error);
  }
}

function renderCampaigns(campaigns) {
  const tbody = document.getElementById('campaigns-table-body');
  if (!tbody) return;
  tbody.innerHTML = '';

  if (campaigns.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="px-6 py-8 text-sm text-gray-500 text-center">No hay campañas</td></tr>`;
    return;
  }

  campaigns.forEach(campaign => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${campaign.name}</td>
      <td class="px-6 py-4 whitespace-nowrap">
        <span class="badge ${campaign.status === 'sent' ? 'badge-sent' : campaign.status === 'scheduled' ? 'badge-scheduled' : campaign.status === 'failed' ? 'badge-failed' : 'badge-draft'}">
          ${campaign.status}
        </span>
      </td>
      <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${campaign.scheduledAt ? formatDate(campaign.scheduledAt) : '-'}</td>
      <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${campaign.sentCount || 0}</td>
      <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${campaign.failedCount || 0}</td>
      <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
        <button class="text-indigo-600 hover:text-indigo-900"><i class="fas fa-eye"></i></button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

async function loadAvailableContacts() {
  try {
    const response = await fetch('/crm/contacts?limit=1000', {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    });
    if (!response.ok) throw new Error('Failed to load contacts');
    const { data } = await response.json();
    renderAvailableContacts(data);
  } catch (error) {
    console.error('Error loading contacts:', error);
  }
}

function renderAvailableContacts(contacts) {
  const container = document.getElementById('available-contacts');
  if (!container) return;
  container.innerHTML = '';

  contacts.forEach(contact => {
    const div = document.createElement('div');
    div.className = 'flex items-center p-2 hover:bg-gray-50 rounded cursor-pointer';
    div.innerHTML = `
      <input type="checkbox" id="contact-${contact.phoneNumber}" class="contact-checkbox mr-3 h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded" value="${contact.phoneNumber}">
      <label for="contact-${contact.phoneNumber}" class="flex-grow cursor-pointer">
        <div class="text-sm font-medium text-gray-900">${contact.name || contact.phoneNumber}</div>
        <div class="text-xs text-gray-500">${contact.phoneNumber}</div>
      </label>
    `;
    div.querySelector('input').addEventListener('change', function () {
      if (this.checked) addContactToCampaign(contact.phoneNumber, contact.name || contact.phoneNumber);
      else removeContactFromCampaign(contact.phoneNumber);
    });
    container.appendChild(div);
  });
}

function addContactToCampaign(phoneNumber, name) {
  const selectedDiv = document.getElementById('selected-contacts');
  const noMsg = document.getElementById('no-contacts-message');
  if (document.querySelector(`[data-phone="${phoneNumber}"]`)) return;

  if (noMsg) noMsg.remove();

  const div = document.createElement('div');
  div.className = 'flex justify-between items-center p-2 bg-indigo-50 rounded mb-1';
  div.dataset.phone = phoneNumber;
  div.innerHTML = `
    <span class="text-sm text-indigo-900">${name}</span>
    <button onclick="removeContactFromCampaign('${phoneNumber}')" class="text-indigo-400 hover:text-indigo-600"><i class="fas fa-times"></i></button>
  `;
  selectedDiv.appendChild(div);

  // Sync checkbox
  const checkbox = document.getElementById(`contact-${phoneNumber}`);
  if (checkbox) checkbox.checked = true;
}

function removeContactFromCampaign(phoneNumber) {
  const div = document.querySelector(`[data-phone="${phoneNumber}"]`);
  if (div) div.remove();

  const selectedDiv = document.getElementById('selected-contacts');
  if (selectedDiv.children.length === 0) {
    selectedDiv.innerHTML = '<p class="text-gray-400 text-sm text-center mt-4" id="no-contacts-message">Ningún contacto seleccionado</p>';
  }

  // Sync checkbox
  const checkbox = document.getElementById(`contact-${phoneNumber}`);
  if (checkbox) checkbox.checked = false;
}

async function createCampaign() {
  const form = document.getElementById('campaign-form');
  const formData = new FormData(form);
  const selectedContacts = Array.from(document.querySelectorAll('#selected-contacts [data-phone]')).map(el => el.dataset.phone);

  if (selectedContacts.length === 0) {
    alert('Por favor selecciona al menos un contacto');
    return;
  }

  const data = {
    name: formData.get('name'),
    message: formData.get('message'),
    scheduledAt: formData.get('scheduledAt') || null,
    contacts: selectedContacts
  };

  try {
    const response = await fetch('/crm/campaigns', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    });

    if (!response.ok) throw new Error('Failed to create campaign');

    alert('Campaña creada exitosamente');
    showSection('campaigns');
  } catch (error) {
    console.error('Error creating campaign:', error);
    alert('Error al crear campaña');
  }
}

// --- Template Functions ---

async function loadTemplates() {
  try {
    const response = await fetch('/crm/templates', {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    });
    if (!response.ok) throw new Error('Failed to load templates');
    templates = await response.json();
    renderTemplates(templates);
  } catch (error) {
    console.error('Error loading templates:', error);
  }
}

function renderTemplates(templates) {
  const container = document.getElementById('templates-container');
  if (!container) return;
  container.innerHTML = '';

  if (templates.length === 0) {
    container.innerHTML = '<div class="col-span-full text-center py-8 text-gray-500">No hay plantillas</div>';
    return;
  }

  templates.forEach(template => {
    const div = document.createElement('div');
    div.className = 'bg-white border border-gray-200 rounded-lg overflow-hidden hover:shadow-md transition-shadow';
    div.innerHTML = `
      <div class="p-4 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
        <h3 class="font-medium text-gray-800">${template.name}</h3>
        <div class="flex space-x-2">
          <button onclick="openEditTemplateModal('${template._id}')" class="text-blue-600 hover:text-blue-800"><i class="fas fa-edit"></i></button>
          <button onclick="deleteTemplate('${template._id}')" class="text-red-600 hover:text-red-800"><i class="fas fa-trash"></i></button>
        </div>
      </div>
      <div class="p-4">
        <p class="text-sm text-gray-600 whitespace-pre-line mb-4">${template.content}</p>
        <button onclick="useTemplate('${template._id}')" class="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 py-2 rounded text-sm font-medium transition-colors">Usar Plantilla</button>
      </div>
    `;
    container.appendChild(div);
  });
}

// --- Product Functions ---

async function loadProducts() {
  try {
    const response = await fetch('/crm/products', {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    });
    if (!response.ok) throw new Error('Failed to load products');
    allProducts = await response.json();
    renderProducts(allProducts);
  } catch (error) {
    console.error('Error loading products:', error);
  }
}

function renderProducts(products) {
  const tbody = document.getElementById('products-table-body');
  if (!tbody) return;
  tbody.innerHTML = '';

  if (products.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="px-6 py-8 text-sm text-gray-500 text-center">No hay productos</td></tr>`;
    return;
  }

  products.forEach(product => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="px-6 py-4 whitespace-nowrap">
        <div class="text-sm font-medium text-gray-900">${product.name}</div>
        <div class="text-xs text-gray-500">${product.description || ''}</div>
      </td>
      <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">$${product.price}</td>
      <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${product.category || '-'}</td>
      <td class="px-6 py-4 whitespace-nowrap">
        <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${product.inStock ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}">
          ${product.inStock ? 'En Stock' : 'Agotado'}
        </span>
      </td>
      <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
        <button onclick="openEditProductModal('${product._id}')" class="text-indigo-600 hover:text-indigo-900 mr-3"><i class="fas fa-edit"></i></button>
        <button onclick="deleteProduct('${product._id}')" class="text-red-600 hover:text-red-900"><i class="fas fa-trash"></i></button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

window.openCreateProductModal = function () {
  currentProductId = null;
  document.getElementById('product-modal-title').textContent = 'Nuevo Producto';
  document.getElementById('product-id').value = '';
  document.getElementById('product-name').value = '';
  document.getElementById('product-description').value = '';
  document.getElementById('product-price').value = '';
  document.getElementById('product-category').value = '';
  document.getElementById('product-sizes').value = '';
  document.getElementById('product-promotions').value = '';
  document.getElementById('product-image-url').value = '';
  document.getElementById('product-in-stock').checked = true;
  document.getElementById('product-modal').classList.remove('hidden');
};

window.openEditProductModal = function (id) {
  const product = allProducts.find(p => p._id === id);
  if (!product) return;
  currentProductId = id;
  document.getElementById('product-modal-title').textContent = 'Editar Producto';
  document.getElementById('product-id').value = product._id;
  document.getElementById('product-name').value = product.name;
  document.getElementById('product-description').value = product.description || '';
  document.getElementById('product-price').value = product.price;
  document.getElementById('product-category').value = product.category || '';
  document.getElementById('product-sizes').value = (product.sizes || []).join(', ');
  document.getElementById('product-promotions').value = product.promotions || '';
  document.getElementById('product-image-url').value = product.imageUrl || '';
  document.getElementById('product-in-stock').checked = product.inStock;
  document.getElementById('product-modal').classList.remove('hidden');
};

window.closeProductModal = function () {
  document.getElementById('product-modal').classList.add('hidden');
  currentProductId = null;
};

window.saveProduct = async function () {
  const name = document.getElementById('product-name').value;
  const price = document.getElementById('product-price').value;

  if (!name || !price) {
    alert('Nombre y precio son requeridos');
    return;
  }

  const data = {
    name,
    description: document.getElementById('product-description').value,
    price: Number(price),
    category: document.getElementById('product-category').value,
    sizes: document.getElementById('product-sizes').value.split(',').map(s => s.trim()).filter(s => s),
    promotions: document.getElementById('product-promotions').value,
    imageUrl: document.getElementById('product-image-url').value,
    inStock: document.getElementById('product-in-stock').checked
  };

  try {
    const url = currentProductId ? `/crm/products/${currentProductId}` : '/crm/products';
    const method = currentProductId ? 'PUT' : 'POST';

    const response = await fetch(url, {
      method,
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    });

    if (!response.ok) throw new Error('Failed to save product');

    closeProductModal();
    loadProducts();
    alert('Producto guardado correctamente');
  } catch (error) {
    console.error('Error saving product:', error);
    alert('Error al guardar producto');
  }
};

window.deleteProduct = async function (id) {
  if (!confirm('¿Estás seguro de eliminar este producto?')) return;
  try {
    const response = await fetch(`/crm/products/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    });
    if (!response.ok) throw new Error('Failed to delete product');
    loadProducts();
    alert('Producto eliminado');
  } catch (error) {
    console.error('Error deleting product:', error);
    alert('Error al eliminar producto');
  }
};

// --- Helper Functions ---

function formatDate(dateString) {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// --- Chat & Other Modals (Simplified for brevity, assuming existence) ---
window.openChatModal = function (phone, name) {
  currentChatPhoneNumber = phone;
  currentChatContactName = name;
  document.getElementById('chat-contact-name').textContent = name;
  document.getElementById('chat-contact-phone').textContent = phone;
  document.getElementById('chat-modal').classList.remove('hidden');
  loadChatMessages();
};

window.closeChatModal = function () {
  document.getElementById('chat-modal').classList.add('hidden');
  currentChatPhoneNumber = null;
};

async function loadChatMessages() {
  if (!currentChatPhoneNumber) return;
  
  const container = document.getElementById('messages-container');
  if (container) {
    container.innerHTML = '<div class="flex justify-center items-center h-full"><i class="fas fa-spinner fa-spin text-gray-400 text-2xl"></i></div>';
  }
  
  try {
    // Agregar timestamp para evitar cache del navegador
    const cacheBuster = `_t=${Date.now()}`;
    const response = await fetch(`/crm/contacts/${currentChatPhoneNumber}/messages?${cacheBuster}`, {
      headers: { 
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
        'Cache-Control': 'no-cache'
      }
    });
    
    if (!response.ok) throw new Error('Failed to load messages');
    
    const data = await response.json();
    chatMessages = data.messages || [];
    renderChatMessages();
  } catch (e) { 
    console.error('Error loading messages:', e);
    if (container) {
      container.innerHTML = '<div class="flex justify-center items-center h-full text-red-500"><i class="fas fa-exclamation-triangle mr-2"></i>Error al cargar mensajes</div>';
    }
  }
}

function renderChatMessages() {
  const container = document.getElementById('messages-container');
  if (!container) return;
  
  container.innerHTML = '';
  
  if (!chatMessages || chatMessages.length === 0) {
    container.innerHTML = '<div class="flex justify-center items-center h-full text-gray-400">No hay mensajes aún</div>';
    return;
  }
  
  chatMessages.forEach(msg => {
    if (!msg) return;
    const div = document.createElement('div');
    const isFromBot = msg.isFromBot === true;
    div.className = `flex ${isFromBot ? 'justify-end' : 'justify-start'} mb-2`;
    
    // Escapar HTML para evitar XSS
    const safeBody = (msg.body || '').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>');
    const timestamp = msg.timestamp ? formatDate(msg.timestamp) : '';
    
    div.innerHTML = `
      <div class="max-w-[70%] px-4 py-2 rounded-lg shadow-sm ${isFromBot ? 'bg-indigo-100 text-gray-800' : 'bg-white text-gray-800'}">
        <p class="text-sm whitespace-pre-wrap">${safeBody}</p>
        ${timestamp ? `<p class="text-xs text-gray-400 mt-1">${timestamp}</p>` : ''}
      </div>
    `;
    container.appendChild(div);
  });
  
  container.scrollTop = container.scrollHeight;
}

window.sendChatMessage = async function () {
  const input = document.getElementById('chat-message-input');
  const sendBtn = document.querySelector('#chat-modal button[onclick="sendChatMessage()"]');
  const msg = input.value.trim();
  
  if (!msg || !currentChatPhoneNumber) return;

  // Deshabilitar botón y mostrar spinner
  if (sendBtn) {
    sendBtn.disabled = true;
    sendBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
  }

  try {
    const response = await fetch('/crm/send-message', {
      method: 'POST',
      headers: { 
        'Authorization': `Bearer ${localStorage.getItem('token')}`, 
        'Content-Type': 'application/json' 
      },
      body: JSON.stringify({ phoneNumber: currentChatPhoneNumber, message: msg })
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Error al enviar');
    }
    
    input.value = '';
    
    // Agregar mensaje localmente para feedback inmediato
    chatMessages.push({
      body: msg,
      isFromBot: true,
      timestamp: new Date().toISOString()
    });
    renderChatMessages();
    
    // Recargar después de un momento para sincronizar
    setTimeout(loadChatMessages, 1000);
    
  } catch (e) { 
    console.error('Error sending message:', e);
    alert('Error al enviar mensaje: ' + e.message); 
  } finally {
    // Restaurar botón
    if (sendBtn) {
      sendBtn.disabled = false;
      sendBtn.innerHTML = '<i class="fas fa-paper-plane"></i>';
    }
  }
};

// --- Notifications (Simplified) ---
async function loadNotifications() {
  // Implementation for loading notifications
}
function startNotificationStream() {
  // Implementation for SSE
}

// --- Bot Config & WhatsApp Functions ---
let currentBotConfig = null;

async function loadBotConfig() {
  try {
    const response = await fetch('/crm/bot-config', {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    });
    if (!response.ok) throw new Error('Failed to load bot config');
    const config = await response.json();
    currentBotConfig = config;
    
    // Configuración general
    setInputValue('bot-name-input', config.botName);
    setInputValue('bot-emoji-input', config.botEmoji);
    setInputValue('bot-delay-input', config.botDelay || 10000);
    
    // Información del negocio
    setInputValue('business-name-input', config.businessName);
    setInputValue('business-description-input', config.businessDescription);
    setInputValue('business-phone-input', config.businessPhone);
    setInputValue('business-email-input', config.businessEmail);
    setInputValue('business-address-input', config.businessAddress);
    setInputValue('business-website-input', config.businessWebsite);
    setInputValue('business-hours-input', config.businessHours);
    
    // Redes sociales
    setInputValue('social-facebook-input', config.socialFacebook);
    setInputValue('social-instagram-input', config.socialInstagram);
    setInputValue('social-tiktok-input', config.socialTiktok);
    
    // Configuración de pagos
    setInputValue('bank-info-input', config.bankInfo);
    setInputValue('paypal-email-input', config.paypalEmail);
    
    // Mensajes personalizados
    setInputValue('welcome-message-input', config.welcomeMessage);
    setInputValue('pause-message-input', config.pauseMessage);
    
    // IA
    setInputValue('ai-system-prompt-input', config.aiSystemPrompt);
    setInputValue('ai-model-input', config.aiModel);
    
    // Configuración de vendedor
    setInputValue('seller-personality-input', config.sellerPersonality || 'experto');
    setInputValue('max-discount-input', config.maxDiscountPercent || 10);
    setInputValue('discount-conditions-input', config.discountConditions);
    
    // Radio buttons de descuentos
    const discountsYes = document.getElementById('discounts-yes');
    const discountsNo = document.getElementById('discounts-no');
    if (discountsYes && discountsNo) {
      if (config.canOfferDiscounts) {
        discountsYes.checked = true;
        discountsNo.checked = false;
      } else {
        discountsYes.checked = false;
        discountsNo.checked = true;
      }
      updateDiscountVisibility();
    }
    
    const delayText = document.getElementById('current-delay-text');
    if (delayText) delayText.textContent = `Actual: ${(config.botDelay || 10000) / 1000}s`;
    
  } catch (error) {
    console.error('Error loading bot config:', error);
  }
}

// Mostrar/ocultar opciones de descuento
function updateDiscountVisibility() {
  const canOfferDiscounts = document.getElementById('discounts-yes')?.checked || false;
  const discountOptions = document.getElementById('discount-options');
  const discountConditions = document.getElementById('discount-conditions-container');
  
  if (canOfferDiscounts) {
    discountOptions?.classList.remove('hidden');
    discountConditions?.classList.remove('hidden');
  } else {
    discountOptions?.classList.add('hidden');
    discountConditions?.classList.add('hidden');
  }
}

// Event listeners para radio buttons de descuentos
document.addEventListener('DOMContentLoaded', function() {
  const discountsYes = document.getElementById('discounts-yes');
  const discountsNo = document.getElementById('discounts-no');
  
  if (discountsYes) discountsYes.addEventListener('change', updateDiscountVisibility);
  if (discountsNo) discountsNo.addEventListener('change', updateDiscountVisibility);
});

function setInputValue(id, value) {
  const el = document.getElementById(id);
  if (el) el.value = value || '';
}

function getInputValue(id) {
  const el = document.getElementById(id);
  return el ? el.value : '';
}

window.saveBotConfig = async function() {
  const config = {
    // Configuración general
    botName: getInputValue('bot-name-input'),
    botEmoji: getInputValue('bot-emoji-input'),
    botDelay: parseInt(getInputValue('bot-delay-input')) || 10000,
    
    // Información del negocio
    businessName: getInputValue('business-name-input'),
    businessDescription: getInputValue('business-description-input'),
    businessPhone: getInputValue('business-phone-input'),
    businessEmail: getInputValue('business-email-input'),
    businessAddress: getInputValue('business-address-input'),
    businessWebsite: getInputValue('business-website-input'),
    businessHours: getInputValue('business-hours-input'),
    
    // Redes sociales
    socialFacebook: getInputValue('social-facebook-input'),
    socialInstagram: getInputValue('social-instagram-input'),
    socialTiktok: getInputValue('social-tiktok-input'),
    
    // Configuración de pagos
    bankInfo: getInputValue('bank-info-input'),
    paypalEmail: getInputValue('paypal-email-input'),
    
    // Mensajes personalizados
    welcomeMessage: getInputValue('welcome-message-input'),
    pauseMessage: getInputValue('pause-message-input'),
    
    // IA
    aiSystemPrompt: getInputValue('ai-system-prompt-input'),
    aiModel: getInputValue('ai-model-input'),
    
    // Configuración de vendedor
    sellerPersonality: getInputValue('seller-personality-input'),
    canOfferDiscounts: document.getElementById('discounts-yes')?.checked || false,
    maxDiscountPercent: parseInt(getInputValue('max-discount-input')) || 10,
    discountConditions: getInputValue('discount-conditions-input')
  };
  
  try {
    const response = await fetch('/crm/bot-config', {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(config)
    });
    
    if (!response.ok) throw new Error('Failed to save bot config');
    
    const delayText = document.getElementById('current-delay-text');
    if (delayText) delayText.textContent = `Actual: ${config.botDelay / 1000}s`;
    
    currentBotConfig = config;
    alert('Configuración guardada correctamente');
  } catch (error) {
    console.error('Error saving bot config:', error);
    alert('Error al guardar configuración');
  }
};

// --- Bot Content Functions ---
let allBotContent = [];

async function loadBotContent() {
  try {
    const response = await fetch('/crm/bot-content', {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    });
    if (!response.ok) throw new Error('Failed to load bot content');
    allBotContent = await response.json();
    renderBotContent(allBotContent);
  } catch (error) {
    console.error('Error loading bot content:', error);
  }
}

function renderBotContent(contents) {
  const container = document.getElementById('bot-content-container');
  if (!container) return;
  container.innerHTML = '';
  
  if (contents.length === 0) {
    container.innerHTML = `
      <div class="col-span-full text-center py-8">
        <p class="text-gray-500 mb-4">No hay contenido configurado</p>
        <button onclick="initDefaultBotContent()" class="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium">
          Inicializar contenido predeterminado
        </button>
      </div>`;
    return;
  }
  
  const categoryLabels = {
    'quick_response': 'Respuesta Rápida',
    'command': 'Comando',
    'other': 'Otro'
  };
  
  contents.forEach(content => {
    const div = document.createElement('div');
    div.className = 'bg-white border border-gray-200 rounded-lg overflow-hidden hover:shadow-md transition-shadow';
    div.innerHTML = `
      <div class="p-4 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
        <div>
          <h3 class="font-medium text-gray-800">${content.key}</h3>
          <span class="text-xs text-gray-500">${categoryLabels[content.category] || content.category}</span>
        </div>
        <div class="flex space-x-2">
          <button onclick="openEditBotContentModal('${content.key}')" class="text-blue-600 hover:text-blue-800"><i class="fas fa-edit"></i></button>
          <button onclick="deleteBotContent('${content.key}')" class="text-red-600 hover:text-red-800"><i class="fas fa-trash"></i></button>
        </div>
      </div>
      <div class="p-4">
        <p class="text-sm text-gray-600 mb-2">${content.description || 'Sin descripción'}</p>
        <pre class="text-xs text-gray-500 bg-gray-50 p-2 rounded max-h-32 overflow-auto whitespace-pre-wrap">${content.content.substring(0, 200)}${content.content.length > 200 ? '...' : ''}</pre>
      </div>
    `;
    container.appendChild(div);
  });
}

window.initDefaultBotContent = async function() {
  if (!confirm('¿Inicializar contenido predeterminado del bot?')) return;
  
  try {
    const response = await fetch('/crm/bot-content/init-defaults', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    });
    
    if (!response.ok) throw new Error('Failed to init defaults');
    const result = await response.json();
    alert(result.message);
    loadBotContent();
  } catch (error) {
    console.error('Error:', error);
    alert('Error al inicializar contenido');
  }
};

window.openCreateBotContentModal = function() {
  document.getElementById('bot-content-modal-title').textContent = 'Nuevo Contenido';
  document.getElementById('bot-content-key-input').value = '';
  document.getElementById('bot-content-key-input').disabled = false;
  document.getElementById('bot-content-description-input').value = '';
  document.getElementById('bot-content-category-input').value = 'quick_response';
  document.getElementById('bot-content-text-input').value = '';
  document.getElementById('bot-content-media-input').value = '';
  document.getElementById('bot-content-modal').classList.remove('hidden');
};

window.openEditBotContentModal = function(key) {
  const content = allBotContent.find(c => c.key === key);
  if (!content) return;
  
  document.getElementById('bot-content-modal-title').textContent = 'Editar Contenido';
  document.getElementById('bot-content-key-input').value = content.key;
  document.getElementById('bot-content-key-input').disabled = true;
  document.getElementById('bot-content-description-input').value = content.description || '';
  document.getElementById('bot-content-category-input').value = content.category || 'other';
  document.getElementById('bot-content-text-input').value = content.content;
  document.getElementById('bot-content-media-input').value = content.mediaPath || '';
  document.getElementById('bot-content-modal').classList.remove('hidden');
};

window.closeBotContentModal = function() {
  document.getElementById('bot-content-modal').classList.add('hidden');
};

window.saveBotContent = async function() {
  const key = document.getElementById('bot-content-key-input').value;
  const isNew = !document.getElementById('bot-content-key-input').disabled;
  
  const data = {
    key,
    content: document.getElementById('bot-content-text-input').value,
    description: document.getElementById('bot-content-description-input').value,
    category: document.getElementById('bot-content-category-input').value,
    mediaPath: document.getElementById('bot-content-media-input').value
  };
  
  if (!data.key || !data.content) {
    alert('La clave y el contenido son requeridos');
    return;
  }
  
  try {
    const url = isNew ? '/crm/bot-content' : `/crm/bot-content/${key}`;
    const method = isNew ? 'POST' : 'PUT';
    
    const response = await fetch(url, {
      method,
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    });
    
    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'Failed to save');
    }
    
    closeBotContentModal();
    loadBotContent();
    alert('Contenido guardado correctamente');
  } catch (error) {
    console.error('Error:', error);
    alert('Error: ' + error.message);
  }
};

window.deleteBotContent = async function(key) {
  if (!confirm('¿Eliminar este contenido?')) return;
  
  try {
    const response = await fetch(`/crm/bot-content/${key}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    });
    
    if (!response.ok) throw new Error('Failed to delete');
    loadBotContent();
    alert('Contenido eliminado');
  } catch (error) {
    console.error('Error:', error);
    alert('Error al eliminar');
  }
};

async function loadWhatsAppStatus() {
  const statusEl = document.getElementById('whatsapp-connected-status');
  const qrDisplay = document.getElementById('qr-display');
  const qrContainer = document.getElementById('qr-code-container');
  
  try {
    const response = await fetch('/health');
    if (!response.ok) throw new Error('Failed to check status');
    const data = await response.json();
    
    if (data.clientReady && data.qrScanned) {
      if (statusEl) {
        statusEl.innerHTML = `<span class="text-green-600 font-medium">✅ Conectado</span>`;
        if (data.botContact) {
          statusEl.innerHTML += ` - ${data.botPushName || ''} (${data.botContact})`;
        }
      }
      if (qrDisplay) qrDisplay.classList.add('hidden');
    } else {
      if (statusEl) statusEl.innerHTML = `<span class="text-yellow-600 font-medium">⏳ Esperando conexión...</span>`;
      // Mostrar QR si está disponible
      await loadQRCode();
    }
  } catch (error) {
    console.error('Error loading WhatsApp status:', error);
    if (statusEl) statusEl.innerHTML = `<span class="text-red-600 font-medium">❌ Error al verificar estado</span>`;
  }
}

async function loadQRCode() {
  const qrDisplay = document.getElementById('qr-display');
  const qrContainer = document.getElementById('qr-code-container');
  
  try {
    const response = await fetch('/qr');
    if (!response.ok) {
      if (qrDisplay) qrDisplay.classList.add('hidden');
      return;
    }
    const data = await response.json();
    
    if (data.qr && !data.qrScanned) {
      if (qrDisplay) qrDisplay.classList.remove('hidden');
      if (qrContainer) {
        qrContainer.innerHTML = `<img src="data:image/png;base64,${data.qr}" alt="QR Code" class="w-64 h-64">`;
      }
      // Refrescar QR cada 20 segundos
      setTimeout(loadQRCode, 20000);
    } else if (data.qrScanned) {
      if (qrDisplay) qrDisplay.classList.add('hidden');
      loadWhatsAppStatus();
    }
  } catch (error) {
    console.error('Error loading QR code:', error);
  }
}

window.logoutWhatsApp = async function() {
  if (!confirm('¿Estás seguro de que deseas desvincular WhatsApp? Tendrás que escanear el QR nuevamente.')) {
    return;
  }
  
  const statusEl = document.getElementById('whatsapp-connected-status');
  if (statusEl) statusEl.innerHTML = `<span class="text-yellow-600 font-medium">⏳ Desvinculando...</span>`;
  
  try {
    const response = await fetch('/crm/whatsapp/logout', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    });
    
    if (!response.ok) throw new Error('Failed to logout');
    
    alert('WhatsApp desvinculado correctamente. Escanea el nuevo código QR para reconectar.');
    
    // Esperar un momento y recargar el estado
    setTimeout(() => {
      loadWhatsAppStatus();
    }, 2000);
    
  } catch (error) {
    console.error('Error logging out WhatsApp:', error);
    alert('Error al desvincular WhatsApp');
    loadWhatsAppStatus();
  }
};

// Despausar todos los contactos
window.unpauseAllContacts = async function() {
  if (!confirm('¿Estás seguro de que deseas despausar TODOS los contactos? El bot volverá a responder a todos.')) {
    return;
  }
  
  try {
    const response = await fetch('/crm/contacts/unpause-all', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    });
    
    if (!response.ok) throw new Error('Failed to unpause contacts');
    
    const result = await response.json();
    alert(result.message || 'Contactos despausados correctamente');
    
  } catch (error) {
    console.error('Error unpausing all contacts:', error);
    alert('Error al despausar contactos');
  }
};

// --- Password Functions ---
window.changePassword = async function() {
  const currentPassword = document.getElementById('current-password-input').value;
  const newPassword = document.getElementById('new-password-input').value;
  const confirmPassword = document.getElementById('confirm-password-input').value;
  
  if (!currentPassword || !newPassword || !confirmPassword) {
    alert('Por favor completa todos los campos');
    return;
  }
  
  if (newPassword !== confirmPassword) {
    alert('Las contraseñas no coinciden');
    return;
  }
  
  if (newPassword.length < 6) {
    alert('La contraseña debe tener al menos 6 caracteres');
    return;
  }
  
  try {
    const response = await fetch('/crm/auth/change-password', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ currentPassword, newPassword })
    });
    
    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || 'Failed to change password');
    }
    
    alert('Contraseña actualizada correctamente');
    document.getElementById('current-password-input').value = '';
    document.getElementById('new-password-input').value = '';
    document.getElementById('confirm-password-input').value = '';
  } catch (error) {
    console.error('Error changing password:', error);
    alert('Error al cambiar contraseña: ' + error.message);
  }
};

// --- Status Modal Functions ---
window.openStatusModal = function(phoneNumber, currentStatus, appointmentDate) {
  currentStatusPhone = phoneNumber;
  document.getElementById('status-select').value = currentStatus || 'lead';
  document.getElementById('appointment-date').value = appointmentDate ? appointmentDate.substring(0, 16) : '';
  document.getElementById('status-notes').value = '';
  document.getElementById('status-modal').classList.remove('hidden');
};

window.closeStatusModal = function() {
  document.getElementById('status-modal').classList.add('hidden');
  currentStatusPhone = null;
};

window.saveStatusChange = async function() {
  if (!currentStatusPhone) return;
  
  const saleStatus = document.getElementById('status-select').value;
  const appointmentDate = document.getElementById('appointment-date').value;
  const saleStatusNotes = document.getElementById('status-notes').value;
  
  try {
    const response = await fetch(`/crm/contacts/${currentStatusPhone}/status`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ saleStatus, appointmentDate, saleStatusNotes })
    });
    
    if (!response.ok) throw new Error('Failed to update status');
    
    closeStatusModal();
    loadContacts();
    alert('Estado actualizado correctamente');
  } catch (error) {
    console.error('Error updating status:', error);
    alert('Error al actualizar estado');
  }
};

// --- Pause/Unpause Contact ---
window.togglePauseContact = async function(phoneNumber, isPaused) {
  const action = isPaused ? 'reanudar' : 'pausar';
  if (!confirm(`¿Estás seguro de que deseas ${action} este contacto?`)) return;
  
  try {
    const response = await fetch(`/crm/contacts/${phoneNumber}/pause`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ isPaused: !isPaused })
    });
    
    if (!response.ok) throw new Error('Failed to toggle pause');
    
    loadContacts();
    alert(`Contacto ${isPaused ? 'reanudado' : 'pausado'} correctamente`);
  } catch (error) {
    console.error('Error toggling pause:', error);
    alert('Error al cambiar estado de pausa');
  }
};

window.pauseBotFromChat = async function(phoneNumber) {
  if (!phoneNumber) return;
  await togglePauseContact(phoneNumber, false);
};

// --- User Management Functions ---
async function loadUsers() {
  try {
    const response = await fetch('/crm/auth/users', {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    });
    if (!response.ok) throw new Error('Failed to load users');
    const data = await response.json();
    renderUsers(data.users);
  } catch (error) {
    console.error('Error loading users:', error);
  }
}

function renderUsers(users) {
  const tbody = document.getElementById('users-table-body');
  if (!tbody) return;
  tbody.innerHTML = '';
  
  if (!users || users.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" class="px-6 py-8 text-sm text-gray-500 text-center">No hay usuarios</td></tr>`;
    return;
  }
  
  users.forEach(user => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${user.username}</td>
      <td class="px-6 py-4 whitespace-nowrap">
        <span class="px-2 py-1 text-xs font-semibold rounded-full ${user.role === 'admin' ? 'bg-purple-100 text-purple-800' : 'bg-gray-100 text-gray-800'}">
          ${user.role === 'admin' ? 'Administrador' : 'Usuario'}
        </span>
      </td>
      <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${formatDate(user.createdAt)}</td>
      <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
        <button onclick="changeUserPassword('${user._id}')" class="text-indigo-600 hover:text-indigo-900 mr-3" title="Cambiar contraseña">
          <i class="fas fa-key"></i>
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

window.openCreateUserModal = function() {
  document.getElementById('create-username-input').value = '';
  document.getElementById('create-password-input').value = '';
  document.getElementById('create-role-select').value = 'user';
  document.getElementById('create-user-modal').classList.remove('hidden');
};

window.closeCreateUserModal = function() {
  document.getElementById('create-user-modal').classList.add('hidden');
};

window.saveCreateUser = async function() {
  const username = document.getElementById('create-username-input').value;
  const password = document.getElementById('create-password-input').value;
  const role = document.getElementById('create-role-select').value;
  
  if (!username || !password) {
    alert('Por favor completa todos los campos');
    return;
  }
  
  try {
    const response = await fetch('/crm/auth/register', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ username, password, role })
    });
    
    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || 'Failed to create user');
    }
    
    closeCreateUserModal();
    loadUsers();
    alert('Usuario creado correctamente');
  } catch (error) {
    console.error('Error creating user:', error);
    alert('Error al crear usuario: ' + error.message);
  }
};

window.changeUserPassword = async function(userId) {
  const newPassword = prompt('Ingresa la nueva contraseña (mínimo 6 caracteres):');
  if (!newPassword) return;
  
  if (newPassword.length < 6) {
    alert('La contraseña debe tener al menos 6 caracteres');
    return;
  }
  
  try {
    const response = await fetch(`/crm/auth/change-password/${userId}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ newPassword })
    });
    
    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || 'Failed to change password');
    }
    
    alert('Contraseña actualizada correctamente');
  } catch (error) {
    console.error('Error changing password:', error);
    alert('Error al cambiar contraseña: ' + error.message);
  }
};

// --- Template Functions ---
window.openCreateTemplateModal = function() {
  currentTemplateId = null;
  document.getElementById('template-modal-title').textContent = 'Nueva Plantilla';
  document.getElementById('template-name').value = '';
  document.getElementById('template-content').value = '';
  document.getElementById('template-modal').classList.remove('hidden');
};

window.openEditTemplateModal = function(id) {
  const template = templates.find(t => t._id === id);
  if (!template) return;
  currentTemplateId = id;
  document.getElementById('template-modal-title').textContent = 'Editar Plantilla';
  document.getElementById('template-name').value = template.name;
  document.getElementById('template-content').value = template.content;
  document.getElementById('template-modal').classList.remove('hidden');
};

window.closeTemplateModal = function() {
  document.getElementById('template-modal').classList.add('hidden');
  currentTemplateId = null;
};

window.saveTemplate = async function() {
  const name = document.getElementById('template-name').value;
  const content = document.getElementById('template-content').value;
  
  if (!name || !content) {
    alert('Por favor completa todos los campos');
    return;
  }
  
  try {
    const url = currentTemplateId ? `/crm/templates/${currentTemplateId}` : '/crm/templates';
    const method = currentTemplateId ? 'PUT' : 'POST';
    
    const response = await fetch(url, {
      method,
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ name, content })
    });
    
    if (!response.ok) throw new Error('Failed to save template');
    
    closeTemplateModal();
    loadTemplates();
    alert('Plantilla guardada correctamente');
  } catch (error) {
    console.error('Error saving template:', error);
    alert('Error al guardar plantilla');
  }
};

window.deleteTemplate = async function(id) {
  if (!confirm('¿Estás seguro de eliminar esta plantilla?')) return;
  
  try {
    const response = await fetch(`/crm/templates/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    });
    
    if (!response.ok) throw new Error('Failed to delete template');
    
    loadTemplates();
    alert('Plantilla eliminada');
  } catch (error) {
    console.error('Error deleting template:', error);
    alert('Error al eliminar plantilla');
  }
};

window.useTemplate = function(id) {
  const template = templates.find(t => t._id === id);
  if (!template) return;
  
  // Si hay un modal de chat abierto, insertar el template
  const chatInput = document.getElementById('chat-message-input');
  if (chatInput && !document.getElementById('chat-modal').classList.contains('hidden')) {
    chatInput.value = template.content;
    chatInput.focus();
  } else {
    // Copiar al portapapeles
    navigator.clipboard.writeText(template.content).then(() => {
      alert('Plantilla copiada al portapapeles');
    });
  }
};

// --- README Functions ---
async function loadReadmeContent() {
  const contentContainer = document.getElementById('readme-content');
  if (!contentContainer) return;

  try {
    const response = await fetch('/public/README.md');
    if (!response.ok) throw new Error('Failed to load README');
    
    const markdown = await response.text();
    // Convert markdown to HTML (simple conversion)
    const html = convertMarkdownToHTML(markdown);
    contentContainer.innerHTML = html;
  } catch (error) {
    console.error('Error loading README:', error);
    contentContainer.innerHTML = `
      <div class="text-center py-12">
        <i class="fas fa-exclamation-triangle text-4xl mb-4" style="color: var(--primary);"></i>
        <p style="color: var(--text-secondary);">Error al cargar la guía. Por favor, intenta abrirla en una nueva pestaña.</p>
        <a href="/public/README.md" target="_blank" class="btn-primary mt-4 inline-block">
          <i class="fas fa-external-link-alt mr-2"></i>Abrir en Nueva Pestaña
        </a>
      </div>
    `;
  }
}

function convertMarkdownToHTML(markdown) {
  // Split into lines for better processing
  const lines = markdown.split('\n');
  let html = '';
  let inList = false;
  let inCodeBlock = false;
  let codeBlockContent = '';
  let inTable = false;
  let isTableHeader = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Code blocks
    if (line.startsWith('```')) {
      if (inCodeBlock) {
        // Close table if open
        if (inTable) {
          html += '</tbody></table></div>';
          inTable = false;
          isTableHeader = false;
        }
        // Close list if open
        if (inList) {
          html += '</ul>';
          inList = false;
        }
        // Render code block with dark background and light text
        const codeLines = codeBlockContent.trim().split('\n').map(l => escapeHtml(l)).join('<br>');
        html += `<pre class="p-4 rounded-lg overflow-x-auto my-4" style="background: #1f2937; color: #f9fafb; border: 1px solid #374151; font-family: 'Courier New', monospace; font-size: 0.875rem; line-height: 1.6;"><code style="color: #f9fafb;">${codeLines}</code></pre>`;
        codeBlockContent = '';
        inCodeBlock = false;
      } else {
        if (inList) {
          html += '</ul>';
          inList = false;
        }
        if (inTable) {
          html += '</tbody></table></div>';
          inTable = false;
          isTableHeader = false;
        }
        inCodeBlock = true;
      }
      continue;
    }
    
    if (inCodeBlock) {
      codeBlockContent += line + '\n';
      continue;
    }
    
    // Headers with ID support
    if (line.startsWith('### ')) {
      if (inList) { html += '</ul>'; inList = false; }
      const headerText = line.substring(4);
      const idMatch = headerText.match(/\{#([^}]+)\}/);
      const id = idMatch ? idMatch[1] : null;
      const cleanText = idMatch ? headerText.replace(/\{#([^}]+)\}/, '').trim() : headerText;
      const headerId = id || cleanText.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      html += `<h3 id="${headerId}" class="text-xl font-bold mt-6 mb-3" style="color: var(--primary); scroll-margin-top: 2rem;">${escapeHtml(cleanText)}</h3>`;
      continue;
    }
    if (line.startsWith('## ')) {
      if (inList) { html += '</ul>'; inList = false; }
      const headerText = line.substring(3);
      const idMatch = headerText.match(/\{#([^}]+)\}/);
      const id = idMatch ? idMatch[1] : null;
      const cleanText = idMatch ? headerText.replace(/\{#([^}]+)\}/, '').trim() : headerText;
      const headerId = id || cleanText.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      html += `<h2 id="${headerId}" class="text-2xl font-bold mt-8 mb-4" style="color: var(--text-primary); border-bottom: 2px solid var(--border-color); padding-bottom: 0.5rem; scroll-margin-top: 2rem;">${escapeHtml(cleanText)}</h2>`;
      continue;
    }
    if (line.startsWith('# ')) {
      if (inList) { html += '</ul>'; inList = false; }
      const headerText = line.substring(2);
      const idMatch = headerText.match(/\{#([^}]+)\}/);
      const id = idMatch ? idMatch[1] : null;
      const cleanText = idMatch ? headerText.replace(/\{#([^}]+)\}/, '').trim() : headerText;
      const headerId = id || cleanText.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      html += `<h1 id="${headerId}" class="text-3xl font-bold mt-10 mb-5" style="color: var(--text-primary); scroll-margin-top: 2rem;">${escapeHtml(cleanText)}</h1>`;
      continue;
    }
    
    // Horizontal rules
    if (line.trim() === '---') {
      if (inList) { html += '</ul>'; inList = false; }
      html += '<hr class="my-6" style="border-color: var(--border-color);">';
      continue;
    }
    
    // Lists
    if (line.match(/^[\*\-] /) || line.match(/^\d+\. /)) {
      if (!inList) {
        html += '<ul class="list-disc mb-4 ml-6 space-y-2">';
        inList = true;
      }
      const content = line.replace(/^[\*\-]\s+/, '').replace(/^\d+\.\s+/, '');
      html += `<li class="mb-1" style="color: var(--text-secondary);">${processInlineMarkdown(content)}</li>`;
      continue;
    }
    
    // Tables (detect simple table format)
    if (line.includes('|') && line.split('|').length > 2) {
      if (inList) {
        html += '</ul>';
        inList = false;
      }
      // This is a table row - process it
      if (!inTable) {
        html += '<div class="overflow-x-auto my-4"><table class="min-w-full border-collapse border border-gray-300 rounded-lg" style="background: #ffffff;"><thead style="background: #f9fafb;"><tr>';
        inTable = true;
        isTableHeader = true;
      }
      
      const cells = line.split('|').filter(cell => cell.trim() !== '');
      const rowContent = cells.map(cell => {
        const cellContent = cell.trim();
        // Skip separator rows
        if (cellContent.match(/^[-:]+$/)) {
          isTableHeader = false;
          return null;
        }
        return `<${isTableHeader ? 'th' : 'td'} class="border border-gray-300 px-4 py-2 text-left" style="color: ${isTableHeader ? 'var(--text-primary)' : 'var(--text-secondary)'}; font-weight: ${isTableHeader ? '600' : '400'};">${escapeHtml(cellContent)}</${isTableHeader ? 'th' : 'td'}>`;
      }).filter(c => c !== null).join('');
      
      if (rowContent) {
        html += `<tr>${rowContent}</tr>`;
      }
      
      // Close header and open body if we just passed the separator
      if (isTableHeader && line.match(/^\|[\s-:]+/)) {
        html += '</tr></thead><tbody>';
        isTableHeader = false;
      }
      
      continue;
    }
    
    // Close table if we're in one and hit a non-table line
    if (inTable && !line.includes('|')) {
      html += '</tbody></table></div>';
      inTable = false;
      isTableHeader = false;
    }
    
    // Regular paragraphs
    if (line.trim() === '') {
      if (inList) {
        html += '</ul>';
        inList = false;
      }
      continue;
    }
    
    if (inList) {
      html += '</ul>';
      inList = false;
    }
    
    html += `<p class="mb-4" style="color: var(--text-secondary); line-height: 1.8;">${processInlineMarkdown(line)}</p>`;
  }
  
  if (inList) html += '</ul>';
  if (inTable) html += '</tbody></table></div>';
  if (inCodeBlock) {
    const codeLines = codeBlockContent.trim().split('\n').map(l => escapeHtml(l)).join('<br>');
    html += `<pre class="p-4 rounded-lg overflow-x-auto my-4" style="background: #1f2937; color: #f9fafb; border: 1px solid #374151; font-family: 'Courier New', monospace; font-size: 0.875rem; line-height: 1.6;"><code style="color: #f9fafb;">${codeLines}</code></pre>`;
  }
  
  return html;
}

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function processInlineMarkdown(text) {
  if (!text) return '';
  
  // Escape HTML first to prevent XSS
  let processed = escapeHtml(text);
  
  // Process inline code (after escaping to avoid double processing)
  processed = processed.replace(/`([^`]+)`/g, (match, content) => {
    return `<code class="px-2 py-1 rounded text-sm font-mono" style="color: #059669; background: #f0fdf4; padding: 0.125rem 0.375rem; border: 1px solid #d1fae5; font-weight: 500;">${content}</code>`;
  });
  
  // Process bold
  processed = processed.replace(/\*\*([^*]+)\*\*/g, '<strong style="color: var(--text-primary); font-weight: 600;">$1</strong>');
  
  // Process links (including anchor links)
  processed = processed.replace(/\[([^\]]+)\]\(([^\)]+)\)/g, (match, text, url) => {
    // If it's an anchor link (starts with #), don't open in new tab
    if (url.startsWith('#')) {
      return `<a href="${url}" style="color: var(--primary); text-decoration: underline; cursor: pointer;" onclick="document.getElementById('${url.substring(1)}')?.scrollIntoView({behavior: 'smooth', block: 'start'}); return false;">${text}</a>`;
    }
    return `<a href="${url}" target="_blank" style="color: var(--primary); text-decoration: underline;">${text}</a>`;
  });
  
  return processed;
}

// Helper to escape HTML but preserve code tags
function escapeHtmlPreserveCode(text) {
  if (!text) return '';
  // First protect code blocks
  const codePlaceholders = [];
  let counter = 0;
  text = text.replace(/`([^`]+)`/g, (match, content) => {
    const placeholder = `__CODE_${counter}__`;
    codePlaceholders[counter] = content;
    counter++;
    return placeholder;
  });
  
  // Escape HTML
  const div = document.createElement('div');
  div.textContent = text;
  let escaped = div.innerHTML;
  
  // Restore code blocks
  codePlaceholders.forEach((content, index) => {
    escaped = escaped.replace(`__CODE_${index}__`, `\`${content}\``);
  });
  
  return escaped;
}

// --- Logout Function ---
window.logout = function() {
  localStorage.removeItem('token');
  window.location.href = '/admin/login';
};