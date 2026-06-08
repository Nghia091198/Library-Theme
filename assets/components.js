class BtnEffectComponent extends HTMLElement {
  #abort = null;
  #span  = null;
 
  connectedCallback() {
    this.#abort = new AbortController();
    const sig   = this.#abort.signal;
 
    // Tạo span nếu chưa có trong HTML
    this.#span = this.querySelector('span') ?? this.#createSpan();
 
    this.addEventListener('mouseenter', e => this.#move(e), { signal: sig });
    this.addEventListener('mouseout',   e => this.#move(e), { signal: sig });
  }
 
  disconnectedCallback() {
    this.#abort?.abort();
    this.#abort = null;
  }
 
  // ── Private ─────────────────────────────────
 
  #move(e) {
    const { left, top } = this.getBoundingClientRect();
    this.#span.style.top  = (e.clientY - top)  + 'px';
    this.#span.style.left = (e.clientX - left) + 'px';
  }
 
  #createSpan() {
    const span = document.createElement('span');
    this.appendChild(span);
    return span;
  }
}

class TabsComponent extends HTMLElement {
    #abort = null;
    #btns = [];
    #panels = [];
    #active = null;

    connectedCallback() {
        this.#abort ?.abort();
        this.#abort = new AbortController();
        const sig = this.#abort.signal;

        this.#btns = [...this.querySelectorAll('[role="tab"]')];
        this.#panels = [...this.querySelectorAll('[role="tabpanel"]')];

        // ARIA wiring
        this.#btns.forEach(btn => {
            const panelId = btn.dataset.target;
            const panel = this.querySelector('#' + panelId);
            if (!panel) return;
            btn.setAttribute('aria-controls', panelId);
            btn.setAttribute('aria-selected', 'false');
            btn.setAttribute('tabindex', '-1');
            if (!btn.id) btn.id = panelId + '-tab';
            panel.setAttribute('aria-labelledby', btn.id);
            panel.hidden = true;
        });

        // Event listeners — tự hủy khi disconnected
        this.#btns.forEach(btn =>
            btn.addEventListener('click', () => this.#activate(btn), { signal: sig })
        );
        this.addEventListener('keydown', e => this.#onKey(e), { signal: sig });

        // Activate default tab
        const defaultId = this.dataset.default;
        const first = defaultId ?
            this.#btns.find(b => b.dataset.target === defaultId) :
            this.#btns[0];
        if (first) this.#activate(first);
    }

    disconnectedCallback() {
        this.#abort ?.abort();
        this.#abort = null;
    }

    activateTab(target) { 
        const btn = typeof target === 'number' ?
            this.#btns[target] :
            this.#btns.find(b => b.dataset.target === target);
        if (btn) this.#activate(btn);
    }

    get activeIndex() {
        return this.#btns.findIndex(b => b.getAttribute('aria-selected') === 'true');
    }

    get activePanel() { return this.#active; }

    // ── Private ─────────────────────────────────────────────

    #activate(btn) {
        const panelId = btn.dataset.target;
        const panel = this.querySelector('#' + panelId);
        if (!panel || panel === this.#active) return;

        this.#btns.forEach(b => {
            const on = b === btn;
            b.setAttribute('aria-selected', String(on));
            b.setAttribute('tabindex', on ? '0' : '-1');
        });
        this.#panels.forEach(p => { p.hidden = p !== panel; });
        this.#active = panel;

        this.dispatchEvent(new CustomEvent('tab-change', {
            bubbles: true,
            composed: true,
            detail: {
                tabId: panelId,
                index: this.activeIndex,
                sourceId: this.id || this.dataset.id || '',
            },
        }));
    }

    #onKey(e) {
        const idx = this.#btns.indexOf(document.activeElement);
        if (idx === -1) return;
        const len = this.#btns.length;
        const delta = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -1, ArrowDown: 1 };
        let next = -1;
        if (e.key in delta) next = (idx + delta[e.key] + len) % len;
        else if (e.key === 'Home') next = 0;
        else if (e.key === 'End') next = len - 1;
        else return;
        e.preventDefault();
        this.#btns[next].focus();
        this.#activate(this.#btns[next]);
    }
}

class SwiperComponent extends HTMLElement {
  #swiper   = null;
  #observer = null;  // MutationObserver để watch data-* attribute thay đổi

  connectedCallback() {
    if (typeof Swiper === 'undefined') {
      console.warn('[SwiperComponent] Swiper.js chưa được load.');
      return;
    }
    this.#init();
    this.#watchAttributes();
  }

