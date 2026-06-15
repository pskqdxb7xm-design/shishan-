// pages/profile/profile.js
// 个人主页 —— CloudBase 数据聚合
// onShow 刷新统计 + Tab 列表；whereIn 分片查询处理 20 元素限制

var app = getApp();

// ---- 内联 batchWhereIn（避免 DevTools 模块缓存问题）----
function batchWhereIn(db, collection, field, values, extraWhere, limit) {
  if (!values || values.length === 0) return Promise.resolve([]);
  var CHUNK = 20;
  var chunks = [];
  for (var i = 0; i < values.length; i += CHUNK) { chunks.push(values.slice(i, i + CHUNK)); }
  var tasks = chunks.map(function (chunk) {
    var where = {}; where[field] = db.command.in(chunk);
    if (extraWhere) { Object.keys(extraWhere).forEach(function (k) { where[k] = extraWhere[k]; }); }
    return db.collection(collection).where(where).limit(limit || 100).get().then(function (res) { return res.data; });
  });
  return Promise.all(tasks).then(function (results) {
    var seen = {}, merged = [];
    results.forEach(function (arr) { arr.forEach(function (doc) { if (!seen[doc._id]) { seen[doc._id] = true; merged.push(doc); } }); });
    return merged;
  });
}

Page({
  data: {
    statusBarHeight: 20,
    userInfo: null,
    loading: true,
    activeTab: 'created',
    counts: { created: 0, joined: 0, favorited: 0 },
    postList: [],
    isEmpty: false,
    listLoading: false,
    showMbtiPicker: false,
    mbtiTypes: ['INTJ','INTP','ENTJ','ENTP','INFJ','INFP','ENFJ','ENFP','ISTJ','ISFJ','ESTJ','ESFJ','ISTP','ISFP','ESTP','ESFP']
  },

  onLoad: function () {
    this.setData({ statusBarHeight: app.globalData.statusBarHeight });
    this.loadUserData();
  },

  onShow: function () {
    if (!this.data.loading) {
      this.fetchCounts();
      this.fetchPostsByTab();
    }
  },

  onLoginReady: function (user) {
    if (user && !user.isGuest) {
      this.setData({ userInfo: user, loading: false });
      this.fetchCounts();
      this.fetchPostsByTab();
    }
  },

  // ============================================================
  // 加载用户数据
  // ============================================================
  loadUserData: function () {
    var self = this;

    if (app.globalData.userInfo && !app.globalData.userInfo.isGuest) {
      self.setData({ userInfo: app.globalData.userInfo, loading: false });
      self.fetchCounts();
      self.fetchPostsByTab();
    }

    app.getUserInfo().then(function (user) {
      self.setData({ userInfo: user, loading: false });
      self.fetchCounts();
      self.fetchPostsByTab();
    }).catch(function () {
      self.setData({ loading: false });
    });
  },

  // ============================================================
  // 统计三项数量
  // ============================================================
  fetchCounts: function () {
    var self = this;
    var user = app.globalData.userInfo;
    if (!user || !user._openid) return;
    if (!wx.cloud || !wx.cloud.database) {
      // Mock counts
      self.setData({ counts: { created: 3, joined: 12, favorited: 28 } });
      return;
    }

    var db = wx.cloud.database();
    var openid = user._openid;

    // 并行查询三项
    Promise.all([
      db.collection('posts').where({ _openid: openid, status: db.command.in(['recruiting', 'full', 'closed']) }).count(),
      db.collection('user_actions').where({ _openid: openid, actionType: 'apply' }).count(),
      db.collection('user_actions').where({ _openid: openid, actionType: 'favorite' }).count()
    ]).then(function (results) {
      self.setData({
        counts: {
          created: results[0].total || 0,
          joined: results[1].total || 0,
          favorited: results[2].total || 0
        }
      });
    }).catch(function (err) {
      console.error('[profile] 统计查询失败:', err);
    });
  },

  // ============================================================
  // 按 Tab 查询帖子
  // ============================================================
  fetchPostsByTab: function () {
    var self = this;
    var user = app.globalData.userInfo;
    var tab = self.data.activeTab;

    if (!user || !user._openid) return;
    if (!wx.cloud || !wx.cloud.database) {
      self.setData({
        postList: self.getMockPosts(tab)
      });
      return;
    }

    self.setData({ listLoading: true });
    var db = wx.cloud.database();
    var openid = user._openid;

    if (tab === 'created') {
      // 我发起的：直接查 posts
      db.collection('posts')
        .where({ _openid: openid, status: db.command.in(['recruiting', 'full', 'closed']) })
        .orderBy('createdAt', 'desc')
        .limit(50)
        .get()
        .then(function (res) {
          self.setData({
            postList: self.formatPosts(res.data),
            isEmpty: res.data.length === 0,
            listLoading: false
          });
        })
        .catch(function (err) {
          console.error('[profile] 查询帖子失败:', err);
          self.setData({ listLoading: false });
        });
    } else {
      // 参加的(tab='joined'映射为'apply') / 收藏的(tab='favorited'映射为'favorite')
      var actionFilter = tab === 'joined' ? 'apply' : (tab === 'favorited' ? 'favorite' : tab);
      db.collection('user_actions')
        .where({ _openid: openid, actionType: actionFilter })
        .orderBy('createdAt', 'desc')
        .limit(100)
        .get()
        .then(function (actionRes) {
          var postIds = [];
          actionRes.data.forEach(function (a) {
            if (postIds.indexOf(a.targetId) === -1) {
              postIds.push(a.targetId);
            }
          });

          if (postIds.length === 0) {
            self.setData({ postList: [], isEmpty: true, listLoading: false });
            return;
          }

          // 用 batchWhereIn 分片查询 posts（处理 >20 的情况）
          return batchWhereIn(db, 'posts', '_id', postIds, { status: db.command.in(['recruiting', 'full', 'closed']) });
        })
        .then(function (postDocs) {
          if (postDocs) {
            self.setData({
              postList: self.formatPosts(postDocs),
              isEmpty: postDocs.length === 0,
              listLoading: false
            });
          }
        })
        .catch(function (err) {
          console.error('[profile] 查询失败:', err);
          self.setData({ listLoading: false });
        });
    }
  },

  // ============================================================
  // 格式化帖子数据
  // ============================================================
  formatPosts: function (posts) {
    return posts.map(function (p) {
      return {
        _id: p._id,
        title: p.title || '无标题',
        category: p.category || '',
        images: (p.coverImages && p.coverImages.length > 0)
          ? p.coverImages
          : ['https://images.unsplash.com/photo-1501554728187-ce583db33af7?w=400&q=80'],
        thumbnail: (p.coverImages && p.coverImages.length > 0)
          ? p.coverImages[0]
          : 'https://images.unsplash.com/photo-1501554728187-ce583db33af7?w=400&q=80',
        time: p.activityTime || '',
        location: p.location || '',
        likeCount: (p.stats && p.stats.likeCount) || 0,
        commentCount: (p.stats && p.stats.commentCount) || 0
      };
    });
  },

  getMockPosts: function (tab) {
    var mocks = {
      created: [
        { _id: 'm1', title: '周末羽毛球局', thumbnail: 'https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?w=400&q=80', time: '周六 14:00', location: '朝阳公园', likeCount: 12, commentCount: 3 }
      ],
      joined: [
        { _id: 'm2', title: '剧本杀新手局', thumbnail: 'https://images.unsplash.com/photo-1585504198199-20277593b94f?w=400&q=80', time: '周日 13:00', location: '三里屯', likeCount: 28, commentCount: 15 }
      ],
      favorited: [
        { _id: 'm3', title: '香山徒步', thumbnail: 'https://images.unsplash.com/photo-1501554728187-ce583db33af7?w=400&q=80', time: '下周六 09:00', location: '香山公园', likeCount: 8, commentCount: 2 }
      ]
    };
    return mocks[tab] || [];
  },

  // ============================================================
  // Tab 切换
  // ============================================================
  onTapTab: function (e) {
    var tab = e.currentTarget.dataset.tab;
    if (tab === this.data.activeTab) return;
    this.setData({ activeTab: tab });
    this.fetchPostsByTab();
  },

  // ============================================================
  // 点击帖子跳转详情
  // ============================================================
  onTapPost: function (e) {
    var id = e.currentTarget.dataset.id;
    if (id) {
      wx.navigateTo({ url: '/pages/detail/detail?id=' + id });
    }
  },

  // ============================================================
  // 其他事件
  // ============================================================
  onTapProfileHeader: function () {
    if (this.data.userInfo && this.data.userInfo.isGuest) {
      this.onTapLogin();
    }
  },

  onTapLogin: function () {
    var self = this;
    // 新方案：用 showModal editable 让用户输入昵称
    wx.showModal({
      title: '设置昵称',
      editable: true,
      placeholderText: '请输入你的昵称',
      content: '',
      success: function (res) {
        if (res.confirm && res.content) {
          var nickname = res.content.trim().substring(0, 20) || '新用户';
          // 审核昵称
          if (wx.cloud) {
            wx.cloud.callFunction({ name: 'contentSecurity', data: { action: 'checkText', content: nickname, openid: self.data.userInfo._openid, scene: 3 } })
              .then(function (r) { if (r.result && r.result.hasOwnProperty('pass') && !r.result.pass) { wx.showToast({ title: '昵称含敏感词', icon: 'none' }); return; } self._saveNickname(nickname); })
              .catch(function () { self._saveNickname(nickname); });
          } else {
            self._saveNickname(nickname);
          }
        }
      }
    });
  },
  _saveNickname: function (nickname) {
    var self = this;
    var currentUser = self.data.userInfo;
    currentUser.nickname = nickname;
    currentUser.isGuest = false;
    self.setData({ userInfo: currentUser });
    app.globalData.userInfo = currentUser;
    wx.setStorageSync('userInfo', currentUser);
    if (wx.cloud && wx.cloud.database && currentUser._openid) {
      wx.cloud.database().collection('users').where({ _openid: currentUser._openid }).get().then(function (res2) {
        if (res2.data.length > 0) wx.cloud.database().collection('users').doc(res2.data[0]._id).update({ data: { nickname: nickname, updatedAt: new Date() } });
      });
    }
    wx.showToast({ title: '登录成功', icon: 'success' });
  },

  // 换头像
  onTapAvatar: function () {
    var self = this;
    if (!wx.cloud) return;
    wx.chooseImage({
      count: 1, sizeType: ['compressed'], sourceType: ['album', 'camera'],
      success: function (res) {
        var path = res.tempFilePaths[0];
        wx.showLoading({ title: '上传中...' });
        wx.cloud.uploadFile({
          cloudPath: 'avatars/' + Date.now() + '.jpg', filePath: path,
          success: function (upRes) {
            wx.cloud.getTempFileURL({ fileList: [upRes.fileID] }).then(function (tmpRes) {
              var url = (tmpRes.fileList[0] || {}).tempFileURL || upRes.fileID;
              var user = self.data.userInfo;
              user.avatar = upRes.fileID;
              self.setData({ 'userInfo.avatar': url });
              getApp().globalData.userInfo = user;
              wx.setStorageSync('userInfo', user);
              // 存到数据库
              if (user._openid) {
                wx.cloud.database().collection('users').where({ _openid: user._openid }).get().then(function (r2) {
                  if (r2.data.length > 0) wx.cloud.database().collection('users').doc(r2.data[0]._id).update({ data: { avatar: upRes.fileID } });
                });
              }
              wx.hideLoading();
              wx.showToast({ title: '头像已更新', icon: 'success' });
            });
          },
          fail: function () { wx.hideLoading(); wx.showToast({ title: '上传失败', icon: 'none' }); }
        });
      }
    });
  },

  // 编辑资料弹窗
  onTapEditProfile: function () {
    var self = this;
    wx.showModal({
      title: '编辑微信号',
      editable: true,
      placeholderText: '请输入微信号（6-20位字母数字）',
      content: self.data.userInfo.wechat_id || '',
      success: function (res) {
        if (res.confirm && res.content !== undefined) {
          var wechatId = res.content.trim();
          if (wechatId && !/^[a-zA-Z0-9_]{6,20}$/.test(wechatId)) {
            wx.showToast({ title: '微信号格式不正确（6-20位字母数字下划线）', icon: 'none' });
            return;
          }
          // 审核微信号
          if (wechatId && wx.cloud) {
            wx.cloud.callFunction({ name: 'contentSecurity', data: { action: 'checkText', content: wechatId, openid: self.data.userInfo._openid, scene: 3 } })
              .then(function (r) { if (r.result && r.result.hasOwnProperty('pass') && !r.result.pass) { wx.showToast({ title: '微信号含敏感词', icon: 'none' }); return; } self.saveWechatId(wechatId); })
              .catch(function () { self.saveWechatId(wechatId); });
          } else {
            self.saveWechatId(wechatId || '');
          }
        }
      }
    });
  },

  saveWechatId: function (wechatId) {
    var self = this;
    var user = self.data.userInfo;
    user.wechat_id = wechatId;
    self.setData({ userInfo: user });
    app.globalData.userInfo = user;
    wx.setStorageSync('userInfo', user);

    if (wx.cloud && wx.cloud.database) {
      wx.cloud.database().collection('users')
        .where({ _openid: user._openid })
        .get()
        .then(function (res) {
          if (res.data.length > 0) {
            wx.cloud.database().collection('users').doc(res.data[0]._id).update({
              data: { wechat_id: wechatId, updatedAt: new Date() }
            });
          }
        })
        .catch(function (err) {
          console.error('[profile] 保存微信号失败:', err);
          wx.showToast({ title: '保存失败', icon: 'none' });
        });
    }
    wx.showToast({ title: wechatId ? '微信号已保存' : '微信号已清空', icon: 'success' });
  },

  // 黑名单管理
  onTapBlockList: function () {
    if (!wx.cloud) return wx.showToast({ title: '云服务不可用', icon: 'none' });
    var self = this;
    wx.cloud.callFunction({ name: 'block', data: { action: 'get' } }).then(function (res) {
      var list = res.result.block_list || [];
      if (list.length === 0) {
        wx.showToast({ title: '暂无拉黑用户', icon: 'none' });
        return;
      }
      // 批量查询拉黑用户的昵称
      if (list.length > 20) list = list.slice(0, 20);
      wx.cloud.database().collection('users')
        .where({ _openid: wx.cloud.database().command.in(list) })
        .field({ nickname: true, _openid: true }).get()
        .then(function (userRes) {
          var names = userRes.data.map(function (u) { return u.nickname || '未知'; });
          wx.showActionSheet({
            itemList: names.concat(['全部取消拉黑']),
            success: function (r) {
              if (r.tapIndex === names.length) {
                list.forEach(function (openid) {
                  wx.cloud.callFunction({ name: 'block', data: { action: 'toggle', target_openid: openid } });
                });
                wx.showToast({ title: '已全部取消拉黑', icon: 'success' });
              } else {
                var target = userRes.data[r.tapIndex];
                if (target) {
                  wx.cloud.callFunction({ name: 'block', data: { action: 'toggle', target_openid: target._openid } })
                    .then(function () { wx.showToast({ title: '已取消拉黑 ' + (target.nickname || ''), icon: 'success' }); });
                }
              }
            }
          });
        });
    }).catch(function () {
      wx.showToast({ title: '黑名单功能暂不可用', icon: 'none' });
    });
  },

  // MBTI 编辑
  onTapEditMbti: function () {
    this.setData({ showMbtiPicker: true });
  },
  onCloseMbtiPicker: function () { this.setData({ showMbtiPicker: false }); },
  onSelectMbti: function (e) {
    this.setData({ showMbtiPicker: false });
    this._saveMbti(e.currentTarget.dataset.mbti);
  },
  _saveMbti: function (mbti) {
    var self = this;
    var user = self.data.userInfo;
    user.mbti = mbti;
    self.setData({ userInfo: user });
    getApp().globalData.userInfo = user;
    wx.setStorageSync('userInfo', user);
    if (wx.cloud && wx.cloud.database && user._openid) {
      wx.cloud.database().collection('users').where({ _openid: user._openid }).get().then(function (res) {
        if (res.data.length > 0) {
          wx.cloud.database().collection('users').doc(res.data[0]._id).update({ data: { mbti: mbti, updatedAt: new Date() } });
        }
      });
    }
    wx.showToast({ title: 'MBTI 已更新: ' + mbti, icon: 'success' });
  },

});
