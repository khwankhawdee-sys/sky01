/* ==========================================================
   Sky mood — shared script for product.html, order.html, admin.html
   Each section runs only if its page's elements exist.
   ========================================================== */

var SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwxyrZHmgP37DUmviB4r6XHhFyuWN1-jk8PTi38qqZh74WQ4ms0pVxY-hi6p-p_hQtn9A/exec';
var SHEET_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQouj4IT4BEgD8xlrDRft-t2eUPoopwTzvcQ2MLK7Da8swffrl73NG4hoQMBOTX6s2m786FbZ_eHjOo/pub?gid=0&single=true&output=csv';

var MOOD_LABELS = { fresh: 'Fresh', sweet: 'Sweet' };

/* ---------- helpers ---------- */
function escapeHtml(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatPrice(price) {
  return Number(price).toLocaleString('th-TH') + ' บาท';
}

/* ==========================================================
   product.html
   ========================================================== */
function initProductPage() {
  var filterBar = document.getElementById('filter-bar');
  var productList = document.getElementById('product-list');
  if (!filterBar || !productList) return;

  var products = [];
  var currentMood = 'all';

  var filters = [
    { value: 'all', label: 'ทั้งหมด' },
    { value: 'fresh', label: 'Fresh' },
    { value: 'sweet', label: 'Sweet' }
  ];

  function renderFilters() {
    filterBar.innerHTML = '';
    filters.forEach(function (f) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = f.label;
      btn.setAttribute('data-mood', f.value);
      var active = f.value === currentMood;
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-pressed', active ? 'true' : 'false');
      btn.addEventListener('click', function () {
        currentMood = f.value;
        renderFilters();
        renderProducts();
      });
      filterBar.appendChild(btn);
    });
  }

  function buildOrderUrl(p) {
    var itemName = (p.name + ' ' + (p.size || '')).trim();
    return 'order.html?item=' + encodeURIComponent(itemName) +
           '&price=' + encodeURIComponent(p.price);
  }

  function renderProducts() {
    var list = products.filter(function (p) {
      return currentMood === 'all' || p.mood === currentMood;
    });

    if (list.length === 0) {
      productList.innerHTML = '<p class="muted">ยังไม่มีสินค้าในหมวดนี้</p>';
      return;
    }

    productList.innerHTML = list.map(function (p) {
      var moodLabel = MOOD_LABELS[p.mood] || p.mood;
      return '' +
        '<article class="product-card" data-mood="' + escapeHtml(p.mood) + '">' +
          '<img class="product-card__image" src="' + escapeHtml(p.image) + '" alt="' + escapeHtml(p.name) + '" loading="lazy">' +
          '<div class="product-card__body">' +
            '<div class="product-card__mood"><span class="mood-dot mood-dot--' + escapeHtml(p.mood) + '"></span>' + escapeHtml(moodLabel) + '</div>' +
            '<h3 class="product-card__name">' + escapeHtml(p.name) + '</h3>' +
            (p.size ? '<div class="product-card__meta">' + escapeHtml(p.size) + '</div>' : '') +
            '<div class="product-card__footer">' +
              '<span class="price">' + escapeHtml(formatPrice(p.price)) + '</span>' +
              '<a class="btn" href="' + buildOrderUrl(p) + '">สั่งซื้อ</a>' +
            '</div>' +
          '</div>' +
        '</article>';
    }).join('');
  }

  // read ?mood=xxx (only accept known moods)
  var moodParam = new URLSearchParams(window.location.search).get('mood');
  if (moodParam) {
    moodParam = moodParam.toLowerCase();
    if (moodParam === 'fresh' || moodParam === 'sweet') currentMood = moodParam;
  }

  renderFilters();
  productList.innerHTML = '<p class="muted">กำลังโหลดสินค้า...</p>';

  fetch('products.json')
    .then(function (res) {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.json();
    })
    .then(function (data) {
      products = data;
      renderProducts();
    })
    .catch(function (error) {
      console.error(error);
      productList.innerHTML = '<p class="muted">โหลดสินค้าไม่สำเร็จ กรุณารีเฟรชหน้าอีกครั้ง</p>';
    });
}

/* ==========================================================
   order.html
   ========================================================== */
function initOrderPage() {
  var form = document.getElementById('orderForm');
  if (!form) return;

  var customerName = document.getElementById('customerName');
  var contact = document.getElementById('contact');
  var items = document.getElementById('items');
  var total = document.getElementById('total');
  var note = document.getElementById('note');

  // prefill #items and #total from URL parameters
  var params = new URLSearchParams(window.location.search);
  var itemParam = params.get('item');
  var priceParam = params.get('price');
  if (itemParam !== null) items.value = itemParam;
  if (priceParam !== null) total.value = priceParam;

  form.addEventListener('submit', function (e) {
    e.preventDefault();

    var payload = {
      customerName: customerName.value.trim(),
      contact: contact.value.trim(),
      items: items.value.trim(),
      total: total.value.trim(),
      note: note.value.trim()
    };

    fetch(SCRIPT_URL, {
      method: 'POST',
      body: JSON.stringify(payload)
    })
    .then(() => { window.location.href = 'thankyou.html'; })
    .catch(error => {
      console.error(error);
      alert('เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง');
    });
  });
}

/* ==========================================================
   admin.html
   ========================================================== */

// Minimal CSV parser: handles quoted fields, "" escapes, commas and
// line breaks inside quotes, and both \n and \r\n line endings.
function parseCSV(text) {
  var rows = [];
  var row = [];
  var field = '';
  var inQuotes = false;

  for (var i = 0; i < text.length; i++) {
    var ch = text[i];

    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else { inQuotes = false; }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += ch;
    }
  }

  // last field / row without trailing newline
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows;
}

function initAdminPage() {
  var tbody = document.querySelector('#ordersTable tbody');
  if (!tbody) return;

  function showMessage(msg) {
    tbody.innerHTML = '<tr><td colspan="6" class="muted">' + escapeHtml(msg) + '</td></tr>';
  }

  showMessage('กำลังโหลดข้อมูล...');

  fetch(SHEET_CSV_URL)
    .then(function (res) {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.text();
    })
    .then(function (text) {
      var rows = parseCSV(text).filter(function (r) {
        return r.some(function (c) { return c.trim() !== ''; });
      });

      // skip a header row if the first cell has no digits (a real timestamp always does)
      if (rows.length > 0 && !/\d/.test(rows[0][0] || '')) rows.shift();

      if (rows.length === 0) {
        showMessage('ยังไม่มีคำสั่งซื้อ');
        return;
      }

      // rows are appended in time order, so reverse = newest first
      rows.reverse();

      tbody.innerHTML = rows.map(function (r) {
        var cells = '';
        for (var c = 0; c < 6; c++) {
          cells += '<td>' + escapeHtml(r[c] || '') + '</td>';
        }
        return '<tr>' + cells + '</tr>';
      }).join('');
    })
    .catch(function (error) {
      console.error(error);
      showMessage('โหลดข้อมูลไม่สำเร็จ กรุณารีเฟรชหน้าอีกครั้ง');
    });
}

/* ---------- init ---------- */
document.addEventListener('DOMContentLoaded', function () {
  initProductPage();
  initOrderPage();
  initAdminPage();
});