  disconnectedCallback() {
    this.#observer?.disconnect();
    this.#observer = null;
    this.#destroy();
  }

  // ── Public API ──────────────────────────────────────────

  get swiper() { return this.#swiper; }

  next()        { this.#swiper?.slideNext(); }
  prev()        { this.#swiper?.slidePrev(); }
  goTo(index)   { this.#swiper?.slideTo(index); }

  // ── Private ─────────────────────────────────────────────

  #init() {
    const el = this.querySelector('.swiper');
    if (!el) {
      console.warn('[SwiperComponent] Không tìm thấy .swiper bên trong.');
      return;
    }

    const ds = this.dataset;

    this.#swiper = new Swiper(el, {
      speed:         1500,           // transition speed (cố định)
      loop:          this.#bool(ds.loop, true),
      slidesPerView: ds.items || 1,
      spaceBetween:  this.#int(ds.margin, 0),

      autoplay: this.#bool(ds.autoplay, false)
        ? { delay: this.#int(ds.speed, 3000), disableOnInteraction: false }
        : false,

      pagination: this.#buildPagination(),
      navigation: this.#buildNavigation(),

      breakpoints: {
        0:   { slidesPerView: ds.xs || ds.items || 1, spaceBetween: this.#int(ds.xsMargin || ds.margin, 0) },
        768: { slidesPerView: ds.sm || ds.items || 1, spaceBetween: this.#int(ds.smMargin || ds.margin, 0) },
        992: { slidesPerView: ds.md || ds.items || 1, spaceBetween: this.#int(ds.mdMargin || ds.margin, 0) },
      },
    });

    this.dispatchEvent(new CustomEvent('swiper-ready', {
      bubbles: true,
      composed: true,
      detail: { swiper: this.#swiper },
    }));
  }

  #destroy() {
    this.#swiper?.destroy(true, true);
    this.#swiper = null;
  }

  // MutationObserver để watch data-* attributes (observedAttributes không hỗ trợ data-*)
  #watchAttributes() {
    this.#observer = new MutationObserver(mutations => {
      const changed = mutations.some(m => m.type === 'attributes');
      if (!changed || !this.#swiper) return;
      this.#destroy();
      this.#init();
    });

    this.#observer.observe(this, {
      attributes: true,
      attributeFilter: [
        'data-items', 'data-xs', 'data-sm', 'data-md',
        'data-margin', 'data-xs-margin', 'data-sm-margin', 'data-md-margin',
        'data-loop', 'data-autoplay', 'data-speed',
        'data-dots', 'data-nav',
      ],
    });
  }

  #buildPagination() {
    if (!this.#bool(this.dataset.dots, false)) return false;
    const el = this.querySelector('.swiper-pagination');
    return el ? { el, clickable: true } : false;
  }

  #buildNavigation() {
    if (!this.#bool(this.dataset.nav, false)) return false;
    const next = this.querySelector('.swiper-button-next');
    const prev = this.querySelector('.swiper-button-prev');
    return next && prev ? { nextEl: next, prevEl: prev } : false;
  }

  // ── Helpers ─────────────────────────────────────────────

  #bool(val, fallback) {
    if (val === undefined || val === null) return fallback;
    return val !== 'false';
  }

  #int(val, fallback) {
    const n = parseInt(val);
    return isNaN(n) ? fallback : n;
  }
}

class ExpandDescriptionComponent extends HTMLElement {
  #abort   = null;
  #body    = null;
  #btn     = null;
  #label   = null;
  #maxH    = null;  // resolved trong connectedCallback từ static defaultMaxHeight
  #isOpen  = false;
 
  // ── Static defaults — override khi define ──────────────
  // Ưu tiên: data-max-height (HTML) > defaultMaxHeight > 220 (fallback)
  static defaultMaxHeight = 220;
  static moreTxt          = 'Xem thêm';
  static lessTxt          = 'Rút gọn';
 
