/**
 * Endless Shop - Interactive Info Pages Logic
 * Handles:
 *  - Smart Fit Finder (Size Calculator)
 *  - Dynamic Category Size Charts with Unit Switching (cm / inch)
 *  - FAQ Accordion
 *  - Online Return / Warranty (RMA) Request Form
 *  - Seamless Chatbot integration
 */

(function () {
  'use strict';

  // -------------------------------------------------------------
  // 1. DATA: SIZE CHARTS DATASET (CM & INCH)
  // -------------------------------------------------------------
  const SIZE_DATA = {
    'ao-thun': {
      title: 'Bảng kích cỡ Áo thun & Áo Polo Endless',
      headers: ['Kích cỡ', 'Vòng ngực (cm)', 'Rộng vai (cm)', 'Dài áo (cm)', 'Dài tay (cm)', 'Chiều cao gợi ý', 'Cân nặng gợi ý'],
      headersInch: ['Kích cỡ', 'Vòng ngực (in)', 'Rộng vai (in)', 'Dài áo (in)', 'Dài tay (in)', 'Chiều cao gợi ý', 'Cân nặng gợi ý'],
      rows: [
        { size: 'S', valuesCm: ['88 - 92', '41', '66', '20'], valuesIn: ['34.6 - 36.2', '16.1', '26.0', '7.9'], height: '1m55 - 1m62', weight: '48 - 54 kg' },
        { size: 'M', valuesCm: ['92 - 96', '43', '68', '21'], valuesIn: ['36.2 - 37.8', '16.9', '26.8', '8.3'], height: '1m63 - 1m68', weight: '55 - 63 kg', isPopular: true },
        { size: 'L', valuesCm: ['96 - 101', '45', '71', '22'], valuesIn: ['37.8 - 39.8', '17.7', '28.0', '8.7'], height: '1m69 - 1m75', weight: '64 - 72 kg' },
        { size: 'XL', valuesCm: ['101 - 106', '47', '73', '23'], valuesIn: ['39.8 - 41.7', '18.5', '28.7', '9.1'], height: '1m76 - 1m82', weight: '73 - 82 kg' },
        { size: 'XXL', valuesCm: ['106 - 112', '49', '75', '24'], valuesIn: ['41.7 - 44.1', '19.3', '29.5', '9.4'], height: 'Trên 1m82', weight: 'Trên 82 kg' }
      ]
    },
    'ao-somi': {
      title: 'Bảng kích cỡ Áo sơ mi Oxford & Flannel',
      headers: ['Kích cỡ', 'Vòng cổ (cm)', 'Vòng ngực (cm)', 'Rộng vai (cm)', 'Dài áo (cm)', 'Dài tay (cm)', 'Chiều cao & Cân nặng'],
      headersInch: ['Kích cỡ', 'Vòng cổ (in)', 'Vòng ngực (in)', 'Rộng vai (in)', 'Dài áo (in)', 'Dài tay (in)', 'Chiều cao & Cân nặng'],
      rows: [
        { size: 'S', valuesCm: ['38', '92 - 96', '42', '71', '60'], valuesIn: ['15.0', '36.2 - 37.8', '16.5', '28.0', '23.6'], note: '1m55 - 1m63 · 50 - 55 kg' },
        { size: 'M', valuesCm: ['39', '96 - 100', '44', '73', '61'], valuesIn: ['15.4', '37.8 - 39.4', '17.3', '28.7', '24.0'], note: '1m64 - 1m70 · 56 - 64 kg', isPopular: true },
        { size: 'L', valuesCm: ['40', '100 - 104', '46', '75', '62'], valuesIn: ['15.7', '39.4 - 40.9', '18.1', '29.5', '24.4'], note: '1m71 - 1m76 · 65 - 73 kg' },
        { size: 'XL', valuesCm: ['41', '104 - 109', '48', '77', '63'], valuesIn: ['16.1', '40.9 - 42.9', '18.9', '30.3', '24.8'], note: '1m77 - 1m83 · 74 - 83 kg' }
      ]
    },
    'ao-khoac': {
      title: 'Bảng kích cỡ Áo khoác & Cardigan Scandinavian',
      headers: ['Kích cỡ', 'Vòng ngực (cm)', 'Rộng vai (cm)', 'Dài áo (cm)', 'Dài tay (cm)', 'Form khuyến nghị'],
      headersInch: ['Kích cỡ', 'Vòng ngực (in)', 'Rộng vai (in)', 'Dài áo (in)', 'Dài tay (in)', 'Form khuyến nghị'],
      rows: [
        { size: 'S', valuesCm: ['96 - 100', '44', '66', '62'], valuesIn: ['37.8 - 39.4', '17.3', '26.0', '24.4'], note: 'Vừa vặn dáng dưới 56kg' },
        { size: 'M', valuesCm: ['100 - 105', '46', '68', '63'], valuesIn: ['39.4 - 41.3', '18.1', '26.8', '24.8'], note: 'Tiêu chuẩn 57 - 65kg', isPopular: true },
        { size: 'L', valuesCm: ['105 - 110', '48', '71', '64'], valuesIn: ['41.3 - 43.3', '18.9', '28.0', '25.2'], note: 'Thoải mái 66 - 75kg' },
        { size: 'XL', valuesCm: ['110 - 116', '50', '73', '65'], valuesIn: ['43.3 - 45.7', '19.7', '28.7', '25.6'], note: 'Oversize hoặc trên 75kg' }
      ]
    },
    'quan-dai': {
      title: 'Bảng kích cỡ Quần dài, Jeans & Kaki Endless',
      headers: ['Kích cỡ (Size / Số)', 'Vòng eo (cm)', 'Vòng mông (cm)', 'Dài quần (cm)', 'Rộng ống (cm)', 'Cân nặng phù hợp'],
      headersInch: ['Kích cỡ (Size / Số)', 'Vòng eo (in)', 'Vòng mông (in)', 'Dài quần (in)', 'Rộng ống (in)', 'Cân nặng phù hợp'],
      rows: [
        { size: 'S / 29', valuesCm: ['72 - 75', '88 - 92', '96', '16.5'], valuesIn: ['28.3 - 29.5', '34.6 - 36.2', '37.8', '6.5'], note: '50 - 56 kg' },
        { size: 'M / 30', valuesCm: ['76 - 79', '92 - 96', '98', '17.0'], valuesIn: ['29.9 - 31.1', '36.2 - 37.8', '38.6', '6.7'], note: '57 - 64 kg', isPopular: true },
        { size: 'L / 31', valuesCm: ['80 - 83', '96 - 100', '100', '17.5'], valuesIn: ['31.5 - 32.7', '37.8 - 39.4', '39.4', '6.9'], note: '65 - 72 kg' },
        { size: 'XL / 32', valuesCm: ['84 - 88', '100 - 105', '102', '18.0'], valuesIn: ['33.1 - 34.6', '39.4 - 41.3', '40.2', '7.1'], note: '73 - 80 kg' },
        { size: 'XXL / 34', valuesCm: ['89 - 94', '105 - 110', '104', '18.5'], valuesIn: ['35.0 - 37.0', '41.3 - 43.3', '40.9', '7.3'], note: '81 - 88 kg' }
      ]
    },
    'quan-short': {
      title: 'Bảng kích cỡ Quần Shorts & Quần đùi Kaki',
      headers: ['Kích cỡ', 'Vòng eo (cm)', 'Vòng mông (cm)', 'Dài quần (cm)', 'Rộng gấu (cm)', 'Chiều cao gợi ý'],
      headersInch: ['Kích cỡ', 'Vòng eo (in)', 'Vòng mông (in)', 'Dài quần (in)', 'Rộng gấu (in)', 'Chiều cao gợi ý'],
      rows: [
        { size: 'S', valuesCm: ['72 - 76', '90 - 94', '42', '24'], valuesIn: ['28.3 - 29.9', '35.4 - 37.0', '16.5', '9.4'], note: '1m55 - 1m64' },
        { size: 'M', valuesCm: ['77 - 81', '94 - 98', '44', '25'], valuesIn: ['30.3 - 31.9', '37.0 - 38.6', '17.3', '9.8'], note: '1m65 - 1m72', isPopular: true },
        { size: 'L', valuesCm: ['82 - 86', '98 - 103', '46', '26'], valuesIn: ['32.3 - 33.9', '38.6 - 40.6', '18.1', '10.2'], note: '1m73 - 1m78' },
        { size: 'XL', valuesCm: ['87 - 92', '103 - 108', '48', '27'], valuesIn: ['34.3 - 36.2', '40.6 - 42.5', '18.9', '10.6'], note: 'Trên 1m78' }
      ]
    },
    'vay': {
      title: 'Bảng kích cỡ Váy liền thân & Chân váy Nữ',
      headers: ['Kích cỡ', 'Vòng ngực (cm)', 'Vòng eo (cm)', 'Vòng mông (cm)', 'Dài váy (cm)', 'Dáng người phù hợp'],
      headersInch: ['Kích cỡ', 'Vòng ngực (in)', 'Vòng eo (in)', 'Vòng mông (in)', 'Dài váy (in)', 'Dáng người phù hợp'],
      rows: [
        { size: 'S', valuesCm: ['82 - 85', '64 - 67', '86 - 89', '94'], valuesIn: ['32.3 - 33.5', '25.2 - 26.4', '33.9 - 35.0', '37.0'], note: '1m50 - 1m58 · 42 - 47 kg' },
        { size: 'M', valuesCm: ['86 - 89', '68 - 72', '90 - 93', '96'], valuesIn: ['33.9 - 35.0', '26.8 - 28.3', '35.4 - 36.6', '37.8'], note: '1m58 - 1m64 · 48 - 54 kg', isPopular: true },
        { size: 'L', valuesCm: ['90 - 94', '73 - 77', '94 - 98', '98'], valuesIn: ['35.4 - 37.0', '28.7 - 30.3', '37.0 - 38.6', '38.6'], note: '1m63 - 1m68 · 55 - 60 kg' },
        { size: 'XL', valuesCm: ['95 - 99', '78 - 83', '99 - 104', '100'], valuesIn: ['37.4 - 39.0', '30.7 - 32.7', '39.0 - 40.9', '39.4'], note: '1m66 - 1m72 · 61 - 67 kg' }
      ]
    }
  };

  let currentCategory = 'ao-thun';
  let currentUnit = 'cm'; // 'cm' or 'inch'

  // -------------------------------------------------------------
  // 2. RENDER SIZE CHART TABLE
  // -------------------------------------------------------------
  function renderSizeTable() {
    const tableContainer = document.getElementById('scandiSizeTable');
    if (!tableContainer) return;

    const catData = SIZE_DATA[currentCategory];
    if (!catData) return;

    const isInch = currentUnit === 'inch';
    const headers = isInch ? catData.headersInch : catData.headers;

    let html = '<table class="scandi-table"><thead><tr>';
    headers.forEach(h => {
      html += `<th>${escapeHtml(h)}</th>`;
    });
    html += '</tr></thead><tbody>';

    catData.rows.forEach(row => {
      const vals = isInch ? row.valuesIn : row.valuesCm;
      html += '<tr>';
      html += `<td class="size-code">${escapeHtml(row.size)}${row.isPopular ? ' <span class="badge-recommend">Phổ biến</span>' : ''}</td>`;
      vals.forEach(v => {
        html += `<td>${escapeHtml(v)}</td>`;
      });
      if (row.height && row.weight) {
        html += `<td>${escapeHtml(row.height)}</td><td>${escapeHtml(row.weight)}</td>`;
      } else if (row.note) {
        html += `<td>${escapeHtml(row.note)}</td>`;
      }
      html += '</tr>';
    });

    html += '</tbody></table>';
    tableContainer.innerHTML = html;

    const titleEl = document.getElementById('sizeChartTitle');
    if (titleEl) titleEl.textContent = catData.title;
  }

  // -------------------------------------------------------------
  // 3. SMART FIT FINDER (CALCULATOR ENGINE)
  // -------------------------------------------------------------
  let fitGender = 'nam';
  let fitPref = 'regular'; // 'slim', 'regular', 'relaxed'

  function calculateSize(height, weight, gender, pref) {
    // Height in cm, Weight in kg
    let recommended = 'M';
    let confidence = 95;
    let description = '';

    // Height & Weight Index calculation
    const bmi = weight / Math.pow(height / 100, 2);

    if (gender === 'nu') {
      if (height < 155 || weight < 46) {
        recommended = 'S';
      } else if (height <= 162 && weight <= 53) {
        recommended = 'M';
      } else if (height <= 168 && weight <= 60) {
        recommended = 'L';
      } else {
        recommended = 'XL';
      }
    } else { // Nam & Unisex
      if (height < 160 || weight < 52) {
        recommended = 'S';
      } else if (height <= 167 && weight <= 62) {
        recommended = 'M';
      } else if (height <= 175 && weight <= 72) {
        recommended = 'L';
      } else if (height <= 183 && weight <= 82) {
        recommended = 'XL';
      } else {
        recommended = 'XXL';
      }
    }

    // Adjust based on fit preference
    const sizeLadder = ['S', 'M', 'L', 'XL', 'XXL'];
    let curIdx = sizeLadder.indexOf(recommended);

    if (pref === 'slim' && curIdx > 0 && bmi < 21) {
      // Slightly more fitted
      curIdx = Math.max(0, curIdx - 1);
      recommended = sizeLadder[curIdx];
      confidence = 92;
    } else if (pref === 'relaxed' && curIdx < sizeLadder.length - 1) {
      curIdx = Math.min(sizeLadder.length - 1, curIdx + 1);
      recommended = sizeLadder[curIdx];
      confidence = 94;
    }

    // Craft personalized advice
    const fitLabels = {
      slim: 'Ôm vừa vặn (Slim Fit)',
      regular: 'Tiêu chuẩn (Regular Fit)',
      relaxed: 'Rộng rãi thoải mái (Relaxed / Oversize)'
    };

    description = `Với chiều cao <strong>${height} cm</strong> và cân nặng <strong>${weight} kg</strong> theo phong cách <strong>${fitLabels[pref]}</strong>, Size <strong>${recommended}</strong> sẽ mang lại cảm giác thoải mái nhất ở phần vai và độ rủ tự nhiên chuẩn phong cách Bắc Âu.`;

    return {
      size: recommended,
      confidence: confidence,
      description: description,
      fitName: fitLabels[pref]
    };
  }

  function updateFitCalculator() {
    const heightSlider = document.getElementById('fitHeightSlider');
    const heightNum = document.getElementById('fitHeightNum');
    const weightSlider = document.getElementById('fitWeightSlider');
    const weightNum = document.getElementById('fitWeightNum');

    if (!heightSlider || !weightSlider) return;

    const height = parseInt(heightSlider.value, 10) || 170;
    const weight = parseInt(weightSlider.value, 10) || 65;

    const result = calculateSize(height, weight, fitGender, fitPref);

    const sizeEl = document.getElementById('fitResultSize');
    const nameEl = document.getElementById('fitResultName');
    const descEl = document.getElementById('fitResultDesc');
    const barEl = document.getElementById('fitMeterFill');
    const meterTextEl = document.getElementById('fitMeterText');

    if (sizeEl) sizeEl.textContent = result.size;
    if (nameEl) nameEl.textContent = `Form: ${result.fitName}`;
    if (descEl) descEl.innerHTML = result.description;
    if (barEl) barEl.style.width = `${result.confidence}%`;
    if (meterTextEl) meterTextEl.textContent = `Độ phù hợp khuyến nghị: ${result.confidence}%`;
  }

  function initFitFinderEvents() {
    const heightSlider = document.getElementById('fitHeightSlider');
    const heightNum = document.getElementById('fitHeightNum');
    const weightSlider = document.getElementById('fitWeightSlider');
    const weightNum = document.getElementById('fitWeightNum');

    if (heightSlider && heightNum) {
      heightSlider.addEventListener('input', () => {
        heightNum.value = heightSlider.value;
        const valDisplay = document.getElementById('fitHeightVal');
        if (valDisplay) valDisplay.textContent = `${heightSlider.value} cm`;
        updateFitCalculator();
      });
      heightNum.addEventListener('input', () => {
        heightSlider.value = heightNum.value;
        const valDisplay = document.getElementById('fitHeightVal');
        if (valDisplay) valDisplay.textContent = `${heightNum.value} cm`;
        updateFitCalculator();
      });
    }

    if (weightSlider && weightNum) {
      weightSlider.addEventListener('input', () => {
        weightNum.value = weightSlider.value;
        const valDisplay = document.getElementById('fitWeightVal');
        if (valDisplay) valDisplay.textContent = `${weightSlider.value} kg`;
        updateFitCalculator();
      });
      weightNum.addEventListener('input', () => {
        weightSlider.value = weightNum.value;
        const valDisplay = document.getElementById('fitWeightVal');
        if (valDisplay) valDisplay.textContent = `${weightNum.value} kg`;
        updateFitCalculator();
      });
    }

    // Gender pills
    document.querySelectorAll('[data-fit-gender]').forEach(btn => {
      btn.addEventListener('click', function () {
        document.querySelectorAll('[data-fit-gender]').forEach(b => b.classList.remove('is-active'));
        this.classList.add('is-active');
        fitGender = this.getAttribute('data-fit-gender');
        updateFitCalculator();
      });
    });

    // Fit preference pills
    document.querySelectorAll('[data-fit-pref]').forEach(btn => {
      btn.addEventListener('click', function () {
        document.querySelectorAll('[data-fit-pref]').forEach(b => b.classList.remove('is-active'));
        this.classList.add('is-active');
        fitPref = this.getAttribute('data-fit-pref');
        updateFitCalculator();
      });
    });

    // Category chart pills
    document.querySelectorAll('[data-size-cat]').forEach(btn => {
      btn.addEventListener('click', function () {
        document.querySelectorAll('[data-size-cat]').forEach(b => b.classList.remove('is-active'));
        this.classList.add('is-active');
        currentCategory = this.getAttribute('data-size-cat');
        renderSizeTable();
      });
    });

    // Unit buttons
    document.querySelectorAll('[data-unit]').forEach(btn => {
      btn.addEventListener('click', function () {
        document.querySelectorAll('[data-unit]').forEach(b => b.classList.remove('is-active'));
        this.classList.add('is-active');
        currentUnit = this.getAttribute('data-unit');
        renderSizeTable();
      });
    });

    // Initial render
    updateFitCalculator();
    renderSizeTable();
  }

  // -------------------------------------------------------------
  // 4. FAQ ACCORDION HANDLER
  // -------------------------------------------------------------
  function initFaqAccordion() {
    document.querySelectorAll('.faq-item').forEach(item => {
      const trigger = item.querySelector('.faq-trigger');
      if (!trigger) return;
      trigger.addEventListener('click', () => {
        const isOpen = item.classList.contains('is-open');
        // Close siblings for clean accordion
        const parent = item.closest('.faq-wrap');
        if (parent) {
          parent.querySelectorAll('.faq-item').forEach(sibling => {
            if (sibling !== item) sibling.classList.remove('is-open');
          });
        }
        item.classList.toggle('is-open', !isOpen);
      });
    });
  }

  // -------------------------------------------------------------
  // 5. ONLINE RMA RETURN / WARRANTY FORM
  // -------------------------------------------------------------
  function initRmaForm() {
    const form = document.getElementById('rmaRequestForm');
    const modal = document.getElementById('rmaSuccessModal');
    const closeBtn = document.getElementById('closeRmaModal');

    if (!form || !modal) return;

    form.addEventListener('submit', function (e) {
      e.preventDefault();

      const fullName = (document.getElementById('rmaFullName')?.value || '').trim();
      const phone = (document.getElementById('rmaPhone')?.value || '').trim();
      const orderCode = (document.getElementById('rmaOrderCode')?.value || '').trim();
      const type = document.getElementById('rmaType')?.value || 'doi-size';
      const detail = (document.getElementById('rmaDetail')?.value || '').trim();

      if (!fullName || !phone || !orderCode) {
        alert('Vui lòng điền đầy đủ Họ tên, Số điện thoại và Mã đơn hàng.');
        return;
      }

      // Generate Ticket Number
      const randomTicket = 'RMA-' + Math.floor(100000 + Math.random() * 900000);

      // Populate Modal
      const ticketEl = document.getElementById('rmaTicketCode');
      const textEl = document.getElementById('rmaModalCustomerInfo');
      if (ticketEl) ticketEl.textContent = randomTicket;
      if (textEl) {
        textEl.innerHTML = `Cảm ơn bạn <strong>${escapeHtml(fullName)}</strong>! Yêu cầu hỗ trợ cho đơn hàng <strong>${escapeHtml(orderCode)}</strong> đã được ghi nhận vào hệ thống Endless Care.<br><br>Nhân viên điều phối sẽ gọi điện xác nhận trong vòng <strong>15 phút</strong> để sắp xếp bưu tá mang hàng mới đến đổi tận nhà cho bạn hoàn toàn <strong>miễn phí 0đ</strong>.`;
      }

      modal.classList.add('is-active');
      form.reset();
    });

    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        modal.classList.remove('is-active');
      });
    }

    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.classList.remove('is-active');
    });
  }

  // -------------------------------------------------------------
  // 6. GLOBAL CHATBOT TRIGGER HELPER
  // -------------------------------------------------------------
  window.openEndlessChat = function (prefillText) {
    const launcher = document.getElementById('endlessChatLauncher');
    if (launcher) {
      launcher.click();
    }
    if (prefillText) {
      setTimeout(() => {
        const input = document.getElementById('endlessChatInput');
        const sendBtn = document.getElementById('endlessChatSend');
        if (input) {
          input.value = prefillText;
          input.focus();
        }
      }, 300);
    }
  };

  // Helper escape
  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // -------------------------------------------------------------
  // INITIALIZATION ON DOM READY
  // -------------------------------------------------------------
  document.addEventListener('DOMContentLoaded', () => {
    initFitFinderEvents();
    initFaqAccordion();
    initRmaForm();
  });

})();
