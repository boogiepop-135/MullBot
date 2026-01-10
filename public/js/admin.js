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
let chatMessagesInterval = null; // Interval para actualizar mensajes automáticamente
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
    // Prisma usa 'ADMIN' y 'USER' (mayúsculas), pero también puede venir como 'admin'/'user'
    const isAdmin = currentUser.role === 'ADMIN' || currentUser.role === 'admin';
    if (roleEl) roleEl.textContent = isAdmin ? 'Administrador' : 'Usuario';

    const initialsEl = document.getElementById('user-initials');
    if (initialsEl) initialsEl.textContent = currentUser.username.charAt(0).toUpperCase();

    // Show users tab if admin
    if (isAdmin) {
      const usersNav = document.getElementById('nav-users');
      if (usersNav) usersNav.classList.remove('hidden');
    }

    // Check and show version notes if needed
    checkVersionNotes();

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

  // Detener polling de asesorías al cambiar de sección
  if (sectionId !== 'advisories' && typeof stopAdvisoriesPolling === 'function') {
    stopAdvisoriesPolling();
  }

  // Load data
  switch (sectionId) {
    case 'dashboard':
      loadDashboardData();
      break;
    case 'contacts':
      loadContacts();
      break;
    case 'advisories':
      if (typeof initAdvisoriesPanel === 'function') {
        initAdvisoriesPanel();
      }
      break;
    case 'ai-monitor':
      loadAIMonitor();
      loadBotConfig(); // Cargar también la configuración de IA
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
  
  // Cargar datos específicos según el tab
  if (tabName === 'whatsapp') {
    loadWhatsAppStatus();
    loadQRCode();
  }
};