  connectedCallback() {
    this.#abort = new AbortController();
    const sig   = this.#abort.signal;
 
    this.#body  = this.querySelector('.js-ed-body');
    this.#btn   = this.querySelector('.js-ed-btn');
    this.#label = this.querySelector('.js-ed-btn-text');
 
    // data-max-height trên HTML override defaultMaxHeight
    this.#maxH  = parseInt(this.dataset.maxHeight) || ExpandDescriptionComponent.defaultMaxHeight;
 
    if (!this.#body || !this.#btn || !this.#label) {
      console.warn('[ExpandDescriptionComponent] Thiếu .js-ed-body / .js-ed-btn / .js-ed-btn-text');
      return;
    }
 
    // Chờ ảnh/font load xong mới đo scrollHeight cho chính xác
    requestAnimationFrame(() => this.#setup(sig));
  }
 
  disconnectedCallback() {
    this.#abort?.abort();
    this.#abort = null;
  }
 
  // ── Public API ──────────────────────────────
 
  open()   { if (!this.#isOpen) this.#toggle(); }
  close()  { if (this.#isOpen)  this.#toggle(); }
  toggle() { this.#toggle(); }
 
  get isOpen() { return this.#isOpen; }
 
  // ── Private ─────────────────────────────────
 
  #setup(sig) {
    // Nội dung ngắn hơn maxHeight → ẩn button, không cần expand
    if (this.#body.scrollHeight <= this.#maxH) {
      this.#body.style.height = 'auto';
      this.#btn.hidden = true;
      return;
    }
 
    this.#body.style.height = this.#maxH + 'px';
    this.#label.textContent = ExpandDescriptionComponent.moreTxt;
 
    this.#btn.addEventListener('click', () => this.#toggle(), { signal: sig });
  }
 
  #toggle() {
    this.#isOpen = !this.#isOpen;
 
    this.#body.style.height = (this.#isOpen
      ? this.#body.scrollHeight
      : this.#maxH
    ) + 'px';
 
    this.classList.toggle('is-open', this.#isOpen);
    this.#label.textContent = this.#isOpen
      ? ExpandDescriptionComponent.lessTxt
      : ExpandDescriptionComponent.moreTxt;
 
    this.dispatchEvent(new CustomEvent('expand-change', {
      bubbles: true,
      composed: true,
      detail: { isOpen: this.#isOpen },
    }));
  }
}

class CountDownComponent extends HTMLElement {
  #timer   = null;
  #els     = {};
  #end     = 0;
 
  // pad "9" → "09"
  static #pad(n) { return String(Math.floor(n)).padStart(2, '0'); }
 
  connectedCallback() {
    const box = this.querySelector('.box-countdown');
    if (!box) {
      console.warn('[CountDownComponent] Thiếu .box-countdown bên trong.');
      return;
    }
 
    this.#end = new Date(box.dataset.time).getTime();
    if (isNaN(this.#end)) {
      console.warn('[CountDownComponent] data-time không hợp lệ:', box.dataset.time);
      return;
    }
 
    this.#els = {
      days:    box.querySelector('.days'),
      hours:   box.querySelector('.hours'),
      minutes: box.querySelector('.minutes'),
      seconds: box.querySelector('.seconds'),
    };
 
    this.#tick();                            // render ngay, không chờ 1s
    this.#timer = setInterval(() => this.#tick(), 1000);
  }
 
  disconnectedCallback() {
    this.#stop();
  }
 
  // ── Public API ──────────────────────────────
 
  stop()  { this.#stop(); }
  start() {
    if (this.#timer) return;   // đang chạy rồi
    this.#tick();
    this.#timer = setInterval(() => this.#tick(), 1000);
  }
 
  /** ms còn lại, -1 nếu đã hết */
  get remaining() {
    const d = this.#end - Date.now();
    return d > 0 ? d : -1;
  }
 
  get isExpired() { return this.remaining === -1; }
 
  // ── Private ─────────────────────────────────
 
  #tick() {
    const d = this.#end - Date.now();
 
    if (d < 0) {
      this.#setAll('00');
      this.#stop();
      this.classList.add('is-expired');
      this.dispatchEvent(new CustomEvent('countdown-expired', {
        bubbles: true, composed: true,
      }));
      return;
    }
 
    const pad = CountDownComponent.#pad;
    if (this.#els.days)    this.#els.days.textContent    = pad(d / 86400000);
    if (this.#els.hours)   this.#els.hours.textContent   = pad((d % 86400000) / 3600000);
    if (this.#els.minutes) this.#els.minutes.textContent = pad((d % 3600000)  / 60000);
    if (this.#els.seconds) this.#els.seconds.textContent = pad((d % 60000)    / 1000);
  }
 
  #stop() {
    clearInterval(this.#timer);
    this.#timer = null;
  }
 
  #setAll(val) {
    Object.values(this.#els).forEach(el => { if (el) el.textContent = val; });
  }
}

