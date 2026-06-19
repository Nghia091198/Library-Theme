window.proInCartJS = window.proInCartJS || {};
window.cartJS = window.cartJS || {};
window.TYT = window.TYT || {};

TYT.MiniCart = {
	_sel: {
		modal: '#block-cart-modal',
		openTrigger: '.js-open-minicart',
		list: '.js-minicart-list',
		cartGroup: '.js-minicart-list .cart-group',
		cartCount: '.js-cart-count',
		total: '.js-minicart-total',
		priceTotal: '.price--total',
		cartEmpty: '.cartEmty', 
		qtyBtn: '#block-cart-modal .js-minicart-qty',
		removeBtn: '#block-cart-modal .js-minicart-remove',
		cartItem: '.minicart-item',
		variantSelect: '[name^="option_"]'
	},
	_cls: {
		cartEmpty: 'isCartEmpty',
		hidden: 'd-none',
		hasSale: 'hasSale',
		loading: 'is-loading',
		cartEmptyContainer: 'cartEmty',
		cartEmptyText: 'cartEmty--text',
		cartEmptyAction: 'cartEmty--action',
		minicartItem: 'minicart-item',
		minicartLeft: 'minicart-left',
		minicartRight: 'minicart-right',
		itemImg: 'item-img',
		itemInfo: 'item-info',
		itemDesc: 'item-desc',
		itemPrice: 'item-price',
		itemTotalPrice: 'item-total-price',
		itemMeta: 'item-meta',
		itemActions: 'item-actions',
		itemRemove: 'item-remove',
		listVariant: 'list-variant',
		variantOption: 'variant-option',
		percent: 'percent',
		blockQuantity: 'block-quantity',
		qtyBtn: 'qty-btn',
		qtyBtnJs: 'js-minicart-qty',
		quantityInput: 'quantity-input',
		button: 'button',
		iconSvg: 'icon-svg',
		icon: 'icon',
		iconMinus: 'icon--minus',
		iconPlus: 'icon--plus'
	},
	_text: {
		emptyCart: 'Chưa có sản phẩm nào trong giỏ hàng',
		continueShopping: 'Tiếp tục mua hàng',
		contact: 'Liên hệ',
		errorLoadCart: 'Không thể tải giỏ hàng. Vui lòng thử lại.',
		errorUpdateVariant: 'Không thể cập nhật sản phẩm',
		errorUpdateQuantity: 'Không thể cập nhật số lượng',
		errorRemoveItem: 'Không thể xóa sản phẩm',
		ariaQuantity: 'Quantity',
		ariaRemove: 'Remove item',
		ariaDecrease: 'Decrease quantity',
		ariaIncrease: 'Increase quantity'
	},
	_icons: {
		arrowRight: '#ic-arrow-right',
		times: '#ic-times',
		minus: '<path d="M10 0v2H0V0z"></path>',
		plus: '<path d="M6 4h4v2H6v4H4V6H0V4h4V0h2v4z"></path>'
	},
	_data: {
		line: 'data-line',
		variantId: 'data-variant-id',
		productId: 'data-pro-id',
		action: 'data-action',
		vid: 'data-vid',
		quantity: 'data-quantity',
		prd: 'data-prd'
	},
	_cfg: {
		paths: { product: '/products/', productJs: '.js', collectionsAll: '/collections/all', cartPage: '/cart' },
		timing: { updateDelay: 100 },
		limits: { minQuantity: 1 }
	},
	_images: {},
	cache: {},
	_skipListener: false,

	init: function() {
		var self = this;
		this._images = (TYT.images) ? TYT.images : {};
		this.cache = {
			$body: $('body'),
			$html: $('html'),
			$modal: $(this._sel.modal),
			$list: $(this._sel.list),
			$cartGroup: $(this._sel.cartGroup),
			$cartCount: $(this._sel.cartCount),
			$total: $(this._sel.total)
		};
		$(document).on('tyt:cart:updated', function(e, cart) {
			if (!cart || self._skipListener) return;
			self.cache.$cartCount.html(cart.item_count);
			if (self.isModalOpen() && cart.items && cart.items.length) {
				self.fetchProductDetails(cart);
			}
			if (self.isModalOpen() && (!cart.items || !cart.items.length)) {
				self.renderEmptyCart();
			}
		});
		if (TYT.Component && TYT.Component.Modal) {
			TYT.Component.Modal.onHidden(this._sel.modal, TYT.Component.Modal._cls.scrollBlock);
		}
		this.cache.$body.on('click.minicart', this._sel.openTrigger, function(e) {
			self.onOpenCart(e);
		});
		this.cache.$body.on('click.minicart', this._sel.qtyBtn, TYT.Helper.throttle(function(e) {
			self.onQtyClick(e.currentTarget);
		}, 300));
		this.cache.$body.on('change.minicart', this._sel.variantSelect, function(e) {
			self.onVariantChange(e);
		});
		this.cache.$body.on('click.minicart', this._sel.removeBtn, function(e) {
			self.onRemoveClick(e);
		});
	},

	isModalOpen: function() {
		return this.cache.$modal.hasClass('show') || this.cache.$modal.is(':visible');
	},

	openModal: function() {
		if (TYT.Component && TYT.Component.Modal) {
			TYT.Component.Modal.open(this._sel.modal, { scrollClass: TYT.Component.Modal._cls.scrollBlock });
		} else {
			this.cache.$body.add(this.cache.$html).addClass('newModal-open block-scroll');
			this.cache.$modal.modal('show');
		}
	},

	getMiniCart: function() {
		return this.loadAndRender();
	},

	onOpenCart: function(e) {
		e.preventDefault();
		if (window.location.href.indexOf(this._cfg.paths.cartPage) !== -1) {
			window.location.reload();
			return;
		}
		this.loadAndRender();
		this.openModal();
	},

	loadAndRender: function() {
		var self = this;
		this._skipListener = true;
		return TYT.CartAPI.getCart().done(function(cart) {
			if (!cart) return;
			if (!cart.items || !cart.items.length) {
				self.renderEmptyCart();
				return;
			}
			self.fetchProductDetails(cart);
		}).fail(function() {
			if (TYT.Toast && TYT.Toast.error) TYT.Toast.error(self._text.errorLoadCart);
		}).always(function() {
			self._skipListener = false;
		});
	},

	renderEmptyCart: function() {
		var C = this._cls;
		var T = this._text;
		this.cache.$cartCount.html(0);
		var html = '<div class="' + C.cartEmptyContainer + '"><div class="' + C.cartEmptyText + '">' + T.emptyCart + '</div><div class="' + C.cartEmptyAction + '"><a href="' + this._cfg.paths.collectionsAll + '" class="' + C.button + '">' + T.continueShopping + ' <svg class="' + C.iconSvg + '"><use xlink:href="' + this._icons.arrowRight + '"></use></svg></a></div></div>';
		this.cache.$cartGroup.parent().addClass(C.cartEmpty).html(html);
		this.cache.$total.addClass(C.hidden);
	},

	fetchProductDetails: function(cart) {
		var self = this;
		var items = cart.items;
		var i = 0;
		function next() {
			if (i >= items.length) {
				self.renderCart(cart);
				return;
			}
			var item = items[i];
			i += 1;
			$.getJSON(self._cfg.paths.product + item.handle + self._cfg.paths.productJs, function(product) {
				if (product && product.id) window.proInCartJS[product.id] = product;
			}).always(next);
		}
		next();
	},

	renderCart: function(cart) {
		var self = this;
		this.cache.$cartGroup.parent().removeClass(this._cls.cartEmpty).find(this._sel.cartEmpty).remove();
		this.cache.$cartGroup.empty();
		for (var idx = 0; idx < cart.items.length; idx++) {
			this.cache.$cartGroup.append(this.renderCartItem(cart.items[idx], idx));
		}
		this.cache.$cartCount.html(cart.item_count);
		this.updateTotalPrice(cart.total_price);
	},

	renderCartItem: function(item, line) {
		var C = this._cls;
		var D = this._data;
		var productData = window.proInCartJS[item.product_id];
		if (!productData) return '';
		var srcImage = item.image || this._images.noImage;
		return [
			'<div class="' + C.minicartItem + '" ' + D.line + '="' + (line + 1) + '" ' + D.variantId + '="' + item.variant_id + '" ' + D.productId + '="' + item.product_id + '">',
			'<div class="' + C.minicartLeft + '"><div class="' + C.itemImg + '"><a href="' + item.url + '"><img src="' + srcImage + '" alt="' + this.escapeHtml(item.title) + '" width="80" height="80" loading="lazy" decoding="async"></a></div></div>',
			'<div class="' + C.minicartRight + '">',
			'<div class="' + C.itemInfo + '"><div class="' + C.itemDesc + '"><h3><a href="' + item.url + '">' + this.escapeHtml(item.title) + '</a></h3></div>',
			this.renderPriceHtml(item, productData),
			'<div class="' + C.itemTotalPrice + ' ' + C.hidden + '"><span>' + this.formatMoney(item.line_price) + '</span></div></div>',
			'<div class="' + C.itemMeta + '"><div class="' + C.listVariant + '">' + this.renderVariantOptions(item, productData, line) + '</div>',
			this.renderQuantityControls(item),
			'</div>',
			'<div class="' + C.itemRemove + '"><a href="javascript:void(0);" ' + D.line + '="' + (line + 1) + '" class="' + C.itemRemove + ' js-minicart-remove" aria-label="' + this._text.ariaRemove + '"><svg class="' + C.iconSvg + '"><use xlink:href="' + this._icons.times + '"></use></svg></a></div>',
			'</div></div>'
		].join('');
	},

	renderPriceHtml: function(item, productData) {
		if (item.price <= 0) {
			return '<div class="' + this._cls.itemPrice + '"><span class="' + this._cls.hasSale + '">' + this._text.contact + '</span></div>';
		}
		var variant = this.getVariantById(productData, item.variant_id);
		var saleHtml = '';
		if (variant && variant.compare_at_price > variant.price) {
			var discount = Math.round((variant.compare_at_price - variant.price) / variant.compare_at_price * 100);
			saleHtml = '<del>' + this.formatMoney(variant.compare_at_price) + '</del><span class="' + this._cls.percent + '">-' + discount + '%</span>';
		}
		return '<div class="' + this._cls.itemPrice + '"><span class="' + this._cls.hasSale + '">' + this.formatMoney(item.price) + '</span>' + saleHtml + '</div>';
	},

	getVariantById: function(productData, variantId) {
		if (!productData.variants) return null;
		for (var i = 0; i < productData.variants.length; i++) {
			if (productData.variants[i].id === variantId) return productData.variants[i];
		}
		return null;
	},

	renderVariantOptions: function(item, productData, line) {
		if (!productData.options || !productData.options.length) return '';
		var self = this;
		var D = this._data;
		var C = this._cls;
		var out = [];
		for (var i = 0; i < productData.options.length; i++) {
			var optionKey = 'option' + (i + 1);
			var values = [];
			var seen = {};
			for (var v = 0; v < productData.variants.length; v++) {
				var val = productData.variants[v][optionKey] || (productData.variants[v].options && productData.variants[v].options[i]);
				if (val != null && !seen[val]) {
					seen[val] = true;
					values.push(val);
				}
			}
			var currentVal = (item.variant_options && item.variant_options[i]) || '';
			var optionsHtml = '';
			for (var j = 0; j < values.length; j++) {
				var val = values[j];
				optionsHtml += '<option value="' + self.escapeHtml(String(val)) + '"' + (currentVal === val ? ' selected' : '') + '>' + self.escapeHtml(String(val)) + '</option>';
			}
			out.push('<div class="' + C.variantOption + '"><select name="option_' + (i + 1) + '_' + item.variant_id + '" ' + D.prd + '="' + item.product_id + '" ' + D.line + '="' + (line + 1) + '">' + optionsHtml + '</select></div>');
		}
		return out.join('');
	},

	renderQuantityControls: function(item) {
		var C = this._cls;
		var D = this._data;
		var q = this._cfg.limits.minQuantity;
		var T = this._text;
		return [
			'<div class="' + C.itemActions + '"><div class="' + C.blockQuantity + '">',
			'<button type="button" class="' + C.qtyBtn + ' ' + C.qtyBtnJs + '" ' + D.action + '="minus" aria-label="' + T.ariaDecrease + '"><svg focusable="false" class="' + C.icon + ' ' + C.iconMinus + '" viewBox="0 0 10 2" role="presentation">' + this._icons.minus + '</svg></button>',
			'<input ' + D.vid + '="' + item.variant_id + '" type="number" name="updates[]" id="update_' + item.variant_id + '" ' + D.quantity + '="' + item.quantity + '" value="' + item.quantity + '" min="' + q + '" class="' + C.quantityInput + '" aria-label="' + T.ariaQuantity + '">',
			'<button type="button" class="' + C.qtyBtn + ' ' + C.qtyBtnJs + '" ' + D.action + '="plus" aria-label="' + T.ariaIncrease + '"><svg focusable="false" class="' + C.icon + ' ' + C.iconPlus + '" viewBox="0 0 10 10" role="presentation">' + this._icons.plus + '</svg></button>',
			'</div></div>'
		].join('');
	},

	patchLineItem: function(line, cart) {
		var item = cart.items[line - 1];
		if (!item) return;
		var D = this._data;
		var $item = this.cache.$cartGroup.find('[' + D.line + '="' + line + '"]');
		$item.find('.' + this._cls.quantityInput).val(item.quantity).attr(D.quantity, item.quantity);
		$item.find('.' + this._cls.itemTotalPrice + ' span').html(this.formatMoney(item.line_price));
	},

	setLoading: function($el, on) {
		if (on) $el.addClass(this._cls.loading).prop('disabled', true);
		else $el.removeClass(this._cls.loading).prop('disabled', false);
	},

	onQtyClick: function(btn) {
		var $button = $(btn);
		var $input = $button.siblings('input');
		var action = $button.attr(this._data.action);
		var quantity = parseInt($input.val(), 10) || this._cfg.limits.minQuantity;
		if (action === 'minus') quantity = Math.max(this._cfg.limits.minQuantity, quantity - 1);
		else if (action === 'plus') quantity += 1;
		$input.val(quantity);
		var line = parseInt($button.closest(this._sel.cartItem).attr(this._data.line), 10);
		this.changeQuantity(line, quantity, $button);
	},

	changeQuantity: function(line, quantity, $btn) {
		var self = this;
		var $item = this.cache.$cartGroup.find('[' + this._data.line + '="' + line + '"]');
		var $loading = $item.find(this._sel.qtyBtn);
		if ($btn) $loading = $loading.add($btn);
		this.setLoading($loading, true);
		TYT.CartAPI.changeItem(line, quantity).done(function(cart) {
			self.patchLineItem(line, cart);
			self.updateTotalPrice(cart.total_price);
			self.cache.$cartCount.html(cart.item_count);
		}).fail(function() {
			if (TYT.Toast && TYT.Toast.error) TYT.Toast.error(self._text.errorUpdateQuantity);
			self.loadAndRender();
		}).always(function() {
			self.setLoading($loading, false);
		});
	},

	onVariantChange: function(e) {
		var $select = $(e.currentTarget);
		var productId = $select.attr(this._data.prd);
		var line = $select.attr(this._data.line);
		var $item = $select.closest(this._sel.cartItem);
		var options = [];
		$item.find(this._sel.variantSelect).each(function() {
			options.push($(this).val());
		});
		var product = window.proInCartJS[productId];
		if (!product || !product.variants) return;
		var variant = this.findVariantByOptions(product, options);
		if (!variant) return;
		var self = this;
		var $controls = $item.find(this._sel.qtyBtn).add($item.find(this._sel.removeBtn));
		this.setLoading($controls, true);
		TYT.CartAPI.changeVariant(line, variant.id).done(function() {
			self.loadAndRender();
		}).fail(function() {
			if (TYT.Toast && TYT.Toast.error) TYT.Toast.error(self._text.errorUpdateVariant);
		}).always(function() {
			self.setLoading($controls, false);
		});
	},

	findVariantByOptions: function(product, selectedOptions) {
		for (var i = 0; i < product.variants.length; i++) {
			var v = product.variants[i];
			var opts = v.options;
			if (!opts) {
				opts = [];
				if (v.option1) opts.push(v.option1);
				if (v.option2) opts.push(v.option2);
				if (v.option3) opts.push(v.option3);
			}
			var ok = opts.length === selectedOptions.length;
			for (var j = 0; ok && j < selectedOptions.length; j++) {
				if (opts[j] !== selectedOptions[j]) ok = false;
			}
			if (ok) return v;
		}
		return null;
	},

	onRemoveClick: function(e) {
		e.preventDefault();
		var line = $(e.currentTarget).attr(this._data.line);
		var self = this;
		var $btn = $(e.currentTarget);
		this.setLoading($btn, true);
		TYT.CartAPI.changeItem(line, 0).done(function() {
			setTimeout(function() {
				self.loadAndRender();
			}, self._cfg.timing.updateDelay);
		}).fail(function() {
			if (TYT.Toast && TYT.Toast.error) TYT.Toast.error(self._text.errorRemoveItem);
		}).always(function() {
			self.setLoading($btn, false);
		});
	},

	updateTotalPrice: function(totalPrice) {
		this.cache.$total.find(this._sel.priceTotal).html(this.formatMoney(totalPrice));
		this.cache.$total.removeClass(this._cls.hidden);
	},

	formatMoney: function(amount) {
		if (typeof ShopMoney === 'function') return ShopMoney(amount);
		return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
	},

	escapeHtml: function(text) {
		var map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
		return String(text).replace(/[&<>"']/g, function(m) {
			return map[m];
		});
	}
};

function tytCartInit() {
	if (!TYT.CartAPI) return;
	if (!TYT.MiniCart._ready) {
		TYT.MiniCart._ready = true;
		TYT.MiniCart.init();
	}
	if (TYT.AddToCart && !TYT.AddToCart._ready) {
		TYT.AddToCart._ready = true;
		TYT.AddToCart.init();
	}
}
