// utils/cloud.js
// 云数据库工具类 —— 微信小程序版
// 优先使用 wx.cloud.database()，不可用时回退到本地 Mock

var ENV_ID = 'cloud1-d7grg9j8u62bb417a';

// ============================================================
// 检查 wx.cloud 是否可用
// ============================================================
function isCloudAvailable() {
  return typeof wx !== 'undefined' && wx.cloud && wx.cloud.database;
}

// ============================================================
// 获取数据库实例
// ============================================================
function getDb() {
  if (isCloudAvailable()) {
    return wx.cloud.database();
  }
  console.warn('[cloud] wx.cloud 不可用，使用本地 Mock 模式');
  return { collection: getMockCollection };
}

// ============================================================
// 获取集合引用（自动判断云/Mock）
// ============================================================
function getCollection(name) {
  if (isCloudAvailable()) {
    return wx.cloud.database().collection(name);
  }
  return getMockCollection(name);
}

// ============================================================
// Mock 数据存储（CloudBase 不可用时的后备）
// ============================================================
var mockStore = {};

function getMockStore(name) {
  if (!mockStore[name]) mockStore[name] = [];
  return mockStore[name];
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 10);
}

function getMockCollection(name) {
  var items = getMockStore(name);

  return {
    where: function (condition) {
      var filtered = items.filter(function (doc) {
        return Object.keys(condition).every(function (key) {
          return doc[key] === condition[key];
        });
      });
      return createMockQuery(filtered);
    },

    doc: function (id) {
      return {
        get: function () {
          var doc = findById(items, id);
          return doc ? { data: [doc] } : { data: [] };
        },
        update: function (data) {
          var idx = findIndex(items, id);
          if (idx !== -1) {
            items[idx] = Object.assign({}, items[idx], data, {
              updatedAt: new Date().toISOString()
            });
            return { stats: { updated: 1 } };
          }
          return { stats: { updated: 0 } };
        },
        remove: function () {
          var idx = findIndex(items, id);
          if (idx !== -1) {
            items.splice(idx, 1);
            return { stats: { removed: 1 } };
          }
          return { stats: { removed: 0 } };
        }
      };
    },

    add: function (data) {
      var now = new Date().toISOString();
      var doc = Object.assign({ _id: generateId() }, data, {
        createdAt: now,
        updatedAt: now
      });
      items.push(doc);
      return { _id: doc._id };
    },

    get: function () {
      return createMockQuery(items.slice());
    },

    count: function () {
      return { total: items.length };
    }
  };
}

function createMockQuery(arr) {
  var result = arr.slice();

  var query = {
    orderBy: function (field, direction) {
      result.sort(function (a, b) {
        var va = a[field] || 0;
        var vb = b[field] || 0;
        return direction === 'desc' ? Number(vb) - Number(va) : Number(va) - Number(vb);
      });
      return query;
    },
    limit: function (n) {
      result = result.slice(0, n);
      return query;
    },
    skip: function (n) {
      result = result.slice(n);
      return query;
    },
    field: function (fields) {
      var keys = Object.keys(fields).filter(function (k) { return fields[k]; });
      result = result.map(function (doc) {
        var picked = {};
        keys.forEach(function (k) {
          if (k in doc) picked[k] = doc[k];
        });
        return picked;
      });
      return query;
    },
    get: function () {
      return { data: result };
    },
    count: function () {
      return { total: result.length };
    }
  };

  return query;
}

function findById(arr, id) {
  for (var i = 0; i < arr.length; i++) {
    if (arr[i]._id === id) return arr[i];
  }
  return null;
}

function findIndex(arr, id) {
  for (var i = 0; i < arr.length; i++) {
    if (arr[i]._id === id) return i;
  }
  return -1;
}

// ============================================================
// 通用错误包装
// ============================================================
function dbCall(fn) {
  try {
    var result = fn();
    if (result && typeof result.then === 'function') {
      return result
        .then(function (data) {
          return { data: data, error: null };
        })
        .catch(function (err) {
          console.error('[cloud] 操作失败:', err);
          return { data: null, error: err.message || '数据库操作失败' };
        });
    }
    return { data: result, error: null };
  } catch (err) {
    console.error('[cloud] 操作失败:', err);
    return { data: null, error: err.message || '数据库操作失败' };
  }
}

// ============================================================
// 常用业务操作封装
// ============================================================

/** 获取帖子列表 */
function getPosts(options) {
  options = options || {};
  var orderBy = options.orderBy || 'createdAt';
  var direction = options.direction || 'desc';
  var limit = options.limit || 20;
  var skip = options.skip || 0;
  var where = options.where || {};

  return dbCall(function () {
    return getCollection('posts')
      .where(Object.assign({ status: 'published' }, where))
      .orderBy(orderBy, direction)
      .skip(skip)
      .limit(limit)
      .get();
  });
}

/** 获取帖子的评论（一级） */
function getComments(postId) {
  return dbCall(function () {
    return getCollection('comments')
      .where({ postId: postId, parentId: null, status: 'active' })
      .orderBy('createdAt', 'asc')
      .get();
  });
}

/** 获取评论的回复 */
function getCommentReplies(commentId) {
  return dbCall(function () {
    return getCollection('comments')
      .where({ parentId: commentId, status: 'active' })
      .orderBy('createdAt', 'asc')
      .get();
  });
}

/** 获取用户信息 */
function getUser(userId) {
  return dbCall(function () {
    return getCollection('users').where({ userId: userId }).get();
  });
}

/** 点赞/取消点赞 */
function toggleLike(params) {
  var userId = params.userId;
  var targetType = params.targetType;
  var targetId = params.targetId;
  var targetUserId = params.targetUserId;

  return dbCall(function () {
    var existing = getCollection('user_actions')
      .where({
        userId: userId,
        targetType: targetType,
        targetId: targetId,
        actionType: 'like'
      })
      .get();

    if (existing.data && existing.data.length > 0) {
      getCollection('user_actions').doc(existing.data[0]._id).remove();
      return { liked: false };
    } else {
      getCollection('user_actions').add({
        userId: userId,
        targetType: targetType,
        targetId: targetId,
        targetUserId: targetUserId,
        actionType: 'like'
      });
      return { liked: true };
    }
  });
}

module.exports = {
  getDb: getDb,
  getCollection: getCollection,
  dbCall: dbCall,
  getPosts: getPosts,
  getComments: getComments,
  getCommentReplies: getCommentReplies,
  getUser: getUser,
  toggleLike: toggleLike
};
