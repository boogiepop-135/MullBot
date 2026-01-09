// ========================================
// PANEL DE ASESORÍAS - SISTEMA COMPLETO
// ========================================

let currentAdvisory = null;
let advisoriesQueue = [];
let advisoryPollingInterval = null;

// ========================================
// INICIALIZACIÓN
// ========================================

/**
 * Iniciar sistema de asesorías cuando se carga la sección
 */
function initAdvisoriesPanel() {
    console.log('🎧 Inicializando panel de asesorías...');
    
    // Cargar cola inicial
    refreshAdvisoriesQueue();
    
    // Polling cada 5 segundos
    if (advisoryPollingInterval) {
        clearInterval(advisoryPollingInterval);
    }
    advisoryPollingInterval = setInterval(refreshAdvisoriesQueue, 5000);
    
    // Notificación sonora
    playNotificationSound();
}

/**
 * Detener polling cuando se cambia de sección
 */
function stopAdvisoriesPolling() {
    if (advisoryPollingInterval) {
        clearInterval(advisoryPollingInterval);
        advisoryPollingInterval = null;
    }
}

// ========================================
// COLA DE ASESORÍAS
// ========================================

/**
 * Refrescar cola de asesorías
 */
async function refreshAdvisoriesQueue() {
    try {
        const token = localStorage.getItem('token');
        if (!token) {
            console.error('No hay token de autenticación');
            return;
        }

        const response = await fetch('/api/advisory/queue', {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        const data = await response.json();
        
        if (data.success) {
            advisoriesQueue = data.advisories;
            renderAdvisoriesQueue(advisoriesQueue);
            updateAdvisoriesStats(data.advisories);
            
            // Notificar si hay nuevas
            const newCount = data.advisories.filter(a => a.status === 'PENDING').length;
            if (newCount > 0) {
                updateAdvisoryBadge(newCount);
            } else {
                hideAdvisoryBadge();
            }
        }
    } catch (error) {
        console.error('Error al cargar cola de asesorías:', error);
    }
}

/**
 * Renderizar cola de asesorías
 */
function renderAdvisoriesQueue(advisories) {
    const container = document.getElementById('advisories-queue-container');
    
    if (!advisories || advisories.length === 0) {
        container.innerHTML = `
            <div class="text-center py-8 text-gray-400">
                <i class="fas fa-inbox text-4xl mb-3"></i>
                <p>No hay solicitudes pendientes</p>
            </div>
        `;
        return;
    }

    let html = '';
    advisories.forEach((advisory, index) => {
        const number = index + 1;
        const timeAgo = getTimeAgo(new Date(advisory.startedAt));
        const isPending = advisory.status === 'PENDING';
        const isActive = advisory.status === 'ACTIVE';
        
        html += `
            <div onclick="selectAdvisory('${advisory.id}')" 
                class="p-4 mb-3 rounded-xl border-2 cursor-pointer transition-all ${
                    currentAdvisory?.id === advisory.id 
                        ? 'border-green-500 bg-green-50' 
                        : isPending 
                            ? 'border-yellow-300 bg-yellow-50 hover:border-yellow-400' 
                            : 'border-blue-300 bg-blue-50 hover:border-blue-400'
                }">
                <div class="flex items-center justify-between mb-2">
                    <div class="flex items-center gap-3">
                        <span class="text-2xl font-bold ${
                            isPending ? 'text-yellow-600' : 'text-blue-600'
                        }">${number}</span>
                        <div>
                            <p class="font-bold text-gray-900">${advisory.customerName || 'Cliente'}</p>
                            <p class="text-xs text-gray-500">${advisory.customerPhone}</p>
                        </div>
                    </div>
                    <span class="px-2 py-1 rounded-full text-xs font-bold ${
                        isPending 
                            ? 'bg-yellow-200 text-yellow-800' 
                            : 'bg-blue-200 text-blue-800'
                    }">
                        ${isPending ? '⏳ Pendiente' : '🔵 Activa'}
                    </span>
                </div>
                ${advisory.summary ? `
                    <p class="text-sm text-gray-700 mb-2 line-clamp-2">${advisory.summary}</p>
                ` : ''}
                <div class="flex items-center gap-2 text-xs text-gray-500">
                    <i class="fas fa-clock"></i>
                    <span>${timeAgo}</span>
                </div>
            </div>
        `;
    });

    container.innerHTML = html;
}

/**
 * Actualizar estadísticas
 */
function updateAdvisoriesStats(advisories) {
    const pending = advisories.filter(a => a.status === 'PENDING').length;
    const active = advisories.filter(a => a.status === 'ACTIVE').length;
    
    document.getElementById('advisories-pending-count').textContent = pending;
    document.getElementById('advisories-active-count').textContent = active;
    
    // Completadas hoy se obtiene del servidor
    loadCompletedToday();
}

/**
 * Cargar completadas hoy
 */
async function loadCompletedToday() {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch('/api/advisory/stats', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        const data = await response.json();
        if (data.success) {
            document.getElementById('advisories-completed-count').textContent = data.stats.completedToday;
        }
    } catch (error) {
        console.error('Error al cargar completadas:', error);
    }
}

// ========================================
// SELECCIÓN Y CHAT
// ========================================

/**
 * Seleccionar una asesoría de la cola
 */
async function selectAdvisory(advisoryId) {
    try {
        const token = localStorage.getItem('token');
        const advisory = advisoriesQueue.find(a => a.id === advisoryId);
        
        if (!advisory) {
            console.error('Asesoría no encontrada');
            return;
        }

        currentAdvisory = advisory;
        
        // Si está pendiente, aceptarla automáticamente
        if (advisory.status === 'PENDING') {
            const response = await fetch(`/api/advisory/${advisoryId}/accept`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    agentPhone: 'admin' // TODO: obtener del usuario logueado
                })
            });
            
            const data = await response.json();
            if (data.success) {
                currentAdvisory = data.advisory;
                console.log('✅ Asesoría aceptada');
            }
        }
        
        // Renderizar header y mensajes
        renderAdvisoryHeader(currentAdvisory);
        await loadAdvisoryMessages(advisoryId);
        
        // Mostrar barra de acciones
        document.getElementById('advisory-actions-bar').classList.remove('hidden');
        
        // Scroll al chat
        document.getElementById('advisory-chat-messages').scrollTop = 999999;
        
    } catch (error) {
        console.error('Error al seleccionar asesoría:', error);
        alert('Error al seleccionar la asesoría');
    }
}

