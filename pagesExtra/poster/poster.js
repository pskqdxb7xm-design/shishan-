var app = getApp();

Page({
  data: { post: {}, qrcodeUrl: '', posterUrl: '', saving: false },

  onLoad(o) {
    var p = this.data.post;
    p.id = o.id || ''; p.title = decodeURIComponent(o.title || '精彩活动');
    p.cat = decodeURIComponent(o.cat || ''); p.img = decodeURIComponent(o.img || '');
    p.name = (app.globalData.userInfo || {}).nickname || '我';
    p.av = (app.globalData.userInfo || {}).avatar || '';
    this.setData({ post: p });
    this.makeQr();
  },

  makeQr() {
    var self = this, id = self.data.post.id;
    wx.cloud.callFunction({ name: 'getWxacode', data: { postId: id } })
      .then(r => { if (r.result && r.result.success) self.setData({ qrcodeUrl: r.result.tempUrl || r.result.fileID }); else throw 0; })
      .catch(() => { self.setData({ qrcodeUrl: 'https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=' + encodeURIComponent('id=' + id) }); })
      .finally(() => setTimeout(() => self.draw(), 300));
  },

  dl(url) {
    return new Promise(resolve => {
      if (!url) return resolve('');
      if (/^(wxfile|http:\/\/tmp)/.test(url)) return resolve(url);
      // cloud:// 文件需先转临时链接
      if (/^cloud:\/\//.test(url)) {
        if (!wx.cloud) return resolve('');
        return wx.cloud.getTempFileURL({ fileList: [url] }).then(r => {
          var t = (r.fileList && r.fileList[0]) ? r.fileList[0].tempFileURL : '';
          return t ? resolve(t) : resolve('');
        }).catch(() => resolve(''));
      }
      wx.downloadFile({ url, success: r => resolve(r.tempFilePath), fail: () => resolve('') });
    });
  },

  async draw() {
    var self = this, p = self.data.post;
    wx.showLoading({ title: '渲染中', mask: true });

    // 1. 下载所有图片
    var urls = [p.img, p.av, self.data.qrcodeUrl];
    var paths = await Promise.all(urls.map(u => self.dl(u)));
    wx.hideLoading();

    // 2. 获取 canvas
    var res = await new Promise(r => wx.createSelectorQuery().select('#posterCanvas').fields({ node: true, size: true }).exec(r));
    var d = res[0]; if (!d || !d.node) return wx.showToast({ title: 'Canvas失败', icon: 'none' });
    var cvs = d.node, ctx = cvs.getContext('2d');
    var W = 375, H = 612, dpr = wx.getSystemInfoSync().pixelRatio;
    cvs.width = W * dpr; cvs.height = H * dpr; ctx.scale(dpr, dpr);

    // 3. 加载 Canvas 图片对象
    var imgs = await Promise.all(paths.map(src => new Promise(r => {
      if (!src) return r(null);
      var img = cvs.createImage(); img.src = src;
      img.onload = () => r(img); img.onerror = () => r(null);
    })));
    var [cover, av, qr] = imgs;

    // 4. 绘制
    // ── 渐变背景 ──
    var g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, '#FF8C60'); g.addColorStop(1, '#E85520');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

    // ── 封面图 ──
    if (cover) {
      ctx.save(); rrect(ctx, 16, 50, W - 32, 240, 14); ctx.clip();
      ctx.drawImage(cover, 16, 50, W - 32, 240); ctx.restore();
    }

    // ── 底部白色卡片 ──
    rrect(ctx, 0, 250, W, H - 250, 20); ctx.fillStyle = '#fff'; ctx.fill();
    // 卡片上的装饰条
    rrect(ctx, 0, 250, W, 6, 0); ctx.fillStyle = '#FF6B35'; ctx.fill();

    // ── 头像 ──
    ctx.save(); ctx.beginPath(); ctx.arc(50, 290, 22, 0, Math.PI * 2); ctx.clip();
    if (av) ctx.drawImage(av, 28, 268, 44, 44);
    else { ctx.fillStyle = '#FFF0E8'; ctx.fill(); } ctx.restore();

    // ── 用户名 ──
    ctx.fillStyle = '#1a1a1a'; ctx.font = 'bold 15px sans-serif'; ctx.fillText(p.name, 86, 284);
    ctx.fillStyle = '#FF6B35'; ctx.font = '12px sans-serif'; ctx.fillText('发起了一个活动', 86, 302);

    // ── 标题 ──
    ctx.fillStyle = '#1a1a1a'; ctx.font = 'bold 21px sans-serif';
    var lines = wrap(ctx, p.title, W - 60);
    lines.slice(0, 2).forEach((l, i) => ctx.fillText(l, 32, 350 + i * 28));

    // ── 分类 ──
    if (p.cat) {
      var catY = 350 + Math.min(lines.length, 2) * 28 + 10;
      var tw = ctx.measureText(p.cat).width + 24;
      rrect(ctx, 32, catY - 16, tw, 28, 14); ctx.fillStyle = '#FF6B35'; ctx.fill();
      ctx.fillStyle = '#fff'; ctx.font = '12px sans-serif'; ctx.fillText(p.cat, 44, catY + 2);
    }

    // ── 分隔线 ──
    ctx.strokeStyle = 'rgba(0,0,0,0.06)'; ctx.beginPath(); ctx.moveTo(32, H - 140); ctx.lineTo(W - 32, H - 140); ctx.stroke();

    // ── 小程序码 ──
    if (qr) ctx.drawImage(qr, W - 132, H - 124, 90, 90);

    // ── 引导文字 ──
    ctx.fillStyle = '#9ca3af'; ctx.font = '12px sans-serif';
    ctx.fillText('长按识别小程序码', 32, H - 90);
    ctx.fillText('扫码查看活动详情', 32, H - 68);

    // 5. 导出
    wx.canvasToTempFilePath({ canvas: cvs, fileType: 'png', quality: 0.95,
      success: r => self.setData({ posterUrl: r.tempFilePath })
    });
  },

  onSavePoster() {
    var self = this;
    if (!self.data.posterUrl) return wx.showToast({ title: '海报未生成', icon: 'none' });
    wx.saveImageToPhotosAlbum({
      filePath: self.data.posterUrl,
      success: () => wx.showToast({ title: '已保存到相册', icon: 'success' }),
      fail: e => { if (e.errMsg.includes('auth')) wx.showModal({ title: '需要权限', content: '请开启相册权限', success: r => { if (r.confirm) wx.openSetting(); } }); }
    });
  },

  onTapBack() { wx.navigateBack(); }
});

function rrect(ctx, x, y, w, h, r) {
  if (r === 0) { ctx.beginPath(); ctx.rect(x, y, w, h); ctx.closePath(); return; }
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r); ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h); ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r); ctx.arcTo(x, y, x + r, y, r); ctx.closePath();
}

function wrap(ctx, text, maxW) {
  var lines = [], cur = '';
  for (var c of text) { var t = cur + c; if (ctx.measureText(t).width > maxW && cur) { lines.push(cur); cur = c; } else cur = t; }
  if (cur) lines.push(cur);
  return lines.length ? lines : [text];
}
