// pages/messages/messages.js
// 消息通知中心

var app = getApp();

function fmtTime(d) {
  if (!d) return '';
  var n = Date.now(), t = new Date(d).getTime();
  if (isNaN(t)) return '';
  var m = Math.floor((n - t) / 60000);
  if (m < 1) return '刚刚'; if (m < 60) return m + '分钟前';
  var h = Math.floor(m / 60); if (h < 24) return h + '小时前';
  var dy = Math.floor(h / 24); if (dy < 7) return dy + '天前';
  return Math.floor(dy / 30) + '个月前';
}

function typeLabel(t) {
  if (t === 'comment') return '评论了你的帖子';
  if (t === 'reply') return '回复了你';
  if (t === 'apply') return '申请加入';
  if (t === 'audit') return '审核结果';
  return '互动消息';
}

Page({
  data: { statusBarHeight: 20, notifications: [], loading: true, isEmpty: false },

  onLoad: function () {
    this.setData({ statusBarHeight: app.globalData.statusBarHeight });
    this.fetchNotifications();
  },

  onShow: function () {
    this.fetchNotifications();
  },

  fetchNotifications: function () {
    var self = this;
    var user = app.globalData.userInfo;
    if (!user || !user._openid) { self.setData({ loading: false, isEmpty: true }); return; }
    if (!wx.cloud || !wx.cloud.database) { self.setData({ loading: false, isEmpty: true }); return; }

    self.setData({ loading: true });
    var db = wx.cloud.database();

    // 查询当前用户的未读和最近已读消息
    db.collection('notifications')
      .where({ receiver_openid: user._openid })
      .orderBy('create_time', 'desc')
      .limit(50)
      .get()
      .then(function (res) {
        var list = res.data.map(function (item) {
          return {
            _id: item._id,
            avatar: (item.sender_info && item.sender_info.avatar) || '',
            nickname: (item.sender_info && item.sender_info.nickname) || '匿名',
            type: item.type,
            typeLabel: typeLabel(item.type),
            content: item.content || '',
            post_id: item.post_id,
            post_title: item.post_title || '',
            is_read: !!item.is_read,
            timeText: fmtTime(item.create_time)
          };
        });
        self.setData({ notifications: list, isEmpty: list.length === 0, loading: false });

        // 标记所有未读为已读
        var unreadIds = [];
        res.data.forEach(function (item) { if (!item.is_read) unreadIds.push(item._id); });
        if (unreadIds.length > 0) {
          self.markAsRead(unreadIds);
        }
        // 清除 tabBar 红点
        wx.removeTabBarBadge({ index: 1 }).catch(function () {});
      })
      .catch(function (err) {
        console.error('[messages] 查询失败:', err);
        self.setData({ loading: false, isEmpty: true });
      });
  },

  markAsRead: function (ids) {
    if (ids.length === 0) return;
    var batch = ids.slice(0, 20);
    var tasks = batch.map(function (id) {
      return wx.cloud.database().collection('notifications').doc(id).update({ data: { is_read: true } }).catch(function () {});
    });
    Promise.all(tasks);
  },

  onTapNotification: function (e) {
    var ds = e.currentTarget.dataset;
    if (!ds.postId) return;
    var scrollTo = (ds.type === 'comment' || ds.type === 'reply') ? 'comment-section' : 'apply-section';
    wx.navigateTo({ url: '/pages/detail/detail?id=' + ds.postId + '&scroll_to=' + scrollTo });
  }
});
