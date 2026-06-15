var MAX_IMAGES = 9;

Page({
  data: {
    statusBarHeight: 20, images: [], fileIDs: [], uploading: false,
    title: '', category: '', activityTime: '', location: '', targetCount: '',
    startDate: '', startTime: '', startDateText: '', startTimeText: '',
    endDate: '', endTime: '', endDateText: '', endTimeText: '',
    durationDays: '',
    today: new Date().toISOString().split('T')[0],
    city: '全国',
    contactInfo: '', ownerShowWechat: true, agreedTerms: false, submitting: false,
    genders: ['不限','仅限男生','仅限女生','宠物友好'], selectedGender: '不限',
    categories: ['⚽足球','🏀篮球','🏸羽毛球','🏓乒乓球','🎾网球','🏐排球','🏊游泳','🏃跑步','🚴骑行','🏕️徒步','🧗攀岩','⛷️滑雪','🏄冲浪','🎿滑板','🥊拳击','🎭剧本杀','🎮桌游','🎤KTV','🍜美食','🧘瑜伽','🎣钓鱼','♟️棋牌','🎯飞镖','🐾宠物']
  },

  onLoad: function () {
    this.setData({ statusBarHeight: getApp().globalData.statusBarHeight });
  },
  onShow: function () {
    this.setData({ city: getApp().globalData.city || '全国' });
  },
  onTapCity: function () { wx.navigateTo({ url: '/pages/city/city' }); },

  onChooseImage: function () {
    var self = this;
    var remain = MAX_IMAGES - self.data.images.length;
    if (remain <= 0) return;

    function doPick() {
      // 优先用 chooseMedia，不可用则 fallback chooseImage
      if (wx.chooseMedia) {
        wx.chooseMedia({
          count: remain, mediaType: ['image'], sizeType: ['compressed'], sourceType: ['album', 'camera'],
          success: function (res) {
            var imgs = self.data.images.slice();
            (res.tempFiles || []).forEach(function (f) { if (f.tempFilePath) imgs.push(f.tempFilePath); });
            self.setData({ images: imgs });
          },
          fail: function (e) {
            if (e.errMsg && e.errMsg.indexOf('cancel') > -1) return;
            // fallback
            wx.chooseImage({ count: remain, sizeType: ['compressed'], sourceType: ['album', 'camera'],
              success: function (r) {
                var imgs = self.data.images.slice();
                (r.tempFilePaths || []).forEach(function (p) { imgs.push(p); });
                self.setData({ images: imgs });
              },
              fail: function (e2) {
                if (e2.errMsg && e2.errMsg.indexOf('cancel') > -1) return;
                self._checkPermAndRetry();
              }
            });
          }
        });
      } else {
        wx.chooseImage({ count: remain, sizeType: ['compressed'], sourceType: ['album', 'camera'],
          success: function (r) {
            var imgs = self.data.images.slice();
            (r.tempFilePaths || []).forEach(function (p) { imgs.push(p); });
            self.setData({ images: imgs });
          },
          fail: function (e) {
            if (e.errMsg && e.errMsg.indexOf('cancel') > -1) return;
            self._checkPermAndRetry();
          }
        });
      }
    }
    doPick();
  },

  _checkPermAndRetry: function () {
    var self = this;
    wx.getSetting({
      success: function (s) {
        if (!s.authSetting['scope.writePhotosAlbum'] && !s.authSetting['scope.camera']) {
          wx.authorize({ scope: 'scope.writePhotosAlbum', success: function () { self.onChooseImage(); }, fail: function () { wx.showToast({ title: '请在设置中开启相册权限', icon: 'none' }); } });
        } else {
          wx.showToast({ title: '选图失败，请检查权限设置', icon: 'none' });
        }
      },
      fail: function () { wx.showToast({ title: '选图失败，请重试', icon: 'none' }); }
    });
  },

  onRemoveImage: function (e) {
    var i = e.currentTarget.dataset.index, imgs = this.data.images.slice(), fids = this.data.fileIDs.slice();
    imgs.splice(i, 1); if (i < fids.length) fids.splice(i, 1);
    this.setData({ images: imgs, fileIDs: fids });
  },

  uploadImages: function () {
    var self = this, imgs = self.data.images;
    if (imgs.length === 0) return Promise.resolve([]);
    if (!wx.cloud) return Promise.reject(new Error('云服务不可用'));
    self.setData({ uploading: true });
    wx.showLoading({ title: '上传中...', mask: true });
    var done = 0;
    var tasks = imgs.map(function (path) {
      return new Promise(function (resolve, reject) {
        wx.cloud.uploadFile({
          cloudPath: 'post-covers/' + Date.now() + '-' + Math.random().toString(36).substring(7) + '.jpg',
          filePath: path,
          success: function (r) { done++; wx.showLoading({ title: '上传中(' + done + '/' + imgs.length + ')', mask: true }); resolve(r.fileID); },
          fail: function (e) { reject(e); }
        });
      });
    });
    return Promise.all(tasks);
  },

  onSubmit: function () {
    var self = this;
    if (self.data.submitting) return;
    if (!self.data.title.trim()) { wx.showToast({ title: '请输入标题', icon: 'none' }); return; }
    if (!self.data.category) { wx.showToast({ title: '请选择分类', icon: 'none' }); return; }
    if (!self.data.activityTime.trim()) { wx.showToast({ title: '请输入时间', icon: 'none' }); return; }
    if (!self.data.location.trim()) { wx.showToast({ title: '请输入地点', icon: 'none' }); return; }
    if (self.data.images.length === 0) { wx.showToast({ title: '请选择图片', icon: 'none' }); return; }
    if (!self.data.agreedTerms) { wx.showToast({ title: '请先同意协议', icon: 'none' }); return; }
    var target = parseInt(self.data.targetCount);
    if (!target || target < 2) { wx.showToast({ title: '招募人数至少2', icon: 'none' }); return; }

    self.setData({ submitting: true });
    wx.showLoading({ title: '发布中...', mask: true });
    self.uploadImages().then(function (fileIDs) {
      if (!fileIDs.length) throw new Error('上传失败');
      return wx.cloud.callFunction({
        name: 'contentSecurity',
        data: { action: 'checkAll', content: (self.data.title + ' ' + self.data.contactInfo).trim(), openid: (getApp().globalData.userInfo||{})._openid||'', fileIDs: fileIDs }
      }).then(function (secRes) {
        var r = secRes.result;
        if (!r.success && r.audit === 'reject') throw { auditReject: true, reason: r.reason };
        var db = wx.cloud.database();
        return db.collection('posts').add({ data: {
          title: self.data.title.trim(), category: self.data.category,
          activityTime: self.data.activityTime.trim(), location: self.data.location.trim(),
          coverImages: fileIDs, city: self.data.city, gender: self.data.selectedGender,
          content: self.data.contactInfo.trim(), tags: [],
          targetCount: target, currentCount: 1,
          owner_show_wechat: self.data.ownerShowWechat, contact_info: self.data.contactInfo.trim(),
          audit_status: 'pass', stats: { likeCount:0, commentCount:0, viewCount:0, coinCount:0 },
          status: 'recruiting', createdAt: db.serverDate(), updatedAt: db.serverDate()
        }});
      });
    }).then(function () {
      wx.hideLoading(); wx.showToast({ title: '发布成功', icon: 'success' });
      var myOpenid = (getApp().globalData.userInfo || {})._openid;
      if (myOpenid && wx.cloud) {
        wx.cloud.callFunction({ name: 'sendNotification', data: {
          receiver_openid: myOpenid, type: 'audit', post_id: '', post_title: self.data.title.trim(),
          content: '你的活动已发布成功', senderAvatar: '', senderName: '系统'
        }}).catch(function () {});
      }
      setTimeout(function () { wx.navigateBack(); }, 800);
    }).catch(function (err) {
      wx.hideLoading(); self.setData({ submitting: false, uploading: false });
      if (err.auditReject && wx.cloud) {
        wx.cloud.callFunction({ name: 'sendNotification', data: {
          receiver_openid: (getApp().globalData.userInfo||{})._openid||'',
          type: 'audit', post_id: '', post_title: self.data.title.trim(),
          content: '帖子未通过审核：' + (err.reason||'内容违规'), senderAvatar: '', senderName: '系统'
        }}).catch(function () {});
      }
      wx.showToast({ title: err.auditReject ? (err.reason||'内容违规') : '发布失败', icon: 'none' });
    });
  },

  onInputTitle: function (e) { this.setData({ title: e.detail.value }); },
  formatDate: function (d) { var dt = new Date(d); var w = ['周日','周一','周二','周三','周四','周五','周六'][dt.getDay()]; return (dt.getMonth()+1)+'月'+dt.getDate()+'日 '+w; },
  onPickStartDate: function (e) { this.setData({ startDate: e.detail.value, startDateText: this.formatDate(e.detail.value) }); this.calcDuration(); this.updateActivityTime(); },
  onPickStartTime: function (e) { this.setData({ startTime: e.detail.value, startTimeText: e.detail.value }); this.updateActivityTime(); },
  onPickEndDate: function (e) { this.setData({ endDate: e.detail.value, endDateText: this.formatDate(e.detail.value) }); this.calcDuration(); this.updateActivityTime(); },
  onPickEndTime: function (e) { this.setData({ endTime: e.detail.value, endTimeText: e.detail.value }); this.updateActivityTime(); },
  calcDuration: function () {
    var sd = this.data.startDate, ed = this.data.endDate;
    if (sd && ed) {
      var days = Math.ceil((new Date(ed) - new Date(sd)) / 86400000) + 1;
      this.setData({ durationDays: days > 0 ? days : 0 });
    }
  },
  updateActivityTime: function () {
    var s = this.data.startDateText + ' ' + this.data.startTimeText;
    var e = this.data.endDateText + ' ' + this.data.endTimeText;
    if (this.data.startDateText && this.data.endDateText) {
      this.setData({ activityTime: s + ' - ' + e });
    }
  },
  onInputLocation: function (e) { this.setData({ location: e.detail.value }); },
  onChooseLocation: function () {
    var self = this;
    wx.chooseLocation({
      success: function (res) { if (res.address) self.setData({ location: res.address || res.name }); },
      fail: function () {}
    });
  },
  onInputTargetCount: function (e) { this.setData({ targetCount: e.detail.value }); },
  onInputContactInfo: function (e) { this.setData({ contactInfo: e.detail.value }); },
  onSwitchWechat: function (e) { this.setData({ ownerShowWechat: e.detail.value }); },
  onToggleAgreement: function () { this.setData({ agreedTerms: !this.data.agreedTerms }); },
  onTapAgreement: function () { wx.navigateTo({ url: '/pages/agreement/agreement' }); },
  onTapGender: function (e) { this.setData({ selectedGender: e.currentTarget.dataset.gender }); },
  onSelectCategory: function (e) { var c = e.currentTarget.dataset.cat; this.setData({ category: c === this.data.category ? '' : c }); },

  onTapBack: function () {
    if (this.data.title || this.data.images.length > 0) {
      wx.showModal({ title: '放弃编辑？', content: '已填写内容不会保存', success: function (r) { if (r.confirm) wx.navigateBack(); } });
    } else { wx.navigateBack(); }
  }
});
