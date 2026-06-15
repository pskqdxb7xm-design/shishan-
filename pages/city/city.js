var cityData = require('../../utils/city-data');
var locationUtil = require('../../utils/location');

Page({
  data: {
    statusBarHeight: 20, searchText: '', filtered: [],
    hotCities: cityData.HOT,
    groups: cityData.GROUPS,
    indexList: cityData.INDEXLIST,
    currentCity: '全国'
  },

  onLoad() {
    var app = getApp();
    this.setData({ statusBarHeight: app.globalData.statusBarHeight, currentCity: app.globalData.city || '全国' });
  },

  // 搜索
  onInputSearch(e) {
    var kw = e.detail.value.trim().toLowerCase();
    if (!kw) return this.setData({ searchText: '', filtered: [] });
    var result = cityData.ALL.filter(function(c) {
      return c.n.indexOf(kw) !== -1 || c.p.indexOf(kw) !== -1;
    }).slice(0, 30);
    this.setData({ searchText: kw, filtered: result });
  },

  // 选择城市
  onSelect(e) {
    var city = e.currentTarget.dataset.city;
    this.saveCity(city);
  },

  // 索引条点击
  onTapIndex(e) {
    var key = e.currentTarget.dataset.key;
    this.setData({ scrollToId: 'idx_' + key });
  },

  // 定位
  onTapLocate() {
    var self = this;
    wx.showLoading({ title: '定位中...' });
    locationUtil.initLocation().then(function(loc) {
      wx.hideLoading();
      self.saveCity(loc.city || '全国');
    }).catch(function() {
      wx.hideLoading();
      wx.showToast({ title: '定位失败', icon: 'none' });
    });
  },

  // 保存并返回
  saveCity(city) {
    // 存入最近访问
    var recent = wx.getStorageSync('recent_cities') || [];
    recent = recent.filter(function(c) { return c !== city; });
    recent.unshift(city);
    if (recent.length > 5) recent = recent.slice(0, 5);
    wx.setStorageSync('recent_cities', recent);

    // 更新全局状态
    var app = getApp();
    app.globalData.city = city;
    locationUtil.setCity(city);

    wx.navigateBack();
  },

  onTapBack() { wx.navigateBack(); }
});
