define("discourse/routes/application", 
  ["discourse/lib/ajax","discourse/lib/computed","discourse/lib/logout","discourse/lib/show-modal","discourse/mixins/open-composer","discourse/models/category","discourse/lib/mobile","discourse/models/login-method","exports"],
  function(__dependency1__, __dependency2__, __dependency3__, __dependency4__, __dependency5__, __dependency6__, __dependency7__, __dependency8__, __exports__) {
    "use strict";
    var ajax = __dependency1__.ajax;
    var setting = __dependency2__.setting;
    var logout = __dependency3__["default"];
    var showModal = __dependency4__["default"];
    var OpenComposer = __dependency5__["default"];
    var Category = __dependency6__["default"];
    var mobile = __dependency7__["default"];
    var findAll = __dependency8__.findAll;

    function unlessReadOnly(method, message) {
      return function () {
        if (this.site.get("isReadOnly")) {
          bootbox.alert(message);
        } else {
          this[method]();
        }
      };
    }

    var ApplicationRoute = Discourse.Route.extend(OpenComposer, {
      siteTitle: setting('title'),

      _handleLogout: function () {
        var _this = this;

        if (this.currentUser) {
          this.currentUser.destroySession().then(function () {
            return logout(_this.siteSettings, _this.keyValueStore);
          });
        }
      },

      actions: {

        showSearchHelp: function () {
          ajax("/static/search_help.html", { dataType: 'html' }).then(function (model) {
            showModal('searchHelp', { model: model });
          });
        },

        toggleAnonymous: function () {
          ajax("/users/toggle-anon", { method: 'POST' }).then(function () {
            window.location.reload();
          });
        },

        toggleMobileView: function () {
          mobile.toggleMobileView();
        },

        logout: unlessReadOnly('_handleLogout', I18n.t("read_only_mode.logout_disabled")),

        _collectTitleTokens: function (tokens) {
          tokens.push(this.get('siteTitle'));
          Discourse.set('_docTitle', tokens.join(' - '));
        },

        // Ember doesn't provider a router `willTransition` event so let's make one
        willTransition: function () {
          var router = this.container.lookup('router:main');
          Ember.run.once(router, router.trigger, 'willTransition');
          return this._super();
        },

        showTopicEntrance: function (data) {
          this.controllerFor('topic-entrance').send('show', data);
        },

        postWasEnqueued: function (details) {
          var title = details.reason ? 'queue_reason.' + details.reason + '.title' : 'queue.approval.title';
          showModal('post-enqueued', { model: details, title: title });
        },

        composePrivateMessage: function (user, post) {

          var recipient = user ? user.get('username') : '',
              reply = post ? window.location.protocol + "//" + window.location.host + post.get("url") : null;

          // used only once, one less dependency
          var Composer = require('discourse/models/composer').default;
          return this.controllerFor('composer').open({
            action: Composer.PRIVATE_MESSAGE,
            usernames: recipient,
            archetypeId: 'private_message',
            draftKey: 'new_private_message',
            reply: reply
          });
        },

        error: function (err, transition) {
          var xhr = {};
          if (err.jqXHR) {
            xhr = err.jqXHR;
          }

          var xhrOrErr = err.jqXHR ? xhr : err;

          var exceptionController = this.controllerFor('exception');

          var c = window.console;
          if (c && c.error) {
            c.error(xhrOrErr);
          }

          exceptionController.setProperties({ lastTransition: transition, thrown: xhrOrErr });

          this.intermediateTransitionTo('exception');
          return true;
        },

        showLogin: unlessReadOnly('handleShowLogin', I18n.t("read_only_mode.login_disabled")),

        showCreateAccount: unlessReadOnly('handleShowCreateAccount', I18n.t("read_only_mode.login_disabled")),

        showForgotPassword: function () {
          showModal('forgotPassword', { title: 'forgot_password.title' });
        },

        showNotActivated: function (props) {
          showModal('not-activated', { title: 'log_in' }).setProperties(props);
        },

        showUploadSelector: function (toolbarEvent) {
          showModal('uploadSelector').setProperties({ toolbarEvent: toolbarEvent, imageUrl: null, imageLink: null });
        },

        showKeyboardShortcutsHelp: function () {
          showModal('keyboard-shortcuts-help', { title: 'keyboard_shortcuts_help.title' });
        },

        // Close the current modal, and destroy its state.
        closeModal: function () {
          this.render('hide-modal', { into: 'modal', outlet: 'modalBody' });
        },

        /**
          Hide the modal, but keep it with all its state so that it can be shown again later.
          This is useful if you want to prompt for confirmation. hideModal, ask "Are you sure?",
          user clicks "No", reopenModal. If user clicks "Yes", be sure to call closeModal.
        **/
        hideModal: function () {
          $('#discourse-modal').modal('hide');
        },

        reopenModal: function () {
          $('#discourse-modal').modal('show');
        },

        editCategory: function (category) {
          var _this2 = this;

          Category.reloadById(category.get('id')).then(function (atts) {
            var model = _this2.store.createRecord('category', atts.category);
            model.setupGroupsAndPermissions();
            _this2.site.updateCategory(model);
            showModal('editCategory', { model: model });
            _this2.controllerFor('editCategory').set('selectedTab', 'general');
          });
        },

        deleteSpammer: function (user) {
          this.send('closeModal');
          user.deleteAsSpammer(function () {
            window.location.reload();
          });
        },

        checkEmail: function (user) {
          user.checkEmail();
        },

        changeBulkTemplate: function (w) {
          var controllerName = w.replace('modal/', ''),
              factory = this.container.lookupFactory('controller:' + controllerName);

          this.render(w, { into: 'modal/topic-bulk-actions', outlet: 'bulkOutlet', controller: factory ? controllerName : 'topic-bulk-actions' });
        },

        createNewTopicViaParams: function (title, body, category_id, category, tags) {
          this.openComposerWithTopicParams(this.controllerFor('discovery/topics'), title, body, category_id, category, tags);
        },

        createNewMessageViaParams: function (username, title, body) {
          this.openComposerWithMessageParams(username, title, body);
        }
      },

      activate: function () {
        this._super();
        Em.run.next(function () {
          // Support for callbacks once the application has activated
          ApplicationRoute.trigger('activate');
        });
      },

      handleShowLogin: function () {
        var _this3 = this;

        if (this.siteSettings.enable_sso) {
          var returnPath = encodeURIComponent(window.location.pathname);
          window.location = Discourse.getURL('/session/sso?return_path=' + returnPath);
        } else {
          this._autoLogin('login', 'login-modal', function () {
            return _this3.controllerFor('login').resetForm();
          });
        }
      },

      handleShowCreateAccount: function () {
        if (this.siteSettings.enable_sso) {
          var returnPath = encodeURIComponent(window.location.pathname);
          window.location = Discourse.getURL('/session/sso?return_path=' + returnPath);
        } else {
          this._autoLogin('createAccount', 'create-account');
        }
      },

      _autoLogin: function (modal, modalClass, notAuto) {

        var methods = findAll(this.siteSettings, this.container.lookup('capabilities:main'), this.site.isMobileDevice);

        if (!this.siteSettings.enable_local_logins && methods.length === 1) {
          this.controllerFor('login').send('externalLogin', methods[0]);
        } else {
          showModal(modal);
          this.controllerFor('modal').set('modalClass', modalClass);
          if (notAuto) {
            notAuto();
          }
        }
      }

    });

    RSVP.EventTarget.mixin(ApplicationRoute);
    __exports__["default"] = ApplicationRoute;
  });
