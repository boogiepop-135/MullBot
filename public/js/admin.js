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

      // Update main stats by sale status
      document.getElementById('interested-contacts').textContent = stats.contacts.byStatus.interested || 0;
      document.getElementById('potential-buyers').textContent = stats.contacts.byStatus.potentialBuyers || 0;
      document.getElementById('paid-customers').textContent = stats.contacts.byStatus.paid || 0;
      document.getElementById('total-contacts').textContent = stats.contacts.total;
      document.getElementById('recent-contacts-text').textContent = `${stats.contacts.recent} nuevos esta semana`;
      
      // Update secondary stats
      document.getElementById('total-campaigns').textContent = stats.campaigns.total;
      document.getElementById('sent-campaigns-text').textContent = `${stats.campaigns.sent} enviadas`;
      document.getElementById('total-messages').textContent = stats.campaigns.totalMessagesSent;
      document.getElementById('total-interactions').textContent = stats.sales.totalInteractions;
      document.getElementById('unique-users-text').textContent = `${stats.sales.uniqueUsers} usuarios únicos`;

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
          <button onclick="openMessageModal('${lead.phoneNumber}')" 
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
        params.append('saleStatus', currentSaleStatusFilter);
      }

      const response = await fetch(`/crm/contacts?${params.toString()}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });

      if (!response.ok) throw new Error('Failed to load contacts');

      const { data, meta } = await response.json();
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
      tr.innerHTML = `<td colspan="5" class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-center">No se encontraron contactos</td>`;
      tbody.appendChild(tr);
      return;
    }

    const statusLabels = {
      'lead': { label: 'Lead', color: 'gray', bg: 'bg-gray-100 text-gray-800' },
      'interested': { label: 'Interesado', color: 'blue', bg: 'bg-blue-100 text-blue-800' },
      'potential_buyer': { label: 'Potencial', color: 'yellow', bg: 'bg-yellow-100 text-yellow-800' },
      'paid': { label: 'Cliente', color: 'green', bg: 'bg-green-100 text-green-800' }
    };

    contacts.forEach(contact => {
      const status = statusLabels[contact.saleStatus || 'lead'] || statusLabels['lead'];
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
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
          <div class="flex space-x-2">
            <button onclick="openStatusModal('${contact.phoneNumber}', '${contact.saleStatus || 'lead'}')" 
              class="inline-flex items-center px-2 py-1 border border-transparent text-xs leading-4 font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors">
              <i class="fas fa-edit mr-1"></i> Estado
            </button>
            <button onclick="openMessageModal('${contact.phoneNumber}')" 
              class="message-btn inline-flex items-center px-2 py-1 border border-transparent text-xs leading-4 font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-colors">
              <i class="fas fa-paper-plane mr-1"></i> Mensaje
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

  function openStatusModal(phoneNumber, currentStatus) {
    currentStatusPhone = phoneNumber;
    document.getElementById('status-select').value = currentStatus || 'lead';
    document.getElementById('status-notes').value = '';
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

    try {
      const response = await fetch(`/crm/contacts/${currentStatusPhone}/status`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ saleStatus, saleStatusNotes })
      });

      if (!response.ok) throw new Error('Failed to update status');

      closeStatusModal();
      loadContacts(contactsPage);
      alert('Estado actualizado correctamente');
    } catch (error) {
      console.error('Error updating status:', error);
      alert('Error al actualizar el estado');
    }
  }

  window.openStatusModal = openStatusModal;
  window.closeStatusModal = closeStatusModal;
  window.saveStatusChange = saveStatusChange;
});