/**
 * Renderizar header del chat
 */
function renderAdvisoryHeader(advisory) {
    const header = document.getElementById('advisory-chat-header');
    const timeActive = getTimeAgo(new Date(advisory.acceptedAt || advisory.startedAt));
    
    header.innerHTML = `
        <div class="flex items-center justify-between">
            <div class="flex items-center gap-4">
                <div class="w-12 h-12 rounded-full bg-green-600 flex items-center justify-center text-white font-bold text-xl">
                    ${(advisory.customerName || 'C')[0].toUpperCase()}
                </div>
                <div>
                    <p class="font-bold text-gray-900 text-lg">${advisory.customerName || 'Cliente'}</p>
                    <p class="text-sm text-gray-600">${advisory.customerPhone}</p>
                    <p class="text-xs text-gray-500 mt-1">
                        <i class="fas fa-clock mr-1"></i>${timeActive}
                    </p>
                </div>
            </div>
            <div class="text-right">
                <span class="px-3 py-1 rounded-full text-sm font-bold bg-blue-100 text-blue-800">
                    <i class="fas fa-comment-dots mr-1"></i>Chat Activo
                </span>
                ${advisory.summary ? `
                    <p class="text-xs text-gray-600 mt-2 max-w-xs">
                        📝 ${advisory.summary}
                    </p>
                ` : ''}
            </div>
        </div>
    `;
}

/**
 * Cargar mensajes de la conversación
 */
async function loadAdvisoryMessages(advisoryId) {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`/api/advisory/${advisoryId}/messages?limit=50`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        const data = await response.json();
        if (data.success) {
            renderAdvisoryMessages(data.messages);
        }
    } catch (error) {
        console.error('Error al cargar mensajes:', error);
    }
}

/**
 * Renderizar mensajes en el chat
 */
