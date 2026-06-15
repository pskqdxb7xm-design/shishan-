// pages/detail/detail.js
// 帖子详情 + 评论 + 组队系统 + 举报 + 分享 + 拉黑过滤

var interact = require('../../utils/interact');
var app = getApp();

// 获取黑名单
var _blockList = [];
function loadBlockList() {
  return wx.cloud.callFunction({ name: 'block', data: { action: 'get' } })
    .then(function (r) { _blockList = (r.result && r.result.block_list) || []; })
    .catch(function () { _blockList = []; });
}
function isBlocked(openid) { return _blockList.indexOf(openid) !== -1; }

// 发送通知（异步，不阻塞主流程）
function sendNotify(receiver, type, postId, postTitle, content) {
  var u = app.globalData.userInfo || {};
  if (!receiver || !wx.cloud) return;
  wx.cloud.callFunction({
    name: 'sendNotification',
    data: {
      receiver_openid: receiver,
      type: type,
      post_id: postId,
      post_title: postTitle || '',
      content: content || '',
      senderAvatar: u.avatar || '',
      senderName: u.nickname || '匿名'
    }
  }).catch(function (e) { console.warn('[notify] send fail:', e); });
}

// ---- 评论树工具 ----
function buildCommentTree(cs) {
  var m = {}, t = [];
  cs.forEach(function (c) { m[c._id] = { _id: c._id, content: c.content, parentId: c.parentId || null, replyToName: c.replyToName || null, userName: c.userName || '匿名', userAvatar: c.userAvatar || '', userMbti: c.userMbti || '', timeText: fmt(c.createdAt), replies: [], isLocal: c.isLocal || false }; });
  cs.forEach(function (c) { var n = m[c._id]; if (!n) return; if (c.parentId && m[c.parentId]) m[c.parentId].replies.push(n); else t.push(n); });
  return t;
}
function fmt(d) { if (!d) return ''; var n = Date.now(), t = new Date(d).getTime(); if (isNaN(t)) return ''; var s = Math.floor((n - t) / 60000); if (s < 1) return '刚刚'; if (s < 60) return s + '分钟前'; var h = Math.floor(s / 60); if (h < 24) return h + '小时前'; var dy = Math.floor(h / 24); if (dy < 7) return dy + '天前'; return Math.floor(dy / 30) + '个月前'; }

