// app.js
var auth = require('./utils/auth');
var IS_DEV = false;

function log(level, msg) { if (IS_DEV) console.log('[' + level + ']', msg); }
var ERR_LOG_RATELIMIT = {};
function reportError(message, ctx) {
  var key = new Date().toISOString().substring(0, 10); // YYYY-MM-DD
  ERR_LOG_RATELIMIT[key] = (ERR_LOG_RATELIMIT[key] || 0) + 1;
  if (ERR_LOG_RATELIMIT[key] > 5) return; // 每天最多 5 次

  if (!wx.cloud) return;
  wx.cloud.callFunction({
    name: 'logError',
    data: {
      message: message || '', stack: '',
      openid: (getApp().globalData.userInfo || {})._openid || '',
      context: ctx || '', time: new Date().toISOString()
    }
  }).catch(function () {});
}

App({
  onLaunch(options) {
    // 扫码进入：scene 在 query.scene；分享进入：id 在 query.id
    if (options && options.query) {
      if (options.query.id) {
        this.globalData._launchPostId = options.query.id;
      } else if (options.query.scene) {
        try {
          var d = decodeURIComponent(options.query.scene);
          var m = d.match(/id=([^&]+)/);
          if (m) this.globalData._launchPostId = m[1];
        } catch (e) {}
      }
    }

    var sysInfo = wx.getSystemInfoSync();
    this.globalData.statusBarHeight = sysInfo.statusBarHeight;
    this.globalData.windowHeight = sysInfo.windowHeight;

    if (wx.cloud) {
      wx.cloud.init({ env: 'cloud1-d7grg9j8u62bb417a', traceUser: true });
      log('app', 'wx.cloud 初始化成功');
    }

    // ---- 隐私协议处理 ----
    if (wx.onNeedPrivacyAuthorization) {
      wx.onNeedPrivacyAuthorization(function (resolve) {
        wx.showModal({
          title: '隐私保护指引',
          content: '在使用小程序前，请阅读并同意《隐私保护指引》。我们将依法保护您的个人信息安全。',
          confirmText: '同意',
          cancelText: '拒绝',
          success: function (r) {
            if (r.confirm) { resolve({ event: 'agree', buttonId: 'agree' }); }
            else { wx.showToast({ title: '需同意后方可使用', icon: 'none' }); }
          }
        });
      });
    }

    // ---- 全局错误捕获 ----
    wx.onError(function (err) { reportError(err, 'global error'); });
    wx.onUnhandledRejection(function (res) {
      reportError((res && res.reason) ? String(res.reason) : 'unhandled rejection', 'unhandledRejection');
    });

    // ---- 网络监听 ----
    var self = this;
    wx.onNetworkStatusChange(function (res) {
      self.globalData.isConnected = res.isConnected;
      if (!res.isConnected) wx.showToast({ title: '网络已断开', icon: 'none' });
    });

    auth.init(this.globalData);

    var cached = wx.getStorageSync('userInfo');
    if (cached) this.globalData.userInfo = cached;

    auth.loginAndGetUser().then(function (user) {
      self.globalData.userInfo = user;
      self.globalData.loginReady = true;
      self.updateUnreadBadge();
      var pages = getCurrentPages();
      if (pages.length > 0) {
        var cp = pages[pages.length - 1];
        if (cp.onLoginReady) cp.onLoginReady(user);
      }
    });
  },

  onShareAppMessage: function () { return { title: '找队友！一起玩', path: '/pages/index/index' }; },
  onShareTimeline: function () { return { title: '找队友！快来加入活动', query: '' }; },

  loginAndGetUser: function () { return auth.loginAndGetUser(); },
  getUserInfo: function () { return auth.getUserInfo(); },
  isLoggedIn: function () { return auth.isLoggedIn(); },
  refreshUserInfo: function () { return auth.refreshUserInfo(); },

  updateUnreadBadge: function () {
    var self = this;
    var u = self.globalData.userInfo;
    if (!u || !u._openid || !wx.cloud || !wx.cloud.database) return;
    wx.cloud.database().collection('notifications')
      .where({ receiver_openid: u._openid, is_read: false }).count()
      .then(function (r) {
        var c = r.total || 0;
        if (c > 0) wx.setTabBarBadge({ index: 1, text: c > 99 ? '99+' : String(c) }).catch(function () {});
        else wx.removeTabBarBadge({ index: 1 }).catch(function () {});
      }).catch(function () {});
  },

  globalData: {
    userInfo: null, loginReady: false,
    statusBarHeight: 20, windowHeight: 700,
    envId: 'cloud1-d7grg9j8u62bb417a',
    isConnected: true, _launchPostId: null, city: '全国'
  }
});