function renderAdvisoryMessages(messages) {
    const container = document.getElementById('advisory-chat-messages');
    
    if (!messages || messages.length === 0) {
        container.innerHTML = `
            <div class="text-center text-gray-400 py-8">
                <i class="fas fa-comment-slash text-4xl mb-3"></i>
                <p>No hay mensajes</p>
            </div>
        `;
        return;
    }

    let html = '';
    messages.forEach(msg => {
        const isBot = msg.isFromBot;
        const time = new Date(msg.timestamp).toLocaleTimeString('es-MX', {
            hour: '2-digit',
            minute: '2-digit'
        });
        
        html += `
            <div class="mb-4 ${isBot ? 'text-right' : 'text-left'}">
                <div class="inline-block max-w-[70%] p-3 rounded-xl ${
                    isBot 
                        ? 'bg-green-600 text-white' 
                        : 'bg-white border border-gray-200 text-gray-900'
                }">
                    <p class="whitespace-pre-wrap break-words">${msg.body}</p>
                    <p class="text-xs mt-1 opacity-70">${time}</p>
                </div>
                <p class="text-xs text-gray-500 mt-1">${isBot ? 'Asesor' : 'Cliente'}</p>
            </div>
        `;
    });

    container.innerHTML = html;
    
    // Auto-scroll al último mensaje
    container.scrollTop = container.scrollHeight;
}

// ========================================
// ENVÍO DE MENSAJES
// ========================================

/**
 * Enviar mensaje al cliente
 */
async function sendAdvisoryMessage() {
    const input = document.getElementById('advisory-message-input');
    const message = input.value.trim();
    
    if (!message || !currentAdvisory) {
        return;
    }

    try {
        // Aquí normalmente enviarías el mensaje por la API al bot
        // Por ahora solo lo mostramos en el chat
        
        const messagesContainer = document.getElementById('advisory-chat-messages');
        const time = new Date().toLocaleTimeString('es-MX', {
            hour: '2-digit',
            minute: '2-digit'
        });
        
        // Agregar mensaje visualmente
        const messageHtml = `
            <div class="mb-4 text-right">
                <div class="inline-block max-w-[70%] p-3 rounded-xl bg-green-600 text-white">
                    <p class="whitespace-pre-wrap break-words">${message}</p>
                    <p class="text-xs mt-1 opacity-70">${time}</p>
                </div>
                <p class="text-xs text-gray-500 mt-1">Asesor</p>
            </div>
        `;
        
        messagesContainer.insertAdjacentHTML('beforeend', messageHtml);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
        
        // Limpiar input
        input.value = '';
        
        console.log('✅ Mensaje enviado:', message);
        
        // TODO: Implementar envío real via API del bot
        
    } catch (error) {
        console.error('Error al enviar mensaje:', error);
        alert('Error al enviar el mensaje');
    }
}

/**
 * Enviar mensaje rápido
 */
function sendAdvisoryQuickMessage(message) {
    const input = document.getElementById('advisory-message-input');
    input.value = message;
    sendAdvisoryMessage();
}

/**
 * Solicitar info del cliente
 */
function requestAdvisoryInfo() {
    if (!currentAdvisory) return;
    
    const info = `
📋 Información del Cliente:
👤 Nombre: ${currentAdvisory.customerName || 'No proporcionado'}
📱 Teléfono: ${currentAdvisory.customerPhone}
📝 Resumen: ${currentAdvisory.summary || 'N/A'}
⏰ Esperando desde: ${getTimeAgo(new Date(currentAdvisory.startedAt))}
    `.trim();
    
    alert(info);
}

// ========================================
// FINALIZAR/EXPULSAR
// ========================================

/**
 * Completar asesoría
 */
async function completeAdvisory() {
    if (!currentAdvisory) {
        alert('No hay asesoría activa');
        return;
    }

    const notes = prompt('¿Deseas agregar alguna nota? (opcional)');
    
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`/api/advisory/${currentAdvisory.id}/complete`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ notes })
        });
        
        const data = await response.json();
        if (data.success) {
            alert('✅ Asesoría finalizada exitosamente');
            clearAdvisoryChat();
            refreshAdvisoriesQueue();
        }
    } catch (error) {
        console.error('Error al completar asesoría:', error);
        alert('Error al finalizar la asesoría');
    }
}

/**
 * Cancelar/expulsar asesoría
 */
