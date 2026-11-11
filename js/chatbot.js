/**
 * Endless Shop - AI Customer Support Chatbot
 * Interactive Scandinavian Assistant Widget
 */
(function() {
  'use strict';

  // Prevent multiple initializations
  if (window.__ENDLESS_CHATBOT_INITIALIZED__) return;
  window.__ENDLESS_CHATBOT_INITIALIZED__ = true;

  const STORAGE_KEY = 'endless_chat_history_v1';
  const TEASER_DISMISSED_KEY = 'endless_chat_teaser_dismissed';

  // Default welcome message & chips
  const INITIAL_MESSAGE = {
    sender: 'bot',
    text: 'Dạ xin chào quý khách! Em là **Trợ lý ảo Endless Shop** 🌿.\n\nEm có thể hỗ trợ quý khách tìm sản phẩm, săn mã giảm giá, tư vấn chọn size chuẩn và giải đáp chính sách giao nhận hàng. Quý khách cần hỗ trợ gì hôm nay ạ?',
    time: formatTime(new Date()),
    suggestions: [
      '🏷️ Mã giảm giá hot',
      '📏 Bảng tư vấn size',
      '🚚 Phí ship & Giao hàng',
      '🔄 Chính sách đổi trả',
      '🧥 Xem mẫu áo mới'
    ]
  };

  let chatHistory = [];
  let isWindowOpen = false;
  let isTyping = false;

  // Load chat history from session storage
  try {
    const saved = sessionStorage.getItem(STORAGE_KEY);
    if (saved) {
      chatHistory = JSON.parse(saved);
    }
  } catch (e) {
    chatHistory = [];
  }

  if (chatHistory.length === 0) {
    chatHistory.push(INITIAL_MESSAGE);
  }

  function saveHistory() {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(chatHistory.slice(-20)));
    } catch (e) {}
  }

  function formatTime(date) {
    const d = date || new Date();
    const h = String(d.getHours()).padStart(2, '0');
    const m = String(d.getMinutes()).padStart(2, '0');
    return `${h}:${m}`;
  }

  function formatMoney(amount) {
    return new Intl.NumberFormat('vi-VN').format(amount) + '₫';
  }

  // Parse simple markdown: **bold**, • bullets, and [text](url)
  function renderMarkdown(text) {
    if (!text) return '';
    let escaped = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    // Bold **text**
    escaped = escaped.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

    // Code `code`
    escaped = escaped.replace(/`([^`]+)`/g, '<code style="background:rgba(212,175,55,0.15);color:#8c5d1e;padding:1px 5px;border-radius:4px;font-family:monospace;">$1</code>');

    // Links [text](url)
    escaped = escaped.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" style="color:#b89868;text-decoration:underline;font-weight:600;">$1</a>');

    // Bullets • or -
    escaped = escaped.replace(/(?:\r\n|\r|\n)/g, '<br>');
    return escaped;
  }

  // Inject DOM elements
  function createChatWidget() {
    // 1. Launcher button
    const launcher = document.createElement('div');
    launcher.className = 'endless-chat-launcher';
    launcher.id = 'endlessChatLauncher';
    launcher.setAttribute('role', 'button');
    launcher.setAttribute('aria-label', 'Mở trợ lý ảo Endless');
    launcher.title = 'Trợ lý ảo hỗ trợ 24/7';
    launcher.innerHTML = `
      <div class="endless-chat-launcher__icon endless-chat-launcher__icon--open">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
        </svg>
      </div>
      <div class="endless-chat-launcher__icon endless-chat-launcher__icon--close">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </div>
      <div class="endless-chat-badge" id="endlessChatBadge">1</div>
    `;

    // 2. Teaser Prompt (pops up for 1st time visitors)
    const isTeaserDismissed = sessionStorage.getItem(TEASER_DISMISSED_KEY);
    let teaser = null;
    if (!isTeaserDismissed) {
      teaser = document.createElement('div');
      teaser.className = 'endless-chat-teaser';
      teaser.id = 'endlessChatTeaser';
      teaser.innerHTML = `
        <span>👋 Cần tư vấn size &amp; mã giảm giá?</span>
        <button class="endless-chat-teaser__close" id="endlessChatTeaserClose" aria-label="Đóng gợi ý">✕</button>
      `;
    }

    // 3. Chat Window
    const windowEl = document.createElement('div');
    windowEl.className = 'endless-chat-window';
    windowEl.id = 'endlessChatWindow';
    windowEl.innerHTML = `
      <!-- Header -->
      <div class="endless-chat-header">
        <div class="endless-chat-header__profile">
          <div class="endless-chat-header__avatar">
            <span>🌿</span>
            <div class="endless-chat-header__status" title="Đang trực tuyến"></div>
          </div>
          <div class="endless-chat-header__info">
            <div class="endless-chat-header__name">
              Endless Bot <span class="endless-chat-header__badge">AI</span>
            </div>
            <div class="endless-chat-header__sub">Trợ lý thời trang trực tuyến 24/7</div>
          </div>
        </div>
        <div class="endless-chat-header__actions">
          <button class="endless-chat-btn-icon" id="endlessChatReset" title="Bắt đầu hội thoại mới" aria-label="Làm mới">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="23 4 23 10 17 10"></polyline>
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
            </svg>
          </button>
          <button class="endless-chat-btn-icon" id="endlessChatClose" title="Thu nhỏ" aria-label="Đóng chat">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
      </div>

      <!-- Messages Body -->
      <div class="endless-chat-body" id="endlessChatBody">
        <!-- Messages rendered here -->
      </div>

      <!-- Typing Indicator -->
      <div class="endless-chat-typing" id="endlessChatTyping">
        <div class="endless-chat-typing__dot"></div>
        <div class="endless-chat-typing__dot"></div>
        <div class="endless-chat-typing__dot"></div>
      </div>

      <!-- Quick Chips -->
      <div class="endless-chat-chips" id="endlessChatChips">
        <!-- Chips injected dynamically -->
      </div>

      <!-- Footer Input -->
      <div class="endless-chat-footer">
        <div class="endless-chat-input-wrapper">
          <input type="text" class="endless-chat-input" id="endlessChatInput" placeholder="Nhắn tin hỏi size, voucher, sản phẩm..." autocomplete="off">
        </div>
        <button class="endless-chat-send" id="endlessChatSend" aria-label="Gửi tin nhắn">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="22" y1="2" x2="11" y2="13"></line>
            <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
          </svg>
        </button>
      </div>
    `;

    document.body.appendChild(launcher);
    if (teaser) document.body.appendChild(teaser);
    document.body.appendChild(windowEl);

    bindEvents(launcher, teaser, windowEl);
    renderMessages();
  }

  function showToast(message) {
    const existing = document.querySelector('.endless-chat-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = 'endless-chat-toast';
    toast.textContent = message;
    const windowEl = document.getElementById('endlessChatWindow');
    if (windowEl) {
      windowEl.appendChild(toast);
      setTimeout(() => toast.remove(), 1800);
    }
  }

  function bindEvents(launcher, teaser, windowEl) {
    const input = document.getElementById('endlessChatInput');
    const sendBtn = document.getElementById('endlessChatSend');
    const closeBtn = document.getElementById('endlessChatClose');
    const resetBtn = document.getElementById('endlessChatReset');
    const badge = document.getElementById('endlessChatBadge');

    function toggleChat(open) {
      isWindowOpen = typeof open === 'boolean' ? open : !isWindowOpen;
      if (isWindowOpen) {
        windowEl.classList.add('is-open');
        launcher.classList.add('is-open');
        if (badge) badge.style.display = 'none';
        if (teaser) {
          teaser.style.display = 'none';
          sessionStorage.setItem(TEASER_DISMISSED_KEY, 'true');
        }
        setTimeout(() => input && input.focus(), 250);
        scrollToBottom();
      } else {
        windowEl.classList.remove('is-open');
        launcher.classList.remove('is-open');
      }
    }

    launcher.addEventListener('click', () => toggleChat());
    if (closeBtn) closeBtn.addEventListener('click', () => toggleChat(false));

    if (teaser) {
      teaser.addEventListener('click', (e) => {
        if (e.target.id === 'endlessChatTeaserClose') {
          teaser.remove();
          sessionStorage.setItem(TEASER_DISMISSED_KEY, 'true');
        } else {
          toggleChat(true);
        }
      });
    }

    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        chatHistory = [INITIAL_MESSAGE];
        saveHistory();
        renderMessages();
      });
    }

    // Send actions
    function handleSend() {
      const text = input.value.trim();
      if (!text || isTyping) return;
      input.value = '';
      sendMessage(text);
    }

    sendBtn.addEventListener('click', handleSend);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleSend();
      }
    });

    // Close on Escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && isWindowOpen) {
        toggleChat(false);
      }
    });
  }

  function renderMessages() {
    const body = document.getElementById('endlessChatBody');
    if (!body) return;
    body.innerHTML = '';

    chatHistory.forEach((msg) => {
      const msgEl = document.createElement('div');
      msgEl.className = `endless-chat-msg endless-chat-msg--${msg.sender}`;

      let contentHtml = `<div class="endless-chat-bubble">${renderMarkdown(msg.text)}`;

      // Render Vouchers if available
      if (msg.vouchers && msg.vouchers.length > 0) {
        contentHtml += `<div class="endless-chat-vouchers">`;
        msg.vouchers.forEach((v) => {
          contentHtml += `
            <div class="endless-voucher-card">
              <div>
                <span class="endless-voucher-card__code">${v.code}</span>
                <div class="endless-voucher-card__desc">${v.description}</div>
              </div>
              <button class="endless-voucher-card__btn" data-copy="${v.code}">Sao chép</button>
            </div>
          `;
        });
        contentHtml += `</div>`;
      }

      // Render Products if available
      if (msg.products && msg.products.length > 0) {
        contentHtml += `<div class="endless-chat-products">`;
        msg.products.forEach((p) => {
          const imgUrl = p.image ? p.image.replace('../', '') : 'img/id1.jpg';
          contentHtml += `
            <a href="index.html#san-pham" class="endless-product-mini" title="${p.name}">
              <img src="${imgUrl}" alt="${p.name}" class="endless-product-mini__img" loading="lazy">
              <div class="endless-product-mini__body">
                <span class="endless-product-mini__title">${p.name}</span>
                <span class="endless-product-mini__price">${formatMoney(p.price)}</span>
              </div>
            </a>
          `;
        });
        contentHtml += `</div>`;
      }

      contentHtml += `</div><div class="endless-chat-time">${msg.time}</div>`;
      msgEl.innerHTML = contentHtml;
      body.appendChild(msgEl);
    });

    // Attach copy button handlers
    const copyBtns = body.querySelectorAll('.endless-voucher-card__btn');
    copyBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const code = btn.getAttribute('data-copy');
        if (code) {
          navigator.clipboard.writeText(code).then(() => {
            showToast(`✓ Đã sao chép: ${code}`);
            btn.textContent = 'Đã chép!';
            setTimeout(() => btn.textContent = 'Sao chép', 2000);
          }).catch(() => {
            showToast(`Mã ưu đãi: ${code}`);
          });
        }
      });
    });

    // Render suggestions from last message
    const lastMsg = chatHistory[chatHistory.length - 1];
    renderChips(lastMsg && lastMsg.suggestions ? lastMsg.suggestions : []);
    scrollToBottom();
  }

  function renderChips(suggestions) {
    const chipsContainer = document.getElementById('endlessChatChips');
    if (!chipsContainer) return;
    chipsContainer.innerHTML = '';

    if (!suggestions || suggestions.length === 0) {
      chipsContainer.style.display = 'none';
      return;
    }

    chipsContainer.style.display = 'flex';
    suggestions.forEach((chipText) => {
      const chip = document.createElement('button');
      chip.className = 'endless-chip';
      chip.textContent = chipText;
      chip.addEventListener('click', () => {
        // Strip emoji for sending clean query
        const cleanQuery = chipText.replace(/^[^\w\s\dÀ-ỹ]+/i, '').trim();
        sendMessage(cleanQuery || chipText);
      });
      chipsContainer.appendChild(chip);
    });
  }

  function scrollToBottom() {
    const body = document.getElementById('endlessChatBody');
    if (body) {
      setTimeout(() => {
        body.scrollTop = body.scrollHeight;
      }, 50);
    }
  }

  function setTyping(visible) {
    isTyping = visible;
    const typingEl = document.getElementById('endlessChatTyping');
    const sendBtn = document.getElementById('endlessChatSend');
    if (typingEl) {
      if (visible) {
        typingEl.classList.add('is-visible');
        scrollToBottom();
      } else {
        typingEl.classList.remove('is-visible');
      }
    }
    if (sendBtn) sendBtn.disabled = visible;
  }

  async function sendMessage(text) {
    // 1. Add user message
    const userMsg = {
      sender: 'user',
      text: text,
      time: formatTime(new Date())
    };
    chatHistory.push(userMsg);
    saveHistory();
    renderMessages();

    // 2. Show typing indicator
    setTyping(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ message: text })
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const data = await res.json();
      
      // Simulate realistic typing delay (400ms - 800ms)
      setTimeout(() => {
        setTyping(false);
        const botMsg = {
          sender: 'bot',
          text: data.reply || 'Dạ em đã nhận được thông tin.',
          time: formatTime(new Date()),
          suggestions: data.suggestions || ['🏷️ Mã giảm giá hot', '📏 Bảng tư vấn size', '🚚 Phí giao hàng'],
          vouchers: data.vouchers || null,
          products: data.products || null,
          recommendedSize: data.recommendedSize || null
        };
        chatHistory.push(botMsg);
        saveHistory();
        renderMessages();
      }, 500);

    } catch (err) {
      console.warn('Chatbot API unavailable, using smart client fallback:', err);
      setTimeout(() => {
        setTyping(false);
        const fallbackMsg = handleClientFallback(text);
        chatHistory.push(fallbackMsg);
        saveHistory();
        renderMessages();
      }, 400);
    }
  }

  // Client fallback in case of network issue
  function handleClientFallback(text) {
    const q = text.toLowerCase();
    let reply = 'Dạ em có thể hỗ trợ quý khách về mã giảm giá, cách chọn size chuẩn, chính sách giao hàng và đổi trả.';
    let suggestions = ['🏷️ Mã giảm giá hot', '📏 Tư vấn chọn size', '🚚 Phí giao hàng', '📞 Hotline 1900 8888'];
    let vouchers = null;

    if (q.includes('giảm giá') || q.includes('voucher') || q.includes('mã') || q.includes('khuyến mãi')) {
      reply = '🎉 **Các mã ưu đãi nổi bật đang áp dụng tại Endless Shop:**\n\nBạn có thể sao chép và áp dụng ngay khi đặt hàng nhé!';
      vouchers = [
        { code: 'ENDLESS10', type: 'percent', value: 10, description: 'Giảm 10% tổng đơn hàng' },
        { code: 'FREESHIP', type: 'fixed', value: 30000, description: 'Miễn phí giao hàng (đơn từ 300k)' },
        { code: 'KM50K', type: 'fixed', value: 50000, description: 'Giảm 50.000₫ đơn mùa đông' }
      ];
    } else if (q.includes('ship') || q.includes('giao')) {
      reply = '🚚 **Chính sách giao hàng Endless:**\n\n• Giao nhanh 1–2 ngày nội thành, 2–4 ngày toàn quốc.\n• Miễn phí vận chuyển cho đơn từ 300.000₫.\n• Phí ship cố định 30.000₫ cho mọi đơn hàng.';
    } else if (q.includes('đổi') || q.includes('trả')) {
      reply = '🔄 **Đổi trả trong 30 ngày:**\n\n• Hỗ trợ đổi size tận nhà miễn phí.\n• Sản phẩm còn nguyên tem mác chưa qua giặt tẩy.';
    }

    return {
      sender: 'bot',
      text: reply,
      time: formatTime(new Date()),
      suggestions: suggestions,
      vouchers: vouchers
    };
  }

  // Auto initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', createChatWidget);
  } else {
    createChatWidget();
  }
})();