Page({
  data: {
    statusBarHeight: 20, loading: true, post: { images:[], title:'', category:'', status:'recruiting', time:'', location:'', owner:{}, targetCount:0, currentCount:0 }, postId: '', userRole: 'guest',
    myApplyStatus: null, teamData: { members: [], owner_wechat: null },
    pendingList: [], pendingCount: 0,
    favorited: false, commentTree: [], commentCount: 0,
    inputText: '', replyPlaceholder: '说点什么...', replyToNickname: null, replyToId: null,
    showApplyModal: false, applyMessage: '', applyConsent: false, applying: false
  },

  onLoad: function (o) {
    var postId = o.id || '';
    if (!postId && o.scene) {
      var d = decodeURIComponent(o.scene);
      var m = d.match(/id=([^&]+)/);
      if (m) postId = m[1];
    }
    this.setData({
      statusBarHeight: app.globalData.statusBarHeight,
      postId: postId,
      scrollToView: ''
    });
    // 锚点：apply-section 仅队长可见，非队长忽略
    var st = o.scroll_to || '';
    this._scrollTarget = st;
    if (st === 'apply-section') this._pendingApplyScroll = true;
    this.fetchAll();
  },

  // ============================================================
  fetchAll: function () {
    var self = this; self.setData({ loading: true });
    var pid = self.data.postId;

    // 无云环境或无效 ID → 直接 mock
    if (!pid || !wx.cloud || !wx.cloud.database) { self.loadMock(); return; }

    var db = wx.cloud.database();
    var _ = db.command;

    db.collection('posts').doc(pid).get().then(function (postRes) {
      var p = postRes.data;
      if (!p || !p._id) { self.loadMock(); return; }

      var isOwner = p._openid === (app.globalData.userInfo || {})._openid;

      // 查作者
      var authorJob = p._openid ? db.collection('users').where({ _openid: p._openid }).field({ nickname: true, avatar: true, mbti: true }).get() : Promise.resolve({ data: [] });

      // 查评论
      var commentJob = db.collection('comments').where(_.or([{ postId: pid, status: 'active', audit_status: 'pass' }, { postId: pid, status: 'active', _openid: (app.globalData.userInfo||{})._openid||'' }])).orderBy('createdAt', 'asc').limit(200).get();

      return Promise.all([authorJob, commentJob]).then(function (r) {
        var author = (r[0].data && r[0].data[0]) || {};
        var comments = r[1].data || [];

        self.setData({
          post: {
            _id: p._id, title: p.title || '', category: p.category || '',
            images: (p.coverImages && p.coverImages.length > 0) ? p.coverImages : ['https://images.unsplash.com/photo-1501554728187-ce583db33af7?w=800&q=80'],
            time: p.activityTime || '', location: p.location || '',
            targetCount: p.targetCount || 0, currentCount: p.currentCount || 1,
            status: p.status || 'recruiting', owner_show_wechat: p.owner_show_wechat,
            contact_info: p.contact_info || '',
            owner: { _openid: p._openid, nickname: author.nickname || '匿名', avatar: author.avatar || '', mbti: author.mbti || '' }
          },
          userRole: isOwner ? 'owner' : 'guest',
          favorited: false, pendingList: [], pendingCount: 0,
          commentTree: buildCommentTree(comments), commentCount: comments.length,
          loading: false
        });
      });
    }).catch(function (e) {
      console.error('[detail] 加载失败:', e);
      self.loadMock();
    });
  },

  // ============================================================
  // 报名 Modal
  // ============================================================
  onTapApply: function () { this.setData({ showApplyModal: true, applyMessage: '', applyConsent: false }); },
  onCloseApplyModal: function () { this.setData({ showApplyModal: false }); },
  onInputApplyMessage: function (e) { this.setData({ applyMessage: e.detail.value }); },
  onToggleConsent: function () { this.setData({ applyConsent: !this.data.applyConsent }); },

  onConfirmApply: function () {
    var self = this;
    if (!self.data.applyConsent) { wx.showToast({ title: '请先勾选授权', icon: 'none' }); return; }
    if (self.data.applying) return;
    // 同步请求订阅消息授权
    self.requestSubscribe(['dWdSBLLCSez6DS4wKFbxx58tkKy1ittqjPxsafmWSRg']);
    // 审核申请留言
    var msg = self.data.applyMessage.trim();
    if (msg && wx.cloud) {
      wx.cloud.callFunction({ name: 'contentSecurity', data: { action: 'checkText', content: msg, openid: (app.globalData.userInfo||{})._openid||'', scene: 1 } })
        .then(function (r) { if (r.result && r.result.hasOwnProperty('pass') && !r.result.pass) { wx.showToast({ title: '留言含敏感词', icon: 'none' }); return; } self._doApply(); })
        .catch(function () { self._doApply(); });
    } else {
      self._doApply();
    }
  },
  _doApply: function () {
    var self = this;
    self.setData({ applying: true });
    var db = wx.cloud.database();
    var u = app.globalData.userInfo || {};
    db.collection('user_actions').add({
      data: { actionType: 'apply', targetId: self.data.postId, targetType: 'post', applyStatus: 'pending', applyMessage: self.data.applyMessage.trim(), auth_granted: true, createdAt: new Date() }
    }).then(function () {
      self.setData({ showApplyModal: false, applying: false, myApplyStatus: 'pending' });
      wx.showToast({ title: '申请已提交', icon: 'success' });
      // 通知帖子所有者
      var post = self.data.post;
      sendNotify(post.owner && post.owner._openid, 'apply', self.data.postId, post.title, '申请加入您的队伍');
      self.fetchAll();
    }).catch(function (e) {
      self.setData({ applying: false });
      wx.showToast({ title: '提交失败，请重试', icon: 'none' });
    });
  },

  // ============================================================
  // 队长审核
  // ============================================================
  onApprove: function (e) {
    var self = this; var id = e.currentTarget.dataset.id;
    wx.showLoading({ title: '处理中...', mask: true });
    var db = wx.cloud.database();
    var _ = db.command;
    // 原子更新：通过申请 + inc 人数
    db.collection('user_actions').doc(id).update({ data: { applyStatus: 'accepted' } }).then(function () {
      return db.collection('posts').doc(self.data.postId).update({ data: { currentCount: _.inc(1) } });
    }).then(function () {
      // 检查是否满员
      var newCount = (self.data.post.currentCount || 1) + 1;
      if (newCount >= (self.data.post.targetCount || 99)) {
        return db.collection('posts').doc(self.data.postId).update({ data: { status: 'full' } });
      }
      return Promise.resolve();
    }).then(function () {
      wx.hideLoading();
      // 通知申请者
      sendNotify(e.currentTarget.dataset.openid, 'audit', self.data.postId, self.data.post.title, '队长已通过您的申请');
      self.fetchAll();
    }).catch(function (e) {
      wx.hideLoading();
      wx.showToast({ title: '操作失败', icon: 'none' });
    });
  },

  onReject: function (e) {
    var self = this; var id = e.currentTarget.dataset.id;
    wx.showLoading({ title: '处理中...', mask: true });
    wx.cloud.database().collection('user_actions').doc(id).update({ data: { applyStatus: 'rejected' } }).then(function () {
      wx.hideLoading();
      sendNotify(e.currentTarget.dataset.openid, 'audit', self.data.postId, self.data.post.title, '队长拒绝了您的申请');
      self.fetchAll();
    }).catch(function () {
      wx.hideLoading(); wx.showToast({ title: '操作失败', icon: 'none' });
    });
  },

  onCloseRecruit: function () {
    var self = this;
    wx.showModal({ title: '结束招募？', content: '结束后其他人将无法申请', success: function (r) {
      if (!r.confirm) return;
      wx.showLoading({ title: '处理中...', mask: true });
      wx.cloud.database().collection('posts').doc(self.data.postId).update({ data: { status: 'closed' } }).then(function () {
        wx.hideLoading(); self.setData({ 'post.status': 'closed' });
      }).catch(function () { wx.hideLoading(); });
    }});
  },

  // ============================================================
  // 复制微信号
  // ============================================================
  onCopyWechat: function (e) {
    wx.setClipboardData({ data: e.currentTarget.dataset.wx, success: function () {
      wx.showToast({ title: '已复制', icon: 'success' });
    }});
  },

  // ============================================================
  // 图片预览
  // ============================================================
  onPreviewImage: function (e) {
    var urls = this.data.post.images || [];
    if (urls.length) wx.previewImage({ current: e.currentTarget.dataset.src, urls: urls });
  },

  // ============================================================
  // 评论（同前）
  // ============================================================
  onSubmitComment: function () {
    var self = this; var text = self.data.inputText.trim(); if (!text) return;
    var u = app.globalData.userInfo || {};
    var isReply = !!self.data.replyToId;
    var post = self.data.post;

    // 先做内容安全审核
    wx.cloud.callFunction({
      name: 'contentSecurity',
      data: { action: 'checkText', content: text, openid: u._openid, scene: 1 }
    }).then(function (secRes) {
      var r = secRes.result;
      // 云函数不可用/报错时降级放行；明确返回 false 才拦截
      if (r && r.hasOwnProperty('pass') && !r.pass) {
        wx.showToast({ title: r.error || '内容违规，请修改', icon: 'none' });
        // 审核不通过通知
        wx.cloud.callFunction({ name: 'sendNotification', data: {
          receiver_openid: (app.globalData.userInfo||{})._openid||'',
          type: 'audit', post_id: self.data.postId, post_title: self.data.post.title,
          content: '你的评论未通过审核：' + (r.error||'内容违规'),
          senderAvatar: '', senderName: '系统'
        }}).catch(function () {});
        return;
      }
      // 审核通过，执行乐观更新 + 写入
      var savedReplyId = self.data.replyToId; // 清空前先保存
      var savedReplyName = self.data.replyToNickname;
      var fake = { _id: 'l_' + Date.now(), content: text, userName: u.nickname || '我', userAvatar: u.avatar || '', userMbti: u.mbti || '', replyToName: savedReplyName, timeText: '刚刚', parentId: savedReplyId, replies: [], isLocal: true };
      if (savedReplyId) { var t = self.data.commentTree.slice(); for (var i = 0; i < t.length; i++) { if (t[i]._id === savedReplyId) { t[i] = Object.assign({}, t[i], { replies: t[i].replies.concat([fake]) }); break; } } self.setData({ commentTree: t }); }
      else { self.setData({ commentTree: self.data.commentTree.concat([fake]) }); }
      self.setData({ inputText: '', replyToNickname: null, replyToId: null, replyPlaceholder: '说点什么...', commentCount: self.data.commentCount + 1 });
      // 写入
      wx.cloud.database().collection('comments').add({
        data: { postId: self.data.postId, parentId: savedReplyId || null, replyToName: savedReplyName || null, content: text, userName: u.nickname || '我', userAvatar: u.avatar || '', userMbti: u.mbti || '', status: 'active', audit_status: 'pass', createdAt: new Date() }
      }).then(function () {
        if (isReply) { sendNotify(post.owner && post.owner._openid, 'reply', self.data.postId, post.title, text); }
        else { sendNotify(post.owner && post.owner._openid, 'comment', self.data.postId, post.title, text); }
        self.fetchAll();
      }).catch(function () { self.fetchAll(); });
    }).catch(function () {
      // 审核服务异常，降级放行
      wx.showToast({ title: '发送失败，请重试', icon: 'none' });
    });
  },
  onTapReply: function (e) { this.setData({ replyToNickname: e.currentTarget.dataset.replyTo, replyToId: e.currentTarget.dataset.parentId, replyPlaceholder: '回复 @' + e.currentTarget.dataset.replyTo }); },
  onCancelReply: function () { this.setData({ replyToNickname: null, replyToId: null, replyPlaceholder: '说点什么...' }); },
  onInputText: function (e) { this.setData({ inputText: e.detail.value }); },
  onToggleFavorite: function () { var self = this; interact.toggleAction('favorite', self.data.postId, function (a) { self.setData({ favorited: a }); }); },
  // 更多菜单
  onTapMore: function () {
    var self = this;
    var isOwner = self.data.userRole === 'owner';
    var items = isOwner ? ['删除帖子', '隐藏帖子', '举报此帖'] : ['举报此帖', '拉黑此用户'];
    wx.showActionSheet({
      itemList: items,
      success: function (res) {
        if (isOwner && res.tapIndex === 0) {
          // 删除帖子（物理删除）
          wx.showModal({ title: '确认删除？', content: '帖子及关联数据将被永久删除', success: function (r) {
            if (!r.confirm) return;
            var pid = self.data.postId;
            wx.showLoading({ title: '删除中...', mask: true });
            // 删帖 + 删评论 + 删关联操作
            var tasks = [
              wx.cloud.database().collection('posts').doc(pid).remove(),
              wx.cloud.database().collection('comments').where({ postId: pid }).remove(),
              wx.cloud.database().collection('user_actions').where({ targetId: pid }).remove(),
              wx.cloud.database().collection('notifications').where({ post_id: pid }).remove()
            ];
            Promise.all(tasks).then(function () {
              wx.hideLoading(); wx.showToast({ title: '已删除', icon: 'success' });
              // 给自己发确认通知
              wx.cloud.callFunction({ name: 'sendNotification', data: {
                receiver_openid: (app.globalData.userInfo||{})._openid||'',
                type: 'audit', post_id: pid, post_title: self.data.post.title, content: '你已成功删除帖子',
                senderAvatar: '', senderName: '系统'
              }}).catch(function () {});
              setTimeout(function () { wx.navigateBack(); }, 800);
            }).catch(function () {
              wx.hideLoading(); wx.showToast({ title: '删除失败', icon: 'none' });
            });
          }});
        } else if (isOwner && res.tapIndex === 1) {
          // 隐藏帖子
          wx.showModal({ title: '确认隐藏？', content: '隐藏后仅自己可见', success: function (r) {
            if (!r.confirm) return;
            wx.cloud.database().collection('posts').doc(self.data.postId).update({ data: { status: 'closed' } }).then(function () {
              wx.showToast({ title: '已隐藏', icon: 'success' }); self.setData({ 'post.status': 'closed' });
            });
          }});
        } else if ((isOwner && res.tapIndex === 2) || (!isOwner && res.tapIndex === 0)) {
          self.onTapReport({ currentTarget: { dataset: { type: 'post' } } });
        } else if (!isOwner && res.tapIndex === 1) {
          self.onTapBlock();
        }
      }
    });
  },

  // 举报
  onTapReport: function (e) {
    var self = this;
    var type = e.currentTarget.dataset.type || 'post';
    var targetId = type === 'post' ? self.data.postId : (e.currentTarget.dataset.id || '');
    var reasons = ['广告', '辱骂攻击', '色情低俗', '虚假信息', '其他'];
    wx.showActionSheet({
      itemList: reasons,
      success: function (res) {
        wx.cloud.callFunction({
          name: 'report',
          data: { target_type: type, target_id: targetId, reason: reasons[res.tapIndex], description: '' }
        }).then(function () {
          wx.showToast({ title: '举报已提交，我们将尽快核实', icon: 'none' });
        }).catch(function () {
          wx.showToast({ title: '提交失败，请重试', icon: 'none' });
        });
      }
    });
  },

  // 拉黑作者
  onTapBlock: function () {
    var self = this;
    var post = self.data.post;
    var targetOpenid = post.owner && post.owner._openid;
    if (!targetOpenid) return;
    wx.showModal({
      title: '拉黑该用户？',
      content: '拉黑后将不再看到该用户的帖子和评论',
      success: function (r) {
        if (!r.confirm) return;
        wx.cloud.callFunction({ name: 'block', data: { action: 'toggle', target_openid: targetOpenid } })
          .then(function (res) {
            var blocked = res.result && res.result.blocked;
            wx.showToast({ title: blocked ? '已拉黑' : '已取消拉黑', icon: 'none' });
          }).catch(function () {});
      }
    });
  },

  // 分享
  onShareAppMessage: function () {
    var p = this.data.post;
    var remain = (p.targetCount || 0) - (p.currentCount || 0);
    return {
      title: '【找队友】' + (p.title || '') + '，还差' + (remain > 0 ? remain : 0) + '人，快来加入！',
      path: '/pages/detail/detail?id=' + this.data.postId,
      imageUrl: (p.images && p.images.length > 0) ? p.images[0] : ''
    };
  },

  // 订阅消息请求（评论/报名时同步调用）
  requestSubscribe: function (tmplIds) {
    if (!wx.requestSubscribeMessage) return;
    wx.requestSubscribeMessage({ tmplIds: tmplIds, success: function () {}, fail: function () {} });
  },

  // 跳转海报页
  onTapPoster: function () {
    var p = this.data.post;
    wx.navigateTo({
      url: '/pagesExtra/poster/poster?id=' + this.data.postId + '&title=' + encodeURIComponent(p.title || '') + '&cat=' + encodeURIComponent(p.category || '') + '&img=' + encodeURIComponent((p.images && p.images[0]) || '')
    });
  },

  onTapBack: function () { wx.navigateBack(); },

  loadMock: function () {
    var self = this;
    setTimeout(function () {
      self.setData({
        post: { _id: 'm1', title: '测试活动', category: '🏸羽毛球', images: ['https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?w=800&q=80'], time: '周六', location: '朝阳', targetCount: 5, currentCount: 2, status: 'recruiting', owner_show_wechat: true, contact_info: '', owner: { nickname: '队长', avatar: '' } },
        userRole: 'guest', teamData: { members: [{ nickname: '队员A', wechat_id: 'wx_aaa' }], owner_wechat: null }, commentTree: [], commentCount: 0, loading: false
      });
    }, 200);
  }
});
