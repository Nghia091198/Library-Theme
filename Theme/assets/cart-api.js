window.TYT = window.TYT || {};
window.cartJS = window.cartJS || {};

function cartRoute(key) {
	return (TYT.routes && TYT.routes[key]) ? TYT.routes[key] : '';
}

function cartToastError(msg) {
	if (TYT.Toast && TYT.Toast.error) TYT.Toast.error(msg);
	else console.error(msg); 
} 

function cartParseError(xhr) {
	try {
		var json = JSON.parse(xhr.responseText);
		if (json && json.description) return json.description;
	} catch (e) {}
	return 'Không thể thực hiện thao tác. Vui lòng thử lại.';
}

function cartEncodeForm(params) {
	var parts = [];
	for (var key in params) {
		if (!params.hasOwnProperty(key)) continue;
		if (params[key] === undefined || params[key] === null) continue;
		parts.push(encodeURIComponent(key) + '=' + encodeURIComponent(String(params[key])));
	}
	return parts.join('&');
}

function cartSetData(cart) {
	window.cartJS = cart;
	$(document).trigger('tyt:cart:updated', [cart]);
}

TYT.CartAPI = {
	getCart: function() {
		return $.getJSON(cartRoute('cart')).done(function(cart) {
			cartSetData(cart);
		}).fail(function() {
			cartToastError('Không thể tải giỏ hàng');
		});
	},
	addItem: function(variantId, quantity, properties) {
		var dfd = $.Deferred();
		var data = { id: variantId, quantity: quantity || 1 };
		if (properties) {
			for (var p in properties) {
				if (properties.hasOwnProperty(p)) data['properties[' + p + ']'] = properties[p];
			}
		}
		$.ajax({
			type: 'POST',
			url: cartRoute('cartAdd'),
			data: cartEncodeForm(data),
			dataType: 'json'
		}).done(function() {
			TYT.CartAPI.getCart().done(function(cart) {
				dfd.resolve(cart);
			}).fail(function(xhr) {
				dfd.reject(xhr);
			});
		}).fail(function(xhr) {
			if (xhr && xhr.status === 422) {
				dfd.resolve({ status: 422, description: cartParseError(xhr) });
				return;
			}
			cartToastError('Không thể thêm sản phẩm vào giỏ hàng');
			dfd.reject(xhr);
		});
		return dfd.promise();
	},
	changeItem: function(line, quantity) {
		return $.ajax({
			type: 'POST',
			url: cartRoute('cartChange'),
			data: cartEncodeForm({ line: line, quantity: quantity }),
			dataType: 'json'
		}).done(cartSetData).fail(function() {
			cartToastError('Không thể cập nhật số lượng');
		});
	},
	changeVariant: function(line, variantId) {
		return $.ajax({
			type: 'POST',
			url: cartRoute('cartChange'),
			data: cartEncodeForm({ line: line, id: variantId }),
			dataType: 'json'
		}).done(cartSetData).fail(function() {
			cartToastError('Không thể cập nhật sản phẩm');
		});
	},
	updateCart: function(updatesArray) {
		return $.ajax({
			type: 'POST',
			url: cartRoute('cartUpdate'),
			data: 'updates[]=' + updatesArray.join('&updates[]='),
			dataType: 'json'
		}).done(cartSetData).fail(function() {
			cartToastError('Không thể cập nhật số lượng');
		});
	},
	clearCart: function() {
		return $.ajax({
			type: 'POST',
			url: cartRoute('cartClear'),
			dataType: 'json'
		}).done(cartSetData).fail(function() {
			cartToastError('Không thể xóa giỏ hàng');
		});
	}
};
