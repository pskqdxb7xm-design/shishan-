// utils/location.js
// 定位工具 —— 不上报隐私接口，从云函数或默认值获取城市

var _city = '全国';

function initLocation() {
  return new Promise(function (resolve) {
    var cached = wx.getStorageSync('user_location');
    if (cached && cached.city) {
      _city = cached.city;
      resolve({ city: _city });
      return;
    }

    // 尝试调用云函数做逆地理编码
    if (wx.cloud) {
      // 先用 wx.getLocation 试试（需要后台隐私声明）
      wx.getLocation({
        type: 'wgs84',
        isHighAccuracy: false,
        success: function (res) {
          wx.cloud.callFunction({
            name: 'getLocationCity',
            data: { lat: res.latitude, lng: res.longitude }
          }).then(function (r) {
            if (r.result && r.result.city) {
              _city = r.result.city;
              wx.setStorageSync('user_location', { city: _city });
              resolve({ city: _city });
            } else {
              resolveDefault(resolve);
            }
          }).catch(function () { resolveDefault(resolve); });
        },
        fail: function () {
          resolveDefault(resolve);
        }
      });
    } else {
      resolveDefault(resolve);
    }
  });
}

function resolveDefault(resolve) {
  _city = '全国';
  resolve({ city: _city });
}

function setCity(city) {
  _city = city;
  wx.setStorageSync('user_location', { city: city });
}

function getCity() { return _city || '全国'; }
function getLocation() { return { city: _city }; }

module.exports = { initLocation: initLocation, setCity: setCity, getCity: getCity, getLocation: getLocation };
