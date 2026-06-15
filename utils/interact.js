// utils/interact.js
// 互动操作工具：收藏/报名 乐观更新 + 回滚

function toggleAction(actionType, targetId, onStateChange) {
  var user = getApp().globalData.userInfo;
  if (!user || !user._openid) {
    wx.showToast({ title: '请先登录', icon: 'none' });
    return Promise.resolve({ active: false });
  }
  if (!wx.cloud || !wx.cloud.database) {
    wx.showToast({ title: '云数据库不可用', icon: 'none' });
    return Promise.resolve({ active: false });
  }

  var db = wx.cloud.database();
  var collection = db.collection('user_actions');
  var wasActive = false; // 外层保存，回滚用

  return collection
    .where({
      _openid: user._openid,
      targetId: targetId,
      actionType: actionType
    })
    .get()
    .then(function (res) {
      wasActive = res.data.length > 0;

      // 乐观更新 UI
      if (onStateChange) onStateChange(!wasActive);

      if (wasActive) {
        return collection.doc(res.data[0]._id).remove().then(function () {
          return { active: false };
        }).catch(function (e) {
          console.warn('[interact] remove 失败:', e);
          return { active: false };
        });
      } else {
        // 不传 _openid，让 traceUser 自动注入
        return collection.add({
          data: {
            targetId: targetId,
            targetType: 'post',
            actionType: actionType,
            createdAt: new Date()
          }
        }).then(function () {
          return { active: true };
        });
      }
    })
    .catch(function (err) {
      console.error('[interact] 操作失败:', err);
      wx.showToast({ title: '操作失败，请重试', icon: 'none' });
      // 回滚
      if (onStateChange) onStateChange(wasActive);
      return { active: wasActive, error: err };
    });
}

function getUserActionIds(actionType) {
  var user = getApp().globalData.userInfo;
  if (!user || !user._openid) return Promise.resolve([]);
  if (!wx.cloud || !wx.cloud.database) return Promise.resolve([]);

  return wx.cloud.database()
    .collection('user_actions')
    .where({ _openid: user._openid, actionType: actionType })
    .field({ targetId: true })
    .get()
    .then(function (res) {
      return res.data.map(function (item) { return item.targetId; });
    })
    .catch(function () { return []; });
}

module.exports = { toggleAction: toggleAction, getUserActionIds: getUserActionIds };
