window.TYT = window.TYT || {};

TYT.AddToCart = {
	_sel: {
		trigger: '[data-add-to-cart]',
		qtyInput: '[data-atc-quantity]',
		variantInput: '[data-atc-variant]',
		buyNow: '[data-buy-now]'
	},
	_text: {
		success: 'Đã thêm vào giỏ hàng',
		selectVariant: 'Vui lòng chọn phân loại sản phẩm',
		buyNowError: 'Không thể xử lý. Vui lòng thử lại.'
	},
	init: function() {
		var self = this;
		$('body').on('click.addtocart', this._sel.trigger + ', #addtocart', TYT.Helper.throttle(function(e) {
			self.onClick(e, false);
		}, 500));
		$('body').on('click.addtocart', this._sel.buyNow + ', #buynow', TYT.Helper.throttle(function(e) {
			self.onClick(e, true);
		}, 500));
	},
	getVariantId: function($btn) {
		var id = $btn.data('variant-id') || $btn.data('variantId');
		if (id) return id;
		var $form = $btn.closest('form');
		id = $form.find(this._sel.variantInput).val() || $form.find('#product-select').val();
		if (id) return id;
		id = $('#product-select').val();
		if (id) return id;
		if (window.ProductConfig && ProductConfig.data && ProductConfig.data.variants && ProductConfig.data.variants[0]) {
			return ProductConfig.data.variants[0].id;
		}
		return null;
	},
	getQuantity: function($btn) {
		var $scope = $btn.closest('form');
		if (!$scope.length) $scope = $btn.closest('.block-productDetail');
		var val = $scope.find(this._sel.qtyInput).val() || $scope.find('[name="quantity"]').val();
		var qty = parseInt(val, 10);
		return isNaN(qty) || qty < 1 ? 1 : qty;
	},
	onClick: function(e, isBuyNow) {
		e.preventDefault();
		var self = this;
		var $btn = $(e.currentTarget);
		var variantId = this.getVariantId($btn);
		if (!variantId) {
			if (TYT.Toast && TYT.Toast.error) TYT.Toast.error(this._text.selectVariant);
			return;
		}
		$btn.addClass('is-loading').prop('disabled', true);
		TYT.CartAPI.addItem(variantId, this.getQuantity($btn)).done(function(cart) {
			if (cart && cart.status === 422) {
				if (TYT.Toast && TYT.Toast.error) TYT.Toast.error(cart.description);
				return;
			}
			if (isBuyNow) {
				window.location.href = '/checkout';
				return;
			}
			if (TYT.Toast && TYT.Toast.success) TYT.Toast.success(self._text.success);
			if (TYT.MiniCart) {
				TYT.MiniCart.loadAndRender();
				TYT.MiniCart.openModal();
			}
		}).fail(function() {
			if (isBuyNow && TYT.Toast && TYT.Toast.error) TYT.Toast.error(self._text.buyNowError);
		}).always(function() {
			$btn.removeClass('is-loading').prop('disabled', false);
		});
	}
};

if (typeof tytCartInit === 'function') {
	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', tytCartInit);
	} else {
		tytCartInit();
	}
}
