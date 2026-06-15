// pages/index/index.js
var interact = require('../../utils/interact');
var PAGE_SIZE = 10;
var _blockList = [];

function loadBlockList() {
  return wx.cloud.callFunction({ name: 'block', data: { action: 'get' } })
    .then(function (r) { _blockList = (r.result && r.result.block_list) || []; })
    .catch(function () { _blockList = []; });
}

function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

Page({
  data: {
    statusBarHeight: 20,
    keyword: '',
    city: '深圳',
    district: '',
    activePrimary: '热门',
    activeCategory: '全部',
    primaryTabs: ['热门', '最近活动', '仅限男生', '仅限女生', '同城'],
    categories: ['全部','⚽足球','🏀篮球','🏸羽毛球','🏓乒乓球','🎾网球','🏐排球','🏊游泳','🏃跑步','🚴骑行','🏕️徒步','🧗攀岩','⛷️滑雪','🏄冲浪','🎿滑板','🥊拳击','🎭剧本杀','🎮桌游','🎤KTV','🍜美食','🧘瑜伽','🎣钓鱼','♟️棋牌','🎯飞镖','🐾宠物'],
    activities: [], isEmpty: false,
    loading: true, loadingMore: false, hasMore: true,
    skip: 0, currentPage: 0
  },

  onLoad: function () {
    var app = getApp();
    this.setData({
      statusBarHeight: app.globalData.statusBarHeight,
      city: app.globalData.city || '全国'
    });
    if (app.globalData._launchPostId) {
      var pid = app.globalData._launchPostId;
      app.globalData._launchPostId = null;
      wx.navigateTo({ url: '/pages/detail/detail?id=' + pid });
    }
    loadBlockList().then(function () {
      this.fetchFavoriteIds();
      this.fetchPosts(0);
    }.bind(this));
  },

  onShow: function () {
    var city = getApp().globalData.city || '全国';
    if (city !== this.data.city) {
      this.setData({ city: city });
      if (this.data.activePrimary === '同城') this.fetchPosts(0);
    }
    if (this._needRefresh) {
      this._needRefresh = false;
      loadBlockList().then(function () {
        this.fetchFavoriteIds();
        this.fetchPosts(0);
      }.bind(this));
    }
  },

  onPullDownRefresh: function () { this.fetchPosts(0); },
  onReachBottom: function () {
    if (this.data.loadingMore || !this.data.hasMore) return;
    this.fetchPosts(this.data.currentPage + 1);
  },

  onInputSearch: function (e) { this.setData({ keyword: e.detail.value }); },
  onSearchConfirm: function () { this.fetchPosts(0); },
  onClearSearch: function () { this.setData({ keyword: '' }); this.fetchPosts(0); },
  onTapPrimary: function (e) { this.setData({ activePrimary: e.currentTarget.dataset.tab }); this.fetchPosts(0); },
  onTapCategory: function (e) { this.setData({ activeCategory: e.currentTarget.dataset.cat }); this.fetchPosts(0); },
  onTapLocation: function () { wx.navigateTo({ url: '/pages/city/city' }); },

  fetchFavoriteIds: function () {
    var self = this;
    interact.getUserActionIds('favorite').then(function (ids) { self._favoriteIds = ids; self.mergeFavoriteToData(); });
  },
  mergeFavoriteToData: function () {
    if (!this._favoriteIds) return;
    var ids = this._favoriteIds;
    this.setData({ activities: this.data.activities.map(function (item) {
      return Object.assign({}, item, { favorited: ids.indexOf(item._id) !== -1 });
    })});
  },

  fetchPosts: function (page) {
    var self = this;
    var skip = page * PAGE_SIZE;
    var isFirstPage = page === 0;

    if (isFirstPage) { self.setData({ refreshing: true, currentPage: 0, skip: 0, loading: true }); }
    else { self.setData({ loadingMore: true }); }

    if (!wx.cloud || !wx.cloud.database) { self.loadMock(isFirstPage); return; }

    var db = wx.cloud.database();
    var myOpenid = (getApp().globalData.userInfo || {})._openid || '';
    var conds = [];
    conds.push({ status: db.command.in(['recruiting', 'full']) });
    if (myOpenid) {
      conds.push(db.command.or([{ audit_status: 'pass' }, { _openid: myOpenid }]));
    } else {
      conds.push({ audit_status: 'pass' });
    }
    if (self.data.activeCategory !== '全部') {
      conds.push({ category: self.data.activeCategory });
    }
    var orderField = 'createdAt', orderDir = 'desc';
    if (self.data.activePrimary === '热门') { orderField = 'stats.likeCount'; }
      if (self.data.activePrimary === '仅限女生') { conds.push({ gender: '仅限女生' }); }
      if (self.data.activePrimary === '仅限男生') { conds.push({ gender: '仅限男生' }); }
    if (self.data.activePrimary === '同城') {
      var city = (getApp().globalData.city || '深圳');
      if (city && city !== '全国') conds.push({ city: db.RegExp({ regexp: city, options: 'i' }) });
    }
    if (self.data.keyword.trim()) {
      var kw = self.data.keyword.trim();
      conds.push(db.command.or([
        { title: db.RegExp({ regexp: escapeRegExp(kw), options: 'i' }) },
        { content: db.RegExp({ regexp: escapeRegExp(kw), options: 'i' }) }
      ]));
    }
    if (_blockList.length > 0) {
      conds.push(db.command.or([{ _openid: db.command.nin(_blockList) }, { _openid: myOpenid || '_never_' }]));
    }

    db.collection('posts').where(db.command.and(conds)).orderBy(orderField, orderDir).skip(skip).limit(PAGE_SIZE).get()
      .then(function (postRes) {
        var posts = postRes.data;
        if (posts.length < PAGE_SIZE) self.setData({ hasMore: false });
        if (posts.length === 0 && isFirstPage) { self.applyPosts([], [], true); return; }
        var openids = [];
        posts.forEach(function (p) { if (p._openid && openids.indexOf(p._openid) === -1) openids.push(p._openid); });
        if (openids.length === 0) { self.applyPosts(posts, [], isFirstPage); return; }
        db.collection('users').where({ _openid: db.command.in(openids) }).field({ _openid: true, nickname: true, avatar: true, mbti: true }).get()
          .then(function (ur) { self.applyPosts(posts, ur.data, isFirstPage); })
          .catch(function () { self.applyPosts(posts, [], isFirstPage); });
      }).catch(function (err) {
        console.error('[index] 查询失败:', err);
        if (isFirstPage) self.loadMock(isFirstPage);
        else self.setData({ loadingMore: false });
      });
  },

  applyPosts: function (posts, users, isFirstPage) {
    var self = this;
    var userMap = {};
    users.forEach(function (u) { userMap[u._openid] = u; });
    var items = posts.map(function (p) {
      var a = userMap[p._openid] || {};
      return {
        id: p._id, _id: p._id, category: p.category || '活动',
        images: (p.coverImages && p.coverImages.length > 0) ? p.coverImages : ['https://images.unsplash.com/photo-1501554728187-ce583db33af7?w=400&q=80'],
        title: p.title || '', time: p.activityTime || '', location: p.location || '',
        authorName: a.nickname || '匿名', authorAvatar: a.avatar || '', authorMbti: a.mbti || '',
        currentCount: p.currentCount || 1, targetCount: p.targetCount || 0,
        audit_status: p.audit_status || 'pass',
        likeCount: (p.stats && p.stats.likeCount) || 0, commentCount: (p.stats && p.stats.commentCount) || 0
      };
    });
    if (isFirstPage) {
      self.setData({ activities: items, isEmpty: items.length === 0, skip: items.length, currentPage: 0, refreshing: false, loading: false, hasMore: items.length >= PAGE_SIZE });
      wx.stopPullDownRefresh();
    } else {
      self.setData({ activities: self.data.activities.concat(items), skip: self.data.skip + items.length, currentPage: self.data.currentPage + 1, loadingMore: false });
    }
    self.mergeFavoriteToData();
  },

  loadMock: function (isFirstPage) {
    var self = this;
    var m = [{ id:'m1',_id:'m1',category:'🏸羽毛球',images:['https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?w=800&q=80'],title:'周末羽毛球局',time:'周六14:00',location:'朝阳公园',authorName:'小王',audit_status:'pass',likeCount:12,commentCount:3}];
    setTimeout(function () {
      if (isFirstPage) { self.setData({ activities:m,refreshing:false,loading:false }); wx.stopPullDownRefresh(); }
      else { self.setData({ activities:m,loading:false,hasMore:false }); }
    },300);
  },

  onToggleFavorite: function (e) {
    var self = this; var id = e.currentTarget.dataset.id; var idx = e.currentTarget.dataset.index;
    interact.toggleAction('favorite', id, function (active) {
      var acts = self.data.activities.slice();
      if (acts[idx]) { acts[idx] = Object.assign({}, acts[idx], { favorited: active }); self.setData({ activities: acts }); }
    });
  },
  onTapCreate: function () { this._needRefresh = true; wx.navigateTo({ url: '/pages/create/create' }); },
  onTapPost: function (e) { var id = e.currentTarget.dataset.id; if (id) wx.navigateTo({ url: '/pages/detail/detail?id=' + id }); }
});
