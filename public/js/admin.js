document.addEventListener('DOMContentLoaded', function () {
  let currentUser = null;
  let currentPage = 'contacts';
  let contactsPage = 1;
  let contactsSearch = '';
  let templates = [];

  // Check authentication
  checkAuth();

  // Tab switching
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', function (e) {
      e.preventDefault();

      // Remove active class from all tabs
      document.querySelectorAll('.nav-item').forEach(navItem => {
        navItem.classList.remove('active');
        navItem.classList.remove('bg-gray-100');
        navItem.classList.remove('text-primary');
      });

      // Add active class to clicked tab
      this.classList.add('active');

      // Hide all sections
      document.querySelectorAll('.section-content').forEach(section => {
        section.classList.add('hidden');
      });

      // Show corresponding section
      if (this.id === 'dashboard-tab') {
        document.getElementById('dashboard-section').classList.remove('hidden');
        currentPage = 'dashboard';
        loadDashboardData();
      } else if (this.id === 'contacts-tab') {
        document.getElementById('contacts-section').classList.remove('hidden');
        currentPage = 'contacts';
        loadContacts();
      } else if (this.id === 'campaigns-tab') {
        document.getElementById('campaigns-section').classList.remove('hidden');
        currentPage = 'campaigns';
        loadCampaigns();
      } else if (this.id === 'new-campaign-tab') {
        document.getElementById('new-campaign-section').classList.remove('hidden');
        currentPage = 'new-campaign';
        loadAvailableContacts();
      } else if (this.id === 'templates-tab') {
        document.getElementById('templates-section').classList.remove('hidden');
        currentPage = 'templates';
        loadTemplates();
      } else if (this.id === 'settings-tab') {
        document.getElementById('settings-section').classList.remove('hidden');
        currentPage = 'settings';
        loadBotConfig();
        loadWhatsAppStatus();
      } else if (this.id === 'notifications-tab') {
        document.getElementById('notifications-section').classList.remove('hidden');
        currentPage = 'notifications';
        loadNotifications();
      } else if (this.id === 'users-tab') {
        hideAllSections();
        document.getElementById('users-section').classList.remove('hidden');
        document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
        this.classList.add('active');
        currentPage = 'users';
        loadUsers();
      }
    });
  });

  let currentSaleStatusFilter = '';

  // Search contacts
  document.getElementById('contact-search')?.addEventListener('input', function () {
    contactsSearch = this.value;
    loadContacts();
  });

  // Sale status filter
  document.getElementById('sale-status-filter')?.addEventListener('change', function () {
    currentSaleStatusFilter = this.value;
    loadContacts();
  });

  // Logout
  document.getElementById('logout').addEventListener('click', function () {
    localStorage.removeItem('token');
    window.location.href = '/admin/login';
  });

  // Campaign form
  document.getElementById('campaign-form')?.addEventListener('submit', function (e) {
    e.preventDefault();
    createCampaign();
  });

  // Initial load
  if (currentPage === 'contacts') {
    document.getElementById('contacts-tab').classList.add('active');
    loadContacts();
  }

  // Functions
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
      document.getElementById('username').textContent = currentUser.username;
    } catch (error) {
      localStorage.removeItem('token');
      window.location.href = '/admin/login';
    }
  }

  async function loadDashboardData() {
    try {
      // Load statistics from new endpoint
      const statsRes = await fetch('/crm/statistics', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });

      if (!statsRes.ok) throw new Error('Failed to load statistics');

      const stats = await statsRes.json();

      // Update main stats by sale status - nuevos estados (con verificación null-safe)
      const updateElement = (id, value) => {
        const element = document.getElementById(id);
        if (element) {
          element.textContent = value || 0;
        }
      };

      updateElement('leads-count', stats.contacts.byStatus.leads || 0);
      updateElement('interested-contacts', stats.contacts.byStatus.interested || 0);
      updateElement('info-requested-count', stats.contacts.byStatus.infoRequested || 0);
      updateElement('payment-pending-count', stats.contacts.byStatus.paymentPending || 0);
      updateElement('appointment-scheduled-count', stats.contacts.byStatus.appointmentScheduled || 0);
      updateElement('appointment-confirmed-count', stats.contacts.byStatus.appointmentConfirmed || 0);
      updateElement('completed-count', stats.contacts.byStatus.completed || 0);
      updateElement('paused-contacts', stats.contacts.byStatus.paused || 0);
      updateElement('total-contacts', stats.contacts.total);
      
      const recentContactsText = document.getElementById('recent-contacts-text');
      if (recentContactsText) {
        recentContactsText.textContent = `${stats.contacts.recent} nuevos esta semana`;
      }
      
      // Update secondary stats
      updateElement('total-campaigns', stats.campaigns.total);
      
      const sentCampaignsText = document.getElementById('sent-campaigns-text');
      if (sentCampaignsText) {
        sentCampaignsText.textContent = `${stats.campaigns.sent} enviadas`;
      }
      
      updateElement('total-messages', stats.campaigns.totalMessagesSent);
      updateElement('total-interactions', stats.sales.totalInteractions);
      
      const uniqueUsersText = document.getElementById('unique-users-text');
      if (uniqueUsersText) {
        uniqueUsersText.textContent = `${stats.sales.uniqueUsers} usuarios únicos`;
      }

      // Render intent stats
      renderIntentStats(stats.sales.intentCounts);

      // Render top leads
      renderTopLeads(stats.topLeads);

      // Load recent contacts for the table
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
    container.innerHTML = '';

    const intentLabels = {
      'info': { label: 'Información', emoji: 'ℹ️', color: 'blue' },
      'price': { label: 'Precio', emoji: '💰', color: 'green' },
      'product': { label: 'Producto', emoji: '📦', color: 'purple' },
      'payment': { label: 'Pago', emoji: '💳', color: 'yellow' },
      'purchase': { label: 'Compra', emoji: '🛒', color: 'red' },
      'objection': { label: 'Objeción', emoji: '❓', color: 'orange' },
      'other': { label: 'Otro', emoji: '💬', color: 'gray' }
    };

    Object.entries(intentCounts).forEach(([intent, count]) => {
      const intentData = intentLabels[intent] || { label: intent, emoji: '💬', color: 'gray' };
      const div = document.createElement('div');
      div.className = 'flex items-center justify-between mb-4';
      div.innerHTML = `
        <div class="flex items-center space-x-3">
          <span class="text-2xl">${intentData.emoji}</span>
          <span class="text-sm font-medium text-gray-700">${intentData.label}</span>
        </div>
        <span class="text-lg font-semibold text-gray-800">${count}</span>
      `;
      container.appendChild(div);
    });

    if (Object.keys(intentCounts).length === 0) {
      container.innerHTML = '<p class="text-gray-500 text-center py-4">No hay datos aún</p>';
    }
  }

  function renderTopLeads(leads) {
    const tbody = document.getElementById('top-leads-table');
    tbody.innerHTML = '';

    if (leads.length === 0) {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td colspan="4" class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-center">No hay leads aún</td>`;
      tbody.appendChild(tr);
      return;
    }

    leads.forEach((lead, index) => {
      const tr = document.createElement('tr');
      tr.className = 'table-row';
      tr.innerHTML = `
        <td class="px-6 py-4 whitespace-nowrap">
          <div class="text-sm text-gray-800 font-medium">${lead.name}</div>
          <div class="text-xs text-gray-500">${lead.phoneNumber}</div>
        </td>
        <td class="px-6 py-4 whitespace-nowrap">
          <span class="px-2 py-1 text-xs font-semibold rounded-full ${lead.score >= 10 ? 'bg-green-100 text-green-800' : lead.score >= 5 ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-800'}">
            ${lead.score || 0}
          </span>
        </td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${lead.interactionsCount || 0}</td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
          <button onclick="openChatModal('${lead.phoneNumber}', '${lead.name || lead.phoneNumber}')" 
            class="message-btn inline-flex items-center px-3 py-1 border border-transparent text-xs leading-4 font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-colors">
            <i class="fas fa-paper-plane mr-1"></i> Contactar
          </button>
        </td>
      `;
      tbody.appendChild(tr);
    });
  }

  function renderRecentContacts(contacts) {
    const container = document.getElementById('recent-contacts');
    container.innerHTML = '';

    contacts.forEach(contact => {
      const tr = document.createElement('tr');
      tr.className = 'hover:bg-gray-50';
      tr.innerHTML = `
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-800">
          ${contact.name || contact.pushName || 'Unknown'}
        </td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-800">
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
      
      if (currentSaleStatusFilter) {
        if (currentSaleStatusFilter === 'paused') {
          // Para pausados, usar un filtro diferente
          // Los pausados se manejarán en el frontend
        } else {
          params.append('saleStatus', currentSaleStatusFilter);
        }
      }

      const response = await fetch(`/crm/contacts?${params.toString()}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });

      if (!response.ok) throw new Error('Failed to load contacts');

      let { data, meta } = await response.json();
      
      // Filtrar pausados si es necesario
      if (currentSaleStatusFilter === 'paused') {
        data = data.filter(contact => contact.isPaused === true);
        meta.total = data.length;
        meta.pages = Math.ceil(meta.total / Number(meta.limit));
      }
      
      renderContacts(data);
      renderContactsPagination(meta);
      updateContactsPaginationInfo(meta);
    } catch (error) {
      console.error('Error loading contacts:', error);
      alert('Error al cargar contactos');
    }
  }

  function renderContacts(contacts) {
    const tbody = document.getElementById('contacts-table-body');
    tbody.innerHTML = '';

    if (contacts.length === 0) {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td colspan="6" class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-center">No se encontraron contactos</td>`;
      tbody.appendChild(tr);
      return;
    }

    const statusLabels = {
      'lead': { label: 'Lead', color: 'gray', bg: 'bg-gray-100 text-gray-800' },
      'interested': { label: 'Interesado', color: 'blue', bg: 'bg-blue-100 text-blue-800' },
      'info_requested': { label: 'Info Solicitada', color: 'indigo', bg: 'bg-indigo-100 text-indigo-800' },
      'payment_pending': { label: 'Pago Pendiente', color: 'yellow', bg: 'bg-yellow-100 text-yellow-800' },
      'appointment_scheduled': { label: 'Cita Agendada', color: 'orange', bg: 'bg-orange-100 text-orange-800' },
      'appointment_confirmed': { label: 'Cita Confirmada', color: 'green', bg: 'bg-green-100 text-green-800' },
      'completed': { label: 'Completado', color: 'green', bg: 'bg-green-100 text-green-800' }
    };

    contacts.forEach(contact => {
      const status = statusLabels[contact.saleStatus || 'lead'] || statusLabels['lead'];
      const isPaused = contact.isPaused || false;
      const tr = document.createElement('tr');
      tr.className = 'table-row';
      tr.innerHTML = `
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-800">${contact.phoneNumber}</td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-800">${contact.name || contact.pushName || '-'}</td>
        <td class="px-6 py-4 whitespace-nowrap">
          <span class="px-2 py-1 text-xs font-semibold rounded-full ${status.bg}">
            ${status.label}
          </span>
        </td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${formatDate(contact.lastInteraction)}</td>
        <td class="px-6 py-4 whitespace-nowrap">
          <span class="px-2 py-1 text-xs font-semibold rounded-full ${isPaused ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-800'}">
            ${isPaused ? 'Pausado' : 'Activo'}
          </span>
        </td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
          <div class="flex flex-wrap gap-2">
            <button onclick="openStatusModal('${contact.phoneNumber}', '${contact.saleStatus || 'lead'}', '${contact.appointmentDate || ''}')" 
              class="inline-flex items-center px-2 py-1 border border-transparent text-xs leading-4 font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors">
              <i class="fas fa-edit mr-1"></i> Estado
            </button>
            <button onclick="togglePauseContact('${contact.phoneNumber}', ${isPaused})" 
              class="inline-flex items-center px-2 py-1 border border-transparent text-xs leading-4 font-medium rounded-md text-white ${isPaused ? 'bg-green-600 hover:bg-green-700' : 'bg-orange-600 hover:bg-orange-700'} focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-${isPaused ? 'green' : 'orange'}-500 transition-colors">
              <i class="fas fa-${isPaused ? 'play' : 'pause'} mr-1"></i> ${isPaused ? 'Reanudar' : 'Pausar'}
            </button>
            ${contact.saleStatus === 'payment_pending' ? `
            <button onclick="confirmPayment('${contact.phoneNumber}')" 
              class="inline-flex items-center px-2 py-1 border border-transparent text-xs leading-4 font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-colors">
              <i class="fas fa-check mr-1"></i> Confirmar Pago
            </button>` : ''}
            ${contact.saleStatus === 'appointment_scheduled' ? `
            <button onclick="confirmAppointment('${contact.phoneNumber}')" 
              class="inline-flex items-center px-2 py-1 border border-transparent text-xs leading-4 font-medium rounded-md text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 transition-colors">
              <i class="fas fa-calendar-check mr-1"></i> Confirmar Cita
            </button>` : ''}
                                <button onclick="openMessageModal('${contact.phoneNumber}', '${contact.name || contact.pushName || contact.phoneNumber}')" 
                                class="message-btn inline-flex items-center px-2 py-1 border border-transparent text-xs leading-4 font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-colors">
                                <i class="fas fa-comments mr-1"></i> Chat
                                </button>
          </div>
        </td>
      `;
      tbody.appendChild(tr);
    });
  }

  function updateContactsPaginationInfo(meta) {
    const start = (meta.page - 1) * meta.limit + 1;
    const end = Math.min(meta.page * meta.limit, meta.total);
    document.getElementById('contacts-start').textContent = start;
    document.getElementById('contacts-end').textContent = end;
    document.getElementById('contacts-total').textContent = meta.total;
  }

  function renderContactsPagination(meta) {
    const paginationDiv = document.getElementById('contacts-pagination');
    paginationDiv.innerHTML = '';

    if (meta.pages <= 1) return;

    // Previous button
    const prevButton = document.createElement('button');
    prevButton.className = 'px-3 py-1 border border-gray-300 rounded-md' +
      (meta.page === 1 ? ' opacity-50 cursor-not-allowed' : ' hover:bg-gray-50');
    prevButton.innerHTML = '<i class="fas fa-chevron-left"></i>';
    prevButton.disabled = meta.page === 1;
    prevButton.addEventListener('click', () => loadContacts(meta.page - 1));
    paginationDiv.appendChild(prevButton);

    // Page numbers
    const maxVisiblePages = 5;
    let startPage = Math.max(1, meta.page - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(meta.pages, startPage + maxVisiblePages - 1);

    if (endPage - startPage + 1 < maxVisiblePages) {
      startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }

    if (startPage > 1) {
      const firstPageButton = document.createElement('button');
      firstPageButton.className = 'px-3 py-1 border border-gray-300 rounded-md hover:bg-gray-50';
      firstPageButton.textContent = '1';
      firstPageButton.addEventListener('click', () => loadContacts(1));
      paginationDiv.appendChild(firstPageButton);

      if (startPage > 2) {
        const ellipsis = document.createElement('span');
        ellipsis.className = 'px-2 py-1';
        ellipsis.textContent = '...';
        paginationDiv.appendChild(ellipsis);
      }
    }

    for (let i = startPage; i <= endPage; i++) {
      const pageButton = document.createElement('button');
      pageButton.className = 'px-3 py-1 border border-gray-300 rounded-md' +
        (i === meta.page ? ' bg-gray-800 text-white' : ' hover:bg-gray-50');
      pageButton.textContent = i;
      pageButton.addEventListener('click', () => loadContacts(i));
      paginationDiv.appendChild(pageButton);
    }

    if (endPage < meta.pages) {
      if (endPage < meta.pages - 1) {
        const ellipsis = document.createElement('span');
        ellipsis.className = 'px-2 py-1';
        ellipsis.textContent = '...';
        paginationDiv.appendChild(ellipsis);
      }

      const lastPageButton = document.createElement('button');
      lastPageButton.className = 'px-3 py-1 border border-gray-300 rounded-md hover:bg-gray-50';
      lastPageButton.textContent = meta.pages;
      lastPageButton.addEventListener('click', () => loadContacts(meta.pages));
      paginationDiv.appendChild(lastPageButton);
    }

    // Next button
    const nextButton = document.createElement('button');
    nextButton.className = 'px-3 py-1 border border-gray-300 rounded-md' +
      (meta.page === meta.pages ? ' opacity-50 cursor-not-allowed' : ' hover:bg-gray-50');
    nextButton.innerHTML = '<i class="fas fa-chevron-right"></i>';
    nextButton.disabled = meta.page === meta.pages;
    nextButton.addEventListener('click', () => loadContacts(meta.page + 1));
    paginationDiv.appendChild(nextButton);
  }

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
      alert('Failed to load campaigns');
    }
  }

  function renderCampaigns(campaigns) {
    const tbody = document.getElementById('campaigns-table-body');
    tbody.innerHTML = '';

    if (campaigns.length === 0) {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td colspan="6" class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-center">No campaigns found</td>`;
      tbody.appendChild(tr);
      return;
    }

    campaigns.forEach(campaign => {
      const tr = document.createElement('tr');
      tr.className = 'table-row';
      tr.innerHTML = `
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-800">${campaign.name}</td>
        <td class="px-6 py-4 whitespace-nowrap">
          <span class="badge ${campaign.status === 'sent' ? 'badge-sent' :
          campaign.status === 'scheduled' ? 'badge-scheduled' :
            campaign.status === 'failed' ? 'badge-failed' :
              'badge-draft'
        }">${campaign.status}</span>
        </td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${campaign.scheduledAt ? formatDate(campaign.scheduledAt) : '-'}</td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${campaign.sentCount || 0}</td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${campaign.failedCount || 0}</td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
          <button class="text-gray-600 hover:text-gray-900" onclick="viewCampaign('${campaign._id}')">
            <i class="fas fa-eye"></i>
          </button>
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
      alert('Failed to load contacts');
    }
  }

  function renderAvailableContacts(contacts) {
    const container = document.getElementById('available-contacts');
    container.innerHTML = '';

    contacts.forEach(contact => {
      const div = document.createElement('div');
      div.className = 'flex items-center p-2 hover:bg-gray-50 rounded-lg cursor-pointer';
      div.innerHTML = `
        <input type="checkbox" id="contact-${contact.phoneNumber}" 
          class="contact-checkbox hidden" value="${contact.phoneNumber}">
        <label for="contact-${contact.phoneNumber}" 
          class="contact-label flex-grow flex items-center justify-between p-2 rounded-lg cursor-pointer">
          <span class="text-sm text-gray-800">${contact.name || contact.phoneNumber}</span>
          <span class="text-xs text-gray-500">${contact.phoneNumber}</span>
        </label>
      `;
      div.querySelector('input').addEventListener('change', function () {
        if (this.checked) {
          addContactToCampaign(contact.phoneNumber, contact.name || contact.phoneNumber);
        } else {
          removeContactFromCampaign(contact.phoneNumber);
        }
      });
      container.appendChild(div);
    });
  }

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
      alert('Failed to load templates');
    }
  }

  function renderTemplates(templates) {
    const container = document.getElementById('templates-container');
    container.innerHTML = '';

    if (templates.length === 0) {
      container.innerHTML = `
        <div class="col-span-full text-center py-8 text-gray-500">
          No templates found
        </div>
      `;
      return;
    }

    templates.forEach(template => {
      const div = document.createElement('div');
      div.className = 'border border-gray-200 rounded-lg overflow-hidden hover:shadow-md transition-shadow';
      div.dataset.templateId = template._id;
      div.innerHTML = `
        <div class="p-4 border-b border-gray-200">
          <h3 class="font-medium text-gray-800">${template.name}</h3>
        </div>
        <div class="p-4 bg-gray-50">
          <p class="text-sm text-gray-600 mb-4 whitespace-pre-line">${template.content}</p>
          <div class="flex justify-end space-x-2">
            <button onclick="useTemplate('${template._id}')" class="text-sm text-green-600 hover:text-green-800">
              Use
            </button>
            <button onclick="openEditTemplateModal('${template._id}', '${template.name.replace(/'/g, "\\'")}', '${template.content.replace(/'/g, "\\'")}')" class="text-sm text-blue-600 hover:text-blue-800">
              Edit
            </button>
            <button onclick="deleteTemplate('${template._id}')" class="text-sm text-red-600 hover:text-red-800">
              Delete
            </button>
          </div>
        </div>
      `;
      container.appendChild(div);
    });
  }

  function addContactToCampaign(phoneNumber, name) {
    const selectedContactsDiv = document.getElementById('selected-contacts');
    const noContactsMessage = document.getElementById('no-contacts-message');

    // Check if already added
    if (document.querySelector(`[data-phone="${phoneNumber}"]`)) {
      return;
    }

    const contactDiv = document.createElement('div');
    contactDiv.className = 'flex justify-between items-center p-2 hover:bg-gray-50 rounded-lg';
    contactDiv.dataset.phone = phoneNumber;
    contactDiv.innerHTML = `
      <span class="text-sm text-gray-800">${name}</span>
      <button class="text-gray-500 hover:text-gray-700" 
        onclick="removeContactFromCampaign('${phoneNumber}')">
        <i class="fas fa-times"></i>
      </button>
    `;

    if (noContactsMessage) {
      noContactsMessage.remove();
    }

    selectedContactsDiv.appendChild(contactDiv);
  }

  function removeContactFromCampaign(phoneNumber) {
    const contactDiv = document.querySelector(`[data-phone="${phoneNumber}"]`);
    if (contactDiv) {
      contactDiv.remove();
    }

    const selectedContactsDiv = document.getElementById('selected-contacts');
    if (selectedContactsDiv.children.length === 0) {
      selectedContactsDiv.innerHTML = '<p class="text-gray-400 text-sm" id="no-contacts-message">No contacts selected</p>';
    }
  }

  async function createCampaign() {
    const form = document.getElementById('campaign-form');
    const formData = new FormData(form);

    const selectedContacts = Array.from(
      document.querySelectorAll('#selected-contacts [data-phone]')
    ).map(el => el.dataset.phone);

    if (selectedContacts.length === 0) {
      alert('Please select at least one contact');
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

      const result = await response.json();
      alert('Campaign created successfully!');
      document.getElementById('campaigns-tab').click();
      loadCampaigns();
    } catch (error) {
      console.error('Error creating campaign:', error);
      alert('Failed to create campaign');
    }
  }

  // Helper function
  function formatDate(dateString) {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  // Global functions
  window.viewCampaign = function (campaignId) {
    // Implement campaign details view
    alert('View campaign details: ' + campaignId);
  };

  window.addContactToCampaign = addContactToCampaign;
  window.removeContactFromCampaign = removeContactFromCampaign;

  // Status change modal functions
  let currentStatusPhone = null;

  function openStatusModal(phoneNumber, currentStatus, appointmentDate) {
    currentStatusPhone = phoneNumber;
    document.getElementById('status-select').value = currentStatus || 'lead';
    document.getElementById('status-notes').value = '';
    if (appointmentDate) {
      const date = new Date(appointmentDate);
      const formattedDate = date.toISOString().slice(0, 16);
      document.getElementById('appointment-date').value = formattedDate;
    } else {
      document.getElementById('appointment-date').value = '';
    }
    document.getElementById('status-modal').classList.remove('hidden');
  }

  function closeStatusModal() {
    document.getElementById('status-modal').classList.add('hidden');
    currentStatusPhone = null;
  }

  async function saveStatusChange() {
    if (!currentStatusPhone) return;

    const saleStatus = document.getElementById('status-select').value;
    const saleStatusNotes = document.getElementById('status-notes').value;
    const appointmentDate = document.getElementById('appointment-date').value;

    const body = { saleStatus, saleStatusNotes };
    if (appointmentDate && (saleStatus === 'appointment_scheduled' || saleStatus === 'appointment_confirmed')) {
      body.appointmentDate = appointmentDate;
    }

    try {
      const response = await fetch(`/crm/contacts/${currentStatusPhone}/status`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      });

      if (!response.ok) throw new Error('Failed to update status');

      closeStatusModal();
      loadContacts(contactsPage);
      loadDashboardData();
      alert('Estado actualizado correctamente');
    } catch (error) {
      console.error('Error updating status:', error);
      alert('Error al actualizar el estado');
    }
  }

  async function togglePauseContact(phoneNumber, isCurrentlyPaused) {
    if (!confirm(`¿Estás seguro de que deseas ${isCurrentlyPaused ? 'reanudar' : 'pausar'} este contacto?`)) {
      return;
    }

    try {
      const response = await fetch(`/crm/contacts/${phoneNumber}/pause`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ isPaused: !isCurrentlyPaused })
      });

      if (!response.ok) throw new Error('Failed to pause/unpause contact');

      loadContacts(contactsPage);
      loadDashboardData();
      alert(`Contacto ${isCurrentlyPaused ? 'reanudado' : 'pausado'} correctamente`);
    } catch (error) {
      console.error('Error pausing/unpausing contact:', error);
      alert('Error al pausar/reanudar contacto');
    }
  }

  async function confirmPayment(phoneNumber) {
    if (!confirm('¿Confirmar que este cliente ya pagó?')) {
      return;
    }

    try {
      const response = await fetch(`/crm/contacts/${phoneNumber}/payment/confirm`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) throw new Error('Failed to confirm payment');

      loadContacts(contactsPage);
      loadDashboardData();
      alert('Pago confirmado correctamente');
    } catch (error) {
      console.error('Error confirming payment:', error);
      alert('Error al confirmar pago');
    }
  }

  async function confirmAppointment(phoneNumber) {
    const notes = prompt('Agregar notas sobre la confirmación de la cita (opcional):');
    
    try {
      const response = await fetch(`/crm/contacts/${phoneNumber}/appointment/confirm`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ appointmentNotes: notes || '' })
      });

      if (!response.ok) throw new Error('Failed to confirm appointment');

      loadContacts(contactsPage);
      loadDashboardData();
      alert('Cita confirmada correctamente');
    } catch (error) {
      console.error('Error confirming appointment:', error);
      alert('Error al confirmar cita');
    }
  }

  async function loadBotConfig() {
    try {
      const response = await fetch('/crm/bot-config', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });

      if (!response.ok) throw new Error('Failed to load bot config');

      const config = await response.json();
      document.getElementById('bot-delay-input').value = config.botDelay || 10000;
      document.getElementById('current-delay-text').textContent = `Actual: ${config.botDelay || 10000}ms (${(config.botDelay || 10000) / 1000}s)`;
    } catch (error) {
      console.error('Error loading bot config:', error);
      document.getElementById('current-delay-text').textContent = 'Error al cargar';
    }
  }

  async function saveBotConfig() {
    const delay = parseInt(document.getElementById('bot-delay-input').value);
    
    if (isNaN(delay) || delay < 0) {
      alert('Por favor ingresa un delay válido (número >= 0)');
      return;
    }

    try {
      const response = await fetch('/crm/bot-config', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ botDelay: delay })
      });

      if (!response.ok) throw new Error('Failed to update bot config');

      document.getElementById('current-delay-text').textContent = `Actual: ${delay}ms (${delay / 1000}s)`;
      alert('Configuración del bot guardada correctamente');
    } catch (error) {
      console.error('Error saving bot config:', error);
      alert('Error al guardar configuración');
    }
  }

  // WhatsApp Management
  async function logoutWhatsApp() {
    if (!confirm('¿Estás seguro de que deseas desvincular el WhatsApp actual? Se generará un nuevo código QR.')) {
      return;
    }

    try {
      const response = await fetch('/crm/whatsapp/logout', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) throw new Error('Failed to logout WhatsApp');

      alert('WhatsApp desvinculado correctamente. Reiniciando cliente...');
      
      // Recargar la página después de un momento para que se reinicie el cliente
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    } catch (error) {
      console.error('Error logging out WhatsApp:', error);
      alert('Error al desvincular WhatsApp');
    }
  }

  async function loadWhatsAppStatus() {
    try {
      const response = await fetch('/health', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      if (!response.ok) throw new Error('Failed to load status');
      const status = await response.json();
      
      const statusElement = document.getElementById('whatsapp-connected-status');
      const qrDisplay = document.getElementById('qr-display');
      const whatsappWebBtn = document.getElementById('whatsapp-web-btn');
      
      if (!statusElement) {
        console.error('whatsapp-connected-status element not found');
        return;
      }
      
      if (status.clientReady) {
        statusElement.innerHTML = `<span class="text-green-600"><i class="fas fa-check-circle mr-1"></i> Conectado: ${status.botPushName || status.botContact || 'WhatsApp conectado'}</span>`;
        if (qrDisplay) qrDisplay.classList.add('hidden');
        
        // Habilitar botón de WhatsApp Web si está conectado y hay información del bot
        if (whatsappWebBtn && status.botContact) {
          whatsappWebBtn.disabled = false;
          // Extraer número del botContact si es un enlace
          const phoneMatch = status.botContact.match(/wa\.me\/(\d+)/);
          if (phoneMatch) {
            whatsappWebBtn.dataset.phone = phoneMatch[1];
          }
        }
      } else {
        statusElement.innerHTML = `<span class="text-red-600"><i class="fas fa-times-circle mr-1"></i> Desconectado - Escanear QR</span>`;
        if (qrDisplay) {
          qrDisplay.classList.remove('hidden');
          loadQRCode();
        }
        if (whatsappWebBtn) whatsappWebBtn.disabled = true;
      }
    } catch (error) {
      console.error('Error loading WhatsApp status:', error);
      const statusElement = document.getElementById('whatsapp-connected-status');
      if (statusElement) {
        statusElement.innerHTML = '<span class="text-gray-600">Error al cargar estado</span>';
      }
    }
  }

  // Función para abrir WhatsApp Web
  function openWhatsAppWeb() {
    // Simplemente abrir WhatsApp Web - no necesitamos verificar estado
    // WhatsApp Web se abrirá normalmente y el usuario puede iniciar sesión
    window.open('https://web.whatsapp.com', '_blank');
  }

  async function loadQRCode() {
    try {
      const response = await fetch('/qr', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      if (!response.ok) throw new Error('Failed to load QR');
      const data = await response.json();
      
      if (data.qr) {
        const container = document.getElementById('qr-code-container');
        container.innerHTML = `<img src="data:image/png;base64,${data.qr}" alt="QR Code" class="mx-auto" />`;
      }
    } catch (error) {
      console.error('Error loading QR code:', error);
    }
  }

  // Notifications Management
  let notificationStream = null;

  async function loadNotifications() {
    try {
      const response = await fetch('/crm/notifications?unreadOnly=false&limit=50', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      if (!response.ok) throw new Error('Failed to load notifications');
      const data = await response.json();
      
      updateNotificationBadge(data.unreadCount);
      renderNotifications(data.notifications);
      
      // Iniciar stream de notificaciones si no está activo
      if (!notificationStream) {
        startNotificationStream();
      }
    } catch (error) {
      console.error('Error loading notifications:', error);
    }
  }

  function startNotificationStream() {
    const eventSource = new EventSource('/crm/notifications/stream?token=' + encodeURIComponent(localStorage.getItem('token')));
    
    eventSource.onmessage = function(event) {
      try {
        const data = JSON.parse(event.data);
        updateNotificationBadge(data.unreadCount);
        
        // Si estamos en la sección de notificaciones, actualizar la lista
        if (currentPage === 'notifications') {
          renderNotifications(data.notifications);
        }
      } catch (error) {
        console.error('Error parsing notification stream data:', error);
      }
    };

    eventSource.onerror = function(error) {
      console.error('Notification stream error:', error);
      eventSource.close();
      notificationStream = null;
      // Reintentar después de 5 segundos
      setTimeout(() => {
        if (currentPage === 'notifications' || currentPage === 'dashboard') {
          startNotificationStream();
        }
      }, 5000);
    };

    notificationStream = eventSource;
  }

  function updateNotificationBadge(count) {
    const badge = document.getElementById('notification-badge');
    const unreadBadge = document.getElementById('unread-count-badge');
    
    if (badge) {
      if (count > 0) {
        badge.textContent = count;
        badge.classList.remove('hidden');
      } else {
        badge.classList.add('hidden');
      }
    }
    
    if (unreadBadge) {
      unreadBadge.textContent = count || 0;
    }
  }

  function renderNotifications(notifications) {
    const container = document.getElementById('notifications-list');
    if (!container) return;

    if (notifications.length === 0) {
      container.innerHTML = '<p class="text-gray-500 text-center py-4">No hay notificaciones</p>';
      return;
    }

    const typeLabels = {
      'payment_receipt': { label: 'Comprobante de Pago', icon: '💳', color: 'yellow' },
      'appointment_proposed': { label: 'Horario Propuesto', icon: '📅', color: 'blue' },
      'appointment_request': { label: 'Solicitud de Cita', icon: '📆', color: 'green' }
    };

    container.innerHTML = notifications.map(notif => {
      const type = typeLabels[notif.type] || { label: notif.type, icon: '📢', color: 'gray' };
      const readClass = notif.read ? 'opacity-60' : 'bg-blue-50 border-blue-200';
      
      return `
        <div class="notification-item p-4 border border-gray-200 rounded-lg ${readClass} cursor-pointer hover:bg-gray-50 transition-colors" 
             onclick="viewNotification('${notif._id}', '${notif.phoneNumber}')" 
             data-notification-id="${notif._id}">
          <div class="flex items-start justify-between">
            <div class="flex items-start space-x-3 flex-grow">
              <div class="text-2xl">${type.icon}</div>
              <div class="flex-grow">
                <div class="flex items-center space-x-2 mb-1">
                  <span class="text-sm font-medium text-gray-800">${type.label}</span>
                  ${!notif.read ? '<span class="bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full">Nuevo</span>' : ''}
                </div>
                <p class="text-sm text-gray-600 font-medium">${notif.contactName || 'Cliente'}</p>
                <p class="text-xs text-gray-500">${notif.phoneNumber}</p>
                ${notif.message ? `<p class="text-sm text-gray-700 mt-2">${notif.message.substring(0, 100)}${notif.message.length > 100 ? '...' : ''}</p>` : ''}
                ${notif.metadata && notif.metadata.proposedDates && notif.metadata.proposedDates.length > 0 ? 
                  `<p class="text-sm text-blue-600 mt-1"><i class="fas fa-clock mr-1"></i> Horarios: ${notif.metadata.proposedDates.join(', ')}</p>` : ''}
                <p class="text-xs text-gray-400 mt-2">${formatDate(notif.createdAt)}</p>
              </div>
            </div>
            <button onclick="event.stopPropagation(); markNotificationAsRead('${notif._id}')" 
                    class="text-gray-400 hover:text-gray-600">
              <i class="fas fa-times"></i>
            </button>
          </div>
        </div>
      `;
    }).join('');
  }

  async function markNotificationAsRead(id) {
    try {
      const response = await fetch(`/crm/notifications/${id}/read`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });
      if (!response.ok) throw new Error('Failed to mark notification as read');
      
      // Remover el elemento de la lista
      const item = document.querySelector(`[data-notification-id="${id}"]`);
      if (item) {
        item.remove();
      }
      
      // Actualizar contador
      const unreadCount = document.querySelectorAll('.notification-item:not(.opacity-60)').length;
      updateNotificationBadge(unreadCount);
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  }

  async function markAllNotificationsAsRead() {
    if (!confirm('¿Marcar todas las notificaciones como leídas?')) {
      return;
    }

    try {
      const response = await fetch('/crm/notifications/read-all', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });
      if (!response.ok) throw new Error('Failed to mark all notifications as read');
      
      loadNotifications();
      updateNotificationBadge(0);
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
      alert('Error al marcar todas las notificaciones como leídas');
    }
  }

    function viewNotification(id, phoneNumber) {
    // Marcar como leída
    markNotificationAsRead(id);
    
    // Abrir chat directamente
    openChatModal(phoneNumber, phoneNumber);
  }

  // WhatsApp Chat Modal functions
  let currentChatPhoneNumber = null;
  let currentChatContactName = null;
  let chatMessages = []; // Cache de mensajes del chat actual

  function openChatModal(phoneNumber, contactName) {
    currentChatPhoneNumber = phoneNumber;
    currentChatContactName = contactName;
    document.getElementById('chat-contact-name').textContent = contactName;
    document.getElementById('chat-contact-phone').textContent = phoneNumber;
    document.getElementById('chat-modal').classList.remove('hidden');
    
    // Habilitar botón de WhatsApp Web para el contacto si WhatsApp está conectado
    const whatsappWebContactBtn = document.getElementById('whatsapp-web-contact-btn');
    if (whatsappWebContactBtn) {
      fetch('/health', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      }).then(res => res.json()).then(status => {
        if (status.clientReady) {
          whatsappWebContactBtn.disabled = false;
          whatsappWebContactBtn.dataset.phone = phoneNumber;
        } else {
          whatsappWebContactBtn.disabled = true;
        }
      }).catch(() => {
        if (whatsappWebContactBtn) whatsappWebContactBtn.disabled = true;
      });
    }
    
    loadChatMessages();
  }
  
  // Función para abrir WhatsApp Web con un contacto específico
  function openWhatsAppWebForContact() {
    if (!currentChatPhoneNumber) {
      alert('No hay un contacto seleccionado.');
      return;
    }
    
    // Abrir WhatsApp Web con el número del contacto
    // Limpiar número: quitar espacios, guiones, paréntesis, etc. y dejar solo números
    let phoneNumber = currentChatPhoneNumber.replace(/[^0-9]/g, ''); // Solo números
    
    // Si el número tiene código de país, mantenerlo; si no, asumir código de México (52)
    if (phoneNumber.length === 10) {
      // Número local mexicano, agregar código de país
      phoneNumber = '52' + phoneNumber;
    } else if (phoneNumber.startsWith('52') && phoneNumber.length === 12) {
      // Ya tiene código de país
      phoneNumber = phoneNumber;
    } else if (phoneNumber.length < 10) {
      // Número muy corto, intentar con código de país
      phoneNumber = '52' + phoneNumber;
    }
    
    // Abrir WhatsApp Web con el número
    window.open(`https://web.whatsapp.com/send?phone=${phoneNumber}`, '_blank');
  }

  function closeChatModal() {
    document.getElementById('chat-modal').classList.add('hidden');
    currentChatPhoneNumber = null;
    currentChatContactName = null;
    chatMessages = [];
    document.getElementById('messages-container').innerHTML = '';
  }

  async function loadChatMessages() {
    try {
      const response = await fetch(`/crm/contacts/${currentChatPhoneNumber}/messages`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      if (!response.ok) throw new Error('Failed to load chat messages');
      const data = await response.json();
      chatMessages = data.messages;
      renderChatMessages();
    } catch (error) {
      console.error('Error loading chat messages:', error);
      alert('Error al cargar mensajes del chat');
    }
  }

  function renderChatMessages() {
    const container = document.getElementById('messages-container');
    container.innerHTML = ''; // Limpiar mensajes existentes
    
    if (chatMessages.length === 0) {
      container.innerHTML = '<p class="text-gray-500 text-center py-4">No hay mensajes</p>';
      return;
    }
    
    chatMessages.forEach(msg => {
      const messageElement = document.createElement('div');
      messageElement.className = `flex ${msg.isFromBot ? 'justify-end' : 'justify-start'} mb-2`;
      
      const time = new Date(msg.timestamp).toLocaleTimeString('es-ES', { 
        hour: '2-digit', 
        minute: '2-digit' 
      });
      
      messageElement.innerHTML = `
        <div class="max-w-[70%] px-4 py-2 rounded-lg shadow-sm ${
          msg.isFromBot 
            ? 'bg-green-200 text-gray-800 rounded-br-none' 
            : 'bg-white text-gray-800 rounded-bl-none'
        }">
          <p class="text-sm whitespace-pre-wrap">${msg.body || ''}</p>
          <span class="text-xs text-gray-500 mt-1 block">${time}</span>
        </div>
      `;
      container.appendChild(messageElement);
    });
    
    // Scroll al final
    container.scrollTop = container.scrollHeight;
  }

  async function sendChatMessage() {
    const messageInput = document.getElementById('chat-message-input');
    const messageText = messageInput.value.trim();

    if (!messageText || !currentChatPhoneNumber) return;

    try {
      const response = await fetch('/crm/send-message', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          phoneNumber: currentChatPhoneNumber,
          message: messageText
        })
      });

      if (!response.ok) throw new Error('Failed to send message');

      // Después de enviar, recargar mensajes para ver el nuevo
      messageInput.value = ''; // Limpiar input
      loadChatMessages();
    } catch (error) {
      console.error('Error sending chat message:', error);
      alert('Error al enviar mensaje');
    }
  }

  // Iniciar stream de notificaciones al cargar
  document.addEventListener('DOMContentLoaded', function() {
    if (localStorage.getItem('token')) {
      startNotificationStream();
      // Cargar notificaciones iniciales
      loadNotifications().catch(err => console.error('Error loading initial notifications:', err));
    }
  });

  window.openStatusModal = openStatusModal;
  window.closeStatusModal = closeStatusModal;
  window.saveStatusChange = saveStatusChange;
  window.togglePauseContact = togglePauseContact;
  window.confirmPayment = confirmPayment;
  window.confirmAppointment = confirmAppointment;
  window.loadBotConfig = loadBotConfig;
  window.saveBotConfig = saveBotConfig;
  window.logoutWhatsApp = logoutWhatsApp;
  window.loadWhatsAppStatus = loadWhatsAppStatus;
  window.markNotificationAsRead = markNotificationAsRead;
  window.markAllNotificationsAsRead = markAllNotificationsAsRead;
  window.viewNotification = viewNotification;
  window.openChatModal = openChatModal;
  window.closeChatModal = closeChatModal;
  window.sendChatMessage = sendChatMessage;
  window.openWhatsAppWeb = openWhatsAppWeb;
  window.openWhatsAppWebForContact = openWhatsAppWebForContact;
  window.openMessageModal = openMessageModal; // Mantener compatibilidad

  // Users Management Functions
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
      alert('Error al cargar usuarios');
    }
  }

  function renderUsers(users) {
    const tbody = document.getElementById('users-table-body');
    tbody.innerHTML = '';
    
    if (users.length === 0) {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td colspan="4" class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-center">No hay usuarios</td>`;
      tbody.appendChild(tr);
      return;
    }

    users.forEach(user => {
      const tr = document.createElement('tr');
      tr.className = 'hover:bg-gray-50';
      tr.innerHTML = `
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-800">${user.username}</td>
        <td class="px-6 py-4 whitespace-nowrap">
          <span class="px-2 py-1 text-xs font-semibold rounded-full ${user.role === 'admin' ? 'bg-purple-100 text-purple-800' : 'bg-gray-100 text-gray-800'}">
            ${user.role === 'admin' ? 'Administrador' : 'Usuario'}
          </span>
        </td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${formatDate(user.createdAt)}</td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
          <button onclick="openChangeUserPasswordModal('${user._id}', '${user.username}')" 
            class="inline-flex items-center px-2 py-1 border border-transparent text-xs leading-4 font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors">
            <i class="fas fa-key mr-1"></i> Cambiar Contraseña
          </button>
        </td>
      `;
      tbody.appendChild(tr);
    });
  }

  // Create User Modal Functions
  function openCreateUserModal() {
    document.getElementById('create-user-modal').classList.remove('hidden');
    document.getElementById('create-username-input').value = '';
    document.getElementById('create-password-input').value = '';
    document.getElementById('create-role-select').value = 'user';
  }

  function closeCreateUserModal() {
    document.getElementById('create-user-modal').classList.add('hidden');
  }

  async function saveCreateUser() {
    const username = document.getElementById('create-username-input').value.trim();
    const password = document.getElementById('create-password-input').value;
    const role = document.getElementById('create-role-select').value;

    if (!username || !password) {
      alert('Por favor completa todos los campos');
      return;
    }

    if (password.length < 6) {
      alert('La contraseña debe tener al menos 6 caracteres');
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
        const error = await response.json();
        throw new Error(error.error || 'Error al crear usuario');
      }

      closeCreateUserModal();
      loadUsers();
      alert('Usuario creado correctamente');
    } catch (error) {
      console.error('Error creating user:', error);
      alert(error.message || 'Error al crear usuario');
    }
  }

  // Change User Password Modal Functions
  let currentChangePasswordUserId = null;

  function openChangeUserPasswordModal(userId, username) {
    currentChangePasswordUserId = userId;
    document.getElementById('change-password-username-input').value = username;
    document.getElementById('change-password-new-input').value = '';
    document.getElementById('change-password-confirm-input').value = '';
    document.getElementById('change-user-password-modal').classList.remove('hidden');
  }

  function closeChangeUserPasswordModal() {
    document.getElementById('change-user-password-modal').classList.add('hidden');
    currentChangePasswordUserId = null;
  }

  async function saveChangeUserPassword() {
    const newPassword = document.getElementById('change-password-new-input').value;
    const confirmPassword = document.getElementById('change-password-confirm-input').value;

    if (!newPassword) {
      alert('Por favor ingresa la nueva contraseña');
      return;
    }

    if (newPassword.length < 6) {
      alert('La contraseña debe tener al menos 6 caracteres');
      return;
    }

    if (newPassword !== confirmPassword) {
      alert('Las contraseñas no coinciden');
      return;
    }

    try {
      const response = await fetch(`/crm/auth/change-password/${currentChangePasswordUserId}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ newPassword })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Error al cambiar contraseña');
      }

      closeChangeUserPasswordModal();
      alert('Contraseña cambiada correctamente');
    } catch (error) {
      console.error('Error changing password:', error);
      alert(error.message || 'Error al cambiar contraseña');
    }
  }

  // Change Own Password Function
  async function changeOwnPassword() {
    const currentPassword = document.getElementById('current-password-input').value;
    const newPassword = document.getElementById('new-password-input').value;
    const confirmPassword = document.getElementById('confirm-password-input').value;

    if (!currentPassword || !newPassword || !confirmPassword) {
      alert('Por favor completa todos los campos');
      return;
    }

    if (newPassword.length < 6) {
      alert('La contraseña debe tener al menos 6 caracteres');
      return;
    }

    if (newPassword !== confirmPassword) {
      alert('Las contraseñas no coinciden');
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
        const error = await response.json();
        throw new Error(error.error || 'Error al cambiar contraseña');
      }

      // Clear inputs
      document.getElementById('current-password-input').value = '';
      document.getElementById('new-password-input').value = '';
      document.getElementById('confirm-password-input').value = '';
      
      alert('Contraseña cambiada correctamente');
    } catch (error) {
      console.error('Error changing password:', error);
      alert(error.message || 'Error al cambiar contraseña');
    }
  }

  window.openCreateUserModal = openCreateUserModal;
  window.closeCreateUserModal = closeCreateUserModal;
  window.saveCreateUser = saveCreateUser;
  window.openChangeUserPasswordModal = openChangeUserPasswordModal;
  window.closeChangeUserPasswordModal = closeChangeUserPasswordModal;
  window.saveChangeUserPassword = saveChangeUserPassword;
  window.changePassword = changeOwnPassword;
});