var EXPORTED_SYMBOLS = ['PartnerBookmarks'];

const { classes: Cc, interfaces: Ci, results: Cr, utils: Cu } = Components;

Cu.import("resource://gre/modules/XPCOMUtils.jsm");
XPCOMUtils.defineLazyModuleGetter(this, "PlacesUtils",
  "resource://gre/modules/PlacesUtils.jsm");
XPCOMUtils.defineLazyModuleGetter(this, "Services",
  "resource://gre/modules/Services.jsm");
XPCOMUtils.defineLazyModuleGetter(this, "SignatureVerifier",
  "resource://ntab/mozCNUtils.jsm");
XPCOMUtils.defineLazyModuleGetter(this, "Tracking",
  "resource://ntab/Tracking.jsm");

let PartnerBookmarks = {
  get fisvc() {
    delete this.fisvc;
    return this.fisvc = Cc['@mozilla.org/browser/favicon-service;1'].
      getService(Ci.mozIAsyncFavicons || Ci.nsIFaviconService);
  },

  get prefs() {
    let branch = Services.prefs.getBranch('moa.partnerbookmark.');
    delete this.prefs;
    return this.prefs = branch;
  },

  get updateUrl() {
    delete this.updateUrl;
    return this.updateUrl = 'http://bookmarks.firefoxchina.cn/bookmarks/updates.json';
  },

  _getCharPref: function(aPrefKey, aDefault) {
    let ret = aDefault;
    try {
      ret = this.prefs.getCharPref(aPrefKey);
    } catch(e) {}
    return ret;
  },

  _fetch: function(aUrl, aCallback) {
    if (!aUrl) {
      return;
    }
    let xhr = Cc["@mozilla.org/xmlextras/xmlhttprequest;1"]
                .createInstance(Ci.nsIXMLHttpRequest);
    xhr.open('GET', aUrl, true);
    xhr.onload = function(evt) {
      if (xhr.status == 200) {
        let data = JSON.parse(xhr.responseText);
        aCallback(data);
      }
    };
    xhr.onerror = function(evt) {};
    xhr.send();
  },

  _keywordsForBookmarks: {
    // batch #1
    // predefined (excluding those w/o querystrings?)
    'http://www.baidu.com/index.php?tn=monline_5_dg': 'mozcn:baidu:home',
    'http://www.vancl.com/?source=mozilla': 'mozcn:vancl:home',
    'http://r.union.meituan.com/url/visit/?a=1&key=yKmOefsJ5QiYS98RvpLzMN2qxT7BFhr4&url=http://www.meituan.com': 'mozcn:meituan:union',
    'http://www.hao123.com/?tn=12092018_12_hao_pg': 'mozcn:hao123:home',
    'http://youxi.baidu.com/yxpm/pm.jsp?pid=11016500091_877110': 'mozcn:baidu:youxi',

    // jd
    'http://click.union.360buy.com/JdClick/?unionId=206&siteId=1&to=http://www.360buy.com/': 'mozcn:jd:union',
    'http://click.union.360buy.com/JdClick/?unionId=316&siteId=21946&to=http://www.360buy.com': 'mozcn:jd:union',
    'http://click.union.360buy.com/JdClick/?unionId=20&siteId=439040_test_&to=http://www.360buy.com': 'mozcn:jd:union',

    // taobao (legacy)
    'http://click.mz.simba.taobao.com/rd?w=mmp4ptest&f=http%3A%2F%2Fwww.taobao.com%2Fgo%2Fchn%2Ftbk_channel%2Fonsale.php%3Fpid%3Dmm_28347190_2425761_9313996&k=e02915d8b8ad9603': 'mozcn:taobao:legacy',
    'http://redirect.simba.taobao.com/rd?c=un&w=channel&f=http%3A%2F%2Fwww.taobao.com%2Fgo%2Fchn%2Ftbk_channel%2Fonsale.php%3Fpid%3Dmm_28347190_2425761_9313997%26unid%3D&k=e02915d8b8ad9603&p=mm_28347190_2425761_9313997': 'mozcn:taobao:legacy',
    'http://redirect.simba.taobao.com/rd?c=un&w=channel&f=http%3A%2F%2Fwww.taobao.com%2Fgo%2Fchn%2Ftbk_channel%2Fonsale.php%3Fpid%3Dmm_28347190_2425761_13466329%26unid%3D&k=e02915d8b8ad9603&p=mm_28347190_2425761_13466329': 'mozcn:taobao:legacy',

    // tmall (legacy)
    'http://www.tmall.com/go/chn/tbk_channel/tmall_new.php?pid=mm_28347190_2425761_9313996&eventid=101334': 'mozcn:tmall:legacy',

    // weibo
    'http://weibo.com/?c=spr_web_sq_firefox_weibo_t001': 'mozcn:weibo:home',

    // yhd
    'http://www.yihaodian.com/product/index.do?merchant=1&tracker_u=1787&tracker_type=1&uid=433588_test_': 'mozcn:yhd:home',

    // taobao
    'http://www.taobao.com/go/chn/tbk_channel/onsale.php?pid=mm_28347190_2425761_13730658&eventid=101329': 'mozcn:toolbar:taobao',

    // tmall
    'http://s.click.taobao.com/t_9?p=mm_28347190_2425761_13676372&l=http%3A%2F%2Fmall.taobao.com%2F': 'mozcn:toolbar:tmall',
    'http://s.click.taobao.com/t?e=zGU34CA7K%2BPkqB05%2Bm7rfGGjlY60oHcc7bkKOQYmIX0uNLK1pwv%2BifTaqFIrn1w%2FakplTBnP3D56LgXgufuIPG%2FcBYvSdiC2vkuCKsBVr8VLhdXwLQ%3D%3D': 'mozcn:toolbar:tmall',
    'http://s.click.taobao.com/t_9?p=mm_28347190_2425761_14472249&l=http%3A%2F%2Fmall.taobao.com%2F': 'mozcn:toolbar:tmall',
    'http://s.click.taobao.com/t?e=m%3D2%26s%3DGEWeb2k8yoQcQipKwQzePCperVdZeJviK7Vc7tFgwiFRAdhuF14FMXq0KRRmDoQot4hWD5k2kjNoVxuUFnM6iJG6UkagZE085UoOeRlV%2BcG%2Bh63zuUZMYYgaseAKBk0cDPtbhjM5VDw%3D': 'mozcn:toolbar:tmall',
    'http://s.click.taobao.com/t?e=m%3D2%26s%3D0XGYiwkvavMcQipKwQzePCperVdZeJviK7Vc7tFgwiFRAdhuF14FMagXItMrTZFp79%2FTFaMDK6RoVxuUFnM6iJG6UkagZE085UoOeRlV%2BcG%2Bh63zuUZMYYgaseAKBk0cLdkr8YvWKT4%3D': 'mozcn:toolbar:tmall',
    'http://s.click.taobao.com/t?e=m%3D2%26s%3DHLQ0nwFAGAUcQipKwQzePCperVdZeJviK7Vc7tFgwiFRAdhuF14FMfTDcs3PiqZXlovu%2FCElQOtoVxuUFnM6iJG6UkagZE085UoOeRlV%2BcG%2Bh63zuUZMYYgaseAKBk0cLdkr8YvWKT4%3D': 'mozcn:toolbar:tmall',

    // batch #2, for bug 2260
    'http://www.amazon.cn/?source=Mozilla': 'mozcn:amazoncn:home',
    'http://aos.prf.hn/click/camref:111lEF': 'mozcn:applestore:home',
    'https://www.baidu.com/index.php?tn=monline_3_dg': 'mozcn:baidu:home',
    'https://www.baidu.com/index.php?tn=monline_6_dg': 'mozcn:baidu:home',
    'http://ai.taobao.com/?pid=mm_28347190_2425761_17624777': 'mozcn:taobao:legacy',
    'http://ai.taobao.com/?pid=mm_28347190_2425761_20444747': 'mozcn:toolbar:taobao',
    'http://ai.taobao.com/?pid=mm_28347190_2425761_20450656': 'mozcn:toolbar:taobao',
    'http://ai.taobao.com/?pid=mm_28347190_2425761_20458269': 'mozcn:toolbar:taobao',
    'http://s.click.taobao.com/t?e=m%3D2%26s%3DIJymWS3%2FHfIcQipKwQzePCperVdZeJviK7Vc7tFgwiFRAdhuF14FMfYs3%2BfQ9YMc79%2FTFaMDK6RoVxuUFnM6iMUjUj9sJ%2FOjxctsWvavBZ6hMMc65kB68aUuZxIcp9pfUIgVEmFmgnbDX0%2BHH2IEVaX4VWt66S4EJPwiig1bxLP9BvYCQR6XAr%2BKQ71wHNCAqP8YyUoZZlq4cXg3ii9waXPs9Sj9Qli1np4c65at3FeX3cwyLTlAhj2l4PysJx%2FP': 'mozcn:toolbar:tmall11nov',
    'http://www.yihaodian.com/?tracker_u=10977119545': 'mozcn:yhd:home'
  },

  _backfillKeywords: function() {
    let backfillVersion = 0;
    try {
      // backfillversion was incorrectly set as bool pref in bug 1091
      if (this.prefs.getPrefType('backfillversion') == this.prefs.PREF_BOOL) {
        backfillVersion = this.prefs.getBoolPref('backfillversion') ? 1 : 0;
        this.prefs.clearUserPref('backfillversion');
        this.prefs.setIntPref('backfillversion', backfillVersion);
      } else {
        backfillVersion = this.prefs.getIntPref('backfillversion');
      }
    } catch(e) {}

    if (backfillVersion >= this._backfillVersion) {
      return;
    }

    let urls = Object.keys(this._keywordsForBookmarks);

    let self = this;
    // Since Fx 39
    if (PlacesUtils.keywords) {
      return Promise.all(urls.map(function(url) {
        return PlacesUtils.bookmarks.fetch({
          url: url
        }).then(function(bookmark) {
          // Working with keywords, not bookmarks, so just test for existance.
          if (!bookmark) {
            return;
          }

          return PlacesUtils.keywords.insert({
            keyword: self._keywordsForBookmarks[url],
            url: url
          }).catch(function(ex) {
            // ignore the case where 2+ urls of the same keyword exist.
          });
        });
      })).then(function() {
        self.prefs.setIntPref('backfillversion', self._backfillVersion);
        self.prefs.clearUserPref('migration');
      });
    } else {
      urls.forEach(function(aUrl) {
        let url = aUrl;
        let keyword = self._keywordsForBookmarks[url];
        let uri = Services.io.newURI(url, null, null);
        let bookmarks = PlacesUtils.bookmarks.getBookmarkIdsForURI(uri, {});
        for (let i = 0, l = bookmarks.length; i < l; i++) {
          PlacesUtils.bookmarks.setKeywordForBookmark(bookmarks[i], keyword);
        }
      });

      this.prefs.setIntPref('backfillversion', this._backfillVersion);
      this.prefs.clearUserPref('migration');
    }
  },

  _setFaviconForUrl(uri, iconData) {
    let faviconUri = Services.io.newURI('fake-favicon-uri:' + uri, null, null);
    let systemPrincipal = Services.scriptSecurityManager.getSystemPrincipal();
    this.fisvc.replaceFaviconDataFromDataURL(faviconUri, iconData, 0,
      systemPrincipal);
    let newUri = Services.io.newURI(uri, null, null);
    this.fisvc.setAndFetchFaviconForPage(newUri, faviconUri, false,
      this.fisvc.FAVICON_LOAD_NON_PRIVATE, null, systemPrincipal);
  },

  _tempFix: function() {
    let tempFixVersion = 0;
    try {
      tempFixVersion = this.prefs.getIntPref('tempfixversion');
    } catch(e) {}

    if (tempFixVersion >= this._tempFixVersion) {
      return;
    }

    if (Date.now() >= this._tempFixVersion * 3600e3) {
      let self = this;
      if (PlacesUtils.keywords) {
        return self._removeOrphanedKeywords().then(function() {
          self.prefs.setIntPref('tempfixversion', self._tempFixVersion);
        });
      } else {
        this.prefs.setIntPref('tempfixversion', this._tempFixVersion);
      }
    } else {
      let keyword = 'mozcn:toolbar:tmall18jun';
      let item = {
        favicon: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAZklEQVQ4je2SOw6AIBQEBwwFFS0cwstwKBq989oQTdTED2rlS6bbnWLzEL1a4FnB2XtPsGancG2DX/CRIBPkMCrE099XiHIYZYIwICoj6bA8kOZ87S4CQB6rQLeLx2qd3whu0CaYAA69JBBEwec9AAAAAElFTkSuQmCC',
        indexNoRef: 4,
        indexRefs: ['mozcn:toolbar:jd', 'mozcn:toolbar:taobao'],
        parent: PlacesUtils.bookmarks.toolbarFolder,
        parentGuid: PlacesUtils.bookmarks.toolbarGuid,
        title: '\u5929\u732b6.18',
        uri: 'https://s.click.taobao.com/t?e=m%3D2%26s%3DBLRFk9jQcEgcQipKwQzePCperVdZeJviK7Vc7tFgwiFRAdhuF14FMfEyMcFxZkRP1aH1Hk3GeOhoVxuUFnM6iMUjUj9sJ%2FOj1mvebSZJTzUa7rG88kl1%2BaUuZxIcp9pfUIgVEmFmgnaR4ypTBJBwtB6l0bxfYrBpJPwiig1bxLMAV4Err%2B0r%2ByrbHgqSJ08vcSpj5qSCmbA%3D'
      };

      let bookmarks = [],
          existedTmall = false,
          refIndex = -Infinity;
      let self = this;
      if (PlacesUtils.keywords) {
        return PlacesUtils.promiseDBConnection().then(function(db) {
          return db.execute(`SELECT b.title AS title, p.url AS url
            FROM moz_bookmarks AS b JOIN moz_places AS p ON b.fk = p.id
            WHERE b.parent = :parent_id AND p.url LIKE :tmall_url
            LIMIT 1;`,
            {
              parent_id: item.parent,
              tmall_url: "%://www.tmall.com/%"
            }
          );
        }).then(function(rows) {
          existedTmall = !!rows.length;

          return PlacesUtils.keywords.fetch(keyword);
        }).then(function(keywordObj) {
          if (!keywordObj) {
            return;
          }

          return PlacesUtils.bookmarks.fetch({
            url: keywordObj.url.href
          }, function(bookmark) {
            bookmarks.push(bookmark);
          });
        }).then(function() {
          return Promise.all(item.indexRefs.map(function(indexRef) {
            return PlacesUtils.keywords.fetch(indexRef);
          }));
        }).then(function(refKeywordObjs) {
          let refKeywordObj;
          while (!refKeywordObj && refKeywordObjs.length) {
            refKeywordObj = refKeywordObjs.shift();
          }
          if (!refKeywordObj) {
            return;
          }

          return PlacesUtils.bookmarks.fetch({
            url: refKeywordObj.url.href
          }, function(bookmark) {
            if (bookmark.parentGuid !== item.parentGuid) {
              return;
            }
            refIndex = Math.max(bookmark.index, refIndex);
          });
        }).then(function() {
          let index = refIndex === -Infinity ? item.indexNoRef : (refIndex + 1);

          if (bookmarks.filter(function(bookmark) {
            return bookmark.parentGuid === item.parentGuid;
          }).length || existedTmall) {
            return;
          }

          return PlacesUtils.bookmarks.insert({
            parentGuid: item.parentGuid,
            index: index,
            title: item.title,
            url: item.uri
          });
        }).then(function() {
          return Promise.all(bookmarks.map(function(bookmark) {
            bookmark.url = item.uri;
            if (item.title) {
              bookmark.title = item.title;
            }
            return PlacesUtils.bookmarks.update(bookmark);
          }));
        }).then(function() {
          if (item.favicon) {
            self._setFaviconForUrl(item.uri, item.favicon);
          }

          return PlacesUtils.keywords.insert({
            keyword: keyword,
            url: item.uri
          });
        }).then(function() {
          return self._removeOrphanedKeywords();
        }).then(function() {
          self.prefs.setIntPref('tempfixversion', self._tempFixVersion);
        });
      } else {
        // don't care about such old versions
        this.prefs.setIntPref('tempfixversion', this._tempFixVersion);
      }
    }
  },

  _removeOrphanedKeywords: function() {
    let removals = [];
    return PlacesUtils.promiseDBConnection().then(function(db) {
      return db.execute(`SELECT keyword FROM moz_keywords AS k
        WHERE k.keyword LIKE :keyword AND
          NOT EXISTS (SELECT 1 FROM moz_bookmarks AS b JOIN moz_places AS p
                        ON b.fk = p.id WHERE p.id = k.place_id)`,
        {
          keyword: "mozcn:%"
        },
        function(row) {
          let keyword = row.getResultByName("keyword");
          removals.push(PlacesUtils.keywords.remove(keyword));
        }
      );
    }).then(function() {
      return Promise.all(removals);
    }, function(err) {
      Cu.reportError(err);
    });
  },

  _realUpdate: function(aUpdates, aSignature) {
    if (this._getCharPref('signature', '') == aSignature) {
      return;
    }

    let keywords = Object.keys(aUpdates);

    let self = this;
    if (PlacesUtils.keywords) {
      return Promise.all(keywords.map(function(keyword) {
        return PlacesUtils.keywords.fetch(keyword).then(function(keywordObj) {
          if (!keywordObj) {
            return;
          }

          let item = aUpdates[keyword];
          let bookmarks = [];
          return PlacesUtils.bookmarks.fetch({
            url: keywordObj.url.href
          }, function(bookmark) {
            bookmarks.push(bookmark);
          }).then(function() {
            return Promise.all(bookmarks.map(function(bookmark) {
              if (item.uri) {
                bookmark.url = item.uri;
                if (item.title) {
                  bookmark.title = item.title;
                }
                return PlacesUtils.bookmarks.update(bookmark);
              } else {
                /* an empty object could be used to remove bookmarks:
                   ... "mozcn:***:***": {}, ... */
                return PlacesUtils.bookmarks.remove(bookmark);
              }
            })).then(function() {
              if (!item.uri) {
                return;
              }

              if (item.favicon) {
                self._setFaviconForUrl(item.uri, item.favicon);
              }
              return PlacesUtils.keywords.insert({
                keyword: (item.keyword || keyword),
                url: item.uri
              });
            });
          });
        });
      })).then(function() {
        return self._removeOrphanedKeywords();
      }).then(function() {
        self.prefs.setCharPref('signature', aSignature);
      });
    } else {
      keywords.forEach(function(aKeyword) {
        let uri = PlacesUtils.bookmarks.getURIForKeyword(aKeyword);
        if (!uri) {
          return;
        }

        let item = aUpdates[aKeyword];
        let bookmarks = PlacesUtils.bookmarks.getBookmarkIdsForURI(uri, {});
        for (let i = 0, l = bookmarks.length; i < l; i++) {
          let id = bookmarks[i];
          // DO NOT change bookmark with matched url but not expected keyword
          if (PlacesUtils.bookmarks.getKeywordForBookmark(id) == aKeyword) {
            if (item.uri) {
              let newUri = Services.io.newURI(item.uri, null, null);
              PlacesUtils.bookmarks.changeBookmarkURI(id, newUri);

              if (item.title) {
                PlacesUtils.bookmarks.setItemTitle(id, item.title);
              }
              if (item.favicon) {
                self._setFaviconForUrl(item.uri, item.favicon);
              }
              if (item.keyword) {
                PlacesUtils.bookmarks.setKeywordForBookmark(id, item.keyword);
              }
            } else {
              /* an empty object could be used to remove bookmarks:
                 ... "mozcn:***:***": {}, ... */
              PlacesUtils.bookmarks.removeItem(id);
            }
          }
        }
      });

      this.prefs.setCharPref('signature', aSignature);
    }
  },

  update: function() {
    let self = this;
    this._fetch(this.updateUrl, function(aData) {
      if (SignatureVerifier.verify(aData.data, aData.signature)) {
        self._realUpdate(JSON.parse(aData.data), aData.signature);
      }
    });
  },

  _inited: false,

  _backfillVersion: 2,

  // (new Date(2017, 5, 19, 8)).getTime() / 3600e3 @ 2017-06-21T00:00:00.000Z
  _tempFixVersion: 416112,

  init: function() {
    if (this._inited) {
      return;
    }
    this._inited = true;

    let self = this;
    let promise = this._backfillKeywords();

    if (promise) {
      promise = promise.then(function() {
        return self._tempFix();
      });
    } else {
      promise = this._tempFix();
    }

    if (promise) {
      promise.then(function() {
        return self.update();
      })
    } else {
      this.update();
    }

    PlacesUtils.bookmarks.addObserver({
      onBeginUpdateBatch: function() {},
      onEndUpdateBatch: function() {},
      onItemAdded: function() {},
      onBeforeItemRemoved: function() {},
      onItemRemoved: function() {},
      onItemChanged: function() {},
      onItemVisited: function(aItemId, b, c, d, aURI, f, g, h) {
        let keyword = PlacesUtils.bookmarks.getKeywordForBookmark(aItemId);
        let prefix = 'mozcn:toolbar:';
        if (keyword && keyword.indexOf(prefix) == 0) {
          Tracking.track({
            type: 'bookmarks',
            action: 'click',
            sid: keyword.substring(prefix.length)
          });
        }
      },
      onItemMoved: function() {}
    }, false);
  },

  getUpdateTracking: function(aSlugs) {
    // Since Fx 53, https://bugzil.la/1329926
    if (!PlacesUtils.bookmarks.getURIForKeyword) {
      return "NA";
    }

    let ret = [];

    aSlugs.forEach(function(aSlug) {
      let keyword = 'mozcn:toolbar:' + aSlug;
      let uri = PlacesUtils.bookmarks.getURIForKeyword(keyword);
      if (!uri) {
        return;
      }

      ret.push(aSlug);
    })
    return ret.join(',') || 'false';
  }
};