async function cancelAdvisory() {
    if (!currentAdvisory) {
        alert('No hay asesoría activa');
        return;
    }

    const reason = prompt('¿Por qué deseas expulsar esta asesoría?');
    if (!reason) return;
    
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`/api/advisory/${currentAdvisory.id}/cancel`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ reason })
        });
        
        const data = await response.json();
        if (data.success) {
            alert('❌ Asesoría expulsada');
            clearAdvisoryChat();
            refreshAdvisoriesQueue();
        }
    } catch (error) {
        console.error('Error al cancelar asesoría:', error);
        alert('Error al expulsar la asesoría');
    }
}

/**
 * Limpiar chat actual
 */
function clearAdvisoryChat() {
    currentAdvisory = null;
    
    document.getElementById('advisory-chat-header').innerHTML = `
        <div class="text-center text-gray-400 py-4">
            <i class="fas fa-comments text-5xl mb-3"></i>
            <p class="font-medium">Selecciona una asesoría de la cola para comenzar</p>
        </div>
    `;
    
    document.getElementById('advisory-chat-messages').innerHTML = `
        <div class="text-center text-gray-400 py-8">
            <i class="fas fa-comment-slash text-4xl mb-3"></i>
            <p>No hay chat activo</p>
        </div>
    `;
    
    document.getElementById('advisory-actions-bar').classList.add('hidden');
    document.getElementById('advisory-message-input').value = '';
}

// ========================================
// UTILIDADES
// ========================================

/**
 * Actualizar badge de notificación
 */
function updateAdvisoryBadge(count) {
    const badge = document.getElementById('advisory-badge');
    if (badge) {
        badge.textContent = count;
        badge.classList.remove('hidden');
    }
}

/**
 * Ocultar badge
 */
function hideAdvisoryBadge() {
    const badge = document.getElementById('advisory-badge');
    if (badge) {
        badge.classList.add('hidden');
    }
}

/**
 * Reproducir sonido de notificación (tipo Samsung - amigable)
 */
function playNotificationSound() {
    // Crear un sonido tipo Samsung más amigable usando Web Audio API
    try {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        
        // Configuración para un sonido suave tipo Samsung
        const duration = 0.3; // Duración más corta y suave
        const sampleRate = audioContext.sampleRate;
        const numSamples = Math.floor(duration * sampleRate);
        const buffer = audioContext.createBuffer(1, numSamples, sampleRate);
        const data = buffer.getChannelData(0);
        
        // Generar un tono más suave y agradable (frecuencia más baja, con decaimiento suave)
        const frequency = 800; // Frecuencia más baja = más suave
        const frequency2 = 600; // Segundo tono para un sonido más rico
        
        for (let i = 0; i < numSamples; i++) {
            const t = i / sampleRate;
            // Decaimiento exponencial para que sea más suave
            const envelope = Math.exp(-t * 8);
            // Combinar dos tonos con decaimiento
            data[i] = (Math.sin(2 * Math.PI * frequency * t) * 0.3 + 
                      Math.sin(2 * Math.PI * frequency2 * t) * 0.2) * envelope;
        }
        
        const source = audioContext.createBufferSource();
        source.buffer = buffer;
        source.connect(audioContext.destination);
        source.start(0);
        
        // Limpiar después de reproducir
        setTimeout(() => {
            source.disconnect();
        }, duration * 1000);
        
    } catch (e) {
        // Fallback: Si Web Audio API no está disponible, usar un sonido más simple
        try {
            // Generar un beep suave usando HTML5 Audio
            const audioContext = new AudioContext();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            
            oscillator.frequency.value = 800; // Frecuencia más suave
            oscillator.type = 'sine'; // Onda seno = más suave
            gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
            
            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.3);
        } catch (fallbackError) {
            console.log('No se pudo reproducir sonido de notificación');
        }
    }
}

/**
 * Calcular tiempo transcurrido
 */
function getTimeAgo(date) {
    const seconds = Math.floor((new Date() - date) / 1000);
    
    if (seconds < 60) return `hace ${seconds}s`;
    if (seconds < 3600) return `hace ${Math.floor(seconds / 60)}m`;
    if (seconds < 86400) return `hace ${Math.floor(seconds / 3600)}h`;
    return `hace ${Math.floor(seconds / 86400)}d`;
}

console.log('✅ Sistema de asesorías cargado');