// Initialization
document.addEventListener('DOMContentLoaded', function () {
  checkAuth();

  // Verificar que las funciones estén disponibles después de cargar
  setTimeout(() => {
    if (typeof window.clearAllSessions === 'function') {
      console.log('✓ clearAllSessions is available');
    } else {
      console.error('✗ clearAllSessions is NOT available');
    }
    if (typeof window.logoutWhatsApp === 'function') {
      console.log('✓ logoutWhatsApp is available');
    } else {
      console.error('✗ logoutWhatsApp is NOT available');
    }
  }, 1000);

  // Initial navigation based on hash
  const hash = window.location.hash.substring(1);
  if (hash && ['dashboard', 'contacts', 'advisories', 'campaigns', 'templates', 'products', 'users', 'bot-content', 'settings'].includes(hash)) {
    showSection(hash);
  } else {
    showSection('dashboard');
  }

  // Event listeners for specific UI elements
  const contactSearch = document.getElementById('contact-search');
  if (contactSearch) {
    contactSearch.addEventListener('input', function (e) {
      contactsSearch = e.target.value;
      updateClearFiltersButton();
      if (currentPage === 'contacts') loadContacts();
    });
  }

  // Función para actualizar visibilidad del botón limpiar filtros
  function updateClearFiltersButton() {
    const clearBtn = document.getElementById('clear-filters-btn');
    if (clearBtn) {
      if (currentSaleStatusFilter || contactsSearch) {
        clearBtn.classList.remove('hidden');
      } else {
        clearBtn.classList.add('hidden');
      }
    }
  }

  // Función para limpiar filtros
  window.clearContactFilters = function() {
    currentSaleStatusFilter = '';
    contactsSearch = '';
    const statusFilter = document.getElementById('sale-status-filter');
    const contactSearch = document.getElementById('contact-search');
    if (statusFilter) statusFilter.value = '';
    if (contactSearch) contactSearch.value = '';
    updateClearFiltersButton();
    if (currentPage === 'contacts') loadContacts();
  };

  const statusFilter = document.getElementById('sale-status-filter');
  if (statusFilter) {
    statusFilter.addEventListener('change', function (e) {
      currentSaleStatusFilter = e.target.value;
      updateClearFiltersButton();
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
    updateElement('agent-requested-count', stats.contacts.byStatus.agentRequested || 0);
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

  // Función helper para escapar HTML
  const escapeHtml = (text) => {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  };

  // Función helper para escapar comillas en atributos
  const escapeAttr = (text) => {
    if (!text) return '';
    return String(text).replace(/'/g, "&#39;").replace(/"/g, "&quot;");
  };

  leads.forEach(lead => {
    const tr = document.createElement('tr');
    const phoneNumber = escapeAttr(lead.phoneNumber || '');
    const name = escapeAttr(lead.name || lead.phoneNumber || 'Desconocido');
    const displayName = escapeHtml(lead.name || 'Desconocido');
    const displayPhone = escapeHtml(lead.phoneNumber || '');
    
    tr.innerHTML = `
      <td class="px-6 py-4 whitespace-nowrap">
        <div class="text-sm font-medium text-gray-900">${displayName}</div>
        <div class="text-xs text-gray-500">${displayPhone}</div>
      </td>
      <td class="px-6 py-4 whitespace-nowrap">
        <span class="px-2 py-1 text-xs font-semibold rounded-full ${lead.score >= 10 ? 'bg-green-100 text-green-800' : lead.score >= 5 ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-800'}">
          ${lead.score || 0}
        </span>
      </td>
      <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
        <button onclick="openChatModal('${phoneNumber}', '${name}')" class="text-indigo-600 hover:text-indigo-900 font-medium text-xs">
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

  // Función helper para escapar HTML
  const escapeHtml = (text) => {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  };

  contacts.forEach(contact => {
    const tr = document.createElement('tr');
    tr.className = 'hover:bg-gray-50 transition-colors';
    tr.innerHTML = `
      <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">
        ${escapeHtml(contact.name || contact.pushName || 'Desconocido')}
      </td>
      <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
        ${escapeHtml(contact.phoneNumber || '')}
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

    if (currentSaleStatusFilter && currentSaleStatusFilter !== 'PAUSED') {
      // Enviar en mayúsculas como espera el backend
      params.append('saleStatus', currentSaleStatusFilter.toUpperCase());
    }

    const response = await fetch(`/crm/contacts?${params.toString()}`, {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    });

    if (!response.ok) throw new Error('Failed to load contacts');

    let { data, meta } = await response.json();

    if (currentSaleStatusFilter === 'PAUSED') {
      data = data.filter(contact => contact.isPaused === true);
      // Client-side pagination adjustment would be needed here for perfect accuracy
    }

    // Cargar información de campañas para cada contacto
    await enrichContactsWithCampaignInfo(data);

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
    tbody.innerHTML = `<tr><td colspan="6" class="px-6 py-8 text-sm text-gray-500 text-center">No se encontraron contactos</td></tr>`;
    return;
  }

      const statusLabels = {
        'lead': { label: 'Lead', bg: 'bg-gray-100 text-gray-800' },
        'interested': { label: 'Interesado', bg: 'bg-blue-100 text-blue-800' },
        'info_requested': { label: 'Info Solicitada', bg: 'bg-indigo-100 text-indigo-800' },
        'agent_requested': { label: 'Hablar con Asesor', bg: 'bg-purple-100 text-purple-800' },
        'payment_pending': { label: 'Pago Pendiente', bg: 'bg-yellow-100 text-yellow-800' },
        'appointment_scheduled': { label: 'Cita Agendada', bg: 'bg-orange-100 text-orange-800' },
        'appointment_confirmed': { label: 'Cita Confirmada', bg: 'bg-green-100 text-green-800' },
        'completed': { label: 'Completado', bg: 'bg-green-100 text-green-800' }
      };

  // Función helper para escapar HTML
  const escapeHtml = (text) => {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  };

  // Función helper para escapar comillas en atributos
  const escapeAttr = (text) => {
    if (!text) return '';
    return String(text).replace(/'/g, "&#39;").replace(/"/g, "&quot;");
  };

  contacts.forEach(contact => {
    // Normalizar el estado a minúsculas para que coincida con statusLabels
    // El backend devuelve en mayúsculas (LEAD, INTERESTED) pero necesitamos minúsculas
    const normalizedStatus = (contact.saleStatus || 'lead').toLowerCase().replace(/\s+/g, '_');
    const status = statusLabels[normalizedStatus] || statusLabels['lead'];
    const isPaused = contact.isPaused || false;
    const phoneNumber = escapeAttr(contact.phoneNumber || '');
    const name = escapeAttr(contact.name || contact.pushName || contact.phoneNumber || '');
    const displayPhone = escapeHtml(contact.phoneNumber || '');
    const displayName = escapeHtml(contact.name || contact.pushName || '-');
    
    // Para openStatusModal, usar el estado original pero normalizado, o el valor original si está disponible
    const statusForModal = (contact.saleStatus || 'lead').toLowerCase();

    // Información adicional del contacto
    const campaignCount = contact.campaignCount || 0;
    const messageCount = contact.messageCount || 0;
    const lastCampaign = contact.lastCampaignName || null;

    let infoHTML = '<div class="text-xs text-gray-600 space-y-1">';
    if (messageCount > 0) {
      infoHTML += `<div><i class="fas fa-comment-dots text-blue-500 mr-1"></i>${messageCount} mensajes</div>`;
    }
    if (campaignCount > 0) {
      infoHTML += `<div><i class="fas fa-bullhorn text-purple-500 mr-1"></i>${campaignCount} campaña${campaignCount > 1 ? 's' : ''}`;
      if (lastCampaign) {
        infoHTML += ` (última: ${escapeHtml(lastCampaign.substring(0, 20))}${lastCampaign.length > 20 ? '...' : ''})`;
      }
      infoHTML += '</div>';
    }
    if (contact.interactionsCount && contact.interactionsCount > 1) {
      infoHTML += `<div><i class="fas fa-exchange-alt text-green-500 mr-1"></i>${contact.interactionsCount} interacciones</div>`;
    }
    if (!campaignCount && !messageCount && (!contact.interactionsCount || contact.interactionsCount <= 1)) {
      infoHTML += '<div class="text-gray-400 italic">Sin actividad</div>';
    }
    infoHTML += '</div>';

    const tr = document.createElement('tr');
    tr.className = 'hover:bg-gray-50 transition-colors';
    tr.innerHTML = `
      <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${displayPhone}</td>
      <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${displayName}</td>
      <td class="px-6 py-4 whitespace-nowrap">
        <span class="px-2 py-1 text-xs font-semibold rounded-full ${status.bg}">
          ${status.label}
        </span>
        ${isPaused ? '<span class="ml-2 px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800">Pausado</span>' : ''}
      </td>
      <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${formatDate(contact.lastInteraction)}</td>
      <td class="px-6 py-4 text-sm text-gray-600">
        ${infoHTML}
      </td>
      <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
        <div class="flex items-center space-x-3">
          <button onclick="openChatModal('${phoneNumber}', '${name}')" class="text-indigo-600 hover:text-indigo-900" title="Chat">
            <i class="fas fa-comments"></i>
          </button>
          <button onclick="openStatusModal('${contact.phoneNumber}', '${statusForModal}', '${contact.appointmentDate || ''}')" class="text-blue-600 hover:text-blue-900" title="Cambiar Estado">
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

// Enriquecer contactos con información de campañas
async function enrichContactsWithCampaignInfo(contacts) {
  try {
    // Obtener todas las campañas para buscar en cuáles está cada contacto
    const response = await fetch('/crm/campaigns', {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    });
    
    if (!response.ok) return; // Si falla, continuar sin información de campañas
    
    const campaigns = await response.json();
    
    // Para cada contacto, buscar en qué campañas está
    contacts.forEach(contact => {
      const phoneNumber = contact.phoneNumber;
      const phoneVariations = [
        phoneNumber,
        phoneNumber.replace(/@s\.whatsapp\.net$/, ''),
        phoneNumber.replace(/@c\.us$/, ''),
        `${phoneNumber.split('@')[0]}@s.whatsapp.net`,
        `${phoneNumber.split('@')[0]}@c.us`
      ];
      
      // Buscar campañas donde aparece este contacto
      const contactCampaigns = campaigns.filter(campaign => 
        campaign.contacts && campaign.contacts.some(campPhone => 
          phoneVariations.includes(campPhone) || 
          phoneVariations.some(v => campPhone.includes(v.split('@')[0]))
        )
      );
      
      contact.campaignCount = contactCampaigns.length;
      
      // Obtener la última campaña (más reciente)
      if (contactCampaigns.length > 0) {
        const sortedCampaigns = contactCampaigns.sort((a, b) => 
          new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
        );
        contact.lastCampaignName = sortedCampaigns[0].name;
        contact.lastCampaignDate = sortedCampaigns[0].createdAt;
      }
      
      // El conteo de mensajes ya viene del backend (contact.messageCount)
      // Si no viene, usar interactionsCount como fallback
      if (!contact.messageCount) {
        contact.messageCount = contact.interactionsCount || 0;
      }
    });
  } catch (error) {
    console.error('Error enriching contacts with campaign info:', error);
    // Continuar sin información de campañas si hay error
  }
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

// Seleccionar todos los contactos disponibles
window.selectAllContacts = function() {
  const checkboxes = document.querySelectorAll('.contact-checkbox');
  const totalContacts = checkboxes.length;
  
  if (totalContacts === 0) {
    alert('No hay contactos disponibles para seleccionar');
    return;
  }
  
  // Mostrar advertencia sobre envío por lotes
  const message = `⚠️ Se seleccionarán ${totalContacts} contactos.\n\n` +
                  `📢 **RECOMENDACIÓN:** Te recomendamos usar el envío por lotes para evitar problemas de rendimiento y bloqueos de WhatsApp.\n\n` +
                  `💡 ¿Qué es el envío por lotes?\n` +
                  `- Divide los mensajes en grupos más pequeños\n` +
                  `- Envía con intervalos de tiempo entre cada lote\n` +
                  `- Reduce el riesgo de bloqueos de WhatsApp\n` +
                  `- Mejor para campañas grandes\n\n` +
                  `Activa la opción "Campaña por Lotes" en el formulario y configura:\n` +
                  `- Tamaño de lote: 25-50 contactos\n` +
                  `- Intervalo: 15-30 minutos\n\n` +
                  `¿Deseas continuar seleccionando todos los contactos?`;
  
  if (!confirm(message.replace(/\*\*/g, ''))) {
    return;
  }
  
  // Seleccionar todos los checkboxes
  checkboxes.forEach(checkbox => {
    if (!checkbox.checked) {
      checkbox.checked = true;
      const phoneNumber = checkbox.value;
      const label = checkbox.closest('div').querySelector('label');
      const name = label ? (label.querySelector('.font-medium')?.textContent || phoneNumber) : phoneNumber;
      addContactToCampaign(phoneNumber, name);
    }
  });
  
  alert(`✅ ${totalContacts} contactos seleccionados.\n\n💡 Recuerda activar "Campaña por Lotes" para evitar problemas.`);
};

window.toggleBatchOptions = function() {
  const checkbox = document.getElementById('is-batch-campaign');
  const options = document.getElementById('batch-options');
  if (checkbox.checked) {
    options.classList.remove('hidden');
  } else {
    options.classList.add('hidden');
  }
};

window.filterContactsByStatus = async function() {
  const select = document.getElementById('campaign-status-filter');
  const selectedStatuses = Array.from(select.selectedOptions).map(opt => opt.value);
  
  if (selectedStatuses.length === 0) {
    // Si no hay filtro, cargar todos
    await loadAvailableContacts();
    return;
  }
  
  try {
    // Cargar contactos filtrados por estado
    const params = new URLSearchParams();
    selectedStatuses.forEach(status => params.append('saleStatus', status));
    
    const response = await fetch(`/crm/contacts?limit=5000&${params.toString()}`, {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    });
    
    if (!response.ok) throw new Error('Failed to load filtered contacts');
    
    const { data } = await response.json();
    renderAvailableContacts(data);
    
    // Información sobre contactos filtrados
    const container = document.getElementById('available-contacts');
    const info = document.createElement('div');
    info.className = 'bg-blue-50 border border-blue-200 rounded p-3 mb-3 text-sm text-blue-800';
    info.innerHTML = `<i class="fas fa-info-circle mr-2"></i>Se encontraron ${data.length} contactos con el estado seleccionado`;
    container.insertBefore(info, container.firstChild);
  } catch (error) {
    console.error('Error filtering contacts:', error);
    alert('Error al filtrar contactos por estado');
  }
};

async function createCampaign() {
  const form = document.getElementById('campaign-form');
  const formData = new FormData(form);
  const selectedContacts = Array.from(document.querySelectorAll('#selected-contacts [data-phone]')).map(el => el.dataset.phone);

  // Obtener filtro de estados si existe
  const statusFilter = Array.from(document.getElementById('campaign-status-filter').selectedOptions).map(opt => opt.value);

  if (selectedContacts.length === 0 && statusFilter.length === 0) {
    alert('Por favor selecciona al menos un contacto o un filtro de estado');
    return;
  }

  const isBatch = document.getElementById('is-batch-campaign').checked;

  const data = {
    name: formData.get('name'),
    message: formData.get('message'),
    scheduledAt: formData.get('scheduledAt') || null,
    contacts: selectedContacts,
    saleStatusFilter: statusFilter,
    isBatchCampaign: isBatch,
    batchSize: isBatch ? parseInt(formData.get('batchSize') || 25) : null,
    batchInterval: isBatch ? parseInt(formData.get('batchInterval') || 15) : null
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

    const result = await response.json();
    
    let message = '✅ Campaña creada exitosamente\n\n';
    if (result.summary) {
      message += `📊 Resumen:\n`;
      message += `• Total de contactos: ${result.summary.totalContacts}\n`;
      if (isBatch) {
        message += `• Total de lotes: ${result.summary.totalBatches}\n`;
        message += `• Contactos por lote: ${result.summary.contactsPerBatch}\n`;
      }
    }
    
    alert(message);
    showSection('campaigns');
  } catch (error) {
    console.error('Error creating campaign:', error);
    alert('Error al crear campaña: ' + error.message);
  }
}

// --- Automation Tab Management ---

window.showAutomationTab = function(tabName) {
  // Hide all panels
  document.querySelectorAll('.automation-panel').forEach(panel => panel.classList.add('hidden'));
  // Remove active state from all tabs
  document.querySelectorAll('.automation-tab').forEach(tab => {
    tab.classList.remove('text-black', 'border-black', 'font-semibold');
    tab.classList.add('text-gray-500', 'hover:text-gray-700', 'font-medium');
    tab.style.borderColor = 'transparent';
  });
  
  // Show selected panel
  const panel = document.getElementById(`automation-${tabName}`);
  if (panel) panel.classList.remove('hidden');
  
  // Activate selected tab
  const tab = document.getElementById(`auto-tab-${tabName.replace('custom-', '').replace('-list', '')}`);
  if (tab) {
    tab.classList.add('text-black', 'border-black', 'font-semibold');
    tab.classList.remove('text-gray-500', 'hover:text-gray-700', 'font-medium');
    tab.style.borderBottomWidth = '2px';
    tab.style.borderColor = '#000';
  }
  
  // Load data when opening tabs
  if (tabName === 'custom-states') loadCustomStatuses();
  if (tabName === 'automations-list') loadAutomations();
};

// --- Custom States Functions ---

async function loadCustomStatuses() {
  try {
    const response = await fetch('/crm/custom-statuses', {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    });
    if (!response.ok) throw new Error('Failed to load custom statuses');
    const data = await response.json();
    renderCustomStatuses(data.statuses);
  } catch (error) {
    console.error('Error loading custom statuses:', error);
    const tbody = document.getElementById('custom-statuses-table-body');
    if (tbody) tbody.innerHTML = '<tr><td colspan="6" class="px-6 py-4 text-sm text-red-500 text-center">Error al cargar estados</td></tr>';
  }
}

function renderCustomStatuses(statuses) {
  const tbody = document.getElementById('custom-statuses-table-body');
  if (!tbody) return;
  tbody.innerHTML = '';
  
  if (!statuses || statuses.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="px-6 py-4 text-sm text-gray-500 text-center">No hay estados personalizados</td></tr>';
    return;
  }
  
  statuses.forEach(status => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${status.name}</td>
      <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${status.value}</td>
      <td class="px-6 py-4 whitespace-nowrap">
        <span class="inline-block w-8 h-8 rounded-full border-2 border-gray-200" style="background-color: ${status.color}"></span>
      </td>
      <td class="px-6 py-4 text-sm text-gray-500">${status.description || '-'}</td>
      <td class="px-6 py-4 whitespace-nowrap">
        <span class="px-2 py-1 text-xs font-semibold rounded-full ${status.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}">
          ${status.isActive ? 'Activo' : 'Inactivo'}
        </span>
      </td>
      <td class="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
        <button onclick="editCustomStatus('${status.id}')" class="text-blue-600 hover:text-blue-900" title="Editar">
          <i class="fas fa-edit"></i>
        </button>
        <button onclick="deleteCustomStatus('${status.id}')" class="text-red-600 hover:text-red-900" title="Eliminar">
          <i class="fas fa-trash"></i>
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

window.openCreateStatusModal = function() {
  const modal = prompt('Crear nuevo estado personalizado\n\nFormato: nombre|valor|color|descripción\nEjemplo: VIP|vip|#FFD700|Clientes VIP');
  if (!modal) return;
  
  const parts = modal.split('|');
  if (parts.length < 2) {
    alert('Formato inválido. Usa: nombre|valor|color|descripción');
    return;
  }
  
  createCustomStatus({
    name: parts[0].trim(),
    value: parts[1].trim(),
    color: parts[2]?.trim() || '#3B82F6',
    description: parts[3]?.trim() || ''
  });
};

async function createCustomStatus(data) {
  try {
    const response = await fetch('/crm/custom-statuses', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    });
    
    if (!response.ok) throw new Error('Failed to create custom status');
    
    alert('Estado personalizado creado exitosamente');
    loadCustomStatuses();
  } catch (error) {
    console.error('Error creating custom status:', error);
    alert('Error al crear estado personalizado: ' + error.message);
  }
}

window.deleteCustomStatus = async function(id) {
  if (!confirm('¿Estás seguro de eliminar este estado personalizado?')) return;
  
  try {
    const response = await fetch(`/crm/custom-statuses/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    });
    
    if (!response.ok) throw new Error('Failed to delete custom status');
    
    alert('Estado eliminado correctamente');
    loadCustomStatuses();
  } catch (error) {
    console.error('Error deleting custom status:', error);
    alert('Error al eliminar estado: ' + error.message);
  }
};

// --- Automations Functions ---

async function loadAutomations() {
  try {
    const response = await fetch('/crm/automations', {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    });
    if (!response.ok) throw new Error('Failed to load automations');
    const data = await response.json();
    renderAutomations(data.automations);
  } catch (error) {
    console.error('Error loading automations:', error);
    const container = document.getElementById('automations-container');
    if (container) container.innerHTML = '<div class="text-red-500 text-center py-8">Error al cargar automatizaciones</div>';
  }
}

function renderAutomations(automations) {
  const container = document.getElementById('automations-container');
  if (!container) return;
  container.innerHTML = '';
  
  if (!automations || automations.length === 0) {
    container.innerHTML = '<div class="text-gray-500 text-center py-8">No hay automatizaciones configuradas</div>';
    return;
  }
  
  automations.forEach(auto => {
    const div = document.createElement('div');
    div.className = 'content-card p-6';
    
    const triggerName = {
      'STATUS_CHANGE': 'Cambio de Estado',
      'MESSAGE_RECEIVED': 'Mensaje Recibido',
      'TIME_BASED': 'Basado en Tiempo',
      'TAG_ADDED': 'Etiqueta Añadida'
    }[auto.triggerType] || auto.triggerType;
    
    div.innerHTML = `
      <div class="flex justify-between items-start">
        <div>
          <h3 class="text-lg font-bold text-gray-800">${auto.name}</h3>
          <p class="text-sm text-gray-600 mt-1">${auto.description || 'Sin descripción'}</p>
          <div class="flex items-center gap-4 mt-3">
            <span class="px-3 py-1 text-xs font-semibold rounded-full ${auto.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}">
              ${auto.isActive ? 'Activa' : 'Inactiva'}
            </span>
            <span class="text-sm text-gray-500">
              <i class="fas fa-bolt mr-1"></i>Disparador: ${triggerName}
            </span>
            <span class="text-sm text-gray-500">
              <i class="fas fa-fire mr-1"></i>Ejecutada ${auto.triggerCount || 0} veces
            </span>
          </div>
        </div>
        <div class="flex gap-2">
          <button onclick="toggleAutomation('${auto.id}', ${!auto.isActive})" class="text-${auto.isActive ? 'yellow' : 'green'}-600 hover:text-${auto.isActive ? 'yellow' : 'green'}-900" title="${auto.isActive ? 'Desactivar' : 'Activar'}">
            <i class="fas fa-${auto.isActive ? 'pause' : 'play'}-circle text-2xl"></i>
          </button>
          <button onclick="deleteAutomation('${auto.id}')" class="text-red-600 hover:text-red-900" title="Eliminar">
            <i class="fas fa-trash-alt text-xl"></i>
          </button>
        </div>
      </div>
    `;
    container.appendChild(div);
  });
}

window.openCreateAutomationModal = function() {
  alert('📝 Crear Automatización\n\nPor razones de simplicidad, esta funcionalidad está disponible solo via API.\n\nEjemplo:\nPOST /crm/automations\n{\n  "name": "Bienvenida a VIP",\n  "triggerType": "STATUS_CHANGE",\n  "triggerConditions": {"toStatus": "VIP"},\n  "actions": [{"type": "SEND_MESSAGE", "value": "¡Bienvenido al club VIP!"}]\n}');
};

window.toggleAutomation = async function(id, isActive) {
  try {
    const response = await fetch(`/crm/automations/${id}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ isActive })
    });
    
    if (!response.ok) throw new Error('Failed to toggle automation');
    
    loadAutomations();
  } catch (error) {
    console.error('Error toggling automation:', error);
    alert('Error al cambiar estado de automatización');
  }
};

window.deleteAutomation = async function(id) {
  if (!confirm('¿Estás seguro de eliminar esta automatización?')) return;
  
  try {
    const response = await fetch(`/crm/automations/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    });
    
    if (!response.ok) throw new Error('Failed to delete automation');
    
    alert('Automatización eliminada correctamente');
    loadAutomations();
  } catch (error) {
    console.error('Error deleting automation:', error);
    alert('Error al eliminar automatización: ' + error.message);
  }
};

// --- Contact Import/Export Functions ---

window.exportContacts = async function() {
  try {
    const response = await fetch('/crm/contacts/export/xlsx', {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    });
    
    if (!response.ok) throw new Error('Failed to export contacts');
    
    // Descargar archivo
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'contactos.xlsx';
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
    
    alert('Contactos exportados exitosamente');
  } catch (error) {
    console.error('Error exporting contacts:', error);
    alert('Error al exportar contactos');
  }
};

window.importOldConversations = async function() {
  if (!confirm('¿Importar conversaciones antiguas desde Evolution API? Esto puede tardar varios minutos.')) {
    return;
  }

  const button = event.target.closest('button');
  const originalText = button.innerHTML;
  button.disabled = true;
  button.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Importando...';

  try {
    const response = await fetch('/crm/contacts/import-conversations', {
      method: 'POST',
      headers: { 
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
        'Content-Type': 'application/json'
      }
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || 'Error al importar conversaciones');
    }

    // Mostrar resultado detallado
    let message = `✅ Importación completada:\n`;
    message += `• Contactos importados: ${result.importedContacts}\n`;
    message += `• Mensajes importados: ${result.importedMessages}\n`;
    
    if (result.errorCount > 0) {
      message += `• Errores: ${result.errorCount}\n`;
      if (result.errors && result.errors.length > 0) {
        message += `\nPrimeros errores:\n`;
        result.errors.slice(0, 3).forEach((err, idx) => {
          message += `${idx + 1}. ${err.type}: ${err.error}\n`;
        });
      }
    }

    alert(message);

    // Recargar contactos
    loadContacts();

  } catch (error) {
    console.error('Error importing old conversations:', error);
    alert(`Error al importar conversaciones: ${error.message}\n\nRevisa la consola para más detalles.`);
  } finally {
    button.disabled = false;
    button.innerHTML = originalText;
  }
};

window.importContacts = async function() {
  // Crear input de archivo dinámicamente
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.xlsx,.xls,.csv';
  
  input.onchange = async function(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    const formData = new FormData();
    formData.append('file', file);
    
    try {
      const response = await fetch('/crm/contacts/import/xlsx', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
        body: formData
      });
      
      if (!response.ok) throw new Error('Failed to import contacts');
      
      const result = await response.json();
      alert(`Importación completada:\n✅ ${result.summary.imported} nuevos contactos\n🔄 ${result.summary.updated} actualizados\n❌ ${result.summary.errors} errores`);
      
      // Recargar contactos
      loadContacts();
    } catch (error) {
      console.error('Error importing contacts:', error);
      alert('Error al importar contactos: ' + error.message);
    }
  };
  
  input.click();
};

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

// Sincronizar productos de la base de datos hacia Google Sheets
async function syncProductsToGoogleSheets() {
  if (!confirm('¿Estás seguro de que deseas sincronizar todos los productos de la base de datos hacia Google Sheets?\n\n⚠️ Esto reemplazará el contenido actual de la hoja de cálculo.')) {
    return;
  }

  // Buscar el botón que activó la función
  const buttons = document.querySelectorAll('button');
  let syncButton = null;
  for (const btn of buttons) {
    if (btn.innerHTML.includes('Sincronizar a Google Sheets')) {
      syncButton = btn;
      break;
    }
  }

  try {
    // Mostrar indicador de carga
    if (syncButton) {
      const originalText = syncButton.innerHTML;
      syncButton.disabled = true;
      syncButton.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Sincronizando...';

      const token = localStorage.getItem('token');
      const response = await fetch('/crm/products/sync-to-sheets', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();

      syncButton.disabled = false;
      syncButton.innerHTML = originalText;

      if (data.success) {
        alert(`✅ ¡Sincronización exitosa!\n\n${data.message}\n\nLos productos ahora están disponibles en Google Sheets.`);
        loadProducts();
      } else {
        alert(`❌ Error al sincronizar:\n\n${data.error || data.message || 'Error desconocido'}\n\nVerifica:\n- Que Google Sheets esté configurado (API Key y Spreadsheet ID)\n- Que la hoja sea editable (permisos de Editor)\n- Que la API Key tenga permisos de escritura`);
      }
    } else {
      // Fallback sin botón
      const token = localStorage.getItem('token');
      const response = await fetch('/crm/products/sync-to-sheets', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      const data = await response.json();
      
      if (data.success) {
        alert(`✅ ¡Sincronización exitosa!\n\n${data.message}`);
        loadProducts();
      } else {
        alert(`❌ Error: ${data.error || data.message || 'Error desconocido'}`);
      }
    }
  } catch (error) {
    console.error('Error sincronizando productos:', error);
    alert(`❌ Error al sincronizar productos:\n\n${error.message || 'Error desconocido'}`);
    
    // Restaurar botón
    if (syncButton) {
      syncButton.disabled = false;
      syncButton.innerHTML = '<i class="fas fa-sync-alt mr-2"></i><span>Sincronizar a Google Sheets</span>';
    }
  }
}

// Hacer función global
window.syncProductsToGoogleSheets = syncProductsToGoogleSheets;

// Sincronizar productos desde Google Sheets hacia la base de datos
async function syncProductsFromGoogleSheets() {
  if (!confirm('¿Estás seguro de que deseas sincronizar productos desde Google Sheets hacia la base de datos?\n\n⚠️ Esto creará o actualizará productos en la base de datos basándose en la hoja de Google Sheets.')) {
    return;
  }

  // Buscar el botón que activó la función
  const buttons = document.querySelectorAll('button');
  let syncButton = null;
  for (const btn of buttons) {
    if (btn.innerHTML.includes('Sincronizar desde Google Sheets')) {
      syncButton = btn;
      break;
    }
  }

  try {
    // Mostrar indicador de carga
    if (syncButton) {
      const originalText = syncButton.innerHTML;
      syncButton.disabled = true;
      syncButton.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Sincronizando...';

      const token = localStorage.getItem('token');
      const response = await fetch('/crm/products/sync-from-sheets', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();

      syncButton.disabled = false;
      syncButton.innerHTML = originalText;

      if (data.success) {
        alert(`✅ ¡Sincronización exitosa!\n\n${data.message}\n\n- Productos creados: ${data.stats.created}\n- Productos actualizados: ${data.stats.updated}\n- Errores: ${data.stats.errors}`);
        // Recargar productos
        loadProducts();
      } else {
        alert(`❌ Error al sincronizar:\n\n${data.error || data.message || 'Error desconocido'}\n\nVerifica:\n- Que Google Sheets esté configurado (API Key y Spreadsheet ID)\n- Que la hoja tenga productos con las columnas correctas\n- Que la hoja sea pública o compartida`);
      }
    } else {
      // Fallback sin botón
      const token = localStorage.getItem('token');
      const response = await fetch('/crm/products/sync-from-sheets', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      const data = await response.json();
      
      if (data.success) {
        alert(`✅ ¡Sincronización exitosa!\n\n${data.message}`);
        loadProducts();
      } else {
        alert(`❌ Error: ${data.error || data.message || 'Error desconocido'}`);
      }
    }
  } catch (error) {
    console.error('Error sincronizando productos desde Google Sheets:', error);
    alert(`❌ Error al sincronizar productos:\n\n${error.message || 'Error desconocido'}`);
    
    // Restaurar botón
    if (syncButton) {
      syncButton.disabled = false;
      syncButton.innerHTML = '<i class="fas fa-download mr-2"></i><span>Sincronizar desde Google Sheets</span>';
    }
  }
}

// Hacer función global
window.syncProductsFromGoogleSheets = syncProductsFromGoogleSheets;

function renderProducts(products) {
  const container = document.getElementById('products-container');
  if (!container) return;
  container.innerHTML = '';

  if (products.length === 0) {
    container.innerHTML = `
      <div class="col-span-full text-center py-12">
        <i class="fas fa-box-open text-6xl text-gray-300 mb-4"></i>
        <p class="text-gray-500 text-lg">No hay productos</p>
        <p class="text-gray-400 text-sm mt-2">Haz clic en "Nuevo Producto" o sincroniza desde Google Sheets</p>
      </div>
    `;
    return;
  }

  products.forEach(product => {
    const card = document.createElement('div');
    card.className = 'bg-white border border-gray-200 rounded-lg overflow-hidden hover:shadow-lg transition-all duration-200 flex flex-col';
    
    // Truncar descripción si es muy larga
    const description = product.description || '';
    const truncatedDesc = description.length > 150 ? description.substring(0, 150) + '...' : description;
    
    // Imagen si existe
    const imageHtml = product.imageUrl 
      ? `<img src="${escapeHtml(product.imageUrl)}" alt="${escapeHtml(product.name)}" class="w-full h-48 object-cover bg-gray-100" onerror="this.style.display='none'">`
      : `<div class="w-full h-48 bg-gradient-to-br from-green-50 to-emerald-50 flex items-center justify-center">
           <i class="fas fa-box text-6xl text-gray-300"></i>
         </div>`;
    
    card.innerHTML = `
      ${imageHtml}
      <div class="p-4 flex flex-col flex-1">
        <div class="flex-1">
          <h3 class="font-bold text-lg text-gray-900 mb-2 line-clamp-2" title="${escapeHtml(product.name)}">
            ${escapeHtml(product.name)}
          </h3>
          ${description ? `
            <p class="text-sm text-gray-600 mb-3 line-clamp-3" title="${escapeHtml(description)}">
              ${escapeHtml(truncatedDesc)}
            </p>
          ` : ''}
          <div class="flex items-center justify-between mb-3">
            <span class="text-2xl font-bold text-indigo-600">$${parseFloat(product.price || 0).toFixed(2)}</span>
            <span class="px-3 py-1 text-xs font-semibold rounded-full ${product.inStock ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}">
              ${product.inStock ? 'En Stock' : 'Agotado'}
            </span>
          </div>
          ${product.category ? `
            <div class="mb-3">
              <span class="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">${escapeHtml(product.category)}</span>
            </div>
          ` : ''}
        </div>
        <div class="flex gap-2 mt-auto pt-3 border-t border-gray-100">
          <button onclick="openEditProductModal('${product._id}')" 
            class="flex-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2">
            <i class="fas fa-edit"></i>
            <span>Editar</span>
          </button>
          <button onclick="deleteProduct('${product._id}')" 
            class="flex-1 bg-red-50 hover:bg-red-100 text-red-600 px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2">
            <i class="fas fa-trash"></i>
            <span>Eliminar</span>
          </button>
        </div>
      </div>
    `;
    container.appendChild(card);
  });
}

// Función helper para escapar HTML (si no existe)
if (typeof escapeHtml === 'undefined') {
  window.escapeHtml = function(text) {
    const map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };
    return text ? text.replace(/[&<>"']/g, m => map[m]) : '';
  };
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

// Formatear fecha con zona horaria de México Central
function formatDate(dateString) {
  if (!dateString) return '-';
  const date = new Date(dateString);
  
  // Formatear con zona horaria de México Central (America/Mexico_City)
  const options = {
    timeZone: 'America/Mexico_City',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  };
  
  return date.toLocaleString('es-MX', options);
}

// Reloj en tiempo real con zona horaria de México Central
function updateClock() {
  const clockElement = document.getElementById('mexico-clock');
  if (!clockElement) return;
  
  const now = new Date();
  const options = {
    timeZone: 'America/Mexico_City',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
    day: '2-digit',
    month: 'short',
    weekday: 'short'
  };
  
  const mexicoTime = now.toLocaleString('es-MX', options);
  clockElement.innerHTML = `
    <i class="fas fa-clock mr-2"></i>
    <span class="font-semibold">${mexicoTime}</span>
    <span class="text-xs ml-2 text-gray-500">CDT</span>
  `;
}

// Actualizar reloj cada segundo
setInterval(updateClock, 1000);
updateClock(); // Inicializar inmediatamente

// --- Chat & Other Modals (Simplified for brevity, assuming existence) ---
window.openChatModal = function (phone, name) {
  if (!phone) {
    console.error('No phone number provided to openChatModal');
    alert('Error: No se proporcionó un número de teléfono');
    return;
  }

  try {
    currentChatPhoneNumber = phone;
    currentChatContactName = name || phone;
    
    const nameElement = document.getElementById('chat-contact-name');
    const phoneElement = document.getElementById('chat-contact-phone');
    const modalElement = document.getElementById('chat-modal');
    
    if (!nameElement || !phoneElement || !modalElement) {
      console.error('Chat modal elements not found');
      alert('Error: No se pudo abrir el chat. Por favor, recarga la página.');
      return;
    }
    
    nameElement.textContent = name || phone;
    phoneElement.textContent = phone;
    
    // Prevenir scroll del body
    document.body.classList.add('modal-open');
    
    // Remover hidden y asegurar que el modal sea visible
    modalElement.classList.remove('hidden');
    
    // Forzar reflow para asegurar que los estilos se apliquen
    void modalElement.offsetHeight;
    
    // Cargar mensajes iniciales
    loadChatMessages();
    
    // Iniciar polling automático para actualizar mensajes cada 3 segundos
    if (chatMessagesInterval) {
      clearInterval(chatMessagesInterval);
    }
    chatMessagesInterval = setInterval(() => {
      if (currentChatPhoneNumber) {
        loadChatMessages();
      }
    }, 3000);
  } catch (error) {
    console.error('Error opening chat modal:', error);
    alert('Error al abrir el chat. Por favor, intenta de nuevo.');
  }
};

window.closeChatModal = function () {
  const modalElement = document.getElementById('chat-modal');
  if (modalElement) {
    modalElement.classList.add('hidden');
  }
  // Restaurar scroll del body
  document.body.classList.remove('modal-open');
  
  // Detener el polling de mensajes
  if (chatMessagesInterval) {
    clearInterval(chatMessagesInterval);
    chatMessagesInterval = null;
  }
  
  currentChatPhoneNumber = null;
  chatMessages = [];
};

async function loadChatMessages(loadMore = false) {
  if (!currentChatPhoneNumber) {
    console.error('No phone number provided');
    return;
  }
  
  const container = document.getElementById('messages-container');
  const loadMoreBtn = document.getElementById('load-more-messages-btn');
  
  if (!loadMore && container) {
    container.innerHTML = '<div class="flex justify-center items-center h-full"><i class="fas fa-spinner fa-spin text-gray-400 text-2xl"></i></div>';
  }
  
  try {
    // Codificar el número de teléfono para la URL
    const encodedPhoneNumber = encodeURIComponent(currentChatPhoneNumber);
    
    // Si estamos cargando más, usar el timestamp del mensaje más antiguo
    let url = `/crm/contacts/${encodedPhoneNumber}/messages?limit=500`;
    if (loadMore && chatMessages && chatMessages.length > 0) {
      const oldestMessage = chatMessages[0]; // El primero es el más antiguo
      if (oldestMessage && oldestMessage.timestamp) {
        url += `&before=${encodeURIComponent(oldestMessage.timestamp)}`;
      }
    }
    
    // Agregar timestamp para evitar cache del navegador
    const cacheBuster = `_t=${Date.now()}`;
    url += `&${cacheBuster}`;
    
    const response = await fetch(url, {
      headers: { 
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
        'Cache-Control': 'no-cache'
      }
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Failed to load messages: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    const newMessages = data.messages || [];
    
    if (loadMore && chatMessages) {
      // Prependear mensajes antiguos al inicio
      chatMessages = [...newMessages, ...chatMessages];
    } else {
      chatMessages = newMessages;
    }
    
    renderChatMessages(data.hasMore);
  } catch (e) { 
    console.error('Error loading messages:', e);
    if (container && !loadMore) {
      container.innerHTML = `<div class="flex flex-col justify-center items-center h-full text-red-500 p-4">
        <i class="fas fa-exclamation-triangle mb-2 text-2xl"></i>
        <p class="text-sm text-center">Error al cargar mensajes</p>
        <p class="text-xs text-gray-500 mt-1">${e.message || 'Error desconocido'}</p>
      </div>`;
    }
  }
}

window.loadMoreMessages = function() {
  loadChatMessages(true);
};

function renderChatMessages(hasMore = false) {
  const container = document.getElementById('messages-container');
  const loadMoreBtn = document.getElementById('load-more-messages-btn');
  if (!container) return;
  
  // Guardar posición de scroll antes de actualizar
  const wasAtBottom = container.scrollHeight - container.scrollTop <= container.clientHeight + 50;
  const oldScrollHeight = container.scrollHeight;
  
  container.innerHTML = '';
  
  if (!chatMessages || chatMessages.length === 0) {
    container.innerHTML = '<div class="flex justify-center items-center h-full text-gray-400">No hay mensajes aún</div>';
    if (loadMoreBtn) loadMoreBtn.classList.add('hidden');
    return;
  }
  
  // Botón para cargar más mensajes antiguos
  if (hasMore && loadMoreBtn) {
    loadMoreBtn.classList.remove('hidden');
  } else if (loadMoreBtn) {
    loadMoreBtn.classList.add('hidden');
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
  
  // Restaurar posición de scroll
  if (wasAtBottom) {
    // Si estaba al final, mantener al final
    container.scrollTop = container.scrollHeight;
  } else {
    // Si estaba arriba, mantener la posición relativa
    const newScrollHeight = container.scrollHeight;
    const scrollDiff = newScrollHeight - oldScrollHeight;
    container.scrollTop = container.scrollTop + scrollDiff;
  }
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
      const error = await response.json().catch(() => ({ error: 'Error desconocido' }));
      
      // Mensajes más específicos según el tipo de error
      let errorMessage = error.error || 'Error al enviar mensaje';
      
      if (response.status === 503) {
        if (error.reason === 'qr_not_scanned') {
          errorMessage = 'WhatsApp no está conectado. Por favor, ve a Configuración > WhatsApp y escanea el código QR.';
        } else if (error.reason === 'client_not_authenticated') {
          errorMessage = 'WhatsApp está conectándose. Por favor, espera unos momentos e intenta de nuevo.';
        } else if (error.details) {
          errorMessage = error.error + '\n\n' + error.details;
        }
      }
      
      throw new Error(errorMessage);
    }
    
    input.value = '';
    
    // Agregar mensaje localmente para feedback inmediato
    const tempMessage = {
      body: msg,
      isFromBot: true,
      timestamp: new Date().toISOString()
    };
    chatMessages.push(tempMessage);
    renderChatMessages();
    
    // Recargar mensajes después de un momento para sincronizar con el backend
    // Hacerlo múltiples veces para asegurar que se actualice
    setTimeout(() => {
      loadChatMessages();
    }, 500);
    
    setTimeout(() => {
      loadChatMessages();
    }, 1500);
    
    setTimeout(() => {
      loadChatMessages();
    }, 3000);
    
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
    setInputValue('agent-phone-input', config.humanAgentPhone);
    // Checkbox para notificación automática al agente
    const notifyCheckbox = document.getElementById('notify-agent-checkbox');
    if (notifyCheckbox) notifyCheckbox.checked = !!config.notifyAgentOnAttention;
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
    
    // IA (cargar siempre, tanto en Configuración como en Monitor IA)
    setInputValue('ai-system-prompt-input', config.aiSystemPrompt);
    setInputValue('ai-model-input', config.aiModel);
    
    // Actualizar estado del modelo en Monitor IA si está disponible
    const modelStatusDisplay = document.getElementById('ai-model-status-display');
    if (modelStatusDisplay) {
      const modelName = config.aiModel || 'gemini-2.0-flash-exp';
      const shortName = modelName.replace('gemini-', '').replace('-exp', '').replace('gpt-', '').replace('4o-mini', 'GPT-4o Mini').replace('4o', 'GPT-4o');
      modelStatusDisplay.textContent = shortName || 'Gemini 2.0 Flash';
    }
    
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
    
    // Teléfono de agente y notificaciones automáticas
    humanAgentPhone: getInputValue('agent-phone-input'),
    notifyAgentOnAttention: document.getElementById('notify-agent-checkbox')?.checked || false,

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
    
    // Si connected es true, Evolution API está conectado
    if (data.connected || data.status === 'healthy') {
      if (statusEl) {
        statusEl.innerHTML = `<span class="text-green-600 font-medium">✅ Conectado</span>`;
      }
      if (qrDisplay) qrDisplay.classList.add('hidden');
    } else {
      // Si no está listo, verificar si hay QR disponible
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
    // Agregar timestamp para evitar cache
    const response = await fetch(`/qr?_t=${Date.now()}`);
    
    if (!response.ok) {
      if (response.status === 404) {
        // QR no disponible aún, esperar y reintentar
        if (qrDisplay) qrDisplay.classList.add('hidden');
        setTimeout(loadQRCode, 5000); // Reintentar en 5 segundos
      } else {
        console.warn('Error al cargar QR:', response.status);
        if (qrDisplay) qrDisplay.classList.add('hidden');
      }
      return;
    }
    
    const data = await response.json();
    
    if (data.qr && !data.qrScanned) {
      // Hay QR disponible y no está escaneado
      if (qrDisplay) {
        qrDisplay.classList.remove('hidden');
      }
      if (qrContainer) {
        // Actualizar imagen del QR
        qrContainer.innerHTML = `<img src="data:image/png;base64,${data.qr}" alt="QR Code" class="w-64 h-64" style="max-width: 100%; height: auto;">`;
      }
      // Refrescar QR cada 20 segundos (los QR expiran después de ~20 segundos)
      setTimeout(loadQRCode, 20000);
    } else if (data.qrScanned) {
      // QR ya fue escaneado, ocultar y actualizar estado
      if (qrDisplay) qrDisplay.classList.add('hidden');
      loadWhatsAppStatus();
    } else {
      // No hay QR disponible aún, esperar y reintentar
      if (qrDisplay) qrDisplay.classList.add('hidden');
      setTimeout(loadQRCode, 5000); // Reintentar en 5 segundos
    }
  } catch (error) {
    console.error('Error cargando código QR:', error);
    // Reintentar después de un error
    setTimeout(loadQRCode, 5000);
  }
}

// clearAllSessions ahora está deprecado - usar logoutWhatsApp en su lugar
// Mantenido por compatibilidad pero redirige a logoutWhatsApp
window.clearAllSessions = async function() {
  console.log('clearAllSessions llamado (redirigiendo a logoutWhatsApp)...');
  logoutWhatsApp();
};

window.logoutWhatsApp = async function() {
  console.log('=== DESVINCULACIÓN DE WHATSAPP ===');
  
  if (!confirm('¿Estás seguro de que deseas desvincular WhatsApp?\n\nEsto desvinculará el dispositivo y limpiará todas las sesiones guardadas. Tendrás que escanear el QR nuevamente para volver a conectar.')) {
    console.log('Usuario canceló la desvinculación');
    return;
  }
  
  const statusEl = document.getElementById('whatsapp-connected-status');
  if (!statusEl) {
    console.error('whatsapp-connected-status element not found');
    alert('Error: No se pudo encontrar el elemento de estado');
    return;
  }
  
  // Deshabilitar botón durante el proceso
  const logoutBtn = event?.target?.closest('button');
  if (logoutBtn) {
    logoutBtn.disabled = true;
    logoutBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Desvinculando...';
  }
  
  statusEl.innerHTML = `<span class="text-yellow-600 font-medium">⏳ Desvinculando y limpiando sesiones...</span>`;
  
  try {
    const token = localStorage.getItem('token');
    if (!token) {
      throw new Error('No hay token de autenticación. Por favor, inicia sesión nuevamente.');
    }
    
    console.log('Enviando solicitud de desvinculación...');
    const response = await fetch('/crm/whatsapp/logout', {
      method: 'POST',
      headers: { 
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('Estado de respuesta:', response.status);
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('Error en respuesta:', errorData);
      throw new Error(errorData.error || errorData.details || `Error ${response.status}: ${response.statusText}`);
    }
    
    const result = await response.json();
    console.log('Resultado de desvinculación:', result);
    
    statusEl.innerHTML = `<span class="text-blue-600 font-medium">⏳ Generando nuevo QR...</span>`;
    
    // Mostrar mensaje de éxito
    const deletedCount = result.deletedCount || 0;
    alert(`✅ WhatsApp desvinculado correctamente.\n\n${deletedCount} sesión(es) eliminada(s).\n\nGenerando nuevo código QR...`);
    
    // Esperar y recargar estado y QR
    setTimeout(() => {
      loadWhatsAppStatus();
      loadQRCode();
    }, 2000);
    
    // Recargar periódicamente hasta que aparezca el QR o se conecte
    let attempts = 0;
    const maxAttempts = 15; // 75 segundos máximo (15 intentos x 5 segundos)
    const checkQR = setInterval(() => {
      attempts++;
      loadWhatsAppStatus();
      loadQRCode();
      
      // Verificar si ya hay QR o si está conectado
      const qrDisplay = document.getElementById('qr-display');
      const statusText = statusEl.textContent || '';
      
      if (qrDisplay && !qrDisplay.classList.contains('hidden')) {
        console.log('✓ QR visible, deteniendo verificación');
        clearInterval(checkQR);
        if (logoutBtn) {
          logoutBtn.disabled = false;
          logoutBtn.innerHTML = '<i class="fas fa-unlink mr-2"></i><span>Desvincular WhatsApp</span>';
        }
      } else if (statusText.includes('Conectado') || statusText.includes('✅')) {
        console.log('✓ Cliente conectado, deteniendo verificación');
        clearInterval(checkQR);
        if (logoutBtn) {
          logoutBtn.disabled = false;
          logoutBtn.innerHTML = '<i class="fas fa-unlink mr-2"></i><span>Desvincular WhatsApp</span>';
        }
      } else if (attempts >= maxAttempts) {
        console.log('⚠ Tiempo máximo alcanzado');
        clearInterval(checkQR);
        statusEl.innerHTML = `<span class="text-orange-600 font-medium">⚠️ Si no aparece el QR, intenta recargar la página o contacta al soporte</span>`;
        if (logoutBtn) {
          logoutBtn.disabled = false;
          logoutBtn.innerHTML = '<i class="fas fa-unlink mr-2"></i><span>Desvincular WhatsApp</span>';
        }
      }
    }, 5000);
    
  } catch (error) {
    console.error('❌ Error al desvincular WhatsApp:', error);
    alert('❌ Error al desvincular WhatsApp:\n\n' + (error.message || 'Error desconocido'));
    
    if (statusEl) {
      statusEl.innerHTML = `<span class="text-red-600 font-medium">❌ Error al desvincular</span>`;
    }
    
    if (logoutBtn) {
      logoutBtn.disabled = false;
      logoutBtn.innerHTML = '<i class="fas fa-unlink mr-2"></i><span>Desvincular WhatsApp</span>';
    }
    
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
  // Normalizar el estado: convertir a mayúsculas para que coincida con los valores del select
  // El select tiene valores en mayúsculas (LEAD, INTERESTED, etc.)
  const normalizedStatus = (currentStatus || 'lead').toUpperCase().replace(/\s+/g, '_');
  document.getElementById('status-select').value = normalizedStatus;
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
    
    // Recargar contactos y dashboard para reflejar el cambio
    loadContacts(contactsPage); // Mantener la página actual
    if (currentPage === 'dashboard') {
      loadDashboardData(); // Actualizar dashboard si está visible
    }
    
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
    // Prisma usa 'ADMIN' y 'USER' (mayúsculas), pero también puede venir como 'admin'/'user'
    const isAdmin = user.role === 'ADMIN' || user.role === 'admin';
    tr.innerHTML = `
      <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${user.username}</td>
      <td class="px-6 py-4 whitespace-nowrap">
        <span class="px-2 py-1 text-xs font-semibold rounded-full ${isAdmin ? 'bg-purple-100 text-purple-800' : 'bg-gray-100 text-gray-800'}">
          ${isAdmin ? 'Administrador' : 'Usuario'}
        </span>
      </td>
      <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${formatDate(user.createdAt)}</td>
      <td class="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
        <button onclick="editUsername('${user.id}', '${user.username}')" class="text-blue-600 hover:text-blue-900" title="Editar nombre">
          <i class="fas fa-edit"></i>
        </button>
        <button onclick="changeUserPassword('${user.id}')" class="text-indigo-600 hover:text-indigo-900" title="Cambiar contraseña">
          <i class="fas fa-key"></i>
        </button>
        <button onclick="deleteUser('${user.id}', '${user.username}')" class="text-red-600 hover:text-red-900" title="Eliminar usuario">
          <i class="fas fa-trash"></i>
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

window.editUsername = async function(userId, currentUsername) {
  const newUsername = prompt(`Nuevo nombre de usuario (actual: ${currentUsername}):`);
  if (!newUsername || newUsername === currentUsername) return;
  
  try {
    const response = await fetch(`/crm/auth/users/${userId}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ username: newUsername })
    });
    
    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || 'Failed to update username');
    }
    
    loadUsers();
    alert('Nombre de usuario actualizado correctamente');
  } catch (error) {
    console.error('Error updating username:', error);
    alert('Error al actualizar nombre: ' + error.message);
  }
};

window.deleteUser = async function(userId, username) {
  if (!confirm(`¿Estás seguro de eliminar al usuario "${username}"? Esta acción no se puede deshacer.`)) return;
  
  try {
    const response = await fetch(`/crm/auth/users/${userId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    });
    
    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || 'Failed to delete user');
    }
    
    loadUsers();
    alert('Usuario eliminado correctamente');
  } catch (error) {
    console.error('Error deleting user:', error);
    alert('Error al eliminar usuario: ' + error.message);
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

// --- Version Notes Functions ---
async function checkVersionNotes() {
  try {
    // Check if user has dismissed version notes
    const dismissedVersions = JSON.parse(localStorage.getItem('dismissedVersions') || '[]');
    const dontShowAgain = localStorage.getItem('dontShowVersionNotes') === 'true';
    
    if (dontShowAgain) {
      return;
    }

    const response = await fetch('/crm/version-notes', {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    });

    if (!response.ok) {
      return;
    }

    const data = await response.json();
    const latestVersion = data.currentVersion;

    // Check if this version has been dismissed
    if (dismissedVersions.includes(latestVersion)) {
      return;
    }

    // Show version notes modal
    showVersionNotesModal(data.notes[0]);
  } catch (error) {
    console.error('Error checking version notes:', error);
  }
}

function showVersionNotesModal(versionNote) {
  const modal = document.getElementById('version-notes-modal');
  const badge = document.getElementById('version-badge');
  const date = document.getElementById('version-date');
  const changes = document.getElementById('version-changes');

  if (!modal || !badge || !date || !changes) {
    return;
  }

  // Set version badge
  badge.textContent = `v${versionNote.version}`;

  // Set date
  const dateObj = new Date(versionNote.date);
  const formattedDate = dateObj.toLocaleDateString('es-ES', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
  date.querySelector('span').textContent = formattedDate;

  // Render changes
  changes.innerHTML = '';
  versionNote.changes.forEach(change => {
    const li = document.createElement('li');
    li.className = change.type;
    li.textContent = change.description;
    changes.appendChild(li);
  });

  // Show modal
  modal.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

window.closeVersionNotesModal = function() {
  const modal = document.getElementById('version-notes-modal');
  const checkbox = document.getElementById('dont-show-again-checkbox');
  
  if (!modal) {
    return;
  }

  // Check if "don't show again" is checked
  if (checkbox && checkbox.checked) {
    localStorage.setItem('dontShowVersionNotes', 'true');
  } else {
    // Mark this version as dismissed
    const badge = document.getElementById('version-badge');
    if (badge) {
      const version = badge.textContent.replace('v', '');
      const dismissedVersions = JSON.parse(localStorage.getItem('dismissedVersions') || '[]');
      if (!dismissedVersions.includes(version)) {
        dismissedVersions.push(version);
        localStorage.setItem('dismissedVersions', JSON.stringify(dismissedVersions));
      }
    }
  }

  // Hide modal
  modal.classList.add('hidden');
  document.body.style.overflow = '';
};

// Setup overlay click handler for version notes modal
document.addEventListener('DOMContentLoaded', function() {
  const modal = document.getElementById('version-notes-modal');
  if (modal) {
    modal.addEventListener('click', function(e) {
      if (e.target === modal) {
        closeVersionNotesModal();
      }
    });
  }
});

// ========================================
// PAIRING CODE FUNCTIONS
// ========================================

/**
 * Mostrar método de conexión (QR o Pairing Code)
 */
window.showConnectionMethod = function(method) {
  console.log('Cambiando método de conexión a:', method);
  
  // Actualizar botones
  const btnQR = document.getElementById('btn-method-qr');
  const btnPairing = document.getElementById('btn-method-pairing');
  
  if (btnQR && btnPairing) {
    // Resetear estilos
    btnQR.classList.remove('border-green-500', 'bg-green-50', 'text-green-700');
    btnQR.classList.add('border-gray-300', 'text-gray-700');
    btnPairing.classList.remove('border-green-500', 'bg-green-50', 'text-green-700');
    btnPairing.classList.add('border-gray-300', 'text-gray-700');
    
    // Aplicar estilo al botón activo
    if (method === 'qr') {
      btnQR.classList.remove('border-gray-300', 'text-gray-700');
      btnQR.classList.add('border-green-500', 'bg-green-50', 'text-green-700');
    } else {
      btnPairing.classList.remove('border-gray-300', 'text-gray-700');
      btnPairing.classList.add('border-green-500', 'bg-green-50', 'text-green-700');
    }
  }
  
  // Mostrar/ocultar paneles
  const panelQR = document.getElementById('connection-method-qr');
  const panelPairing = document.getElementById('connection-method-pairing');
  
  if (panelQR && panelPairing) {
    if (method === 'qr') {
      panelQR.classList.remove('hidden');
      panelPairing.classList.add('hidden');
      // Cargar QR si no está cargado
      setTimeout(loadQRCode, 500);
    } else {
      panelQR.classList.add('hidden');
      panelPairing.classList.remove('hidden');
      // Resetear displays de pairing code
      resetPairingCodeDisplay();
    }
  }
};

/**
 * Resetear displays de pairing code
 */
function resetPairingCodeDisplay() {
  const codeDisplay = document.getElementById('pairing-code-display');
  const errorDisplay = document.getElementById('pairing-error-display');
  const loadingDisplay = document.getElementById('pairing-loading');
  
  if (codeDisplay) codeDisplay.classList.add('hidden');
  if (errorDisplay) errorDisplay.classList.add('hidden');
  if (loadingDisplay) loadingDisplay.classList.add('hidden');
}

// ========================================
// AI MONITOR FUNCTIONS
// ========================================

/**
 * Cargar dashboard de monitoreo de IA
 */
window.loadAIMonitor = async function() {
  console.log('Cargando Monitor de IA...');
  await Promise.all([
    loadAIStatus(),
    loadCacheStats()
  ]);
  
  // Auto-refresh cada 30 segundos
  if (window.aiMonitorInterval) {
    clearInterval(window.aiMonitorInterval);
  }
  window.aiMonitorInterval = setInterval(async () => {
    await Promise.all([
      loadAIStatus(),
      loadCacheStats()
    ]);
  }, 30000);
};

/**
 * Cargar estadísticas del caché
 */
async function loadCacheStats() {
  try {
    const token = localStorage.getItem('token');
    if (!token) return;

    const response = await fetch('/api/ai-cache-stats', {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!response.ok) {
      console.error('Error loading cache stats:', response.status);
      return;
    }

    const stats = await response.json();
    console.log('Cache stats:', stats);

    // Actualizar UI
    const hitRateEl = document.getElementById('cache-hit-rate');
    if (hitRateEl) {
      hitRateEl.textContent = `${stats.hitRate}%`;
      hitRateEl.className = stats.hitRate >= 50 ? 'text-3xl font-bold text-green-600' : 
                             stats.hitRate >= 30 ? 'text-3xl font-bold text-yellow-600' : 
                             'text-3xl font-bold text-gray-600';
    }

    const entriesEl = document.getElementById('cache-entries');
    if (entriesEl) {
      entriesEl.textContent = `${stats.memoryEntries}/${stats.dbEntries}`;
    }

    const savedCallsEl = document.getElementById('cache-saved-calls');
    if (savedCallsEl) {
      savedCallsEl.textContent = stats.savedAPICalls.toLocaleString();
    }

    const savingsEl = document.getElementById('cache-savings');
    if (savingsEl) {
      savingsEl.textContent = stats.estimatedSavings;
    }

  } catch (error) {
    console.error('Error loading cache stats:', error);
  }
}

/**
 * Cargar estado de los modelos de IA
 */
window.loadAIStatus = async function() {
  try {
    const token = localStorage.getItem('token');
    if (!token) {
      console.error('No token found');
      return;
    }

    const response = await fetch('/api/ai-status', {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    console.log('Estado de IA:', data);

    // Actualizar estadísticas generales
    updateAIGeneralStats(data);

    // Actualizar tabla de modelos
    updateAIModelsTable(data);

    // Actualizar alertas
    updateAIAlerts(data);

    // Actualizar distribución
    updateAIDistribution(data);

  } catch (error) {
    console.error('Error cargando estado de IA:', error);
    showAIError('No se pudo cargar el estado de los modelos de IA');
  }
};

/**
 * Actualizar estadísticas generales
 */
function updateAIGeneralStats(data) {
  // Modelo activo
  const activeModelEl = document.getElementById('ai-active-model');
  if (activeModelEl) {
    const modelName = data.activeModel || 'Ninguno';
    const shortName = modelName.replace('gemini-', '').replace('-exp', '');
    activeModelEl.textContent = shortName;
    activeModelEl.className = data.activeModel ? 'text-xl font-bold text-green-600' : 'text-xl font-bold text-red-600';
  }

  // Actualizar también el estado del modelo en la sección de configuración
  const modelStatusDisplay = document.getElementById('ai-model-status-display');
  if (modelStatusDisplay && data.activeModel) {
    const modelName = data.activeModel;
    const shortName = modelName.replace('gemini-', '').replace('-exp', '').replace('gpt-', '').replace('4o-mini', 'GPT-4o Mini').replace('4o', 'GPT-4o');
    modelStatusDisplay.textContent = shortName || 'Cargando...';
  }

  // Total requests
  const totalRequestsEl = document.getElementById('ai-total-requests');
  if (totalRequestsEl) {
    totalRequestsEl.textContent = data.totalRequests.toLocaleString();
  }

  // Total errores
  const totalErrorsEl = document.getElementById('ai-total-errors');
  if (totalErrorsEl) {
    totalErrorsEl.textContent = data.totalErrors.toLocaleString();
  }

  // Tasa de éxito
  const successRateEl = document.getElementById('ai-success-rate');
  if (successRateEl) {
    const successRate = data.totalRequests > 0 
      ? ((data.totalRequests - data.totalErrors) / data.totalRequests * 100).toFixed(1)
      : 100;
    successRateEl.textContent = `${successRate}%`;
    successRateEl.className = successRate >= 95 ? 'text-3xl font-bold text-green-600' : 
                               successRate >= 80 ? 'text-3xl font-bold text-yellow-600' : 
                               'text-3xl font-bold text-red-600';
  }
}

/**
 * Actualizar tabla de modelos
 */
function updateAIModelsTable(data) {
  const tableBody = document.getElementById('ai-models-table');
  if (!tableBody) return;

  if (!data.models || data.models.length === 0) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="8" class="px-6 py-8 text-center text-gray-500">
          No hay modelos configurados
        </td>
      </tr>
    `;
    return;
  }

  tableBody.innerHTML = data.models.map(model => {
    const successRate = model.requestCount > 0 
      ? ((model.requestCount - model.errorCount) / model.requestCount * 100).toFixed(1)
      : 100;

    const statusBadge = getModelStatusBadge(model.status);
    const isActive = model.name === data.activeModel;
    const avgTime = model.averageResponseTime || 0;
    const keyLabel = model.keyLabel || 'GEMINI_API_KEY';

    return `
      <tr class="${isActive ? 'bg-green-50' : ''}">
        <td class="px-6 py-4">
          <div class="flex items-center">
            ${isActive ? '<i class="fas fa-star text-yellow-500 mr-2"></i>' : ''}
            <span class="font-medium text-gray-800">${model.name}</span>
          </div>
        </td>
        <td class="px-6 py-4">
          <span class="text-xs font-mono bg-gray-100 border border-gray-200 rounded px-2 py-1">${keyLabel}</span>
        </td>
        <td class="px-6 py-4">${statusBadge}</td>
        <td class="px-6 py-4">
          <span class="text-sm font-medium text-gray-600">#${model.priority}</span>
        </td>
        <td class="px-6 py-4">
          <span class="text-sm text-gray-800 font-medium">${model.requestCount.toLocaleString()}</span>
        </td>
        <td class="px-6 py-4">
          <span class="text-sm ${model.errorCount > 0 ? 'text-red-600 font-bold' : 'text-gray-600'}">${model.errorCount.toLocaleString()}</span>
        </td>
        <td class="px-6 py-4">
          <span class="text-sm font-medium ${successRate >= 95 ? 'text-green-600' : successRate >= 80 ? 'text-yellow-600' : 'text-red-600'}">
            ${successRate}%
          </span>
        </td>
        <td class="px-6 py-4">
          <span class="text-sm font-medium ${avgTime < 2000 ? 'text-green-600' : avgTime < 4000 ? 'text-yellow-600' : 'text-orange-600'}">
            ${avgTime > 0 ? `${(avgTime / 1000).toFixed(2)}s` : '-'}
          </span>
        </td>
        <td class="px-6 py-4">
          ${model.lastError ? `
            <div class="text-xs text-red-600 max-w-xs truncate" title="${model.lastError}">
              ${model.lastError}
            </div>
            ${model.lastErrorTime ? `<div class="text-xs text-gray-400 mt-1">${formatRelativeTime(model.lastErrorTime)}</div>` : ''}
          ` : '<span class="text-xs text-gray-400">Sin errores</span>'}
        </td>
        <td class="px-6 py-4">
          <button onclick="resetModelStats('${model.id || model.name}')" class="text-xs text-blue-600 hover:text-blue-800 font-medium">
            <i class="fas fa-redo-alt mr-1"></i>Resetear
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

// Cambiar clave activa de IA (prioridad) - usa /api/ai-set-active-key
window.setActiveAIKey = async function(keyIndex) {
  try {
    const token = localStorage.getItem('token');
    if (!token) return;

    const response = await fetch('/api/ai-set-active-key', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ keyIndex })
    });

    const result = await response.json();
    if (!response.ok || !result.success) {
      throw new Error(result.error || result.message || 'No se pudo cambiar la key activa');
    }

    alert(`✅ ${result.message}`);
    await loadAIStatus();
  } catch (e) {
    console.error('Error setActiveAIKey:', e);
    alert(`❌ Error: ${e.message || e}`);
  }
};

/**
 * Obtener badge de estado del modelo
 */
function getModelStatusBadge(status) {
  const badges = {
    'available': '<span class="badge bg-green-100 text-green-800 border-green-300"><i class="fas fa-check-circle mr-1"></i>Disponible</span>',
    'exhausted': '<span class="badge bg-yellow-100 text-yellow-800 border-yellow-300"><i class="fas fa-exclamation-triangle mr-1"></i>Agotado</span>',
    'error': '<span class="badge bg-red-100 text-red-800 border-red-300"><i class="fas fa-times-circle mr-1"></i>Error</span>'
  };
  return badges[status] || '<span class="badge bg-gray-100 text-gray-800">Desconocido</span>';
}

/**
 * Formatear tiempo relativo
 */
function formatRelativeTime(isoString) {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  
  if (diffMins < 1) return 'Hace un momento';
  if (diffMins < 60) return `Hace ${diffMins} min`;
  
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `Hace ${diffHours}h`;
  
  const diffDays = Math.floor(diffHours / 24);
  return `Hace ${diffDays}d`;
}

/**
 * Actualizar alertas del sistema
 */
function updateAIAlerts(data) {
  const alertsContainer = document.getElementById('ai-alerts-container');
  if (!alertsContainer) return;

  const alerts = [];

  // Alerta: No hay modelo activo
  if (!data.activeModel) {
    alerts.push({
      type: 'error',
      icon: 'fas fa-exclamation-circle',
      title: '¡Crítico! Sin modelos disponibles',
      message: 'Todos los modelos de IA están agotados o con error. El bot no puede responder.',
      action: 'resetAllAIStats()',
      actionText: 'Resetear Todos'
    });
  }

  // Alerta: Todos los modelos exhaustos excepto uno
  const availableModels = data.models.filter(m => m.status === 'available').length;
  const totalModels = data.models.length;
  
  if (availableModels === 1 && totalModels > 1) {
    alerts.push({
      type: 'warning',
      icon: 'fas fa-exclamation-triangle',
      title: 'Advertencia: Capacidad reducida',
      message: `Solo ${availableModels} de ${totalModels} modelos disponibles. Considera agregar más claves de API.`,
      action: null
    });
  }

  // Alerta: Tasa de error alta
  const errorRate = data.totalRequests > 0 ? (data.totalErrors / data.totalRequests * 100) : 0;
  if (errorRate > 20 && data.totalRequests > 10) {
    alerts.push({
      type: 'warning',
      icon: 'fas fa-chart-line',
      title: 'Tasa de error elevada',
      message: `${errorRate.toFixed(1)}% de las peticiones han fallado. Revisa la configuración de las API keys.`,
      action: null
    });
  }

  // Renderizar alertas
  if (alerts.length === 0) {
    alertsContainer.innerHTML = '';
    return;
  }

  alertsContainer.innerHTML = alerts.map(alert => {
    const colorClasses = {
      'error': 'bg-red-50 border-red-400 text-red-800',
      'warning': 'bg-yellow-50 border-yellow-400 text-yellow-800',
      'info': 'bg-blue-50 border-blue-400 text-blue-800'
    };

    return `
      <div class="p-4 rounded-xl border-2 ${colorClasses[alert.type]} mb-4">
        <div class="flex items-start justify-between">
          <div class="flex items-start">
            <i class="${alert.icon} text-2xl mr-4 mt-1"></i>
            <div>
              <p class="font-bold text-lg mb-1">${alert.title}</p>
              <p class="text-sm">${alert.message}</p>
            </div>
          </div>
          ${alert.action ? `
            <button onclick="${alert.action}" class="btn-secondary ml-4 whitespace-nowrap">
              ${alert.actionText}
            </button>
          ` : ''}
        </div>
      </div>
    `;
  }).join('');
}

/**
 * Actualizar distribución de uso
 */
function updateAIDistribution(data) {
  const distributionList = document.getElementById('distribution-list');
  if (!distributionList) return;

  if (!data.models || data.models.length === 0) {
    distributionList.innerHTML = '<p class="text-sm text-gray-400">Sin datos</p>';
    return;
  }

  const totalRequests = data.totalRequests || 1;

  distributionList.innerHTML = data.models.map(model => {
    const percentage = (model.requestCount / totalRequests * 100).toFixed(1);
    return `
      <div class="text-left">
        <div class="flex items-center justify-between mb-1">
          <span class="text-xs font-medium text-gray-700">${model.name}</span>
          <span class="text-xs font-bold text-gray-800">${percentage}%</span>
        </div>
        <div class="w-full bg-gray-200 rounded-full h-2">
          <div class="bg-green-500 h-2 rounded-full transition-all" style="width: ${percentage}%"></div>
        </div>
        <p class="text-xs text-gray-500 mt-1">${model.requestCount.toLocaleString()} requests</p>
      </div>
    `;
  }).join('');
}

/**
 * Mostrar error en el monitor de IA
 */
function showAIError(message) {
  const alertsContainer = document.getElementById('ai-alerts-container');
  if (!alertsContainer) return;

  alertsContainer.innerHTML = `
    <div class="p-4 rounded-xl border-2 bg-red-50 border-red-400 text-red-800">
      <div class="flex items-center">
        <i class="fas fa-exclamation-circle text-2xl mr-4"></i>
        <div>
          <p class="font-bold">Error</p>
          <p class="text-sm">${message}</p>
        </div>
      </div>
    </div>
  `;
}

/**
 * Refrescar estado de IA manualmente
 */
window.refreshAIStatus = async function() {
  const btn = event?.target?.closest('button');
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Actualizando...';
  }

  await loadAIStatus();

  if (btn) {
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-sync-alt mr-2"></i>Actualizar';
  }
};

/**
 * Resetear estadísticas de todos los modelos
 */
window.resetAllAIStats = async function() {
  if (!confirm('¿Estás seguro de que deseas resetear todas las estadísticas de IA?\n\nEsto reiniciará los contadores de requests y errores, y marcará todos los modelos como disponibles.')) {
    return;
  }

  try {
    const token = localStorage.getItem('token');
    const response = await fetch('/api/ai-reset', {
      method: 'POST',
      headers: { 
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error('Error al resetear estadísticas');
    }

    alert('✅ Estadísticas reseteadas correctamente');
    await loadAIStatus();

  } catch (error) {
    console.error('Error reseteando estadísticas:', error);
    alert('❌ Error al resetear estadísticas: ' + error.message);
  }
};

/**
 * Resetear estadísticas de un modelo específico
 */
window.resetModelStats = async function(modelIdOrName) {
  if (!confirm(`¿Resetear estadísticas de ${modelIdOrName}?`)) {
    return;
  }

  try {
    const token = localStorage.getItem('token');
    const response = await fetch('/api/ai-reset-model', {
      method: 'POST',
      headers: { 
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      // Compatibilidad: enviamos modelId y modelName
      body: JSON.stringify({ modelId: modelIdOrName, modelName: modelIdOrName })
    });

    if (!response.ok) {
      throw new Error('Error al resetear modelo');
    }

    alert(`✅ Estadísticas de ${modelIdOrName} reseteadas`);
    await loadAIStatus();

  } catch (error) {
    console.error('Error reseteando modelo:', error);
    alert('❌ Error: ' + error.message);
  }
};

/**
 * Probar conexión con IA
 */
window.testAIConnection = async function() {
  const btn = event?.target?.closest('button');
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Probando...';
  }

  try {
    const token = localStorage.getItem('token');
    const response = await fetch('/api/ai-test', {
      method: 'POST',
      headers: { 
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ query: 'Hola, esto es una prueba del sistema' })
    });

    const result = await response.json();

    if (response.ok && result.success) {
      alert(`✅ Prueba exitosa!\n\nModelo usado: ${result.modelUsed}\nFallback: ${result.fallbackOccurred ? 'Sí' : 'No'}\nTiempo: ${result.duration}ms`);
    } else {
      alert(`❌ Error en la prueba: ${result.error || 'Desconocido'}`);
    }

    await loadAIStatus();

  } catch (error) {
    console.error('Error probando IA:', error);
    alert('❌ Error al probar conexión: ' + error.message);
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<i class="fas fa-vial mr-2"></i>Probar Conexión';
    }
  }
};

/**
 * Limpiar caché de IA
 */
window.clearCache = async function() {
  if (!confirm('¿Estás seguro de que deseas limpiar el caché de IA?\n\nEsto eliminará todas las respuestas almacenadas y las próximas consultas necesitarán llamar a la API nuevamente.')) {
    return;
  }

  const btn = event?.target?.closest('button');
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Limpiando...';
  }

  try {
    const token = localStorage.getItem('token');
    const response = await fetch('/api/ai-cache-clear', {
      method: 'POST',
      headers: { 
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    const result = await response.json();

    if (response.ok && result.success) {
      alert('✅ Caché limpiado correctamente');
      await loadCacheStats();
    } else {
      alert(`❌ Error: ${result.error || 'Desconocido'}`);
    }

  } catch (error) {
    console.error('Error limpiando caché:', error);
    alert('❌ Error al limpiar caché: ' + error.message);
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<i class="fas fa-broom mr-2"></i>Limpiar Caché';
    }
  }
};

/**
 * Exportar estadísticas de IA
 */
window.exportAIStats = async function() {
  try {
    const token = localStorage.getItem('token');
    const response = await fetch('/api/ai-status', {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!response.ok) {
      throw new Error('Error al obtener estadísticas');
    }

    const data = await response.json();
    
    // Crear archivo CSV
    const csv = generateAIStatsCSV(data);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ai-stats-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);

    alert('✅ Estadísticas exportadas correctamente');

  } catch (error) {
    console.error('Error exportando estadísticas:', error);
    alert('❌ Error al exportar: ' + error.message);
  }
};

/**
 * Generar CSV de estadísticas
 */
function generateAIStatsCSV(data) {
  let csv = 'Modelo,Estado,Prioridad,Requests,Errores,Tasa Éxito,Último Error,Fecha Último Error\n';
  
  data.models.forEach(model => {
    const successRate = model.requestCount > 0 
      ? ((model.requestCount - model.errorCount) / model.requestCount * 100).toFixed(1)
      : 100;
    
    csv += `"${model.name}","${model.status}",${model.priority},${model.requestCount},${model.errorCount},${successRate}%,"${model.lastError || ''}","${model.lastErrorTime || ''}"\n`;
  });

  csv += `\nResumen General\n`;
  csv += `Total Requests,${data.totalRequests}\n`;
  csv += `Total Errores,${data.totalErrors}\n`;
  csv += `Modelo Activo,"${data.activeModel || 'Ninguno'}"\n`;

  return csv;
}

// Limpiar intervalo cuando se cambia de sección
const originalShowSection = window.showSection;
window.showSection = function(sectionId) {
  if (window.aiMonitorInterval && sectionId !== 'ai-monitor') {
    clearInterval(window.aiMonitorInterval);
    window.aiMonitorInterval = null;
  }
  originalShowSection(sectionId);
};

/**
 * Solicitar código de vinculación (Pairing Code)
 */
window.requestPairingCode = async function() {
  console.log('=== SOLICITANDO PAIRING CODE ===');
  
  const phoneInput = document.getElementById('pairing-phone-input');
  const codeDisplay = document.getElementById('pairing-code-display');
  const errorDisplay = document.getElementById('pairing-error-display');
  const loadingDisplay = document.getElementById('pairing-loading');
  const codeValue = document.getElementById('pairing-code-value');
  const errorMessage = document.getElementById('pairing-error-message');
  const btn = document.getElementById('btn-get-pairing-code');
  
  if (!phoneInput) {
    console.error('pairing-phone-input not found');
    return;
  }
  
  const phoneNumber = phoneInput.value.trim();
  
  // Validar número
  if (!phoneNumber) {
    alert('Por favor ingresa tu número de teléfono');
    phoneInput.focus();
    return;
  }
  
  // Validar formato (solo dígitos, entre 10 y 15 caracteres)
  const cleanPhone = phoneNumber.replace(/[\s\-\(\)\+]/g, '');
  if (!/^\d{10,15}$/.test(cleanPhone)) {
    alert('Número inválido. Debe contener entre 10 y 15 dígitos.\nEjemplo: 521234567890');
    phoneInput.focus();
    return;
  }
  
  // Resetear displays
  resetPairingCodeDisplay();
  
  // Mostrar loading
  if (loadingDisplay) loadingDisplay.classList.remove('hidden');
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Generando...';
  }
  
  try {
    const token = localStorage.getItem('token');
    if (!token) {
      throw new Error('No hay token de autenticación');
    }
    
    console.log('Solicitando pairing code para:', cleanPhone);
    
    const response = await fetch('/api/pairing-code', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ phoneNumber: cleanPhone })
    });
    
    const result = await response.json();
    console.log('Respuesta del servidor:', result);
    
    // Ocultar loading
    if (loadingDisplay) loadingDisplay.classList.add('hidden');
    
    if (!response.ok || !result.success) {
      // Mostrar error
      throw new Error(result.error || 'Error al generar código');
    }
    
    // Mostrar código exitoso
    if (result.code && codeValue && codeDisplay) {
      // Formatear código (agregar guión en medio para mejor legibilidad)
      // Ej: "ABCD1234" -> "ABCD-1234"
      const formattedCode = result.code.length === 8 
        ? `${result.code.substring(0, 4)}-${result.code.substring(4)}`
        : result.code;
      
      codeValue.textContent = formattedCode;
      codeDisplay.classList.remove('hidden');
      
      console.log('✅ Pairing code generado exitosamente:', result.code);
      
      // Opcional: Copiar al portapapeles automáticamente
      try {
        await navigator.clipboard.writeText(result.code);
        console.log('Código copiado al portapapeles');
      } catch (e) {
        console.log('No se pudo copiar al portapapeles:', e);
      }
    }
    
  } catch (error) {
    console.error('Error solicitando pairing code:', error);
    
    // Ocultar loading
    if (loadingDisplay) loadingDisplay.classList.add('hidden');
    
    // Mostrar error
    if (errorDisplay && errorMessage) {
      errorMessage.textContent = error.message || 'Error desconocido al generar código';
      errorDisplay.classList.remove('hidden');
    } else {
      alert(`Error: ${error.message || 'No se pudo generar el código de vinculación'}`);
    }
    
  } finally {
    // Rehabilitar botón
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<i class="fas fa-key mr-2"></i>Obtener Código';
    }
  }
};

// ==========================================
// 🔧 GESTIÓN DE INSTANCIAS WHATSAPP
// Emergency Dashboard Functions
// ==========================================

/**
 * Cargar estado de la instancia actual
 */
window.loadInstanceStatus = async function() {
  const statusIndicator = document.getElementById('instance-status-indicator');
  const statusText = document.getElementById('instance-status-text');
  const statusDetails = document.getElementById('instance-status-details');
  const instancesList = document.getElementById('instances-list-container');

  try {
    // Mostrar loading
    if (statusText) statusText.textContent = 'Verificando...';
    if (statusIndicator) statusIndicator.className = 'w-4 h-4 rounded-full bg-gray-400 animate-pulse';

    const token = localStorage.getItem('token');
    if (!token) {
      throw new Error('No hay token de autenticación');
    }

    const response = await fetch('/crm/whatsapp/instances', {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Error al obtener estado');
    }

    const data = await response.json();
    console.log('Estado de instancias:', data);

    // Actualizar indicador de estado
    if (data.current.exists) {
      const status = data.current.status;
      let statusColor = 'bg-gray-400';
      let statusEmoji = '⚪';
      let statusLabel = 'Desconocido';

      if (status === 'open') {
        statusColor = 'bg-green-500';
        statusEmoji = '🟢';
        statusLabel = 'Conectado';
      } else if (status === 'connecting') {
        statusColor = 'bg-yellow-500 animate-pulse';
        statusEmoji = '🟡';
        statusLabel = 'Conectando... (puede estar bugeado)';
      } else if (status === 'close') {
        statusColor = 'bg-red-500';
        statusEmoji = '🔴';
        statusLabel = 'Desconectado';
      }

      if (statusIndicator) statusIndicator.className = `w-4 h-4 rounded-full ${statusColor}`;
      if (statusText) statusText.textContent = `${statusEmoji} ${statusLabel}`;
      if (statusDetails) statusDetails.textContent = `Instancia: ${data.current.instanceName || 'N/A'}`;
    } else {
      if (statusIndicator) statusIndicator.className = 'w-4 h-4 rounded-full bg-gray-400';
      if (statusText) statusText.textContent = '⚪ No existe instancia';
      if (statusDetails) statusDetails.textContent = 'La instancia no ha sido creada';
    }

    // Actualizar lista de instancias
    if (instancesList) {
      if (data.allInstances && data.allInstances.length > 0) {
        instancesList.innerHTML = `
          <table class="w-full text-sm">
            <thead class="bg-gray-50">
              <tr>
                <th class="px-4 py-2 text-left font-semibold">Nombre</th>
                <th class="px-4 py-2 text-left font-semibold">Estado</th>
              </tr>
            </thead>
            <tbody>
              ${data.allInstances.map(inst => {
                let statusBadge = 'bg-gray-200 text-gray-700';
                if (inst.status === 'open') statusBadge = 'bg-green-100 text-green-700';
                else if (inst.status === 'connecting') statusBadge = 'bg-yellow-100 text-yellow-700';
                else if (inst.status === 'close') statusBadge = 'bg-red-100 text-red-700';

                return `
                  <tr class="border-t border-gray-200">
                    <td class="px-4 py-2 font-mono text-xs">${inst.instanceName || 'N/A'}</td>
                    <td class="px-4 py-2">
                      <span class="px-2 py-1 rounded text-xs font-semibold ${statusBadge}">
                        ${inst.status || 'unknown'}
                      </span>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        `;
      } else {
        instancesList.innerHTML = '<p class="text-sm text-gray-500">No se encontraron instancias en el servidor</p>';
      }
    }

  } catch (error) {
    console.error('Error cargando estado de instancias:', error);
    
    if (statusIndicator) statusIndicator.className = 'w-4 h-4 rounded-full bg-red-500';
    if (statusText) statusText.textContent = '❌ Error al verificar';
    if (statusDetails) statusDetails.textContent = error.message || 'Error desconocido';
    
    if (instancesList) {
      // Detectar si es error 403
      const is403Error = error.message?.includes('403') || error.message?.includes('permisos');
      
      instancesList.innerHTML = `
        <div class="bg-red-50 border-2 border-red-300 rounded-lg p-4">
          <div class="flex items-start">
            <i class="fas fa-exclamation-triangle text-red-600 text-xl mr-3 mt-1"></i>
            <div class="flex-1">
              <p class="text-sm font-bold text-red-800 mb-2">
                ${is403Error ? '⛔ Error 403: API Key sin permisos' : 'Error al cargar instancias'}
              </p>
              <p class="text-xs text-red-700 mb-3">
                ${error.message || 'Error desconocido'}
              </p>
              ${is403Error ? `
                <div class="bg-yellow-50 border border-yellow-300 rounded p-3 mb-3">
                  <p class="text-xs font-bold text-gray-800 mb-2">🔧 Solución:</p>
                  <ol class="text-xs text-gray-700 space-y-1 ml-4 list-decimal">
                    <li>Ve a <strong>Easypanel > Evolution API</strong></li>
                    <li>Busca la sección <strong>"Global API Key"</strong> o <strong>"API Keys"</strong></li>
                    <li>Copia la <strong>API Key Maestra</strong> (Global)</li>
                    <li>Actualiza la variable <code class="bg-gray-200 px-1 rounded">EVOLUTION_APIKEY</code> en tu proyecto</li>
                    <li>Reinicia el servicio</li>
                  </ol>
                </div>
              ` : ''}
            </div>
          </div>
        </div>
      `;
    }
  }
};

/**
 * 🔴 Forzar eliminación de instancia
 */
window.deleteInstanceEmergency = async function() {
  if (!confirm('⚠️ ¿Estás seguro de que deseas ELIMINAR la instancia?\n\nEsto borrará la instancia actual de WhatsApp. Deberás crear una nueva después.')) {
    return;
  }

  try {
    const token = localStorage.getItem('token');
    if (!token) {
      throw new Error('No hay token de autenticación');
    }

    // Mostrar loading
    const statusText = document.getElementById('instance-status-text');
    if (statusText) statusText.textContent = '🗑️ Eliminando instancia...';

    const response = await fetch('/crm/whatsapp/delete-instance', {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });

    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(result.error || result.details || 'Error al eliminar instancia');
    }

    alert(`✅ ${result.message}`);
    
    // Recargar estado
    await loadInstanceStatus();

  } catch (error) {
    console.error('Error eliminando instancia:', error);
    alert(`❌ Error: ${error.message || 'No se pudo eliminar la instancia'}`);
    
    // Recargar estado de todas formas
    await loadInstanceStatus();
  }
};

/**
 * 🟢 Re-crear instancia (force=true)
 */
window.createInstanceEmergency = async function() {
  if (!confirm('⚠️ ¿Estás seguro de que deseas RE-CREAR la instancia?\n\nEsto eliminará la instancia actual (si existe) y creará una nueva desde cero.')) {
    return;
  }

  try {
    const token = localStorage.getItem('token');
    if (!token) {
      throw new Error('No hay token de autenticación');
    }

    // Mostrar loading
    const statusText = document.getElementById('instance-status-text');
    if (statusText) statusText.textContent = '🔄 Recreando instancia...';

    const response = await fetch('/crm/whatsapp/create-instance', {
      method: 'POST',
      headers: { 
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    const result = await response.json();

    if (!response.ok || !result.success) {
      // Error 403 específico
      if (response.status === 403) {
        throw new Error('⛔ Error 403: Tu API Key no tiene permisos suficientes.\n\nVerifica en Easypanel que estés usando una API Key MAESTRA (Global), no una API Key de instancia específica.');
      }
      throw new Error(result.error || result.details || 'Error al crear instancia');
    }

    let message = `✅ ${result.message}\n\nAcción: ${result.action}\nEstado: ${result.instance?.status || 'N/A'}`;
    
    // Si la instancia no aparece inmediatamente, agregar nota
    if (!result.instance) {
      message += '\n\n⏳ La instancia puede tardar unos segundos en aparecer en la lista.\n\n¿Deseas esperar 5 segundos y recargar el estado?';
      
      if (confirm(message)) {
        // Mostrar loading
        const statusText = document.getElementById('instance-status-text');
        if (statusText) statusText.textContent = '⏳ Esperando a que la instancia aparezca...';
        
        // Esperar 5 segundos
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        // Recargar estado
        await loadInstanceStatus();
        
        // Recargar QR
        if (currentPage === 'settings') {
          setTimeout(() => {
            loadQRCode();
          }, 1000);
        }
      }
    } else {
      alert(message);
      
      // Recargar estado y QR
      await loadInstanceStatus();
      
      // Si estamos en la pestaña de WhatsApp, recargar QR
      if (currentPage === 'settings') {
        setTimeout(() => {
          loadQRCode();
        }, 2000);
      }
    }

  } catch (error) {
    console.error('Error creando instancia:', error);
    alert(`❌ Error: ${error.message || 'No se pudo crear la instancia'}`);
    
    // Recargar estado de todas formas
    await loadInstanceStatus();
  }
};

/**
 * 🔄 Autocuración de instancia (limpia estados bugeados)
 */
window.healInstanceEmergency = async function() {
  if (!confirm('🔄 ¿Ejecutar autocuración de instancia?\n\nEsto detectará automáticamente si la instancia está en un estado "bugeado" (connecting infinito o desconectada) y la limpiará/recreará si es necesario.')) {
    return;
  }

  try {
    const token = localStorage.getItem('token');
    if (!token) {
      throw new Error('No hay token de autenticación');
    }

    // Mostrar loading
    const statusText = document.getElementById('instance-status-text');
    if (statusText) statusText.textContent = '🔄 Ejecutando autocuración...';

    const response = await fetch('/crm/whatsapp/heal-instance', {
      method: 'POST',
      headers: { 
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(result.error || result.details || 'Error en autocuración');
    }

    let message = `✅ ${result.message}\n\nAcción realizada: ${result.action}`;
    
    if (result.action === 'exists') {
      message += '\n\n✨ La instancia está OK, no se requirió ninguna acción.';
    } else if (result.action === 'created') {
      message += '\n\n✨ Se creó una nueva instancia desde cero.';
    } else if (result.action === 'cleaned') {
      message += '\n\n✨ Se detectó un estado bugeado y se limpió exitosamente.';
    }
    
    if (result.instance?.status) {
      message += `\n\nEstado actual: ${result.instance.status}`;
    }

    alert(message);
    
    // Recargar estado y QR
    await loadInstanceStatus();
    
    // Si estamos en la pestaña de WhatsApp, recargar QR
    if (currentPage === 'settings') {
      setTimeout(() => {
        loadQRCode();
      }, 2000);
    }

  } catch (error) {
    console.error('Error en autocuración:', error);
    alert(`❌ Error: ${error.message || 'No se pudo ejecutar la autocuración'}`);
    
    // Recargar estado de todas formas
    await loadInstanceStatus();
  }
};

// Cargar estado de instancias cuando se abre la pestaña de WhatsApp
const originalShowSettingsTab = window.showSettingsTab;
window.showSettingsTab = function(tabName) {
  if (originalShowSettingsTab) {
    originalShowSettingsTab(tabName);
  }
  
  // Si se abre la pestaña de WhatsApp, cargar estado de instancias
  if (tabName === 'whatsapp') {
    setTimeout(() => {
      loadInstanceStatus();
    }, 500);
  }
};