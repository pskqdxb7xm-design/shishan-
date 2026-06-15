// utils/auth.js
// 微信静默登录模块 —— 完整版
// 不直接调用 getApp()，由 app.js 传入 globalData 引用

var _globalData = null;

/**
 * 初始化（app.js onLaunch 中调用一次）
 */
function init(globalData) {
  _globalData = globalData;
}

/**
 * 创建游客用户（登录失败时的回退）
 */
function createGuestUser() {
  return {
    _id: null,
    nickname: '点击登录',
    avatar: '',
    bio: '登录后查看更多内容',
    tags: [],
    level: 1,
    coins: 0,
    stats: { followingCount: 0, followerCount: 0, likeReceived: 0 },
    isGuest: true,
    isNewUser: false
  };
}

/**
 * 执行云函数登录请求
 */
function doLogin(resolve) {
  wx.cloud
    .callFunction({ name: 'login', data: {} })
    .then(function (res) {
      if (res.result && res.result.success) {
        var user = res.result.user;
        user.isNewUser = res.result.isNewUser || false;
        _globalData.userInfo = user;
        _globalData.loginReady = true;
        wx.setStorageSync('userInfo', user);

        console.log(
          '[auth] 登录成功, openid:',
          user._openid ? user._openid.substring(0, 10) + '...' : 'unknown',
          user.isNewUser ? '(新用户)' : ''
        );
        resolve(user);
      } else {
        console.error('[auth] 云函数返回失败:', res.result);
        var guest = createGuestUser();
        _globalData.userInfo = guest;
        wx.showToast({ title: '登录失败，使用游客模式', icon: 'none' });
        resolve(guest);
      }
    })
    .catch(function (err) {
      console.error('[auth] 云函数调用异常:', err);
      var guest = createGuestUser();
      _globalData.userInfo = guest;
      wx.showToast({ title: '网络异常，使用游客模式', icon: 'none' });
      resolve(guest);
    });
}

/**
 * loginAndGetUser —— 主要的登录入口
 * 流程：云函数获取 openid → 查 users 集合 → 存在则返回，不存在则自动注册
 * 页面中通过 app.loginAndGetUser() 或 auth.loginAndGetUser() 调用
 */
function loginAndGetUser() {
  return new Promise(function (resolve) {
    // 已登录：直接返回缓存
    if (_globalData.userInfo && _globalData.userInfo._id && !_globalData.userInfo.isGuest) {
      resolve(_globalData.userInfo);
      return;
    }

    // 检查网络
    wx.getNetworkType({
      success: function (netRes) {
        if (netRes.networkType === 'none') {
          console.warn('[auth] 无网络，使用游客模式');
          var guest = createGuestUser();
          _globalData.userInfo = guest;
          resolve(guest);
          return;
        }
        doLogin(resolve);
      },
      fail: function () {
        doLogin(resolve);
      }
    });
  });
}

/**
 * 静默登录（loginAndGetUser 别名，兼容旧调用）
 */
function silentLogin() {
  return loginAndGetUser();
}

/**
 * 获取当前用户信息（等待登录完成）
 */
function getUserInfo() {
  return new Promise(function (resolve) {
    if (_globalData.userInfo && _globalData.userInfo._id && !_globalData.userInfo.isGuest) {
      resolve(_globalData.userInfo);
    } else {
      loginAndGetUser().then(resolve);
    }
  });
}

/**
 * 是否已登录
 */
function isLoggedIn() {
  return !!(
    _globalData.userInfo &&
    _globalData.userInfo._id &&
    !_globalData.userInfo.isGuest
  );
}

/**
 * 刷新用户信息（从云数据库重新拉取）
 */
function refreshUserInfo() {
  return new Promise(function (resolve) {
    if (!isLoggedIn()) {
      loginAndGetUser().then(resolve);
      return;
    }

    wx.cloud
      .callFunction({ name: 'login', data: {} })
      .then(function (res) {
        if (res.result && res.result.success) {
          _globalData.userInfo = res.result.user;
          wx.setStorageSync('userInfo', res.result.user);
          resolve(res.result.user);
        } else {
          resolve(_globalData.userInfo);
        }
      })
      .catch(function () {
        resolve(_globalData.userInfo);
      });
  });
}

module.exports = {
  init: init,
  loginAndGetUser: loginAndGetUser,
  silentLogin: silentLogin,
  getUserInfo: getUserInfo,
  isLoggedIn: isLoggedIn,
  refreshUserInfo: refreshUserInfo
};
