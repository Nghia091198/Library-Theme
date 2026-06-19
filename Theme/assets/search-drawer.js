window.TYT = window.TYT || {};
TYT.SearchDrawer = {
	_sel: {
		modal: '#block-search-modal',
		openTrigger: '.js-open-search',
		input: '.js-search-input',
		resultsWrap: '.js-search-results',
		tabs: '.js-search-tabs',
		tab: '.js-search-tab',
		resultHtml: '.js-search-result-html',
		searchGroup: '.smartsearch-group',
		resultContainer: '.smartsearch-result-content'
	},
	_cls: {
		active: 'active',
		hidden: 'hidden',
		seemore: 'has-seemore'
	},
	_data: {
		productCount: 0,
		articleCount: 0
	},
	_timer: null,
	init: function() {
		this.createResultContainer();
		this.bindOpen();
		this.bindUI();
		this.bindTabEvents();
	},
	createResultContainer: function() {
		var $wrap = $(this._sel.resultsWrap);
		if (!$wrap.find(this._sel.resultContainer).length) {
			$wrap.append('<div class="smartsearch-result-container hidden-scrollbar"><div class="smartsearch-result-content js-search-result-html"></div></div>');
		}
	},
	bindOpen: function() {
		if (!window.TYT || !TYT.Component || !TYT.Component.Modal) return;
		var Modal = TYT.Component.Modal;
		Modal.bindOpen(this._sel.openTrigger, this._sel.modal, { scrollClass: Modal._cls.scrollBody });
	},
	hideResults: function() {
		$(this._sel.resultsWrap).hide();
	},
	showResults: function() {
		$(this._sel.resultsWrap).show();
	},
	buildFilterQuery: function(keyword, prefix) {
		var fields = window.SearchConfig.fields || [];
		var filters = [];
		$.each(fields, function(i, field) {
			filters.push('(' + field + ':' + prefix + '**' + keyword + ')');
		});
		return 'q=filter=(' + filters.join('||') + ')';
	},
	bindUI: function() {
		var self = this;
		var $input = $(this._sel.modal).find(this._sel.input);
		$input.on('keyup change paste', function() {
			var keyword = $(this).val().trim();
			clearTimeout(self._timer);
			if (!keyword.length) {
				$(self._sel.resultHtml).html('');
				$(self._sel.tabs).html('');
				self._data.productCount = 0;
				self._data.articleCount = 0;
				self.hideResults();
				return;
			}
			self._timer = setTimeout(function() {
				self.search(keyword);
			}, 300);
		});
	},
	bindTabEvents: function() {
		var self = this;
		$(document).on('click', this._sel.tab, function(e) {
			e.preventDefault();
			var $tab = $(this);
			if ($tab.hasClass(self._cls.active)) return;
			$(self._sel.tab).removeClass(self._cls.active);
			$tab.addClass(self._cls.active);
			self.filterResults($tab.data('type'));
		});
	},
	filterResults: function(type) {
		var self = this;
		var $groups = $(self._sel.searchGroup);
		$groups.removeClass(self._cls.active).hide();
		if (type === 'product') {
			if ($('.smartsearch-group.search-product').length) {
				var more = $('.smartsearch-group.search-product').find('.resultsMore').html();
				$(self._sel.resultsWrap).find('.resultsMore').html(more);
			}
			$('.search-product').addClass(self._cls.active).fadeIn(200);
		} else if (type === 'article') {
			if ($('.smartsearch-group.search-article').length) {
				var moreA = $('.smartsearch-group.search-article').find('.resultsMore').html();
				$(self._sel.resultsWrap).find('.resultsMore').html(moreA);
			}
			$('.search-article').addClass(self._cls.active).fadeIn(200);
		}
		$(self._sel.tab).attr('aria-selected', 'false');
		$(self._sel.tab + '[data-type="' + type + '"]').attr('aria-selected', 'true');
	},
	search: function(keyword) {
		var type = window.SearchConfig.type;
		if (type === 'product_only') this.searchProduct(keyword);
		else if (type === 'article_only') this.searchArticle(keyword);
		else this.searchMultiple(keyword);
	},
	fetchProduct: function(keyword) {
		var filterQuery = this.buildFilterQuery(keyword, 'product');
		var url = '/search?' + filterQuery + '&type=product&view=' + window.SearchConfig.product.view;
		return $.ajax({ url: url, type: 'GET', async: true, dataType: 'html' });
	},
	fetchArticle: function(keyword) {
		var filterQuery = this.buildFilterQuery(keyword, 'article');
		var url = '/search?' + filterQuery + '&type=article&view=' + window.SearchConfig.article.view;
		return $.ajax({ url: url, type: 'GET', async: true, dataType: 'json' });
	},
	searchProduct: function(keyword) {
		var self = this;
		this.fetchProduct(keyword).done(function(html) {
			var $temp = $('<div>').html(html);
			var itemCount = $temp.find('.item-ult').length;
			self._data.productCount = itemCount;
			self._data.articleCount = 0;
			if (itemCount > 0) {
				$(self._sel.resultHtml).html(self.renderProduct(html, itemCount));
				self.renderTabs('product_only');
				self.showResults();
			} else {
				$(self._sel.resultHtml).html('<p class="dataEmpty">' + window.SearchConfig.not_found + '</p>');
				$(self._sel.tabs).html('');
				self.showResults();
			}
		});
	},
	searchArticle: function(keyword) {
		var self = this;
		this.fetchArticle(keyword).done(function(data) {
			var articles = data.slice(0, -1);
			var totalSearch = data[data.length - 1].total_search || 0;
			self._data.articleCount = parseInt(totalSearch, 10);
			self._data.productCount = 0;
			if (totalSearch > 0) {
				$(self._sel.resultHtml).html(self.renderArticle(articles, totalSearch));
				self.renderTabs('article_only');
				self.showResults();
			} else {
				$(self._sel.resultHtml).html('<p class="dataEmpty">' + window.SearchConfig.not_found + '</p>');
				$(self._sel.tabs).html('');
				self.showResults();
			}
		});
	},
	searchMultiple: function(keyword) {
		var self = this;
		$.when(this.fetchProduct(keyword), this.fetchArticle(keyword)).done(function(productRes, articleRes) {
			var $productTemp = $('<div>').html(productRes[0]);
			var productCount = $productTemp.find('.item-ult').length;
			self._data.productCount = productCount;
			var articles = articleRes[0].slice(0, -1);
			var totalArticles = articleRes[0][articleRes[0].length - 1].total_search || 0;
			self._data.articleCount = parseInt(totalArticles, 10);
			if (productCount > 0 || totalArticles > 0) {
				var html = self.renderProduct(productRes[0], productCount) + self.renderArticle(articles, totalArticles);
				$(self._sel.resultHtml).html(html);
				self.renderTabs('multiple');
				self.showResults();
			} else {
				$(self._sel.resultHtml).html('<p class="dataEmpty">' + window.SearchConfig.not_found + '</p>');
				$(self._sel.tabs).html('');
				self.showResults();
			}
		});
	},
	renderProduct: function(html, count) {
		if (!html || count === 0) return '';
		return '<div class="smartsearch-group search-product"><div class="smartsearch-product-list">' + html + '</div></div>';
	},
	renderArticle: function(articles, totalCount) {
		var self = this;
		var limit = window.SearchConfig.limit;
		if (!articles || !articles.length || totalCount === 0) return '';
		var html = '<div class="smartsearch-group search-article"><div class="smartsearch-article-list">';
		$.each(articles, function(i, item) {
			if (item.title) {
				html += '<div class="smartsearch-item-article"><div class="smartsearch-article--thumb"><a href="' + item.url + '" class="article--thumb__image" title="' + item.title + '"><img loading="lazy" decoding="async" src="' + item.thumbnail + '" alt="' + item.title + '" width="90" height="90"></a></div><div class="smartsearch-article--details"><a href="' + item.url + '" class="article--thumb__title" title="' + item.title + '">' + item.title + '</a><a href="' + item.blog_url + '" class="article--thumb__blog" title="' + item.blog + '">' + item.blog + '</a></div></div>';
			}
		});
		if (totalCount > limit) {
			var keyword = $(self._sel.modal).find(self._sel.input).val();
			var moreCount = totalCount - limit;
			$(self._sel.resultsWrap).addClass(self._cls.seemore);
			html += '<div class="resultsMore"><a href="/search?type=article&q=' + encodeURIComponent(keyword) + '">' + window.SearchConfig.txtViewmore + ' ' + moreCount + ' ' + window.SearchConfig.article.title.toLowerCase() + ' </a></div>';
		}
		html += '</div></div>';
		$(self._sel.resultsWrap).find('.resultsMore').remove();
		$(self._sel.resultsWrap).append("<div class='resultsMore'></div>");
		return html;
	},
	renderTabs: function(type) {
		var self = this;
		var $tabContainer = $(self._sel.tabs);
		var currentActiveType = $(self._sel.tab + '.active').data('type');
		var html = '';
		var defaultActiveType;
		$tabContainer.html('');
		if (self._data.productCount === 0 && self._data.articleCount === 0) return;
		if (type === 'product_only' && self._data.productCount > 0) {
			html = '<li class="smartsearch-tab--title js-search-tab active" data-type="product" aria-selected="true"><span class="smartsearch-tab--title__text">' + window.SearchConfig.product.title + '</span><span class="smartsearch-tab--title__count js-search-tab-count">' + self._data.productCount + '</span></li>';
			defaultActiveType = 'product';
		} else if (type === 'article_only' && self._data.articleCount > 0) {
			html = '<li class="smartsearch-tab--title js-search-tab active" data-type="article" aria-selected="true"><span class="smartsearch-tab--title__text">' + window.SearchConfig.article.title + '</span><span class="smartsearch-tab--title__count js-search-tab-count">' + self._data.articleCount + '</span></li>';
			defaultActiveType = 'article';
		} else {
			var productActive = '';
			var articleActive = '';
			if (currentActiveType) {
				productActive = currentActiveType === 'product' ? 'active' : '';
				articleActive = currentActiveType === 'article' ? 'active' : '';
				defaultActiveType = currentActiveType;
			} else {
				productActive = self._data.productCount > 0 ? 'active' : '';
				articleActive = self._data.productCount === 0 && self._data.articleCount > 0 ? 'active' : '';
				defaultActiveType = self._data.productCount > 0 ? 'product' : 'article';
			}
			if (self._data.productCount > 0) {
				html += '<li class="smartsearch-tab--title js-search-tab ' + productActive + '" data-type="product" aria-selected="' + (productActive ? 'true' : 'false') + '"><span class="smartsearch-tab--title__text">' + window.SearchConfig.product.title + '</span><span class="smartsearch-tab--title__count js-search-tab-count">' + self._data.productCount + '</span></li>';
			}
			if (self._data.articleCount > 0) {
				html += '<li class="smartsearch-tab--title js-search-tab ' + articleActive + '" data-type="article" aria-selected="' + (articleActive ? 'true' : 'false') + '"><span class="smartsearch-tab--title__text">' + window.SearchConfig.article.title + '</span><span class="smartsearch-tab--title__count js-search-tab-count">' + self._data.articleCount + '</span></li>';
			}
		}
		$tabContainer.html(html);
		if (defaultActiveType) self.filterResults(defaultActiveType);
	}
};
document.addEventListener('DOMContentLoaded', function() {
	TYT.SearchDrawer.init();
});
